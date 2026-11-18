import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockLot } from '../models/StockLot.js';
import { Movement } from '../models/Movement.js';
import { Count } from '../models/Count.js';
import { AppError } from '../middleware/errorHandler.js';
import { UNIT_CONFIG, toBaseUnit, fromBaseUnit, formatQuantityWithUnit } from '../utils/units.js';
import { broadcast } from '../socket.js';

/**
 * Get current system stock for all products at a specific location
 */
export async function getSystemStockAtLocation(location = 'Shop') {
  const products = await Product.find().lean();
  const pIds = products.map(p => p._id);

  const movementAgg = await Movement.aggregate([
    { $match: { product: { $in: pIds } } },
    {
      $group: {
        _id: '$product',
        added: {
          $sum: {
            $cond: [{ $eq: ['$toLocation', location] }, '$quantity', 0],
          },
        },
        deducted: {
          $sum: {
            $cond: [{ $eq: ['$fromLocation', location] }, '$quantity', 0],
          },
        },
      },
    },
  ]);

  const remMap = new Map();
  movementAgg.forEach(m => {
    remMap.set(m._id.toString(), Math.max(0, m.added - m.deducted));
  });

  return products.map(p => {
    const baseQty = remMap.get(p._id.toString()) || 0;
    return {
      _id: p._id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      systemQty: baseQty,
      systemQtyDisplay: fromBaseUnit(baseQty, p.unit),
    };
  });
}

/**
 * Previews reconciliation comparison between system stock and counted inputs
 */
export async function previewReconciliation(location, items = []) {
  // Find last posted count at this location
  const lastPostedCount = await Count.findOne({ location, status: 'posted' }).sort({ postedAt: -1 }).lean();
  const sinceDate = lastPostedCount ? lastPostedCount.postedAt : new Date(0);

  const previewItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product).lean();
    if (!product) continue;

    const unit = product.unit;
    const countedQtyBase = toBaseUnit(item.countedQty, unit);

    // Get current system stock at location
    const moveRes = await Movement.aggregate([
      { $match: { product: product._id } },
      {
        $group: {
          _id: null,
          added: {
            $sum: {
              $cond: [{ $eq: ['$toLocation', location] }, '$quantity', 0],
            },
          },
          deducted: {
            $sum: {
              $cond: [{ $eq: ['$fromLocation', location] }, '$quantity', 0],
            },
          },
        },
      },
    ]);

    const systemQtyBase = moveRes.length ? Math.max(0, moveRes[0].added - moveRes[0].deducted) : 0;
    const varianceBase = countedQtyBase - systemQtyBase;

    // Fetch movements since last count at this location
    const movementsSince = await Movement.find({
      product: product._id,
      date: { $gte: sinceDate },
      $or: [{ fromLocation: location }, { toLocation: location }],
    })
      .sort({ date: -1 })
      .lean();

    const movementHistory = movementsSince.map(m => {
      const isIncoming = m.toLocation === location;
      const change = isIncoming ? m.quantity : -m.quantity;
      return {
        date: m.date,
        type: m.type,
        quantity: m.quantity,
        quantityDisplay: formatQuantityWithUnit(m.quantity, unit),
        fromLocation: m.fromLocation,
        toLocation: m.toLocation,
        change,
        changeDisplay: `${isIncoming ? '+' : '-'}${fromBaseUnit(m.quantity, unit)} ${unit}`,
        note: m.note,
      };
    });

    let explanation = 'System quantity matches physical count exactly.';
    if (varianceBase !== 0) {
      const formattedDiff = `${varianceBase > 0 ? '+' : ''}${fromBaseUnit(varianceBase, unit)} ${unit}`;
      explanation = `Discrepancy of ${formattedDiff}. Ledger records show ${movementHistory.length} movements since last audit (${lastPostedCount ? new Date(lastPostedCount.postedAt).toLocaleDateString() : 'initial setup'}). Unaccounted difference may indicate damage, spillage, theft, or untracked shrinkage.`;
    }

    previewItems.push({
      product: {
        _id: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        imageEmoji: product.imageEmoji,
      },
      systemQty: systemQtyBase,
      systemQtyDisplay: fromBaseUnit(systemQtyBase, unit),
      countedQty: countedQtyBase,
      countedQtyDisplay: fromBaseUnit(countedQtyBase, unit),
      variance: varianceBase,
      varianceDisplay: fromBaseUnit(varianceBase, unit),
      explanation,
      sinceLastCount: movementHistory,
    });
  }

  return {
    location,
    lastAuditDate: lastPostedCount ? lastPostedCount.postedAt : null,
    items: previewItems,
  };
}

/**
 * Creates and posts a physical stock count reconciliation.
 * Idempotent: once posted, it cannot be reposted.
 */
export async function postReconciliationCount({ location, note = '', items = [] }) {
  if (!items || items.length === 0) {
    throw new AppError('Reconciliation must contain at least one item', 400);
  }

  const preview = await previewReconciliation(location, items);
  const adjustmentMovements = [];
  const countItems = [];
  const affectedProductIds = new Set();

  for (const item of preview.items) {
    const pId = item.product._id;
    affectedProductIds.add(pId.toString());

    countItems.push({
      product: pId,
      systemQty: item.systemQty,
      countedQty: item.countedQty,
      variance: item.variance,
      sinceLastCount: item.sinceLastCount,
    });

    if (item.variance !== 0) {
      // Find latest lot to attach adjustment
      const lot = await StockLot.findOne({ product: pId, location }).sort({ stockedDate: -1, _id: -1 });

      const isSurplus = item.variance > 0;
      const absQty = Math.abs(item.variance);

      adjustmentMovements.push({
        type: 'adjustment',
        product: pId,
        lot: lot ? lot._id : null,
        quantity: absQty,
        fromLocation: isSurplus ? 'Adjustment' : location,
        toLocation: isSurplus ? location : 'Adjustment',
        unitCost: lot ? lot.buyingPricePerUnit : 0,
        unitPrice: lot ? lot.sellingPricePerUnit : 0,
        date: new Date(),
        note: `Reconciliation Audit Adjustment: ${isSurplus ? 'Surplus (+)' : 'Shortfall (-)'}. Reason: ${note || 'Physical count variance audit'}`,
      });
    }
  }

  const count = await Count.create({
    location,
    note,
    status: 'posted',
    items: countItems,
    postedAt: new Date(),
  });

  if (adjustmentMovements.length > 0) {
    await Movement.insertMany(adjustmentMovements);
  }

  // Broadcast real-time events
  broadcast('count:posted', { countId: count._id, location });
  for (const pId of affectedProductIds) {
    broadcast('stock:updated', { productId: pId });
  }
  for (const m of adjustmentMovements) {
    broadcast('movement:created', { movement: m });
  }

  return count;
}

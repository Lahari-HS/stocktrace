import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockLot } from '../models/StockLot.js';
import { Movement } from '../models/Movement.js';
import { Bill } from '../models/Bill.js';
import { UNIT_CONFIG, fromBaseUnit } from '../utils/units.js';

/**
 * Calculates remaining stock for a single lot based on movements
 * @param {string|mongoose.Types.ObjectId} lotId 
 * @param {string} [location] Optional 'Shop' or 'Storeroom' filter
 * @returns {Promise<number>} Remaining quantity in base units
 */
export async function getLotRemaining(lotId, location = null) {
  const match = { lot: new mongoose.Types.ObjectId(lotId) };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: null,
        added: {
          $sum: {
            $cond: [
              location ? { $eq: ['$toLocation', location] } : { $in: ['$toLocation', ['Shop', 'Storeroom']] },
              '$quantity',
              0,
            ],
          },
        },
        deducted: {
          $sum: {
            $cond: [
              location ? { $eq: ['$fromLocation', location] } : { $in: ['$fromLocation', ['Shop', 'Storeroom']] },
              '$quantity',
              0,
            ],
          },
        },
      },
    },
  ];

  const res = await Movement.aggregate(pipeline);
  if (!res.length) return 0;
  return Math.max(0, res[0].added - res[0].deducted);
}

/**
 * Aggregates all lots for a product with remaining quantity, revenue, and profit per lot
 * @param {string|mongoose.Types.ObjectId} productId 
 * @param {string} [location]
 */
export async function getLotsForProduct(productId, location = null) {
  const pId = new mongoose.Types.ObjectId(productId);
  const lotQuery = { product: pId };
  if (location) lotQuery.location = location;

  const lots = await StockLot.find(lotQuery).sort({ stockedDate: 1, _id: 1 }).lean();
  if (!lots.length) return [];

  const lotIds = lots.map(l => l._id);

  // 1. Calculate remaining quantity per lot from movements
  const movementAgg = await Movement.aggregate([
    { $match: { lot: { $in: lotIds } } },
    {
      $group: {
        _id: '$lot',
        added: {
          $sum: {
            $cond: [
              location ? { $eq: ['$toLocation', location] } : { $in: ['$toLocation', ['Shop', 'Storeroom']] },
              '$quantity',
              0,
            ],
          },
        },
        deducted: {
          $sum: {
            $cond: [
              location ? { $eq: ['$fromLocation', location] } : { $in: ['$fromLocation', ['Shop', 'Storeroom']] },
              '$quantity',
              0,
            ],
          },
        },
      },
    },
  ]);

  const remMap = new Map();
  movementAgg.forEach(m => {
    remMap.set(m._id.toString(), Math.max(0, m.added - m.deducted));
  });

  // 2. Calculate revenue and COGS per lot from bills allocations
  const billAgg = await Bill.aggregate([
    { $unwind: '$lines' },
    { $unwind: '$lines.allocations' },
    { $match: { 'lines.allocations.lot': { $in: lotIds } } },
    {
      $project: {
        lot: '$lines.allocations.lot',
        soldQty: {
          $max: [0, { $subtract: ['$lines.allocations.quantity', { $ifNull: ['$lines.allocations.returnedQty', 0] }] }],
        },
        unitPrice: '$lines.unitPrice',
        unitCost: '$lines.allocations.unitCost',
      },
    },
    {
      $group: {
        _id: '$lot',
        totalRevenue: { $sum: { $multiply: ['$soldQty', '$unitPrice'] } },
        totalCost: { $sum: { $multiply: ['$soldQty', '$unitCost'] } },
      },
    },
  ]);

  const financialMap = new Map();
  billAgg.forEach(b => {
    financialMap.set(b._id.toString(), {
      revenuePaise: b.totalRevenue,
      costPaise: b.totalCost,
      profitPaise: b.totalRevenue - b.totalCost,
    });
  });

  const product = await Product.findById(pId).lean();
  const unit = product?.unit || 'pcs';
  const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;

  return lots.map(lot => {
    const idStr = lot._id.toString();
    const remainingBase = remMap.has(idStr) ? remMap.get(idStr) : 0;
    const fin = financialMap.get(idStr) || { revenuePaise: 0, costPaise: 0, profitPaise: 0 };

    // Since unitPrice and unitCost are paise per display unit,
    // revenuePaise = (soldQty / multiplier) * unitPrice = soldQty * unitPrice / multiplier
    const revenue = Math.round(fin.revenuePaise / multiplier);
    const cost = Math.round(fin.costPaise / multiplier);
    const profit = revenue - cost;

    return {
      ...lot,
      remaining: remainingBase,
      remainingDisplay: fromBaseUnit(remainingBase, unit),
      quantityReceivedDisplay: fromBaseUnit(lot.quantityReceived, unit),
      revenue,
      cost,
      profit,
    };
  });
}

/**
 * Get comprehensive paginated product table with live derived values
 */
export async function getProductsPaginated({
  page = 1,
  limit = 20,
  search = '',
  category = '',
  sortField = 'name',
  sortOrder = 'asc',
  stockStatus = '',
  location = null,
}) {
  const filter = {};

  if (category && category !== 'All') {
    filter.category = category;
  }

  if (search && search.trim() !== '') {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { sku: { $regex: s, $options: 'i' } },
      { category: { $regex: s, $options: 'i' } },
    ];
  }

  const totalProducts = await Product.countDocuments(filter);

  // Fetch products
  const products = await Product.find(filter)
    .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  if (!products.length) {
    return {
      products: [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalProducts,
        totalPages: Math.ceil(totalProducts / limit) || 1,
      },
    };
  }

  const pIds = products.map(p => p._id);

  // Aggregate lot summaries (latest lot date, latest price, total received)
  const lots = await StockLot.find({ product: { $in: pIds } })
    .sort({ stockedDate: -1, _id: -1 })
    .lean();

  // Aggregate movements for remaining stock
  const movementAgg = await Movement.aggregate([
    { $match: { product: { $in: pIds } } },
    {
      $group: {
        _id: '$product',
        added: {
          $sum: {
            $cond: [
              location ? { $eq: ['$toLocation', location] } : { $in: ['$toLocation', ['Shop', 'Storeroom']] },
              '$quantity',
              0,
            ],
          },
        },
        deducted: {
          $sum: {
            $cond: [
              location ? { $eq: ['$fromLocation', location] } : { $in: ['$fromLocation', ['Shop', 'Storeroom']] },
              '$quantity',
              0,
            ],
          },
        },
      },
    },
  ]);

  const remMap = new Map();
  movementAgg.forEach(m => {
    remMap.set(m._id.toString(), Math.max(0, m.added - m.deducted));
  });

  // Aggregate bills for revenue & profit
  const billAgg = await Bill.aggregate([
    { $unwind: '$lines' },
    { $match: { 'lines.product': { $in: pIds } } },
    {
      $project: {
        product: '$lines.product',
        soldQty: {
          $max: [0, { $subtract: ['$lines.quantity', { $ifNull: ['$lines.returnedQty', 0] }] }],
        },
        unitPrice: '$lines.unitPrice',
        allocations: '$lines.allocations',
      },
    },
    { $unwind: { path: '$allocations', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$product',
        totalRevenue: {
          $sum: {
            $multiply: [
              { $max: [0, { $subtract: ['$allocations.quantity', { $ifNull: ['$allocations.returnedQty', 0] }] }] },
              '$unitPrice',
            ],
          },
        },
        totalCost: {
          $sum: {
            $multiply: [
              { $max: [0, { $subtract: ['$allocations.quantity', { $ifNull: ['$allocations.returnedQty', 0] }] }] },
              '$allocations.unitCost',
            ],
          },
        },
      },
    },
  ]);

  const billMap = new Map();
  billAgg.forEach(b => {
    billMap.set(b._id.toString(), {
      revenuePaise: b.totalRevenue,
      costPaise: b.totalCost,
    });
  });

  // Combine product rows
  let enriched = products.map(p => {
    const pIdStr = p._id.toString();
    const productLots = lots.filter(l => l.product.toString() === pIdStr);
    const unit = p.unit;
    const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;

    const latestLot = productLots[0] || null;
    const totalQuantityStocked = productLots.reduce((acc, l) => acc + (l.quantityReceived || 0), 0);
    const remaining = remMap.has(pIdStr) ? remMap.get(pIdStr) : 0;

    const billFin = billMap.get(pIdStr) || { revenuePaise: 0, costPaise: 0 };
    const revenue = Math.round(billFin.revenuePaise / multiplier);
    const cost = Math.round(billFin.costPaise / multiplier);
    const profit = revenue - cost;

    const buyingPrice = latestLot ? latestLot.buyingPricePerUnit : 0;
    const sellingPrice = latestLot ? latestLot.sellingPricePerUnit : 0;
    const latestStockedDate = latestLot ? latestLot.stockedDate : null;

    let status = 'in_stock';
    if (remaining === 0) {
      status = 'out_of_stock';
    } else if (remaining <= p.lowStockThreshold) {
      status = 'low_stock';
    }

    return {
      ...p,
      latestStockedDate,
      quantityStocked: totalQuantityStocked,
      quantityStockedDisplay: fromBaseUnit(totalQuantityStocked, unit),
      remaining,
      remainingDisplay: fromBaseUnit(remaining, unit),
      buyingPrice,
      sellingPrice,
      revenue,
      cost,
      profit,
      status,
      lotCount: productLots.length,
    };
  });

  // Optional stock status filter
  if (stockStatus) {
    if (stockStatus === 'low') {
      enriched = enriched.filter(p => p.status === 'low_stock');
    } else if (stockStatus === 'out') {
      enriched = enriched.filter(p => p.status === 'out_of_stock');
    } else if (stockStatus === 'in') {
      enriched = enriched.filter(p => p.status === 'in_stock');
    }
  }

  return {
    products: enriched,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalProducts,
      totalPages: Math.ceil(totalProducts / limit) || 1,
    },
  };
}

/**
 * Computes historical stock remaining curve over time for a product
 */
export async function getStockOverTime(productId) {
  const pId = new mongoose.Types.ObjectId(productId);
  const product = await Product.findById(pId).lean();
  if (!product) return [];

  const movements = await Movement.find({ product: pId })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  let runningStock = 0;
  const history = [];

  for (const m of movements) {
    let delta = 0;
    const isTo = ['Shop', 'Storeroom'].includes(m.toLocation);
    const isFrom = ['Shop', 'Storeroom'].includes(m.fromLocation);

    if (isTo && !isFrom) {
      delta = m.quantity;
    } else if (!isTo && isFrom) {
      delta = -m.quantity;
    }

    runningStock = Math.max(0, runningStock + delta);
    history.push({
      date: m.date,
      type: m.type,
      change: delta,
      stockRemaining: runningStock,
      stockDisplay: fromBaseUnit(runningStock, product.unit),
    });
  }

  return history;
}

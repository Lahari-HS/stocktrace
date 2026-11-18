import { Movement } from '../models/Movement.js';
import { Product } from '../models/Product.js';
import { StockLot } from '../models/StockLot.js';
import { transferSchema, adjustmentSchema } from '../validators/schemas.js';
import { AppError } from '../middleware/errorHandler.js';
import { toBaseUnit, formatQuantityWithUnit } from '../utils/units.js';
import { broadcast } from '../socket.js';

export async function getMovements(req, res, next) {
  try {
    const {
      page = 1,
      limit = 30,
      type = '',
      product = '',
      location = '',
      startDate = '',
      endDate = '',
    } = req.query;

    const filter = {};

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (product) {
      filter.product = product;
    }

    if (location && location !== 'all') {
      filter.$or = [{ fromLocation: location }, { toLocation: location }];
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const total = await Movement.countDocuments(filter);
    const movements = await Movement.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('product', 'name sku unit imageEmoji')
      .populate('lot', 'supplier stockedDate')
      .populate('bill', 'billNumber customerName')
      .lean();

    res.json({
      movements,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createTransfer(req, res, next) {
  try {
    const validated = transferSchema.parse(req.body);
    const product = await Product.findById(validated.product);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const unit = product.unit;
    const qtyBase = toBaseUnit(validated.quantity, unit);

    // Check available stock at fromLocation
    const moveRes = await Movement.aggregate([
      { $match: { product: product._id } },
      {
        $group: {
          _id: null,
          added: {
            $sum: { $cond: [{ $eq: ['$toLocation', validated.fromLocation] }, '$quantity', 0] },
          },
          deducted: {
            $sum: { $cond: [{ $eq: ['$fromLocation', validated.fromLocation] }, '$quantity', 0] },
          },
        },
      },
    ]);

    const available = moveRes.length ? Math.max(0, moveRes[0].added - moveRes[0].deducted) : 0;
    if (available < qtyBase) {
      throw new AppError(
        `Insufficient stock in ${validated.fromLocation}. Available: ${formatQuantityWithUnit(available, unit)}, requested: ${formatQuantityWithUnit(qtyBase, unit)}`,
        409
      );
    }

    // Find active lot at fromLocation if possible
    const lot = await StockLot.findOne({ product: product._id, location: validated.fromLocation }).sort({ stockedDate: -1 });

    const movement = await Movement.create({
      type: 'transfer',
      product: product._id,
      lot: lot ? lot._id : null,
      quantity: qtyBase,
      fromLocation: validated.fromLocation,
      toLocation: validated.toLocation,
      unitCost: lot ? lot.buyingPricePerUnit : 0,
      unitPrice: lot ? lot.sellingPricePerUnit : 0,
      date: new Date(),
      note: validated.note || `Transferred from ${validated.fromLocation} to ${validated.toLocation}`,
    });

    broadcast('movement:created', { movement });
    broadcast('stock:updated', { productId: product._id });

    res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
}

export async function createAdjustment(req, res, next) {
  try {
    const validated = adjustmentSchema.parse(req.body);
    const product = await Product.findById(validated.product);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const unit = product.unit;
    const isSurplus = validated.quantity > 0;
    const absQtyBase = toBaseUnit(Math.abs(validated.quantity), unit);

    if (absQtyBase <= 0) {
      throw new AppError('Adjustment quantity must be non-zero', 400);
    }

    // If deduction, verify we have enough stock
    if (!isSurplus) {
      const moveRes = await Movement.aggregate([
        { $match: { product: product._id } },
        {
          $group: {
            _id: null,
            added: {
              $sum: { $cond: [{ $eq: ['$toLocation', validated.location] }, '$quantity', 0] },
            },
            deducted: {
              $sum: { $cond: [{ $eq: ['$fromLocation', validated.location] }, '$quantity', 0] },
            },
          },
        },
      ]);
      const available = moveRes.length ? Math.max(0, moveRes[0].added - moveRes[0].deducted) : 0;
      if (available < absQtyBase) {
        throw new AppError(
          `Cannot deduct ${formatQuantityWithUnit(absQtyBase, unit)}. Only ${formatQuantityWithUnit(available, unit)} available in ${validated.location}`,
          409
        );
      }
    }

    const lot = await StockLot.findOne({ product: product._id, location: validated.location }).sort({ stockedDate: -1 });

    const movement = await Movement.create({
      type: 'adjustment',
      product: product._id,
      lot: lot ? lot._id : null,
      quantity: absQtyBase,
      fromLocation: isSurplus ? 'Adjustment' : validated.location,
      toLocation: isSurplus ? validated.location : 'Adjustment',
      unitCost: lot ? lot.buyingPricePerUnit : 0,
      unitPrice: lot ? lot.sellingPricePerUnit : 0,
      date: new Date(),
      note: `Adjustment: ${validated.reason} (${isSurplus ? '+' : '-'}${formatQuantityWithUnit(absQtyBase, unit)})`,
    });

    broadcast('movement:created', { movement });
    broadcast('stock:updated', { productId: product._id });

    res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
}

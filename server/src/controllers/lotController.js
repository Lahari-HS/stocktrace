import { StockLot } from '../models/StockLot.js';
import { Product } from '../models/Product.js';
import { Movement } from '../models/Movement.js';
import { restockSchema, editLotDateSchema } from '../validators/schemas.js';
import { AppError } from '../middleware/errorHandler.js';
import { toBaseUnit, toPaise } from '../utils/units.js';
import { broadcast } from '../socket.js';

export async function createRestockLot(req, res, next) {
  try {
    const validated = restockSchema.parse(req.body);

    const product = await Product.findById(validated.product);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const unit = product.unit;
    const baseQuantity = toBaseUnit(validated.quantityReceived, unit);
    const buyingPricePaise = toPaise(validated.buyingPricePerUnit);
    const sellingPricePaise = toPaise(validated.sellingPricePerUnit);

    const lot = await StockLot.create({
      product: product._id,
      stockedDate: validated.stockedDate || new Date(),
      supplier: validated.supplier || 'General Wholesale',
      quantityReceived: baseQuantity,
      buyingPricePerUnit: buyingPricePaise,
      sellingPricePerUnit: sellingPricePaise,
      location: validated.location || 'Shop',
      note: validated.note || '',
      dateEditHistory: [],
    });

    // Create immutable receipt movement
    const movement = await Movement.create({
      type: 'receipt',
      product: product._id,
      lot: lot._id,
      quantity: baseQuantity,
      fromLocation: 'Supplier',
      toLocation: validated.location || 'Shop',
      unitCost: buyingPricePaise,
      unitPrice: sellingPricePaise,
      date: validated.stockedDate || new Date(),
      note: validated.note || `Initial Restock from ${validated.supplier}`,
    });

    // Real-time notification
    broadcast('stock:updated', { productId: product._id, lotId: lot._id });
    broadcast('lot:updated', { lot });
    broadcast('movement:created', { movement });

    res.status(201).json({ lot, movement });
  } catch (err) {
    next(err);
  }
}

export async function updateLotDate(req, res, next) {
  try {
    const { id } = req.params;
    const validated = editLotDateSchema.parse(req.body);

    const lot = await StockLot.findById(id);
    if (!lot) {
      throw new AppError('Stock lot not found', 404);
    }

    const oldDate = lot.stockedDate;
    const newDate = new Date(validated.newDate);

    lot.dateEditHistory.push({
      oldDate,
      newDate,
      editedAt: new Date(),
      reason: validated.reason,
    });

    lot.stockedDate = newDate;
    await lot.save();

    // Broadcast lot update
    broadcast('lot:updated', { lot });
    broadcast('stock:updated', { productId: lot.product });

    res.json(lot);
  } catch (err) {
    next(err);
  }
}

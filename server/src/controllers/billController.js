import { Bill } from '../models/Bill.js';
import { createBillSchema, returnBillSchema } from '../validators/schemas.js';
import { processBillCreation, processBillReturn } from '../services/billingService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function createBill(req, res, next) {
  try {
    const validated = createBillSchema.parse(req.body);
    const bill = await processBillCreation(validated);
    res.status(201).json(bill);
  } catch (err) {
    next(err);
  }
}

export async function getBills(req, res, next) {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const filter = {};

    if (search && search.trim() !== '') {
      filter.$or = [
        { billNumber: { $regex: search.trim(), $options: 'i' } },
        { customerName: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const total = await Bill.countDocuments(filter);
    const bills = await Bill.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('lines.product', 'name sku unit imageEmoji')
      .lean();

    res.json({
      bills,
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

export async function getBillById(req, res, next) {
  try {
    const { id } = req.params;
    const bill = await Bill.findById(id)
      .populate('lines.product')
      .populate('lines.allocations.lot')
      .lean();

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    res.json(bill);
  } catch (err) {
    next(err);
  }
}

export async function returnBillItem(req, res, next) {
  try {
    const { id } = req.params;
    const validated = returnBillSchema.parse(req.body);

    const updatedBill = await processBillReturn(
      id,
      validated.lineIndex,
      validated.quantity,
      validated.reason
    );

    res.json(updatedBill);
  } catch (err) {
    next(err);
  }
}

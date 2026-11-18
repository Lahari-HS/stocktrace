import { Count } from '../models/Count.js';
import { countSaveSchema } from '../validators/schemas.js';
import {
  getSystemStockAtLocation,
  previewReconciliation,
  postReconciliationCount,
} from '../services/reconciliationService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getSystemStock(req, res, next) {
  try {
    const { location = 'Shop' } = req.query;
    const items = await getSystemStockAtLocation(location);
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function previewCount(req, res, next) {
  try {
    const { location = 'Shop', items = [] } = req.body;
    const preview = await previewReconciliation(location, items);
    res.json(preview);
  } catch (err) {
    next(err);
  }
}

export async function postCount(req, res, next) {
  try {
    const validated = countSaveSchema.parse(req.body);
    const count = await postReconciliationCount(validated);
    res.status(201).json(count);
  } catch (err) {
    next(err);
  }
}

export async function getCounts(req, res, next) {
  try {
    const { location = '' } = req.query;
    const filter = {};
    if (location && location !== 'all') {
      filter.location = location;
    }

    const counts = await Count.find(filter)
      .sort({ createdAt: -1 })
      .populate('items.product', 'name sku unit imageEmoji')
      .lean();

    res.json(counts);
  } catch (err) {
    next(err);
  }
}

export async function getCountById(req, res, next) {
  try {
    const { id } = req.params;
    const count = await Count.findById(id)
      .populate('items.product', 'name sku unit imageEmoji')
      .lean();

    if (!count) {
      throw new AppError('Reconciliation count not found', 404);
    }

    res.json(count);
  } catch (err) {
    next(err);
  }
}

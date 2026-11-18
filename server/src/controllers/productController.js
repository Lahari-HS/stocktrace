import { Product } from '../models/Product.js';
import { Movement } from '../models/Movement.js';
import { productSchema } from '../validators/schemas.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getProductsPaginated,
  getLotsForProduct,
  getStockOverTime,
} from '../services/stockService.js';
import { broadcast } from '../socket.js';
import { UNIT_CONFIG, toBaseUnit } from '../utils/units.js';

export async function getProducts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      sortField = 'name',
      sortOrder = 'asc',
      stockStatus = '',
      location = null,
    } = req.query;

    const data = await getProductsPaginated({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      category,
      sortField,
      sortOrder,
      stockStatus,
      location,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).lean();
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const [lots, movements, stockChart] = await Promise.all([
      getLotsForProduct(id),
      Movement.find({ product: id }).sort({ date: -1, _id: -1 }).limit(100).lean(),
      getStockOverTime(id),
    ]);

    const totalStocked = lots.reduce((acc, l) => acc + (l.quantityReceived || 0), 0);
    const totalRemaining = lots.reduce((acc, l) => acc + (l.remaining || 0), 0);
    const totalRevenue = lots.reduce((acc, l) => acc + (l.revenue || 0), 0);
    const totalCost = lots.reduce((acc, l) => acc + (l.cost || 0), 0);
    const totalProfit = totalRevenue - totalCost;

    res.json({
      product: {
        ...product,
        totalStocked,
        totalRemaining,
        totalRevenue,
        totalCost,
        totalProfit,
      },
      lots,
      movements,
      stockChart,
    });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const validated = productSchema.parse(req.body);
    const existingSku = await Product.findOne({ sku: validated.sku.toUpperCase() });
    if (existingSku) {
      throw new AppError(`Product with SKU '${validated.sku}' already exists`, 409);
    }

    const unit = validated.unit;
    const thresholdBase = toBaseUnit(validated.lowStockThreshold, unit);

    const product = await Product.create({
      ...validated,
      sku: validated.sku.toUpperCase(),
      lowStockThreshold: thresholdBase,
    });

    broadcast('stock:updated', { productId: product._id });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function getCategories(req, res, next) {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.sort());
  } catch (err) {
    next(err);
  }
}

import mongoose from 'mongoose';
import { Bill } from '../models/Bill.js';
import { StockLot } from '../models/StockLot.js';
import { Product } from '../models/Product.js';
import { Movement } from '../models/Movement.js';
import { UNIT_CONFIG, fromBaseUnit, fromPaise } from '../utils/units.js';

export async function getDashboardSummary(req, res, next) {
  try {
    const { range = '7' } = req.query; // '7' or '30' days
    const days = parseInt(range, 10) || 7;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Today's metrics
    const todayBills = await Bill.find({ createdAt: { $gte: startOfToday } }).lean();
    const todayRevenue = todayBills.reduce((acc, b) => acc + (b.total || 0), 0);
    const todayCost = todayBills.reduce((acc, b) => acc + (b.totalCost || 0), 0);
    const todayProfit = todayBills.reduce((acc, b) => acc + (b.profit || 0), 0);
    const todayBillsCount = todayBills.length;

    // 2. Total inventory stock value at cost
    // Calculated as: sum(lot.remaining * lot.buyingPricePerUnit / multiplier)
    const lots = await StockLot.find().populate('product', 'unit').lean();
    const lotIds = lots.map(l => l._id);

    const movementAgg = await Movement.aggregate([
      { $match: { lot: { $in: lotIds } } },
      {
        $group: {
          _id: '$lot',
          added: {
            $sum: { $cond: [{ $in: ['$toLocation', ['Shop', 'Storeroom']] }, '$quantity', 0] },
          },
          deducted: {
            $sum: { $cond: [{ $in: ['$fromLocation', ['Shop', 'Storeroom']] }, '$quantity', 0] },
          },
        },
      },
    ]);

    const remMap = new Map();
    movementAgg.forEach(m => {
      remMap.set(m._id.toString(), Math.max(0, m.added - m.deducted));
    });

    let totalStockValueAtCost = 0;
    for (const lot of lots) {
      const remainingBase = remMap.get(lot._id.toString()) || 0;
      const unit = lot.product?.unit || 'pcs';
      const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;
      const lotValue = Math.round((remainingBase * (lot.buyingPricePerUnit || 0)) / multiplier);
      totalStockValueAtCost += lotValue;
    }

    // 3. Low stock alerts
    const products = await Product.find().lean();
    const pIds = products.map(p => p._id);

    const pMovementAgg = await Movement.aggregate([
      { $match: { product: { $in: pIds } } },
      {
        $group: {
          _id: '$product',
          added: {
            $sum: { $cond: [{ $in: ['$toLocation', ['Shop', 'Storeroom']] }, '$quantity', 0] },
          },
          deducted: {
            $sum: { $cond: [{ $in: ['$fromLocation', ['Shop', 'Storeroom']] }, '$quantity', 0] },
          },
        },
      },
    ]);

    const pRemMap = new Map();
    pMovementAgg.forEach(m => {
      pRemMap.set(m._id.toString(), Math.max(0, m.added - m.deducted));
    });

    const lowStockAlerts = [];
    for (const p of products) {
      const remaining = pRemMap.get(p._id.toString()) || 0;
      if (remaining <= p.lowStockThreshold) {
        lowStockAlerts.push({
          _id: p._id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          remaining,
          remainingDisplay: fromBaseUnit(remaining, p.unit),
          threshold: p.lowStockThreshold,
          thresholdDisplay: fromBaseUnit(p.lowStockThreshold, p.unit),
          isZero: remaining === 0,
          imageEmoji: p.imageEmoji,
        });
      }
    }

    // 4. Revenue vs Profit chart (last N days)
    const chartStartDate = new Date();
    chartStartDate.setDate(chartStartDate.getDate() - days);
    chartStartDate.setHours(0, 0, 0, 0);

    const billsInRange = await Bill.find({ createdAt: { $gte: chartStartDate } })
      .sort({ createdAt: 1 })
      .lean();

    const chartMap = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(chartStartDate);
      d.setDate(d.getDate() + i + 1);
      const key = d.toISOString().split('T')[0];
      chartMap.set(key, { date: key, revenue: 0, profit: 0, bills: 0 });
    }

    for (const b of billsInRange) {
      const key = new Date(b.createdAt).toISOString().split('T')[0];
      if (chartMap.has(key)) {
        const item = chartMap.get(key);
        item.revenue += fromPaise(b.total);
        item.profit += fromPaise(b.profit);
        item.bills += 1;
      }
    }

    const chartData = Array.from(chartMap.values());

    // 5. Top sellers
    const topSellerAgg = await Bill.aggregate([
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.product',
          totalQuantity: { $sum: '$lines.quantity' },
          totalRevenue: {
            $sum: { $multiply: ['$lines.quantity', '$lines.unitPrice'] },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
    ]);

    const topSellers = topSellerAgg.map(ts => {
      const unit = ts.product.unit;
      const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;
      return {
        _id: ts.product._id,
        name: ts.product.name,
        sku: ts.product.sku,
        category: ts.product.category,
        imageEmoji: ts.product.imageEmoji,
        soldQuantityDisplay: fromBaseUnit(ts.totalQuantity, unit),
        unit,
        revenue: Math.round(ts.totalRevenue / multiplier),
      };
    });

    // 6. Live movement activity feed (latest 10)
    const recentMovements = await Movement.find()
      .sort({ date: -1, createdAt: -1 })
      .limit(10)
      .populate('product', 'name sku unit imageEmoji')
      .lean();

    res.json({
      todayRevenue,
      todayCost,
      todayProfit,
      todayBillsCount,
      totalStockValueAtCost,
      lowStockAlerts: lowStockAlerts.slice(0, 10),
      topSellers,
      chartData,
      recentMovements,
    });
  } catch (err) {
    next(err);
  }
}

export async function getReports(req, res, next) {
  try {
    const { groupBy = 'product', startDate = '', endDate = '' } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    if (groupBy === 'category') {
      const agg = await Bill.aggregate([
        { $match: match },
        { $unwind: '$lines' },
        {
          $lookup: {
            from: 'products',
            localField: 'lines.product',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        { $unwind: { path: '$lines.allocations', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$product.category',
            revenue: {
              $sum: {
                $multiply: [
                  { $subtract: ['$lines.allocations.quantity', { $ifNull: ['$lines.allocations.returnedQty', 0] }] },
                  '$lines.unitPrice',
                ],
              },
            },
            cost: {
              $sum: {
                $multiply: [
                  { $subtract: ['$lines.allocations.quantity', { $ifNull: ['$lines.allocations.returnedQty', 0] }] },
                  '$lines.allocations.unitCost',
                ],
              },
            },
            unitsSold: {
              $sum: { $subtract: ['$lines.allocations.quantity', { $ifNull: ['$lines.allocations.returnedQty', 0] }] },
            },
          },
        },
      ]);

      const rows = agg.map(a => {
        // Assume default multiplier 1 for category aggregated unit or normalized
        const rev = a.revenue;
        const cst = a.cost;
        const profit = rev - cst;
        const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : 0;
        return {
          group: a._id,
          revenue: rev,
          cost: cst,
          profit,
          margin: Number(margin),
        };
      });

      return res.json(rows);
    }

    // Default: Group by product
    const agg = await Bill.aggregate([
      { $match: match },
      { $unwind: '$lines' },
      { $unwind: { path: '$lines.allocations', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$lines.product',
          revenue: {
            $sum: {
              $multiply: [
                { $subtract: ['$lines.allocations.quantity', { $ifNull: ['$lines.allocations.returnedQty', 0] }] },
                '$lines.unitPrice',
              ],
            },
          },
          cost: {
            $sum: {
              $multiply: [
                { $subtract: ['$lines.allocations.quantity', { $ifNull: ['$lines.allocations.returnedQty', 0] }] },
                '$lines.allocations.unitCost',
              ],
            },
          },
          soldBaseQty: {
            $sum: { $subtract: ['$lines.allocations.quantity', { $ifNull: ['$lines.allocations.returnedQty', 0] }] },
          },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
    ]);

    const rows = agg.map(a => {
      const unit = a.product.unit;
      const mult = UNIT_CONFIG[unit]?.multiplier || 1;
      const rev = Math.round(a.revenue / mult);
      const cst = Math.round(a.cost / mult);
      const profit = rev - cst;
      const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : 0;
      return {
        _id: a.product._id,
        group: a.product.name,
        sku: a.product.sku,
        category: a.product.category,
        unit: a.product.unit,
        soldQuantityDisplay: fromBaseUnit(a.soldBaseQty, unit),
        revenue: rev,
        cost: cst,
        profit,
        margin: Number(margin),
      };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function exportReportsCSV(req, res, next) {
  try {
    const { groupBy = 'product', startDate = '', endDate = '' } = req.query;

    const fakeReq = { query: { groupBy, startDate, endDate } };
    let reportData = [];
    await getReports(fakeReq, {
      json: (data) => {
        reportData = data;
      },
    }, next);

    let csv = '';
    if (groupBy === 'category') {
      csv = 'Category,Revenue (₹),Cost (₹),Profit / Loss (₹),Margin (%)\n';
      for (const row of reportData) {
        csv += `"${row.group}",${fromPaise(row.revenue).toFixed(2)},${fromPaise(row.cost).toFixed(2)},${fromPaise(row.profit).toFixed(2)},${row.margin}%\n`;
      }
    } else {
      csv = 'Product,SKU,Category,Sold Qty,Revenue (₹),Cost (₹),Profit / Loss (₹),Margin (%)\n';
      for (const row of reportData) {
        csv += `"${row.group}","${row.sku}","${row.category}","${row.soldQuantityDisplay} ${row.unit}",${fromPaise(row.revenue).toFixed(2)},${fromPaise(row.cost).toFixed(2)},${fromPaise(row.profit).toFixed(2)},${row.margin}%\n`;
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="stocktrace-report-${groupBy}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

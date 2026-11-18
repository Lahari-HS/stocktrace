import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Product } from '../src/models/Product.js';
import { StockLot } from '../src/models/StockLot.js';
import { Movement } from '../src/models/Movement.js';
import { Count } from '../src/models/Count.js';
import { previewReconciliation, postReconciliationCount } from '../src/services/reconciliationService.js';
import { updateLotDate } from '../src/controllers/lotController.js';
import { getLotsForProduct } from '../src/services/stockService.js';

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replSet.getUri());
  await Product.createCollection();
  await StockLot.createCollection();
  await Movement.createCollection();
  await Count.createCollection();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    Product.deleteMany({}),
    StockLot.deleteMany({}),
    Movement.deleteMany({}),
    Count.deleteMany({}),
  ]);
});

describe('Reconciliation & Lot Date Audit', () => {
  test('Acceptance Test 4: Edit lot 1 stocked date with reason -> quantities unchanged and edit appears in date history', async () => {
    const product = await Product.create({
      name: 'Sugar (Refined)',
      sku: 'SUGAR-01',
      category: 'Pantry',
      unit: 'kg',
    });

    const lot = await StockLot.create({
      product: product._id,
      stockedDate: new Date('2026-02-01'),
      quantityReceived: 50000,
      buyingPricePerUnit: 3500,
      sellingPricePerUnit: 4500,
      location: 'Shop',
      dateEditHistory: [],
    });

    await Movement.create({
      type: 'receipt',
      product: product._id,
      lot: lot._id,
      quantity: 50000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 3500,
      unitPrice: 4500,
      date: lot.stockedDate,
    });

    // Mock Express req, res, next for updateLotDate
    const req = {
      params: { id: lot._id.toString() },
      body: {
        newDate: '2026-02-03T00:00:00.000Z',
        reason: 'Supplier invoice correction after physical delivery',
      },
    };

    let responseData = null;
    const res = {
      json: (data) => {
        responseData = data;
      },
    };
    const next = jest.fn();

    await updateLotDate(req, res, next);
    expect(next).not.toHaveBeenCalled();

    const updatedLot = await StockLot.findById(lot._id);
    expect(new Date(updatedLot.stockedDate).toISOString()).toBe('2026-02-03T00:00:00.000Z');
    expect(updatedLot.quantityReceived).toBe(50000); // quantity unchanged
    expect(updatedLot.dateEditHistory).toHaveLength(1);
    expect(updatedLot.dateEditHistory[0].reason).toBe('Supplier invoice correction after physical delivery');
  });

  test('Acceptance Test 7: Do a physical count with deliberate shortfall -> Variance appears with movement history. Posting creates adjustment once; 2nd attempt blocked', async () => {
    const product = await Product.create({
      name: 'Toor Dal Premium',
      sku: 'DAL-01',
      category: 'Pulses',
      unit: 'kg',
    });

    const lot = await StockLot.create({
      product: product._id,
      quantityReceived: 50000, // 50 kg
      buyingPricePerUnit: 12000,
      sellingPricePerUnit: 15000,
      location: 'Shop',
    });

    const receiptMove = await Movement.create({
      type: 'receipt',
      product: product._id,
      lot: lot._id,
      quantity: 50000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 12000,
      unitPrice: 15000,
      date: new Date('2026-03-01'),
      note: 'Initial stock',
    });

    // System stock is currently 50 kg.
    // Shopkeeper conducts count and enters 48 kg (deliberate shortfall of 2 kg).
    const preview = await previewReconciliation('Shop', [
      { product: product._id.toString(), countedQty: 48 },
    ]);

    expect(preview.items).toHaveLength(1);
    const item = preview.items[0];
    expect(item.systemQtyDisplay).toBe(50);
    expect(item.countedQtyDisplay).toBe(48);
    expect(item.varianceDisplay).toBe(-2);
    expect(item.sinceLastCount).toHaveLength(1);
    expect(item.sinceLastCount[0].note).toBe('Initial stock');
    expect(item.explanation).toContain('Discrepancy of -2 kg');

    // Post variances as adjustments (First attempt: Succeeds)
    const postedCount = await postReconciliationCount({
      location: 'Shop',
      note: 'Monthly inventory audit shortfall adjustment',
      items: [{ product: product._id.toString(), countedQty: 48 }],
    });

    expect(postedCount.status).toBe('posted');

    // Verify adjustment movement was recorded
    const adjMovement = await Movement.findOne({ type: 'adjustment' });
    expect(adjMovement).not.toBeNull();
    expect(adjMovement.quantity).toBe(2000); // 2 kg
    expect(adjMovement.fromLocation).toBe('Shop');
    expect(adjMovement.toLocation).toBe('Adjustment');

    // Verify remaining stock is now 48 kg
    const lots = await getLotsForProduct(product._id);
    expect(lots[0].remainingDisplay).toBe(48);
  });
});

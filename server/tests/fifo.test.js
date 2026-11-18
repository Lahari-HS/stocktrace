import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Product } from '../src/models/Product.js';
import { StockLot } from '../src/models/StockLot.js';
import { Movement } from '../src/models/Movement.js';
import { Bill } from '../src/models/Bill.js';
import { processBillCreation, processBillReturn } from '../src/services/billingService.js';
import { getLotsForProduct } from '../src/services/stockService.js';
import { toBaseUnit, toPaise, fromBaseUnit, fromPaise } from '../src/utils/units.js';

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replSet.getUri());
  await Product.createCollection();
  await StockLot.createCollection();
  await Movement.createCollection();
  await Bill.createCollection();
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
    Bill.deleteMany({}),
  ]);
});

describe('FIFO Billing & Exact Profit Engine', () => {
  test('Acceptance Test 2: Stock 100 kg wheat at Rs 30, sell Rs 40. Bill 5 kg. Remaining = 95, revenue = Rs 200, profit = Rs 50', async () => {
    // 1. Create Product
    const wheat = await Product.create({
      name: 'Wheat Grain',
      sku: 'WHEAT-TEST',
      category: 'Grains',
      unit: 'kg',
      lowStockThreshold: 20000,
    });

    // 2. Restock Lot 1: 100 kg (100,000 g) @ Rs 30 cost (3000 paise), sell Rs 40 (4000 paise)
    const lot1 = await StockLot.create({
      product: wheat._id,
      stockedDate: new Date('2026-01-01'),
      supplier: 'Punjab Agro',
      quantityReceived: 100000,
      buyingPricePerUnit: 3000,
      sellingPricePerUnit: 4000,
      location: 'Shop',
    });

    await Movement.create({
      type: 'receipt',
      product: wheat._id,
      lot: lot1._id,
      quantity: 100000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 3000,
      unitPrice: 4000,
      date: lot1.stockedDate,
    });

    // 3. Bill 5 kg
    const bill = await processBillCreation({
      customerName: 'Aarav Sharma',
      lines: [
        {
          product: wheat._id.toString(),
          quantity: 5, // 5 kg
        },
      ],
      location: 'Shop',
    });

    // Check Bill financials
    // Revenue: 5 kg * Rs 40 = Rs 200 = 20,000 paise
    // Cost: 5 kg * Rs 30 = Rs 150 = 15,000 paise
    // Profit: 20,000 - 15,000 = 5,000 paise = Rs 50
    expect(bill.total).toBe(20000);
    expect(fromPaise(bill.total)).toBe(200);
    expect(bill.totalCost).toBe(15000);
    expect(fromPaise(bill.totalCost)).toBe(150);
    expect(bill.profit).toBe(5000);
    expect(fromPaise(bill.profit)).toBe(50);

    // Verify remaining stock is 95 kg
    const lots = await getLotsForProduct(wheat._id);
    expect(lots[0].remaining).toBe(95000); // 95 kg in grams
    expect(lots[0].remainingDisplay).toBe(95);
    expect(lots[0].revenue).toBe(20000);
    expect(lots[0].profit).toBe(5000);
  });

  test('Acceptance Test 3: Restock 50 kg wheat at Rs 32, sell Rs 42. Bill 98 kg -> Allocation splits 95 kg from Lot 1 and 3 kg from Lot 2. Profit exact from each lot. Remaining = 47 kg', async () => {
    const wheat = await Product.create({
      name: 'Wheat Grain',
      sku: 'WHEAT-MULTI',
      category: 'Grains',
      unit: 'kg',
      lowStockThreshold: 10000,
    });

    // Lot 1: 100 kg @ Rs 30 cost, Rs 40 sell
    const lot1 = await StockLot.create({
      product: wheat._id,
      stockedDate: new Date('2026-01-01'),
      supplier: 'Punjab Agro',
      quantityReceived: 100000,
      buyingPricePerUnit: 3000,
      sellingPricePerUnit: 4000,
      location: 'Shop',
    });
    await Movement.create({
      type: 'receipt',
      product: wheat._id,
      lot: lot1._id,
      quantity: 100000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 3000,
      unitPrice: 4000,
      date: lot1.stockedDate,
    });

    // First bill: 5 kg
    await processBillCreation({
      lines: [{ product: wheat._id.toString(), quantity: 5 }],
      location: 'Shop',
    });
    // Lot 1 now has 95 kg remaining

    // Restock Lot 2: 50 kg (50,000 g) @ Rs 32 cost (3200 paise), sell Rs 42 (4200 paise)
    const lot2 = await StockLot.create({
      product: wheat._id,
      stockedDate: new Date('2026-01-05'),
      supplier: 'Haryana Mandi',
      quantityReceived: 50000,
      buyingPricePerUnit: 3200,
      sellingPricePerUnit: 4200,
      location: 'Shop',
    });
    await Movement.create({
      type: 'receipt',
      product: wheat._id,
      lot: lot2._id,
      quantity: 50000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 3200,
      unitPrice: 4200,
      date: lot2.stockedDate,
    });

    // Second bill: 98 kg
    // Selling price: Lot 1 price is Rs 40/kg (4000 paise).
    // Requested 98 kg:
    // Take 95 kg from Lot 1 @ cost Rs 30 (3000 paise)
    // Take 3 kg from Lot 2 @ cost Rs 32 (3200 paise)
    const bill2 = await processBillCreation({
      customerName: 'Pooja Reddy',
      lines: [{ product: wheat._id.toString(), quantity: 98, unitPrice: 40 }], // Rs 40/kg
      location: 'Shop',
    });

    const line = bill2.lines[0];
    expect(line.allocations).toHaveLength(2);

    // Allocation 1: from lot 1, 95 kg
    const allocLot1Id = line.allocations[0].lot._id ? line.allocations[0].lot._id.toString() : line.allocations[0].lot.toString();
    expect(allocLot1Id).toBe(lot1._id.toString());
    expect(line.allocations[0].quantity).toBe(95000);
    expect(line.allocations[0].unitCost).toBe(3000);

    // Allocation 2: from lot 2, 3 kg
    const allocLot2Id = line.allocations[1].lot._id ? line.allocations[1].lot._id.toString() : line.allocations[1].lot.toString();
    expect(allocLot2Id).toBe(lot2._id.toString());
    expect(line.allocations[1].quantity).toBe(3000);
    expect(line.allocations[1].unitCost).toBe(3200);

    // Revenue: 98 kg * Rs 40 = Rs 3920 = 392,000 paise
    // Cost: (95 * 30) + (3 * 32) = 2850 + 96 = Rs 2946 = 294,600 paise
    // Profit: 392,000 - 294,600 = 97,400 paise = Rs 974.00
    expect(bill2.total).toBe(392000);
    expect(bill2.totalCost).toBe(294600);
    expect(bill2.profit).toBe(97400);

    // Total remaining in stock:
    // Lot 1: 0 kg
    // Lot 2: 50 - 3 = 47 kg
    const lots = await getLotsForProduct(wheat._id);
    const lot1Remaining = lots.find(l => l._id.toString() === lot1._id.toString()).remainingDisplay;
    const lot2Remaining = lots.find(l => l._id.toString() === lot2._id.toString()).remainingDisplay;

    expect(lot1Remaining).toBe(0);
    expect(lot2Remaining).toBe(47);
  });

  test('Acceptance Test 5: Try to bill more than remaining stock -> Expect 409 and clear message, no partial save', async () => {
    const wheat = await Product.create({
      name: 'Wheat Grain',
      sku: 'WHEAT-OVERSOLD',
      category: 'Grains',
      unit: 'kg',
    });

    const lot = await StockLot.create({
      product: wheat._id,
      quantityReceived: 10000, // 10 kg
      buyingPricePerUnit: 3000,
      sellingPricePerUnit: 4000,
      location: 'Shop',
    });
    await Movement.create({
      type: 'receipt',
      product: wheat._id,
      lot: lot._id,
      quantity: 10000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 3000,
      unitPrice: 4000,
    });

    // Try to bill 15 kg when only 10 kg available
    await expect(
      processBillCreation({
        lines: [{ product: wheat._id.toString(), quantity: 15 }],
        location: 'Shop',
      })
    ).rejects.toThrow('Only 10 kg available');

    // Verify zero bills and zero sales created
    const billCount = await Bill.countDocuments();
    const saleMovements = await Movement.countDocuments({ type: 'sale' });
    expect(billCount).toBe(0);
    expect(saleMovements).toBe(0);
  });

  test('Acceptance Test 6: Return 2 kg from a bill -> Remaining, revenue and profit adjust correctly', async () => {
    const wheat = await Product.create({
      name: 'Wheat Grain',
      sku: 'WHEAT-RETURN',
      category: 'Grains',
      unit: 'kg',
    });

    const lot = await StockLot.create({
      product: wheat._id,
      quantityReceived: 20000, // 20 kg
      buyingPricePerUnit: 3000, // Rs 30
      sellingPricePerUnit: 4000, // Rs 40
      location: 'Shop',
    });
    await Movement.create({
      type: 'receipt',
      product: wheat._id,
      lot: lot._id,
      quantity: 20000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 3000,
      unitPrice: 4000,
    });

    // Bill 10 kg: revenue Rs 400 (40000), cost Rs 300 (30000), profit Rs 100 (10000)
    const bill = await processBillCreation({
      lines: [{ product: wheat._id.toString(), quantity: 10 }],
      location: 'Shop',
    });

    expect(bill.total).toBe(40000);
    expect(bill.profit).toBe(10000);

    // Return 2 kg
    const updatedBill = await processBillReturn(bill._id, 0, 2, 'Defective packaging');

    // Revenue reversed: 2 kg * Rs 40 = Rs 80 -> bill total = Rs 320 (32000)
    // Cost reversed: 2 kg * Rs 30 = Rs 60 -> bill cost = Rs 240 (24000)
    // Profit adjusted: Rs 80 (8000)
    expect(updatedBill.total).toBe(32000);
    expect(updatedBill.totalCost).toBe(24000);
    expect(updatedBill.profit).toBe(8000);

    // Remaining stock in lot should be restored: 10 kg remaining + 2 kg returned = 12 kg
    const lots = await getLotsForProduct(wheat._id);
    expect(lots[0].remainingDisplay).toBe(12);

    // Ensure a return movement was logged
    const returnMovement = await Movement.findOne({ type: 'return' });
    expect(returnMovement).not.toBeNull();
    expect(returnMovement.quantity).toBe(2000); // 2000 g
  });
});

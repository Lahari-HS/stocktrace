import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { Product } from '../src/models/Product.js';
import { StockLot } from '../src/models/StockLot.js';
import { Movement } from '../src/models/Movement.js';
import { Bill } from '../src/models/Bill.js';
import { Count } from '../src/models/Count.js';

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
    Bill.deleteMany({}),
    Count.deleteMany({}),
  ]);
});

describe('Billing & Products REST API Endpoints', () => {
  test('POST /api/products creates product and GET /api/products returns paginated list', async () => {
    const resCreate = await request(app)
      .post('/api/products')
      .send({
        name: 'Mustard Oil Cold Pressed',
        sku: 'OIL-001',
        category: 'Edible Oils',
        unit: 'litre',
        lowStockThreshold: 10, // 10 L
        imageEmoji: '🫒',
      });

    expect(resCreate.status).toBe(201);
    expect(resCreate.body.name).toBe('Mustard Oil Cold Pressed');
    expect(resCreate.body.sku).toBe('OIL-001');

    const resList = await request(app).get('/api/products?page=1&limit=10');
    expect(resList.status).toBe(200);
    expect(resList.body.products).toHaveLength(1);
    expect(resList.body.pagination.total).toBe(1);
  });

  test('POST /api/bills returns 409 Conflict with clear message when stock is insufficient', async () => {
    const prod = await Product.create({
      name: 'Basmati Rice',
      sku: 'RICE-409',
      category: 'Grains',
      unit: 'kg',
    });

    const lot = await StockLot.create({
      product: prod._id,
      quantityReceived: 5000, // 5 kg
      buyingPricePerUnit: 5000,
      sellingPricePerUnit: 7000,
      location: 'Shop',
    });

    await Movement.create({
      type: 'receipt',
      product: prod._id,
      lot: lot._id,
      quantity: 5000,
      fromLocation: 'Supplier',
      toLocation: 'Shop',
      unitCost: 5000,
      unitPrice: 7000,
    });

    const resOver = await request(app)
      .post('/api/bills')
      .send({
        customerName: 'Rohit',
        lines: [
          {
            product: prod._id.toString(),
            quantity: 12, // 12 kg requested, only 5 kg in stock
          },
        ],
        location: 'Shop',
      });

    expect(resOver.status).toBe(409);
    expect(resOver.body.error).toContain('Only 5 kg available');
    expect(resOver.body.details).toBeDefined();
    expect(resOver.body.details.availableBase).toBe(5000);
  });

  test('GET /api/reports/dashboard returns comprehensive KPI metrics', async () => {
    const res = await request(app).get('/api/reports/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todayRevenue');
    expect(res.body).toHaveProperty('todayProfit');
    expect(res.body).toHaveProperty('totalStockValueAtCost');
    expect(res.body).toHaveProperty('lowStockAlerts');
    expect(res.body).toHaveProperty('chartData');
  });
});

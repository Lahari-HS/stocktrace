import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { Product } from '../models/Product.js';
import { StockLot } from '../models/StockLot.js';
import { Movement } from '../models/Movement.js';
import { Bill } from '../models/Bill.js';
import { Count } from '../models/Count.js';
import { toBaseUnit, toPaise } from '../utils/units.js';

dotenv.config();

const CATEGORIES = [
  'Grains & Pulses',
  'Dairy & Eggs',
  'Spices & Seasoning',
  'Edible Oils & Ghee',
  'Beverages & Tea',
  'Snacks & Biscuits',
  'Personal Care',
  'Household Essentials',
  'Dry Fruits & Nuts',
  'Organic & Specialty',
];

const EMOJIS = ['🌾', '🍚', '🥛', '🧈', '🌶️', '🧂', '🫒', '☕', '🍵', '🍪', '🧼', '🧴', '🥜', '🍯', '📦'];

const COLORS = [
  '#6366f1', '#4f46e5', '#3b82f6', '#0ea5e9', '#06b6d4',
  '#10b981', '#14b8a6', '#84cc16', '#f59e0b', '#f97316',
  '#ef4444', '#ec4899', '#8b5cf6', '#a855f7',
];

const UNITS = ['kg', 'g', 'litre', 'ml', 'pcs', 'pack'];

export async function seedDatabase(clean = false) {
  console.log('🌱 Starting StockTrace comprehensive 1,000-product seed...');

  if (clean) {
    console.log('🧹 Clearing old collections...');
    await Promise.all([
      Product.deleteMany({}),
      StockLot.deleteMany({}),
      Movement.deleteMany({}),
      Bill.deleteMany({}),
      Count.deleteMany({}),
    ]);
  }

  const productsToInsert = [];
  const lotsToInsert = [];
  const movementsToInsert = [];

  // 1. Mandatory Acceptance Test Product #1: Wheat
  const wheatProduct = new Product({
    _id: new mongoose.Types.ObjectId(),
    name: 'Wheat Grain (Sharbati)',
    sku: 'WHEAT-100',
    category: 'Grains & Pulses',
    unit: 'kg',
    lowStockThreshold: 20000, // 20 kg
    imageEmoji: '🌾',
    colour: '#f59e0b',
  });
  productsToInsert.push(wheatProduct);

  // Lot 1 for Wheat: 100 kg @ Rs 30 cost, Rs 40 selling price
  const wheatLot1 = new StockLot({
    _id: new mongoose.Types.ObjectId(),
    product: wheatProduct._id,
    stockedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    supplier: 'Punjab Agro Wholesalers',
    quantityReceived: 100000, // 100 kg
    buyingPricePerUnit: 3000, // Rs 30.00
    sellingPricePerUnit: 4000, // Rs 40.00
    location: 'Shop',
    note: 'Initial batch of premium Sharbati wheat',
    dateEditHistory: [],
  });
  lotsToInsert.push(wheatLot1);

  movementsToInsert.push(new Movement({
    type: 'receipt',
    product: wheatProduct._id,
    lot: wheatLot1._id,
    quantity: 100000,
    fromLocation: 'Supplier',
    toLocation: 'Shop',
    unitCost: 3000,
    unitPrice: 4000,
    date: wheatLot1.stockedDate,
    note: 'Initial Restock from Punjab Agro Wholesalers',
  }));

  // 2. Acceptance Test Product #2: Basmati Rice
  const riceProduct = new Product({
    _id: new mongoose.Types.ObjectId(),
    name: 'Basmati Rice (Royal Feast)',
    sku: 'RICE-001',
    category: 'Grains & Pulses',
    unit: 'kg',
    lowStockThreshold: 15000, // 15 kg
    imageEmoji: '🍚',
    colour: '#3b82f6',
  });
  productsToInsert.push(riceProduct);

  const riceLot1 = new StockLot({
    _id: new mongoose.Types.ObjectId(),
    product: riceProduct._id,
    stockedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    supplier: 'Karnal Rice Mills',
    quantityReceived: 50000, // 50 kg
    buyingPricePerUnit: 8000, // Rs 80.00
    sellingPricePerUnit: 11000, // Rs 110.00
    location: 'Shop',
    note: 'Aged basmati rice',
  });
  lotsToInsert.push(riceLot1);

  movementsToInsert.push(new Movement({
    type: 'receipt',
    product: riceProduct._id,
    lot: riceLot1._id,
    quantity: 50000,
    fromLocation: 'Supplier',
    toLocation: 'Shop',
    unitCost: 8000,
    unitPrice: 11000,
    date: riceLot1.stockedDate,
    note: 'Initial Restock from Karnal Rice Mills',
  }));

  // 3. Generate remaining products to reach 1,000 total products
  const targetCount = 1000;
  console.log(`Generating ${targetCount - 2} additional catalog products...`);

  for (let i = 3; i <= targetCount; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const unit = UNITS[i % UNITS.length];
    const emoji = EMOJIS[i % EMOJIS.length];
    const color = COLORS[i % COLORS.length];
    const sku = `PRD-${String(i).padStart(4, '0')}`;

    let baseReceived = 0;
    let buyingPrice = 0;
    let sellingPrice = 0;
    let threshold = 0;

    if (unit === 'kg') {
      baseReceived = (20 + (i % 80)) * 1000; // 20-100 kg
      threshold = 10000; // 10 kg
      buyingPrice = (30 + (i % 70)) * 100; // Rs 30 - Rs 100
      sellingPrice = buyingPrice + (10 + (i % 25)) * 100;
    } else if (unit === 'litre') {
      baseReceived = (15 + (i % 50)) * 1000; // 15-65 L
      threshold = 5000; // 5 L
      buyingPrice = (60 + (i % 80)) * 100;
      sellingPrice = buyingPrice + (15 + (i % 30)) * 100;
    } else if (unit === 'g') {
      baseReceived = (500 + (i % 2000)); // 500-2500 g
      threshold = 200;
      buyingPrice = (10 + (i % 40)) * 100;
      sellingPrice = buyingPrice + (5 + (i % 20)) * 100;
    } else if (unit === 'ml') {
      baseReceived = (500 + (i % 2000)); // 500-2500 ml
      threshold = 250;
      buyingPrice = (15 + (i % 50)) * 100;
      sellingPrice = buyingPrice + (8 + (i % 20)) * 100;
    } else {
      // pcs / pack
      baseReceived = 20 + (i % 100);
      threshold = 5;
      buyingPrice = (20 + (i % 150)) * 100;
      sellingPrice = buyingPrice + (10 + (i % 50)) * 100;
    }

    const prod = new Product({
      _id: new mongoose.Types.ObjectId(),
      name: `${category.split(' ')[0]} Item #${i}`,
      sku,
      category,
      unit,
      lowStockThreshold: threshold,
      imageEmoji: emoji,
      colour: color,
    });
    productsToInsert.push(prod);

    // Initial Lot
    const lot = new StockLot({
      _id: new mongoose.Types.ObjectId(),
      product: prod._id,
      stockedDate: new Date(Date.now() - (i % 20) * 24 * 60 * 60 * 1000),
      supplier: `National Distributors #${(i % 10) + 1}`,
      quantityReceived: baseReceived,
      buyingPricePerUnit: buyingPrice,
      sellingPricePerUnit: sellingPrice,
      location: i % 5 === 0 ? 'Storeroom' : 'Shop',
      note: `Regular stock shipment #${i}`,
    });
    lotsToInsert.push(lot);

    movementsToInsert.push(new Movement({
      type: 'receipt',
      product: prod._id,
      lot: lot._id,
      quantity: baseReceived,
      fromLocation: 'Supplier',
      toLocation: lot.location,
      unitCost: buyingPrice,
      unitPrice: sellingPrice,
      date: lot.stockedDate,
      note: `Shipment from ${lot.supplier}`,
    }));
  }

  console.log(`Inserting ${productsToInsert.length} products in bulk...`);
  await Product.insertMany(productsToInsert, { ordered: false });

  console.log(`Inserting ${lotsToInsert.length} stock lots in bulk...`);
  await StockLot.insertMany(lotsToInsert, { ordered: false });

  console.log(`Inserting ${movementsToInsert.length} ledger movements in bulk...`);
  await Movement.insertMany(movementsToInsert, { ordered: false });

  console.log('✅ Seed completed successfully with 1,000 products and initial stock lots.');
}

const isMainModule = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isMainModule) {
  connectDB()
    .then(() => seedDatabase(true))
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}

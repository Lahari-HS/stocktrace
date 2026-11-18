import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockLot } from '../models/StockLot.js';
import { Movement } from '../models/Movement.js';
import { Bill } from '../models/Bill.js';
import { AppError } from '../middleware/errorHandler.js';
import { getLotRemaining } from './stockService.js';
import { UNIT_CONFIG, toBaseUnit, fromBaseUnit, toPaise, formatQuantityWithUnit } from '../utils/units.js';
import { broadcast } from '../socket.js';

/**
 * Generate a unique daily bill number: BILL-YYYYMMDD-XXXX
 */
export async function generateBillNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `BILL-${yyyy}${mm}${dd}`;

  // Count bills today
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const countToday = await Bill.countDocuments({ createdAt: { $gte: startOfDay } });
  const seq = String(countToday + 1).padStart(4, '0');
  return `${datePrefix}-${seq}`;
}

/**
 * Helper to run an operation inside a MongoDB transaction with automatic retries for catalog changes & write conflicts
 */
async function executeTransactionWithRetry(operationFn) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      const result = await operationFn(session);
      await session.commitTransaction();
      session.endSession();
      return result;
    } catch (error) {
      if (session) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
      }

      const isRetryable =
        error.message &&
        (error.message.includes('catalog changes') ||
          error.message.includes('WriteConflict') ||
          (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')));

      if (isRetryable && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }

      throw error;
    }
  }
}

/**
 * Creates a bill with strict FIFO lot allocation and atomic stock validation
 */
export async function processBillCreation({
  customerName = 'Walk-in Customer',
  lines = [],
  discount = 0,
  paymentMode = 'cash',
  location = 'Shop',
}) {
  if (!lines || lines.length === 0) {
    throw new AppError('Bill must contain at least one line item', 400);
  }

  // Pre-check collections exist
  await Movement.createCollection().catch(() => {});
  await Bill.createCollection().catch(() => {});

  let createdBillId = null;
  const productsAffected = new Set();
  const movementsToCreate = [];

  const populatedBill = await executeTransactionWithRetry(async (session) => {
    const billLines = [];
    let billSubtotal = 0;
    let billTotalCost = 0;
    movementsToCreate.length = 0;
    productsAffected.clear();

    for (const item of lines) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        throw new AppError(`Product not found with ID ${item.product}`, 404);
      }
      productsAffected.add(product._id.toString());

      const unit = product.unit;
      const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;
      const requestedQtyBase = toBaseUnit(item.quantity, unit);

      if (requestedQtyBase <= 0) {
        throw new AppError(`Quantity for ${product.name} must be positive`, 400);
      }

      // Fetch all candidate lots for this product at the specified location, sorted oldest-first (FIFO)
      const lots = await StockLot.find({
        product: product._id,
        location: location,
      })
        .sort({ stockedDate: 1, _id: 1 })
        .session(session);

      // Check remaining quantity in each lot
      const lotRemainings = [];
      let totalAvailable = 0;

      for (const lot of lots) {
        const remaining = await getLotRemaining(lot._id, location);
        if (remaining > 0) {
          lotRemainings.push({ lot, remaining });
          totalAvailable += remaining;
        }
      }

      // Check if stock is sufficient
      if (totalAvailable < requestedQtyBase) {
        const availableDisplay = formatQuantityWithUnit(totalAvailable, unit);
        throw new AppError(`Only ${availableDisplay} available for ${product.name}`, 409, {
          product: product.name,
          sku: product.sku,
          availableBase: totalAvailable,
          requestedBase: requestedQtyBase,
        });
      }

      // Determine unit selling price in paise
      let unitPricePaise;
      if (item.unitPrice != null) {
        unitPricePaise = toPaise(item.unitPrice);
      } else if (lotRemainings.length > 0) {
        unitPricePaise = lotRemainings[0].lot.sellingPricePerUnit;
      } else {
        const latestLot = await StockLot.findOne({ product: product._id }).sort({ stockedDate: -1, _id: -1 });
        unitPricePaise = latestLot ? latestLot.sellingPricePerUnit : 0;
      }

      // FIFO Allocation
      let needed = requestedQtyBase;
      const allocations = [];

      for (const { lot, remaining } of lotRemainings) {
        if (needed <= 0) break;
        const take = Math.min(needed, remaining);
        allocations.push({
          lot: lot._id,
          quantity: take,
          unitCost: lot.buyingPricePerUnit, // paise per display unit
          returnedQty: 0,
        });
        needed -= take;
      }

      // Financials for this line
      const lineSubtotal = Math.round((requestedQtyBase * unitPricePaise) / multiplier);
      let lineCost = 0;
      for (const alloc of allocations) {
        lineCost += Math.round((alloc.quantity * alloc.unitCost) / multiplier);
      }

      billSubtotal += lineSubtotal;
      billTotalCost += lineCost;

      billLines.push({
        product: product._id,
        quantity: requestedQtyBase,
        unitPrice: unitPricePaise,
        allocations,
        returnedQty: 0,
      });
    }

    const discountPaise = toPaise(discount);
    const billTotal = Math.max(0, billSubtotal - discountPaise);
    const billProfit = billTotal - billTotalCost;

    const billNumber = await generateBillNumber();

    const [createdBill] = await Bill.create(
      [
        {
          billNumber,
          customerName,
          lines: billLines,
          subtotal: billSubtotal,
          discount: discountPaise,
          total: billTotal,
          totalCost: billTotalCost,
          profit: billProfit,
          paymentMode,
        },
      ],
      { session }
    );

    createdBillId = createdBill._id;

    // Create immutable ledger sale movements for each allocation
    for (const line of createdBill.lines) {
      for (const alloc of line.allocations) {
        movementsToCreate.push({
          type: 'sale',
          product: line.product,
          lot: alloc.lot,
          quantity: alloc.quantity,
          fromLocation: location,
          toLocation: 'Customer',
          unitCost: alloc.unitCost,
          unitPrice: line.unitPrice,
          bill: createdBill._id,
          date: createdBill.createdAt || new Date(),
          note: `Sale on Bill #${billNumber}`,
        });
      }
    }

    await Movement.insertMany(movementsToCreate, { session });

    return createdBill;
  });

  const finalPopulatedBill = await Bill.findById(createdBillId)
    .populate('lines.product')
    .populate('lines.allocations.lot');

  // Real-time broadcast
  broadcast('bill:created', { bill: finalPopulatedBill });
  for (const pId of productsAffected) {
    broadcast('stock:updated', { productId: pId });
  }
  for (const m of movementsToCreate) {
    broadcast('movement:created', { movement: m });
  }

  return finalPopulatedBill;
}

/**
 * Process a customer return for a specific line item in a bill
 */
export async function processBillReturn(billId, lineIndex, returnQtyDisplay, reason = 'Customer Return') {
  const bill = await Bill.findById(billId).populate('lines.product');
  if (!bill) {
    throw new AppError('Bill not found', 404);
  }

  if (lineIndex < 0 || lineIndex >= bill.lines.length) {
    throw new AppError('Invalid bill line index', 400);
  }

  const line = bill.lines[lineIndex];
  const product = line.product;
  const unit = product.unit;
  const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;
  const returnQtyBase = toBaseUnit(returnQtyDisplay, unit);

  if (returnQtyBase <= 0) {
    throw new AppError('Return quantity must be greater than zero', 400);
  }

  const maxReturnable = line.quantity - (line.returnedQty || 0);
  if (returnQtyBase > maxReturnable) {
    throw new AppError(
      `Cannot return ${returnQtyDisplay} ${unit}. Maximum returnable is ${fromBaseUnit(maxReturnable, unit)} ${unit}`,
      400
    );
  }

  // Reverse allocations (most recent lot first)
  let neededToReturn = returnQtyBase;
  const reverseAllocations = [...line.allocations].reverse();
  const returnMovements = [];
  let returnedRevenuePaise = 0;
  let returnedCostPaise = 0;

  for (const alloc of reverseAllocations) {
    if (neededToReturn <= 0) break;
    const canReturnFromAlloc = alloc.quantity - (alloc.returnedQty || 0);
    if (canReturnFromAlloc <= 0) continue;

    const returnFromThisLot = Math.min(neededToReturn, canReturnFromAlloc);
    alloc.returnedQty = (alloc.returnedQty || 0) + returnFromThisLot;

    const portionRevenue = Math.round((returnFromThisLot * line.unitPrice) / multiplier);
    const portionCost = Math.round((returnFromThisLot * alloc.unitCost) / multiplier);
    returnedRevenuePaise += portionRevenue;
    returnedCostPaise += portionCost;

    returnMovements.push({
      type: 'return',
      product: product._id,
      lot: alloc.lot,
      quantity: returnFromThisLot,
      fromLocation: 'Customer',
      toLocation: 'Shop',
      unitCost: alloc.unitCost,
      unitPrice: line.unitPrice,
      bill: bill._id,
      date: new Date(),
      note: `Return for Bill #${bill.billNumber}: ${reason}`,
    });

    neededToReturn -= returnFromThisLot;
  }

  line.returnedQty = (line.returnedQty || 0) + returnQtyBase;

  // Adjust bill totals
  bill.total = Math.max(0, bill.total - returnedRevenuePaise);
  bill.totalCost = Math.max(0, bill.totalCost - returnedCostPaise);
  bill.profit = bill.total - bill.totalCost;

  await bill.save();
  await Movement.insertMany(returnMovements);

  // Broadcast real time
  broadcast('bill:returned', { billId: bill._id, returnQty: returnQtyDisplay, reason });
  broadcast('stock:updated', { productId: product._id });
  for (const m of returnMovements) {
    broadcast('movement:created', { movement: m });
  }

  return bill;
}

import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(120),
  sku: z.string().trim().min(1, 'SKU is required').max(50),
  category: z.string().trim().min(1, 'Category is required').max(50),
  unit: z.enum(['kg', 'g', 'litre', 'ml', 'pcs', 'pack'], {
    errorMap: () => ({ message: 'Unit must be one of: kg, g, litre, ml, pcs, pack' }),
  }),
  lowStockThreshold: z.number().nonnegative('Threshold cannot be negative').default(0),
  imageEmoji: z.string().trim().max(10).optional().default('📦'),
  colour: z.string().trim().max(20).optional().default('#6366f1'),
});

export const restockSchema = z.object({
  product: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  stockedDate: z.coerce.date().optional().default(() => new Date()),
  supplier: z.string().trim().max(100).optional().default('General Wholesale'),
  quantityReceived: z.number().positive('Quantity received must be greater than zero'),
  buyingPricePerUnit: z.number().nonnegative('Buying price cannot be negative'),
  sellingPricePerUnit: z.number().nonnegative('Selling price cannot be negative'),
  location: z.enum(['Shop', 'Storeroom']).default('Shop'),
  note: z.string().trim().max(300).optional().default(''),
});

export const editLotDateSchema = z.object({
  newDate: z.coerce.date({ invalid_type_error: 'Valid new date is required' }),
  reason: z.string().trim().min(3, 'Reason is required and must be at least 3 characters').max(300),
});

export const billLineSchema = z.object({
  product: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').optional(), // selling price override in rupees
});

export const createBillSchema = z.object({
  customerName: z.string().trim().max(100).optional().default('Walk-in Customer'),
  lines: z.array(billLineSchema).min(1, 'At least one line item is required'),
  discount: z.number().nonnegative('Discount cannot be negative').optional().default(0),
  paymentMode: z.enum(['cash', 'upi', 'card', 'due']).default('cash'),
  location: z.enum(['Shop', 'Storeroom']).optional().default('Shop'),
});

export const returnBillSchema = z.object({
  lineIndex: z.number().int().min(0, 'Line index must be non-negative'),
  quantity: z.number().positive('Return quantity must be greater than zero'),
  reason: z.string().trim().max(300).optional().default('Customer Return'),
});

export const transferSchema = z.object({
  product: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.number().positive('Quantity must be positive'),
  fromLocation: z.enum(['Shop', 'Storeroom']),
  toLocation: z.enum(['Shop', 'Storeroom']),
  note: z.string().trim().max(300).optional().default('Stock Transfer'),
}).refine(data => data.fromLocation !== data.toLocation, {
  message: 'Source and destination locations cannot be the same',
  path: ['toLocation'],
});

export const adjustmentSchema = z.object({
  product: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.number().refine(val => val !== 0, 'Adjustment quantity cannot be zero'), // positive = found/added, negative = damaged/lost
  location: z.enum(['Shop', 'Storeroom']).default('Shop'),
  reason: z.string().trim().min(3, 'Reason for adjustment is required (e.g. Spillage, Damage, Found)').max(300),
});

export const countSaveSchema = z.object({
  location: z.enum(['Shop', 'Storeroom']),
  note: z.string().trim().max(300).optional().default('Physical Stock Audit'),
  items: z.array(
    z.object({
      product: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
      countedQty: z.number().nonnegative('Counted quantity cannot be negative'),
    })
  ).min(1, 'At least one item is required for reconciliation'),
});

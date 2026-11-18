import mongoose from 'mongoose';

const movementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Movement type is required'],
      enum: ['receipt', 'sale', 'return', 'transfer', 'adjustment'],
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockLot',
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      // Note: integer in base unit. For adjustments, can represent net change or positive delta with from/to
      min: [1, 'Quantity must be positive'],
    },
    fromLocation: {
      type: String,
      required: true,
      enum: ['Shop', 'Storeroom', 'Supplier', 'Customer', 'Adjustment'],
      index: true,
    },
    toLocation: {
      type: String,
      required: true,
      enum: ['Shop', 'Storeroom', 'Supplier', 'Customer', 'Adjustment'],
      index: true,
    },
    unitCost: {
      type: Number,
      default: 0, // integer paise per display unit snapshot
    },
    unitPrice: {
      type: Number,
      default: 0, // integer paise per display unit snapshot
    },
    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // immutable ledger: no update timestamp
  }
);

movementSchema.index({ product: 1, date: -1 });
movementSchema.index({ product: 1, lot: 1 });
movementSchema.index({ fromLocation: 1, toLocation: 1 });

export const Movement = mongoose.model('Movement', movementSchema);

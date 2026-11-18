import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockLot',
      required: true,
    },
    quantity: {
      type: Number,
      required: true, // base units
    },
    unitCost: {
      type: Number,
      required: true, // paise per display unit
    },
    returnedQty: {
      type: Number,
      default: 0, // base units returned
    },
  },
  { _id: false }
);

const billLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true, // base units
    },
    unitPrice: {
      type: Number,
      required: true, // paise per display unit
    },
    allocations: [allocationSchema],
    returnedQty: {
      type: Number,
      default: 0, // base units returned
    },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      default: 'Walk-in Customer',
      trim: true,
    },
    lines: [billLineSchema],
    subtotal: {
      type: Number,
      required: true, // paise
    },
    discount: {
      type: Number,
      default: 0, // paise
    },
    total: {
      type: Number,
      required: true, // paise
    },
    totalCost: {
      type: Number,
      required: true, // paise
    },
    profit: {
      type: Number,
      required: true, // paise
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'card', 'due'],
      default: 'cash',
    },
  },
  {
    timestamps: true,
  }
);

billSchema.index({ createdAt: -1 });

export const Bill = mongoose.model('Bill', billSchema);

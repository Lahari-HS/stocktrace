import mongoose from 'mongoose';

const dateEditHistorySchema = new mongoose.Schema(
  {
    oldDate: {
      type: Date,
      required: true,
    },
    newDate: {
      type: Date,
      required: true,
    },
    editedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      required: [true, 'Reason for date edit is required'],
      trim: true,
    },
  },
  { _id: false }
);

const stockLotSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    stockedDate: {
      type: Date,
      required: [true, 'Stocked date is required'],
      default: Date.now,
      index: true,
    },
    supplier: {
      type: String,
      default: 'General Wholesale',
      trim: true,
    },
    quantityReceived: {
      type: Number,
      required: [true, 'Quantity received is required'],
      min: [1, 'Quantity received must be positive'],
    },
    buyingPricePerUnit: {
      type: Number,
      required: [true, 'Buying price is required'],
      min: [0, 'Buying price cannot be negative'],
    },
    sellingPricePerUnit: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    location: {
      type: String,
      enum: ['Shop', 'Storeroom'],
      default: 'Shop',
      index: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    dateEditHistory: [dateEditHistorySchema],
  },
  {
    timestamps: true,
  }
);

stockLotSchema.index({ product: 1, stockedDate: 1 });
stockLotSchema.index({ product: 1, location: 1 });

export const StockLot = mongoose.model('StockLot', stockLotSchema);

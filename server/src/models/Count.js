import mongoose from 'mongoose';

const movementSnapshotSchema = new mongoose.Schema(
  {
    date: Date,
    type: { type: String },
    quantity: Number,
    fromLocation: String,
    toLocation: String,
    note: String,
  },
  { _id: false }
);

const countItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    systemQty: {
      type: Number,
      required: true, // base units
    },
    countedQty: {
      type: Number,
      required: true, // base units
    },
    variance: {
      type: Number,
      required: true, // countedQty - systemQty (can be negative or positive)
    },
    sinceLastCount: [movementSnapshotSchema],
  },
  { _id: false }
);

const countSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      enum: ['Shop', 'Storeroom'],
      required: true,
      index: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'posted'],
      default: 'open',
      index: true,
    },
    items: [countItemSchema],
    postedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

countSchema.index({ location: 1, createdAt: -1 });

export const Count = mongoose.model('Count', countSchema);

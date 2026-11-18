import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: ['kg', 'g', 'litre', 'ml', 'pcs', 'pack'],
    },
    lowStockThreshold: {
      type: Number,
      default: 0,
      min: [0, 'Threshold cannot be negative'],
    },
    imageEmoji: {
      type: String,
      default: '📦',
    },
    colour: {
      type: String,
      default: '#6366f1',
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ name: 'text', sku: 'text', category: 'text' });

export const Product = mongoose.model('Product', productSchema);

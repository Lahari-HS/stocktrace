import React, { useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const EMOJI_OPTIONS = ['🌾', '🍚', '🥛', '🧈', '🌶️', '🧂', '🫒', '☕', '🍵', '🍪', '🧼', '🧴', '🥜', '🍯', '📦'];
const COLOR_OPTIONS = ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6'];

export function CreateProductModal({ onClose, onSuccess }) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Grains & Pulses');
  const [unit, setUnit] = useState('kg');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [imageEmoji, setImageEmoji] = useState('🌾');
  const [colour, setColour] = useState('#6366f1');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('Product name is required');
      return;
    }
    if (!sku.trim()) {
      toastError('SKU is required');
      return;
    }

    try {
      setSubmitting(true);
      await api.createProduct({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        category: category.trim(),
        unit,
        lowStockThreshold: parseFloat(lowStockThreshold) || 0,
        imageEmoji,
        colour,
      });

      toastSuccess(`Product "${name}" created successfully`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toastError(err.message, 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Create New Product
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add a catalog item to your inventory
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Product Name
            </label>
            <input
              type="text"
              placeholder="e.g. Chakki Fresh Atta"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!sku) {
                  setSku(e.target.value.substring(0, 4).toUpperCase() + '-001');
                }
              }}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Unique SKU
              </label>
              <input
                type="text"
                placeholder="e.g. ATTA-001"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Unit of Measure
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="litre">Litre (L)</option>
                <option value="ml">Millilitre (ml)</option>
                <option value="pcs">Pieces (pcs)</option>
                <option value="pack">Packets (pack)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Grains & Pulses"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Low Stock Threshold ({unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
          </div>

          {/* Emoji Avatar Selector */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Product Avatar & Accent
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setImageEmoji(emoji)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${
                    imageEmoji === emoji
                      ? 'scale-110 bg-brand-100 dark:bg-brand-900 border-2 border-brand-500'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm shadow-brand-500/25 transition-all"
            >
              {submitting ? 'Creating...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

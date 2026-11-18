import React, { useState, useEffect } from 'react';
import { X, Wrench, AlertTriangle, PlusCircle, MinusCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export function AdjustmentModal({ onClose, onSuccess }) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [direction, setDirection] = useState('deduction'); // 'deduction' (-) or 'surplus' (+)
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('Shop');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getProducts({ limit: 100 }).then((res) => {
      const list = res.products || [];
      setProducts(list);
      if (list.length > 0) {
        setSelectedProductId(list[0]._id);
      }
    }).catch(() => {});
  }, []);

  const selectedProduct = products.find((p) => p._id === selectedProductId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toastError('Quantity must be greater than zero');
      return;
    }
    if (!reason.trim()) {
      toastError('Reason for adjustment is mandatory');
      return;
    }

    try {
      setSubmitting(true);
      const signedQty = direction === 'deduction' ? -qty : qty;

      await api.createAdjustment({
        product: selectedProductId,
        quantity: signedQty,
        location,
        reason: reason.trim(),
      });

      toastSuccess(
        `Recorded ${direction === 'deduction' ? 'deduction' : 'surplus'} of ${qty} ${selectedProduct?.unit || ''}`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toastError(err.message, 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Stock Adjustment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log damage, spillage, expiry, or audit surplus
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
              Select Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium"
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sku}) — Available: {p.remainingDisplay} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Adjustment Direction */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('deduction')}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all ${
                direction === 'deduction'
                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              <MinusCircle className="w-4 h-4 text-rose-600" />
              <span>Deduction (Loss/Damage)</span>
            </button>

            <button
              type="button"
              onClick={() => setDirection('surplus')}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all ${
                direction === 'surplus'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Surplus (Found Extra)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Quantity ({selectedProduct?.unit || 'units'})
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                placeholder="e.g. 2.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                At Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="Shop">Shop Floor</option>
                <option value="Storeroom">Storeroom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason for Adjustment (Required)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Bag damaged by moisture, carton spilled during loading"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
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
              className="px-5 py-2 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm shadow-rose-500/25 transition-all"
            >
              {submitting ? 'Recording...' : 'Record Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

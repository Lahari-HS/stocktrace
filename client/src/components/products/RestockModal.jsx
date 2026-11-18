import React, { useState } from 'react';
import { X, PackagePlus } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export function RestockModal({ product, onClose, onSuccess }) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [stockedDate, setStockedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('General Wholesale');
  const [quantity, setQuantity] = useState('');
  const [buyingPrice, setBuyingPrice] = useState(product ? (product.buyingPrice / 100).toString() : '');
  const [sellingPrice, setSellingPrice] = useState(product ? (product.sellingPrice / 100).toString() : '');
  const [location, setLocation] = useState('Shop');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qtyNum = parseFloat(quantity);
    const buyNum = parseFloat(buyingPrice);
    const sellNum = parseFloat(sellingPrice);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      toastError('Please enter a valid positive quantity');
      return;
    }
    if (isNaN(buyNum) || buyNum < 0) {
      toastError('Please enter a valid buying price');
      return;
    }
    if (isNaN(sellNum) || sellNum < 0) {
      toastError('Please enter a valid selling price');
      return;
    }

    try {
      setSubmitting(true);
      await api.createRestock({
        product: product._id,
        stockedDate: new Date(stockedDate),
        supplier: supplier.trim() || 'General Wholesale',
        quantityReceived: qtyNum,
        buyingPricePerUnit: buyNum,
        sellingPricePerUnit: sellNum,
        location,
        note: note.trim(),
      });

      toastSuccess(`Restocked ${qtyNum} ${product.unit} of ${product.name}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toastError(err.message, 'Restock failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Restock Inventory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {product.name} ({product.sku})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Stocked Date
              </label>
              <input
                type="date"
                value={stockedDate}
                onChange={(e) => setStockedDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Stock Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="Shop">Shop Floor</option>
                <option value="Storeroom">Storeroom / Backroom</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Quantity ({product.unit})
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                placeholder={`e.g. 50`}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Buying Price (₹/{product.unit})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="₹ Cost"
                value={buyingPrice}
                onChange={(e) => setBuyingPrice(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Selling Price (₹/{product.unit})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="₹ Selling"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Supplier Name
            </label>
            <input
              type="text"
              placeholder="e.g. Punjab Agro Wholesalers"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Batch #42 arrival, clean packaging"
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
              className="px-5 py-2 font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm shadow-brand-500/25 transition-all"
            >
              {submitting ? 'Recording...' : 'Restock Lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

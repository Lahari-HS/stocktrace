import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Clock,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Package,
} from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import {
  formatCurrency,
  formatQuantity,
  UNIT_CONFIG,
  toBaseUnit,
} from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';

export function POSScreen() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { socket } = useSocket();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Cart State
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [discount, setDiscount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  // Completed Bill for Receipt Modal
  const [completedBill, setCompletedBill] = useState(null);

  const searchInputRef = useRef(null);

  // Load products & categories
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.getProducts({
        limit: 50,
        search,
        category: selectedCategory === 'All' ? '' : selectedCategory,
      });
      setProducts(res.products || []);
    } catch (err) {
      toastError(err.message, 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, selectedCategory]);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Listen to socket stock updates
  useEffect(() => {
    if (!socket) return;
    const handleStockUpdate = () => fetchProducts();
    socket.on('stock:updated', handleStockUpdate);
    return () => socket.off('stock:updated', handleStockUpdate);
  }, [socket]);

  // Keyboard shortcut listener ('/' focuses search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cart operations
  const addToCart = (product) => {
    if (product.remaining <= 0) {
      toastWarning(`${product.name} is out of stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product._id === product._id);
      if (existing) {
        // Increment by 1 or default unit step
        const step = product.unit === 'g' || product.unit === 'ml' ? 100 : 1;
        return prev.map((item) =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + step }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: product.unit === 'g' || product.unit === 'ml' ? 500 : 1,
          unitPrice: product.sellingPrice / 100, // display in rupees
          costPrice: product.buyingPrice / 100,
        },
      ];
    });
  };

  const updateQuantity = (productId, newQty) => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.product._id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const updatePriceOverride = (productId, newPrice) => {
    const p = parseFloat(newPrice);
    if (isNaN(p) || p < 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.product._id === productId ? { ...item, unitPrice: p } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product._id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('');
  };

  // Compute live subtotal, estimated cost, and live profit preview
  let runningSubtotalPaise = 0;
  let estimatedCostPaise = 0;

  for (const item of cart) {
    const unit = item.product.unit;
    const mult = UNIT_CONFIG[unit]?.multiplier || 1;
    const baseQty = toBaseUnit(item.quantity, unit);
    const unitPricePaise = Math.round(item.unitPrice * 100);
    const costPricePaise = Math.round(item.costPrice * 100);

    const lineTotal = Math.round((baseQty * unitPricePaise) / mult);
    const lineCost = Math.round((baseQty * costPricePaise) / mult);

    runningSubtotalPaise += lineTotal;
    estimatedCostPaise += lineCost;
  }

  const discountPaise = Math.round((parseFloat(discount) || 0) * 100);
  const netTotalPaise = Math.max(0, runningSubtotalPaise - discountPaise);
  const estimatedProfitPaise = netTotalPaise - estimatedCostPaise;

  // Checkout Handler
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toastWarning('Cart is empty. Select products first.');
      return;
    }

    try {
      setSubmitting(true);

      const billPayload = {
        customerName: customerName.trim() || 'Walk-in Customer',
        lines: cart.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        discount: parseFloat(discount) || 0,
        paymentMode,
        location: 'Shop',
      };

      const createdBill = await api.createBill(billPayload);

      // Trigger Confetti Celebration!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'],
      });

      toastSuccess(`Bill #${createdBill.billNumber} created successfully!`);
      setCompletedBill(createdBill);
      clearCart();
    } catch (err) {
      if (err.status === 409) {
        toastError(err.message, 'Inventory Allocation Error');
      } else {
        toastError(err.message, 'Checkout Failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT: Fast Product Search & Grid (col-span-7) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search bar & hotkey badge */}
        <div className="glass-card p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products by name, SKU... (Press '/' to focus)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-14 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded">
                /
              </kbd>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'All'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
          {products.map((p) => {
            const isOutOfStock = p.remaining <= 0;
            return (
              <button
                key={p._id}
                disabled={isOutOfStock}
                onClick={() => addToCart(p)}
                className={`glass-card p-3 text-left transition-all relative flex flex-col justify-between group ${
                  isOutOfStock
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:shadow-md hover:border-brand-500/50 hover:-translate-y-0.5'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                      style={{ backgroundColor: `${p.colour || '#6366f1'}20` }}
                    >
                      {p.imageEmoji || '📦'}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : p.remaining <= p.lowStockThreshold
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {formatQuantity(p.remaining, p.unit)}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 line-clamp-1">
                      {p.name}
                    </h4>
                    <p className="text-[10px] font-mono text-slate-400">{p.sku}</p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {formatCurrency(p.sellingPrice)}
                    <span className="text-[10px] font-normal text-slate-400">/{p.unit}</span>
                  </span>
                  <span className="p-1 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Active Cart, Live Profit Preview & Checkout (col-span-5) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="glass-card p-5 space-y-4 border-brand-500/30 shadow-lg">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Customer Cart
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {cart.length}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Customer Name Input */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Customer Name / Mobile
            </label>
            <input
              type="text"
              placeholder="Walk-in Customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Cart Line Items List */}
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-600" />
                <p>Cart is currently empty.</p>
                <p className="text-[10px]">Click any product from the catalog to start billing.</p>
              </div>
            ) : (
              cart.map((item) => {
                const prod = item.product;
                const unit = prod.unit;
                const mult = UNIT_CONFIG[unit]?.multiplier || 1;
                const baseQty = toBaseUnit(item.quantity, unit);
                const lineTotalPaise = Math.round((baseQty * Math.round(item.unitPrice * 100)) / mult);

                return (
                  <div
                    key={prod._id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {prod.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span>Rate: ₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updatePriceOverride(prod._id, e.target.value)}
                          className="w-16 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-right font-medium"
                          title="Override selling price per unit"
                        />
                        <span>/{unit}</span>
                      </div>
                    </div>

                    {/* Quantity Input (Supports Decimals e.g. 2.5 kg) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(prod._id, e.target.value)}
                        className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-right font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-[11px] text-slate-400 font-medium w-6">{unit}</span>
                    </div>

                    {/* Line Total & Delete */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(lineTotalPaise)}
                      </p>
                      <button
                        onClick={() => removeFromCart(prod._id)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Payment Mode Selector */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-[11px] font-medium text-slate-500">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'upi', label: 'UPI', icon: QrCode },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'due', label: 'Credit', icon: Clock },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setPaymentMode(m.id)}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-xl font-medium transition-all ${
                      paymentMode === m.id
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discount & Totals */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatCurrency(runningSubtotalPaise)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Discount (₹):</span>
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right text-xs"
              />
            </div>

            <div className="flex items-center justify-between text-base font-bold text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span>Total to Pay:</span>
              <span className="font-display font-extrabold text-brand-600 dark:text-brand-400 text-xl">
                {formatCurrency(netTotalPaise)}
              </span>
            </div>

            {/* LIVE ESTIMATED PROFIT PREVIEW */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/25 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-xs">Live Profit Preview:</span>
              </div>
              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {formatCurrency(estimatedProfitPaise)}
              </span>
            </div>
          </div>

          {/* PAY & CHECKOUT BUTTON */}
          <button
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            className="w-full py-3.5 px-4 rounded-xl font-display font-bold text-sm bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {submitting
                ? 'Processing FIFO Allocation...'
                : `Complete Sale (${formatCurrency(netTotalPaise)})`}
            </span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {completedBill && (
        <ReceiptModal
          bill={completedBill}
          onClose={() => setCompletedBill(null)}
          onNewSale={() => setCompletedBill(null)}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  Edit2,
  PackagePlus,
  TrendingUp,
  TrendingDown,
  History,
  Clock,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { api } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import {
  formatCurrency,
  formatQuantity,
  formatDate,
  formatDateTime,
} from '../../utils/formatters';
import { ProfitLossBadge } from '../common/StatusPill';

export function ProductDrawer({ product, onClose, onOpenRestock }) {
  const { socket } = useSocket();
  const { success: toastSuccess, error: toastError } = useToast();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Date edit modal state
  const [editingLot, setEditingLot] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!product?._id) return;
    try {
      setLoading(true);
      const data = await api.getProduct(product._id);
      setDetails(data);
    } catch (err) {
      toastError(err.message, 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  }, [product?._id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Real-time update subscription
  useEffect(() => {
    if (!socket || !product?._id) return;

    const handleUpdate = (data) => {
      if (data?.productId === product._id || data?.lot?.product === product._id) {
        fetchDetails();
      }
    };

    socket.on('stock:updated', handleUpdate);
    socket.on('bill:created', handleUpdate);
    socket.on('bill:returned', handleUpdate);
    socket.on('lot:updated', handleUpdate);
    socket.on('movement:created', handleUpdate);

    return () => {
      socket.off('stock:updated', handleUpdate);
      socket.off('bill:created', handleUpdate);
      socket.off('bill:returned', handleUpdate);
      socket.off('lot:updated', handleUpdate);
      socket.off('movement:created', handleUpdate);
    };
  }, [socket, product?._id, fetchDetails]);

  const handleOpenEditDate = (lot) => {
    setEditingLot(lot);
    // Format to YYYY-MM-DD for date input
    const d = new Date(lot.stockedDate);
    const dateFormatted = d.toISOString().split('T')[0];
    setEditDate(dateFormatted);
    setEditReason('');
  };

  const handleSaveDateEdit = async (e) => {
    e.preventDefault();
    if (!editReason.trim()) {
      toastError('Please provide a reason for editing the stocked date');
      return;
    }

    try {
      setSavingEdit(true);
      await api.updateLotDate(editingLot._id, {
        newDate: editDate,
        reason: editReason.trim(),
      });
      toastSuccess('Stock lot date updated successfully');
      setEditingLot(null);
      fetchDetails();
    } catch (err) {
      toastError(err.message, 'Failed to update stocked date');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
              style={{ backgroundColor: `${product.colour || '#6366f1'}25` }}
            >
              {product.imageEmoji || '📦'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
                  {product.name}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-mono font-medium">
                  {product.sku}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Category: <span className="font-medium text-slate-700 dark:text-slate-300">{product.category}</span> • Unit: <span className="font-medium text-slate-700 dark:text-slate-300">{product.unit}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenRestock(product)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>Restock</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Stocked</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatQuantity(details?.product?.totalStocked ?? product.quantityStocked, product.unit)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Remaining</p>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-0.5">
                {formatQuantity(details?.product?.totalRemaining ?? product.remaining, product.unit)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Revenue</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatCurrency(details?.product?.totalRevenue ?? product.revenue)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Profit / Loss</p>
              <div className="mt-0.5">
                <ProfitLossBadge amountPaise={details?.product?.totalProfit ?? product.profit} />
              </div>
            </div>
          </div>

          {/* Section 1: All Stock Lots Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Stock Lots ({details?.lots?.length || 0})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Oldest lots billed first (FIFO)
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Stocked Date</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Received</th>
                    <th className="py-2.5 px-3">Remaining</th>
                    <th className="py-2.5 px-3">Cost Price</th>
                    <th className="py-2.5 px-3">Selling Price</th>
                    <th className="py-2.5 px-3">Revenue</th>
                    <th className="py-2.5 px-3">Profit / Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {details?.lots?.map((lot) => (
                    <tr key={lot._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      {/* Date with inline edit trigger */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 group/edit">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {formatDate(lot.stockedDate)}
                          </span>
                          <button
                            onClick={() => handleOpenEditDate(lot)}
                            className="opacity-0 group-hover/edit:opacity-100 p-1 text-slate-400 hover:text-brand-600 transition-opacity"
                            title="Edit stocked date with audit reason"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                        {lot.dateEditHistory && lot.dateEditHistory.length > 0 && (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                            <History className="w-3 h-3" />
                            <span>Edited {lot.dateEditHistory.length}x</span>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {lot.supplier}
                        <span className="ml-1 text-[10px] text-slate-400">({lot.location})</span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {formatQuantity(lot.quantityReceived, product.unit)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                        {formatQuantity(lot.remaining, product.unit)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {formatCurrency(lot.buyingPricePerUnit)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                        {formatCurrency(lot.sellingPricePerUnit)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold">
                        {formatCurrency(lot.revenue)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <ProfitLossBadge amountPaise={lot.profit} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Mini Chart - Stock Remaining Over Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                Stock Balance Over Time
              </h3>
            </div>

            <div className="h-44 p-3 bg-slate-50/70 dark:bg-slate-850/50 rounded-xl border border-slate-200/60 dark:border-slate-800">
              {details?.stockChart && details.stockChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={details.stockChart}>
                    <defs>
                      <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      stroke="#94a3b8"
                      fontSize={10}
                    />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip
                      formatter={(val) => [`${val} ${product.unit}`, 'Stock Remaining']}
                      labelFormatter={(l) => new Date(l).toLocaleString()}
                    />
                    <Area
                      type="monotone"
                      dataKey="stockDisplay"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#stockGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No movement points recorded yet
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Full Movement History Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Immutable Movement History ({details?.movements?.length || 0})
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {details?.movements?.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No movements recorded yet</p>
              ) : (
                details?.movements?.map((m) => {
                  const isIncoming = ['receipt', 'return'].includes(m.type) || (m.type === 'adjustment' && m.fromLocation === 'Adjustment');
                  return (
                    <div
                      key={m._id}
                      className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              m.type === 'receipt'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : m.type === 'sale'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : m.type === 'return'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : m.type === 'transfer'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {m.type}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-mono">
                            {formatDateTime(m.date)}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{m.note || 'Ledger entry'}</p>
                        <p className="text-[11px] text-slate-400">
                          From <span className="font-medium text-slate-600 dark:text-slate-300">{m.fromLocation}</span> → To <span className="font-medium text-slate-600 dark:text-slate-300">{m.toLocation}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-semibold text-sm ${
                            isIncoming
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {isIncoming ? '+' : '-'}
                          {formatQuantity(m.quantity, product.unit)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Date Edit Modal Overlay */}
        <AnimatePresence>
          {editingLot && (
            <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                    Edit Stock Lot Date
                  </h4>
                  <button
                    onClick={() => setEditingLot(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Changing the stocked date does not affect quantities. Every change is logged in the permanent audit history.
                </p>

                <form onSubmit={handleSaveDateEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      New Stocked Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Reason for Date Modification (Mandatory)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Invoice date correction received from supplier..."
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {editingLot.dateEditHistory && editingLot.dateEditHistory.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 text-xs space-y-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-amber-500" />
                        Previous Date History:
                      </p>
                      {editingLot.dateEditHistory.map((h, idx) => (
                        <div key={idx} className="text-[11px] text-slate-500 border-l-2 border-brand-500 pl-2">
                          <p className="font-medium text-slate-700 dark:text-slate-300">
                            {formatDate(h.oldDate)} → {formatDate(h.newDate)}
                          </p>
                          <p className="italic">"{h.reason}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingLot(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm"
                    >
                      {savingEdit ? 'Saving...' : 'Save & Log Date'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

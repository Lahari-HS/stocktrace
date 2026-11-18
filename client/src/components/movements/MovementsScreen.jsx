import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeftRight,
  Filter,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import {
  formatCurrency,
  formatQuantity,
  formatDateTime,
} from '../../utils/formatters';
import { TransferModal } from './TransferModal';
import { AdjustmentModal } from './AdjustmentModal';

export function MovementsScreen() {
  const { socket } = useSocket();
  const { error: toastError } = useToast();

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Filters
  const [selectedType, setSelectedType] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // Modals
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openAdjustment, setOpenAdjustment] = useState(false);

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getMovements({
        page: pagination.page,
        limit: pagination.limit,
        type: selectedType === 'all' ? '' : selectedType,
        location: selectedLocation === 'all' ? '' : selectedLocation,
      });

      setMovements(res.movements || []);
      setPagination(res.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      toastError(err.message, 'Failed to fetch movement ledger');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedType, selectedLocation]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Live Socket listener
  useEffect(() => {
    if (!socket) return;
    const handleMovement = () => fetchMovements();
    socket.on('movement:created', handleMovement);
    return () => socket.off('movement:created', handleMovement);
  }, [socket, fetchMovements]);

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Movement Types</option>
            <option value="receipt">Receipts (Restocks)</option>
            <option value="sale">Sales (Billing)</option>
            <option value="return">Customer Returns</option>
            <option value="transfer">Internal Transfers</option>
            <option value="adjustment">Audit Adjustments</option>
          </select>

          {/* Location Filter */}
          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Locations</option>
            <option value="Shop">Shop Floor</option>
            <option value="Storeroom">Storeroom</option>
          </select>

          <button
            onClick={fetchMovements}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action Buttons: Transfer & Adjustment */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpenTransfer(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/25 transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>New Transfer</span>
          </button>

          <button
            onClick={() => setOpenAdjustment(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/25 transition-all"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>New Adjustment</span>
          </button>
        </div>
      </div>

      {/* Main Immutable Ledger Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 font-semibold select-none">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">From → To</th>
                <th className="py-3 px-4">Unit Cost Snapshot</th>
                <th className="py-3 px-4">Unit Price Snapshot</th>
                <th className="py-3 px-4">Reference / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No ledger movements recorded matching the current filter.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const prod = m.product || {};
                  const unit = prod.unit || 'pcs';
                  const isIncoming =
                    ['receipt', 'return'].includes(m.type) ||
                    (m.type === 'adjustment' && m.fromLocation === 'Adjustment');

                  return (
                    <tr
                      key={m._id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                        {formatDateTime(m.date || m.createdAt)}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
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
                      </td>

                      {/* Product */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{prod.imageEmoji || '📦'}</span>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                              {prod.name || 'Product'}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">{prod.sku}</p>
                          </div>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 whitespace-nowrap font-semibold">
                        <span
                          className={
                            m.type === 'sale' || (m.type === 'adjustment' && m.toLocation === 'Adjustment')
                              ? 'text-rose-600 dark:text-rose-400'
                              : isIncoming
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-purple-600 dark:text-purple-400'
                          }
                        >
                          {m.type === 'transfer'
                            ? `⇄ ${formatQuantity(m.quantity, unit)}`
                            : `${isIncoming ? '+' : '-'}${formatQuantity(m.quantity, unit)}`}
                        </span>
                      </td>

                      {/* From -> To */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {m.fromLocation}
                        </span>{' '}
                        →{' '}
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {m.toLocation}
                        </span>
                      </td>

                      {/* Unit Cost Snapshot */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {m.unitCost ? `${formatCurrency(m.unitCost)}/${unit}` : '—'}
                      </td>

                      {/* Unit Price Snapshot */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                        {m.unitPrice ? `${formatCurrency(m.unitPrice)}/${unit}` : '—'}
                      </td>

                      {/* Note / Bill Ref */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {m.bill?.billNumber ? (
                          <span className="font-mono font-semibold text-brand-600 dark:text-brand-400 mr-1">
                            #{m.bill.billNumber}
                          </span>
                        ) : null}
                        <span>{m.note || '—'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold">{movements.length}</span> of{' '}
            <span className="font-semibold">{pagination.total.toLocaleString()}</span> immutable ledger records
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {openTransfer && (
        <TransferModal
          onClose={() => setOpenTransfer(false)}
          onSuccess={fetchMovements}
        />
      )}
      {openAdjustment && (
        <AdjustmentModal
          onClose={() => setOpenAdjustment(false)}
          onSuccess={fetchMovements}
        />
      )}
    </div>
  );
}

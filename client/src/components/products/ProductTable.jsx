import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatQuantity, formatDate } from '../../utils/formatters';
import { StockStatusPill, ProfitLossBadge } from '../common/StatusPill';
import { TableSkeleton } from '../common/Skeleton';

export function ProductTable({ onSelectProduct, onOpenRestock, onOpenNewProduct }) {
  const { updatedProductId, socket } = useSocket();
  const { error: toastError } = useToast();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockStatus, setStockStatus] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getProducts({
        page: pagination.page,
        limit: pagination.limit,
        search,
        category: selectedCategory === 'All' ? '' : selectedCategory,
        stockStatus,
        sortField,
        sortOrder,
      });

      setProducts(res.products || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      toastError(err.message, 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, selectedCategory, stockStatus, sortField, sortOrder]);

  // Initial load & categories
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Listen to real-time socket events for instant refresh
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchProducts();
    };

    socket.on('stock:updated', handleUpdate);
    socket.on('bill:created', handleUpdate);
    socket.on('bill:returned', handleUpdate);
    socket.on('lot:updated', handleUpdate);
    socket.on('movement:created', handleUpdate);
    socket.on('count:posted', handleUpdate);

    return () => {
      socket.off('stock:updated', handleUpdate);
      socket.off('bill:created', handleUpdate);
      socket.off('bill:returned', handleUpdate);
      socket.off('lot:updated', handleUpdate);
      socket.off('movement:created', handleUpdate);
      socket.off('count:posted', handleUpdate);
    };
  }, [socket, fetchProducts]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, SKU, category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-300"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockStatus}
            onChange={(e) => {
              setStockStatus(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="hidden md:block px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Stock Status</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh Table"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenNewProduct}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass-card overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={8} />
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-display font-semibold text-base text-slate-800 dark:text-slate-200">
              No products found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Try adjusting your search terms or category filters, or click Add Product to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 text-xs font-semibold select-none">
                  <th className="py-3.5 px-4">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <span>Product</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      onClick={() => handleSort('latestStockedDate')}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <span>Date stocked</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Quantity stocked</th>
                  <th className="py-3.5 px-4">
                    <button
                      onClick={() => handleSort('remaining')}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <span>Remaining quantity</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Buying price (cost)</th>
                  <th className="py-3.5 px-4">Price per unit (selling)</th>
                  <th className="py-3.5 px-4">
                    <button
                      onClick={() => handleSort('revenue')}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <span>Revenue</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      onClick={() => handleSort('profit')}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <span>Profit / Loss</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {products.map((p) => {
                  const isUpdated = updatedProductId === p._id;
                  const percentRemaining =
                    p.quantityStocked > 0 ? Math.min(100, Math.round((p.remaining / p.quantityStocked) * 100)) : 0;

                  return (
                    <tr
                      key={p._id}
                      onClick={() => onSelectProduct(p)}
                      className={`group hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors cursor-pointer ${
                        isUpdated ? 'animate-row-update bg-brand-500/10' : ''
                      }`}
                    >
                      {/* Product Name, Emoji, SKU */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm"
                            style={{ backgroundColor: `${p.colour || '#6366f1'}20` }}
                          >
                            {p.imageEmoji || '📦'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                {p.sku}
                              </span>
                              <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {p.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date stocked (latest lot) */}
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {p.latestStockedDate ? formatDate(p.latestStockedDate) : '—'}
                      </td>

                      {/* Quantity Stocked */}
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatQuantity(p.quantityStocked, p.unit)}
                      </td>

                      {/* Remaining Quantity with Visual Progress Bar */}
                      <td className="py-3 px-4 whitespace-nowrap min-w-[150px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatQuantity(p.remaining, p.unit)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {percentRemaining}%
                            </span>
                          </div>

                          {/* Progress bar: green -> amber below threshold -> red at zero */}
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                p.remaining === 0
                                  ? 'bg-rose-500 w-full'
                                  : p.remaining <= p.lowStockThreshold
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${p.remaining === 0 ? 100 : Math.max(5, percentRemaining)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Buying Price (cost) */}
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatCurrency(p.buyingPrice)} / {p.unit}
                      </td>

                      {/* Price per unit (selling) */}
                      <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatCurrency(p.sellingPrice)} / {p.unit}
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-4 text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(p.revenue)}
                      </td>

                      {/* Profit / Loss */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ProfitLossBadge amountPaise={p.profit} showLabel={true} />
                      </td>

                      {/* Row Action: Restock & Inspect */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRestock(p);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60 rounded-lg transition-colors border border-brand-200 dark:border-brand-800/60 inline-flex items-center gap-1"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>Restock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold">{products.length}</span> of{' '}
            <span className="font-semibold">{pagination.total.toLocaleString()}</span> products
          </div>

          <div className="flex items-center gap-2">
            <span className="mr-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Boxes,
  AlertTriangle,
  Award,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  PackagePlus,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import {
  formatCurrency,
  formatQuantity,
  fromPaise,
  formatDateTime,
} from '../../utils/formatters';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { CardSkeleton } from '../common/Skeleton';

export function DashboardScreen({ onOpenRestock }) {
  const { socket, latestMovement } = useSocket();
  const { error: toastError } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7'); // '7' or '30'

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard(timeRange);
      setData(res);
    } catch (err) {
      toastError(err.message, 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time listener: refresh metrics when new bills or movements occur
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchDashboard();
    socket.on('bill:created', handleUpdate);
    socket.on('movement:created', handleUpdate);
    socket.on('stock:updated', handleUpdate);
    return () => {
      socket.off('bill:created', handleUpdate);
      socket.off('movement:created', handleUpdate);
      socket.off('stock:updated', handleUpdate);
    };
  }, [socket, fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const todayRevenueRupees = data ? fromPaise(data.todayRevenue) : 0;
  const todayProfitRupees = data ? fromPaise(data.todayProfit) : 0;
  const stockValueRupees = data ? fromPaise(data.totalStockValueAtCost) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-100 tracking-tight">
            Shop Performance Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time revenue, margins, valuation, and live audit telemetry.
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title="Refresh Dashboard"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 4 KPI Animated Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Today's Revenue
            </span>
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-display font-black text-2xl text-slate-900 dark:text-slate-100">
              <AnimatedCounter value={todayRevenueRupees} prefix="₹" decimals={2} />
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              From {data?.todayBillsCount || 0} customer bills today
            </p>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="glass-card p-5 relative overflow-hidden group border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Today's Net Profit
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3
              className={`font-display font-black text-2xl ${
                todayProfitRupees < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <AnimatedCounter value={todayProfitRupees} prefix="₹" decimals={2} />
            </h3>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
              Computed strictly from FIFO lot costs
            </p>
          </div>
        </div>

        {/* Total Bills Count */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Bills Completed Today
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-display font-black text-2xl text-slate-900 dark:text-slate-100">
              <AnimatedCounter value={data?.todayBillsCount || 0} decimals={0} />
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Counter checkout volume</p>
          </div>
        </div>

        {/* Total Stock Value at Cost */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Stock Value at Cost
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-display font-black text-2xl text-slate-900 dark:text-slate-100">
              <AnimatedCounter value={stockValueRupees} prefix="₹" decimals={2} />
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Total tied up capital in lots</p>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      {data?.lowStockAlerts && data.lowStockAlerts.length > 0 && (
        <div className="glass-card p-5 border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Low Stock Alerts ({data.lowStockAlerts.length})</span>
            </div>
            <span className="text-[11px] text-amber-600/80">Requires replenishment</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.lowStockAlerts.map((item) => (
              <div
                key={item._id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-2 shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl">{item.imageEmoji || '📦'}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                      {item.isZero ? 'OUT OF STOCK' : `Only ${item.remainingDisplay} ${item.unit} left`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOpenRestock(item)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 hover:bg-brand-600 hover:text-white transition-all shrink-0"
                >
                  Restock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Middle Row: Revenue vs Profit Chart & Top Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Revenue vs Profit Chart (col-span-8) */}
        <div className="lg:col-span-8 glass-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Revenue vs. Profit Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily comparison of sales income against net profit
              </p>
            </div>

            {/* 7 vs 30 Days Toggle */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setTimeRange('7')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  timeRange === '7'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeRange('30')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  timeRange === '30'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartData || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  stroke="#94a3b8"
                  fontSize={11}
                />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={(val, name) => [`₹${val.toFixed(2)}`, name === 'revenue' ? 'Revenue' : 'Profit']}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProf)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Top Sellers Ranking (col-span-4) */}
        <div className="lg:col-span-4 glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              Top Selling Products
            </h3>
          </div>

          <div className="space-y-3">
            {!data?.topSellers || data.topSellers.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No sales recorded yet.</p>
            ) : (
              data.topSellers.map((ts, idx) => (
                <div
                  key={ts._id}
                  className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-brand-50 dark:bg-brand-950 font-bold text-[11px] text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {ts.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{ts.category}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(ts.revenue)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {ts.soldQuantityDisplay} {ts.unit}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Live Real-Time Activity Feed of Movements */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-pulse" />
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              Live Store Activity Stream
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Updates live without refresh</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {data?.recentMovements?.map((m) => {
            const prod = m.product || {};
            const unit = prod.unit || 'pcs';
            return (
              <div
                key={m._id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{prod.imageEmoji || '📦'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {prod.name}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 rounded bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                        {m.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatDateTime(m.date || m.createdAt)} • {m.note || 'Ledger event'}
                    </p>
                  </div>
                </div>

                <span className="font-bold text-xs shrink-0">
                  {formatQuantity(m.quantity, unit)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

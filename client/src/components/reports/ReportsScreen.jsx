import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, fromPaise } from '../../utils/formatters';
import { ProfitLossBadge } from '../common/StatusPill';

export function ReportsScreen() {
  const { error: toastError, success: toastSuccess } = useToast();

  const [groupBy, setGroupBy] = useState('product'); // 'product' | 'category'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await api.getReports({ groupBy, startDate, endDate });
      setReportData(data || []);
    } catch (err) {
      toastError(err.message, 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [groupBy, startDate, endDate]);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const blob = await api.exportCSV({ groupBy, startDate, endDate });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stocktrace-${groupBy}-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toastSuccess('Report exported as CSV successfully!');
    } catch (err) {
      toastError(err.message, 'CSV export failed');
    } finally {
      setExporting(false);
    }
  };

  // Summary totals
  const totalRevenuePaise = reportData.reduce((acc, r) => acc + (r.revenue || 0), 0);
  const totalCostPaise = reportData.reduce((acc, r) => acc + (r.cost || 0), 0);
  const totalProfitPaise = totalRevenuePaise - totalCostPaise;
  const overallMargin = totalRevenuePaise > 0 ? ((totalProfitPaise / totalRevenuePaise) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            <h2 className="font-display font-extrabold text-xl text-slate-900 dark:text-slate-100">
              Financial Audit & Sales Reports
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Revenue, cost of goods sold, profit/loss, and margins aggregated per product and category.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={exporting || reportData.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/25 disabled:opacity-50 transition-all shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{exporting ? 'Exporting...' : 'Export CSV Report'}</span>
        </button>
      </div>

      {/* Filter Toolbar & Metric Overview Cards */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        {/* Group By selector */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 font-semibold">
          <button
            onClick={() => setGroupBy('product')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              groupBy === 'product'
                ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            By Product
          </button>
          <button
            onClick={() => setGroupBy('category')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              groupBy === 'category'
                ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            By Category
          </button>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Aggregate KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-500">Filtered Revenue</p>
          <p className="font-display font-bold text-lg text-slate-900 dark:text-slate-100 mt-0.5">
            {formatCurrency(totalRevenuePaise)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-500">Cost of Goods Sold (COGS)</p>
          <p className="font-display font-bold text-lg text-slate-700 dark:text-slate-300 mt-0.5">
            {formatCurrency(totalCostPaise)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-500">Net Profit / Loss</p>
          <div className="mt-0.5">
            <ProfitLossBadge amountPaise={totalProfitPaise} showLabel={true} />
          </div>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] text-slate-500">Average Profit Margin</p>
          <p className="font-display font-bold text-lg text-brand-600 dark:text-brand-400 mt-0.5">
            {overallMargin}%
          </p>
        </div>
      </div>

      {/* Visual Bar Breakdown Chart */}
      {reportData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
            Revenue vs. Cost Visual Breakdown (Top {Math.min(10, reportData.length)})
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reportData.slice(0, 10).map((r) => ({
                  name: r.group,
                  Revenue: fromPaise(r.revenue),
                  Cost: fromPaise(r.cost),
                  Profit: fromPaise(r.profit),
                }))}
              >
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip formatter={(val) => [`₹${val.toFixed(2)}`]} />
                <Legend />
                <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Data Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 font-semibold select-none">
                <th className="py-3 px-4">{groupBy === 'product' ? 'Product Name' : 'Category'}</th>
                {groupBy === 'product' && <th className="py-3 px-4">SKU</th>}
                {groupBy === 'product' && <th className="py-3 px-4">Category</th>}
                <th className="py-3 px-4">{groupBy === 'product' ? 'Sold Quantity' : 'Units Sold'}</th>
                <th className="py-3 px-4">Revenue</th>
                <th className="py-3 px-4">Cost of Goods (COGS)</th>
                <th className="py-3 px-4">Profit / Loss</th>
                <th className="py-3 px-4">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No sales recorded for the selected filter criteria.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {row.group}
                    </td>
                    {groupBy === 'product' && (
                      <td className="py-3 px-4 font-mono text-slate-400">{row.sku}</td>
                    )}
                    {groupBy === 'product' && (
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{row.category}</td>
                    )}
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {row.soldQuantityDisplay || row.unitsSold} {row.unit || ''}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {formatCurrency(row.cost)}
                    </td>
                    <td className="py-3 px-4">
                      <ProfitLossBadge amountPaise={row.profit} showLabel={true} />
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                      {row.margin}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

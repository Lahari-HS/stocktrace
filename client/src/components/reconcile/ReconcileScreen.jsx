import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  History,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { formatQuantity, fromBaseUnit, formatDateTime } from '../../utils/formatters';

export function ReconcileScreen() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { socket } = useSocket();

  const [location, setLocation] = useState('Shop');
  const [systemStock, setSystemStock] = useState([]);
  const [countedInputs, setCountedInputs] = useState({});
  const [auditNote, setAuditNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  // Preview & Explanation Data
  const [previewData, setPreviewData] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});

  // Past posted audits list
  const [pastAudits, setPastAudits] = useState([]);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'

  const loadStock = async () => {
    try {
      setLoading(true);
      const [stockData, audits] = await Promise.all([
        api.getSystemStock(location),
        api.getCounts(location),
      ]);

      setSystemStock(stockData || []);
      setPastAudits(audits || []);

      // Initialize counted inputs with current system stock
      const initialCounts = {};
      (stockData || []).forEach((item) => {
        initialCounts[item._id] = item.systemQtyDisplay.toString();
      });
      setCountedInputs(initialCounts);
      setPreviewData(null);
    } catch (err) {
      toastError(err.message, 'Failed to load system stock for reconciliation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, [location]);

  // Listen to socket count/movement updates
  useEffect(() => {
    if (!socket) return;
    const handleCountUpdate = () => loadStock();
    socket.on('count:posted', handleCountUpdate);
    return () => socket.off('count:posted', handleCountUpdate);
  }, [socket, location]);

  const handleInputChange = (productId, val) => {
    setCountedInputs((prev) => ({
      ...prev,
      [productId]: val,
    }));
  };

  // Run audit variance comparison & fetch movement audit trail
  const handleCalculateVariances = async () => {
    const items = systemStock.map((item) => ({
      product: item._id,
      countedQty: parseFloat(countedInputs[item._id]) || 0,
    }));

    try {
      setLoading(true);
      const preview = await api.previewCount({ location, items });
      setPreviewData(preview);

      // Auto-expand any item with a discrepancy
      const expanded = {};
      preview.items.forEach((it) => {
        if (it.variance !== 0) {
          expanded[it.product._id] = true;
        }
      });
      setExpandedItems(expanded);
    } catch (err) {
      toastError(err.message, 'Failed to calculate variances');
    } finally {
      setLoading(false);
    }
  };

  // Post variances as adjustments (Single-use operation)
  const handlePostAdjustments = async () => {
    if (!previewData || previewData.items.length === 0) {
      toastWarning('Please calculate variances first');
      return;
    }

    const varianceCount = previewData.items.filter((i) => i.variance !== 0).length;
    if (varianceCount === 0) {
      toastSuccess('All physical counts match system stock. No adjustments needed!');
    }

    try {
      setPosting(true);
      const itemsToPost = previewData.items.map((i) => ({
        product: i.product._id,
        countedQty: i.countedQtyDisplay,
      }));

      await api.postCount({
        location,
        note: auditNote.trim() || `Physical stock audit reconciliation for ${location}`,
        items: itemsToPost,
      });

      toastSuccess(`Reconciliation posted successfully! Generated ${varianceCount} adjustment movements.`);
      setPreviewData(null);
      loadStock();
    } catch (err) {
      toastError(err.message, 'Posting reconciliation failed');
    } finally {
      setPosting(false);
    }
  };

  const toggleExpand = (productId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Location Switcher */}
      <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            <h2 className="font-display font-extrabold text-xl text-slate-900 dark:text-slate-100">
              Inventory Reconciliation & Audit
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Reconcile physical counts with recorded stock. The audit engine traces the movement history behind every variance and highlights unaccounted discrepancies.
          </p>
        </div>

        {/* Location selector & Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'new'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Active Count
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Past Audits ({pastAudits.length})
            </button>
          </div>

          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-slate-200"
          >
            <option value="Shop">Shop Counter</option>
            <option value="Storeroom">Storeroom / Backroom</option>
          </select>
        </div>
      </div>

      {activeTab === 'history' ? (
        /* Past Audits List */
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
            Historical Posted Audits for {location}
          </h3>

          {pastAudits.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No previous posted audits found for this location.
            </p>
          ) : (
            <div className="space-y-3">
              {pastAudits.map((audit) => (
                <div
                  key={audit._id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {audit.status}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {audit.note || 'Audit Session'}
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono">
                      {formatDateTime(audit.postedAt || audit.createdAt)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Reconciled {audit.items?.length || 0} items at location <span className="font-semibold">{audit.location}</span>.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Active Count & Reconciliation Workflow */
        <div className="space-y-6">
          {/* Step 1: Input Counted Quantities */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-850/50">
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Step 1: Enter Counted Quantities ({systemStock.length} Products in {location})
                </h3>
                <p className="text-[11px] text-slate-500">
                  System quantities are derived from the ledger. Modify any item where physical stock differs.
                </p>
              </div>

              <button
                onClick={handleCalculateVariances}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/25 flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Calculate Variances & Audit Ledger</span>
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Product Name</th>
                    <th className="py-2.5 px-4">SKU</th>
                    <th className="py-2.5 px-4">System Recorded Stock</th>
                    <th className="py-2.5 px-4">Physical Counted Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {systemStock.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{item.sku}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {item.systemQtyDisplay} {item.unit}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 max-w-[160px]">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={countedInputs[item._id] ?? ''}
                            onChange={(e) => handleInputChange(item._id, e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-right font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <span className="text-[11px] text-slate-400 font-medium">{item.unit}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 2: Variance Analysis & Movement Explanation */}
          {previewData && (
            <div className="glass-card p-6 space-y-6 border-brand-500/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Audit Breakdown & Historical Explanations</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Inspecting movements since {previewData.lastAuditDate ? formatDateTime(previewData.lastAuditDate) : 'initial store setup'}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {previewData.items.filter((i) => i.variance !== 0).length} Discrepancies Found
                  </span>
                </div>
              </div>

              {/* Discrepancy Breakdown Cards */}
              <div className="space-y-3">
                {previewData.items.map((it) => {
                  const hasVariance = it.variance !== 0;
                  const isExpanded = expandedItems[it.product._id];

                  return (
                    <div
                      key={it.product._id}
                      className={`p-4 rounded-xl border transition-all text-xs space-y-3 ${
                        hasVariance
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                          : 'bg-slate-50/30 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800'
                      }`}
                    >
                      <div
                        onClick={() => toggleExpand(it.product._id)}
                        className="flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{it.product.imageEmoji || '📦'}</span>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {it.product.name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">{it.product.sku}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">System Recorded</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {it.systemQtyDisplay} {it.product.unit}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Physical Counted</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {it.countedQtyDisplay} {it.product.unit}
                            </span>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <span className="text-[10px] text-slate-400 block">Variance</span>
                            <span
                              className={`font-bold text-sm ${
                                it.variance === 0
                                  ? 'text-emerald-600'
                                  : it.variance > 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {it.variance > 0 ? '+' : ''}
                              {it.varianceDisplay} {it.product.unit}
                            </span>
                          </div>

                          <button className="text-slate-400 hover:text-slate-600 p-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Explanation & Movement Trail */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2.5">
                          {/* Explanation banner */}
                          <div
                            className={`p-3 rounded-lg flex items-start gap-2 ${
                              hasVariance
                                ? 'bg-amber-100/60 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200'
                                : 'bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200'
                            }`}
                          >
                            {hasVariance ? (
                              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                            )}
                            <p className="text-xs leading-relaxed">{it.explanation}</p>
                          </div>

                          {/* Movements since last count */}
                          <div>
                            <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] mb-1.5">
                              Movements recorded at {location} since last count ({it.sinceLastCount?.length || 0}):
                            </p>
                            {it.sinceLastCount?.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">
                                Zero movements recorded since last count.
                              </p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {it.sinceLastCount?.map((m, mIdx) => (
                                  <div
                                    key={mIdx}
                                    className="p-2 rounded bg-white/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-slate-400">
                                        {formatDateTime(m.date)}
                                      </span>
                                      <span className="uppercase font-bold text-[10px] text-brand-600">
                                        {m.type}
                                      </span>
                                      <span className="text-slate-600 dark:text-slate-300">
                                        {m.note}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {m.changeDisplay}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* POST VARIANCES AS ADJUSTMENTS ACTION */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="Audit reason / session notes (e.g. End of month physical inventory count)"
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />

                <button
                  onClick={handlePostAdjustments}
                  disabled={posting}
                  className="px-6 py-3 rounded-xl font-display font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {posting ? 'Posting Adjustments...' : 'Post Variances as Adjustments (Once Only)'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export function StockStatusPill({ status }) {
  if (status === 'out_of_stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
        <ShieldAlert className="w-3.5 h-3.5" />
        Out of Stock
      </span>
    );
  }

  if (status === 'low_stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900 animate-pulse">
        <AlertCircle className="w-3.5 h-3.5" />
        Low Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
      <CheckCircle2 className="w-3.5 h-3.5" />
      In Stock
    </span>
  );
}

export function ProfitLossBadge({ amountPaise, showLabel = false }) {
  const isLoss = amountPaise < 0;
  const isZero = amountPaise === 0;

  if (isLoss) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
        <TrendingDown className="w-4 h-4 shrink-0" />
        <span>{formatCurrency(amountPaise)}</span>
        {showLabel && <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-100 dark:bg-rose-950 px-1 rounded">LOSS</span>}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${isZero ? 'text-slate-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
      {!isZero && <TrendingUp className="w-4 h-4 shrink-0" />}
      <span>{formatCurrency(amountPaise)}</span>
    </span>
  );
}

export function ConnectionPill({ status }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live Connected
      </span>
    );
  }

  if (status === 'reconnecting') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        Reconnecting...
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
      <span className="w-2 h-2 rounded-full bg-rose-500" />
      Offline
    </span>
  );
}

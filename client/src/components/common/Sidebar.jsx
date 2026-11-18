import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Package,
  ShoppingBag,
  LayoutDashboard,
  ArrowLeftRight,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Products', icon: Package, badge: null },
  { to: '/pos', label: 'POS Billing', icon: ShoppingBag, badge: 'Counter' },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { to: '/movements', label: 'Movements', icon: ArrowLeftRight, badge: 'Ledger' },
  { to: '/reconcile', label: 'Reconcile', icon: ClipboardCheck, badge: 'Audit' },
  { to: '/reports', label: 'Reports', icon: BarChart3, badge: null },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 min-h-[calc(100vh-61px)] shrink-0">
      <div className="space-y-1">
        <p className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-sm border border-brand-200/60 dark:border-brand-800/60'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 stroke-[2]" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent border border-brand-500/20">
          <p className="text-xs font-semibold text-brand-900 dark:text-brand-200">
            StockTrace FIFO Engine
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Exact multi-lot cost tracking & tamper-proof audit trail.
          </p>
        </div>
      </div>
    </aside>
  );
}

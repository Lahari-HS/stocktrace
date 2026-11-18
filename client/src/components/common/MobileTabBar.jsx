import React from 'react';
import { NavLink } from 'react-router-dom';
import { Package, ShoppingBag, LayoutDashboard, ArrowLeftRight, ClipboardCheck } from 'lucide-react';

const MOBILE_NAV = [
  { to: '/', label: 'Products', icon: Package },
  { to: '/pos', label: 'Billing', icon: ShoppingBag },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/movements', label: 'Ledger', icon: ArrowLeftRight },
  { to: '/reconcile', label: 'Audit', icon: ClipboardCheck },
];

export function MobileTabBar() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around">
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-brand-600 dark:text-brand-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

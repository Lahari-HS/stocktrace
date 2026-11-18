import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, PlusCircle, ShoppingBag, ArrowLeftRight, CheckSquare } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { ConnectionPill } from './StatusPill';

export function Header({ onOpenNewProduct, onOpenRestock }) {
  const { isDark, toggleTheme } = useTheme();
  const { status } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-brand-600 to-violet-600 dark:from-brand-400 dark:to-violet-400 bg-clip-text text-transparent">
                StockTrace
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                Audit & Billing
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Immutable movement ledger & FIFO reconciliation
            </p>
          </div>
        </div>

        {/* Right side controls: Connection, Quick Actions, Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ConnectionPill status={status} />

          {/* Quick POS Button */}
          {location.pathname !== '/pos' && (
            <button
              onClick={() => navigate('/pos')}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium text-xs bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/25 transition-all"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>POS Billing</span>
            </button>
          )}

          {/* Dark/Light mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle theme"
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
}

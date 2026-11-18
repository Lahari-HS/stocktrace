import React from 'react';

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 8, cols = 8 }) {
  return (
    <div className="space-y-3">
      <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-slate-50 dark:bg-slate-800/30 rounded-xl flex items-center gap-4 px-4 border border-slate-100 dark:border-slate-800"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className={`h-4 bg-slate-200 dark:bg-slate-700 rounded ${
                j === 0 ? 'w-36' : j === 1 ? 'w-24' : 'flex-1'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
}

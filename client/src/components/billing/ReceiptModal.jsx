import React from 'react';
import { X, Printer, CheckCircle2, Download, ArrowLeft } from 'lucide-react';
import { formatCurrency, formatQuantity, formatDateTime } from '../../utils/formatters';

export function ReceiptModal({ bill, onClose, onNewSale }) {
  if (!bill) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Modal Top Actions */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold text-sm">Bill Completed Successfully</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-mono" id="printable-receipt">
          {/* Shop Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <h2 className="font-display font-black text-xl tracking-wider text-slate-900 dark:text-slate-100 uppercase">
              StockTrace Mart
            </h2>
            <p className="text-[11px] text-slate-500">Inventory Movement & Retail Audit</p>
            <p className="text-[10px] text-slate-400">GSTIN: 29AAAAA0000A1Z5 • Helpline: 1800-00-STOCK</p>
          </div>

          {/* Bill Meta */}
          <div className="space-y-1 text-slate-600 dark:text-slate-400 pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span>Bill No:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{bill.billNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{formatDateTime(bill.createdAt || new Date())}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{bill.customerName || 'Walk-in'}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="uppercase font-bold text-brand-600">{bill.paymentMode}</span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1">
              <span className="col-span-6">Item</span>
              <span className="col-span-3 text-right">Qty</span>
              <span className="col-span-3 text-right">Amount</span>
            </div>

            {bill.lines?.map((line, idx) => {
              const prod = line.product || {};
              const unit = prod.unit || 'pcs';
              const lineTotal = line.allocations?.reduce(
                (acc, a) => acc + Math.round((a.quantity * line.unitPrice) / (unit === 'kg' || unit === 'litre' ? 1000 : 1)),
                0
              ) || (line.quantity * line.unitPrice) / (unit === 'kg' || unit === 'litre' ? 1000 : 1);

              return (
                <div key={idx} className="grid grid-cols-12 text-slate-800 dark:text-slate-200 text-[11px]">
                  <div className="col-span-6 truncate pr-1">
                    <p className="font-semibold truncate">{prod.name || 'Product'}</p>
                    <p className="text-[10px] text-slate-400 font-sans">
                      @{formatCurrency(line.unitPrice)}/{unit}
                    </p>
                  </div>
                  <span className="col-span-3 text-right">
                    {formatQuantity(line.quantity, unit)}
                  </span>
                  <span className="col-span-3 text-right font-semibold">
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Totals & Breakdown */}
          <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span>{formatCurrency(bill.subtotal)}</span>
            </div>
            {bill.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount:</span>
                <span>-{formatCurrency(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-800">
              <span>NET TOTAL:</span>
              <span className="font-display font-extrabold text-brand-600 dark:text-brand-400">
                {formatCurrency(bill.total)}
              </span>
            </div>

            {/* Shopkeeper profit snapshot (hidden in thermal receipt print via CSS if needed, but useful for audit) */}
            <div className="mt-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] flex justify-between print:hidden">
              <span>Recorded Profit on Sale:</span>
              <span className="font-bold">{formatCurrency(bill.profit)}</span>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center pt-3 text-[10px] text-slate-400 space-y-0.5 border-t border-dashed border-slate-300 dark:border-slate-700">
            <p>Thank you for shopping with us!</p>
            <p>Goods once sold can be returned with receipt within 7 days.</p>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <button
            onClick={onNewSale}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Next Customer</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import { formatCurrency } from '../lib/formatters';
import { sanitizeSymbol } from '../lib/validation';
import type { AlertCondition } from '../types/market';

interface AlertModalProps {
  open: boolean;
  presetSymbol?: string;
  presetPrice?: number;
  onClose: () => void;
}

export function AlertModal({
  open,
  presetSymbol,
  presetPrice,
  onClose,
}: AlertModalProps) {
  const { createAlert, quotes } = useStockSync();

  const [symbol, setSymbol] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const sym = presetSymbol || 'NVDA';
    setSymbol(sym);
    setCondition('above');
    const refPrice = presetPrice || quotes[sym]?.price || 100;
    setTargetPrice((refPrice * 1.05).toFixed(2));
    setNote('');
  }, [open, presetSymbol, presetPrice, quotes]);

  if (!open) return null;

  const liveQuote = quotes[symbol.trim().toUpperCase()];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSym = sanitizeSymbol(symbol);
    if (!cleanSym) {
      setError('Enter a valid ticker symbol.');
      return;
    }

    const parsedTarget = Number(targetPrice);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setError('Enter a target price greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await createAlert({
        symbol: cleanSym,
        condition,
        targetPrice: parsedTarget,
        note,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create alert.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create price alert"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-slate-100">
            Create Price Alert
          </h2>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          {error && (
            <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Ticker Symbol
              </label>
              {liveQuote && (
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Last: {formatCurrency(liveQuote.price)}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              maxLength={12}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="w-full px-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) =>
                  setCondition(e.target.value === 'below' ? 'below' : 'above')
                }
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="above">Crosses above</option>
                <option value="below">Drops below</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Price (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Breakout level or trim target"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

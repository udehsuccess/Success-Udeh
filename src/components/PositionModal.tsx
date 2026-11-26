import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import { sanitizeSymbol } from '../lib/validation';
import type { HoldingDoc } from '../types/market';

interface PositionModalProps {
  open: boolean;
  editingHolding: HoldingDoc | null;
  presetSymbol?: string;
  presetCompany?: string;
  presetPrice?: number;
  onClose: () => void;
}

export function PositionModal({
  open,
  editingHolding,
  presetSymbol,
  presetCompany,
  presetPrice,
  onClose,
}: PositionModalProps) {
  const { addHolding, updateHolding, quotes } = useStockSync();

  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingHolding) {
      setSymbol(editingHolding.symbol);
      setCompanyName(editingHolding.companyName);
      setShares(String(editingHolding.shares));
      setAvgCost(String(editingHolding.avgCost));
      setNotes(editingHolding.notes);
    } else {
      setSymbol(presetSymbol || '');
      setCompanyName(presetCompany || '');
      setShares('10');
      setAvgCost(presetPrice ? presetPrice.toFixed(2) : '');
      setNotes('');
    }
  }, [open, editingHolding, presetSymbol, presetCompany, presetPrice]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedShares = Number(shares);
    const parsedCost = Number(avgCost);
    if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
      setError('Enter a valid share quantity greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setError('Enter a valid average cost per share.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingHolding) {
        await updateHolding(editingHolding.id, {
          shares: parsedShares,
          avgCost: parsedCost,
          notes,
        });
      } else {
        const cleanSym = sanitizeSymbol(symbol);
        if (!cleanSym) {
          setError('Enter a valid ticker symbol (letters, digits, dot, or dash).');
          setSubmitting(false);
          return;
        }
        const resolvedName =
          companyName.trim() || quotes[cleanSym]?.name || cleanSym;
        await addHolding({
          symbol: cleanSym,
          companyName: resolvedName,
          shares: parsedShares,
          avgCost: parsedCost,
          notes,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save position.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editingHolding ? 'Edit portfolio position' : 'Log portfolio position'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-slate-100">
            {editingHolding ? `Edit ${editingHolding.symbol} Position` : 'Log Stock Position'}
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

          {!editingHolding && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ticker Symbol
                </label>
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
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Shares
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Avg Cost (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Investment thesis or lot details..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
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
              {submitting ? 'Saving...' : editingHolding ? 'Save Changes' : 'Save Position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import { searchTickers } from '../lib/marketClient';
import type { StockSearchResult } from '../types/market';

interface TickerSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export function TickerSearchModal({
  open,
  onClose,
  onSelectSymbol,
}: TickerSearchModalProps) {
  const { activeWatchlist, addSymbolToWatchlist } = useStockSync();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchTickers(query, controller.signal)
        .then((res) => {
          setResults(res);
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const watchedSet = new Set(activeWatchlist?.symbols || []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search and add stock ticker"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 backdrop-blur-[2px] pt-16 sm:pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol or company (e.g. NVDA, Apple, SPY)..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading && results.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Searching market universe...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching tickers found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            results.map((item) => {
              const isWatched = watchedSet.has(item.symbol);
              return (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSymbol(item.symbol);
                      onClose();
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {item.symbol}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {item.exchange} · {item.sector} · {item.type}
                    </div>
                  </button>

                  {activeWatchlist && (
                    <button
                      type="button"
                      disabled={isWatched}
                      onClick={() => void addSymbolToWatchlist(activeWatchlist.id, item.symbol)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        isWatched
                          ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 cursor-default'
                          : 'text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/60'
                      }`}
                    >
                      {isWatched ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Watch
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

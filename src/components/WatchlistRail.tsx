import { Plus, Trash2 } from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { Sparkline } from './Sparkline';

interface WatchlistRailProps {
  onOpenSearch: () => void;
}

export function WatchlistRail({ onOpenSearch }: WatchlistRailProps) {
  const {
    watchlists,
    activeWatchlist,
    setActiveWatchlistId,
    quotes,
    selectedSymbol,
    selectSymbol,
    removeSymbolFromWatchlist,
  } = useStockSync();

  const symbols = activeWatchlist?.symbols || [];

  return (
    <aside
      aria-label="Active watchlist"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-full"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="rail-watchlist-select" className="sr-only">
            Select watchlist
          </label>
          <select
            id="rail-watchlist-select"
            value={activeWatchlist?.id || ''}
            onChange={(e) => void setActiveWatchlistId(e.target.value)}
            className="w-full bg-transparent text-sm font-display font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer truncate pr-2"
          >
            {watchlists.map((wl) => (
              <option
                key={wl.id}
                value={wl.id}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                {wl.name} ({wl.symbols.length})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {symbols.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            No tickers in this list
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Add stocks to track live quotes and sync across all your devices.
          </p>
          <button
            type="button"
            onClick={onOpenSearch}
            className="mt-4 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
          >
            Add First Ticker
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto flex-1 max-h-[540px]">
          {symbols.map((sym) => {
            const q = quotes[sym];
            const isSelected = selectedSymbol === sym;
            const isUp = (q?.change ?? 0) >= 0;

            return (
              <li
                key={sym}
                className={`group flex items-center justify-between gap-2 px-4 py-3 transition-colors ${
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/35'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void selectSymbol(sym)}
                  className="flex items-center justify-between gap-3 flex-1 min-w-0 text-left focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {sym}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                      {q?.name || 'Loading...'}
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <Sparkline
                      data={q?.sparkline || []}
                      positive={isUp}
                      width={54}
                      height={20}
                      label={`${sym} sparkline`}
                    />
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                      {q ? formatCurrency(q.price) : '—'}
                    </div>
                    <div
                      className={`text-xs font-mono tabular-nums ${
                        isUp
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {q ? `${isUp ? '▲' : '▼'} ${formatPercent(q.changePercent)}` : '—'}
                    </div>
                  </div>
                </button>

                {activeWatchlist && (
                  <button
                    type="button"
                    aria-label={`Remove ${sym} from ${activeWatchlist.name}`}
                    onClick={() => void removeSymbolFromWatchlist(activeWatchlist.id, sym)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

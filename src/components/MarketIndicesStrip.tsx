import { useStockSync } from '../context/StockSyncContext';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { Sparkline } from './Sparkline';

const INDICES = [
  { symbol: 'SPY', title: 'S&P 500' },
  { symbol: 'QQQ', title: 'Nasdaq 100' },
  { symbol: 'DIA', title: 'Dow Jones' },
  { symbol: 'IWM', title: 'Russell 2000' },
];

export function MarketIndicesStrip() {
  const { quotes, selectedSymbol, selectSymbol } = useStockSync();

  return (
    <section
      aria-label="Market benchmarks"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden"
    >
      {INDICES.map((item) => {
        const q = quotes[item.symbol];
        const isSelected = selectedSymbol === item.symbol;
        const isUp = (q?.change ?? 0) >= 0;

        return (
          <button
            key={item.symbol}
            type="button"
            onClick={() => void selectSymbol(item.symbol)}
            className={`text-left px-5 py-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
              isSelected
                ? 'bg-slate-50 dark:bg-slate-800/70'
                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {item.title}
                  </span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {item.symbol}
                  </span>
                </div>
                {q ? (
                  <div className="mt-1.5 flex items-baseline gap-2.5">
                    <span className="text-lg font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {formatCurrency(q.price)}
                    </span>
                    <span
                      className={`text-xs font-mono font-medium tabular-nums ${
                        isUp
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {isUp ? '▲' : '▼'} {formatPercent(q.changePercent)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 h-6 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                )}
              </div>
              <div className="pt-1">
                <Sparkline
                  data={q?.sparkline || []}
                  positive={isUp}
                  width={68}
                  height={26}
                  label={`${item.title} intraday trend`}
                />
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}

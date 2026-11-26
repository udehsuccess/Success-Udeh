import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BellPlus, Briefcase, Check, Plus } from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatVolume,
} from '../lib/formatters';
import { fetchStockChart } from '../lib/marketClient';
import type { ChartPoint, TimeRange } from '../types/market';

const TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

interface StockChartPanelProps {
  onOpenAddPosition: (symbol: string, companyName: string, price: number) => void;
  onOpenCreateAlert: (symbol: string, price: number) => void;
}

export function StockChartPanel({
  onOpenAddPosition,
  onOpenCreateAlert,
}: StockChartPanelProps) {
  const {
    selectedSymbol,
    quotes,
    activeWatchlist,
    addSymbolToWatchlist,
    removeSymbolFromWatchlist,
    theme,
  } = useStockSync();

  const [range, setRange] = useState<TimeRange>('1M');
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const quote = quotes[selectedSymbol];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchStockChart(selectedSymbol, range, controller.signal)
      .then((res) => {
        setPoints(res.points);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load chart');
        setLoading(false);
      });

    return () => controller.abort();
  }, [selectedSymbol, range]);

  const isInActiveWatchlist = Boolean(
    activeWatchlist?.symbols.includes(selectedSymbol)
  );

  const periodStats = useMemo(() => {
    if (points.length < 2) {
      return {
        delta: quote?.change ?? 0,
        deltaPct: quote?.changePercent ?? 0,
        minVal: quote?.dayLow ?? 0,
        maxVal: quote?.dayHigh ?? 0,
        baseline: quote?.previousClose ?? 0,
      };
    }
    const first = points[0].close;
    const last = quote?.price ?? points[points.length - 1].close;
    const delta = last - first;
    const deltaPct = first > 0 ? (delta / first) * 100 : 0;
    const lows = points.map((p) => p.low);
    const highs = points.map((p) => p.high);
    return {
      delta,
      deltaPct,
      minVal: Math.min(...lows),
      maxVal: Math.max(...highs),
      baseline: range === '1D' && quote ? quote.previousClose : first,
    };
  }, [points, quote, range]);

  const isPositive =
    range === '1D' ? (quote?.change ?? 0) >= 0 : periodStats.delta >= 0;

  const strokeColor = isPositive
    ? theme === 'dark'
      ? '#34D399'
      : '#15803D'
    : theme === 'dark'
      ? '#F87171'
      : '#DC2626';

  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  const range52Pct = useMemo(() => {
    if (!quote) return 50;
    const span = quote.week52High - quote.week52Low;
    if (span <= 0) return 50;
    return Math.min(100, Math.max(0, ((quote.price - quote.week52Low) / span) * 100));
  }, [quote]);

  const handleToggleWatchlist = () => {
    if (!activeWatchlist) return;
    if (isInActiveWatchlist) {
      void removeSymbolFromWatchlist(activeWatchlist.id, selectedSymbol);
    } else {
      void addSymbolToWatchlist(activeWatchlist.id, selectedSymbol);
    }
  };

  return (
    <section
      aria-label={`${selectedSymbol} market detail and chart`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col"
    >
      {/* Ticker Header */}
      <div className="p-6 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {selectedSymbol}
              </span>
              <span aria-hidden="true">·</span>
              <span>{quote?.exchange || 'US Market'}</span>
              <span aria-hidden="true">·</span>
              <span>{quote?.sector || 'Equities'}</span>
            </div>

            <h1 className="mt-1 text-2xl font-display font-semibold tracking-tight text-slate-900 dark:text-slate-50 truncate">
              {quote?.name || selectedSymbol}
            </h1>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-mono font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                {quote ? formatCurrency(quote.price) : '—'}
              </span>
              {quote && (
                <span
                  className={`text-sm font-mono font-medium tabular-nums ${
                    isPositive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {isPositive ? '▲' : '▼'}{' '}
                  {formatSignedCurrency(
                    range === '1D' ? quote.change : periodStats.delta
                  )}{' '}
                  ({formatPercent(range === '1D' ? quote.changePercent : periodStats.deltaPct)})
                </span>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {range === '1D' ? 'Today' : `Past ${range}`}
              </span>
            </div>
          </div>

          {/* Direct Equity Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeWatchlist && (
              <button
                type="button"
                onClick={handleToggleWatchlist}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isInActiveWatchlist
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {isInActiveWatchlist ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    In {activeWatchlist.name}
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Watch
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onOpenAddPosition(
                  selectedSymbol,
                  quote?.name || selectedSymbol,
                  quote?.price || 100
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Briefcase className="w-3.5 h-3.5" />
              Log Position
            </button>

            <button
              type="button"
              onClick={() => onOpenCreateAlert(selectedSymbol, quote?.price || 100)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <BellPlus className="w-3.5 h-3.5" />
              Set Alert
            </button>
          </div>
        </div>

        {/* Timeframe Segmented Controls */}
        <div className="mt-5 flex items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Chart timeframe"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg"
          >
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  range === r
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>
              Low {periodStats.minVal > 0 ? formatCurrency(periodStats.minVal) : '—'}
            </span>
            <span aria-hidden="true">/</span>
            <span>
              High {periodStats.maxVal > 0 ? formatCurrency(periodStats.maxVal) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Recharts Canvas */}
      <div className="px-4 pt-5 pb-3 h-[310px] w-full">
        {loading && points.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="w-full h-56 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
          </div>
        ) : error ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-sm text-slate-500 dark:text-slate-400 gap-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRange((prev) => prev)}
              className="text-blue-700 dark:text-blue-400 font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="kestrelPriceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={gridColor}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: axisColor, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
                minTickGap={34}
              />
              <YAxis
                orientation="right"
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: axisColor, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(val: number) => `$${val.toFixed(val >= 100 ? 0 : 2)}`}
              />
              {periodStats.baseline > 0 && (
                <ReferenceLine
                  y={periodStats.baseline}
                  stroke={axisColor}
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
              )}
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const pt = payload[0].payload as ChartPoint;
                  return (
                    <div className="bg-slate-900 dark:bg-slate-800 text-slate-50 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs shadow-lg">
                      <div className="font-medium text-slate-300 mb-1.5">
                        {pt.label}
                      </div>
                      <div className="grid grid-cols-2 gap-x-5 gap-y-1 font-mono tabular-nums">
                        <span className="text-slate-400">Close</span>
                        <span className="text-right font-semibold">
                          {formatCurrency(pt.close)}
                        </span>
                        <span className="text-slate-400">Open</span>
                        <span className="text-right">{formatCurrency(pt.open)}</span>
                        <span className="text-slate-400">High</span>
                        <span className="text-right">{formatCurrency(pt.high)}</span>
                        <span className="text-slate-400">Low</span>
                        <span className="text-right">{formatCurrency(pt.low)}</span>
                        <span className="text-slate-400">Vol</span>
                        <span className="text-right">{formatVolume(pt.volume)}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#kestrelPriceFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Key Fundamentals Hairline Strip */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Market Cap</div>
          <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {quote ? formatCurrency(quote.marketCap, true) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">P/E Ratio</div>
          <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {quote?.peRatio != null ? quote.peRatio.toFixed(1) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">EPS (TTM)</div>
          <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {quote?.eps != null ? formatCurrency(quote.eps) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Volume</div>
          <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {quote ? formatVolume(quote.volume) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Div Yield</div>
          <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {quote?.dividendYield != null ? `${quote.dividendYield.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">52-Week Range</div>
          {quote ? (
            <div className="mt-1.5 space-y-1">
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                  style={{ width: `${range52Pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>{formatCurrency(quote.week52Low)}</span>
                <span>{formatCurrency(quote.week52High)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm font-mono text-slate-400">—</div>
          )}
        </div>
      </div>
    </section>
  );
}

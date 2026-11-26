import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Download,
  Laptop,
  Lock,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import {
  fetchAnalyticsSummary,
  resetSiteAnalytics,
} from '../lib/analyticsClient';
import { formatRelativeTime } from '../lib/formatters';
import type { AnalyticsSummary } from '../types/market';

interface AnalyticsViewProps {
  onSelectAndInspect: (symbol: string) => void;
}

export function AnalyticsView({ onSelectAndInspect }: AnalyticsViewProps) {
  const { user, theme, signInWithGoogle } = useStockSync();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!user) {
      setSummary(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAnalyticsSummary();
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSummary();
    if (!user) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadSummary();
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, [user, loadSummary]);

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      await resetSiteAnalytics();
      setConfirmReset(false);
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset analytics.');
    } finally {
      setResetting(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!summary) return;
    const headers = ['Date', 'Unique Visitors', 'Visits', 'Interactions'];
    const rows = [
      headers.join(','),
      ...summary.dailyTrend.map((d) =>
        [d.date, d.uniqueVisitors, d.visits, d.interactions].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stockbeats-traffic-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  if (!user) {
    return (
      <section
        aria-label="Website analytics access"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 max-w-xl mx-auto text-center space-y-4"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100">
            Owner Traffic Analytics
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Visitor counts, live active users, device breakdowns, and top tracked tickers are recorded automatically by the backend and protected for the site administrator.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors"
        >
          Sign in with Google
        </button>
      </section>
    );
  }

  if (error && !summary) {
    return (
      <section
        aria-label="Website analytics restricted"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 max-w-xl mx-auto text-center space-y-4"
      >
        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100">
            Administrator Access Required
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadSummary()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </section>
    );
  }

  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const maxSymbolViews = summary?.topSymbols[0]?.views || 1;

  return (
    <section aria-label="Website traffic analytics" className="space-y-6">
      {/* Toolbar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Website Traffic &amp; Usage
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {summary
              ? `Tracking since ${new Date(summary.trackingSince).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })} · Updated ${formatRelativeTime(summary.updatedAt)}`
              : 'Loading backend traffic records...'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!summary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>

          {confirmReset ? (
            <div className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-2.5 py-1">
              <span className="text-xs text-red-700 dark:text-red-300">Clear all counts?</span>
              <button
                type="button"
                disabled={resetting}
                onClick={() => void handleReset()}
                className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline px-1"
              >
                {resetting ? 'Clearing...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Stats
            </button>
          )}
        </div>
      </div>

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Unique Visitors
          </div>
          <div className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
            {summary ? summary.uniqueVisitors.toLocaleString('en-US') : '—'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Distinct people tracked
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Active Right Now
          </div>
          <div className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {summary ? summary.activeNow.toLocaleString('en-US') : '—'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Active in last 2 minutes
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Visits
          </div>
          <div className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
            {summary ? summary.totalVisits.toLocaleString('en-US') : '—'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {summary ? `${summary.signedInVisitorsToday} signed-in in last 24h` : 'Sessions recorded'}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Interactions
          </div>
          <div className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
            {summary ? summary.totalInteractions.toLocaleString('en-US') : '—'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Chart &amp; section views
          </div>
        </div>
      </div>

      {/* 14-Day Daily Visitors & Visits Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              14-Day Visitor Trend
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily unique visitors and total sessions
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
              Unique Visitors
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-600" />
              Visits
            </span>
          </div>
        </div>

        <div className="h-[240px] w-full">
          {summary ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.dailyTrend}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisColor, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: axisColor, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: theme === 'dark' ? 'rgba(30,41,59,0.5)' : 'rgba(241,245,249,0.8)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0].payload as AnalyticsSummary['dailyTrend'][number];
                    return (
                      <div className="bg-slate-900 dark:bg-slate-800 text-slate-50 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs shadow-lg">
                        <div className="font-medium text-slate-300 mb-1.5">{row.date}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono tabular-nums">
                          <span className="text-slate-400">Unique</span>
                          <span className="text-right font-semibold">{row.uniqueVisitors}</span>
                          <span className="text-slate-400">Visits</span>
                          <span className="text-right">{row.visits}</span>
                          <span className="text-slate-400">Events</span>
                          <span className="text-right">{row.interactions}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="uniqueVisitors"
                  fill="#2563EB"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="visits"
                  fill={theme === 'dark' ? '#475569' : '#CBD5E1'}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
          )}
        </div>
      </div>

      {/* Breakdown Row: Top Viewed Tickers + Device & Section Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              Top Inspected Tickers
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Chart views across all visitors
            </span>
          </div>

          {!summary || summary.topSymbols.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              Ticker views will appear here as people inspect stock charts.
            </p>
          ) : (
            <ul className="space-y-3">
              {summary.topSymbols.map((item) => (
                <li key={item.symbol} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => onSelectAndInspect(item.symbol)}
                      className="font-mono font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      {item.symbol}
                    </button>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {item.views} {item.views === 1 ? 'view' : 'views'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                      style={{ width: `${Math.max(6, (item.views / maxSymbolViews) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              Device Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Unique visitors by screen form factor
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(summary?.deviceBreakdown || []).map((row) => {
              const Icon =
                row.device === 'mobile'
                  ? Smartphone
                  : row.device === 'tablet'
                    ? Tablet
                    : Laptop;
              return (
                <div
                  key={row.device}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="inline-flex items-center gap-2.5 capitalize text-slate-700 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-slate-400" />
                    {row.device}
                  </div>
                  <div className="flex items-center gap-3 font-mono tabular-nums text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.count}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 w-12 text-right">
                      {row.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Section Usage
            </h3>
            {!summary || summary.tabUsage.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No section navigation recorded yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                {summary.tabUsage.map((t) => (
                  <div key={t.tab} className="flex items-center justify-between">
                    <span className="capitalize text-slate-700 dark:text-slate-300">
                      {t.tab}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {t.views}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Visitor Activity Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              Recent Visitor Activity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest anonymized visitor sessions and interactions recorded by the backend
            </p>
          </div>
        </div>

        {!summary || summary.recentActivity.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No visitor events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Visitor</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Device</th>
                  <th className="py-3 px-4 hidden md:table-cell">Session</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {summary.recentActivity.map((ev) => (
                  <tr
                    key={`${ev.id}_${ev.timestamp}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {ev.visitorKey}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      {ev.eventType === 'visit'
                        ? 'Website visit'
                        : ev.eventType === 'symbol_view'
                          ? 'Viewed ticker'
                          : 'Opened section'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-900 dark:text-slate-100 capitalize">
                      {ev.target}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                      {ev.deviceLabel}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                      {ev.isSignedIn ? 'Signed-in' : 'Guest'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {formatRelativeTime(ev.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

import { useMemo } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import {
  formatCurrency,
  formatPercent,
  formatShares,
  formatSignedCurrency,
} from '../lib/formatters';
import type { HoldingDoc } from '../types/market';

interface PortfolioViewProps {
  compact?: boolean;
  onSelectAndInspect: (symbol: string) => void;
  onOpenAddPosition: (symbol?: string, companyName?: string, price?: number) => void;
  onOpenEditPosition: (holding: HoldingDoc) => void;
}

const ALLOCATION_COLORS = [
  'bg-blue-600',
  'bg-slate-700 dark:bg-slate-400',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-teal-600',
];

export function PortfolioView({
  compact = false,
  onSelectAndInspect,
  onOpenAddPosition,
  onOpenEditPosition,
}: PortfolioViewProps) {
  const { holdings, quotes, deleteHolding } = useStockSync();

  const enriched = useMemo(() => {
    const items = holdings.map((h) => {
      const q = quotes[h.symbol];
      const price = q?.price ?? h.avgCost;
      const marketValue = h.shares * price;
      const costBasis = h.shares * h.avgCost;
      const totalGain = marketValue - costBasis;
      const totalGainPct = costBasis > 0 ? (totalGain / costBasis) * 100 : 0;
      const dayGain = h.shares * (q?.change ?? 0);
      return {
        ...h,
        price,
        marketValue,
        costBasis,
        totalGain,
        totalGainPct,
        dayGain,
        dayChangePct: q?.changePercent ?? 0,
        sector: q?.sector ?? 'Equities',
      };
    });

    const totalValue = items.reduce((sum, i) => sum + i.marketValue, 0);
    const totalCost = items.reduce((sum, i) => sum + i.costBasis, 0);
    const totalReturn = totalValue - totalCost;
    const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
    const totalDayGain = items.reduce((sum, i) => sum + i.dayGain, 0);
    const prevValue = totalValue - totalDayGain;
    const totalDayPct = prevValue > 0 ? (totalDayGain / prevValue) * 100 : 0;

    return {
      items: items.map((i) => ({
        ...i,
        weight: totalValue > 0 ? (i.marketValue / totalValue) * 100 : 0,
      })),
      totalValue,
      totalCost,
      totalReturn,
      totalReturnPct,
      totalDayGain,
      totalDayPct,
    };
  }, [holdings, quotes]);

  const escapeCsvCell = (value: string | number): string => {
    const str = String(value);
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    if (/[",\n\r]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };

  const handleDownloadCsv = () => {
    if (enriched.items.length === 0) return;

    const headers = [
      'Symbol',
      'Company',
      'Sector',
      'Shares',
      'Avg Cost (USD)',
      'Cost Basis (USD)',
      'Last Price (USD)',
      'Market Value (USD)',
      'Day P&L (USD)',
      'Day Change (%)',
      'Total P&L (USD)',
      'Total Return (%)',
      'Allocation (%)',
      'Notes',
    ];

    const holdingRows = enriched.items.map((item) =>
      [
        escapeCsvCell(item.symbol),
        escapeCsvCell(item.companyName),
        escapeCsvCell(item.sector),
        item.shares,
        item.avgCost.toFixed(2),
        item.costBasis.toFixed(2),
        item.price.toFixed(2),
        item.marketValue.toFixed(2),
        item.dayGain.toFixed(2),
        item.dayChangePct.toFixed(2),
        item.totalGain.toFixed(2),
        item.totalGainPct.toFixed(2),
        item.weight.toFixed(2),
        escapeCsvCell(item.notes),
      ].join(',')
    );

    const summaryRow = [
      'TOTAL',
      escapeCsvCell('Portfolio Summary'),
      '',
      '',
      '',
      enriched.totalCost.toFixed(2),
      '',
      enriched.totalValue.toFixed(2),
      enriched.totalDayGain.toFixed(2),
      enriched.totalDayPct.toFixed(2),
      enriched.totalReturn.toFixed(2),
      enriched.totalReturnPct.toFixed(2),
      '100.00',
      '',
    ].join(',');

    const csvContent = [headers.join(','), ...holdingRows, summaryRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stockbeats-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const dayPositive = enriched.totalDayGain >= 0;
  const totalPositive = enriched.totalReturn >= 0;

  return (
    <section aria-label="Portfolio holdings" className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Portfolio Value
          </div>
          <div className="mt-1.5 text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(enriched.totalValue)}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Day&apos;s P&amp;L
          </div>
          <div
            className={`mt-1.5 text-xl font-mono font-semibold tabular-nums ${
              dayPositive
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {dayPositive ? '▲' : '▼'} {formatSignedCurrency(enriched.totalDayGain)}
          </div>
          <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {formatPercent(enriched.totalDayPct)} today
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Unrealized Return
          </div>
          <div
            className={`mt-1.5 text-xl font-mono font-semibold tabular-nums ${
              totalPositive
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {totalPositive ? '▲' : '▼'} {formatSignedCurrency(enriched.totalReturn)}
          </div>
          <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {formatPercent(enriched.totalReturnPct)} all time
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Cost Basis · Positions
          </div>
          <div className="mt-1.5 text-xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(enriched.totalCost)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {enriched.items.length} active {enriched.items.length === 1 ? 'lot' : 'lots'}
          </div>
        </div>
      </div>

      {/* Allocation Bar (Full Portfolio view) */}
      {!compact && enriched.items.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              Position Allocation
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Weighted by live market value
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
            {enriched.items.map((item, idx) => (
              <div
                key={item.id}
                style={{ width: `${item.weight}%` }}
                title={`${item.symbol}: ${item.weight.toFixed(1)}%`}
                className={`${ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]} h-full transition-all duration-200`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {enriched.items.map((item, idx) => (
              <div key={item.id} className="inline-flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-xs ${ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]}`}
                />
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {item.symbol}
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {item.weight.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Positions Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              Portfolio Holdings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time valuation synced across your devices
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={enriched.items.length === 0}
              title={
                enriched.items.length === 0
                  ? 'Add at least one position to download CSV'
                  : 'Download holdings and performance data as CSV'
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => onOpenAddPosition()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Position
            </button>
          </div>
        </div>

        {enriched.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              No positions logged yet
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Record your stock shares and cost basis to track live unrealized P&amp;L across every device.
            </p>
            <button
              type="button"
              onClick={() => onOpenAddPosition()}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors"
            >
              Log First Position
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Ticker</th>
                  <th className="py-3 px-4 text-right">Shares</th>
                  <th className="py-3 px-4 text-right">Avg Cost</th>
                  <th className="py-3 px-4 text-right">Last Price</th>
                  <th className="py-3 px-4 text-right">Market Value</th>
                  <th className="py-3 px-4 text-right">Total P&amp;L</th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">Weight</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {enriched.items.map((item) => {
                  const isGain = item.totalGain >= 0;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectAndInspect(item.symbol)}
                          className="text-left group"
                        >
                          <div className="font-mono font-semibold text-blue-700 dark:text-blue-400 group-hover:underline">
                            {item.symbol}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {item.companyName}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {formatShares(item.shares)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatCurrency(item.avgCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.marketValue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div
                          className={`font-medium ${
                            isGain
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {isGain ? '▲' : '▼'} {formatSignedCurrency(item.totalGain)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatPercent(item.totalGainPct)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 hidden md:table-cell">
                        {item.weight.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            aria-label={`Edit ${item.symbol} position`}
                            onClick={() => onOpenEditPosition(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${item.symbol} position`}
                            onClick={() => void deleteHolding(item.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

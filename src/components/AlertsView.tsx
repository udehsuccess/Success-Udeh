import { useMemo, useState } from 'react';
import {
  Bell,
  BellPlus,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import { formatCurrency } from '../lib/formatters';
import type { AlertStatus } from '../types/market';

interface AlertsViewProps {
  onSelectAndInspect: (symbol: string) => void;
  onOpenCreateAlert: (symbol?: string, price?: number) => void;
}

export function AlertsView({
  onSelectAndInspect,
  onOpenCreateAlert,
}: AlertsViewProps) {
  const { alerts, quotes, updateAlertStatus, deleteAlert } = useStockSync();
  const [filter, setFilter] = useState<'all' | AlertStatus>('all');

  const counts = useMemo(
    () => ({
      all: alerts.length,
      active: alerts.filter((a) => a.status === 'active').length,
      triggered: alerts.filter((a) => a.status === 'triggered').length,
      dismissed: alerts.filter((a) => a.status === 'dismissed').length,
    }),
    [alerts]
  );

  const visibleAlerts = useMemo(() => {
    const filtered =
      filter === 'all' ? alerts : alerts.filter((a) => a.status === filter);
    const rank: Record<AlertStatus, number> = {
      triggered: 0,
      active: 1,
      dismissed: 2,
    };
    return [...filtered].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [alerts, filter]);

  return (
    <section aria-label="Price alerts" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter alerts by status"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg self-start"
        >
          {(['all', 'triggered', 'active', 'dismissed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filter === tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap ${
                filter === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab} ({counts[tab]})
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenCreateAlert()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <BellPlus className="w-3.5 h-3.5" />
          New Price Alert
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {visibleAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
              {filter === 'all' ? 'No price alerts configured' : `No ${filter} alerts`}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Price alerts evaluate live market quotes and sync triggered states immediately across all your devices.
            </p>
            {filter === 'all' && (
              <button
                type="button"
                onClick={() => onOpenCreateAlert()}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors"
              >
                Create First Alert
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Ticker</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4 text-right">Target Price</th>
                  <th className="py-3 px-4 text-right">Current Price</th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">Distance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {visibleAlerts.map((alert) => {
                  const q = quotes[alert.symbol];
                  const distancePct =
                    q && q.price > 0
                      ? ((alert.targetPrice - q.price) / q.price) * 100
                      : null;

                  return (
                    <tr
                      key={alert.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectAndInspect(alert.symbol)}
                          className="text-left"
                        >
                          <div className="font-mono font-semibold text-blue-700 dark:text-blue-400 hover:underline">
                            {alert.symbol}
                          </div>
                          {alert.note && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                              {alert.note}
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {alert.condition === 'above' ? 'Crosses above' : 'Drops below'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(alert.targetPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {q ? formatCurrency(q.price) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        {distancePct !== null
                          ? `${distancePct >= 0 ? '+' : ''}${distancePct.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {alert.status === 'triggered' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Triggered
                          </span>
                        )}
                        {alert.status === 'active' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <Clock className="w-3.5 h-3.5" />
                            Monitoring
                          </span>
                        )}
                        {alert.status === 'dismissed' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <XCircle className="w-3.5 h-3.5" />
                            Dismissed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {alert.status === 'triggered' && (
                            <button
                              type="button"
                              title="Re-arm alert"
                              onClick={() => void updateAlertStatus(alert.id, 'active')}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Re-arm
                            </button>
                          )}
                          {alert.status !== 'dismissed' && (
                            <button
                              type="button"
                              title="Dismiss alert"
                              onClick={() => void updateAlertStatus(alert.id, 'dismissed')}
                              className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Dismiss
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Delete alert for ${alert.symbol}`}
                            onClick={() => void deleteAlert(alert.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
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

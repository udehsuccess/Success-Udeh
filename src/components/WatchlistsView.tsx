import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BellPlus,
  Briefcase,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import {
  formatCurrency,
  formatPercent,
  formatVolume,
} from '../lib/formatters';
import { Sparkline } from './Sparkline';

type SortField = 'symbol' | 'price' | 'changePercent' | 'marketCap' | 'peRatio' | 'volume';

interface WatchlistsViewProps {
  onOpenSearch: () => void;
  onSelectAndInspect: (symbol: string) => void;
  onOpenAddPosition: (symbol: string, companyName: string, price: number) => void;
  onOpenCreateAlert: (symbol: string, price: number) => void;
}

export function WatchlistsView({
  onOpenSearch,
  onSelectAndInspect,
  onOpenAddPosition,
  onOpenCreateAlert,
}: WatchlistsViewProps) {
  const {
    watchlists,
    activeWatchlist,
    setActiveWatchlistId,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    removeSymbolFromWatchlist,
    quotes,
  } = useStockSync();

  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortAsc, setSortAsc] = useState(true);

  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'symbol');
    }
  };

  const rows = useMemo(() => {
    const symbols = activeWatchlist?.symbols || [];
    const lower = filterText.trim().toLowerCase();
    const filtered = symbols.filter((sym) => {
      if (!lower) return true;
      const q = quotes[sym];
      return (
        sym.toLowerCase().includes(lower) ||
        (q?.name.toLowerCase().includes(lower) ?? false) ||
        (q?.sector.toLowerCase().includes(lower) ?? false)
      );
    });

    return filtered.sort((a, b) => {
      const qa = quotes[a];
      const qb = quotes[b];
      let cmp = 0;
      if (sortField === 'symbol') {
        cmp = a.localeCompare(b);
      } else if (sortField === 'price') {
        cmp = (qa?.price ?? 0) - (qb?.price ?? 0);
      } else if (sortField === 'changePercent') {
        cmp = (qa?.changePercent ?? 0) - (qb?.changePercent ?? 0);
      } else if (sortField === 'marketCap') {
        cmp = (qa?.marketCap ?? 0) - (qb?.marketCap ?? 0);
      } else if (sortField === 'peRatio') {
        cmp = (qa?.peRatio ?? 0) - (qb?.peRatio ?? 0);
      } else if (sortField === 'volume') {
        cmp = (qa?.volume ?? 0) - (qb?.volume ?? 0);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [activeWatchlist, filterText, quotes, sortField, sortAsc]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    await createWatchlist(newListName.trim(), []);
    setNewListName('');
    setCreatingList(false);
  };

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim()) {
      await renameWatchlist(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Watchlist Tabs & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {watchlists.map((wl) => {
            const isActive = activeWatchlist?.id === wl.id;
            const isRenaming = renamingId === wl.id;

            if (isRenaming) {
              return (
                <div
                  key={wl.id}
                  className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-blue-500 rounded-lg px-2 py-1"
                >
                  <input
                    type="text"
                    value={renameValue}
                    maxLength={60}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRenameSubmit(wl.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="w-36 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Save watchlist name"
                    onClick={() => void handleRenameSubmit(wl.id)}
                    className="p-1 text-emerald-600 hover:text-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel rename"
                    onClick={() => setRenamingId(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={wl.id}
                className={`inline-flex items-center rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void setActiveWatchlistId(wl.id)}
                  className="px-3.5 py-2 text-xs font-medium whitespace-nowrap"
                >
                  {wl.name}{' '}
                  <span className="font-mono opacity-70 ml-1">
                    {wl.symbols.length}
                  </span>
                </button>
                {isActive && (
                  <div className="flex items-center pr-1.5 gap-0.5">
                    <button
                      type="button"
                      aria-label={`Rename ${wl.name}`}
                      onClick={() => {
                        setRenamingId(wl.id);
                        setRenameValue(wl.name);
                      }}
                      className="p-1 opacity-75 hover:opacity-100 rounded"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {watchlists.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Delete ${wl.name}`}
                        onClick={() => void deleteWatchlist(wl.id)}
                        className="p-1 opacity-75 hover:opacity-100 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {creatingList ? (
            <form
              onSubmit={(e) => void handleCreateSubmit(e)}
              className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-blue-500 rounded-lg px-2.5 py-1"
            >
              <input
                type="text"
                placeholder="List name..."
                value={newListName}
                maxLength={60}
                autoFocus
                onChange={(e) => setNewListName(e.target.value)}
                className="w-36 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              <button
                type="submit"
                className="text-xs font-medium text-blue-700 dark:text-blue-400 px-1.5"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setCreatingList(false)}
                className="p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingList(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              New Watchlist
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter tickers..."
              aria-label="Filter tickers in watchlist"
              className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Ticker
          </button>
        </div>
      </div>

      {/* High-Density Equity Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {filterText ? 'No matching symbols found' : 'This watchlist is empty'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {filterText
                ? 'Try clearing your filter or search for a new ticker.'
                : 'Add equities or ETFs to track real-time prices across your devices.'}
            </p>
            {!filterText && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors"
              >
                Add First Ticker
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('symbol')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200"
                    >
                      Symbol
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Intraday</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('price')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 ml-auto"
                    >
                      Price
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('changePercent')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 ml-auto"
                    >
                      Day Change
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">
                    <button
                      type="button"
                      onClick={() => handleSort('marketCap')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 ml-auto"
                    >
                      Market Cap
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right hidden lg:table-cell">
                    <button
                      type="button"
                      onClick={() => handleSort('peRatio')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 ml-auto"
                    >
                      P/E
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right hidden xl:table-cell">
                    <button
                      type="button"
                      onClick={() => handleSort('volume')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 ml-auto"
                    >
                      Volume
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {rows.map((sym) => {
                  const q = quotes[sym];
                  const isUp = (q?.change ?? 0) >= 0;

                  return (
                    <tr
                      key={sym}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectAndInspect(sym)}
                          className="font-mono font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          {sym}
                        </button>
                      </td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <button
                          type="button"
                          onClick={() => onSelectAndInspect(sym)}
                          className="text-left block w-full"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {q?.name || sym}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {q ? `${q.exchange} · ${q.sector}` : 'Loading...'}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <Sparkline
                          data={q?.sparkline || []}
                          positive={isUp}
                          width={72}
                          height={22}
                          label={`${sym} intraday sparkline`}
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {q ? formatCurrency(q.price) : '—'}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-medium tabular-nums ${
                          isUp
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {q ? `${isUp ? '▲' : '▼'} ${formatPercent(q.changePercent)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 hidden md:table-cell">
                        {q ? formatCurrency(q.marketCap, true) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 hidden lg:table-cell">
                        {q?.peRatio != null ? q.peRatio.toFixed(1) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                        {q ? formatVolume(q.volume) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            title="Log portfolio position"
                            aria-label={`Log position for ${sym}`}
                            onClick={() =>
                              onOpenAddPosition(sym, q?.name || sym, q?.price || 100)
                            }
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Create price alert"
                            aria-label={`Create price alert for ${sym}`}
                            onClick={() => onOpenCreateAlert(sym, q?.price || 100)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <BellPlus className="w-3.5 h-3.5" />
                          </button>
                          {activeWatchlist && (
                            <button
                              type="button"
                              title="Remove from watchlist"
                              aria-label={`Remove ${sym} from ${activeWatchlist.name}`}
                              onClick={() =>
                                void removeSymbolFromWatchlist(activeWatchlist.id, sym)
                              }
                              className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
    </div>
  );
}

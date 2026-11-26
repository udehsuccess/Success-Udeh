import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Briefcase,
  Cloud,
  CloudOff,
  LayoutDashboard,
  List,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { AlertModal } from './components/AlertModal';
import { AlertsView } from './components/AlertsView';
import { AnalyticsView } from './components/AnalyticsView';
import { DevicesModal } from './components/DevicesModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MarketIndicesStrip } from './components/MarketIndicesStrip';
import { PortfolioView } from './components/PortfolioView';
import { PositionModal } from './components/PositionModal';
import { StockChartPanel } from './components/StockChartPanel';
import { TickerSearchModal } from './components/TickerSearchModal';
import { WatchlistRail } from './components/WatchlistRail';
import { WatchlistsView } from './components/WatchlistsView';
import { StockSyncProvider, useStockSync } from './context/StockSyncContext';
import { trackSiteEvent } from './lib/analyticsClient';
import type { HoldingDoc, WorkspaceTab } from './types/market';

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'watchlists', label: 'Watchlists', icon: List },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

function KestrelWorkspace() {
  const {
    user,
    authError,
    syncStatus,
    sessions,
    theme,
    toggleTheme,
    selectedSymbol,
    selectSymbol,
    watchlists,
    activeWatchlistId,
    setActiveWatchlistId,
    alerts,
    quotesError,
    refreshQuotesNow,
    signInWithGoogle,
  } = useStockSync();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);

  const [positionModal, setPositionModal] = useState<{
    open: boolean;
    editing: HoldingDoc | null;
    symbol?: string;
    companyName?: string;
    price?: number;
  }>({ open: false, editing: null });

  const [alertModal, setAlertModal] = useState<{
    open: boolean;
    symbol?: string;
    price?: number;
  }>({ open: false });

  // Global Cmd/Ctrl + K ticker search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Automatic backend visitor & usage tracking
  const isSignedInRef = useRef(Boolean(user));
  const activeTabRef = useRef<WorkspaceTab>(activeTab);
  useEffect(() => {
    isSignedInRef.current = Boolean(user);
  }, [user]);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    void trackSiteEvent({
      eventType: 'visit',
      tab: activeTabRef.current,
      isSignedIn: isSignedInRef.current,
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void trackSiteEvent({
          eventType: 'heartbeat',
          tab: activeTabRef.current,
          isSignedIn: isSignedInRef.current,
        });
      }
    }, 45_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    void trackSiteEvent({
      eventType: 'tab_view',
      tab: activeTab,
      isSignedIn: isSignedInRef.current,
    });
  }, [activeTab]);

  useEffect(() => {
    if (!selectedSymbol) return;
    void trackSiteEvent({
      eventType: 'symbol_view',
      symbol: selectedSymbol,
      isSignedIn: isSignedInRef.current,
    });
  }, [selectedSymbol]);

  const triggeredCount = alerts.filter((a) => a.status === 'triggered').length;

  const handleSelectAndInspect = (sym: string) => {
    void selectSymbol(sym);
    setActiveTab('overview');
  };

  const openAddPosition = (symbol?: string, companyName?: string, price?: number) => {
    setPositionModal({ open: true, editing: null, symbol, companyName, price });
  };

  const openEditPosition = (holding: HoldingDoc) => {
    setPositionModal({ open: true, editing: holding });
  };

  const openCreateAlert = (symbol?: string, price?: number) => {
    setAlertModal({ open: true, symbol, price });
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Sidebar Brand */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('overview');
            setMobileMenuOpen(false);
          }}
          className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Stockbeats
        </button>
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Ticker Search Input Trigger */}
      <div className="p-4 pb-2">
        <button
          type="button"
          onClick={() => {
            setSearchOpen(true);
            setMobileMenuOpen(false);
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" />
            Search ticker...
          </span>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
            ⌘K
          </span>
        </button>
      </div>

      {/* Primary Navigation */}
      <nav aria-label="Workspace sections" className="px-3 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                active
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="inline-flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </span>
              {item.id === 'alerts' && triggeredCount > 0 && (
                <span className="font-mono text-xs tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                  {triggeredCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Synced Watchlists Section */}
      <div className="mt-4 px-3 flex-1 overflow-y-auto">
        <div className="px-3 mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Watchlists
          </span>
          <button
            type="button"
            aria-label="Manage watchlists"
            onClick={() => {
              setActiveTab('watchlists');
              setMobileMenuOpen(false);
            }}
            className="text-xs text-blue-700 dark:text-blue-400 hover:underline"
          >
            Manage
          </button>
        </div>
        <ul className="space-y-0.5">
          {watchlists.map((wl) => {
            const selected = activeWatchlistId === wl.id;
            return (
              <li key={wl.id}>
                <button
                  type="button"
                  onClick={() => {
                    void setActiveWatchlistId(wl.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
                    selected
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="truncate">{wl.name}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-70 shrink-0">
                    {wl.symbols.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom Controls: Theme + Cross-Device Cloud Sync */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => void toggleTheme()}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </span>
          <span className="text-[11px] text-slate-400">Synced</span>
        </button>

        {user ? (
          <button
            type="button"
            onClick={() => setDevicesOpen(true)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User avatar'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                {user.displayName || user.email}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <Cloud className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {syncStatus === 'synced'
                    ? `${sessions.length || 1} synced ${sessions.length === 1 ? 'device' : 'devices'}`
                    : 'Syncing...'}
                </span>
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors"
          >
            <Cloud className="w-3.5 h-3.5" />
            Sign in with Google to Sync
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-slate-950/50 backdrop-blur-[2px]"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="w-72 max-w-[82vw] bg-white dark:bg-slate-900 h-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Strict 3-Zone Top Bar Contract */}
        <header className="h-14 sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand / Breadcrumb (Single line) */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              <span className="lg:hidden">Stockbeats</span>
              <span className="hidden lg:inline">
                {activeTab === 'overview'
                  ? `Overview / ${selectedSymbol}`
                  : activeTab === 'watchlists'
                    ? 'Watchlists'
                    : activeTab === 'portfolio'
                      ? 'Portfolio'
                      : activeTab === 'alerts'
                        ? 'Price Alerts'
                        : 'Analytics'}
              </span>
            </span>
          </div>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  activeTab === item.id
                    ? 'border-blue-700 dark:border-blue-500 text-slate-900 dark:text-white'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary CTA Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Ticker
            </button>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Contextual Cloud Sync Banner when in local preview mode */}
          {!user && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                <CloudOff className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Local workspace active. Sign in with Google to sync your watchlists, positions, and alerts across all devices in real time.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="text-blue-700 dark:text-blue-400 font-semibold hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                Enable Real-Time Sync
              </button>
            </div>
          )}

          {authError && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-400">
              {authError}
            </div>
          )}

          {quotesError && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              <span>Live market feed interrupted: {quotesError}</span>
              <button
                type="button"
                onClick={() => void refreshQuotesNow()}
                className="inline-flex items-center gap-1 font-medium hover:underline whitespace-nowrap"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <MarketIndicesStrip />

              {/* Dominant 2-Column Focal Layout: Interactive Chart (Left) + Watchlist Rail (Right) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                <div className="xl:col-span-8">
                  <StockChartPanel
                    onOpenAddPosition={openAddPosition}
                    onOpenCreateAlert={openCreateAlert}
                  />
                </div>
                <div className="xl:col-span-4">
                  <WatchlistRail onOpenSearch={() => setSearchOpen(true)} />
                </div>
              </div>

              {/* Portfolio Snapshot below the primary fold */}
              <PortfolioView
                compact
                onSelectAndInspect={handleSelectAndInspect}
                onOpenAddPosition={openAddPosition}
                onOpenEditPosition={openEditPosition}
              />
            </div>
          )}

          {activeTab === 'watchlists' && (
            <WatchlistsView
              onOpenSearch={() => setSearchOpen(true)}
              onSelectAndInspect={handleSelectAndInspect}
              onOpenAddPosition={openAddPosition}
              onOpenCreateAlert={openCreateAlert}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              onSelectAndInspect={handleSelectAndInspect}
              onOpenAddPosition={openAddPosition}
              onOpenEditPosition={openEditPosition}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              onSelectAndInspect={handleSelectAndInspect}
              onOpenCreateAlert={openCreateAlert}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView onSelectAndInspect={handleSelectAndInspect} />
          )}
        </main>
      </div>

      {/* Interactive Modals */}
      <TickerSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectSymbol={handleSelectAndInspect}
      />

      <PositionModal
        open={positionModal.open}
        editingHolding={positionModal.editing}
        presetSymbol={positionModal.symbol}
        presetCompany={positionModal.companyName}
        presetPrice={positionModal.price}
        onClose={() => setPositionModal({ open: false, editing: null })}
      />

      <AlertModal
        open={alertModal.open}
        presetSymbol={alertModal.symbol}
        presetPrice={alertModal.price}
        onClose={() => setAlertModal({ open: false })}
      />

      <DevicesModal open={devicesOpen} onClose={() => setDevicesOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StockSyncProvider>
        <KestrelWorkspace />
      </StockSyncProvider>
    </ErrorBoundary>
  );
}

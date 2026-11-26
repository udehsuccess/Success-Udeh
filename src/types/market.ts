export type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';

export type WorkspaceTab = 'overview' | 'watchlists' | 'portfolio' | 'alerts' | 'analytics';

export interface AnalyticsSummary {
  uniqueVisitors: number;
  activeNow: number;
  totalVisits: number;
  totalInteractions: number;
  signedInVisitorsToday: number;
  deviceBreakdown: Array<{
    device: 'desktop' | 'tablet' | 'mobile';
    count: number;
    percent: number;
  }>;
  topSymbols: Array<{ symbol: string; views: number }>;
  tabUsage: Array<{ tab: string; views: number }>;
  dailyTrend: Array<{
    date: string;
    label: string;
    uniqueVisitors: number;
    visits: number;
    interactions: number;
  }>;
  recentActivity: Array<{
    id: string;
    visitorKey: string;
    eventType: 'visit' | 'heartbeat' | 'tab_view' | 'symbol_view';
    target: string;
    deviceType: 'desktop' | 'tablet' | 'mobile';
    deviceLabel: string;
    isSignedIn: boolean;
    timestamp: number;
  }>;
  trackingSince: number;
  updatedAt: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  week52High: number;
  week52Low: number;
  sparkline: number[];
  source: 'live' | 'simulated';
  updatedAt: number;
}

export interface ChartPoint {
  time: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  type: string;
}

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  selectedSymbol: string;
  activeWatchlistId?: string;
  theme: 'light' | 'dark';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WatchlistDoc {
  id: string;
  ownerId: string;
  name: string;
  symbols: string[];
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HoldingDoc {
  id: string;
  ownerId: string;
  symbol: string;
  companyName: string;
  shares: number;
  avgCost: number;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AlertCondition = 'above' | 'below';
export type AlertStatus = 'active' | 'triggered' | 'dismissed';

export interface PriceAlertDoc {
  id: string;
  ownerId: string;
  symbol: string;
  condition: AlertCondition;
  targetPrice: number;
  status: AlertStatus;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeviceSessionDoc {
  id: string;
  ownerId: string;
  deviceLabel: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  createdAt?: unknown;
  updatedAt?: unknown;
}

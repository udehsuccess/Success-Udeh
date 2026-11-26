import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkRateLimit,
  getAnalyticsSummary,
  recordAnalyticsEvent,
  resetAnalyticsStore,
  validateTrackInput,
  verifyAdminBearerToken,
} from './server/analytics.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';

interface StockMeta {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  basePrice: number;
  marketCap: number;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  volatility: number;
  avgVolume: number;
}

interface QuotePayload {
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

interface ChartPoint {
  time: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Comprehensive universe of major US & global equities + benchmark ETFs
const MARKET_UNIVERSE: StockMeta[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca', sector: 'Index ETF', basePrice: 598.4, marketCap: 615e9, peRatio: 26.8, eps: 22.3, dividendYield: 1.24, volatility: 0.0085, avgVolume: 48_200_000 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', exchange: 'NASDAQ', sector: 'Index ETF', basePrice: 512.75, marketCap: 312e9, peRatio: 32.4, eps: 15.8, dividendYield: 0.58, volatility: 0.0115, avgVolume: 33_100_000 },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial ETF', exchange: 'NYSE Arca', sector: 'Index ETF', basePrice: 441.2, marketCap: 38e9, peRatio: 23.1, eps: 19.1, dividendYield: 1.62, volatility: 0.0075, avgVolume: 3_400_000 },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', exchange: 'NYSE Arca', sector: 'Index ETF', basePrice: 234.6, marketCap: 74e9, peRatio: 18.9, eps: 12.4, dividendYield: 1.31, volatility: 0.013, avgVolume: 29_800_000 },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology', basePrice: 232.85, marketCap: 3520e9, peRatio: 35.1, eps: 6.63, dividendYield: 0.43, volatility: 0.014, avgVolume: 46_500_000 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology', basePrice: 428.4, marketCap: 3185e9, peRatio: 35.6, eps: 12.03, dividendYield: 0.77, volatility: 0.0135, avgVolume: 19_400_000 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Semiconductors', basePrice: 141.9, marketCap: 3480e9, peRatio: 54.2, eps: 2.62, dividendYield: 0.03, volatility: 0.026, avgVolume: 215_000_000 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Communication', basePrice: 178.6, marketCap: 2195e9, peRatio: 23.8, eps: 7.5, dividendYield: 0.45, volatility: 0.0155, avgVolume: 24_200_000 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', sector: 'Consumer Cyclical', basePrice: 207.45, marketCap: 2180e9, peRatio: 44.3, eps: 4.68, dividendYield: null, volatility: 0.017, avgVolume: 37_800_000 },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', sector: 'Communication', basePrice: 589.2, marketCap: 1485e9, peRatio: 27.9, eps: 21.12, dividendYield: 0.34, volatility: 0.019, avgVolume: 13_600_000 },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', sector: 'Automotive', basePrice: 338.5, marketCap: 1085e9, peRatio: 92.4, eps: 3.66, dividendYield: null, volatility: 0.034, avgVolume: 82_400_000 },
  { symbol: 'AVGO', name: 'Broadcom Inc.', exchange: 'NASDAQ', sector: 'Semiconductors', basePrice: 171.3, marketCap: 802e9, peRatio: 41.5, eps: 4.13, dividendYield: 1.24, volatility: 0.022, avgVolume: 23_100_000 },
  { symbol: 'TSM', name: 'Taiwan Semiconductor Mfg.', exchange: 'NYSE', sector: 'Semiconductors', basePrice: 193.4, marketCap: 1002e9, peRatio: 30.2, eps: 6.4, dividendYield: 1.28, volatility: 0.02, avgVolume: 14_500_000 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ', sector: 'Semiconductors', basePrice: 144.8, marketCap: 234e9, peRatio: 42.1, eps: 3.44, dividendYield: null, volatility: 0.026, avgVolume: 41_200_000 },
  { symbol: 'ASML', name: 'ASML Holding N.V.', exchange: 'NASDAQ', sector: 'Semiconductors', basePrice: 694.1, marketCap: 276e9, peRatio: 35.8, eps: 19.38, dividendYield: 0.96, volatility: 0.022, avgVolume: 1_900_000 },
  { symbol: 'ARM', name: 'Arm Holdings plc', exchange: 'NASDAQ', sector: 'Semiconductors', basePrice: 146.2, marketCap: 154e9, peRatio: 98.5, eps: 1.48, dividendYield: null, volatility: 0.031, avgVolume: 7_800_000 },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE', sector: 'Financials', basePrice: 468.9, marketCap: 1012e9, peRatio: 21.4, eps: 21.91, dividendYield: null, volatility: 0.009, avgVolume: 3_600_000 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financials', basePrice: 244.3, marketCap: 692e9, peRatio: 13.6, eps: 17.96, dividendYield: 2.05, volatility: 0.013, avgVolume: 8_900_000 },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', sector: 'Financials', basePrice: 311.5, marketCap: 618e9, peRatio: 31.8, eps: 9.8, dividendYield: 0.76, volatility: 0.011, avgVolume: 5_900_000 },
  { symbol: 'MA', name: 'Mastercard Incorporated', exchange: 'NYSE', sector: 'Financials', basePrice: 526.8, marketCap: 486e9, peRatio: 38.4, eps: 13.72, dividendYield: 0.51, volatility: 0.0115, avgVolume: 2_600_000 },
  { symbol: 'GS', name: 'The Goldman Sachs Group', exchange: 'NYSE', sector: 'Financials', basePrice: 589.4, marketCap: 186e9, peRatio: 17.3, eps: 34.07, dividendYield: 2.04, volatility: 0.016, avgVolume: 2_100_000 },
  { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE', sector: 'Financials', basePrice: 46.2, marketCap: 356e9, peRatio: 14.5, eps: 3.19, dividendYield: 2.25, volatility: 0.015, avgVolume: 36_400_000 },
  { symbol: 'LLY', name: 'Eli Lilly and Company', exchange: 'NYSE', sector: 'Healthcare', basePrice: 792.6, marketCap: 752e9, peRatio: 71.8, eps: 11.04, dividendYield: 0.66, volatility: 0.018, avgVolume: 3_400_000 },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.', exchange: 'NYSE', sector: 'Healthcare', basePrice: 598.1, marketCap: 551e9, peRatio: 22.1, eps: 27.06, dividendYield: 1.4, volatility: 0.013, avgVolume: 3_100_000 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare', basePrice: 155.4, marketCap: 374e9, peRatio: 15.8, eps: 9.84, dividendYield: 3.19, volatility: 0.009, avgVolume: 6_800_000 },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE', sector: 'Energy', basePrice: 119.7, marketCap: 526e9, peRatio: 14.6, eps: 8.2, dividendYield: 3.31, volatility: 0.014, avgVolume: 14_200_000 },
  { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE', sector: 'Energy', basePrice: 161.2, marketCap: 291e9, peRatio: 16.4, eps: 9.83, dividendYield: 4.04, volatility: 0.0135, avgVolume: 7_400_000 },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', sector: 'Consumer Defensive', basePrice: 89.4, marketCap: 718e9, peRatio: 36.2, eps: 2.47, dividendYield: 0.93, volatility: 0.0105, avgVolume: 14_900_000 },
  { symbol: 'COST', name: 'Costco Wholesale Corp.', exchange: 'NASDAQ', sector: 'Consumer Defensive', basePrice: 954.2, marketCap: 423e9, peRatio: 56.9, eps: 16.77, dividendYield: 0.49, volatility: 0.012, avgVolume: 1_800_000 },
  { symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE', sector: 'Consumer Defensive', basePrice: 64.15, marketCap: 276e9, peRatio: 23.4, eps: 2.74, dividendYield: 3.02, volatility: 0.008, avgVolume: 13_400_000 },
  { symbol: 'PEP', name: 'PepsiCo Inc.', exchange: 'NASDAQ', sector: 'Consumer Defensive', basePrice: 163.8, marketCap: 225e9, peRatio: 21.1, eps: 7.76, dividendYield: 3.31, volatility: 0.009, avgVolume: 5_200_000 },
  { symbol: 'HD', name: 'The Home Depot Inc.', exchange: 'NYSE', sector: 'Consumer Cyclical', basePrice: 416.3, marketCap: 413e9, peRatio: 27.6, eps: 15.08, dividendYield: 2.16, volatility: 0.012, avgVolume: 3_100_000 },
  { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ', sector: 'Communication', basePrice: 884.5, marketCap: 378e9, peRatio: 46.2, eps: 19.15, dividendYield: null, volatility: 0.02, avgVolume: 3_300_000 },
  { symbol: 'DIS', name: 'The Walt Disney Company', exchange: 'NYSE', sector: 'Communication', basePrice: 114.6, marketCap: 208e9, peRatio: 22.9, eps: 5.0, dividendYield: 0.87, volatility: 0.016, avgVolume: 9_600_000 },
  { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE', sector: 'Technology', basePrice: 184.2, marketCap: 511e9, peRatio: 39.4, eps: 4.68, dividendYield: 0.87, volatility: 0.018, avgVolume: 9_100_000 },
  { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NYSE', sector: 'Technology', basePrice: 332.9, marketCap: 318e9, peRatio: 46.8, eps: 7.11, dividendYield: 0.48, volatility: 0.018, avgVolume: 5_400_000 },
  { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ', sector: 'Technology', basePrice: 514.7, marketCap: 227e9, peRatio: 31.2, eps: 16.5, dividendYield: null, volatility: 0.019, avgVolume: 2_900_000 },
  { symbol: 'PLTR', name: 'Palantir Technologies', exchange: 'NYSE', sector: 'Technology', basePrice: 64.3, marketCap: 146e9, peRatio: 184.0, eps: 0.35, dividendYield: null, volatility: 0.036, avgVolume: 71_500_000 },
  { symbol: 'SHOP', name: 'Shopify Inc.', exchange: 'NYSE', sector: 'Technology', basePrice: 108.4, marketCap: 140e9, peRatio: 82.4, eps: 1.32, dividendYield: null, volatility: 0.028, avgVolume: 9_800_000 },
  { symbol: 'UBER', name: 'Uber Technologies Inc.', exchange: 'NYSE', sector: 'Technology', basePrice: 71.8, marketCap: 151e9, peRatio: 34.5, eps: 2.08, dividendYield: null, volatility: 0.022, avgVolume: 18_700_000 },
  { symbol: 'SPOT', name: 'Spotify Technology S.A.', exchange: 'NYSE', sector: 'Communication', basePrice: 468.2, marketCap: 94e9, peRatio: 74.5, eps: 6.28, dividendYield: null, volatility: 0.023, avgVolume: 1_900_000 },
  { symbol: 'COIN', name: 'Coinbase Global Inc.', exchange: 'NASDAQ', sector: 'Financials', basePrice: 294.6, marketCap: 74e9, peRatio: 45.2, eps: 6.52, dividendYield: null, volatility: 0.042, avgVolume: 12_400_000 },
  { symbol: 'ABNB', name: 'Airbnb Inc.', exchange: 'NASDAQ', sector: 'Consumer Cyclical', basePrice: 136.5, marketCap: 86e9, peRatio: 31.4, eps: 4.35, dividendYield: null, volatility: 0.02, avgVolume: 4_700_000 },
  { symbol: 'NKE', name: 'NIKE Inc.', exchange: 'NYSE', sector: 'Consumer Cyclical', basePrice: 77.9, marketCap: 116e9, peRatio: 22.8, eps: 3.42, dividendYield: 2.05, volatility: 0.017, avgVolume: 11_200_000 },
  { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ', sector: 'Consumer Cyclical', basePrice: 99.4, marketCap: 113e9, peRatio: 29.8, eps: 3.34, dividendYield: 2.45, volatility: 0.016, avgVolume: 8_300_000 },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', exchange: 'NYSE Arca', sector: 'Index ETF', basePrice: 294.8, marketCap: 455e9, peRatio: 25.4, eps: 11.6, dividendYield: 1.29, volatility: 0.0085, avgVolume: 3_900_000 },
  { symbol: 'GLD', name: 'SPDR Gold Shares', exchange: 'NYSE Arca', sector: 'Commodities ETF', basePrice: 245.1, marketCap: 76e9, peRatio: null, eps: null, dividendYield: null, volatility: 0.009, avgVolume: 6_900_000 },
];

const UNIVERSE_MAP = new Map<string, StockMeta>(
  MARKET_UNIVERSE.map((item) => [item.symbol, item])
);

function hashSymbol(sym: string): number {
  let h = 2166136261;
  for (let i = 0; i < sym.length; i++) {
    h ^= sym.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function getOrCreateMeta(symbol: string): StockMeta {
  const existing = UNIVERSE_MAP.get(symbol);
  if (existing) return existing;
  const h = hashSymbol(symbol);
  const basePrice = 25 + (h % 380) + ((h % 97) / 100);
  const marketCap = (8 + (h % 140)) * 1e9;
  const peRatio = Number((12 + (h % 35) + 0.4).toFixed(1));
  return {
    symbol,
    name: `${symbol} Holdings Corp.`,
    exchange: h % 2 === 0 ? 'NASDAQ' : 'NYSE',
    sector: 'Equities',
    basePrice: Number(basePrice.toFixed(2)),
    marketCap,
    peRatio,
    eps: Number((basePrice / peRatio).toFixed(2)),
    dividendYield: h % 3 === 0 ? Number(((h % 25) / 10).toFixed(2)) : null,
    volatility: 0.018,
    avgVolume: 2_500_000 + (h % 12_000_000),
  };
}

// Deterministic, synchronized live-ticking quote engine so all devices see consistent live ticks
function buildSimulatedQuote(symbol: string, nowMs: number): QuotePayload {
  const meta = getOrCreateMeta(symbol);
  const seed = hashSymbol(symbol);
  const tickBucket = Math.floor(nowMs / 4000); // updates every 4s identically across devices
  const dayBucket = Math.floor(nowMs / 86_400_000);

  // Deterministic intraday curve + subtle harmonic oscillation
  const dayDrift = Math.sin(seed * 0.13 + dayBucket * 0.7) * meta.volatility * 1.45;
  const previousClose = Number((meta.basePrice * (1 - dayDrift * 0.35)).toFixed(2));

  const wave1 = Math.sin(tickBucket * 0.09 + seed * 0.017) * meta.volatility * 0.32;
  const wave2 = Math.cos(tickBucket * 0.23 + seed * 0.041) * meta.volatility * 0.16;
  const wave3 = Math.sin(tickBucket * 0.51 + seed * 0.097) * meta.volatility * 0.08;
  const price = Number(
    Math.max(1, previousClose * (1 + dayDrift + wave1 + wave2 + wave3)).toFixed(2)
  );

  const change = Number((price - previousClose).toFixed(2));
  const changePercent = Number(((change / previousClose) * 100).toFixed(2));

  const sparkline: number[] = [];
  for (let i = 23; i >= 0; i--) {
    const t = tickBucket - i * 4;
    const w1 = Math.sin(t * 0.09 + seed * 0.017) * meta.volatility * 0.32;
    const w2 = Math.cos(t * 0.23 + seed * 0.041) * meta.volatility * 0.16;
    const prog = (23 - i) / 23;
    const pt = previousClose * (1 + dayDrift * prog + w1 + w2);
    sparkline.push(Number(Math.max(1, pt).toFixed(2)));
  }
  sparkline[sparkline.length - 1] = price;

  const dayHigh = Number(Math.max(...sparkline, price * 1.004).toFixed(2));
  const dayLow = Number(Math.min(...sparkline, price * 0.996).toFixed(2));
  const week52High = Number((meta.basePrice * (1.18 + (seed % 15) * 0.012)).toFixed(2));
  const week52Low = Number((meta.basePrice * (0.72 - (seed % 10) * 0.01)).toFixed(2));
  const volumeFactor = 0.78 + ((Math.sin(tickBucket * 0.03 + seed) + 1) * 0.24);

  return {
    symbol: meta.symbol,
    name: meta.name,
    exchange: meta.exchange,
    sector: meta.sector,
    price,
    previousClose,
    change,
    changePercent,
    dayHigh,
    dayLow,
    volume: Math.round(meta.avgVolume * volumeFactor),
    marketCap: Math.round(meta.marketCap * (price / meta.basePrice)),
    peRatio: meta.peRatio,
    eps: meta.eps,
    dividendYield: meta.dividendYield,
    week52High: Math.max(week52High, dayHigh),
    week52Low: Math.min(week52Low, dayLow),
    sparkline,
    source: 'simulated',
    updatedAt: nowMs,
  };
}

function buildSimulatedChart(symbol: string, range: TimeRange, nowMs: number): ChartPoint[] {
  const quote = buildSimulatedQuote(symbol, nowMs);
  const meta = getOrCreateMeta(symbol);
  const seed = hashSymbol(symbol);

  const configMap: Record<TimeRange, { points: number; stepMs: number; volScale: number }> = {
    '1D': { points: 78, stepMs: 5 * 60 * 1000, volScale: 0.22 },
    '1W': { points: 65, stepMs: 2.5 * 60 * 60 * 1000, volScale: 0.45 },
    '1M': { points: 60, stepMs: 12 * 60 * 60 * 1000, volScale: 0.9 },
    '3M': { points: 64, stepMs: 36 * 60 * 60 * 1000, volScale: 1.45 },
    '1Y': { points: 72, stepMs: 5 * 24 * 60 * 60 * 1000, volScale: 2.6 },
    '5Y': { points: 80, stepMs: 22 * 24 * 60 * 60 * 1000, volScale: 5.2 },
  };

  const cfg = configMap[range] ?? configMap['1M'];
  const rawValues: number[] = [];
  let cursor = 1.0;

  for (let i = 0; i < cfg.points; i++) {
    const n1 = Math.sin((i + 1) * 0.47 + seed * 0.13) * 0.52;
    const n2 = Math.cos((i + 1) * 1.19 + seed * 0.29) * 0.31;
    const n3 = Math.sin((i + 1) * 2.41 + seed * 0.07) * 0.17;
    const stepDelta = (n1 + n2 + n3) * meta.volatility * cfg.volScale * 0.18 + 0.0008 * cfg.volScale;
    cursor = Math.max(0.35, cursor * (1 + stepDelta));
    rawValues.push(cursor);
  }

  // Normalize series so the final close matches the live quote price exactly
  const endFactor = quote.price / rawValues[rawValues.length - 1];
  const points: ChartPoint[] = [];

  for (let i = 0; i < cfg.points; i++) {
    const t = nowMs - (cfg.points - 1 - i) * cfg.stepMs;
    const close = Number((rawValues[i] * endFactor).toFixed(2));
    const prevClose = i === 0 ? close * 0.997 : Number((rawValues[i - 1] * endFactor).toFixed(2));
    const spread = Math.max(0.08, close * meta.volatility * 0.25);
    const high = Number((Math.max(close, prevClose) + spread * 0.55).toFixed(2));
    const low = Number(Math.max(0.5, Math.min(close, prevClose) - spread * 0.45).toFixed(2));
    const d = new Date(t);

    let label = '';
    if (range === '1D') {
      label = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (range === '1W' || range === '1M' || range === '3M') {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }

    points.push({
      time: t,
      label,
      open: Number(prevClose.toFixed(2)),
      high,
      low,
      close,
      volume: Math.round((meta.avgVolume / cfg.points) * (0.7 + ((i * 7 + seed) % 10) * 0.08)),
    });
  }

  return points;
}

// Short-lived in-memory caches for live Yahoo Finance responses
const quoteCache = new Map<string, { data: QuotePayload; expiresAt: number }>();
const chartCache = new Map<string, { data: ChartPoint[]; expiresAt: number }>();

const YAHOO_RANGE_PARAMS: Record<TimeRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
  '5Y': { range: '5y', interval: '1mo' },
};

async function fetchLiveYahooQuote(symbol: string): Promise<QuotePayload | null> {
  const now = Date.now();
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const yahooSymbol = symbol.replace(/\./g, '-');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2400);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?range=1d&interval=15m`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KestrelMarketTracker/1.0)',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            symbol?: string;
            shortName?: string;
            longName?: string;
            exchangeName?: string;
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketVolume?: number;
            fiftyTwoWeekHigh?: number;
            fiftyTwoWeekLow?: number;
          };
          indicators?: {
            quote?: Array<{ close?: Array<number | null> }>;
          };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;

    const fallback = getOrCreateMeta(symbol);
    const price = Number(meta.regularMarketPrice.toFixed(2));
    const prevClose = Number(
      (meta.chartPreviousClose ?? meta.previousClose ?? price).toFixed(2)
    );
    const change = Number((price - prevClose).toFixed(2));
    const changePercent =
      prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    const rawCloses = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v)
    );
    const sparkline =
      rawCloses.length >= 6
        ? rawCloses.slice(-24).map((v) => Number(v.toFixed(2)))
        : buildSimulatedQuote(symbol, now).sparkline;

    const payload: QuotePayload = {
      symbol,
      name: meta.shortName || meta.longName || fallback.name,
      exchange: meta.exchangeName || fallback.exchange,
      sector: fallback.sector,
      price,
      previousClose: prevClose,
      change,
      changePercent,
      dayHigh: Number((meta.regularMarketDayHigh ?? Math.max(...sparkline, price)).toFixed(2)),
      dayLow: Number((meta.regularMarketDayLow ?? Math.min(...sparkline, price)).toFixed(2)),
      volume: meta.regularMarketVolume ?? fallback.avgVolume,
      marketCap: fallback.marketCap,
      peRatio: fallback.peRatio,
      eps: fallback.eps,
      dividendYield: fallback.dividendYield,
      week52High: Number((meta.fiftyTwoWeekHigh ?? Math.max(price * 1.15, fallback.basePrice * 1.2)).toFixed(2)),
      week52Low: Number((meta.fiftyTwoWeekLow ?? Math.min(price * 0.85, fallback.basePrice * 0.72)).toFixed(2)),
      sparkline,
      source: 'live',
      updatedAt: now,
    };

    quoteCache.set(symbol, { data: payload, expiresAt: now + 12_000 });
    return payload;
  } catch {
    return null;
  }
}

async function fetchLiveYahooChart(
  symbol: string,
  range: TimeRange
): Promise<ChartPoint[] | null> {
  const now = Date.now();
  const key = `${symbol}:${range}`;
  const cached = chartCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const yahooSymbol = symbol.replace(/\./g, '-');
  const params = YAHOO_RANGE_PARAMS[range] ?? YAHOO_RANGE_PARAMS['1M'];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2600);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?range=${params.range}&interval=${params.interval}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KestrelMarketTracker/1.0)',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0];
    if (!timestamps.length || !q?.close) return null;

    const points: ChartPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const closeVal = q.close[i];
      if (typeof closeVal !== 'number' || !Number.isFinite(closeVal)) continue;
      const ms = timestamps[i] * 1000;
      const d = new Date(ms);
      let label = '';
      if (range === '1D') {
        label = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      } else if (range === '1W' || range === '1M' || range === '3M') {
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }

      const openVal = typeof q.open?.[i] === 'number' ? q.open[i]! : closeVal;
      const highVal = typeof q.high?.[i] === 'number' ? q.high[i]! : Math.max(openVal, closeVal);
      const lowVal = typeof q.low?.[i] === 'number' ? q.low[i]! : Math.min(openVal, closeVal);
      const volVal = typeof q.volume?.[i] === 'number' ? q.volume[i]! : 0;

      points.push({
        time: ms,
        label,
        open: Number(openVal.toFixed(2)),
        high: Number(highVal.toFixed(2)),
        low: Number(lowVal.toFixed(2)),
        close: Number(closeVal.toFixed(2)),
        volume: Math.round(volVal),
      });
    }

    if (points.length < 4) return null;
    chartCache.set(key, { data: points, expiresAt: now + 30_000 });
    return points;
  } catch {
    return null;
  }
}

function sanitizeTickerParam(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().slice(0, 12);
  if (!cleaned || !/^[A-Z0-9.-]+$/.test(cleaned)) return null;
  return cleaned;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Public rate-limited visitor & usage tracking endpoint
  app.post('/api/analytics/track', (req, res) => {
    const clientIp =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.socket.remoteAddress) || 'unknown';

    if (!checkRateLimit(clientIp)) {
      res.status(429).json({ error: 'Too many analytics requests' });
      return;
    }

    const validated = validateTrackInput(req.body);
    if (!validated) {
      res.status(400).json({ error: 'Invalid analytics payload' });
      return;
    }

    recordAnalyticsEvent(validated);
    res.json({ ok: true });
  });

  // Protected admin-only website usage summary endpoint
  app.get('/api/analytics/summary', async (req, res) => {
    const authResult = await verifyAdminBearerToken(req.headers.authorization);
    if (!authResult.ok) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    res.json(getAnalyticsSummary());
  });

  // Protected admin-only analytics reset endpoint
  app.post('/api/analytics/reset', async (req, res) => {
    const authResult = await verifyAdminBearerToken(req.headers.authorization);
    if (!authResult.ok) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    await resetAnalyticsStore();
    res.json({ ok: true });
  });

  app.get('/api/market/quotes', async (req, res) => {
    const rawSymbols = String(req.query.symbols || 'SPY,QQQ,DIA,IWM,AAPL,MSFT,NVDA');
    const symbols = Array.from(
      new Set(
        rawSymbols
          .split(',')
          .map(sanitizeTickerParam)
          .filter((s): s is string => Boolean(s))
      )
    ).slice(0, 60);

    const now = Date.now();
    const quotes = await Promise.all(
      symbols.map(async (sym) => {
        const live = await fetchLiveYahooQuote(sym);
        return live ?? buildSimulatedQuote(sym, now);
      })
    );

    res.json({ quotes, timestamp: now });
  });

  app.get('/api/market/chart/:symbol', async (req, res) => {
    const symbol = sanitizeTickerParam(req.params.symbol);
    if (!symbol) {
      res.status(400).json({ error: 'Invalid ticker symbol' });
      return;
    }

    const rawRange = String(req.query.range || '1M').toUpperCase();
    const validRanges: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
    const range: TimeRange = validRanges.includes(rawRange as TimeRange)
      ? (rawRange as TimeRange)
      : '1M';

    const now = Date.now();
    const liveSeries = await fetchLiveYahooChart(symbol, range);
    const points = liveSeries ?? buildSimulatedChart(symbol, range, now);

    res.json({
      symbol,
      range,
      source: liveSeries ? 'live' : 'simulated',
      points,
    });
  });

  app.get('/api/market/search', async (req, res) => {
    const query = String(req.query.q || '').trim().slice(0, 40);
    const lower = query.toLowerCase();

    const localMatches = MARKET_UNIVERSE.filter(
      (item) =>
        !lower ||
        item.symbol.toLowerCase().includes(lower) ||
        item.name.toLowerCase().includes(lower) ||
        item.sector.toLowerCase().includes(lower)
    )
      .slice(0, 14)
      .map((item) => ({
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange,
        sector: item.sector,
        type: item.sector.includes('ETF') ? 'ETF' : 'Equity',
      }));

    if (!query || query.length < 2) {
      res.json({ results: localMatches });
      return;
    }

    // Opportunistically merge live Yahoo Finance ticker search results
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1600);
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        query
      )}&quotesCount=8&newsCount=0`;
      const yfRes = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KestrelMarketTracker/1.0)',
          Accept: 'application/json',
        },
      });
      clearTimeout(timeout);

      if (yfRes.ok) {
        const data = (await yfRes.json()) as {
          quotes?: Array<{
            symbol?: string;
            shortname?: string;
            longname?: string;
            exchDisp?: string;
            sector?: string;
            quoteType?: string;
          }>;
        };
        const seen = new Set(localMatches.map((m) => m.symbol));
        for (const q of data.quotes ?? []) {
          const sym = q.symbol ? sanitizeTickerParam(q.symbol) : null;
          if (!sym || seen.has(sym)) continue;
          if (q.quoteType && !['EQUITY', 'ETF', 'INDEX'].includes(q.quoteType)) continue;
          seen.add(sym);
          localMatches.push({
            symbol: sym,
            name: q.shortname || q.longname || sym,
            exchange: q.exchDisp || 'US',
            sector: q.sector || 'Equities',
            type: q.quoteType === 'ETF' ? 'ETF' : 'Equity',
          });
        }
      }
    } catch {
      // Local universe fallback already populated
    }

    res.json({ results: localMatches.slice(0, 16) });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kestrel server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

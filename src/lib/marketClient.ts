import type { ChartPoint, StockQuote, StockSearchResult, TimeRange } from '../types/market';

export async function fetchQuotes(
  symbols: string[],
  signal?: AbortSignal
): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  const query = encodeURIComponent(symbols.join(','));
  const res = await fetch(`/api/market/quotes?symbols=${query}`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch quotes (${res.status})`);
  }
  const data = (await res.json()) as { quotes: StockQuote[] };
  return data.quotes;
}

export async function fetchStockChart(
  symbol: string,
  range: TimeRange,
  signal?: AbortSignal
): Promise<{ points: ChartPoint[]; source: 'live' | 'simulated' }> {
  const res = await fetch(
    `/api/market/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}`,
    { signal }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch chart for ${symbol} (${res.status})`);
  }
  const data = (await res.json()) as {
    points: ChartPoint[];
    source: 'live' | 'simulated';
  };
  return data;
}

export async function searchTickers(
  query: string,
  signal?: AbortSignal
): Promise<StockSearchResult[]> {
  const res = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`, {
    signal,
  });
  if (!res.ok) {
    throw new Error(`Ticker search failed (${res.status})`);
  }
  const data = (await res.json()) as { results: StockSearchResult[] };
  return data.results;
}

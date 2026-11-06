import type { TickerData, PricePoint, HistoricalDataCache } from '../types';
import cachedData from '../data/historicalData.json';

const STORAGE_KEY = 'aegis_live_delta_v1';

// In-memory working cache initialized with bundled data
const activeCache: HistoricalDataCache = { ...(cachedData as unknown as HistoricalDataCache) };

// Hydrate cache with any locally saved updates
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsedDelta = JSON.parse(saved) as Record<string, PricePoint[]>;
      for (const [ticker, newPoints] of Object.entries(parsedDelta)) {
        if (Array.isArray(newPoints) && newPoints.length > 0) {
          activeCache[ticker] = mergePoints(activeCache[ticker] || [], newPoints);
        }
      }
    }
  }
} catch (e) {
  console.warn('[DataService] Error hydrating from localStorage:', e);
}

/**
 * Merges two arrays of PricePoint, deduplicating and sorting by date.
 */
function mergePoints(base: PricePoint[], updates: PricePoint[]): PricePoint[] {
  const map = new Map<string, PricePoint>();
  for (const p of base) {
    if (p && p.date) map.set(p.date, p);
  }
  for (const p of updates) {
    if (p && p.date) map.set(p.date, p);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Saves delta of bars (recent points) to localStorage.
 */
function persistDelta(deltaMap: Record<string, PricePoint[]>) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const existingStr = localStorage.getItem(STORAGE_KEY);
    const currentStored: Record<string, PricePoint[]> = existingStr ? JSON.parse(existingStr) : {};

    for (const [ticker, points] of Object.entries(deltaMap)) {
      currentStored[ticker] = mergePoints(currentStored[ticker] || [], points.slice(-60)); // keep last 60 days
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentStored));
  } catch (e) {
    console.warn('[DataService] Could not persist delta to localStorage:', e);
  }
}

/**
 * Parses raw Yahoo Finance chart API response into clean PricePoint array.
 */
function parseYahooResponse(data: any): PricePoint[] {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!timestamps || !quote) {
    return [];
  }

  const pricePoints: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
    const close = quote.close?.[i];
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const volume = quote.volume?.[i];

    if (close != null && open != null && high != null && low != null) {
      pointsPush(pricePoints, date, open, high, low, close, volume || 0);
    }
  }

  return pricePoints;
}

function pointsPush(
  arr: PricePoint[],
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
) {
  arr.push({
    date,
    close: Math.round(close * 100) / 100,
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    volume,
  });
}

/**
 * Core Data Service supporting offline cache + automatic Vercel serverless updates.
 */
export const dataService = {
  /**
   * Returns list of supported offline cached tickers.
   */
  getCachedTickers(): string[] {
    return Object.keys(activeCache);
  },

  /**
   * Returns the complete current active cache immediately.
   */
  getAllCachedData(): HistoricalDataCache {
    return activeCache;
  },

  /**
   * Returns the latest available date in cache for a given ticker (default: SPY).
   */
  getLatestAvailableDate(ticker = 'SPY'): string {
    const series = activeCache[ticker.toUpperCase()];
    if (series && series.length > 0) {
      return series[series.length - 1].date;
    }
    return '2026-11-05';
  },

  /**
   * Checks if data needs an update compared to the latest weekday.
   */
  isDataRecent(ticker = 'SPY'): boolean {
    const lastDateStr = this.getLatestAvailableDate(ticker);
    const lastDate = new Date(lastDateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    // If within 2 days (or over weekend), considered recent
    return diffDays <= 1;
  },

  /**
   * Syncs the latest market data for a list of tickers (defaults to core portfolio tickers).
   * Queries Vercel serverless /api/market-data endpoint with automatic fallback.
   */
  async syncLatestData(
    tickers?: string[],
    onProgress?: (current: number, total: number, ticker: string) => void
  ): Promise<{ updatedCount: number; latestDate: string }> {
    const targetTickers = tickers && tickers.length > 0 ? tickers : Object.keys(activeCache);
    const deltaToSave: Record<string, PricePoint[]> = {};
    let totalUpdated = 0;

    console.log(`[DataService] Starting sync for ${targetTickers.length} tickers...`);

    // Try batch endpoint first (supported by Vercel Function /api/market-data)
    try {
      const batchSize = 10;
      for (let i = 0; i < targetTickers.length; i += batchSize) {
        const chunk = targetTickers.slice(i, i + batchSize);
        if (onProgress) {
          onProgress(i + 1, targetTickers.length, chunk.join(', '));
        }

        const res = await fetch(`/api/market-data?tickers=${chunk.join(',')}&range=1mo`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            for (const [ticker, newBars] of Object.entries(json.data as Record<string, PricePoint[]>)) {
              if (Array.isArray(newBars) && newBars.length > 0) {
                const prevCount = activeCache[ticker]?.length || 0;
                activeCache[ticker] = mergePoints(activeCache[ticker] || [], newBars);
                deltaToSave[ticker] = newBars;
                totalUpdated += (activeCache[ticker]?.length || 0) - prevCount;
              }
            }
          }
        } else {
          // If batch not supported, fall back to individual ticker fetch
          for (const t of chunk) {
            await this.fetchAndMergeTicker(t, '1mo', deltaToSave);
          }
        }
      }
    } catch (err) {
      console.warn('[DataService] Batch sync failed, falling back to sequential fetch:', err);
      for (let i = 0; i < targetTickers.length; i++) {
        const t = targetTickers[i];
        if (onProgress) onProgress(i + 1, targetTickers.length, t);
        await this.fetchAndMergeTicker(t, '1mo', deltaToSave);
      }
    }

    persistDelta(deltaToSave);
    const latestDate = this.getLatestAvailableDate('SPY');
    console.log(`[DataService] Sync complete! Latest SPY date: ${latestDate}. New bars added: ${totalUpdated}`);

    return { updatedCount: totalUpdated, latestDate };
  },

  /**
   * Helper to fetch and merge a single ticker's recent data.
   */
  async fetchAndMergeTicker(
    ticker: string,
    range = '1mo',
    deltaMap?: Record<string, PricePoint[]>
  ): Promise<PricePoint[]> {
    const cleanTicker = ticker.trim().toUpperCase();
    try {
      let points: PricePoint[] = [];

      // 1. Try Vercel Serverless /api/market-data
      const res = await fetch(`/api/market-data?ticker=${encodeURIComponent(cleanTicker)}&range=${range}`);
      if (res.ok) {
        const json = await res.json();
        points = json.points || [];
      } else {
        // 2. Try /api/yahoo proxy
        const yahooRes = await fetch(
          `/api/yahoo?ticker=${encodeURIComponent(cleanTicker)}&range=${range}&interval=1d`
        );
        if (yahooRes.ok) {
          const yData = await yahooRes.json();
          points = parseYahooResponse(yData);
        }
      }

      if (points.length > 0) {
        activeCache[cleanTicker] = mergePoints(activeCache[cleanTicker] || [], points);
        if (deltaMap) {
          deltaMap[cleanTicker] = points;
        }
      }
      return points;
    } catch (e) {
      console.warn(`[DataService] Could not update ${cleanTicker}:`, e);
      return [];
    }
  },

  /**
   * Fetches historical data for a ticker.
   * Uses memory/cached data if available, otherwise fetches live API.
   */
  async getHistoricalData(ticker: string): Promise<TickerData> {
    const cleanTicker = ticker.trim().toUpperCase();
    if (activeCache[cleanTicker] && activeCache[cleanTicker].length > 0) {
      return activeCache[cleanTicker];
    }

    console.log(`[DataService] Ticker ${cleanTicker} not in cache, fetching 20y history...`);
    try {
      // Fetch 20 years via Vercel Function or dev proxy
      const res = await fetch(`/api/market-data?ticker=${encodeURIComponent(cleanTicker)}&range=20y`);
      if (res.ok) {
        const json = await res.json();
        if (json.points && json.points.length > 0) {
          activeCache[cleanTicker] = json.points;
          persistDelta({ [cleanTicker]: json.points });
          return json.points;
        }
      }

      // Fallback to /api/yahoo
      const yRes = await fetch(`/api/yahoo?ticker=${encodeURIComponent(cleanTicker)}&range=20y&interval=1d`);
      if (yRes.ok) {
        const yData = await yRes.json();
        const parsed = parseYahooResponse(yData);
        if (parsed.length > 0) {
          activeCache[cleanTicker] = parsed;
          persistDelta({ [cleanTicker]: parsed });
          return parsed;
        }
      }

      throw new Error(`No data returned for ${cleanTicker}`);
    } catch (error) {
      console.error(`[DataService] Live fetch failed for ${cleanTicker}:`, error);
      if (activeCache[cleanTicker]) {
        return activeCache[cleanTicker];
      }
      throw new Error(
        `Could not retrieve price data for "${cleanTicker}". Supported offline tickers: ${Object.keys(
          activeCache
        ).join(', ')}`
      );
    }
  },

  /**
   * Clears saved local storage delta and reverts to bundled base data.
   */
  clearLocalUpdates() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
};

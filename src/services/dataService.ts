import type { TickerData, PricePoint } from '../types';
import cachedData from '../data/historicalData.json';

// Cast the imported JSON cache to the correct type
const localCache = cachedData as { [ticker: string]: TickerData };

/**
 * Parses Yahoo Finance chart API response into clean PricePoint array.
 */
function parseYahooResponse(data: any): PricePoint[] {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!timestamps || !quote) {
    throw new Error('Invalid Yahoo Finance API response structure');
  }

  const pricePoints: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
    const close = quote.close[i];
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const volume = quote.volume[i];

    // Filter out nulls (which happen on holidays/non-trading times)
    if (
      close !== null && close !== undefined &&
      open !== null && open !== undefined &&
      high !== null && high !== undefined &&
      low !== null && low !== undefined
    ) {
      pricePoints.push({
        date,
        close: Math.round(close * 100) / 100,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        volume: volume || 0
      });
    }
  }

  return pricePoints;
}

/**
 * Service to fetch historical stock daily prices.
 */
export const dataService = {
  /**
   * Returns list of supported offline cached tickers.
   */
  getCachedTickers(): string[] {
    return Object.keys(localCache);
  },

  /**
   * Fetches historical data for a ticker.
   * Tries live API through dev proxy first, falls back to local JSON cache.
   */
  async getHistoricalData(ticker: string): Promise<TickerData> {
    const cleanTicker = ticker.trim().toUpperCase();
    const isProduction = import.meta.env.PROD;

    try {
      console.log(`[DataService] Fetching live data for ${cleanTicker}...`);
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?interval=1d&range=20y`;
      
      // In production, fetch via corsproxy.io; in dev, use the vite local proxy config
      const url = isProduction 
        ? `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
        : `/api/yahoo/v8/finance/chart/${cleanTicker}?interval=1d&range=20y`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      
      const data = await response.json();
      const parsed = parseYahooResponse(data);
      console.log(`[DataService] Successfully fetched live data for ${cleanTicker} (${parsed.length} items)`);
      return parsed;
    } catch (error) {
      console.warn(`[DataService] Live fetch failed for ${cleanTicker}, falling back to local cache...`, error);
      
      if (localCache[cleanTicker]) {
        console.log(`[DataService] Successfully resolved cached data fallback for ${cleanTicker}`);
        return localCache[cleanTicker];
      }
      
      throw new Error(
        `Could not retrieve price data for "${cleanTicker}". ` +
        `Offline-supported tickers are: ${Object.keys(localCache).join(', ')}`
      );
    }
  }
};

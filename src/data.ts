import type { HistoricalDataCache } from './types';

interface PricesFile {
  asOf: string;
  adjusted: boolean;
  source: string;
  dates: string[];
  prices: Record<string, (number | null)[]>;
}

export interface LoadedData {
  asOf: string;
  source: string;
  cache: HistoricalDataCache;
}

/** Loads public/data/prices.json (refreshed weekly by a GitHub Action). */
export async function loadPrices(): Promise<LoadedData> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/prices.json`);
  if (!res.ok) throw new Error(`Could not load price data (HTTP ${res.status})`);
  const file = (await res.json()) as PricesFile;
  const cache: HistoricalDataCache = {};
  for (const [ticker, series] of Object.entries(file.prices)) {
    const out: { date: string; close: number }[] = [];
    series.forEach((v, i) => { if (v != null) out.push({ date: file.dates[i], close: v }); });
    cache[ticker] = out;
  }
  return { asOf: file.asOf, source: file.source, cache };
}

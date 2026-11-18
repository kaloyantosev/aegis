import type { HistoricalDataCache } from './types';

interface PricesFile {
  asOf: string;
  adjusted: boolean;
  source: string;
  dates: string[];
  prices: Record<string, (number | null)[]>;
  addedDays?: number;
}

export interface LoadedData {
  asOf: string;
  source: string;
  cache: HistoricalDataCache;
}

const DELTA_STORAGE_KEY = 'aegis_price_delta_v1';

function mergePriceDelta(base: LoadedData, delta: PricesFile): { updated: LoadedData; addedDays: number } {
  if (!delta.dates || delta.dates.length === 0) {
    return { updated: base, addedDays: 0 };
  }

  const nextCache: HistoricalDataCache = {};
  const overlapStart = delta.dates[0];

  for (const [ticker, baseSeries] of Object.entries(base.cache)) {
    const deltaSeries = delta.prices[ticker];
    if (!deltaSeries) {
      nextCache[ticker] = baseSeries.slice();
      continue;
    }

    // Build map of delta date -> close
    const deltaMap = new Map<string, number>();
    delta.dates.forEach((d, idx) => {
      const v = deltaSeries[idx];
      if (v != null) deltaMap.set(d, v);
    });

    // Check if any overlapping date experienced an ex-dividend/split adjustment
    let adjustRatio = 1;
    for (let i = baseSeries.length - 1; i >= 0; i--) {
      const pt = baseSeries[i];
      if (pt.date < overlapStart) break;
      const dVal = deltaMap.get(pt.date);
      if (dVal != null && pt.close > 0) {
        const r = dVal / pt.close;
        if (Math.abs(r - 1) > 1e-4 && r > 0.5 && r < 1.5) {
          adjustRatio = r;
        }
        break;
      }
    }

    const merged = baseSeries
      .filter((pt) => pt.date < overlapStart)
      .map((pt) => (adjustRatio === 1 ? pt : { date: pt.date, close: Number((pt.close * adjustRatio).toPrecision(6)) }));

    delta.dates.forEach((d, idx) => {
      const v = deltaSeries[idx];
      if (v != null) merged.push({ date: d, close: v });
    });

    nextCache[ticker] = merged;
  }

  // Include any brand-new ticker if present in delta
  for (const [ticker, deltaSeries] of Object.entries(delta.prices)) {
    if (!nextCache[ticker]) {
      const out: { date: string; close: number }[] = [];
      deltaSeries.forEach((v, idx) => {
        if (v != null) out.push({ date: delta.dates[idx], close: v });
      });
      nextCache[ticker] = out;
    }
  }

  const addedDays = delta.dates.filter((d) => d > base.asOf).length;
  const nextAsOf = delta.asOf > base.asOf ? delta.asOf : base.asOf;

  return {
    updated: {
      asOf: nextAsOf,
      source: delta.source || base.source,
      cache: nextCache,
    },
    addedDays,
  };
}

/** Loads public/data/prices.json and reapplies any newer on-demand cached delta. */
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

  const base: LoadedData = { asOf: file.asOf, source: file.source, cache };

  try {
    const rawDelta = localStorage.getItem(DELTA_STORAGE_KEY);
    if (rawDelta) {
      const parsed = JSON.parse(rawDelta) as { baseAsOf?: string; delta?: PricesFile };
      if (parsed?.delta && parsed.delta.asOf > file.asOf && (!parsed.baseAsOf || parsed.baseAsOf === file.asOf)) {
        return mergePriceDelta(base, parsed.delta).updated;
      }
      if (parsed?.delta && parsed.delta.asOf <= file.asOf) {
        localStorage.removeItem(DELTA_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }

  return base;
}

/** Fetches latest closes from /api/update-data and merges them on demand. */
export async function refreshPricesOnDemand(current: LoadedData): Promise<{ updated: LoadedData; addedDays: number }> {
  const res = await fetch(`/api/update-data?since=${encodeURIComponent(current.asOf)}`, {
    cache: 'no-store',
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || !Array.isArray(payload.dates)) {
    throw new Error(payload?.error || `Could not refresh market data (HTTP ${res.status})`);
  }

  const delta = payload as PricesFile;
  const result = mergePriceDelta(current, delta);

  try {
    localStorage.setItem(DELTA_STORAGE_KEY, JSON.stringify({ baseAsOf: current.asOf, delta }));
  } catch {
    // ignore storage errors
  }

  return result;
}

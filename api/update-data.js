/**
 * Vercel Serverless Function & shared Yahoo Finance updater for Aegis.
 * GET /api/update-data?since=YYYY-MM-DD
 *
 * Fetches total-return (split & dividend adjusted) daily closes from Yahoo Finance
 * for all strategy tickers, aligned to SPY trading days.
 */

export const TICKERS = [
  'SPY', 'QQQ', 'TLT', 'GLD', 'BIL', 'XLP', 'XLE', 'XLK', 'DBC', 'XLV', 'XLI', 'XLF', 'XLG', 'XLY', 'ICLN', 'TQQQ',
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'TSLA', 'LLY', 'AVGO',
  'JPM', 'WMT', 'XOM', 'V', 'UNH', 'MA', 'PG', 'JNJ', 'HD', 'ORCL',
  'CVX', 'BAC', 'KO', 'CSCO', 'INTC', 'IBM', 'GE', 'PFE', 'WFC', 'C', 'T',
];

const nyDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function sig(x, digits = 6) {
  if (x === null || x === undefined || Number.isNaN(x) || !Number.isFinite(x)) {
    return null;
  }
  if (x === 0) return 0;
  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(x))));
  return Number(x.toFixed(Math.min(decimals, 20)));
}

async function fetchTickerChart(ticker, { range = '1mo', period1, period2 } = {}) {
  const params = new URLSearchParams({ interval: '1d' });
  if (period1 !== undefined && period2 !== undefined) {
    params.set('period1', String(period1));
    params.set('period2', String(period2));
  } else {
    params.set('range', range);
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${res.status} for ${ticker}`);
  }

  const payload = await res.json();
  const result = payload?.chart?.result?.[0];
  if (!result) {
    const errDesc = payload?.chart?.error?.description || 'Empty chart result';
    throw new Error(`Yahoo Finance error for ${ticker}: ${errDesc}`);
  }

  const timestamps = result.timestamp || [];
  const adjclose = result.indicators?.adjclose?.[0]?.adjclose;
  const quoteClose = result.indicators?.quote?.[0]?.close || [];
  const rawSeries = adjclose && adjclose.length ? adjclose : quoteClose;

  const byDate = new Map();
  for (let i = 0; i < timestamps.length; i++) {
    const val = rawSeries[i];
    if (val === null || val === undefined || Number.isNaN(val)) continue;
    const dateStr = nyDateFormatter.format(new Date(timestamps[i] * 1000));
    byDate.set(dateStr, sig(Number(val), 6));
  }
  return byDate;
}

export async function fetchPriceBatch({ range = '1mo', period1, period2, since = '' } = {}) {
  const batchSize = 12;
  const maps = {};

  for (let i = 0; i < TICKERS.length; i += batchSize) {
    const chunk = TICKERS.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map(async (ticker) => [ticker, await fetchTickerChart(ticker, { range, period1, period2 })]),
    );
    for (const [ticker, map] of results) {
      maps[ticker] = map;
    }
  }

  const spyMap = maps.SPY;
  if (!spyMap || spyMap.size === 0) {
    throw new Error('No SPY trading days returned by Yahoo Finance');
  }

  const allSpyDates = Array.from(spyMap.keys()).sort();
  const cleanSince = typeof since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : '';
  const selectedDates = cleanSince
    ? allSpyDates.filter((d) => d >= cleanSince)
    : allSpyDates;

  const asOf = allSpyDates[allSpyDates.length - 1];
  const addedDays = cleanSince ? selectedDates.filter((d) => d > cleanSince).length : selectedDates.length;

  const prices = {};
  for (const ticker of TICKERS) {
    const tMap = maps[ticker];
    prices[ticker] = selectedDates.map((d) => (tMap.has(d) ? tMap.get(d) : null));
  }

  return {
    asOf,
    adjusted: true,
    source: 'Yahoo Finance (adjusted close, dividends & splits)',
    dates: selectedDates,
    prices,
    addedDays,
    syncedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const since = typeof req.query?.since === 'string' ? req.query.since.trim() : '';
    const data = await fetchPriceBatch({ range: '1mo', since });
    return res.status(200).json(data);
  } catch (err) {
    console.error('[update-data] Failed:', err);
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to fetch market data from Yahoo Finance',
    });
  }
}

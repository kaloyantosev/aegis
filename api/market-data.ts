// api/market-data.ts
// Vercel Serverless Function (Node.js runtime, Fluid Compute)

export const config = {
  maxDuration: 30,
};

interface PricePoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

function parseYahooChart(data: any): PricePoint[] {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!timestamps || !quote) {
    return [];
  }

  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
    const close = quote.close[i];
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const volume = quote.volume[i];

    if (close != null && open != null && high != null && low != null) {
      points.push({
        date,
        close: Math.round(close * 100) / 100,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        volume: volume || 0,
      });
    }
  }
  return points;
}

async function fetchTicker(ticker: string, range: string, interval: string): Promise<PricePoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://finance.yahoo.com',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance HTTP ${response.status} for ${ticker}`);
  }

  const json = await response.json();
  return parseYahooChart(json);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickerParam = url.searchParams.get('ticker') || url.searchParams.get('symbol');
  const tickersParam = url.searchParams.get('tickers');
  const range = url.searchParams.get('range') || '1mo';
  const interval = url.searchParams.get('interval') || '1d';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  };

  try {
    if (tickersParam) {
      const tickers = tickersParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
      const results: Record<string, PricePoint[]> = {};

      const chunkSize = 5;
      for (let i = 0; i < tickers.length; i += chunkSize) {
        const chunk = tickers.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (t) => {
            try {
              results[t] = await fetchTicker(t, range, interval);
            } catch (err) {
              console.error(`Failed to fetch ${t}:`, err);
              results[t] = [];
            }
          })
        );
      }

      return new Response(JSON.stringify({ success: true, range, data: results }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    if (tickerParam) {
      const ticker = tickerParam.trim().toUpperCase();
      const points = await fetchTicker(ticker, range, interval);
      return new Response(JSON.stringify({ success: true, ticker, range, points }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Please specify "ticker" or "tickers" query parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

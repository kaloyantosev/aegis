import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'market-data-dev-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/market-data')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const tickerParam = urlObj.searchParams.get('ticker') || urlObj.searchParams.get('symbol');
            const tickersParam = urlObj.searchParams.get('tickers');
            const range = urlObj.searchParams.get('range') || '1mo';
            const interval = urlObj.searchParams.get('interval') || '1d';

            const fetchTicker = async (sym: string) => {
              const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`;
              const resp = await fetch(yUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  Referer: 'https://finance.yahoo.com',
                },
              });
              if (!resp.ok) return [];
              const json: any = await resp.json();
              const result = json?.chart?.result?.[0];
              const ts = result?.timestamp || [];
              const quote = result?.indicators?.quote?.[0] || {};
              const points = [];
              for (let i = 0; i < ts.length; i++) {
                const date = new Date(ts[i] * 1000).toISOString().split('T')[0];
                const close = quote.close?.[i];
                const open = quote.open?.[i];
                const high = quote.high?.[i];
                const low = quote.low?.[i];
                const volume = quote.volume?.[i];
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
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            try {
              if (tickersParam) {
                const tickers = tickersParam
                  .split(',')
                  .map((t) => t.trim().toUpperCase())
                  .filter(Boolean);
                const data: Record<string, any> = {};
                for (const t of tickers) {
                  data[t] = await fetchTicker(t);
                }
                res.end(JSON.stringify({ success: true, range, data }));
                return;
              }
              if (tickerParam) {
                const points = await fetchTicker(tickerParam.trim().toUpperCase());
                res.end(JSON.stringify({ success: true, ticker: tickerParam, range, points }));
                return;
              }
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing ticker or tickers parameter' }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Referer: 'https://finance.yahoo.com',
        },
      },
    },
  },
});

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localUpdateDataApi(): Plugin {
  return {
    name: 'local-update-data-api',
    configureServer(server) {
      server.middlewares.use('/api/update-data', async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost');
          const since = url.searchParams.get('since') || '';
          // @ts-expect-error local JS serverless module
          const { fetchPriceBatch } = await import('./api/update-data.js');
          const data = await fetchPriceBatch({ range: '1mo', since });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to fetch market data' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localUpdateDataApi()],
});

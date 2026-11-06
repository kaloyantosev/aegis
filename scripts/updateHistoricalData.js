import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'historicalData.json');

const TICKERS = [
  'SPY', 'QQQ', 'TLT', 'GLD', 'BIL', 'XLP', 'XLE', 'XLK', 'DBC', 'XLV', 'XLI', 'XLF', 'XLG', 'XLY', 'ICLN', 'TQQQ',
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'TSLA', 'LLY', 'AVGO',
  'JPM', 'WMT', 'XOM', 'V', 'UNH', 'MA', 'PG', 'JNJ', 'HD', 'ORCL',
  'CVX', 'BAC', 'KO', 'CSCO', 'INTC', 'IBM', 'GE', 'PFE', 'WFC', 'C', 'T'
];

function fetchRecentBars(ticker, range = '3mo') {
  return new Promise((resolve, reject) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://finance.yahoo.com'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Status ${res.statusCode}: ${data.slice(0, 80)}`));
            return;
          }
          const parsed = JSON.parse(data);
          const result = parsed.chart?.result?.[0];
          const timestamps = result?.timestamp;
          const quote = result?.indicators?.quote?.[0];

          if (!timestamps || !quote) {
            resolve([]);
            return;
          }

          const points = [];
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
                volume: volume || 0
              });
            }
          }
          resolve(points);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log(`Loading existing data from ${OUTPUT_FILE}...`);
  let cache = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    cache = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
  }

  let totalNewBars = 0;

  for (let i = 0; i < TICKERS.length; i++) {
    const ticker = TICKERS[i];
    const existing = cache[ticker] || [];
    const lastDate = existing.length > 0 ? existing[existing.length - 1].date : 'none';
    process.stdout.write(`[${i + 1}/${TICKERS.length}] Updating ${ticker} (last: ${lastDate})... `);

    try {
      const recent = await fetchRecentBars(ticker, existing.length === 0 ? '20y' : '3mo');
      
      // Merge by date
      const dateMap = new Map();
      for (const p of existing) {
        dateMap.set(p.date, p);
      }
      let addedForTicker = 0;
      for (const p of recent) {
        if (!dateMap.has(p.date)) {
          addedForTicker++;
        }
        dateMap.set(p.date, p); // overwrite / update bar
      }

      const merged = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      cache[ticker] = merged;
      totalNewBars += addedForTicker;
      const newLast = merged.length > 0 ? merged[merged.length - 1].date : 'none';
      console.log(`+${addedForTicker} bars -> now: ${newLast} (${merged.length} total)`);

      // Gentle pause to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`FAILED: ${e.message}`);
    }
  }

  console.log(`\nWriting updated historical cache with ${totalNewBars} new price points...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
  console.log('Update complete!');
}

main();

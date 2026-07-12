import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TICKERS = ['SPY', 'QQQ', 'TLT', 'GLD', 'BIL', 'XLP', 'XLE', 'XLK', 'DBC', 'XLV', 'XLI', 'XLF', 'XLG', 'XLY', 'ICLN'];
const RANGE = '8y'; // 8 years of historical daily data
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'historicalData.json');

// Ensure directories exist
const dataDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function fetchTickerData(ticker) {
  return new Promise((resolve, reject) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${RANGE}`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://finance.yahoo.com'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch ${ticker}: HTTP Status ${res.statusCode}. Body: ${data.slice(0, 100)}`));
            return;
          }
          const parsed = JSON.parse(data);
          const result = parsed.chart.result[0];
          const timestamps = result.timestamp;
          const quote = result.indicators.quote[0];
          
          if (!timestamps || !quote) {
            reject(new Error(`No historical data found for ${ticker}`));
            return;
          }

          const pricePoints = [];
          for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
            const close = quote.close[i];
            const open = quote.open[i];
            const high = quote.high[i];
            const low = quote.low[i];
            const volume = quote.volume[i];

            // Filter out null values which can occur on holidays/incomplete bars
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
          console.log(`Successfully parsed ${pricePoints.length} price points for ${ticker}`);
          resolve(pricePoints);
        } catch (e) {
          reject(new Error(`Failed to parse ${ticker} data: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  const cache = {};
  console.log(`Starting historical data download for: ${TICKERS.join(', ')}`);
  
  for (const ticker of TICKERS) {
    try {
      console.log(`Fetching ${ticker}...`);
      cache[ticker] = await fetchTickerData(ticker);
      // Brief delay to be polite to the API
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`Error downloading ${ticker}:`, e.message);
      process.exit(1);
    }
  }

  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
    console.log(`Data successfully saved to ${OUTPUT_FILE}`);
  } catch (e) {
    console.error('Error writing file:', e.message);
    process.exit(1);
  }
}

main();

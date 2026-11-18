import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPriceBatch } from '../api/update-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'data', 'prices.json');

async function main() {
  const period1 = Math.floor(Date.UTC(2005, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const data = await fetchPriceBatch({ period1, period2 });

  const out = {
    asOf: data.asOf,
    adjusted: true,
    source: 'Yahoo Finance (adjusted close, total return: dividends and splits)',
    dates: data.dates,
    prices: data.prices,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');
  const mb = (fs.statSync(OUT).size / 1e6).toFixed(2);
  console.log(`Wrote ${OUT} (${mb} MB), ${out.dates.length} days, asOf ${out.asOf}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

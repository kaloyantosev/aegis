import type {
  BacktestConfig,
  BacktestResult,
  EquityPoint,
  HistoricalDataCache,
  MethodologyOptions,
  Portfolio,
  PortfolioAsset,
  Trade,
} from '../types';

// ── Methodology ───────────────────────────────────────────────────────────────
// Strategy rules (the USI stress index, tier thresholds, Bear Shield logic and the
// Top-10 selection) are unchanged from the original model. What changed is how it is
// tested, so results are not flattered:
//   1. Total-return prices (dividends included) for every asset and the benchmark.
//   2. Signals are computed on day t's close and executed at day t+1's close.
//   3. No simulated prices. Before a fund existed, a real instrument stands in and the
//      day is flagged: TQQQ → QQQ (unleveraged, before Feb 2010), BIL → cash (before
//      May 2007), anything else → its weight spread over the rest of the portfolio.
//   4. No noise term in the USI.
//   5. Share counts are interpolated through time instead of using 2026 counts.
//   6. One continuous run from 2006 (indicators warmed up on 2005 data); any year or
//      date range is a slice of that single equity curve.

const STAND_INS: Record<string, string> = { TQQQ: 'QQQ', BIL: '$CASH' };

export const DEFAULT_METHOD: MethodologyOptions = {
  executionLagDays: 1,
  usiNoise: false,
  pointInTimeShares: true,
  syntheticTqqq: false,
};

export function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i];
    if (i >= period) sum -= prices[i - period];
    sma.push(i >= period - 1 ? sum / period : prices[i]);
  }
  return sma;
}

function rollingExtremes(c: number[], window: number) {
  const hi: number[] = new Array(c.length);
  const lo: number[] = new Array(c.length);
  for (let i = 0; i < c.length; i++) {
    let h = -Infinity, l = Infinity;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      if (c[j] > h) h = c[j];
      if (c[j] < l) l = c[j];
    }
    hi[i] = h;
    lo[i] = l;
  }
  return { hi, lo };
}

// ── US mega-cap universe for the Top-10 Neutral portfolio ─────────────────────
// Split-adjusted shares outstanding (billions), approximate, at ANCHOR_YEARS.
// Note: the universe is today's large caps, so the Top-10 sleeve has survivorship bias
// (2006-era leaders that later collapsed, e.g. AIG, are not in the list).
const ANCHOR_YEARS = [2006, 2009, 2012, 2015, 2018, 2022, 2026];
const SHARE_ANCHORS: { [ticker: string]: number[] } = {
  'AAPL':  [24.5, 25.0, 25.8, 24.5, 20.0, 16.3, 15.1],
  'MSFT':  [10.2,  9.3,  8.8,  8.3,  7.7,  7.5,  7.43],
  'NVDA':  [22.0, 22.5, 23.0, 23.0, 24.3, 24.9, 24.5],
  'AMZN':  [ 8.3,  8.5,  8.9,  9.3,  9.7, 10.2, 10.5],
  'GOOGL': [12.2, 12.5, 12.8, 13.5, 13.9, 13.2, 12.3],
  'META':  [ 0.0,  0.0,  0.0,  2.6,  2.9,  2.7,  2.53],
  'BRK-B': [ 2.32, 2.35, 2.40, 2.46, 2.46, 2.21, 2.16],
  'TSLA':  [ 0.0,  0.0,  1.4,  1.9,  2.55, 3.1,  3.2],
  'LLY':   [ 1.13, 1.13, 1.12, 1.07, 0.98, 0.95, 0.95],
  'AVGO':  [ 0.0,  0.0,  2.4,  2.6,  4.1,  4.1,  4.7],
  'JPM':   [ 3.5,  3.4,  3.9,  3.75, 3.4,  2.95, 2.8],
  'WMT':   [12.5, 12.0, 11.2,  9.7,  8.9,  8.2,  8.0],
  'XOM':   [ 6.0,  5.3,  4.8,  4.3,  4.23, 4.2,  4.35],
  'V':     [ 0.0,  0.0,  2.8,  2.5,  2.25, 2.1,  1.98],
  'UNH':   [ 1.35, 1.25, 1.12, 0.98, 0.96, 0.94, 0.92],
  'MA':    [ 1.35, 1.32, 1.30, 1.16, 1.04, 0.97, 0.92],
  'PG':    [ 3.2,  3.05, 2.85, 2.71, 2.5,  2.4,  2.35],
  'JNJ':   [ 2.95, 2.85, 2.75, 2.82, 2.68, 2.63, 2.41],
  'HD':    [ 2.05, 1.70, 1.68, 1.38, 1.15, 1.03, 0.99],
  'ORCL':  [ 5.2,  5.1,  5.0,  4.5,  3.8,  2.7,  2.77],
  'CVX':   [ 2.2,  2.1,  2.0,  1.9,  1.9,  1.93, 1.8],
  'BAC':   [ 4.5,  4.5, 10.0, 10.5, 10.0,  8.05, 7.6],
  'KO':    [ 4.7,  4.65, 4.6,  4.4,  4.26, 4.32, 4.3],
  'CSCO':  [ 6.1,  5.9,  5.7,  5.1,  4.6,  4.15, 4.0],
  'INTC':  [ 5.8,  5.6,  5.5,  4.95, 4.6,  4.1,  4.3],
  'IBM':   [ 1.55, 1.38, 1.28, 1.02, 0.92, 0.90, 0.92],
  'GE':    [ 2.18, 2.00, 1.85, 1.60, 1.36, 1.10, 1.08],
  'PFE':   [ 7.3,  6.8,  8.0,  6.4,  5.8,  5.6,  5.66],
  'WFC':   [ 3.35, 3.35, 5.2,  5.25, 4.8,  3.8,  3.3],
  'C':     [ 0.50, 0.52, 2.9,  3.0,  2.45, 1.95, 1.9],
  'T':     [ 3.9,  6.0,  5.9,  5.2,  7.2,  7.15, 7.15],
};

function sharesAt(ticker: string, date: string, pointInTime: boolean): number {
  const a = SHARE_ANCHORS[ticker];
  if (!pointInTime) return a[a.length - 1];
  const t = Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 1) / 12;
  if (t <= ANCHOR_YEARS[0]) return a[0] || a.find(v => v > 0) || 0;
  for (let k = 1; k < ANCHOR_YEARS.length; k++) {
    if (t <= ANCHOR_YEARS[k]) {
      const lo = a[k - 1] || a[k], hi = a[k];
      const w = (t - ANCHOR_YEARS[k - 1]) / (ANCHOR_YEARS[k] - ANCHOR_YEARS[k - 1]);
      return lo + (hi - lo) * w;
    }
  }
  return a[a.length - 1];
}

// ── Thresholds (unchanged) ────────────────────────────────────────────────────
const USI_BUY_FLOOR     = 187.947;
const USI_STRONG_FLOOR  = 227.810;
const USI_HEAVY_FLOOR   = 323.140;
const USI_EXTREME_FLOOR = 894.52;

const TIER_RANK: { [id: string]: number } = {
  'bear-shield': -1, 'neutral': 0, 'buy': 1, 'strong-buy': 2, 'heavy-buy': 3, 'extreme-buy': 4,
};

export const backtester = {
  run(
    config: BacktestConfig,
    portfolios: Portfolio[],
    allData: HistoricalDataCache,
    method: MethodologyOptions = DEFAULT_METHOD,
  ): BacktestResult {
    const { initialCapital, transactionFee, benchmarkTicker, useTop10Neutral, useBearShield } = config;
    const benchmarkData = allData[benchmarkTicker];
    if (!benchmarkData?.length) throw new Error(`Benchmark data for ${benchmarkTicker} is missing`);

    const workingData: HistoricalDataCache = { ...allData };
    if (method.syntheticTqqq) {
      // Only for measuring the effect of the original back-fill. Never used by the app.
      const q = workingData['QQQ'], tq = workingData['TQQQ'];
      const k0 = q.findIndex(p => p.date === tq[0].date);
      if (k0 > 0) {
        const synth = new Array(k0);
        let cur = tq[0].close;
        for (let i = k0 - 1; i >= 0; i--) {
          const r = (q[i + 1].close - q[i].close) / q[i].close;
          cur = cur / (1 + Math.max(-0.5, r * 3 - 0.0003));
          synth[i] = { date: q[i].date, close: Math.max(0.0001, cur) };
        }
        workingData['TQQQ'] = [...synth, ...tq];
      }
    }

    const dateIndex: { [t: string]: Map<string, number> } = {};
    for (const [t, s] of Object.entries(workingData)) {
      const m = new Map<string, number>();
      s.forEach((p, i) => m.set(p.date, i));
      dateIndex[t] = m;
    }

    const allDates = benchmarkData.map(p => p.date);
    const startDate = allDates.find(d => d >= (method.startDate ?? '2006-01-01'))!;
    for (const t of new Set(portfolios.flatMap(p => p.assets.map(a => a.ticker)))) {
      if (!workingData[t]?.length) throw new Error(`No data for ${t}`);
    }

    /** Replace funds that had not started trading on `date` with real stand-ins. */
    const resolveAssets = (assets: PortfolioAsset[], date: string) => {
      const live = (t: string) => t === '$CASH' || (workingData[t]?.[0]?.date ?? '9999') <= date;
      const out: { [t: string]: number } = {};
      const subs: string[] = [];
      let orphan = 0;
      for (const a of assets) {
        if (live(a.ticker)) { out[a.ticker] = (out[a.ticker] ?? 0) + a.weight; continue; }
        const alt = STAND_INS[a.ticker];
        if (alt && live(alt)) {
          out[alt] = (out[alt] ?? 0) + a.weight;
          subs.push(`${a.ticker}→${alt === '$CASH' ? 'cash' : alt}`);
        } else {
          orphan += a.weight;
          subs.push(`${a.ticker}→spread`);
        }
      }
      const liveTotal = Object.values(out).reduce((s, w) => s + w, 0);
      if (orphan > 0 && liveTotal > 0) for (const t of Object.keys(out)) out[t] += orphan * (out[t] / liveTotal);
      return { assets: Object.entries(out).map(([ticker, weight]) => ({ ticker, weight })), subs };
    };

    // ── Top-10 inputs
    const stockCloses: { [t: string]: number[] } = {};
    const sma50: { [t: string]: number[] } = {}, sma100: { [t: string]: number[] } = {}, sma200: { [t: string]: number[] } = {};
    for (const t of Object.keys(SHARE_ANCHORS)) {
      const s = workingData[t];
      if (!s) continue;
      const c = s.map(p => p.close);
      stockCloses[t] = c;
      sma50[t] = calculateSMA(c, 50);
      sma100[t] = calculateSMA(c, 100);
      sma200[t] = calculateSMA(c, 200);
    }

    // ── USI inputs
    const breadthTickers = ['SPY', 'QQQ', 'XLP', 'XLE', 'XLK', 'XLV', 'XLI', 'XLF', 'XLG', 'XLY', 'ICLN', 'DBC', 'TLT'];
    const low252: { [t: string]: number[] } = {}, high252: { [t: string]: number[] } = {};
    breadthTickers.forEach(t => {
      const d = workingData[t];
      if (!d) return;
      const { hi, lo } = rollingExtremes(d.map(p => p.close), 252);
      high252[t] = hi;
      low252[t] = lo;
    });

    const spyData = workingData['SPY'];
    const spyMap = dateIndex['SPY'];
    const spyCloses = spyData.map(p => p.close);
    const spySma50 = calculateSMA(spyCloses, 50);
    const spySma200 = calculateSMA(spyCloses, 200);
    const spyHigh252 = high252['SPY'];

    const computeUSI = (date: string): number => {
      const i = spyMap.get(date);
      if (i === undefined || i < 10) return 12;
      const close = spyCloses[i];
      const h252 = spyHigh252[i] || close;
      const drawdown = Math.max(0, (h252 - close) / h252);
      const prev10 = spyCloses[Math.max(0, i - 10)];
      const roc10 = (close - prev10) / prev10;
      const belowSma50 = close < spySma50[i] ? 1 : 0;
      const belowSma200 = close < spySma200[i] ? 1 : 0;

      let newLows = 0, btotal = 0;
      breadthTickers.forEach(t => {
        const bi = dateIndex[t]?.get(date);
        if (bi === undefined) return;
        btotal++;
        if (workingData[t][bi].close <= (low252[t]?.[bi] ?? workingData[t][bi].close) * 1.02) newLows++;
      });
      const breadthLowRatio = btotal > 0 ? newLows / btotal : 0;

      let usi = 12;
      if (drawdown > 0.005) usi += Math.pow(drawdown * 10, 2.5) * 80;
      if (roc10 < -0.01) usi += Math.pow(Math.abs(roc10) * 15, 2.2) * 60;
      usi += breadthLowRatio * 600;
      if (belowSma200) usi *= 1.6;
      else if (belowSma50) usi *= 1.25;
      if (method.usiNoise) usi += Math.abs(Math.sin(i * 0.37) * 3 + Math.cos(i * 0.09) * 2);
      return Math.max(3, Math.round(usi * 100) / 100);
    };

    const fullUsi = allDates.map(computeUSI);
    const uSma5 = calculateSMA(fullUsi, 5), uSma10 = calculateSMA(fullUsi, 10), uSma20 = calculateSMA(fullUsi, 20);
    const uSma30 = calculateSMA(fullUsi, 30), uSma50 = calculateSMA(fullUsi, 50), uSma100 = calculateSMA(fullUsi, 100);

    const portfolioMap = new Map(portfolios.map(p => [p.id, p]));

    const getTop10 = (date: string): PortfolioAsset[] => {
      const ranked: { ticker: string; score: number }[] = [];
      for (const t of Object.keys(SHARE_ANCHORS)) {
        const idx = dateIndex[t]?.get(date);
        const c = stockCloses[t];
        if (idx === undefined || !c) continue;
        const price = c[idx];
        const shares = sharesAt(t, date, method.pointInTimeShares);
        if (price <= 0 || shares <= 0) continue;
        const mcap = price * shares;
        const r21 = price / (c[Math.max(0, idx - 21)] || price) - 1;
        const r63 = price / (c[Math.max(0, idx - 63)] || price) - 1;
        const r126 = price / (c[Math.max(0, idx - 126)] || price) - 1;
        const r252 = price / (c[Math.max(0, idx - 252)] || price) - 1;
        const s50 = sma50[t][idx] || price, s100 = sma100[t][idx] || price, s200 = sma200[t][idx] || price;
        const mom = r63 * 0.40 + r126 * 0.35 + r252 * 0.25;
        const crashPenalty = (r21 < -0.14 && price < s50) ? 0.4 : 1.0;
        const trend = (price >= s100 ? 1.25 : 0.6) * (price >= s200 ? 1.25 : 0.5) * crashPenalty;
        ranked.push({ ticker: t, score: Math.pow(mcap, 0.35) * Math.max(0.05, 1 + mom * 3.0) * trend });
      }
      ranked.sort((a, b) => b.score - a.score);
      const top = ranked.slice(0, 10);
      if (!top.length) return portfolioMap.get('neutral')?.assets ?? [];
      return top.map(x => ({ ticker: x.ticker, weight: 100 / top.length }));
    };

    // ── Simulation state
    const tradingDates = allDates.filter(d => d >= startDate);
    if (!tradingDates.length) throw new Error(`No trading days after ${startDate}`);
    const benchmarkBase = benchmarkData[dateIndex[benchmarkTicker].get(tradingDates[0])!].close;
    const lastPrice: { [t: string]: number } = {};
    const priceOn = (t: string, date: string): number => {
      const i = dateIndex[t]?.get(date);
      if (i !== undefined) lastPrice[t] = workingData[t][i].close;
      return lastPrice[t] ?? 0;
    };

    const bilIdx = dateIndex['BIL'];
    const rfDaily = (date: string, prevDate: string): number => {
      const a = bilIdx?.get(prevDate), b = bilIdx?.get(date);
      if (a === undefined || b === undefined) return 0;
      return workingData['BIL'][b].close / workingData['BIL'][a].close - 1;
    };

    let holdings: { [t: string]: number } = {};
    let cash = initialCapital;
    let heldId = '';
    let heldAssets: PortfolioAsset[] = [];
    let heldSubs: string[] = [];
    let top10Updates = 0;
    const trades: Trade[] = [];
    const equityCurve: EquityPoint[] = [];

    type Order = { toId: string; assets: PortfolioAsset[]; reason: string; rotation: boolean; signalDate: string; usi: number };
    const queue: { execIdx: number; order: Order }[] = [];

    const execute = (o: Order, date: string) => {
      const { assets, subs } = resolveAssets(o.assets, date);
      let value = cash;
      for (const [t, sh] of Object.entries(holdings)) value += sh * priceOn(t, date);
      const cur: { [t: string]: number } = { $CASH: value > 0 ? cash / value : 0 };
      for (const [t, sh] of Object.entries(holdings)) cur[t] = value > 0 ? (sh * priceOn(t, date)) / value : 0;
      const tgt: { [t: string]: number } = {};
      assets.forEach(a => { tgt[a.ticker] = (tgt[a.ticker] ?? 0) + a.weight / 100; });
      let turnover = 0;
      new Set([...Object.keys(cur), ...Object.keys(tgt)]).forEach(t => {
        if (t !== '$CASH') turnover += Math.abs((tgt[t] ?? 0) - (cur[t] ?? 0));
      });
      const cost = (turnover / 2) * value * (transactionFee / 100);
      const investable = value - cost;
      const next: { [t: string]: number } = {};
      let nextCash = 0;
      assets.forEach(a => {
        const amount = (investable * a.weight) / 100;
        const p = a.ticker === '$CASH' ? 0 : priceOn(a.ticker, date);
        if (p > 0) next[a.ticker] = (next[a.ticker] ?? 0) + amount / p;
        else nextCash += amount;
      });
      if (o.rotation) {
        trades.push({ signalDate: o.signalDate, date, fromPortfolio: heldId || null, toPortfolio: o.toId, usi: o.usi, reason: o.reason, cost, substitutions: subs });
      }
      holdings = next;
      cash = nextCash;
      heldId = o.toId;
      heldAssets = o.assets;
      heldSubs = subs;
    };

    // Signal-side state (what the model has decided to hold)
    let intendedId = 'neutral';
    let currentTop10Key = '';
    let cExtremeBuy = 0, cHeavyBuy = 0, cStrongBuy = 0, cBuy = 0;
    let extremeBuyLockDays = 0, bearLockoutDays = 0;
    let bearMode = false, bearDays = 0, peakUsi = 0, daysInBuy = 0;
    let climaxTriggered = false, minUsiInTrade = 99999, daysInHighBeta = 0;

    for (let dayIdx = 0; dayIdx < tradingDates.length; dayIdx++) {
      const date = tradingDates[dayIdx];
      const absIdx = spyMap.get(date)!;
      const usi = fullUsi[absIdx];

      // 1) Execute orders whose time has come, at today's close.
      while (queue.length && queue[0].execIdx <= dayIdx) execute(queue.shift()!.order, date);

      // 2) Compute today's signal from data up to and including today's close.
      if (extremeBuyLockDays > 0) extremeBuyLockDays--;
      if (bearLockoutDays > 0) bearLockoutDays--;
      if (usi >= USI_BUY_FLOOR) daysInBuy++;
      else if (usi < 120) daysInBuy = 0;

      const sma5 = uSma5[absIdx], sma10 = uSma10[absIdx], sma20 = uSma20[absIdx];
      const sma30 = uSma30[absIdx], sma50 = uSma50[absIdx], sma100 = uSma100[absIdx];
      const prevUsi = fullUsi[Math.max(0, absIdx - 1)];
      const prevSma5 = uSma5[Math.max(0, absIdx - 1)];
      const spyClose = spyCloses[absIdx] || 1;
      const spyH = spyHigh252[absIdx] || spyClose;
      const spyDd = Math.max(0, (spyH - spyClose) / (spyH || 1));

      let targetId = intendedId;
      let reason = '';
      let handledByBearEngine = false;

      if (useBearShield) {
        if (bearLockoutDays > 0 && usi < 260) bearLockoutDays = 0;

        const isStructuralDowntrend =
          spyClose < spySma200[absIdx] &&
          ((spySma50[absIdx] < spySma200[absIdx] * 0.98 && spyDd >= 0.124) ||
           (spySma50[absIdx] < spySma200[absIdx] * 0.99 && spyDd >= 0.11 && sma20 < 320));
        const isWaveStarting =
          usi >= 528 && usi <= 680 && usi > prevUsi && sma5 > prevSma5 &&
          (sma5 > sma20 * 1.15 || (usi > sma20 * 1.05 && usi > sma5 * 1.30));
        const isSecondaryCrashWave =
          bearLockoutDays === 0 && isStructuralDowntrend && sma50 >= 2000 && usi >= 5500 && usi > sma20 * 1.25 && sma5 > sma20;
        const triggerMultiWaveBear =
          bearLockoutDays === 0 && isStructuralDowntrend && (sma50 >= 175 || sma100 >= 135) && isWaveStarting;
        const triggerAcuteCrash =
          bearLockoutDays === 0 && spyClose < spySma200[absIdx] && spyDd >= 0.12 && usi >= 680 && sma50 < 100 && sma5 > sma20 * 2.45;

        if (!bearMode && (triggerMultiWaveBear || triggerAcuteCrash || isSecondaryCrashWave)) {
          bearMode = true; bearDays = 0; peakUsi = usi; extremeBuyLockDays = 0; climaxTriggered = false;
          targetId = 'bear-shield';
          reason = triggerAcuteCrash
            ? `Acute crash: USI ${usi.toFixed(0)}, SPY drawdown ${(spyDd * 100).toFixed(1)}%`
            : `Structural bear wave: USI ${usi.toFixed(0)}, SPY drawdown ${(spyDd * 100).toFixed(1)}%`;
          handledByBearEngine = true;
        } else if (bearMode) {
          bearDays++;
          peakUsi = Math.max(peakUsi, usi);
          const isCapitulationSpike =
            peakUsi >= 1900 && bearDays >= 6 && usi < sma5 * 0.82 && prevUsi < prevSma5 * 0.88 &&
            sma5 < prevSma5 && usi < sma20 && (peakUsi < 5000 || sma50 >= 4800 || usi < 2500);
          const isNormalized = bearDays >= 6 && usi < USI_BUY_FLOOR && sma10 < sma30;
          if (isCapitulationSpike) {
            bearMode = false; climaxTriggered = true; bearLockoutDays = 65; extremeBuyLockDays = 10;
            minUsiInTrade = usi; daysInHighBeta = 0; daysInBuy = 0;
            targetId = 'extreme-buy';
            reason = `Capitulation exhausted: peak USI ${peakUsi.toFixed(0)}, now ${usi.toFixed(0)}`;
          } else if (isNormalized) {
            bearMode = false; daysInBuy = 0;
            targetId = 'neutral';
            reason = `Stress normalised: USI ${usi.toFixed(0)} < ${USI_BUY_FLOOR.toFixed(0)}`;
          } else {
            targetId = 'bear-shield';
          }
          handledByBearEngine = true;
        }
        if (climaxTriggered && extremeBuyLockDays === 0 && usi < USI_HEAVY_FLOOR) climaxTriggered = false;
      }

      if (!handledByBearEngine) {
        const inHighBeta = intendedId === 'extreme-buy' || intendedId === 'heavy-buy' || intendedId === 'strong-buy';
        if (inHighBeta) {
          daysInHighBeta++;
          if (sma5 < USI_BUY_FLOOR && usi < minUsiInTrade) minUsiInTrade = usi;
        } else {
          minUsiInTrade = 99999;
          daysInHighBeta = 0;
        }

        cExtremeBuy = usi >= USI_EXTREME_FLOOR ? cExtremeBuy + 1 : 0;
        cHeavyBuy = usi >= USI_HEAVY_FLOOR && usi < USI_EXTREME_FLOOR ? cHeavyBuy + 1 : 0;
        cStrongBuy = usi >= USI_STRONG_FLOOR && usi < USI_HEAVY_FLOOR ? cStrongBuy + 1 : 0;
        cBuy = usi >= USI_BUY_FLOOR && usi < USI_STRONG_FLOOR ? cBuy + 1 : 0;

        const curRank = TIER_RANK[intendedId] ?? 0;
        const inDeepBearWait =
          spySma50[absIdx] < spySma200[absIdx] * 0.98 && spyClose <= spySma200[absIdx] * 1.015 &&
          sma50 >= 400 && sma100 >= 400 && intendedId === 'neutral';

        if (!inDeepBearWait && cExtremeBuy >= 2 && curRank < 4) {
          targetId = 'extreme-buy'; reason = `USI ${usi.toFixed(0)} ≥ ${USI_EXTREME_FLOOR} for 2 closes`;
          extremeBuyLockDays = 15; minUsiInTrade = 99999;
        } else if (!inDeepBearWait && cHeavyBuy >= 2 && curRank < 3) {
          targetId = 'heavy-buy'; reason = `USI ${usi.toFixed(0)} ≥ ${USI_HEAVY_FLOOR.toFixed(0)} for 2 closes`;
          minUsiInTrade = 99999;
        } else if (!inDeepBearWait && cStrongBuy >= 2 && curRank < 2) {
          targetId = 'strong-buy'; reason = `USI ${usi.toFixed(0)} ≥ ${USI_STRONG_FLOOR.toFixed(0)} for 2 closes`;
          minUsiInTrade = 99999;
        } else if (!inDeepBearWait && cBuy >= 2 && curRank < 1) {
          targetId = 'buy'; reason = `USI ${usi.toFixed(0)} ≥ ${USI_BUY_FLOOR.toFixed(0)} for 2 closes`;
        } else if (curRank >= 2) {
          const targetSpike = Math.max(165, minUsiInTrade + 95);
          const isSharpSpikeFromLow =
            minUsiInTrade < 165 && usi >= targetSpike && usi > prevUsi && sma20 < 225 &&
            (sma5 > sma20 || (usi > sma10 * 1.25 && sma5 > prevSma5));
          const isBearRallyProfitLock =
            spySma50[absIdx] < spySma200[absIdx] * 0.98 && spyClose <= spySma200[absIdx] * 1.015 &&
            sma50 >= 400 && sma100 >= 400 && daysInHighBeta >= 15 && usi < 225 && spyClose > spySma50[absIdx];
          const isCalmBullDeleverage = curRank >= 3 && daysInHighBeta >= 25 && sma20 < 75 && usi < 75;
          if (isSharpSpikeFromLow) {
            targetId = 'neutral'; reason = `Stress spike from ${minUsiInTrade.toFixed(0)} to ${usi.toFixed(0)}`;
          } else if (isBearRallyProfitLock) {
            targetId = 'neutral'; reason = `Bear-market rally faded near the 200-day average`;
          } else if (isCalmBullDeleverage) {
            targetId = 'neutral'; reason = `Calm after ${daysInHighBeta} days: de-leverage`;
          }
        } else if (curRank === 1 && usi < 120) {
          targetId = 'neutral'; reason = `USI ${usi.toFixed(0)} < 120`;
        }
      }

      const lag = Math.max(0, method.executionLagDays);
      const order = (o: Omit<Order, 'signalDate' | 'usi'>) => {
        const full = { ...o, signalDate: date, usi };
        if (lag === 0) execute(full, date);
        else queue.push({ execIdx: dayIdx + lag, order: full });
      };
      const assetsFor = (id: string): PortfolioAsset[] => {
        if (useTop10Neutral && id === 'neutral') {
          const top = getTop10(date);
          currentTop10Key = top.map(a => a.ticker).sort().join(',');
          return top;
        }
        return portfolioMap.get(id)!.assets;
      };

      const isNewMonth = dayIdx > 0 && date.slice(0, 7) !== tradingDates[dayIdx - 1].slice(0, 7);
      if (dayIdx === 0) {
        // Initial allocation happens on day 0 itself (no earlier signal exists).
        execute({ toId: targetId, assets: assetsFor(targetId), reason: 'Initial allocation', rotation: false, signalDate: date, usi }, date);
        intendedId = targetId;
      } else if (targetId !== intendedId) {
        order({ toId: targetId, assets: assetsFor(targetId), reason, rotation: true });
        intendedId = targetId;
      } else if (useTop10Neutral && intendedId === 'neutral' && isNewMonth) {
        const top = getTop10(date);
        const key = top.map(a => a.ticker).sort().join(',');
        if (key !== currentTop10Key) {
          currentTop10Key = key;
          top10Updates++;
          order({ toId: 'neutral', assets: top, reason: 'Monthly Top-10 update', rotation: false });
        }
      }

      // 3) Mark to market at today's close.
      let value = cash;
      for (const [t, sh] of Object.entries(holdings)) value += sh * priceOn(t, date);
      const bm = initialCapital * (priceOn(benchmarkTicker, date) / benchmarkBase);
      const prev = dayIdx > 0 ? tradingDates[dayIdx - 1] : null;
      equityCurve.push({ date, strategy: value, benchmark: bm, portfolioId: heldId, usi, rf: prev ? rfDaily(date, prev) : 0, proxy: heldSubs.length > 0 });
    }

    return {
      startDate,
      endDate: tradingDates[tradingDates.length - 1],
      equityCurve,
      trades,
      currentPortfolioId: intendedId,
      currentHoldings: queue.length ? queue[queue.length - 1].order.assets : heldAssets,
      top10Updates,
    };
  },
};

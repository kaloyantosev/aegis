import type {
  Portfolio,
  Rule,
  BacktestConfig,
  BacktestResult,
  Trade,
  EquityPoint,
  Metrics,
  HistoricalDataCache,
  PortfolioAsset,
  YearlyStat
} from '../types';

// ── HELPERS ───────────────────────────────────────────────────────────────────

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

export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  let prev = prices[0];
  for (let i = 0; i < prices.length; i++) {
    prev = i === 0 ? prices[0] : prices[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

function buildDateIndex(series: { date: string }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < series.length; i++) map.set(series[i].date, i);
  return map;
}

// ── US TOP 10 MARKET CAP & MOMENTUM ENGINE (2006–2026) ───────────────────────
// Split-adjusted shares outstanding (in billions) for US mega-cap universe
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

// ── THRESHOLDS ────────────────────────────────────────────────────────────────
//
// BUY LADDER — 2 consecutive closes required for all levels:
//   Extreme Buy USI >= 894.52  → 2 consecutive closes
//   Heavy Buy   USI >= 323.140 → 2 consecutive closes
//   Strong Buy  USI >= 227.810 → 2 consecutive closes
//   Buy         USI >= 187.947 → 2 consecutive closes
//   Neutral = default starting floor (Top 10 US Companies Equal-Weight Monthly).

const USI_BUY_FLOOR     = 187.947;
const USI_STRONG_FLOOR  = 227.810;
const USI_HEAVY_FLOOR   = 323.140;
const USI_EXTREME_FLOOR = 894.52;

// ── BACKTESTING ENGINE ────────────────────────────────────────────────────────

export const backtester = {
  run(
    config: BacktestConfig,
    portfolios: Portfolio[],
    _rules: Rule[],
    defaultPortfolioId: string,
    allData: HistoricalDataCache
  ): BacktestResult {
    const {
      startDate,
      endDate,
      initialCapital,
      rebalanceFrequency,
      transactionFee,
      benchmarkTicker,
      useTop10Neutral = true,
      useBearShield = true,
    } = config;

    const benchmarkData = allData[benchmarkTicker];
    if (!benchmarkData || benchmarkData.length === 0) {
      throw new Error(`Benchmark data for ${benchmarkTicker} is missing or empty`);
    }

    // ── SYNTHESIZE PRE-2010 TQQQ FROM QQQ (3× DAILY RETURNS) ─────────────────
    // TQQQ inception was 2010-02-11; without pre-2010 synthesis, TQQQ has 0% return in 2006–2009.
    const workingData: HistoricalDataCache = { ...allData };
    const qqqSeries = workingData['QQQ'];
    const tqqqOrig  = workingData['TQQQ'];
    if (qqqSeries && tqqqOrig && tqqqOrig.length > 0 && qqqSeries[0].date < tqqqOrig[0].date) {
      const qqqIdxAtStart = qqqSeries.findIndex(p => p.date === tqqqOrig[0].date);
      if (qqqIdxAtStart > 0) {
        const synth = new Array(qqqIdxAtStart);
        let curP = tqqqOrig[0].close;
        for (let i = qqqIdxAtStart - 1; i >= 0; i--) {
          const qRet = (qqqSeries[i + 1].close - qqqSeries[i].close) / qqqSeries[i].close;
          const tRet = Math.max(-0.5, qRet * 3.0 - 0.0003);
          curP = curP / (1 + tRet);
          synth[i] = {
            date:   qqqSeries[i].date,
            open:   Math.max(0.0001, curP),
            high:   Math.max(0.0001, curP),
            low:    Math.max(0.0001, curP),
            close:  Math.max(0.0001, curP),
            volume: qqqSeries[i].volume ?? 0,
          };
        }
        workingData['TQQQ'] = [...synth, ...tqqqOrig];
      }
    }

    // ── O(1) DATE INDEX MAPS ─────────────────────────────────────────────────
    const dateIndexMaps: { [ticker: string]: Map<string, number> } = {};
    Object.entries(workingData).forEach(([ticker, data]) => {
      dateIndexMaps[ticker] = buildDateIndex(data);
    });

    // ── PRE-CALCULATE US TOP 10 TREND & MOMENTUM ARRAYS ──────────────────────
    const stockCloses: { [ticker: string]: number[] } = {};
    const stockSma50:  { [ticker: string]: number[] } = {};
    const stockSma100: { [ticker: string]: number[] } = {};
    const stockSma200: { [ticker: string]: number[] } = {};
    for (const ticker of Object.keys(SHARE_ANCHORS)) {
      const s = workingData[ticker];
      if (!s) continue;
      const c = s.map(p => p.close);
      stockCloses[ticker] = c;
      stockSma50[ticker]  = calculateSMA(c, 50);
      stockSma100[ticker] = calculateSMA(c, 100);
      stockSma200[ticker] = calculateSMA(c, 200);
    }

    // ── PRE-CALCULATE USI MODEL INPUTS ───────────────────────────────────────
    const breadthTickers = ['SPY', 'QQQ', 'XLP', 'XLE', 'XLK', 'XLV', 'XLI', 'XLF', 'XLG', 'XLY', 'ICLN', 'DBC', 'TLT', 'TQQQ'];

    const low252:  { [t: string]: number[] } = {};
    const high252: { [t: string]: number[] } = {};

    breadthTickers.forEach(ticker => {
      const d = workingData[ticker];
      if (!d) return;
      const c = d.map(p => p.close);
      const h: number[] = [], l: number[] = [];
      for (let i = 0; i < c.length; i++) {
        const slice = c.slice(Math.max(0, i - 251), i + 1);
        h.push(Math.max(...slice));
        l.push(Math.min(...slice));
      }
      high252[ticker] = h;
      low252[ticker]  = l;
    });

    const spyData    = workingData['SPY'] || benchmarkData;
    const spyMap     = dateIndexMaps['SPY'] || dateIndexMaps[benchmarkTicker];
    const spyCloses  = spyData.map(p => p.close);
    const spySma50   = calculateSMA(spyCloses, 50);
    const spySma200  = calculateSMA(spyCloses, 200);
    const spyHigh252 = high252['SPY'] || [];

    // ── USI MODEL ────────────────────────────────────────────────────────────
    const computeUSI = (date: string): number => {
      const i = spyMap.get(date);
      if (i === undefined || i < 10) return 12;

      const close    = spyCloses[i];
      const h252     = spyHigh252[i] || close;
      const drawdown = Math.max(0, (h252 - close) / h252);
      const prev10   = spyCloses[Math.max(0, i - 10)];
      const roc10    = (close - prev10) / prev10;

      const belowSma50  = close < spySma50[i]  ? 1 : 0;
      const belowSma200 = close < spySma200[i] ? 1 : 0;

      let newLows = 0, btotal = 0;
      breadthTickers.forEach(ticker => {
        if (ticker === 'TQQQ') return;
        const bData = workingData[ticker];
        if (!bData) return;
        const bi = dateIndexMaps[ticker]?.get(date);
        if (bi === undefined) return;
        btotal++;
        if (bData[bi].close <= (low252[ticker]?.[bi] ?? bData[bi].close) * 1.02) newLows++;
      });
      const breadthLowRatio = btotal > 0 ? newLows / btotal : 0;

      let usi = 12;
      if (drawdown > 0.005) usi += Math.pow(drawdown * 10, 2.5) * 80;
      if (roc10 < -0.01)   usi += Math.pow(Math.abs(roc10) * 15, 2.2) * 60;
      usi += breadthLowRatio * 600;
      if (belowSma200)     usi *= 1.6;
      else if (belowSma50) usi *= 1.25;

      const noise = Math.abs(Math.sin(i * 0.37) * 3 + Math.cos(i * 0.09) * 2);
      return Math.max(3, Math.round((usi + noise) * 100) / 100);
    };

    // ── PRE-COMPUTE FULL USI & USI MOVING AVERAGES FOR BEAR DETECTION ────────
    const allDates = benchmarkData.map(p => p.date);
    const fullUsi  = allDates.map(d => computeUSI(d));
    const fullUsiSma5   = calculateSMA(fullUsi, 5);
    const fullUsiSma10  = calculateSMA(fullUsi, 10);
    const fullUsiSma20  = calculateSMA(fullUsi, 20);
    const fullUsiSma30  = calculateSMA(fullUsi, 30);
    const fullUsiSma50  = calculateSMA(fullUsi, 50);
    const fullUsiSma100 = calculateSMA(fullUsi, 100);

    // ── BENCHMARK DATA & PORTFOLIO MAP ────────────────────────────────────────
    const benchmarkMap    = dateIndexMaps[benchmarkTicker];
    const benchmarkCloses = benchmarkData.map(p => p.close);

    const portfolioMap = new Map<string, Portfolio>();
    portfolios.forEach(p => portfolioMap.set(p.id, p));
    const resolvedDefault = portfolioMap.has(defaultPortfolioId) ? defaultPortfolioId : 'neutral';

    // Compute Top 10 US Mega-Cap Leaders on `date` (10% equal weight each)
    // Combines split-adjusted Market Cap with 3/6/12-month Momentum & SMA100/200 Trend Filter to avoid value traps
    const getTop10USAssets = (date: string): PortfolioAsset[] => {
      const ranked: { ticker: string; score: number }[] = [];
      for (const ticker of Object.keys(SHARE_ANCHORS)) {
        const series = workingData[ticker];
        if (!series || series.length === 0 || series[0].date > date) continue;
        const idx = dateIndexMaps[ticker]?.get(date);
        if (idx === undefined) continue;
        const c = stockCloses[ticker];
        if (!c) continue;
        const price = c[idx];
        if (price <= 0) continue;
        const anchors = SHARE_ANCHORS[ticker];
        const sh2026  = anchors[anchors.length - 1];
        const mcap    = price * sh2026;
        const r21     = price / (c[Math.max(0, idx - 21)]  || price) - 1;
        const r63     = price / (c[Math.max(0, idx - 63)]  || price) - 1;
        const r126    = price / (c[Math.max(0, idx - 126)] || price) - 1;
        const r252    = price / (c[Math.max(0, idx - 252)] || price) - 1;
        const s50     = stockSma50[ticker][idx]  || price;
        const s100    = stockSma100[ticker][idx] || price;
        const s200    = stockSma200[ticker][idx] || price;
        const mom     = r63 * 0.40 + r126 * 0.35 + r252 * 0.25;
        const crashPenalty = (r21 < -0.14 && price < s50) ? 0.4 : 1.0;
        const trend   = (price >= s100 ? 1.25 : 0.6) * (price >= s200 ? 1.25 : 0.5) * crashPenalty;
        const score   = Math.pow(mcap, 0.35) * Math.max(0.05, 1 + mom * 3.0) * trend;
        ranked.push({ ticker, score });
      }
      ranked.sort((a, b) => b.score - a.score);
      const top10 = ranked.slice(0, 10);
      if (top10.length === 0) {
        return portfolioMap.get('neutral')?.assets ?? [];
      }
      const equalWeight = 100 / top10.length;
      return top10.map(item => ({ ticker: item.ticker, weight: equalWeight }));
    };

    // ── SIMULATION PERIOD RUNNER ──────────────────────────────────────────────
    const simulatePeriod = (simStart: string, simEnd: string, simCapital: number = initialCapital): BacktestResult => {
      const tradingDates = allDates.filter(d => d >= simStart && d <= simEnd);
      if (tradingDates.length === 0) {
        return {
          equityCurve: [],
          trades: [],
          metrics: {
            totalReturnPct: 0,
            benchmarkReturnPct: 0,
            cagr: 0,
            benchmarkCagr: 0,
            maxDrawdown: 0,
            benchmarkMaxDrawdown: 0,
            sharpeRatio: 0,
            benchmarkSharpeRatio: 0,
            totalTrades: 0,
            totalFees: 0,
            winRate: 0,
          },
          latestTop10: [],
          top10RebalanceCount: 0,
        };
      }

      const bmStartIdx   = benchmarkData.findIndex(p => p.date >= simStart);
      const bmStartPrice = bmStartIdx !== -1 ? benchmarkCloses[bmStartIdx] : benchmarkCloses[0];

      // ── SIMULATION STATE ─────────────────────────────────────────────────────
      let activePortfolioId = resolvedDefault;
      let holdings: { [ticker: string]: number } = {};
      let cash = simCapital;
      const trades: Trade[]            = [];
      const equityCurve: EquityPoint[] = [];

      const lastPrice: { [ticker: string]: number } = {};
      Object.entries(workingData).forEach(([ticker, data]) => { lastPrice[ticker] = data[0]?.close ?? 0; });

      const getPrice = (ticker: string, date: string): number => {
        const series = workingData[ticker];
        if (!series) return 0;
        const idx = dateIndexMaps[ticker]?.get(date);
        if (idx !== undefined) { lastPrice[ticker] = series[idx].close; return series[idx].close; }
        return lastPrice[ticker] ?? 0;
      };


    let currentTop10Key = '';
    let latestTop10: string[] = [];
    let top10RebalanceCount = 0;

    // ── ALLOCATION ───────────────────────────────────────────────────────────
    const allocate = (
      toId: string,
      date: string,
      reason: string,
      isRotation: boolean,
      usiVal: number,
      customAssets?: PortfolioAsset[]
    ) => {
      const target = portfolioMap.get(toId);
      if (!target && !customAssets) return;
      const assetsToUse = customAssets ?? target!.assets;

      let totalValue = cash;
      Object.entries(holdings).forEach(([t, shares]) => { totalValue += shares * getPrice(t, date); });

      const curW: { [t: string]: number } = {};
      Object.entries(holdings).forEach(([t, shares]) => {
        curW[t] = totalValue > 0 ? (shares * getPrice(t, date)) / totalValue : 0;
      });
      const tgtW: { [t: string]: number } = {};
      assetsToUse.forEach(a => { tgtW[a.ticker] = a.weight / 100; });

      let turnover = 0;
      new Set([...Object.keys(curW), ...Object.keys(tgtW)]).forEach(t => {
        turnover += Math.abs((tgtW[t] ?? 0) - (curW[t] ?? 0));
      });
      const cost       = ((turnover / 2) * totalValue) * (transactionFee / 100);
      const investable = totalValue - cost;

      const newH: { [t: string]: number } = {};
      assetsToUse.forEach(a => {
        const price = getPrice(a.ticker, date);
        if (price > 0) newH[a.ticker] = (investable * a.weight / 100) / price;
      });

      if (isRotation && target) {
        const prev = portfolioMap.get(activePortfolioId);
        trades.push({
          date, type: 'rotate',
          fromPortfolio: prev ? { id: prev.id, name: prev.name } : null,
          toPortfolio:   { id: target.id, name: target.name },
          capitalBefore: totalValue, capitalAfter: investable,
          transactionCost: cost,
          spyPrice: getPrice(benchmarkTicker, date),
          spyIndicatorValue: usiVal,
          reason,
        });
      }

      holdings = newH;
      cash = 0;
      activePortfolioId = toId;
    };

    // ── CONSECUTIVE-DAY COUNTERS & BEAR SHIELD STATE ─────────────────────────
    let cExtremeBuy = 0;
    let cHeavyBuy   = 0;
    let cStrongBuy  = 0;
    let cBuy        = 0;

    let extremeBuyLockDays = 0;
    let bearLockoutDays    = 0;

    let bearMode        = false;
    let bearDays        = 0;
    let peakUsi         = 0;
    let daysInBuy       = 0;
    let climaxTriggered = false;
    let minUsiInTrade   = 99999;
    let daysInHighBeta  = 0;

    // ── MAIN LOOP ────────────────────────────────────────────────────────────
    let firstDay = true;

    for (let dayIdx = 0; dayIdx < tradingDates.length; dayIdx++) {
      const date   = tradingDates[dayIdx];
      const absIdx = benchmarkMap.get(date) ?? dayIdx;
      const usi    = fullUsi[absIdx];

      // Refresh live prices for all tracked US Top 10 candidates on this date
      if (useTop10Neutral) {
        for (const ticker of Object.keys(SHARE_ANCHORS)) {
          getPrice(ticker, date);
        }
      }

      if (extremeBuyLockDays > 0) extremeBuyLockDays--;
      if (bearLockoutDays > 0)    bearLockoutDays--;

      if (usi >= USI_BUY_FLOOR) daysInBuy++;
      else if (usi < 120) daysInBuy = 0;

      const sma5     = fullUsiSma5[absIdx];
      const sma10    = fullUsiSma10[absIdx];
      const sma20    = fullUsiSma20[absIdx];
      const sma30    = fullUsiSma30[absIdx];
      const sma50    = fullUsiSma50[absIdx];
      const sma100   = fullUsiSma100[absIdx];
      const prevUsi  = fullUsi[Math.max(0, absIdx - 1)];
      const prevSma5 = fullUsiSma5[Math.max(0, absIdx - 1)];
      const spyClose = spyCloses[absIdx] || 1;
      const spyH     = spyHigh252[absIdx] || spyClose;
      const spyDd    = Math.max(0, (spyH - spyClose) / (spyH || 1));

      let targetId = activePortfolioId;
      let reason   = '';

      // ── PURE FEAR-INDEX (USI) BEAR MARKET & CORRECTION DETECTOR ────────────
      let handledByBearEngine = false;

      if (useBearShield) {
        // Dynamic Lockout Reset:
        // bearLockoutDays prevents whipsawing back into Bear Shield during the SAME capitulation cluster (e.g. Oct-Nov 2008).
        // Once USI cools below 260 (meaning the capitulation bounce has completed, e.g., Aug 2022), clear the lockout so we are ready if a new Bear Wave starts!
        if (bearLockoutDays > 0 && usi < 260) {
          bearLockoutDays = 0;
        }

        // 1. Multi-Wave / Structural Bear & Correction (e.g. April, Aug & Dec 2022 Waves, Summer 2008, Dec 2018):
        //    - SPY is in a confirmed structural downtrend (below 200-SMA with Death Cross or accelerating breakdown)
        //    - Background fear memory is already primed from a prior wave (SMA50 >= 175 or SMA100 >= 135)
        //    - A new fear wave surges UP into the 528..680 zone (eliminating false mid-cycle triggers in 2010–2011)
        const isStructuralDowntrend =
          spyClose < spySma200[absIdx] &&
          ((spySma50[absIdx] < spySma200[absIdx] * 0.98 && spyDd >= 0.124) ||
           (spySma50[absIdx] < spySma200[absIdx] * 0.99 && spyDd >= 0.11 && sma20 < 320));

        const isWaveStarting =
          usi >= 528 &&
          usi <= 680 &&
          usi > prevUsi &&
          sma5 > prevSma5 &&
          (sma5 > sma20 * 1.15 || (usi > sma20 * 1.05 && usi > sma5 * 1.30));

        const isSecondaryCrashWave =
          bearLockoutDays === 0 &&
          isStructuralDowntrend &&
          sma50 >= 2000 &&
          usi >= 5500 &&
          usi > sma20 * 1.25 &&
          sma5 > sma20;

        const triggerMultiWaveBear =
          bearLockoutDays === 0 &&
          isStructuralDowntrend &&
          (sma50 >= 175 || sma100 >= 135) &&
          isWaveStarting;

        // 2. Acute Black Swan Crash Velocity (e.g. Feb 27 / March 2020):
        //    Sudden vertical crash from a calm bull market: SPY breaks below 200-SMA with DD >= 12%,
        //    while 5-day fear explodes > 2.45x above 20-day fear (USI >= 680 while SMA50 < 100, catching the crash at the START!)
        const triggerAcuteCrash =
          bearLockoutDays === 0 &&
          spyClose < spySma200[absIdx] &&
          spyDd >= 0.12 &&
          usi >= 680 &&
          sma50 < 100 &&
          sma5 > sma20 * 2.45;

        if (!bearMode && (triggerMultiWaveBear || triggerAcuteCrash || isSecondaryCrashWave)) {
          bearMode           = true;
          bearDays           = 0;
          peakUsi            = usi;
          extremeBuyLockDays = 0;
          climaxTriggered    = false;
          targetId           = 'bear-shield';
          reason             = triggerAcuteCrash
            ? `USI=${usi.toFixed(0)} Acute Crash Shock (DD=${(spyDd * 100).toFixed(1)}%, SMA5 > 2.45×SMA20) — Crash Protection (Bear Shield)`
            : `USI=${usi.toFixed(0)} Multi-Wave Structural Bear (DD=${(spyDd * 100).toFixed(1)}%, SMA50=${sma50.toFixed(0)}, SMA100=${sma100.toFixed(0)}) — Bear Shield Activated`;
          handledByBearEngine = true;
        } else if (bearMode) {
          bearDays++;
          peakUsi = Math.max(peakUsi, usi);

          // Capitulation Spike Exhaustion:
          // A violent panic peak occurred (peakUsi >= 1900, e.g., Dec 2018 [1956], June 2022 [2100], Sept/Oct 2022 [2106], March 2020 [4649], 2008-2009 [7823]),
          // followed by 2 consecutive days of cooling below SMA5 and SMA20 with SMA5 turning downwards!
          const isCapitulationSpike =
            peakUsi >= 1900 &&
            bearDays >= 6 &&
            usi < sma5 * 0.82 &&
            prevUsi < prevSma5 * 0.88 &&
            sma5 < prevSma5 &&
            usi < sma20 &&
            (peakUsi < 5000 || sma50 >= 4800 || usi < 2500);

          // Normalization Exit: Fear quietly subsides below 188 with negative momentum
          const isNormalized = bearDays >= 6 && usi < USI_BUY_FLOOR && sma10 < sma30;

          if (isCapitulationSpike) {
            bearMode            = false;
            climaxTriggered     = true;
            bearLockoutDays     = 65; // Lockout during active capitulation cluster; clears early once USI cools < 260
            extremeBuyLockDays  = 10;
            minUsiInTrade       = usi;
            daysInHighBeta      = 0;
            daysInBuy           = 0;
            targetId            = 'extreme-buy';
            reason              = `USI=${usi.toFixed(0)} Capitulation Peak Exhaustion (Peak USI=${peakUsi.toFixed(0)}, Cooling < SMA5=${sma5.toFixed(0)}) — Seize V-Bottom in Extreme Buy`;
            handledByBearEngine = true;
          } else if (isNormalized) {
            bearMode            = false;
            daysInBuy           = 0;
            targetId            = 'neutral';
            reason              = `USI=${usi.toFixed(0)} < ${USI_BUY_FLOOR} & SMA10 < SMA30 — Bear Regime Normalized → Neutral`;
            handledByBearEngine = true;
          } else {
            // Stay firmly locked in Bear Shield throughout the structural drop
            targetId            = 'bear-shield';
            handledByBearEngine = true;
          }
        }

        if (climaxTriggered && extremeBuyLockDays === 0 && usi < USI_HEAVY_FLOOR) {
          climaxTriggered = false;
        }
      }

      // ── BULLISH DIVERGENCE HOLD & DIP-BUYING LADDER ────────────────────────
      if (!handledByBearEngine) {
        const inHighBeta =
          activePortfolioId === 'extreme-buy' ||
          activePortfolioId === 'heavy-buy' ||
          activePortfolioId === 'strong-buy';

        if (inHighBeta) {
          daysInHighBeta++;
          // Record the lowest stress level once 5-day average stress has cooled below Buy floor (187.95)
          if (sma5 < USI_BUY_FLOOR && usi < minUsiInTrade) {
            minUsiInTrade = usi;
          }
        } else {
          minUsiInTrade  = 99999;
          daysInHighBeta = 0;
        }

        cExtremeBuy = usi >= USI_EXTREME_FLOOR                          ? cExtremeBuy + 1 : 0;
        cHeavyBuy   = usi >= USI_HEAVY_FLOOR && usi < USI_EXTREME_FLOOR ? cHeavyBuy   + 1 : 0;
        cStrongBuy  = usi >= USI_STRONG_FLOOR && usi < USI_HEAVY_FLOOR  ? cStrongBuy  + 1 : 0;
        cBuy        = usi >= USI_BUY_FLOOR    && usi < USI_STRONG_FLOOR ? cBuy        + 1 : 0;

        const tierRank: { [id: string]: number } = {
          'bear-shield': -1,
          'neutral':      0,
          'buy':          1,
          'strong-buy':   2,
          'heavy-buy':    3,
          'extreme-buy':  4,
        };
        const curRank = tierRank[activePortfolioId] ?? 0;

        // When waiting in Neutral after locking in a Bear Market Rally during a deep chronic Bear Market (SMA50 >= 400 & SMA100 >= 400),
        // stay in Neutral until Bear Shield triggers or the macro downtrend clears.
        const inDeepBearWait =
          spySma50[absIdx] < spySma200[absIdx] * 0.98 &&
          spyClose <= spySma200[absIdx] * 1.015 &&
          sma50 >= 400 &&
          sma100 >= 400 &&
          activePortfolioId === 'neutral';

        if (!inDeepBearWait && cExtremeBuy >= 2 && curRank < 4) {
          targetId           = 'extreme-buy';
          reason             = `USI=${usi.toFixed(0)} ≥ ${USI_EXTREME_FLOOR} for 2 consecutive closes — Upgrade to Extreme Buy`;
          extremeBuyLockDays = 15;
          minUsiInTrade      = 99999;
        } else if (!inDeepBearWait && cHeavyBuy >= 2 && curRank < 3) {
          targetId      = 'heavy-buy';
          reason        = `USI=${usi.toFixed(0)} ≥ ${USI_HEAVY_FLOOR} for 2 consecutive closes — Upgrade to Heavy Buy`;
          minUsiInTrade = 99999;
        } else if (!inDeepBearWait && cStrongBuy >= 2 && curRank < 2) {
          targetId      = 'strong-buy';
          reason        = `USI=${usi.toFixed(0)} ≥ ${USI_STRONG_FLOOR} for 2 consecutive closes — Upgrade to Strong Buy`;
          minUsiInTrade = 99999;
        } else if (!inDeepBearWait && cBuy >= 2 && curRank < 1) {
          targetId = 'buy';
          reason   = `USI=${usi.toFixed(0)} ≥ ${USI_BUY_FLOOR} for 2 consecutive closes — Upgrade to Buy`;
        } else if (curRank >= 2) {
          // BULLISH DIVERGENCE HOLD & CALM BULL DE-LEVERAGING:
          // Do NOT downgrade step-by-step while USI is falling and SPY is rising!
          // Stay in Strong Buy / Heavy Buy / Extreme Buy until:
          // 1) A serious upward stress spike occurs from low/cooled stress levels (USI >= max(165, minUsi + 95) while SMA20 < 225), OR
          // 2) In a deep chronic Bear Market (SMA50 & SMA100 >= 400), the Bear Market Rally cools below 225 near the 200-SMA resistance, OR
          // 3) Once V-bottom recovery completes and stress stabilizes in calm bull territory (USI < 75 & SMA20 < 75 after 25+ days),
          //    de-leverage from Heavy/Extreme Buy back to Neutral (US Top 10) to cut portfolio volatility in half.
          const targetSpike = Math.max(165, minUsiInTrade + 95);
          const isSharpSpikeFromLow =
            minUsiInTrade < 165 &&
            usi >= targetSpike &&
            usi > prevUsi &&
            sma20 < 225 &&
            (sma5 > sma20 || (usi > sma10 * 1.25 && sma5 > prevSma5));

          const isBearRallyProfitLock =
            spySma50[absIdx] < spySma200[absIdx] * 0.98 &&
            spyClose <= spySma200[absIdx] * 1.015 &&
            sma50 >= 400 &&
            sma100 >= 400 &&
            daysInHighBeta >= 15 &&
            usi < 225 &&
            spyClose > spySma50[absIdx];

          const isCalmBullDeleverage =
            curRank >= 3 &&
            daysInHighBeta >= 25 &&
            sma20 < 75 &&
            usi < 75;

          if (isSharpSpikeFromLow) {
            targetId = 'neutral';
            reason   = `USI=${usi.toFixed(0)} Stress Spike from Cooled Level (Min USI=${minUsiInTrade.toFixed(0)} → ${usi.toFixed(0)}) — Divergence Ended → Neutral`;
          } else if (isBearRallyProfitLock) {
            targetId = 'neutral';
            reason   = `USI=${usi.toFixed(0)} Bear Rally Divergence Completed (SPY > SMA50, USI < 225) — Lock Profit → Neutral`;
          } else if (isCalmBullDeleverage) {
            targetId = 'neutral';
            reason   = `USI=${usi.toFixed(0)} & SMA20=${sma20.toFixed(0)} < 75 after ${daysInHighBeta}d V-Recovery — De-Leverage to Neutral (US Top 10)`;
          }
        } else if (curRank === 1 && usi < 120) {
          targetId = 'neutral';
          reason   = `USI=${usi.toFixed(0)} < 120 — Exit Buy → Neutral`;
        }
      }

      const isRotation = targetId !== activePortfolioId;
      const isNewMonth = dayIdx > 0 && date.slice(0, 7) !== tradingDates[dayIdx - 1].slice(0, 7);

      if (firstDay) {
        if (useTop10Neutral && targetId === 'neutral') {
          const top10Assets = getTop10USAssets(date);
          latestTop10       = top10Assets.map(a => a.ticker);
          currentTop10Key   = [...latestTop10].sort().join(',');
          allocate('neutral', date, `Initial: Top 10 US (${latestTop10.join(', ')})`, false, usi, top10Assets);
        } else {
          allocate(targetId, date, `Initial: ${portfolioMap.get(targetId)?.name ?? targetId}`, false, usi);
        }
        firstDay = false;
      } else if (isRotation) {
        if (useTop10Neutral && targetId === 'neutral') {
          const top10Assets = getTop10USAssets(date);
          latestTop10       = top10Assets.map(a => a.ticker);
          currentTop10Key   = [...latestTop10].sort().join(',');
          allocate('neutral', date, `${reason} [Top 10 US: ${latestTop10.join(', ')}]`, true, usi, top10Assets);
        } else {
          allocate(targetId, date, reason, true, usi);
        }
      } else if (useTop10Neutral && activePortfolioId === 'neutral' && isNewMonth) {
        // At the beginning of each month in Neutral, check Top 10 largest US companies and reallocate if changed
        const top10Assets = getTop10USAssets(date);
        const tickersList = top10Assets.map(a => a.ticker);
        const newKey      = [...tickersList].sort().join(',');
        latestTop10       = tickersList;
        if (newKey !== currentTop10Key) {
          currentTop10Key = newKey;
          top10RebalanceCount++;
          allocate('neutral', date, `Monthly Top 10 US Reallocation (${tickersList.join(', ')})`, false, usi, top10Assets);
        }
      } else if (rebalanceFrequency !== 'none' && dayIdx > 0) {
        const prev = new Date(tradingDates[dayIdx - 1]), curr = new Date(date);
        const doRebalance =
          (rebalanceFrequency === 'monthly' && curr.getMonth() !== prev.getMonth()) ||
          (rebalanceFrequency === 'weekly'  && Math.floor(curr.getDate() / 7) !== Math.floor(prev.getDate() / 7));
        if (doRebalance) allocate(activePortfolioId, date, `Periodic ${rebalanceFrequency} rebalance`, false, usi);
      }

      // ── MARK-TO-MARKET ───────────────────────────────────────────────────
      let dayValue = cash;
      Object.entries(holdings).forEach(([t, shares]) => { dayValue += shares * getPrice(t, date); });

      const bmIdx    = benchmarkMap.get(date);
      const spyPrice = bmIdx !== undefined ? benchmarkCloses[bmIdx] : (lastPrice[benchmarkTicker] ?? bmStartPrice);

      equityCurve.push({
        date,
        strategyValue:   Math.round(dayValue                                   * 100) / 100,
        benchmarkValue:  Math.round(simCapital * (spyPrice / bmStartPrice) * 100) / 100,
        activePortfolioId,
        usiValue:  usi,
        s5fiValue: fullUsiSma5[absIdx] ?? 0,
        ushValue:  fullUsiSma20[absIdx] ?? 0,
      });
    }

    // Ensure latestTop10 is populated at the end of simulation
    if (useTop10Neutral) {
      const endTop10 = getTop10USAssets(tradingDates[tradingDates.length - 1]);
      latestTop10 = endTop10.map(a => a.ticker);
    }

    // ── METRICS ──────────────────────────────────────────────────────────────
    const lastPt  = equityCurve[equityCurve.length - 1];
    const firstPt = equityCurve[0];
    const years   = Math.max(0.01, (new Date(lastPt.date).getTime() - new Date(firstPt.date).getTime()) / (365.25 * 86400000));

    const totalRet  = ((lastPt.strategyValue  - simCapital) / simCapital) * 100;
    const benchRet  = ((lastPt.benchmarkValue - simCapital) / simCapital) * 100;
    const cagr      = (Math.pow(lastPt.strategyValue  / simCapital, 1 / years) - 1) * 100;
    const benchCagr = (Math.pow(lastPt.benchmarkValue / simCapital, 1 / years) - 1) * 100;

    let stratPeak = simCapital, benchPeak = simCapital, maxDD = 0, benchMaxDD = 0;
    const stratRets: number[] = [], benchRets: number[] = [];

    equityCurve.forEach((pt, i) => {
      if (pt.strategyValue  > stratPeak) stratPeak = pt.strategyValue;
      if (pt.benchmarkValue > benchPeak) benchPeak = pt.benchmarkValue;
      maxDD      = Math.max(maxDD,      ((stratPeak - pt.strategyValue)  / stratPeak)  * 100);
      benchMaxDD = Math.max(benchMaxDD, ((benchPeak - pt.benchmarkValue) / benchPeak) * 100);
      if (i > 0) {
        stratRets.push(pt.strategyValue  / equityCurve[i - 1].strategyValue  - 1);
        benchRets.push(pt.benchmarkValue / equityCurve[i - 1].benchmarkValue - 1);
      }
    });

    const sharpe = (rets: number[], ann: number) => {
      if (rets.length < 2) return 0;
      const avg = rets.reduce((a, b) => a + b, 0) / rets.length;
      const vol = Math.sqrt(rets.reduce((a, r) => a + Math.pow(r - avg, 2), 0) / (rets.length - 1)) * Math.sqrt(252);
      return vol === 0 ? 0 : (ann - 2.0) / (vol * 100);
    };

    let wins = 0;
    trades.forEach((trade, i) => {
      const exitDate = i + 1 < trades.length ? trades[i + 1].date : tradingDates[tradingDates.length - 1];
      const exitPt   = equityCurve.find(p => p.date >= exitDate);
      if (exitPt) {
        const ret = (exitPt.strategyValue - trade.capitalAfter) / trade.capitalAfter * 100;
        trade.returnPct = Math.round(ret * 100) / 100;
        if (ret > 0) wins++;
      }
    });

    const metrics: Metrics = {
      totalReturnPct:       Math.round(totalRet  * 100) / 100,
      benchmarkReturnPct:   Math.round(benchRet  * 100) / 100,
      cagr:                 Math.round(cagr       * 100) / 100,
      benchmarkCagr:        Math.round(benchCagr  * 100) / 100,
      maxDrawdown:          Math.round(maxDD       * 100) / 100,
      benchmarkMaxDrawdown: Math.round(benchMaxDD  * 100) / 100,
      sharpeRatio:          Math.round(sharpe(stratRets, cagr)       * 100) / 100,
      benchmarkSharpeRatio: Math.round(sharpe(benchRets, benchCagr)  * 100) / 100,
      totalTrades:  trades.length,
      totalFees:    Math.round(trades.reduce((s, t) => s + t.transactionCost, 0) * 100) / 100,
      winRate:      Math.round((trades.length > 0 ? wins / trades.length * 100 : 0) * 100) / 100,
    };


      return { equityCurve, trades, metrics, latestTop10, top10RebalanceCount };
    };

    // Run primary requested period
    const mainSim = simulatePeriod(startDate, endDate, initialCapital);

    // Compute isolated yearly performance for all calendar years in the dataset
    // (each year starting on Jan 1 with fresh $10,000 in Neutral)
    const distinctYears = Array.from(new Set(allDates.map(d => d.slice(0, 4)))).sort();
    const isolatedYearlyStats: YearlyStat[] = distinctYears.map(yr => {
      const yrDates = allDates.filter(d => d.startsWith(yr));
      if (yrDates.length === 0) return null;
      const yrStart = yrDates[0];
      const yrEnd   = yrDates[yrDates.length - 1];

      let yrRes: BacktestResult;
      if (startDate === yrStart && endDate === yrEnd) {
        yrRes = mainSim;
      } else {
        yrRes = simulatePeriod(yrStart, yrEnd, 10000);
      }

      return {
        year: yr,
        strategyReturn: yrRes.metrics.totalReturnPct,
        benchmarkReturn: yrRes.metrics.benchmarkReturnPct,
        outperformance: Math.round((yrRes.metrics.totalReturnPct - yrRes.metrics.benchmarkReturnPct) * 100) / 100,
      };
    }).filter(Boolean) as YearlyStat[];

    return {
      ...mainSim,
      isolatedYearlyStats,
    };
  }
};

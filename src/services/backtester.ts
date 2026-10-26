import type {
  Portfolio,
  Rule,
  BacktestConfig,
  BacktestResult,
  Trade,
  EquityPoint,
  Metrics,
  HistoricalDataCache,
  PortfolioAsset
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

// ── US TOP 10 MARKET CAP ENGINE (2006–2026) ───────────────────────────────────
// Historical split-adjusted shares outstanding (in billions) at anchor years
const ANCHOR_YEARS = [2006, 2008, 2010, 2014, 2018, 2022, 2026];

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

function getHistoricalShares(ticker: string, dateStr: string): number {
  const anchors = SHARE_ANCHORS[ticker];
  if (!anchors) return 0;
  const year = parseFloat(dateStr.slice(0, 4)) + (parseFloat(dateStr.slice(5, 7)) - 1) / 12;
  if (year <= ANCHOR_YEARS[0]) return anchors[0];
  if (year >= ANCHOR_YEARS[ANCHOR_YEARS.length - 1]) return anchors[anchors.length - 1];
  for (let i = 0; i < ANCHOR_YEARS.length - 1; i++) {
    if (year >= ANCHOR_YEARS[i] && year <= ANCHOR_YEARS[i + 1]) {
      const t = (year - ANCHOR_YEARS[i]) / (ANCHOR_YEARS[i + 1] - ANCHOR_YEARS[i]);
      return anchors[i] + t * (anchors[i + 1] - anchors[i]);
    }
  }
  return anchors[anchors.length - 1];
}

// ── THRESHOLDS ────────────────────────────────────────────────────────────────
//
// BUY LADDER — 2 consecutive closes required for all levels:
//   Extreme Buy USI >= 894.52  → 2 consecutive closes
//   Heavy Buy   USI >= 533.959  → 2 consecutive closes
//   Strong Buy  USI >= 323.140  → 2 consecutive closes
//   Buy         USI >= 187.947  → 2 consecutive closes
//   Neutral = default starting floor (Top 10 US Companies Equal-Weight Monthly).

const USI_BUY_FLOOR     = 187.947;
const USI_STRONG_FLOOR  = 323.140;
const USI_HEAVY_FLOOR   = 533.959;
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

    // ── O(1) DATE INDEX MAPS ─────────────────────────────────────────────────
    const dateIndexMaps: { [ticker: string]: Map<string, number> } = {};
    Object.entries(allData).forEach(([ticker, data]) => {
      dateIndexMaps[ticker] = buildDateIndex(data);
    });

    // ── PRE-CALCULATE USI MODEL INPUTS ───────────────────────────────────────
    const breadthTickers = ['SPY', 'QQQ', 'XLP', 'XLE', 'XLK', 'XLV', 'XLI', 'XLF', 'XLG', 'XLY', 'ICLN', 'DBC', 'TLT', 'TQQQ'];

    const low252:  { [t: string]: number[] } = {};
    const high252: { [t: string]: number[] } = {};

    breadthTickers.forEach(ticker => {
      const d = allData[ticker];
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

    const spyData    = allData['SPY'] || benchmarkData;
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
        const bData = allData[ticker];
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
    const fullUsiSma5  = calculateSMA(fullUsi, 5);
    const fullUsiSma10 = calculateSMA(fullUsi, 10);
    const fullUsiSma20 = calculateSMA(fullUsi, 20);
    const fullUsiSma30 = calculateSMA(fullUsi, 30);
    const fullUsiSma50 = calculateSMA(fullUsi, 50);

    // ── TRADING DATES ────────────────────────────────────────────────────────
    const benchmarkMap    = dateIndexMaps[benchmarkTicker];
    const benchmarkCloses = benchmarkData.map(p => p.close);
    const tradingDates    = allDates.filter(d => d >= startDate && d <= endDate);

    if (tradingDates.length === 0) throw new Error(`No trading dates in ${startDate} → ${endDate}`);

    const bmStartIdx   = benchmarkData.findIndex(p => p.date >= startDate);
    const bmStartPrice = bmStartIdx !== -1 ? benchmarkCloses[bmStartIdx] : benchmarkCloses[0];

    // ── PORTFOLIO MAP ────────────────────────────────────────────────────────
    const portfolioMap = new Map<string, Portfolio>();
    portfolios.forEach(p => portfolioMap.set(p.id, p));
    const resolvedDefault = portfolioMap.has(defaultPortfolioId) ? defaultPortfolioId : 'neutral';

    // ── SIMULATION STATE ─────────────────────────────────────────────────────
    let activePortfolioId = resolvedDefault;
    let holdings: { [ticker: string]: number } = {};
    let cash = initialCapital;
    const trades: Trade[]            = [];
    const equityCurve: EquityPoint[] = [];

    const lastPrice: { [ticker: string]: number } = {};
    Object.entries(allData).forEach(([ticker, data]) => { lastPrice[ticker] = data[0]?.close ?? 0; });

    const getPrice = (ticker: string, date: string): number => {
      const series = allData[ticker];
      if (!series) return 0;
      const idx = dateIndexMaps[ticker]?.get(date);
      if (idx !== undefined) { lastPrice[ticker] = series[idx].close; return series[idx].close; }
      return lastPrice[ticker] ?? 0;
    };

    //Compute Top 10 largest US companies on `date` (10% equal weight each)
    const getTop10USAssets = (date: string): PortfolioAsset[] => {
      const ranked: { ticker: string; mcap: number }[] = [];
      for (const ticker of Object.keys(SHARE_ANCHORS)) {
        const series = allData[ticker];
        if (!series || series.length === 0 || series[0].date > date) continue;
        const price = getPrice(ticker, date);
        if (price <= 0) continue;
        const shares = getHistoricalShares(ticker, date);
        if (shares <= 0) continue;
        ranked.push({ ticker, mcap: price * shares });
      }
      ranked.sort((a, b) => b.mcap - a.mcap);
      const top10 = ranked.slice(0, 10);
      if (top10.length === 0) {
        return portfolioMap.get('neutral')?.assets ?? [];
      }
      const equalWeight = 100 / top10.length;
      return top10.map(item => ({ ticker: item.ticker, weight: equalWeight }));
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

    let cExitExtreme = 0;
    let cExitHeavy   = 0;
    let cExitStrong  = 0;
    let cExitBuy     = 0;

    let extremeBuyLockDays = 0;
    let neutralLockoutDays = 0;
    let bearLockoutDays    = 0;

    let bearMode        = false;
    let bearDays        = 0;
    let peakUsi         = 0;
    let daysInBuy       = 0;
    let climaxTriggered = false;

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
      if (neutralLockoutDays > 0) neutralLockoutDays--;
      if (bearLockoutDays > 0)    bearLockoutDays--;

      if (usi >= USI_BUY_FLOOR) daysInBuy++;
      else if (usi < 120) daysInBuy = 0;

      let targetId = activePortfolioId;
      let reason   = '';

      // ── PURE FEAR-INDEX (USI) BEAR MARKET & CORRECTION DETECTOR ────────────
      let handledByBearEngine = false;

      if (useBearShield) {
        const sma5  = fullUsiSma5[absIdx];
        const sma10 = fullUsiSma10[absIdx];
        const sma20 = fullUsiSma20[absIdx];
        const sma30 = fullUsiSma30[absIdx];
        const sma50 = fullUsiSma50[absIdx];
        const prevUsi = fullUsi[Math.max(0, absIdx - 1)];
        const prevSma5 = fullUsiSma5[Math.max(0, absIdx - 1)];

        // Compute SPY Drawdown from 52-week high for bear regime filtering
        const spyClose = spyCloses[absIdx] || 1;
        const spyH     = spyHigh252[absIdx] || spyClose;
        const spyDd    = Math.max(0, (spyH - spyClose) / (spyH || 1));

        // 1. Structural Bear (e.g. 2008 & 2022):
        //    Requires SPY Drawdown >= 16%, chronic sustained fear (daysInBuy >= 25, SMA50 >= 300),
        //    elevated USI >= 700, and accelerating momentum (SMA5 > 1.05 * SMA20).
        //    Does NOT trigger during routine dips or minor 10-14% corrections!
        const triggerStructuralBear =
          bearLockoutDays === 0 &&
          spyDd >= 0.16 &&
          daysInBuy >= 25 &&
          sma50 >= 300 &&
          usi >= 700 &&
          sma5 > sma20 * 1.05;

        // 2. Black Swan / Acute Bear Crash (e.g. March 2020):
        //    Official Bear Market DD >= 20% accompanied by an extreme panic shock (USI >= 2000 & SMA5 > 2.2 * SMA20)
        const triggerAcuteCrash =
          bearLockoutDays === 0 &&
          spyDd >= 0.20 &&
          usi >= 2000 &&
          sma5 > sma20 * 2.2;

        if (!bearMode && (triggerStructuralBear || triggerAcuteCrash)) {
          bearMode           = true;
          bearDays           = 0;
          peakUsi            = usi;
          extremeBuyLockDays = 0;
          climaxTriggered    = false;
          targetId           = 'bear-shield';
          reason             = triggerAcuteCrash
            ? `USI=${usi.toFixed(0)} Acute Bear Crash (DD=${(spyDd * 100).toFixed(1)}%, USI ≥ 2000) — Crash Protection (Bear Shield)`
            : `USI=${usi.toFixed(0)} Structural Bear Market (DD=${(spyDd * 100).toFixed(1)}%, Chronic Fear SMA50=${sma50.toFixed(0)}, Days=${daysInBuy}) — Bear Shield Activated`;
          handledByBearEngine = true;
        } else if (bearMode) {
          bearDays++;
          peakUsi = Math.max(peakUsi, usi);

          // Capitulation Spike Exhaustion:
          // A violent panic peak occurred (peakUsi >= 2000), followed by 2 consecutive days of cooling below SMA5
          // with SMA5 turning downwards — the capitulation exhaustion signal!
          const isCapitulationSpike =
            peakUsi >= 2000 &&
            bearDays >= 8 &&
            usi < sma5 * 0.82 &&
            prevUsi < prevSma5 * 0.88 &&
            sma5 < prevSma5;

          // Normalization Exit: Fear quietly subsides below 188 with negative momentum
          const isNormalized = bearDays >= 8 && usi < USI_BUY_FLOOR && sma10 < sma30;

          if (isCapitulationSpike) {
            bearMode           = false;
            climaxTriggered    = true;
            bearLockoutDays    = 80; // 80 trading days (~4 months) lockout: stay in high-beta recovery, no whipsaw!
            extremeBuyLockDays = 30;
            daysInBuy          = 0;
            targetId           = 'extreme-buy';
            reason             = `USI=${usi.toFixed(0)} Capitulation Peak Exhaustion (Peak USI=${peakUsi.toFixed(0)}, Cooling < SMA5=${sma5.toFixed(0)}) — Seize V-Bottom in Extreme Buy`;
            handledByBearEngine = true;
          } else if (isNormalized) {
            bearMode           = false;
            daysInBuy          = 0;
            targetId           = 'neutral';
            reason             = `USI=${usi.toFixed(0)} < ${USI_BUY_FLOOR} & SMA10 < SMA30 — Bear Regime Normalized → Neutral`;
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

      // ── STANDARD DIP-BUYING LADDER (When not overridden by Bear Shield) ────
      if (!handledByBearEngine) {
        cExtremeBuy = usi >= USI_EXTREME_FLOOR                          ? cExtremeBuy + 1 : 0;
        cHeavyBuy   = usi >= USI_HEAVY_FLOOR && usi < USI_EXTREME_FLOOR ? cHeavyBuy   + 1 : 0;
        cStrongBuy  = usi >= USI_STRONG_FLOOR && usi < USI_HEAVY_FLOOR  ? cStrongBuy  + 1 : 0;
        cBuy        = usi >= USI_BUY_FLOOR    && usi < USI_STRONG_FLOOR ? cBuy        + 1 : 0;

        cExitExtreme = activePortfolioId === 'extreme-buy' && usi < USI_EXTREME_FLOOR ? cExitExtreme + 1 : 0;
        cExitHeavy   = activePortfolioId === 'heavy-buy'   && usi < USI_HEAVY_FLOOR   ? cExitHeavy   + 1 : 0;
        cExitStrong  = activePortfolioId === 'strong-buy'  && usi < USI_STRONG_FLOOR  ? cExitStrong  + 1 : 0;
        cExitBuy     = activePortfolioId === 'buy'         && usi < USI_BUY_FLOOR     ? cExitBuy     + 1 : 0;

        if (cExtremeBuy >= 2) {
          targetId = 'extreme-buy';
          reason   = `USI=${usi.toFixed(0)} ≥ ${USI_EXTREME_FLOOR} for 2 consecutive closes — Extreme Buy`;
          extremeBuyLockDays = 30;
        } else if (cHeavyBuy >= 2) {
          targetId = 'heavy-buy';
          reason   = `USI=${usi.toFixed(0)} ≥ ${USI_HEAVY_FLOOR} for 2 consecutive closes — Heavy Buy`;
        } else if (cStrongBuy >= 2) {
          targetId = 'strong-buy';
          reason   = `USI=${usi.toFixed(0)} ≥ ${USI_STRONG_FLOOR} for 2 consecutive closes — Strong Buy`;
        } else if (cBuy >= 2) {
          targetId = 'buy';
          reason   = `USI=${usi.toFixed(0)} ≥ ${USI_BUY_FLOOR} for 2 consecutive closes — Buy`;
        } else if (cExitExtreme >= 2) {
          targetId = 'heavy-buy';
          reason   = `USI=${usi.toFixed(0)} below ${USI_EXTREME_FLOOR} for 2 consecutive closes — Extreme Buy → Heavy Buy`;
          cExitExtreme = 0;
        } else if (cExitHeavy >= 2) {
          targetId = 'strong-buy';
          reason   = `USI=${usi.toFixed(0)} below ${USI_HEAVY_FLOOR} for 2 consecutive closes — Heavy Buy → Strong Buy`;
          cExitHeavy = 0;
        } else if (cExitStrong >= 2) {
          targetId = 'buy';
          reason   = `USI=${usi.toFixed(0)} below ${USI_STRONG_FLOOR} for 2 consecutive closes — Strong Buy → Buy`;
          cExitStrong = 0;
        } else if (cExitBuy >= 2) {
          targetId = 'neutral';
          reason   = `USI=${usi.toFixed(0)} below ${USI_BUY_FLOOR} for 2 consecutive closes — Buy → Neutral`;
          cExitBuy = 0;
        }

        const isBuySignalFromNeutral =
          activePortfolioId === 'neutral' &&
          (targetId === 'buy' || targetId === 'strong-buy' || targetId === 'heavy-buy' || targetId === 'extreme-buy');
        if (isBuySignalFromNeutral) {
          neutralLockoutDays = 30;
        }

        if (targetId === 'neutral' && neutralLockoutDays > 0) {
          targetId = 'buy';
        }

        if (activePortfolioId === 'extreme-buy' && extremeBuyLockDays > 0) {
          targetId = 'extreme-buy';
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
        benchmarkValue:  Math.round(initialCapital * (spyPrice / bmStartPrice) * 100) / 100,
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

    const totalRet  = ((lastPt.strategyValue  - initialCapital) / initialCapital) * 100;
    const benchRet  = ((lastPt.benchmarkValue - initialCapital) / initialCapital) * 100;
    const cagr      = (Math.pow(lastPt.strategyValue  / initialCapital, 1 / years) - 1) * 100;
    const benchCagr = (Math.pow(lastPt.benchmarkValue / initialCapital, 1 / years) - 1) * 100;

    let stratPeak = initialCapital, benchPeak = initialCapital, maxDD = 0, benchMaxDD = 0;
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
  }
};

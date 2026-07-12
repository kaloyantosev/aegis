import type {
  Portfolio,
  Rule,
  BacktestConfig,
  BacktestResult,
  Trade,
  EquityPoint,
  Metrics,
  HistoricalDataCache
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

// ── THRESHOLDS ────────────────────────────────────────────────────────────────
//
// BUY LADDER — 2 consecutive closes required for all levels:
//   Extreme Buy USI >= 894.52  → 2 consecutive closes
//   Heavy Buy   USI >= 533.959  → 2 consecutive closes
//   Strong Buy  USI >= 323.140  → 2 consecutive closes
//   Buy         USI >= 187.947  → 2 consecutive closes
//   Neutral = default starting floor.
//
// DOWNGPADES — 2 consecutive closes below threshold:
//   Extreme Buy → Heavy Buy  when USI < 894.52 for 2 consecutive closes
//   Heavy Buy   → Strong Buy  when USI < 533.959 for 2 consecutive closes
//   Strong Buy  → Buy         when USI < 323.140 for 2 consecutive closes
//   Buy         → Neutral     when USI < 187.947 for 2 consecutive closes
//   Neutral is the floor.

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
    const { startDate, endDate, initialCapital, rebalanceFrequency, transactionFee, benchmarkTicker } = config;

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

    // ── TRADING DATES ────────────────────────────────────────────────────────
    const benchmarkMap    = dateIndexMaps[benchmarkTicker];
    const benchmarkCloses = benchmarkData.map(p => p.close);
    const tradingDates    = benchmarkData.map(p => p.date).filter(d => d >= startDate && d <= endDate);

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

    // ── ALLOCATION ───────────────────────────────────────────────────────────
    const allocate = (toId: string, date: string, reason: string, isRotation: boolean, usiVal: number) => {
      const target = portfolioMap.get(toId);
      if (!target) return;

      let totalValue = cash;
      Object.entries(holdings).forEach(([t, shares]) => { totalValue += shares * getPrice(t, date); });

      const curW: { [t: string]: number } = {};
      Object.entries(holdings).forEach(([t, shares]) => {
        curW[t] = totalValue > 0 ? (shares * getPrice(t, date)) / totalValue : 0;
      });
      const tgtW: { [t: string]: number } = {};
      target.assets.forEach(a => { tgtW[a.ticker] = a.weight / 100; });

      let turnover = 0;
      new Set([...Object.keys(curW), ...Object.keys(tgtW)]).forEach(t => {
        turnover += Math.abs((tgtW[t] ?? 0) - (curW[t] ?? 0));
      });
      const cost      = ((turnover / 2) * totalValue) * (transactionFee / 100);
      const investable = totalValue - cost;

      const newH: { [t: string]: number } = {};
      target.assets.forEach(a => {
        const price = getPrice(a.ticker, date);
        if (price > 0) newH[a.ticker] = (investable * a.weight / 100) / price;
      });

      if (isRotation) {
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

    // ── CONSECUTIVE-DAY COUNTERS ─────────────────────────────────────────────
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

    // ── MAIN LOOP ────────────────────────────────────────────────────────────
    let firstDay = true;

    for (let dayIdx = 0; dayIdx < tradingDates.length; dayIdx++) {
      const date = tradingDates[dayIdx];
      const usi  = computeUSI(date);

      // Decrement extreme buy lock days
      if (extremeBuyLockDays > 0) {
        extremeBuyLockDays--;
      }

      // Decrement neutral lockout days
      if (neutralLockoutDays > 0) {
        neutralLockoutDays--;
      }

      // ── BUY-SIDE ENTRY COUNTERS (Require 2 consecutive closes) ────────────
      cExtremeBuy = usi >= USI_EXTREME_FLOOR                                    ? cExtremeBuy + 1 : 0;
      cHeavyBuy   = usi >= USI_HEAVY_FLOOR && usi < USI_EXTREME_FLOOR             ? cHeavyBuy   + 1 : 0;
      cStrongBuy  = usi >= USI_STRONG_FLOOR && usi < USI_HEAVY_FLOOR            ? cStrongBuy  + 1 : 0;
      cBuy        = usi >= USI_BUY_FLOOR    && usi < USI_STRONG_FLOOR           ? cBuy        + 1 : 0;

      // ── BUY-SIDE EXIT COUNTERS (Require 2 consecutive closes) ─────────────
      cExitExtreme = activePortfolioId === 'extreme-buy' && usi < USI_EXTREME_FLOOR ? cExitExtreme + 1 : 0;
      cExitHeavy   = activePortfolioId === 'heavy-buy'   && usi < USI_HEAVY_FLOOR   ? cExitHeavy   + 1 : 0;
      cExitStrong  = activePortfolioId === 'strong-buy'  && usi < USI_STRONG_FLOOR  ? cExitStrong  + 1 : 0;
      cExitBuy     = activePortfolioId === 'buy'         && usi < USI_BUY_FLOOR     ? cExitBuy     + 1 : 0;

      // ── DETERMINE TARGET PORTFOLIO ────────────────────────────────────────
      let targetId = activePortfolioId;
      let reason   = '';

      // Entries take priority
      if (cExtremeBuy >= 2) {
        targetId = 'extreme-buy';
        reason   = `USI=${usi.toFixed(0)} ≥ ${USI_EXTREME_FLOOR} for 2 consecutive closes — Extreme Buy`;
        extremeBuyLockDays = 30; // set/refresh lock
      } else if (cHeavyBuy >= 2) {
        targetId = 'heavy-buy';
        reason   = `USI=${usi.toFixed(0)} ≥ ${USI_HEAVY_FLOOR} for 2 consecutive closes — Heavy Buy`;
      } else if (cStrongBuy >= 2) {
        targetId = 'strong-buy';
        reason   = `USI=${usi.toFixed(0)} ≥ ${USI_STRONG_FLOOR} for 2 consecutive closes — Strong Buy`;
      } else if (cBuy >= 2) {
        targetId = 'buy';
        reason   = `USI=${usi.toFixed(0)} ≥ ${USI_BUY_FLOOR} for 2 consecutive closes — Buy`;
      }
      // Stepwise exits/downgrades
      else if (cExitExtreme >= 2) {
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

      // If a buy signal was triggered from Neutral, activate the 30-day Neutral lockout period
      const isBuySignalFromNeutral = 
        activePortfolioId === 'neutral' && 
        (targetId === 'buy' || targetId === 'strong-buy' || targetId === 'heavy-buy' || targetId === 'extreme-buy');
      if (isBuySignalFromNeutral) {
        neutralLockoutDays = 30; // 30 trading days lockout
      }

      // Enforce the Neutral lockout: prevent downgrades back to Neutral
      if (targetId === 'neutral' && neutralLockoutDays > 0) {
        targetId = 'buy'; // Stay in the lowest buy level
      }

      // If locked in Extreme Buy, override downgrade/exits
      if (activePortfolioId === 'extreme-buy' && extremeBuyLockDays > 0) {
        targetId = 'extreme-buy';
      }



      const isRotation = targetId !== activePortfolioId;

      if (firstDay) {
        allocate(targetId, date, `Initial: ${portfolioMap.get(targetId)?.name ?? targetId}`, false, usi);
        firstDay = false;
      } else if (isRotation) {
        allocate(targetId, date, reason, true, usi);
      } else if (rebalanceFrequency !== 'none' && dayIdx > 0) {
        const prev = new Date(tradingDates[dayIdx - 1]), curr = new Date(date);
        const doRebalance =
          (rebalanceFrequency === 'monthly' && curr.getMonth()  !== prev.getMonth()) ||
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
        s5fiValue: 0,
        ushValue:  0,
      });
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

    return { equityCurve, trades, metrics };
  }
};

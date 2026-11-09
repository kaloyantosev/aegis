export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number; // total-return (dividend + split adjusted) close
}

export type TickerData = PricePoint[];

export interface HistoricalDataCache {
  [ticker: string]: TickerData;
}

export interface PortfolioAsset {
  ticker: string;
  weight: number; // percent, 0-100
}

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  assets: PortfolioAsset[];
}

export interface BacktestConfig {
  initialCapital: number;
  transactionFee: number; // percent per unit of turnover, e.g. 0.1
  benchmarkTicker: string; // e.g. "SPY"
  useTop10Neutral: boolean;
  useBearShield: boolean;
}

/** Switches used only to measure what each methodology fix changes. The app always uses the defaults. */
export interface MethodologyOptions {
  executionLagDays: number; // 1 = trade at the next close after the signal (default)
  usiNoise: boolean; // original deterministic sin/cos noise added to USI (default false)
  pointInTimeShares: boolean; // interpolate share counts over time instead of using 2026 counts (default true)
  syntheticTqqq: boolean; // back-fill TQQQ before 2010 from 3x QQQ (default false)
  startDate?: string; // first trading day (default 2006-01-03)
}

export interface Trade {
  signalDate: string;
  date: string; // execution date
  fromPortfolio: string | null;
  toPortfolio: string;
  usi: number;
  reason: string;
  cost: number;
  substitutions: string[]; // e.g. ["TQQQ→QQQ"] when a fund did not exist yet
}

export interface EquityPoint {
  date: string;
  strategy: number;
  benchmark: number;
  portfolioId: string;
  usi: number;
  rf: number; // T-bill (BIL) total return for this day; 0 before BIL existed
  proxy: boolean; // holdings include a stand-in for a fund that did not exist yet
}

export interface BacktestResult {
  startDate: string;
  endDate: string;
  equityCurve: EquityPoint[];
  trades: Trade[];
  currentPortfolioId: string;
  currentHoldings: PortfolioAsset[];
  top10Updates: number;
}

export interface RatioSet {
  totalReturn: number; // %
  cagr: number; // %
  volatility: number; // % annualised
  sharpe: number; // vs T-bills
  maxDrawdown: number; // % (positive)
  finalValue: number; // $ from $10,000
}

export interface PeriodStats {
  from: string;
  to: string;
  years: number;
  strategy: RatioSet;
  benchmark: RatioSet;
  rotations: number;
  fees: number; // $
  proxyDays: number; // days holding a stand-in fund
  defensiveDays: number; // % of days in Bear Shield
}

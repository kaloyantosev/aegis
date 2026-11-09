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
  startDate?: string; // override the first trading day (default: first full year with real data for every holding)
}

export interface Trade {
  signalDate: string;
  date: string; // execution date
  fromPortfolio: string | null;
  toPortfolio: string;
  usi: number;
  reason: string;
  cost: number;
}

export interface EquityPoint {
  date: string;
  strategy: number;
  benchmark: number;
  portfolioId: string;
  usi: number;
}

export interface RatioSet {
  cagr: number; // %
  volatility: number; // % annualised
  sharpe: number; // vs T-bills (BIL)
  maxDrawdown: number; // % (positive number)
}

export interface Metrics {
  strategy: RatioSet;
  benchmark: RatioSet;
  years: number;
  rotationsPerYear: number;
  feesPct: number; // total fees as % of starting capital
}

export interface YearlyStat {
  year: string;
  partial: boolean; // true for the current, incomplete year
  strategyReturn: number;
  benchmarkReturn: number;
  excess: number;
  strategyMaxDD: number;
  benchmarkMaxDD: number;
  defensiveDays: number; // % of trading days in Bear Shield
}

export interface BacktestResult {
  startDate: string;
  endDate: string;
  equityCurve: EquityPoint[];
  trades: Trade[];
  metrics: Metrics;
  yearly: YearlyStat[];
  currentPortfolioId: string;
  currentHoldings: PortfolioAsset[];
  timeInRegime: { [portfolioId: string]: number }; // % of days
}

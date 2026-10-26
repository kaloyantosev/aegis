export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export type TickerData = PricePoint[];

export interface HistoricalDataCache {
  [ticker: string]: TickerData;
}

export interface PortfolioAsset {
  ticker: string;
  weight: number; // Percentage value (0-100)
}

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  assets: PortfolioAsset[];
}

export type RuleIndicator = 'SMA' | 'EMA' | 'Price' | 'Momentum';

export interface Rule {
  id: string;
  indicator: RuleIndicator;
  period: number; // period in days (e.g., 200 for 200 SMA, 60 for 3-month momentum)
  operator: 'above' | 'below';
  targetPortfolioId: string;
}

export interface BacktestConfig {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  initialCapital: number;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'none';
  transactionFee: number; // Percentage (e.g., 0.1 for 0.1%)
  benchmarkTicker: string; // e.g. "SPY"
}

export interface Trade {
  date: string;
  type: 'rotate';
  fromPortfolio: { id: string; name: string } | null;
  toPortfolio: { id: string; name: string };
  capitalBefore: number;
  capitalAfter: number;
  transactionCost: number;
  spyPrice: number;
  spyIndicatorValue: number; // Value of the indicator that triggered the change
  reason: string; // Text description of the trigger e.g., "SPY (420.5) went above SMA 200 (415.2)"
  returnPct?: number;
}

export interface EquityPoint {
  date: string;
  strategyValue: number;
  benchmarkValue: number;
  activePortfolioId: string;
  usiValue: number;
  s5fiValue: number;
  ushValue: number;
}

export interface Metrics {
  totalReturnPct: number;
  benchmarkReturnPct: number;
  cagr: number;
  benchmarkCagr: number;
  maxDrawdown: number;
  benchmarkMaxDrawdown: number;
  sharpeRatio: number;
  benchmarkSharpeRatio: number;
  totalTrades: number;
  totalFees: number;
  winRate: number; // Percentage of trades that were profitable (or relative to benchmark)
}

export interface BacktestResult {
  equityCurve: EquityPoint[];
  trades: Trade[];
  metrics: Metrics;
}

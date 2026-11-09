import type { EquityPoint, PeriodStats, RatioSet, Trade } from '../types';

export const START_VALUE = 10000;

/**
 * Index range [from, to] of the curve covering dates d0..d1.
 * The base point is the close before `from` (if any), so the first day's move counts and
 * a year's return is measured close-to-close: Dec 31 → Dec 31.
 */
export function rangeIndex(curve: EquityPoint[], d0: string, d1: string) {
  const from = curve.findIndex(p => p.date >= d0);
  let to = -1;
  for (let i = curve.length - 1; i >= 0; i--) if (curve[i].date <= d1) { to = i; break; }
  if (from < 0 || to < from) return null;
  return { from, to, base: Math.max(0, from - 1) };
}

/** The slice rebased so the base close equals $10,000 for both strategy and benchmark. */
export function rebased(curve: EquityPoint[], r: { from: number; to: number; base: number }): EquityPoint[] {
  const b = curve[r.base];
  const pts = r.base < r.from ? curve.slice(r.base, r.to + 1) : curve.slice(r.from, r.to + 1);
  return pts.map(p => ({
    ...p,
    strategy: (p.strategy / b.strategy) * START_VALUE,
    benchmark: (p.benchmark / b.benchmark) * START_VALUE,
  }));
}

function ratios(pts: EquityPoint[], key: 'strategy' | 'benchmark'): RatioSet {
  const first = pts[0], last = pts[pts.length - 1];
  const years = Math.max(1 / 365, (Date.parse(last.date) - Date.parse(first.date)) / (365.25 * 86400000));
  const rets: number[] = [], excess: number[] = [];
  let peak = first[key], mdd = 0;
  for (let i = 1; i < pts.length; i++) {
    const r = pts[i][key] / pts[i - 1][key] - 1;
    rets.push(r);
    excess.push(r - pts[i].rf);
    peak = Math.max(peak, pts[i][key]);
    mdd = Math.max(mdd, 1 - pts[i][key] / peak);
  }
  const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
  const sd = (x: number[]) => {
    if (x.length < 2) return 0;
    const m = mean(x);
    return Math.sqrt(x.reduce((a, v) => a + (v - m) ** 2, 0) / (x.length - 1));
  };
  const total = last[key] / first[key] - 1;
  const exSd = sd(excess);
  return {
    totalReturn: total * 100,
    cagr: years >= 1 ? (Math.pow(1 + total, 1 / years) - 1) * 100 : total * 100,
    volatility: sd(rets) * Math.sqrt(252) * 100,
    sharpe: exSd > 0 ? (mean(excess) / exSd) * Math.sqrt(252) : 0,
    maxDrawdown: mdd * 100,
    finalValue: last[key],
  };
}

export function periodStats(curve: EquityPoint[], trades: Trade[], d0: string, d1: string): PeriodStats | null {
  const r = rangeIndex(curve, d0, d1);
  if (!r) return null;
  const pts = rebased(curve, r);
  const days = curve.slice(r.from, r.to + 1);
  const from = curve[r.from].date, to = curve[r.to].date;
  const inRange = trades.filter(t => t.date >= from && t.date <= to);
  return {
    from,
    to,
    years: (Date.parse(to) - Date.parse(pts[0].date)) / (365.25 * 86400000),
    strategy: ratios(pts, 'strategy'),
    benchmark: ratios(pts, 'benchmark'),
    rotations: inRange.length,
    fees: inRange.reduce((s, t) => s + t.cost, 0) * (START_VALUE / curve[r.base].strategy),
    proxyDays: days.filter(p => p.proxy).length,
    defensiveDays: (days.filter(p => p.portfolioId === 'bear-shield').length / days.length) * 100,
  };
}

export interface YearCard {
  year: number;
  partial: boolean;
  stats: PeriodStats;
}

export function yearlyCards(curve: EquityPoint[], trades: Trade[]): YearCard[] {
  if (!curve.length) return [];
  const y0 = Number(curve[0].date.slice(0, 4));
  const last = curve[curve.length - 1].date;
  const y1 = Number(last.slice(0, 4));
  const cards: YearCard[] = [];
  for (let y = y0; y <= y1; y++) {
    const s = periodStats(curve, trades, `${y}-01-01`, `${y}-12-31`);
    if (s) cards.push({ year: y, partial: y === y1 && last.slice(5) < '12-28', stats: s });
  }
  return cards;
}

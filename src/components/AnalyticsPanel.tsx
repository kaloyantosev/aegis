import React from 'react';
import type { BacktestResult } from '../types';

interface Props {
  results: BacktestResult;
  initialCapital: number;
  onSelectYear?: (year: number) => void;
  onResetRange?: () => void;
}

// ── EXTENDED STATISTICS ───────────────────────────────────────────────────────
function computeExtended(results: BacktestResult, initialCapital: number) {
  const { equityCurve, trades, metrics } = results;
  const n = equityCurve.length;
  if (n === 0) return null;

  // Daily returns
  const stratRets: number[] = [];
  const benchRets: number[] = [];
  for (let i = 1; i < n; i++) {
    stratRets.push(equityCurve[i].strategyValue / equityCurve[i - 1].strategyValue - 1);
    benchRets.push(equityCurve[i].benchmarkValue / equityCurve[i - 1].benchmarkValue - 1);
  }

  const annFactor = 252;

  // Downside deviation (Sortino — only negative returns)
  const rfDaily = 0.02 / annFactor;
  const negStrat = stratRets.map(r => Math.min(0, r - rfDaily));
  const downsideVar = negStrat.reduce((s, r) => s + r * r, 0) / Math.max(1, negStrat.filter(r => r < 0).length);
  const downsideDev = Math.sqrt(downsideVar) * Math.sqrt(annFactor);
  const sortinoRatio = downsideDev === 0 ? 0 : (metrics.cagr / 100 - 0.02) / downsideDev;

  // Calmar Ratio = CAGR / Max Drawdown
  const calmarRatio = metrics.maxDrawdown === 0 ? 0 : (metrics.cagr / metrics.maxDrawdown);

  // Volatility annualized
  const avgRet = stratRets.reduce((s, r) => s + r, 0) / Math.max(1, stratRets.length);
  const variance = stratRets.reduce((s, r) => s + Math.pow(r - avgRet, 2), 0) / Math.max(1, stratRets.length - 1);
  const annVolatility = Math.sqrt(variance) * Math.sqrt(annFactor) * 100;

  const avgRetBench = benchRets.reduce((s, r) => s + r, 0) / Math.max(1, benchRets.length);
  const varBench    = benchRets.reduce((s, r) => s + Math.pow(r - avgRetBench, 2), 0) / Math.max(1, benchRets.length - 1);
  const annVolBench = Math.sqrt(varBench) * Math.sqrt(annFactor) * 100;

  // Beta vs benchmark
  const covariance = stratRets.reduce((s, r, i) => s + (r - avgRet) * (benchRets[i] - avgRetBench), 0) / Math.max(1, stratRets.length - 1);
  const beta = varBench === 0 ? 1 : covariance / varBench;

  // Alpha (Jensen's) annualized
  const rfAnn = 0.02;
  const alpha = metrics.cagr / 100 - (rfAnn + beta * (metrics.benchmarkCagr / 100 - rfAnn));

  // Max drawdown duration (days)
  let peak = initialCapital, maxDdDuration = 0, ddStart = 0;
  let inDD = false;
  for (let i = 0; i < n; i++) {
    const val = equityCurve[i].strategyValue;
    if (val >= peak) {
      if (inDD) {
        const dur = i - ddStart;
        if (dur > maxDdDuration) maxDdDuration = dur;
      }
      peak = val;
      inDD = false;
    } else {
      if (!inDD) { ddStart = i; inDD = true; }
    }
  }
  if (inDD) {
    const dur = n - ddStart;
    if (dur > maxDdDuration) maxDdDuration = dur;
  }

  // Benchmark Max drawdown duration (days)
  let peakBench = initialCapital, maxDdDurationBench = 0, ddStartBench = 0;
  let inDDBench = false;
  for (let i = 0; i < n; i++) {
    const val = equityCurve[i].benchmarkValue;
    if (val >= peakBench) {
      if (inDDBench) {
        const dur = i - ddStartBench;
        if (dur > maxDdDurationBench) maxDdDurationBench = dur;
      }
      peakBench = val;
      inDDBench = false;
    } else {
      if (!inDDBench) { ddStartBench = i; inDDBench = true; }
    }
  }
  if (inDDBench) {
    const dur = n - ddStartBench;
    if (dur > maxDdDurationBench) maxDdDurationBench = dur;
  }

  // Benchmark Sortino Ratio
  const negBench = benchRets.map(r => Math.min(0, r - rfDaily));
  const downsideVarBench = negBench.reduce((s, r) => s + r * r, 0) / Math.max(1, negBench.filter(r => r < 0).length);
  const downsideDevBench = Math.sqrt(downsideVarBench) * Math.sqrt(annFactor);
  const sortinoRatioBench = downsideDevBench === 0 ? 0 : (metrics.benchmarkCagr / 100 - 0.02) / downsideDevBench;

  // Benchmark Calmar Ratio
  const calmarRatioBench = metrics.benchmarkMaxDrawdown === 0 ? 0 : (metrics.benchmarkCagr / metrics.benchmarkMaxDrawdown);

  // Benchmark Recovery factor
  const totalGainBench = equityCurve[n - 1].benchmarkValue - initialCapital;
  const recoveryFactorBench = metrics.benchmarkMaxDrawdown === 0 ? 0 : (totalGainBench / (initialCapital * metrics.benchmarkMaxDrawdown / 100));

  // Trade-level stats
  const tradeReturns = trades.map(t => t.returnPct ?? 0);
  const wins   = tradeReturns.filter(r => r > 0);
  const losses = tradeReturns.filter(r => r <= 0);

  const avgWin  = wins.length  > 0 ? wins.reduce((a, b)  => a + b, 0) / wins.length  : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

  const grossWin  = wins.reduce((a, b)   => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? 999 : 0) : grossWin / grossLoss;

  // Best / worst single trade
  const bestTrade  = tradeReturns.length > 0 ? Math.max(...tradeReturns) : 0;
  const worstTrade = tradeReturns.length > 0 ? Math.min(...tradeReturns) : 0;

  // Average holding period (calendar days between consecutive trades)
  let totalHoldDays = 0;
  for (let i = 1; i < trades.length; i++) {
    totalHoldDays += (new Date(trades[i].date).getTime() - new Date(trades[i - 1].date).getTime()) / 86400000;
  }
  const avgHoldDays = trades.length > 1 ? Math.round(totalHoldDays / (trades.length - 1)) : 0;

  // Max consecutive losses
  let maxConsecLoss = 0, consecLoss = 0;
  tradeReturns.forEach(r => {
    if (r <= 0) { consecLoss++; maxConsecLoss = Math.max(maxConsecLoss, consecLoss); }
    else consecLoss = 0;
  });

  // Recovery factor
  const totalGain = equityCurve[n - 1].strategyValue - initialCapital;
  const recoveryFactor = metrics.maxDrawdown === 0 ? 0 : (totalGain / (initialCapital * metrics.maxDrawdown / 100));

  // Compute yearly performance
  const yearsMap: { [year: string]: any[] } = {};
  equityCurve.forEach(pt => {
    const year = new Date(pt.date).getFullYear().toString();
    if (!yearsMap[year]) yearsMap[year] = [];
    yearsMap[year].push(pt);
  });

  const yearlyStats: {
    year: string;
    strategyReturn: number;
    benchmarkReturn: number;
    outperformance: number;
  }[] = [];

  const sortedYears = Object.keys(yearsMap).sort();
  for (let i = 0; i < sortedYears.length; i++) {
    const yr = sortedYears[i];
    const yrData = yearsMap[yr];
    
    let startStrat = yrData[0].strategyValue;
    let startBench = yrData[0].benchmarkValue;
    
    if (i > 0) {
      const prevYrData = yearsMap[sortedYears[i - 1]];
      const lastPrevPt = prevYrData[prevYrData.length - 1];
      startStrat = lastPrevPt.strategyValue;
      startBench = lastPrevPt.benchmarkValue;
    }

    const endStrat = yrData[yrData.length - 1].strategyValue;
    const endBench = yrData[yrData.length - 1].benchmarkValue;

    const strategyReturn = ((endStrat - startStrat) / startStrat) * 100;
    const benchmarkReturn = ((endBench - startBench) / startBench) * 100;
    const outperformance = strategyReturn - benchmarkReturn;

    yearlyStats.push({
      year: yr,
      strategyReturn: Math.round(strategyReturn * 100) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 100) / 100,
      outperformance: Math.round(outperformance * 100) / 100,
    });
  }

  return {
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    sortinoRatioBench: Math.round(sortinoRatioBench * 100) / 100,
    calmarRatio:  Math.round(calmarRatio  * 100) / 100,
    calmarRatioBench:  Math.round(calmarRatioBench  * 100) / 100,
    annVolatility: Math.round(annVolatility * 100) / 100,
    annVolBench:   Math.round(annVolBench   * 100) / 100,
    beta:          Math.round(beta  * 100) / 100,
    alpha:         Math.round(alpha * 10000) / 100,  // in %
    maxDdDuration,
    maxDdDurationBench,
    avgWin:         Math.round(avgWin    * 100) / 100,
    avgLoss:        Math.round(avgLoss   * 100) / 100,
    profitFactor:   Math.round(profitFactor * 100) / 100,
    bestTrade:      Math.round(bestTrade  * 100) / 100,
    worstTrade:     Math.round(worstTrade * 100) / 100,
    avgHoldDays,
    maxConsecLoss,
    recoveryFactor: Math.round(recoveryFactor * 100) / 100,
    recoveryFactorBench: Math.round(recoveryFactorBench * 100) / 100,
    yearlyStats,
  };
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
type Trend = 'up' | 'down' | 'neutral';

function StatCard({
  label, value, bench, unit = '', trend, description, children,
}: {
  label: string; value: string | number; bench?: string | number;
  unit?: string; trend?: Trend; description?: string; children?: React.ReactNode;
}) {
  const color =
    trend === 'up'   ? '#10b981' :
    trend === 'down' ? '#f43f5e' : 'var(--text-primary)';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border-soft)',
      borderRadius: 8,
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      position: 'relative',
    }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.1 }}>
        {value}{unit}
      </span>
      {bench !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          vs SPY: <strong>{bench}{unit}</strong>
        </span>
      )}
      {description && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
          {description}
        </span>
      )}
      {children}
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h3 style={{
      fontSize: 10, fontWeight: 700, color: 'var(--primary)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      borderBottom: '1px solid var(--border-soft)',
      paddingBottom: 4, marginBottom: 8,
      ...style,
    }}>
      {children}
    </h3>
  );
}

// ── MAIN PANEL ────────────────────────────────────────────────────────────────
export function AnalyticsPanel({ results, initialCapital, onSelectYear, onResetRange }: Props) {
  const { metrics } = results;
  const ext = computeExtended(results, initialCapital);
  if (!ext) return null;

  const finalVal = results.equityCurve[results.equityCurve.length - 1]?.strategyValue ?? initialCapital;
  const finalBench = results.equityCurve[results.equityCurve.length - 1]?.benchmarkValue ?? initialCapital;

  const startYear = results.equityCurve[0] ? new Date(results.equityCurve[0].date).getFullYear() : 2018;
  const endYear = results.equityCurve[results.equityCurve.length - 1] 
    ? new Date(results.equityCurve[results.equityCurve.length - 1].date).getFullYear() 
    : 2026;

  const grid = (cols: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 8,
    width: '100%',
  } as React.CSSProperties);

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px' }}>

      {/* ── YEARLY STATISTICS CARDS ────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <SectionTitle style={{ marginBottom: 0 }}>Year-by-Year Performance</SectionTitle>
          {startYear === endYear && onResetRange && (
            <button
              onClick={onResetRange}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-soft)',
                color: 'var(--primary)',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
            >
              ← Reset to All Years
            </button>
          )}
        </div>
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          scrollBehavior: 'smooth',
        }}>
          {ext.yearlyStats.map((stat) => {
            const isPositive = stat.outperformance >= 0;
            return (
              <div
                key={stat.year}
                onClick={() => onSelectYear?.(Number(stat.year))}
                title={`Click to simulate year ${stat.year}`}
                style={{
                  flex: '0 0 auto',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  minWidth: '95px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, border-color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-soft)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border-soft)',
                  paddingBottom: 4,
                  marginBottom: 2,
                }}>
                  {stat.year}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>AEGIS</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: stat.strategyReturn >= 0 ? '#10b981' : '#f43f5e' }}>
                    {stat.strategyReturn > 0 ? '+' : ''}{stat.strategyReturn}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>SPY BENCH</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: stat.benchmarkReturn >= 0 ? 'var(--text-primary)' : '#f43f5e' }}>
                    {stat.benchmarkReturn > 0 ? '+' : ''}{stat.benchmarkReturn}%
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  borderTop: '1px dashed var(--border-soft)',
                  paddingTop: 4,
                  marginTop: 2,
                }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>OUTPERF</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: isPositive ? '#10b981' : '#f43f5e' }}>
                    {isPositive ? '+' : ''}{stat.outperformance}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RETURNS ─────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Returns</SectionTitle>
        <div style={grid(4)}>
          <StatCard
            label="Total Return"
            value={`${metrics.totalReturnPct > 0 ? '+' : ''}${metrics.totalReturnPct}`}
            unit="%"
            bench={`${metrics.benchmarkReturnPct > 0 ? '+' : ''}${metrics.benchmarkReturnPct}`}
            trend={metrics.totalReturnPct >= metrics.benchmarkReturnPct ? 'up' : 'down'}
            description={`Cumulative net return ${startYear}–${endYear}`}
          />
          {(() => {
            const outperfPct = (metrics.totalReturnPct - metrics.benchmarkReturnPct).toFixed(1);
            const ratioData = results.equityCurve.map(pt => pt.strategyValue / Math.max(1, pt.benchmarkValue));
            const maxRatio = Math.max(...ratioData);
            const minRatio = Math.min(...ratioData);
            const sparklineWidth = 100;
            const sparklineHeight = 22;
            const sparklinePoints = ratioData.map((val, idx) => {
              const x = (idx / (ratioData.length - 1)) * sparklineWidth;
              const y = sparklineHeight - ((val - minRatio) / Math.max(0.001, maxRatio - minRatio)) * sparklineHeight;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');

            return (
              <StatCard
                label="Outperformance"
                value={`${(finalVal / finalBench).toFixed(2)}x`}
                bench={`${Number(outperfPct) >= 0 ? '+' : ''}${outperfPct}%`}
                trend={finalVal >= finalBench ? 'up' : 'down'}
                description="Aegis growth multiple & net diff vs SPY"
              >
                <div style={{ position: 'absolute', right: '12px', top: '10px', width: '100px', height: '22px', opacity: 0.8 }}>
                  <svg width="100" height="22">
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      points={sparklinePoints}
                    />
                  </svg>
                </div>
              </StatCard>
            );
          })()}
          <StatCard
            label="CAGR"
            value={`${metrics.cagr > 0 ? '+' : ''}${metrics.cagr}`}
            unit="%"
            bench={`${metrics.benchmarkCagr > 0 ? '+' : ''}${metrics.benchmarkCagr}`}
            trend={metrics.cagr >= metrics.benchmarkCagr ? 'up' : 'down'}
            description="Compound annual growth rate"
          />
          <StatCard
            label="Final Portfolio Value"
            value={`$${finalVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            bench={`$${finalBench.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            trend={finalVal >= finalBench ? 'up' : 'down'}
            description={`From $${initialCapital.toLocaleString()} starting capital`}
          />
        </div>
      </div>

      {/* ── RISK ────────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Risk</SectionTitle>
        <div style={grid(4)}>
          <StatCard
            label="Max Drawdown"
            value={`-${metrics.maxDrawdown}`}
            unit="%"
            bench={`-${metrics.benchmarkMaxDrawdown}`}
            trend={metrics.maxDrawdown <= metrics.benchmarkMaxDrawdown ? 'up' : 'down'}
            description="Largest peak-to-trough loss"
          />
          <StatCard
            label="Max DD Duration"
            value={ext.maxDdDuration}
            unit=" days"
            bench={ext.maxDdDurationBench}
            trend={ext.maxDdDuration <= ext.maxDdDurationBench ? 'up' : 'down'}
            description="Longest time spent underwater"
          />
          <StatCard
            label="Annualized Volatility"
            value={ext.annVolatility}
            unit="%"
            bench={ext.annVolBench}
            trend={ext.annVolatility <= ext.annVolBench ? 'up' : 'down'}
            description="Standard deviation of daily returns × √252"
          />
          <StatCard
            label="Beta (vs SPY)"
            value={ext.beta}
            trend={ext.beta < 1 ? 'up' : 'neutral'}
            description="Sensitivity to SPY moves. < 1 = less volatile"
          />
        </div>
      </div>

      {/* ── RISK-ADJUSTED ─────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Risk-Adjusted Performance</SectionTitle>
        <div style={grid(4)}>
          <StatCard
            label="Sharpe Ratio"
            value={metrics.sharpeRatio}
            bench={metrics.benchmarkSharpeRatio}
            trend={metrics.sharpeRatio >= metrics.benchmarkSharpeRatio ? 'up' : (metrics.sharpeRatio > 0 ? 'neutral' : 'down')}
            description="Excess return per unit of total risk (rf=2%)"
          />
          <StatCard
            label="Sortino Ratio"
            value={ext.sortinoRatio}
            bench={ext.sortinoRatioBench}
            trend={ext.sortinoRatio >= ext.sortinoRatioBench ? 'up' : 'down'}
            description="Excess return per unit of downside risk only"
          />
          <StatCard
            label="Calmar Ratio"
            value={ext.calmarRatio}
            bench={ext.calmarRatioBench}
            trend={ext.calmarRatio >= ext.calmarRatioBench ? 'up' : 'down'}
            description="CAGR ÷ Max Drawdown. > 0.5 is considered good"
          />
          <StatCard
            label="Recovery Factor"
            value={ext.recoveryFactor}
            bench={ext.recoveryFactorBench}
            trend={ext.recoveryFactor >= ext.recoveryFactorBench ? 'up' : 'down'}
            description="Net profit ÷ Max Drawdown amount"
          />
        </div>
      </div>

      {/* ── TRADE STATS ───────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Trade Statistics</SectionTitle>
        <div style={grid(5)}>
          <StatCard
            label="Total Rotations"
            value={metrics.totalTrades}
            trend="neutral"
            description="Number of portfolio switches executed"
          />
          <StatCard
            label="Win Rate"
            value={metrics.winRate}
            unit="%"
            trend={metrics.winRate >= 55 ? 'up' : metrics.winRate >= 45 ? 'neutral' : 'down'}
            description="% of rotations that generated positive return"
          />
          <StatCard
            label="Avg Win"
            value={`+${ext.avgWin}`}
            unit="%"
            trend="up"
            description="Average return of profitable rotations"
          />
          <StatCard
            label="Avg Loss"
            value={ext.avgLoss}
            unit="%"
            trend="down"
            description="Average return of unprofitable rotations"
          />
          <StatCard
            label="Profit Factor"
            value={ext.profitFactor > 99 ? '∞' : ext.profitFactor}
            trend={ext.profitFactor > 1.5 ? 'up' : ext.profitFactor > 1 ? 'neutral' : 'down'}
            description="Gross gains ÷ Gross losses. > 1.5 is strong"
          />
          <StatCard
            label="Best Rotation"
            value={`+${ext.bestTrade}`}
            unit="%"
            trend="up"
            description="Highest single rotation return"
          />
          <StatCard
            label="Worst Rotation"
            value={ext.worstTrade}
            unit="%"
            trend="down"
            description="Lowest single rotation return"
          />
          <StatCard
            label="Max Consec. Losses"
            value={ext.maxConsecLoss}
            trend={ext.maxConsecLoss <= 2 ? 'up' : ext.maxConsecLoss <= 4 ? 'neutral' : 'down'}
            description="Longest losing streak of consecutive rotations"
          />
          <StatCard
            label="Avg Hold Period"
            value={ext.avgHoldDays}
            unit=" days"
            trend="neutral"
            description="Average calendar days between portfolio rotations"
          />
          <StatCard
            label="Total Fees Paid"
            value={`$${metrics.totalFees.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            trend="neutral"
            description="Transaction costs at 0.1% per trade turnover"
          />
        </div>
      </div>

    </div>
  );
}

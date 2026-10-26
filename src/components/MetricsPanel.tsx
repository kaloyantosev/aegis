import React from 'react';
import { 
  Percent, 
  TrendingUp, 
  ShieldAlert, 
  Scale, 
  Award, 
  Activity, 
  DollarSign 
} from 'lucide-react';
import type { Metrics, BacktestConfig } from '../types';

interface MetricsPanelProps {
  metrics: Metrics;
  config: BacktestConfig;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, config }) => {
  const {
    totalReturnPct,
    benchmarkReturnPct,
    cagr,
    benchmarkCagr,
    maxDrawdown,
    benchmarkMaxDrawdown,
    sharpeRatio,
    benchmarkSharpeRatio,
    totalTrades,
    totalFees,
    winRate
  } = metrics;

  const beatsBenchmark = totalReturnPct > benchmarkReturnPct;
  const outperformance = totalReturnPct - benchmarkReturnPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Outperformance Banner */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '16px 20px', 
          background: beatsBenchmark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
          border: `1px solid ${beatsBenchmark ? 'var(--success-border)' : 'var(--danger-border)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: beatsBenchmark ? 'var(--success-bg)' : 'var(--danger-bg)',
          color: beatsBenchmark ? 'var(--success)' : 'var(--danger)',
        }}>
          <Award size={24} />
        </div>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '700' }}>
            {beatsBenchmark ? 'Strategy Beats S&P 500!' : 'Strategy Underperforms S&P 500'}
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {beatsBenchmark 
              ? `Your rotation strategy beat a standard S&P 500 Buy & Hold by ${outperformance.toFixed(2)}% in total returns.` 
              : `Your rotation strategy trailed S&P 500 Buy & Hold by ${Math.abs(outperformance).toFixed(2)}% in total returns.`
            }
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Total Return */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '10px', borderRadius: '10px' }}>
            <Percent size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Total Return</span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: totalReturnPct >= 0 ? 'var(--success)' : 'var(--danger)', margin: '2px 0' }}>
              {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Bench: {benchmarkReturnPct >= 0 ? '+' : ''}{benchmarkReturnPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* CAGR */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent)', padding: '10px', borderRadius: '10px' }}>
            <TrendingUp size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Annualized Return (CAGR)</span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: cagr >= 0 ? 'var(--success)' : 'var(--danger)', margin: '2px 0' }}>
              {cagr >= 0 ? '+' : ''}{cagr.toFixed(2)}%
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Bench: {benchmarkCagr >= 0 ? '+' : ''}{benchmarkCagr.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px', borderRadius: '10px' }}>
            <ShieldAlert size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Max Drawdown</span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)', margin: '2px 0' }}>
              -{Math.abs(maxDrawdown).toFixed(2)}%
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Bench: -{Math.abs(benchmarkMaxDrawdown).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Sharpe Ratio */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '10px', borderRadius: '10px' }}>
            <Scale size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Sharpe Ratio</span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: sharpeRatio >= 1 ? 'var(--success)' : sharpeRatio >= 0.5 ? 'var(--warning)' : 'var(--text-primary)', margin: '2px 0' }}>
              {sharpeRatio.toFixed(2)}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Bench: {benchmarkSharpeRatio.toFixed(2)}
            </span>
          </div>
        </div>

      </div>

      {/* Auxiliary Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        
        {/* Trading Rotations Log summary */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--primary)' }} />
            Rotation Performance
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Rotations Executed:</span>
              <span style={{ fontWeight: '600' }}>{totalTrades} trades</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rotation Win Rate:</span>
              <span style={{ fontWeight: '600', color: winRate >= 50 ? 'var(--success)' : 'var(--text-primary)' }}>
                {winRate.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rebalance Slippage Cost:</span>
              <span style={{ fontWeight: '600', color: 'var(--danger)' }}>
                -{config.transactionFee}% per rebalance
              </span>
            </div>
          </div>
        </div>

        {/* Transaction Cost Breakdown */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={16} style={{ color: 'var(--accent)' }} />
            Fee & Drag Expenses
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Accumulated Fees Paid:</span>
              <span style={{ fontWeight: '600', color: totalFees > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                ${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Starting Capital seed:</span>
              <span style={{ fontWeight: '600' }}>
                ${config.initialCapital.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rebalance Frequency:</span>
              <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                {config.rebalanceFrequency}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

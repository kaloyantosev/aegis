import { useState, useEffect } from 'react';
import { dataService } from './services/dataService';
import { backtester } from './services/backtester';
import { TradingViewChart } from './components/TradingViewChart';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { TradeLogTable } from './components/TradeLogTable';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import type { HistoricalDataCache, BacktestResult } from './types';

// ── CONFIG & STATIC RULE SCHEMAS ──────────────────────────────────────────────

const CONFIG = {
  initialCapital:    10000,
  transactionFee:    0.1, // percent
  rebalanceFrequency: 'none' as const,
  benchmarkTicker:   'SPY',
};

const PORTFOLIOS = [
  {
    id: 'neutral', name: 'Neutral',
    description: '50% SPY, 30% XLK, 10% DBC, 10% XLF',
    assets: [
      { ticker: 'SPY', weight: 50 }, { ticker: 'XLK', weight: 30 },
      { ticker: 'DBC', weight: 10 }, { ticker: 'XLF', weight: 10 },
    ],
  },
  {
    id: 'buy', name: 'Buy',
    description: '30% SPY, 20% XLK, 10% XLG, 10% XLF, 10% XLY, 10% XLE, 10% ICLN',
    assets: [
      { ticker: 'SPY', weight: 30 }, { ticker: 'XLK', weight: 20 },
      { ticker: 'XLG', weight: 10 }, { ticker: 'XLF', weight: 10 },
      { ticker: 'XLY', weight: 10 }, { ticker: 'XLE', weight: 10 },
      { ticker: 'ICLN', weight: 10 },
    ],
  },
  {
    id: 'strong-buy', name: 'Strong Buy',
    description: '30% SPY, 30% XLK, 10% XLG, 20% XLF, 10% XLY',
    assets: [
      { ticker: 'SPY', weight: 30 }, { ticker: 'XLK', weight: 30 },
      { ticker: 'XLG', weight: 10 }, { ticker: 'XLF', weight: 20 },
      { ticker: 'XLY', weight: 10 },
    ],
  },
  {
    id: 'heavy-buy', name: 'Heavy Buy',
    description: '20% SPY, 50% XLK, 30% XLG',
    assets: [
      { ticker: 'SPY', weight: 20 }, { ticker: 'XLK', weight: 50 },
      { ticker: 'XLG', weight: 30 },
    ],
  },
  {
    id: 'extreme-buy', name: 'Extreme Buy',
    description: '80% XLK, 20% TQQQ — max risk capitulation buy',
    assets: [
      { ticker: 'XLK', weight: 80 }, { ticker: 'TQQQ', weight: 20 },
    ],
  },
];

const RULES = [
  { id: 'r1', indicator: 'SMA' as const, period: 50,  operator: 'above' as const, targetPortfolioId: 'heavy-buy' },
  { id: 'r2', indicator: 'SMA' as const, period: 200, operator: 'above' as const, targetPortfolioId: 'buy' },
];

// ── APP ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [startDate, setStartDate] = useState('2006-01-03');
  const [endDate,   setEndDate]   = useState('2026-06-30');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [results,   setResults]   = useState<BacktestResult | null>(null);
  const [cache,     setCache]     = useState<HistoricalDataCache>({});
  const [showDoc,   setShowDoc]   = useState(false);

  const runBacktest = async (start = startDate, end = endDate) => {
    setError(null);
    setLoading(true);
    try {
      const tickers = new Set<string>([
        CONFIG.benchmarkTicker,
        ...PORTFOLIOS.flatMap(p => p.assets.map(a => a.ticker)),
      ]);
      const freshCache: HistoricalDataCache = { ...cache };
      for (const ticker of tickers) {
        if (!freshCache[ticker]) {
          freshCache[ticker] = await dataService.getHistoricalData(ticker);
        }
      }
      setCache(freshCache);
      const dynamicConfig = {
        ...CONFIG,
        startDate: start,
        endDate: end,
      };
      setResults(backtester.run(dynamicConfig, PORTFOLIOS, RULES, 'neutral', freshCache));
    } catch (e: any) {
      setError(e.message ?? 'Simulation error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectYear = (year: number) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    setStartDate(start);
    setEndDate(end);
    runBacktest(start, end);
  };

  const handleResetRange = () => {
    const start = '2006-01-03';
    const end = '2026-06-30';
    setStartDate(start);
    setEndDate(end);
    runBacktest(start, end);
  };

  useEffect(() => { runBacktest(); }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="glass-panel" style={{
        margin: '16px 16px 8px 16px', padding: '16px 32px', borderRadius: '16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
            padding: '10px', borderRadius: '12px', color: 'white',
            boxShadow: '0 4px 20px var(--primary-glow)',
          }}>
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <h1 className="glow-text" style={{ fontSize: '22px', fontWeight: '800', lineHeight: 1.2 }}>
              Aegis
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Tactical Support System & Backtest Log · $10,000 Capital
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowDoc(true)}
          className="btn"
          style={{
            padding: '8px 20px', fontSize: '12px', borderRadius: '8px',
            cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-soft)', color: 'var(--text-primary)',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
        >
          Documentation
        </button>
      </header>

      {/* Date controls toolbar */}
      <div className="glass-panel" style={{
        margin: '0 16px 16px 16px', padding: '12px 24px', borderRadius: '12px',
        display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'flex-start',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Start Date:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-soft)',
              color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>End Date:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-soft)',
              color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px',
            }}
          />
        </div>
        <button
          onClick={() => runBacktest()}
          disabled={loading}
          className="btn btn-primary"
          style={{
            padding: '6px 16px', fontSize: '12px', borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
      </div>

      {/* Body */}
      <main style={{ flex: 1, padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {error && (
          <div className="glass-panel" style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            display: 'flex', gap: '12px', alignItems: 'flex-start',
          }}>
            <AlertCircle style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ color: '#fca5a5', fontWeight: 700, fontSize: 15 }}>Simulation Failed</h4>
              <p style={{ fontSize: 13, color: '#fecdd3', marginTop: 4 }}>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="glass-panel" style={{
            height: 500, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 40, height: 40,
              border: '3px solid rgba(255,255,255,0.05)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%', animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
              Loading decision support engine data…
            </div>
          </div>
        ) : results ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Strategy Explanation Card */}
            <div className="glass-panel" style={{ padding: '16px 20px', lineHeight: 1.5 }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Aegis is an algorithmic decision engine designed to exploit market inefficiencies. By continuously scanning market internals, the algorithm identifies deep pools of market fear—converting panic sell-offs into precise, high-probability buying opportunities to aggressively outpace the benchmark.
              </p>
            </div>

            {/* USI Chart + Equity Curve (Moved to Top) */}
            <TradingViewChart
              equityCurve={results.equityCurve}
              spyData={cache[CONFIG.benchmarkTicker] || []}
              trades={results.trades}
              rules={RULES}
              benchmarkTicker={CONFIG.benchmarkTicker}
            />

            {/* Full analytics dashboard (Moved to Bottom) */}
            <AnalyticsPanel results={results} initialCapital={CONFIG.initialCapital} onSelectYear={handleSelectYear} onResetRange={handleResetRange} />

            {/* Trade log */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-soft)', paddingBottom: 6, marginBottom: 12 }}>
                Rotation Decision Log — {results.trades.length} Records
              </h3>
              <TradeLogTable trades={results.trades} />
            </div>

          </div>
        ) : null}

      </main>

      {/* Documentation Modal */}
      {showDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '24px', boxSizing: 'border-box'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '550px', width: '100%', padding: '28px', borderRadius: '16px',
            position: 'relative', border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(21, 28, 45, 0.95)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', margin: 0, borderBottom: '1px solid var(--border-soft)', paddingBottom: '10px' }}>
              Aegis Algorithmic Framework
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0 }}>
                Aegis utilizes a quantitative, structural asset rotation methodology designed to exploit systematic periods of market stress and capitulation. 
              </p>
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Core Mechanisms:</strong>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>
                    <strong style={{ color: 'var(--text-primary)' }}>Structural Internals Scanning:</strong> The engine monitors aggregate participation metrics across multiple index components to assess the depth and exhaustion of market-wide sell-offs.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--text-primary)' }}>Dynamic Risk Ladder:</strong> Exposure scales through distinct, quantitative tiers (Buy, Strong Buy, Heavy Buy, Extreme Buy) corresponding to statistical panic milestones.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--text-primary)' }}>Asymmetric Rotation:</strong> Strategically rotates capital away from defensive assets into high-beta technology benchmarks during peak capitulation, capturing maximum recovery velocity.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--text-primary)' }}>Friction Dampeners:</strong> Implements time-lock parameters to prevent premature asset reallocation and stabilize performance during high-volatility regimes.
                  </li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowDoc(false)}
              className="btn btn-primary"
              style={{
                alignSelf: 'flex-end', padding: '8px 24px', fontSize: '12px', borderRadius: '6px',
                cursor: 'pointer', marginTop: '12px'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <footer style={{
        padding: '16px', fontSize: 11, color: 'var(--text-muted)',
        textAlign: 'center', borderTop: '1px solid var(--border-soft)',
      }}>
        Personal Decision Support Panel · Local backtester logic
      </footer>
    </div>
  );
}

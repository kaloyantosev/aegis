import { useEffect, useMemo, useState } from 'react';
import { backtester } from './services/backtester';
import { periodStats, rangeIndex, rebased, yearlyCards } from './services/stats';
import { loadPrices, type LoadedData } from './data';
import { AGGRESSIVE, CLASSIC, REGIME_COLORS, REGIME_NAMES } from './portfolios';
import { PerformanceChart } from './components/PerformanceChart';
import { TriggersChart } from './components/TriggersChart';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { RotationLog } from './components/RotationLog';
import type { BacktestResult } from './types';

const BASE = { initialCapital: 10000, transactionFee: 0.1, benchmarkTicker: 'SPY' };

export default function App() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aggressive, setAggressive] = useState(true);
  const [top10, setTop10] = useState(true);
  const [bearShield, setBearShield] = useState(true);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [noTop10, setNoTop10] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showDoc, setShowDoc] = useState(false);

  // Period selection: the applied range plus the editable inputs in the toolbar.
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  useEffect(() => {
    loadPrices().then(setData).catch(e => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!data) return;
    setRunning(true);
    const id = setTimeout(() => {
      try {
        const portfolios = aggressive ? AGGRESSIVE : CLASSIC;
        const cfg = { ...BASE, useTop10Neutral: top10, useBearShield: bearShield };
        const r = backtester.run(cfg, portfolios, data.cache);
        setResult(r);
        setNoTop10(top10 ? backtester.run({ ...cfg, useTop10Neutral: false }, portfolios, data.cache) : null);
        setStartInput(s => s || r.startDate);
        setEndInput(e => e || r.endDate);
      } catch (e) {
        setError(String((e as Error).message ?? e));
      } finally {
        setRunning(false);
      }
    }, 20);
    return () => clearTimeout(id);
  }, [data, aggressive, top10, bearShield]);

  const view = useMemo(() => {
    if (!result) return null;
    const start = range?.start ?? result.startDate;
    const end = range?.end ?? result.endDate;
    const stats = periodStats(result.equityCurve, result.trades, start, end);
    const idx = rangeIndex(result.equityCurve, start, end);
    if (!stats || !idx) return null;
    return {
      stats,
      curve: rebased(result.equityCurve, idx),
      cards: yearlyCards(result.equityCurve, result.trades),
      withoutTop10: noTop10 ? periodStats(noTop10.equityCurve, noTop10.trades, start, end) : null,
    };
  }, [result, noTop10, range]);

  const selectYear = (y: number) => {
    if (!result) return;
    const start = `${y}-01-01`, end = `${y}-12-31`;
    setSelectedYear(y);
    setRange({ start, end });
    setStartInput(start < result.startDate ? result.startDate : start);
    setEndInput(end > result.endDate ? result.endDate : end);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const applyRange = () => {
    if (!startInput || !endInput || startInput > endInput) return;
    setSelectedYear(null);
    setRange({ start: startInput, end: endInput });
  };
  const resetRange = () => {
    setSelectedYear(null);
    setRange(null);
    if (result) { setStartInput(result.startDate); setEndInput(result.endDate); }
  };

  const neutralName = top10 ? 'Neutral (US Top 10)' : 'Neutral';
  const regimeName = (id: string) => (id === 'neutral' ? neutralName : REGIME_NAMES[id] ?? id);
  const lastUsi = result?.equityCurve[result.equityCurve.length - 1]?.usi;
  const periodLabel = selectedYear ? String(selectedYear) : range ? `${view?.stats.from} → ${view?.stats.to}` : 'All years';

  return (
    <div className="app">
      <header className="panel header">
        <div className="brand-block">
          <div className="logo" aria-hidden>⇄</div>
          <div>
            <div className="brand">Aegis</div>
            <div className="muted small">Tactical rotation backtest · $10,000 starting capital</div>
          </div>
        </div>
        <div className="header-right">
          <span className="pill small"><span className="dot" />Data to <b>{data?.asOf ?? '…'}</b></span>
          <button className="btn" onClick={() => setShowDoc(true)}>Documentation</button>
        </div>
      </header>

      <div className="panel toolbar">
        <div className="toolbar-group">
          <label>Start <input type="date" value={startInput} min={result?.startDate} max={result?.endDate} onChange={e => setStartInput(e.target.value)} /></label>
          <label>End <input type="date" value={endInput} min={result?.startDate} max={result?.endDate} onChange={e => setEndInput(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={applyRange} disabled={!result}>Apply range</button>
          <span className="muted small">Viewing: <b>{periodLabel}</b></span>
        </div>
        <div className="toolbar-group">
          <button className={`switch ${top10 ? 'on green' : ''}`} onClick={() => setTop10(v => !v)}
            title="Neutral holds the 10 highest-scoring US mega caps (equal weight, monthly) instead of 50% SPY / 30% XLK / 10% DBC / 10% XLF">
            Neutral: {top10 ? 'US Top 10' : 'ETF mix'}
          </button>
          <button className={`switch ${bearShield ? 'on blue' : ''}`} onClick={() => setBearShield(v => !v)}
            title="Move to 75% T-bills / 25% gold in structural bear markets">
            Bear Shield: {bearShield ? 'On' : 'Off'}
          </button>
          <button className={`switch ${aggressive ? 'on amber' : ''}`} onClick={() => setAggressive(v => !v)}
            title="Aggressive ladder adds QQQ and leveraged TQQQ as stress rises; Classic uses sector ETFs">
            Dip ladder: {aggressive ? 'Aggressive (TQQQ)' : 'Classic'}
          </button>
        </div>
      </div>

      <main>
        {error && <div className="panel error">{error}</div>}

        {!view || running ? (
          <div className="panel loading">{data ? 'Running backtest…' : 'Loading prices…'}</div>
        ) : (
          <>
            <section className="panel intro">
              <p>
                Aegis holds a core equity portfolio, adds risk in stages as market stress (the USI index) rises, and moves to T-bills
                and gold in structural bear markets. Tested on total-return prices with next-day execution and 0.1% trading cost.
              </p>
              <div className="now">
                <span className="now-label">Current signal ({result!.endDate}):</span>
                <b style={{ color: REGIME_COLORS[result!.currentPortfolioId] }}>{regimeName(result!.currentPortfolioId)}</b>
                <span className="muted">USI {lastUsi?.toFixed(0)}</span>
                <span className="chips">
                  {result!.currentHoldings.map(a => <span key={a.ticker} className="chip">{a.ticker} {Math.round(a.weight)}%</span>)}
                </span>
                {top10 && <span className="muted small">{result!.top10Updates} monthly Top-10 roster changes since 2006</span>}
              </div>
            </section>

            <section className="panel">
              <h3>Performance: Aegis vs SPY buy &amp; hold <span className="muted small">· {periodLabel} · $10,000 start</span></h3>
              <PerformanceChart curve={view.curve} log={view.stats.years > 2} />
              <div className="legend small muted">
                <span><i style={{ background: 'var(--accent)' }} />Aegis</span>
                <span><i style={{ background: 'var(--muted)' }} />SPY (total return)</span>
                <span>Lower panel: drawdown from peak{view.stats.years > 2 ? ' · log scale' : ''}</span>
              </div>
            </section>

            <section className="panel">
              <h3>Rotational triggers <span className="muted small">· USI stress index, log scale</span></h3>
              <TriggersChart curve={view.curve} trades={result!.trades} />
              <div className="legend small muted">
                {['buy', 'strong-buy', 'heavy-buy', 'extreme-buy', 'neutral', 'bear-shield'].map(id => (
                  <span key={id}><i style={{ background: REGIME_COLORS[id] }} />{id === 'neutral' ? 'Back to Neutral' : REGIME_NAMES[id]}</span>
                ))}
              </div>
            </section>

            <AnalyticsPanel
              cards={view.cards}
              stats={view.stats}
              selectedYear={selectedYear}
              isCustomRange={!!range && !selectedYear}
              onSelectYear={selectYear}
              onReset={resetRange}
              withoutTop10={view.withoutTop10}
            />

            <RotationLog trades={result!.trades} curve={result!.equityCurve} from={view.stats.from} to={view.stats.to} />
          </>
        )}
      </main>

      {showDoc && (
        <div className="modal-backdrop" onClick={() => setShowDoc(false)}>
          <div className="panel modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Documentation">
            <h2>How Aegis works and how it is tested</h2>
            <h4>Strategy</h4>
            <ul>
              <li><b>Neutral:</b> the 10 highest-scoring US mega caps (size × 3/6/12-month momentum × trend), 10% each, reviewed monthly. Or an ETF mix (50% SPY, 30% XLK, 10% DBC, 10% XLF).</li>
              <li><b>Buy → Extreme Buy:</b> when the USI stress index stays above 188 / 228 / 323 / 895 for two closes, rotate into progressively more aggressive portfolios (QQQ and TQQQ in the aggressive ladder).</li>
              <li><b>Bear Shield:</b> 75% T-bills, 25% gold when SPY is in a structural downtrend and a new stress wave starts. Exit on capitulation (to Extreme Buy) or when stress normalises (to Neutral).</li>
            </ul>
            <h4>Testing</h4>
            <ul>
              <li>Total-return prices (dividends reinvested) for every fund and for SPY, so T-bills earn their yield.</li>
              <li>Signals use the day's close and trade at the next close, with 0.1% cost on turnover.</li>
              <li>One continuous run from Jan 2006 (indicators warmed up on 2005 data). Every year and date range is a slice of that run, rebased to $10,000.</li>
              <li>No simulated prices. Before TQQQ existed (Feb 2010) its weight is held in QQQ, before BIL (May 2007) in cash, and other missing funds' weight is spread across the rest of the portfolio. Affected years are marked †.</li>
              <li>Sharpe is measured on daily returns in excess of T-bills.</li>
            </ul>
            <h4>Caveats</h4>
            <ul>
              <li>The Top-10 sleeve picks from today's mega caps, so it carries survivorship bias. Compare with the "without Top-10 sleeve" line.</li>
              <li>The USI thresholds and Bear Shield triggers were tuned on this same history. Expect live results to be weaker.</li>
            </ul>
            <p className="muted small">Data: {data?.source}. Not investment advice.</p>
            <button className="btn btn-primary" onClick={() => setShowDoc(false)}>Close</button>
          </div>
        </div>
      )}

      <footer className="muted small">Aegis · personal decision-support backtest · prices refreshed weekly</footer>
    </div>
  );
}

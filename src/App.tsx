import { useEffect, useMemo, useState } from 'react';
import { backtester } from './services/backtester';
import { loadPrices, type LoadedData } from './data';
import { AGGRESSIVE, CLASSIC, REGIME_NAMES } from './portfolios';
import { EquityChart } from './EquityChart';
import type { BacktestResult, RatioSet } from './types';

const BASE = { initialCapital: 10000, transactionFee: 0.1, benchmarkTicker: 'SPY' };

const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint: string }) {
  return (
    <label className="toggle" title={hint}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function RatioRow({ label, r, muted }: { label: string; r: RatioSet; muted?: boolean }) {
  return (
    <tr className={muted ? 'muted' : ''}>
      <td>{label}</td>
      <td className="r">{pct(r.cagr)}</td>
      <td className="r">{pct(r.volatility)}</td>
      <td className="r">{r.sharpe.toFixed(2)}</td>
      <td className="r">{pct(-r.maxDrawdown, 1).replace('-', '−')}</td>
    </tr>
  );
}

export default function App() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ladder, setLadder] = useState<'aggressive' | 'classic'>('aggressive');
  const [top10, setTop10] = useState(true);
  const [bearShield, setBearShield] = useState(true);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [noTop10, setNoTop10] = useState<BacktestResult | null>(null);

  useEffect(() => {
    loadPrices().then(setData).catch(e => setError(String(e.message ?? e)));
  }, []);

  const portfolios = ladder === 'aggressive' ? AGGRESSIVE : CLASSIC;

  useEffect(() => {
    if (!data) return;
    setResult(null);
    // Yield to the browser so the loading state paints before the ~0.5 s backtest.
    const id = setTimeout(() => {
      try {
        const cfg = { ...BASE, useTop10Neutral: top10, useBearShield: bearShield };
        setResult(backtester.run(cfg, portfolios, data.cache));
        setNoTop10(top10 ? backtester.run({ ...cfg, useTop10Neutral: false }, portfolios, data.cache) : null);
      } catch (e) {
        setError(String((e as Error).message ?? e));
      }
    }, 20);
    return () => clearTimeout(id);
  }, [data, portfolios, top10, bearShield]);

  const yearSummary = useMemo(() => {
    if (!result) return null;
    const full = result.yearly.filter(y => !y.partial);
    const beat = full.filter(y => y.excess > 0).length;
    const sorted = full.map(y => y.excess).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return { beat, total: full.length, median, worst: Math.min(...full.map(y => y.strategyReturn)) };
  }, [result]);

  if (error) return <main className="wrap"><p className="error">{error}</p></main>;

  const lastPoint = result?.equityCurve[result.equityCurve.length - 1];

  return (
    <>
      <header className="top">
        <div className="wrap top-row">
          <span className="brand">Aegis</span>
          <span className="muted small">{data ? `Prices to ${fmtDate(data.asOf)}` : 'Loading prices…'}</span>
        </div>
      </header>

      <main className="wrap">
        <section className="intro">
          <h1>Stress-regime rotation vs the S&amp;P 500</h1>
          <p className="lead">
            A rules-based strategy that holds a core equity portfolio, adds leverage in stages as market stress (the USI index)
            rises, and moves to T-bills and gold in structural bear markets. Backtested on total-return prices with next-day execution.
          </p>
          <div className="controls">
            <div className="seg" role="group" aria-label="Dip-buying ladder">
              <button className={ladder === 'aggressive' ? 'on' : ''} onClick={() => setLadder('aggressive')}>Aggressive ladder</button>
              <button className={ladder === 'classic' ? 'on' : ''} onClick={() => setLadder('classic')}>Classic ladder</button>
            </div>
            <Toggle label="Top-10 stock sleeve in Neutral" checked={top10} onChange={setTop10} hint="Neutral holds the 10 highest-scoring US mega caps (size × momentum × trend), equal weight, reviewed monthly" />
            <Toggle label="Bear Shield" checked={bearShield} onChange={setBearShield} hint="Move to 75% T-bills / 25% gold in structural bear markets" />
          </div>
        </section>

        {!result ? (
          <p className="muted">Running backtest…</p>
        ) : (
          <>
            <section className="grid2">
              <div className="card now">
                <div className="muted small">Current signal · {fmtDate(result.endDate)}</div>
                <div className="regime">{REGIME_NAMES[result.currentPortfolioId] ?? result.currentPortfolioId}</div>
                <div className="small">
                  USI {lastPoint?.usi.toFixed(0)} · holds{' '}
                  {result.currentHoldings.map(a => `${a.ticker} ${Math.round(a.weight)}%`).join(', ')}
                </div>
              </div>
              <div className="card">
                <table className="ratios">
                  <thead>
                    <tr><th></th><th className="r">CAGR</th><th className="r">Volatility</th><th className="r">Sharpe</th><th className="r">Max drawdown</th></tr>
                  </thead>
                  <tbody>
                    <RatioRow label="Strategy" r={result.metrics.strategy} />
                    <RatioRow label="S&P 500 (SPY, total return)" r={result.metrics.benchmark} />
                    {noTop10 && <RatioRow label="Strategy without Top-10 sleeve" r={noTop10.metrics.strategy} muted />}
                  </tbody>
                </table>
                <p className="muted small note">
                  {fmtDate(result.startDate)} – {fmtDate(result.endDate)} ({result.metrics.years.toFixed(1)} years) · Sharpe vs T-bills ·{' '}
                  {result.metrics.rotationsPerYear.toFixed(1)} rotations a year · 0.1% cost per trade
                </p>
              </div>
            </section>

            <section>
              <h2>Growth of $10,000</h2>
              <div className="card chart-card"><EquityChart curve={result.equityCurve} /></div>
              <div className="legend small muted">
                <span><i style={{ background: 'var(--accent)' }} />Strategy</span>
                <span><i style={{ background: 'var(--muted)' }} />S&amp;P 500</span>
                <span>Log scale · lower panel: drawdown from peak</span>
              </div>
            </section>

            <section>
              <h2>Every calendar year</h2>
              <p className="muted small">
                All years come from one continuous run with the same rules, costs and total-return prices, so each row is directly comparable.
                {yearSummary && ` Beat the S&P 500 in ${yearSummary.beat} of ${yearSummary.total} full years; median excess ${signed(yearSummary.median)}.`}
              </p>
              <div className="card table-wrap">
                <table className="years">
                  <thead>
                    <tr>
                      <th>Year</th><th className="r">Strategy</th><th className="r">S&amp;P 500</th><th className="r">Excess</th>
                      <th className="r">Max DD</th><th className="r">S&amp;P max DD</th><th className="r">Days in Bear Shield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.yearly.map(y => (
                      <tr key={y.year} className={y.partial ? 'partial' : ''}>
                        <td>{y.year}{y.partial && <span className="muted small"> YTD</span>}</td>
                        <td className={`r ${tone(y.strategyReturn)}`}>{signed(y.strategyReturn)}</td>
                        <td className={`r ${tone(y.benchmarkReturn)}`}>{signed(y.benchmarkReturn)}</td>
                        <td className={`r strong ${tone(y.excess)}`}>{signed(y.excess)}</td>
                        <td className="r">{pct(-y.strategyMaxDD, 0).replace('-', '−')}</td>
                        <td className="r muted">{pct(-y.benchmarkMaxDD, 0).replace('-', '−')}</td>
                        <td className="r muted">{y.defensiveDays > 0 ? pct(y.defensiveDays, 0) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <details className="card log">
                <summary>Rotation log ({result.trades.length})</summary>
                <table>
                  <thead><tr><th>Signal</th><th>Executed</th><th>From → to</th><th>Why</th></tr></thead>
                  <tbody>
                    {[...result.trades].reverse().map((t, i) => (
                      <tr key={i}>
                        <td className="nowrap">{t.signalDate}</td>
                        <td className="nowrap muted">{t.date}</td>
                        <td className="nowrap">{REGIME_NAMES[t.fromPortfolio ?? ''] ?? '–'} → {REGIME_NAMES[t.toPortfolio]}</td>
                        <td className="muted">{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>

            <section className="method">
              <h2>How this is tested, and what to watch for</h2>
              <ul>
                <li><b>Prices</b> are total return (dividends reinvested) for every holding and for the benchmark, so T-bills earn their yield and SPY includes dividends.</li>
                <li><b>No look-ahead in execution:</b> signals use the day's close and are traded at the next day's close, with 0.1% cost on turnover.</li>
                <li><b>No simulated data.</b> The test starts in {result.startDate.slice(0, 4)}, the first full year in which every fund the strategy can hold (including TQQQ, launched Feb 2010) has real prices.</li>
                <li><b>Survivorship bias in the Top-10 sleeve:</b> stocks are chosen from today's mega caps, and 2006–2012 leaders that later collapsed are not in the list. The muted row above shows the strategy without that sleeve.</li>
                <li><b>In-sample rules:</b> the USI thresholds and Bear Shield triggers were tuned on this same history, so expect live results to be weaker than the backtest.</li>
              </ul>
              {data && <p className="muted small">Data: {data.source}. Refreshed weekly. Not investment advice.</p>}
            </section>
          </>
        )}
      </main>
    </>
  );
}

import type { PeriodStats } from '../types';
import type { YearCard } from '../services/stats';

const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

function Stat({ label, value, bench, better, note }: { label: string; value: string; bench: string; better: boolean | null; note: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${better === null ? '' : better ? 'up' : 'down'}`}>{value}</div>
      <div className="stat-bench">SPY {bench}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

interface Props {
  cards: YearCard[];
  stats: PeriodStats;
  selectedYear: number | null;
  isCustomRange: boolean;
  onSelectYear: (y: number) => void;
  onReset: () => void;
  withoutTop10: PeriodStats | null;
}

export function AnalyticsPanel({ cards, stats, selectedYear, isCustomRange, onSelectYear, onReset, withoutTop10 }: Props) {
  const s = stats.strategy, b = stats.benchmark;
  const multiYear = stats.years >= 1.5;
  const selectedCard = cards.find(c => c.year === selectedYear);

  return (
    <section className="panel analytics">
      <div className="panel-head">
        <div>
          <h3>Year-by-year performance</h3>
          <p className="muted small">
            Every year is cut from the same continuous run and measured close to close, so the cards are directly comparable.
            Click a year for its charts, metrics and rotations.
          </p>
        </div>
        {(selectedYear || isCustomRange) && <button className="btn" onClick={onReset}>← Back to all years</button>}
      </div>

      <div className="years-strip">
        {cards.map(c => {
          const ex = c.stats.strategy.totalReturn - c.stats.benchmark.totalReturn;
          return (
            <button
              key={c.year}
              className={`year-card ${selectedYear === c.year ? 'active' : ''}`}
              onClick={() => onSelectYear(c.year)}
              title={c.stats.proxyDays ? 'Part of this year held QQQ in place of TQQQ (or another stand-in) because the fund did not exist yet' : `Show ${c.year}`}
            >
              <span className="yc-year">{c.year}{c.partial && <small> YTD</small>}{c.stats.proxyDays > 0 && <sup>†</sup>}</span>
              <span className="yc-row"><small>Aegis</small><b className={tone(c.stats.strategy.totalReturn)}>{signed(c.stats.strategy.totalReturn, 0)}</b></span>
              <span className="yc-row"><small>SPY</small><b className="muted">{signed(c.stats.benchmark.totalReturn, 0)}</b></span>
              <span className="yc-row yc-ex"><small>Excess</small><b className={tone(ex)}>{signed(ex, 0)}</b></span>
            </button>
          );
        })}
      </div>
      <p className="muted small footnote">† Before Feb 2010 the TQQQ allocation is held as QQQ (unleveraged), because TQQQ did not exist. No prices are simulated.</p>

      {(selectedYear || isCustomRange) && (
        <div className="banner">
          <b>{selectedYear ? `${selectedYear}${selectedCard?.partial ? ' (year to date)' : ''}` : 'Custom range'}</b>
          {' '}· {stats.from} → {stats.to} · rebased to $10,000 at the prior close. The strategy enters the period holding what it actually held
          {stats.proxyDays > 0 && ` · ${stats.proxyDays} days used a stand-in fund`}.
        </div>
      )}

      <div className="stats-grid">
        <Stat label="Return" value={signed(s.totalReturn)} bench={signed(b.totalReturn)} better={s.totalReturn >= b.totalReturn}
          note={`$10,000 → ${money(s.finalValue)} (SPY ${money(b.finalValue)})`} />
        <Stat label="CAGR" value={multiYear ? signed(s.cagr) : '–'} bench={multiYear ? signed(b.cagr) : '–'} better={multiYear ? s.cagr >= b.cagr : null}
          note={multiYear ? `Compound annual growth over ${stats.years.toFixed(1)} years` : 'Shown for periods over 1.5 years'} />
        <Stat label="Max drawdown" value={signed(-s.maxDrawdown)} bench={signed(-b.maxDrawdown)} better={s.maxDrawdown <= b.maxDrawdown}
          note="Largest fall from a peak" />
        <Stat label="Volatility" value={`${s.volatility.toFixed(1)}%`} bench={`${b.volatility.toFixed(1)}%`} better={s.volatility <= b.volatility}
          note="Annualised standard deviation of daily returns" />
        <Stat label="Sharpe ratio" value={s.sharpe.toFixed(2).replace('-', '−')} bench={b.sharpe.toFixed(2).replace('-', '−')} better={s.sharpe >= b.sharpe}
          note="Excess return over T-bills per unit of risk" />
      </div>

      <div className="period-facts small muted">
        <span>{stats.rotations} rotations</span>
        <span>Fees {money(stats.fees)} (0.1% of turnover)</span>
        <span>Bear Shield {stats.defensiveDays.toFixed(0)}% of days</span>
        {withoutTop10 && (
          <span title="Same rules with the ETF Neutral portfolio instead of the Top-10 stock sleeve, which is picked from today's mega caps (survivorship bias)">
            Without Top-10 sleeve: {signed(withoutTop10.strategy.totalReturn)} return, Sharpe {withoutTop10.strategy.sharpe.toFixed(2).replace('-', '−')}, max DD {signed(-withoutTop10.strategy.maxDrawdown)}
          </span>
        )}
      </div>
    </section>
  );
}

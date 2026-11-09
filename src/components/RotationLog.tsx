import type { EquityPoint, Trade } from '../types';
import { REGIME_COLORS, REGIME_NAMES } from '../portfolios';

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;

/** Rotations in the selected period, newest first, with the return until the next rotation. */
export function RotationLog({ trades, curve, from, to }: { trades: Trade[]; curve: EquityPoint[]; from: string; to: string }) {
  const valueOn = (d: string) => curve.find(p => p.date >= d) ?? curve[curve.length - 1];
  const rows = trades
    .map((t, i) => {
      const next = trades[i + 1];
      const end = next ? valueOn(next.date) : curve[curve.length - 1];
      const start = valueOn(t.date);
      return { t, held: (end.strategy / start.strategy - 1) * 100, until: next?.date ?? 'now' };
    })
    .filter(r => r.t.date >= from && r.t.date <= to)
    .reverse();

  return (
    <section className="panel">
      <h3>Rotation log · {rows.length} rotations</h3>
      {rows.length === 0 ? (
        <p className="muted small">No rotations in this period: the strategy stayed in one regime.</p>
      ) : (
        <div className="table-wrap">
          <table className="log">
            <thead>
              <tr><th>Signal</th><th>Executed</th><th>Rotation</th><th className="r">USI</th><th className="r">Return held</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {rows.map(({ t, held, until }) => (
                <tr key={`${t.date}-${t.toPortfolio}`}>
                  <td className="nowrap">{t.signalDate}</td>
                  <td className="nowrap muted">{t.date}</td>
                  <td className="nowrap">
                    <span className="muted">{REGIME_NAMES[t.fromPortfolio ?? ''] ?? '–'}</span> →{' '}
                    <b style={{ color: REGIME_COLORS[t.toPortfolio] }}>{REGIME_NAMES[t.toPortfolio]}</b>
                  </td>
                  <td className="r">{t.usi.toFixed(0)}</td>
                  <td className={`r ${held >= 0 ? 'up' : 'down'}`} title={`Until ${until}`}>{signed(held)}</td>
                  <td className="muted">
                    {t.reason}
                    {t.substitutions.length > 0 && <span className="tag">{t.substitutions.join(', ')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { AreaSeries, LineStyle, PriceScaleMode, createChart, createSeriesMarkers } from 'lightweight-charts';
import type { SeriesMarker, Time } from 'lightweight-charts';
import type { EquityPoint, Trade } from '../types';
import { REGIME_COLORS, REGIME_NAMES } from '../portfolios';
import { baseChartOptions, css, keepFitted } from './PerformanceChart';

export const USI_LEVELS = [
  { value: 187.947, label: 'Buy', id: 'buy' },
  { value: 227.81, label: 'Strong Buy', id: 'strong-buy' },
  { value: 323.14, label: 'Heavy Buy', id: 'heavy-buy' },
  { value: 894.52, label: 'Extreme Buy', id: 'extreme-buy' },
];

/** USI stress index (log scale) with tier thresholds and a marker at every rotation. */
export function TriggersChart({ curve, trades }: { curve: EquityPoint[]; trades: Trade[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || curve.length < 2) return;
    const chart = createChart(el, {
      ...baseChartOptions(),
      rightPriceScale: { borderVisible: false, mode: PriceScaleMode.Logarithmic },
    });
    const usi = chart.addSeries(AreaSeries, {
      lineColor: '#d97706', topColor: 'rgba(217,119,6,0.28)', bottomColor: 'rgba(217,119,6,0.02)', lineWidth: 1,
      title: 'USI', priceLineVisible: false,
      priceFormat: { type: 'custom', minMove: 1, formatter: (v: number) => v.toFixed(0) },
    });
    usi.setData(curve.map(p => ({ time: p.date, value: p.usi })));
    USI_LEVELS.forEach(l => usi.createPriceLine({
      price: l.value, color: REGIME_COLORS[l.id], lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: l.label,
    }));

    const from = curve[0].date, to = curve[curve.length - 1].date;
    const markers: SeriesMarker<Time>[] = trades
      .filter(t => t.date >= from && t.date <= to)
      .map(t => {
        const defensive = t.toPortfolio === 'bear-shield';
        const neutral = t.toPortfolio === 'neutral';
        return {
          time: t.date,
          position: defensive || neutral ? 'aboveBar' : 'belowBar',
          shape: defensive ? 'arrowDown' : neutral ? 'circle' : 'arrowUp',
          color: REGIME_COLORS[t.toPortfolio] ?? css('--muted'),
          text: curve.length < 400 ? REGIME_NAMES[t.toPortfolio] : '',
        };
      });
    createSeriesMarkers(usi, markers);

    const stop = keepFitted(chart, el);
    return () => { stop(); chart.remove(); };
  }, [curve, trades]);

  return <div ref={ref} className="chart chart-usi" />;
}

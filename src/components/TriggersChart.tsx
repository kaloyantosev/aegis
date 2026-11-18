import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type LogicalRange,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import type { EquityPoint, Trade } from '../types';
import { REGIME_COLORS, REGIME_NAMES } from '../portfolios';
import { baseChartOptions, css, PRICE_AXIS_MIN_WIDTH, type ChartSyncHub } from './PerformanceChart';

export const USI_LEVELS = [
  { value: 187.947, label: 'Buy', id: 'buy' },
  { value: 227.81, label: 'Strong Buy', id: 'strong-buy' },
  { value: 323.14, label: 'Heavy Buy', id: 'heavy-buy' },
  { value: 894.52, label: 'Extreme Buy', id: 'extreme-buy' },
];

/** USI stress index (log scale) with tier thresholds and a marker at every rotation. */
export function TriggersChart({ curve, trades, syncHub }: { curve: EquityPoint[]; trades: Trade[]; syncHub?: ChartSyncHub }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || curve.length < 2) return;
    const base = baseChartOptions();
    const chart = createChart(el, {
      ...base,
      rightPriceScale: {
        borderVisible: false,
        autoScale: true,
        minimumWidth: PRICE_AXIS_MIN_WIDTH,
        mode: PriceScaleMode.Logarithmic,
      },
    });
    const usi = chart.addSeries(AreaSeries, {
      lineColor: '#d97706', topColor: 'rgba(217,119,6,0.28)', bottomColor: 'rgba(217,119,6,0.02)', lineWidth: 1,
      title: 'Stress', priceLineVisible: false,
      priceFormat: { type: 'custom', minMove: 1, formatter: (v: number) => v.toFixed(0) },
    });
    const usiData = curve.map(p => ({ time: p.date as Time, value: p.usi }));
    usi.setData(usiData);
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
          time: t.date as Time,
          position: defensive || neutral ? 'aboveBar' : 'belowBar',
          shape: defensive ? 'arrowDown' : neutral ? 'circle' : 'arrowUp',
          color: REGIME_COLORS[t.toPortfolio] ?? css('--muted'),
          text: curve.length < 400 ? REGIME_NAMES[t.toPortfolio] : '',
        };
      });
    createSeriesMarkers(usi, markers);

    const valueByTime = new Map<Time, number>();
    for (const pt of usiData) valueByTime.set(pt.time, pt.value);

    let didInitialFit = false;
    let userInteracted = false;
    let fitting = false;
    const fitInitial = () => {
      if (userInteracted || el.clientWidth <= 0) return;
      fitting = true;
      chart.timeScale().fitContent();
      didInitialFit = true;
      requestAnimationFrame(() => { fitting = false; });
    };

    const onRangeChange = (range: LogicalRange | null) => {
      if (!didInitialFit || fitting || !range) return;
      const span = range.to - range.from;
      if (span < curve.length - 3 || range.from > 1.5 || range.to < curve.length - 2) {
        userInteracted = true;
      }
      syncHub?.broadcastRange(chart, range);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const onCrosshairMove = (param: { time?: Time }) => {
      syncHub?.broadcastCrosshair(chart, param.time);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    const unregisterSync = syncHub?.register({
      chart,
      series: usi,
      valueByTime,
      applyExternalRange: (range) => {
        if (!didInitialFit) return;
        fitting = true;
        chart.timeScale().setVisibleLogicalRange(range);
        const span = range.to - range.from;
        userInteracted = span < curve.length - 3 || range.from > 1.5 || range.to < curve.length - 2;
        requestAnimationFrame(() => { fitting = false; });
      },
      applyExternalReset: () => {
        fitting = true;
        userInteracted = false;
        chart.priceScale('right', 0).applyOptions({ autoScale: true });
        chart.timeScale().fitContent();
        requestAnimationFrame(() => { fitting = false; });
      },
    });

    const ro = new ResizeObserver(() => requestAnimationFrame(fitInitial));
    ro.observe(el);
    requestAnimationFrame(fitInitial);

    return () => {
      ro.disconnect();
      unregisterSync?.();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      chart.remove();
    };
  }, [curve, trades, syncHub]);

  return <div ref={ref} className="chart chart-usi" />;
}

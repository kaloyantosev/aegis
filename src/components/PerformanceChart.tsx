import { useEffect, useRef } from 'react';
import { AreaSeries, ColorType, LineSeries, PriceScaleMode, createChart } from 'lightweight-charts';
import type { EquityPoint } from '../types';

export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const baseChartOptions = () => ({
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: css('--muted'),
    fontFamily: 'inherit',
    fontSize: 11,
    attributionLogo: false,
    panes: { separatorColor: css('--line') },
  },
  grid: { vertLines: { visible: false }, horzLines: { color: css('--line') } },
  timeScale: { borderVisible: false, minBarSpacing: 0.01 },
  crosshair: { mode: 0 },
  handleScroll: false,
  handleScale: false,
});

/** Fit the time axis once the auto-sized container has a width, and on resize. */
export function keepFitted(chart: { timeScale(): { fitContent(): void } }, el: HTMLElement) {
  const fit = () => chart.timeScale().fitContent();
  const ro = new ResizeObserver(() => requestAnimationFrame(fit));
  ro.observe(el);
  requestAnimationFrame(fit);
  return () => ro.disconnect();
}

const money = {
  type: 'custom' as const,
  minMove: 1,
  formatter: (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e5 ? `$${Math.round(v / 1000)}k` : `$${(v / 1000).toFixed(1)}k`),
};
const percent = { type: 'custom' as const, minMove: 0.1, formatter: (v: number) => `${v.toFixed(0)}%` };

/** Growth of $10,000 for the selected period, with drawdown from peak underneath. */
export function PerformanceChart({ curve, log }: { curve: EquityPoint[]; log: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || curve.length < 2) return;
    const chart = createChart(el, {
      ...baseChartOptions(),
      rightPriceScale: { borderVisible: false, mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal },
    });

    const strat = chart.addSeries(LineSeries, { color: css('--accent'), lineWidth: 2, title: 'Aegis', priceLineVisible: false, priceFormat: money });
    const bench = chart.addSeries(LineSeries, { color: css('--muted'), lineWidth: 1, title: 'SPY', priceLineVisible: false, priceFormat: money });
    strat.setData(curve.map(p => ({ time: p.date, value: p.strategy })));
    bench.setData(curve.map(p => ({ time: p.date, value: p.benchmark })));

    const dd = (key: 'strategy' | 'benchmark') => {
      let peak = 0;
      return curve.map(p => { peak = Math.max(peak, p[key]); return { time: p.date, value: (p[key] / peak - 1) * 100 }; });
    };
    chart.addSeries(AreaSeries, {
      lineColor: css('--down'), topColor: 'rgba(0,0,0,0)', bottomColor: css('--down-soft'), lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false, priceFormat: percent,
    }, 1).setData(dd('strategy'));
    chart.addSeries(LineSeries, {
      color: css('--muted'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceFormat: percent,
    }, 1).setData(dd('benchmark'));
    chart.panes()[1]?.setHeight(110);
    chart.priceScale('right', 1).applyOptions({ mode: PriceScaleMode.Normal }); // drawdowns are negative: never log

    const stop = keepFitted(chart, el);
    return () => { stop(); chart.remove(); };
  }, [curve, log]);

  return <div ref={ref} className="chart chart-perf" />;
}

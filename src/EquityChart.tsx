import { useEffect, useRef } from 'react';
import { ColorType, LineSeries, AreaSeries, PriceScaleMode, createChart } from 'lightweight-charts';
import type { EquityPoint } from './types';

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Growth of $10,000 (log scale) with drawdowns underneath. */
export function EquityChart({ curve }: { curve: EquityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !curve.length) return;

    const chart = createChart(el, {
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
      rightPriceScale: { borderVisible: false, mode: PriceScaleMode.Logarithmic },
      timeScale: { borderVisible: false, minBarSpacing: 0.01 },
      crosshair: { mode: 0 },
      handleScroll: false,
      handleScale: false,
    });

    const money = { type: 'custom' as const, minMove: 1, formatter: (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`) };
    const strat = chart.addSeries(LineSeries, { color: css('--accent'), lineWidth: 2, title: 'Strategy', priceLineVisible: false, lastValueVisible: true, priceFormat: money });
    const bench = chart.addSeries(LineSeries, { color: css('--muted'), lineWidth: 1, title: 'S&P 500', priceLineVisible: false, lastValueVisible: true, priceFormat: money });
    strat.setData(curve.map(p => ({ time: p.date, value: p.strategy })));
    bench.setData(curve.map(p => ({ time: p.date, value: p.benchmark })));

    const dd = (key: 'strategy' | 'benchmark') => {
      let peak = 0;
      return curve.map(p => { peak = Math.max(peak, p[key]); return { time: p.date, value: (p[key] / peak - 1) * 100 }; });
    };
    const ddStrat = chart.addSeries(AreaSeries, {
      lineColor: css('--down'), topColor: 'rgba(0,0,0,0)', bottomColor: css('--down-soft'), lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(0)}%` },
    }, 1);
    const ddBench = chart.addSeries(LineSeries, {
      color: css('--muted'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(0)}%` },
    }, 1);
    ddStrat.setData(dd('strategy'));
    ddBench.setData(dd('benchmark'));
    chart.panes()[1]?.setHeight(110);
    chart.priceScale('right', 1).applyOptions({ mode: PriceScaleMode.Normal });
    // autoSize measures the container asynchronously; fit once it has a size and on every resize.
    const fit = () => chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    ro.observe(el);
    requestAnimationFrame(fit);

    return () => { ro.disconnect(); chart.remove(); };
  }, [curve]);

  return <div ref={ref} className="chart" />;
}

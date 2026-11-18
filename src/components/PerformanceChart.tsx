import { useEffect, useRef, useState } from 'react';
import {
  AreaSeries,
  ColorType,
  LineSeries,
  PriceScaleMode,
  createChart,
  type IChartApi,
} from 'lightweight-charts';
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
  const chartRef = useRef<IChartApi | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || curve.length < 2) return;
    const base = baseChartOptions();
    const chart = createChart(el, {
      ...base,
      layout: {
        ...base.layout,
        panes: {
          enableResize: true,
          separatorColor: css('--line'),
          separatorHoverColor: css('--accent'),
        },
      },
      timeScale: {
        ...base.timeScale,
        rightOffset: 4,
      },
      rightPriceScale: {
        borderVisible: false,
        autoScale: true,
        mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
    });
    chartRef.current = chart;

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
    chart.priceScale('right', 1).applyOptions({ mode: PriceScaleMode.Normal, autoScale: true }); // drawdowns are negative: never log

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

    const unsubRange = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!didInitialFit || fitting || !range) return;
      const span = range.to - range.from;
      if (span < curve.length - 3 || range.from > 1.5 || range.to < curve.length - 2) {
        userInteracted = true;
        setIsZoomed(true);
      } else {
        setIsZoomed(false);
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(unsubRange);

    const ro = new ResizeObserver(() => requestAnimationFrame(fitInitial));
    ro.observe(el);
    requestAnimationFrame(fitInitial);
    setIsZoomed(false);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(unsubRange);
      chartRef.current = null;
      chart.remove();
    };
  }, [curve, log]);

  const zoomBy = (factor: number) => {
    const chart = chartRef.current;
    if (!chart || curve.length < 2) return;
    const ts = chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    const from = r?.from ?? 0;
    const to = r?.to ?? (curve.length - 1);
    const span = Math.max(10, to - from);
    const nextSpan = Math.min(Math.max(10, span * factor), curve.length + 8);
    const center = (from + to) / 2;
    let nextFrom = center - nextSpan / 2;
    let nextTo = center + nextSpan / 2;
    if (nextFrom < -2) {
      nextFrom = -2;
      nextTo = nextFrom + nextSpan;
    }
    if (nextTo > curve.length + 4) {
      nextTo = curve.length + 4;
      nextFrom = Math.max(-2, nextTo - nextSpan);
    }
    ts.setVisibleLogicalRange({ from: nextFrom, to: nextTo });
    setIsZoomed(nextSpan < curve.length - 2);
  };

  const resetView = () => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale('right', 0).applyOptions({ autoScale: true });
    chart.priceScale('right', 1).applyOptions({ autoScale: true });
    chart.timeScale().fitContent();
    setIsZoomed(false);
  };

  return (
    <div className="perf-chart-wrap">
      <div className="perf-controls small muted">
        <span>Scroll / pinch to zoom · drag to pan · drag price/time axes to expand/tighten · double-click axis to reset</span>
        <div className="perf-btn-group">
          <button type="button" className="btn btn-xs" onClick={() => zoomBy(0.65)} title="Zoom in">+</button>
          <button type="button" className="btn btn-xs" onClick={() => zoomBy(1.5)} title="Zoom out">−</button>
          <button type="button" className={`btn btn-xs ${isZoomed ? 'btn-primary' : ''}`} onClick={resetView} title="Reset chart zoom and axis scale">Reset view</button>
        </div>
      </div>
      <div ref={ref} className="chart chart-perf" />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  ColorType,
  LineSeries,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type SeriesType,
  type Time,
} from 'lightweight-charts';
import type { EquityPoint } from '../types';

export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const PRICE_AXIS_MIN_WIDTH = 86;

export const baseChartOptions = () => ({
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: css('--muted'),
    fontFamily: 'inherit',
    fontSize: 14,
    attributionLogo: false,
  },
  grid: { vertLines: { visible: false }, horzLines: { color: css('--line') } },
  timeScale: { borderVisible: false, minBarSpacing: 0.01, rightOffset: 4 },
  crosshair: { mode: 0 },
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

export interface SyncParticipant {
  chart: IChartApi;
  series: ISeriesApi<SeriesType, Time>;
  valueByTime: Map<Time, number>;
  applyExternalRange: (range: LogicalRange) => void;
  applyExternalReset: () => void;
}

/** Coordinates time-axis zoom/pan, reset, and crosshair position across multiple charts. */
export class ChartSyncHub {
  private participants = new Set<SyncParticipant>();
  private syncingRange = false;
  private syncingCrosshair = false;

  register(p: SyncParticipant) {
    this.participants.add(p);
    return () => {
      this.participants.delete(p);
    };
  }

  broadcastRange(sourceChart: IChartApi, range: LogicalRange) {
    if (this.syncingRange) return;
    this.syncingRange = true;
    try {
      for (const p of this.participants) {
        if (p.chart !== sourceChart) {
          p.applyExternalRange(range);
        }
      }
    } finally {
      this.syncingRange = false;
    }
  }

  broadcastReset(sourceChart: IChartApi) {
    if (this.syncingRange) return;
    this.syncingRange = true;
    try {
      for (const p of this.participants) {
        if (p.chart !== sourceChart) {
          p.applyExternalReset();
        }
      }
    } finally {
      this.syncingRange = false;
    }
  }

  broadcastCrosshair(sourceChart: IChartApi, time: Time | undefined) {
    if (this.syncingCrosshair) return;
    this.syncingCrosshair = true;
    try {
      for (const p of this.participants) {
        if (p.chart === sourceChart) continue;
        if (time !== undefined) {
          const val = p.valueByTime.get(time);
          if (val !== undefined) {
            p.chart.setCrosshairPosition(val, time, p.series);
            continue;
          }
        }
        p.chart.clearCrosshairPosition();
      }
    } finally {
      this.syncingCrosshair = false;
    }
  }
}

const money = {
  type: 'custom' as const,
  minMove: 1,
  formatter: (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e5 ? `$${Math.round(v / 1000)}k` : `$${(v / 1000).toFixed(1)}k`),
};

/** Growth of $10,000 for the selected period. */
export function PerformanceChart({ curve, log, syncHub }: { curve: EquityPoint[]; log: boolean; syncHub?: ChartSyncHub }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

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
        mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
    });
    chartRef.current = chart;

    const strat = chart.addSeries(LineSeries, { color: css('--accent'), lineWidth: 2, title: 'Aegis', priceLineVisible: false, priceFormat: money });
    const bench = chart.addSeries(LineSeries, { color: css('--muted'), lineWidth: 1, title: 'SPY', priceLineVisible: false, priceFormat: money });
    const stratData = curve.map(p => ({ time: p.date as Time, value: p.strategy }));
    strat.setData(stratData);
    bench.setData(curve.map(p => ({ time: p.date as Time, value: p.benchmark })));

    const valueByTime = new Map<Time, number>();
    for (const pt of stratData) valueByTime.set(pt.time, pt.value);

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
      const zoomed = span < curve.length - 3 || range.from > 1.5 || range.to < curve.length - 2;
      if (zoomed) {
        userInteracted = true;
        setIsZoomed(true);
      } else {
        setIsZoomed(false);
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
      series: strat,
      valueByTime,
      applyExternalRange: (range) => {
        if (!didInitialFit) return;
        fitting = true;
        chart.timeScale().setVisibleLogicalRange(range);
        const span = range.to - range.from;
        const zoomed = span < curve.length - 3 || range.from > 1.5 || range.to < curve.length - 2;
        userInteracted = zoomed;
        setIsZoomed(zoomed);
        requestAnimationFrame(() => { fitting = false; });
      },
      applyExternalReset: () => {
        fitting = true;
        userInteracted = false;
        chart.priceScale('right', 0).applyOptions({ autoScale: true });
        chart.timeScale().fitContent();
        setIsZoomed(false);
        requestAnimationFrame(() => { fitting = false; });
      },
    });

    const ro = new ResizeObserver(() => requestAnimationFrame(fitInitial));
    ro.observe(el);
    requestAnimationFrame(fitInitial);
    setIsZoomed(false);

    return () => {
      ro.disconnect();
      unregisterSync?.();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      chartRef.current = null;
      chart.remove();
    };
  }, [curve, log, syncHub]);

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
    const nextRange = { from: nextFrom, to: nextTo };
    ts.setVisibleLogicalRange(nextRange);
    setIsZoomed(nextSpan < curve.length - 2);
  };

  const resetView = () => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale('right', 0).applyOptions({ autoScale: true });
    chart.timeScale().fitContent();
    setIsZoomed(false);
    syncHub?.broadcastReset(chart);
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

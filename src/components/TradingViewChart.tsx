import React, { useEffect, useRef } from 'react';
import { 
  createChart, 
  ColorType, 
  LineStyle, 
  LineSeries,
  AreaSeries,
  createSeriesMarkers
} from 'lightweight-charts';
import type { 
  IChartApi, 
  SeriesMarker 
} from 'lightweight-charts';
import type { EquityPoint, PricePoint, Trade, Rule } from '../types';

interface TradingViewChartProps {
  equityCurve: EquityPoint[];
  spyData: PricePoint[];
  trades: Trade[];
  rules: Rule[];
  benchmarkTicker: string;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  equityCurve,
  spyData,
  trades,
  rules,
  benchmarkTicker
}) => {
  const chart1ContainerRef = useRef<HTMLDivElement>(null);
  const chart2ContainerRef = useRef<HTMLDivElement>(null);
  
  const chart1Ref = useRef<IChartApi | null>(null);
  const chart2Ref = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chart1ContainerRef.current || !chart2ContainerRef.current || spyData.length === 0 || equityCurve.length === 0) {
      return;
    }

    // Clear previous charts
    chart1ContainerRef.current.innerHTML = '';
    chart2ContainerRef.current.innerHTML = '';

    const commonOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#131a2e' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      crosshair: {
        mode: 1, // Magnet mode
        vertLine: {
          color: '#6366f1',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#312e81',
        },
        horzLine: {
          color: '#6366f1',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#312e81',
        },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        rightOffset: 12,
        barSpacing: 6,
        minBarSpacing: 0.5,
      },
    };

    // --- CHART 1: Benchmark Ticker & Indicators ---
    const chart1 = createChart(chart1ContainerRef.current, {
      ...commonOptions,
      height: 320,
      localization: {
        priceFormatter: () => '',
      },
    });
    chart1Ref.current = chart1;

    // Add USI (Yearly Lows) Area Series
    const usiSeries = chart1.addSeries(AreaSeries, {
      topColor: 'rgba(234, 179, 8, 0.4)', // Gold glow
      bottomColor: 'rgba(234, 179, 8, 0.02)',
      lineColor: '#eab308',
      lineWidth: 2,
      title: 'Index',
    });

    const usiData = equityCurve.map(pt => ({
      time: pt.date,
      value: pt.usiValue,
    }));
    usiSeries.setData(usiData);

    // Draw horizontal lines on USI chart (Buy limits/thresholds)
    usiSeries.createPriceLine({
      price: 187.947,
      color: '#eab308', // Yellow
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: 'Buy Zone',
    });
    usiSeries.createPriceLine({
      price: 323.140,
      color: '#34d399', // Light green
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: 'Strong Buy Zone',
    });
    usiSeries.createPriceLine({
      price: 533.959,
      color: '#059669', // Emerald
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: 'Heavy Buy Zone',
    });
    usiSeries.createPriceLine({
      price: 894.522,
      color: '#ef4444', // Red
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: 'Extreme Buy Zone',
    });

    // Set up trade entry/exit markers on USI series
    const markers: SeriesMarker<any>[] = [];
    trades.forEach(trade => {
      const lowerName = trade.toPortfolio.name.toLowerCase();
      const isSell = lowerName.includes('sell');
      const isBuy = lowerName.includes('buy');

      let shape: 'arrowUp' | 'arrowDown' | 'circle' = 'circle';
      let color = '#f59e0b'; // Neutral / neutral default
      let position: 'aboveBar' | 'belowBar' = 'aboveBar';

      if (isBuy) {
        shape = 'arrowUp';
        color = '#10b981'; // Green
        position = 'belowBar';
      } else if (isSell) {
        shape = 'arrowDown';
        color = '#f43f5e'; // Red
        position = 'aboveBar';
      }

      markers.push({
        time: trade.date,
        position,
        color,
        shape,
        text: trade.toPortfolio.name,
      });
    });

    createSeriesMarkers(usiSeries, markers);

    // --- CHART 2: Strategy Equity Curve ---
    const chart2 = createChart(chart2ContainerRef.current, {
      ...commonOptions,
      height: 220,
    });
    chart2Ref.current = chart2;

    // Add Strategy Equity Area Series
    const strategySeries = chart2.addSeries(AreaSeries, {
      topColor: 'rgba(99, 102, 241, 0.4)',
      bottomColor: 'rgba(99, 102, 241, 0.02)',
      lineColor: '#6366f1',
      lineWidth: 2,
      title: 'Aegis',
    });

    const strategyData = equityCurve.map(pt => ({
      time: pt.date,
      value: pt.strategyValue,
    }));
    strategySeries.setData(strategyData);

    // Add Benchmark Area Series
    const benchmarkSeries = chart2.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 2,
      title: `${benchmarkTicker} Buy & Hold`,
      priceLineVisible: false,
    });

    const benchmarkDataFormatted = equityCurve.map(pt => ({
      time: pt.date,
      value: pt.benchmarkValue,
    }));
    benchmarkSeries.setData(benchmarkDataFormatted);

    // Synchronize scroll / time scales
    const timeScale1 = chart1.timeScale();
    const timeScale2 = chart2.timeScale();

    const scrollHandler1 = (range: any) => {
      if (range) timeScale2.setVisibleRange(range);
    };
    const scrollHandler2 = (range: any) => {
      if (range) timeScale1.setVisibleRange(range);
    };

    timeScale1.subscribeVisibleTimeRangeChange(scrollHandler1);
    timeScale2.subscribeVisibleTimeRangeChange(scrollHandler2);

    // Synchronize crosshair move
    chart1.subscribeCrosshairMove((param) => {
      if (param.time) {
        chart2.setCrosshairPosition(0, param.time, strategySeries);
      } else {
        chart2.clearCrosshairPosition();
      }
    });

    chart2.subscribeCrosshairMove((param) => {
      if (param.time) {
        chart1.setCrosshairPosition(0, param.time, usiSeries);
      } else {
        chart1.clearCrosshairPosition();
      }
    });

    // Resize Handler
    const handleResize = () => {
      if (chart1ContainerRef.current && chart2ContainerRef.current) {
        chart1.resize(chart1ContainerRef.current.clientWidth, 320);
        chart2.resize(chart2ContainerRef.current.clientWidth, 220);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chart1ContainerRef.current);
    resizeObserver.observe(chart2ContainerRef.current);

    // Fit content
    timeScale1.fitContent();
    timeScale2.fitContent();

    return () => {
      resizeObserver.disconnect();
      timeScale1.unsubscribeVisibleTimeRangeChange(scrollHandler1);
      timeScale2.unsubscribeVisibleTimeRangeChange(scrollHandler2);
      
      chart1.remove();
      chart2.remove();
    };
  }, [equityCurve, spyData, trades, rules, benchmarkTicker]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Performance Chart: Aegis Compounding Value vs. Buy & Hold Benchmark
        </h3>
        <div ref={chart2ContainerRef} style={{ width: '100%', position: 'relative' }} />
      </div>

      <div className="glass-panel" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
              Rotational Triggers
            </h3>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                Rotate to Buy
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }}></span>
                Rotate to Strong Buy
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
                Rotate to Heavy Buy
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                Rotate to Extreme Buy
              </span>
            </div>
        </div>
        <div ref={chart1ContainerRef} style={{ width: '100%', position: 'relative' }} />
      </div>
    </div>
  );
};

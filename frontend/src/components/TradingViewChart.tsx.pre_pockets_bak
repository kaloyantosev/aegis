"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries } from "lightweight-charts";

interface Level {
  price: number;
  strength: number;
  volume_concentration?: number;
  source?: string;
  dte?: number | null;
  horizon?: string;
  tests?: number;
}

interface TradingViewChartProps {
  ticker: string;
  spot: number;
  maxPain: number;
  supports: Level[];
  resistances: Level[];
  timeframe: string;
}

export default function TradingViewChart({
  ticker,
  spot,
  maxPain,
  supports,
  resistances,
  timeframe,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [weeklyGaps, setWeeklyGaps] = useState<any[]>([]);
  const [svgRects, setSvgRects] = useState<any[]>([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create TradingView Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#a3a3a3",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: 0, // CrosshairMode.Normal (moves freely horizontally and vertically, doesn't snap to candles)
      },
      width: chartContainerRef.current.clientWidth,
      height: 420,
      timeScale: {
        borderColor: "#262626",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#262626",
      },
    });

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#D4A300",
      borderUpColor: "#D4A300",
      wickUpColor: "#D4A300",
      downColor: "#F28C28",
      borderDownColor: "#F28C28",
      wickDownColor: "#F28C28",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const generateFallbackCandles = (spotPrice: number, tf: string) => {
      const count = 120;
      const now = Math.floor(Date.now() / 1000);
      let step = 86400;
      if (tf === "5 min") step = 300;
      else if (tf === "15 min") step = 900;
      else if (tf === "1h") step = 3600;
      else if (tf === "4h") step = 14400;
      else if (tf === "1w") step = 604800;
      else if (tf === "1m") step = 2592000;
      else if (tf === "3m") step = 7776000;

      const base = spotPrice > 0 ? spotPrice : 100.0;
      const list: any[] = [];
      let current = base * 0.95;

      for (let i = count; i >= 0; i--) {
        const time = now - i * step;
        const delta = (Math.sin(i * 0.2) * 0.008 + (Math.random() - 0.49) * 0.015) * current;
        const open = current;
        const close = Math.max(1.0, current + delta);
        const high = Math.max(open, close) + Math.abs(delta) * 0.4;
        const low = Math.min(open, close) - Math.abs(delta) * 0.4;
        current = close;
        list.push({
          time: time as any,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
        });
      }
      return list;
    };

    const loadData = async () => {
      let data: any[] = [];
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBaseUrl}/api/history/${ticker}?timeframe=${encodeURIComponent(timeframe)}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.error("Failed to load chart history from API, generating fallback candles", err);
      }

      if (!Array.isArray(data) || data.length === 0) {
        data = generateFallbackCandles(spot, timeframe);
      }

      candleSeries.setData(data);

      if (data.length > 0) {
        // Calculate weekly imbalance gaps
        const gaps: any[] = [];
        
        const getBarDate = (barTime: any) => {
          if (typeof barTime === "number") {
            return new Date(barTime * 1000);
          }
          return new Date(barTime);
        };

        const getMondayStr = (barTime: any) => {
          const date = getBarDate(barTime);
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(date.setDate(diff));
          return monday.toISOString().split('T')[0];
        };

        for (let i = 1; i < data.length; i++) {
          const prevBar = data[i - 1];
          const currBar = data[i];
          
          if (getMondayStr(currBar.time) !== getMondayStr(prevBar.time)) {
            const prevClose = prevBar.close;
            const currOpen = currBar.open;
            
            if (prevClose !== currOpen) {
              const wl = Math.min(prevClose, currOpen);
              const wh = Math.max(prevClose, currOpen);
              
              let endBar = currBar;
              let j = i;
              const currMonday = getMondayStr(currBar.time);
              while (j < data.length && getMondayStr(data[j].time) === currMonday) {
                endBar = data[j];
                j++;
              }
              
              gaps.push({
                startTime: currBar.time,
                endTime: endBar.time,
                bottom: wl,
                top: wh,
              });
            }
          }
        }

        const last6Gaps = gaps.slice(-6);
        setWeeklyGaps(last6Gaps);

        let barsToShow = 42;
        if (timeframe === "4h") barsToShow = 85;
        else if (timeframe === "1h") barsToShow = 290;
        else if (timeframe === "15 min") barsToShow = 750;
        else if (timeframe === "5 min") barsToShow = 2250;
        else if (timeframe === "1w") barsToShow = 52;
        else if (timeframe === "1m") barsToShow = 36;
        else if (timeframe === "3m") barsToShow = 24;

        chart.timeScale().setVisibleLogicalRange({
          from: data.length - Math.min(barsToShow, data.length),
          to: data.length - 1,
        });
      } else {
        chart.timeScale().fitContent();
      }
    };

    loadData();

    // Responsive chart resizing
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [ticker, timeframe]);

  // Update horizontal lines when options positioning or support/resistance zones change
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !chart || !chartContainerRef.current) return;

    // Clear previous lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeries.removePriceLine(line);
      } catch (e) {
        // ignore
      }
    });
    priceLinesRef.current = [];

    // 1. Plot Max Pain Level (1px Solid Orchid Purple: #ba68c8)
    if (maxPain > 0) {
      const maxPainTitle = isHovered 
        ? `Max Pain: $${maxPain.toFixed(2)}`
        : "Max Pain";
      const maxPainLine = candleSeries.createPriceLine({
        price: maxPain,
        color: "#ba68c8",
        lineWidth: 1,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: maxPainTitle,
      });
      priceLinesRef.current.push(maxPainLine);
    }

    // Determine major vs minor support levels based on absorption strength relative to peak support absorption
    const maxSupportAbs = supports.length > 0 ? Math.max(...supports.map(s => s.strength)) : 1.0;
    
    // 3. Plot Support Levels (classified into Minor, Intermediate, and Major)
    supports.forEach((sup) => {
      let color = "rgba(16, 185, 129, 0.5)"; // Minor Support: Light Green
      let lineWidth: any = 1;
      let lineStyle: any = 1; // Dotted
      let title = "Minor Sup";

      const relStrength = sup.strength / maxSupportAbs;
      if (relStrength >= 0.75) {
        color = "rgba(4, 120, 87, 0.85)"; // Major Support: Rich Dark Green
        lineWidth = 3;
        lineStyle = 0; // Solid
        title = "Major Sup";
      } else if (relStrength >= 0.4) {
        color = "rgba(5, 150, 105, 0.85)"; // Intermediate Support: Medium Dark Green
        lineWidth = 2;
        lineStyle = 0; // Solid
        title = "Int Sup";
      }

      const displayTitle = isHovered
        ? (sup.source === "options"
            ? `${title}: $${sup.price.toFixed(2)} (Absorption: ${Math.round(sup.strength)} — Options ${sup.dte}d DTE)`
            : `${title}: $${sup.price.toFixed(2)} (Tests: ${sup.tests || 0} — Technical)`)
        : title;

      const supportLine = candleSeries.createPriceLine({
        price: sup.price,
        color: color,
        lineWidth: lineWidth,
        lineStyle: lineStyle,
        axisLabelVisible: true,
        title: displayTitle,
      });
      priceLinesRef.current.push(supportLine);
    });

    // Determine major vs minor resistance levels based on absorption strength relative to peak resistance absorption
    const maxResistanceAbs = resistances.length > 0 ? Math.max(...resistances.map(r => r.strength)) : 1.0;

    // 4. Plot Resistance Levels (classified into Minor, Intermediate, and Major)
    resistances.forEach((res) => {
      let color = "rgba(239, 68, 68, 0.5)"; // Minor Resistance: Light Red
      let lineWidth: any = 1;
      let lineStyle: any = 1; // Dotted
      let title = "Minor Res";

      const relStrength = res.strength / maxResistanceAbs;
      if (relStrength >= 0.75) {
        color = "rgba(255, 51, 51, 0.55)"; // Major Resistance: Light Red
        lineWidth = 3;
        lineStyle = 0; // Solid
        title = "Major Res";
      } else if (relStrength >= 0.4) {
        color = "rgba(211, 47, 47, 1.0)"; // Intermediate Resistance: Medium Red
        lineWidth = 2;
        lineStyle = 0; // Solid
        title = "Int Res";
      }

      const displayTitle = isHovered
        ? (res.source === "options"
            ? `${title}: $${res.price.toFixed(2)} (Absorption: ${Math.round(res.strength)} — Options ${res.dte}d DTE)`
            : `${title}: $${res.price.toFixed(2)} (Tests: ${res.tests || 0} — Technical)`)
        : title;

      const resistanceLine = candleSeries.createPriceLine({
        price: res.price,
        color: color,
        lineWidth: lineWidth,
        lineStyle: lineStyle,
        axisLabelVisible: true,
        title: displayTitle,
      });
      priceLinesRef.current.push(resistanceLine);
    });

    const onCrosshairMove = (param: any) => {
      if (!param.point || !chartRef.current) {
        setIsHovered(false);
        return;
      }

      const mouseY = param.point.y;
      const mouseX = param.point.x;

      const containerWidth = chartContainerRef.current?.clientWidth || 800;
      
      // Calculate precise horizontal bounds of the right-aligned short labels
      const rightEdge = containerWidth - 60;
      const leftEdge = containerWidth - 140;

      // Only check hover when mouse is horizontally within the label boxes
      if (mouseX < leftEdge || mouseX > rightEdge) {
        setIsHovered(false);
        return;
      }

      const allPrices: number[] = [];
      if (maxPain > 0) allPrices.push(maxPain);
      supports.forEach(s => allPrices.push(s.price));
      resistances.forEach(r => allPrices.push(r.price));

      let hoverActive = false;
      const minDistance = 11; // 11px Y-tolerance to match box height precisely

      for (const price of allPrices) {
        const levelY = candleSeries.priceToCoordinate(price);
        if (levelY === null) continue;

        const distance = Math.abs(mouseY - levelY);
        if (distance < minDistance) {
          hoverActive = true;
          console.log(`[Hover Detected] Price: ${price}, distance: ${distance.toFixed(1)}px, mouseX: ${mouseX.toFixed(1)}px`);
          break;
        }
      }

      setIsHovered(hoverActive);
    };

    const updateSvgRects = () => {
      if (!chart || !candleSeries || weeklyGaps.length === 0) {
        setSvgRects([]);
        return;
      }

      const rects = weeklyGaps.map((gap, idx) => {
        const x1 = chart.timeScale().timeToCoordinate(gap.startTime);
        const x2 = chart.timeScale().timeToCoordinate(gap.endTime);
        const y1 = candleSeries.priceToCoordinate(gap.top);
        const y2 = candleSeries.priceToCoordinate(gap.bottom);

        if (x1 === null || x2 === null || y1 === null || y2 === null) {
          return null;
        }

        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.max(Math.abs(x2 - x1), 15); // Ensure a minimum visible width
        const height = Math.abs(y2 - y1);

        return {
          id: idx,
          x,
          y,
          width,
          height,
        };
      }).filter(Boolean) as any[];

      setSvgRects(rects);
    };

    // Run on initial load/change
    setTimeout(updateSvgRects, 50);

    const rangeSubscription = () => {
      updateSvgRects();
    };

    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeSubscription);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeSubscription);
    };

  }, [maxPain, supports, resistances, isHovered, weeklyGaps]);

  return (
    <div className="w-full bg-neutral-950 rounded-lg p-2 border border-neutral-900 overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 flex gap-2 items-center bg-neutral-900/60 backdrop-blur px-2.5 py-1 rounded border border-neutral-800/40">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-xs font-mono font-semibold tracking-wider text-neutral-300">LIVE FEED</span>
      </div>
      <div ref={chartContainerRef} className="w-full relative">
        {/* SVG Overlay for Weekly Imbalance Zones */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {svgRects.map((rect) => (
            <rect
              key={rect.id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="rgba(6, 182, 212, 0.25)"
              stroke="rgba(6, 182, 212, 0.4)"
              strokeWidth={1}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

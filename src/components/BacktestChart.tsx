"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineStyle,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import BacktestDomWidget, { DomRow, SinclairStats } from "./BacktestDomWidget";

interface PriceLevel {
  price: number;
  title: string;
  color: string;
}

interface BacktestChartProps {
  ticker: "SPY" | "QQQ";
  exchangeName: "AMEX" | "NASDAQ";
  chartTitle: string;
  selectedDate: string;
  onDateChange?: (date: string) => void;
  availableDates?: string[];
  defaultTimeframe?: string;
}

const TIMEFRAMES = [
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
];

export default function BacktestChart({
  ticker,
  exchangeName,
  chartTitle,
  selectedDate,
  onDateChange,
  availableDates = [],
  defaultTimeframe = "15m",
}: BacktestChartProps) {
  const [timeframe, setTimeframe] = useState<string>(defaultTimeframe);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [sinclair, setSinclair] = useState<SinclairStats | undefined>(undefined);
  const [domData, setDomData] = useState<{ "0dte": DomRow[]; weekly: DomRow[] } | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [candleCount, setCandleCount] = useState<number>(0);
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [levelsData, setLevelsData] = useState<PriceLevel[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  // Function to apply candles and levels to the active chart series
  const renderChartData = useCallback((candles: any[], levels: PriceLevel[]) => {
    if (!seriesRef.current || !chartRef.current || candles.length === 0) return;

    try {
      // 1. Set Candlestick data
      seriesRef.current.setData(candles as any);

      // 2. Clear previous price lines
      priceLinesRef.current.forEach((pl) => {
        try {
          seriesRef.current?.removePriceLine(pl);
        } catch (e) {}
      });
      priceLinesRef.current = [];

      // 3. Draw Options Model Levels computed at 09:40 ET
      if (Array.isArray(levels)) {
        levels.forEach((lvl: PriceLevel) => {
          if (lvl.price > 0 && seriesRef.current) {
            const pl = seriesRef.current.createPriceLine({
              price: lvl.price,
              color: lvl.color,
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: lvl.title,
            });
            priceLinesRef.current.push(pl);
          }
        });
      }

      // 4. Fit all candles into view automatically
      chartRef.current.timeScale().fitContent();
    } catch (err) {
      console.error("Error setting chart data:", err);
    }
  }, []);

  // Fetch backtest data whenever ticker, timeframe, or selectedDate changes
  const fetchBacktestData = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/backtest?ticker=${ticker}&timeframe=${timeframe}&date=${selectedDate}`
      );
      if (!res.ok) throw new Error("Failed to load backtest data");
      const data = await res.json();

      setSpotPrice(data.spot || 0);
      setSinclair(data.sinclair);
      setDomData(data.dom);

      const loadedCandles = Array.isArray(data.candles) ? data.candles : [];
      const loadedLevels = Array.isArray(data.levels) ? data.levels : [];

      setCandlesData(loadedCandles);
      setLevelsData(loadedLevels);
      setCandleCount(loadedCandles.length);

      // Render immediately if series is already initialized
      if (seriesRef.current && loadedCandles.length > 0) {
        renderChartData(loadedCandles, loadedLevels);
      }
    } catch (err) {
      console.error(`Error loading backtest data for ${ticker} on ${selectedDate}:`, err);
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe, selectedDate, renderChartData]);

  // 1. Initialize Lightweight Chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(255, 255, 255, 0.2)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "rgba(255, 255, 255, 0.2)", width: 1, style: LineStyle.Dashed },
      },
      localization: {
        locale: "bg-BG",
        dateFormat: "dd MMM yyyy",
        timeFormatter: (time: any) => {
          let date: Date;
          if (typeof time === "number") {
            date = new Date(time > 1e11 ? time : time * 1000);
          } else if (time && typeof time === "object" && "year" in time) {
            date = new Date(Date.UTC(time.year, time.month - 1, time.day));
          } else {
            date = new Date();
          }
          return new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Sofia",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(date);
        },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: any, tickMarkType: number) => {
          let date: Date;
          if (typeof time === "number") {
            date = new Date(time > 1e11 ? time : time * 1000);
          } else if (time && typeof time === "object" && "year" in time) {
            date = new Date(Date.UTC(time.year, time.month - 1, time.day));
          } else {
            date = new Date();
          }

          if (tickMarkType === 0) {
            return new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Sofia",
              year: "numeric",
            }).format(date);
          }
          if (tickMarkType === 1) {
            return new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Sofia",
              month: "short",
            }).format(date);
          }
          if (tickMarkType === 2) {
            return new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Sofia",
              day: "numeric",
              month: "short",
            }).format(date);
          }
          return new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Sofia",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(date);
        },
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        visible: true,
        autoScale: true,
      },
      autoSize: true,
    });

    // Candlestick Series:
    // Up candles: Warm golden yellow (#fbc02d)
    // Down candles: Rich amber orange (#f57c00)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#fbc02d",
      downColor: "#f57c00",
      borderUpColor: "#fbc02d",
      borderDownColor: "#f57c00",
      wickUpColor: "#fbc02d",
      wickDownColor: "#f57c00",
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    // ResizeObserver ensures chart canvas cleanly resizes with container
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
        chart.timeScale().fitContent();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 2. Fetch data whenever ticker, timeframe, or selectedDate changes
  useEffect(() => {
    fetchBacktestData();
  }, [fetchBacktestData]);

  // 3. Whenever candlesData or seriesRef changes, ensure data is rendered
  useEffect(() => {
    if (seriesRef.current && candlesData.length > 0) {
      renderChartData(candlesData, levelsData);
    }
  }, [candlesData, levelsData, renderChartData]);

  // Previous and Next day navigation
  const currentIndex = availableDates.indexOf(selectedDate);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < availableDates.length - 1 && currentIndex !== -1;

  const goToPrev = () => {
    if (hasPrev && onDateChange) {
      onDateChange(availableDates[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext && onDateChange) {
      onDateChange(availableDates[currentIndex + 1]);
    }
  };

  return (
    <div className="relative w-full h-[520px] bg-black border border-[#1e293b] rounded-lg overflow-hidden flex flex-col shadow-2xl">
      {/* Top Header Bar */}
      <div className="h-10 px-3 bg-[#0a0e1a] border-b border-[#1e293b] flex items-center justify-between text-xs select-none flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          {/* Ticker & Exchange Badges */}
          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-wide text-white">{ticker}</span>
            <span className="text-[10px] text-neutral-400 font-mono bg-[#0f172a] px-1.5 py-0.5 rounded border border-[#1e293b]">
              {exchangeName}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#1e293b]" />

          {/* Spot price at 09:40 */}
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-neutral-400 text-[10px]">09:40 SPOT:</span>
            <span className="text-sm font-black text-[#38bdf8]">${spotPrice.toFixed(2)}</span>
          </div>

          <div className="h-4 w-[1px] bg-[#1e293b]" />

          {/* Date Selector and Prev/Next Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={goToPrev}
              disabled={!hasPrev}
              title="Previous Trading Day"
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                hasPrev
                  ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                  : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
              }`}
            >
              ← Prev
            </button>

            <select
              value={selectedDate}
              onChange={(e) => onDateChange && onDateChange(e.target.value)}
              className="bg-[#0f172a] text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded border border-[#334155] focus:outline-none focus:border-[#38bdf8]"
            >
              {availableDates.map((d) => (
                <option key={d} value={d} className="bg-[#0b0f19] text-white">
                  {d}
                </option>
              ))}
            </select>

            <button
              onClick={goToNext}
              disabled={!hasNext}
              title="Next Trading Day"
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                hasNext
                  ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                  : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
              }`}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Right side: Session badge & Timeframes */}
        <div className="flex items-center gap-3">
          {/* Bulgarian Time Badge */}
          <span
            className="px-1.5 py-0.5 bg-[#0b0f19] border border-[#334155] rounded text-neutral-300 text-[10px] font-bold"
            title="Chart timescale displayed in Bulgarian Local Time (Europe/Sofia)"
          >
            🇧🇬 SOFIA (16:30 - 23:00)
          </span>

          {/* RTH Session Tag */}
          <span className="px-2 py-0.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 rounded text-[9.5px] font-mono font-bold">
            RTH ONLY ({candleCount} bars)
          </span>

          {/* Timeframe Selectors (5m, 15m, 1h) */}
          <div className="flex items-center gap-1 bg-[#0b0f19] p-0.5 rounded border border-[#1e293b]">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  timeframe === tf.value
                    ? "bg-[#f59e0b] text-black shadow-sm font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Body: 2-Column Side-by-Side Flex Layout */}
      <div className="relative flex-1 w-full flex flex-row min-h-0 bg-black overflow-hidden">
        {/* Left Column: Dedicated Fixed Space for Options DOM & Sinclair Stats */}
        <div className="w-[316px] min-w-[316px] max-w-[316px] h-full bg-[#080a14] border-r border-[#1e293b] p-2 flex flex-col z-10 overflow-hidden">
          <BacktestDomWidget
            ticker={ticker}
            selectedDate={selectedDate}
            sinclair={sinclair}
            domData={domData}
            spot={spotPrice}
          />
        </div>

        {/* Right Column: Candlestick Chart Canvas */}
        <div className="relative flex-1 h-full min-w-0 bg-black">
          <div ref={containerRef} className="w-full h-full" />

          {/* Loading Spinner */}
          {loading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-10 font-mono text-xs text-neutral-400">
              <span className="animate-pulse">Loading {ticker} backtest candles for {selectedDate}...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

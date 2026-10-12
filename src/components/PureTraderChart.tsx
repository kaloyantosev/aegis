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
import OptionsDomWidget, { DomRow, SinclairStats } from "./OptionsDomWidget";

interface PriceLevel {
  price: number;
  title: string;
  color: string;
}

interface PureTraderChartProps {
  ticker: "SPY" | "QQQ";
  exchangeName: "AMEX" | "NASDAQ";
  chartTitle: string;
  defaultTimeframe?: string;
}

const TIMEFRAMES = [
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "Daily", value: "1D" },
];

// Lightweight native browser decoder for real-time exchange quote ticks
function decodeYahooQuote(base64Str: string): { id: string; price: number; changePct: number } | null {
  try {
    const binaryString = atob(base64Str);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    let pos = 0;
    let id = "";
    let price = 0;
    let changePct = 0;

    while (pos < bytes.length) {
      const byte = bytes[pos++];
      const field = byte >> 3;
      const wire = byte & 0x07;

      if (wire === 0) {
        let val = 0;
        let shift = 0;
        while (pos < bytes.length) {
          const b = bytes[pos++];
          val |= (b & 0x7f) << shift;
          if (!(b & 0x80)) break;
          shift += 7;
        }
      } else if (wire === 5) {
        if (pos + 4 <= bytes.length) {
          const f = view.getFloat32(pos, true);
          pos += 4;
          if (field === 2) price = f;
          else if (field === 8) changePct = f;
        }
      } else if (wire === 2) {
        let l = 0;
        let shift = 0;
        while (pos < bytes.length) {
          const b = bytes[pos++];
          l |= (b & 0x7f) << shift;
          if (!(b & 0x80)) break;
          shift += 7;
        }
        if (pos + l <= bytes.length) {
          let str = "";
          for (let i = 0; i < l; i++) {
            str += String.fromCharCode(bytes[pos + i]);
          }
          pos += l;
          if (field === 1) id = str;
        }
      } else if (wire === 1) {
        pos += 8;
      } else {
        break;
      }
    }
    return { id, price: Number(price.toFixed(2)), changePct: Number(changePct.toFixed(2)) };
  } catch (e) {
    return null;
  }
}

export default function PureTraderChart({
  ticker,
  exchangeName,
  chartTitle,
  defaultTimeframe = "15m",
}: PureTraderChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const lastCandleRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [sinclair, setSinclair] = useState<SinclairStats | undefined>();
  const [domData, setDomData] = useState<{ "0dte": DomRow[]; weekly: DomRow[] } | undefined>();
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [candleCountdown, setCandleCountdown] = useState<string>("--:--");
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);

  // Live Candle Close Countdown Timer (updates every second)
  useEffect(() => {
    const calcCountdown = () => {
      const now = new Date();
      const nowSec = Math.floor(now.getTime() / 1000);

      let remaining = 0;
      if (timeframe === "5m") {
        remaining = 300 - (nowSec % 300);
      } else if (timeframe === "15m") {
        remaining = 900 - (nowSec % 900);
      } else if (timeframe === "1h") {
        remaining = 3600 - (nowSec % 3600);
      } else if (timeframe === "1D" || timeframe === "D") {
        // Market close for US regular session: 16:00:00 US Eastern Time (America/New_York)
        try {
          const nyFormatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
          const parts = nyFormatter.formatToParts(now);
          const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
          const hour = getPart("hour");
          const min = getPart("minute");
          const sec = getPart("second");
          const curNySec = hour * 3600 + min * 60 + sec;
          const closeNySec = 16 * 3600; // 16:00 ET

          if (curNySec < closeNySec) {
            remaining = closeNySec - curNySec;
          } else {
            // Next trading day close
            remaining = 86400 - curNySec + closeNySec;
          }
        } catch {
          remaining = 86400 - (nowSec % 86400);
        }
      } else {
        remaining = 60 - (nowSec % 60);
      }

      if (remaining < 0) remaining = 0;
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");

      if (hours > 0) {
        setCandleCountdown(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      } else {
        setCandleCountdown(`${pad(minutes)}:${pad(seconds)}`);
      }
    };

    calcCountdown();
    const timer = setInterval(calcCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeframe]);

  // Fetch initial market data (Candles, Options Model Levels, DOM, Sinclair)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trader-panel?ticker=${ticker}&timeframe=${timeframe}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.spot) setSpotPrice(data.spot);
      if (data.sinclair) setSinclair(data.sinclair);
      if (data.dom) setDomData(data.dom);
      setLastRefreshed(new Date().toLocaleTimeString());

      // Update Chart Series
      if (seriesRef.current && Array.isArray(data.candles) && data.candles.length > 0) {
        seriesRef.current.setData(data.candles);
        lastCandleRef.current = { ...data.candles[data.candles.length - 1] };

        // Clear previous price lines
        priceLinesRef.current.forEach((pl) => {
          try {
            seriesRef.current?.removePriceLine(pl);
          } catch (e) {}
        });
        priceLinesRef.current = [];

        // Draw Options Model Lines (Exact match to injector levels)
        let levels: PriceLevel[] = [];
        if (Array.isArray(data.levels) && data.levels.length > 0) {
          levels = data.levels;
        } else if (data.modelLevels) {
          Object.values(data.modelLevels).forEach((lvl: any) => {
            if (lvl && lvl.price > 0) levels.push(lvl);
          });
        }

        levels.forEach((lvl) => {
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

        // Update timeScale options for daily vs intraday format
        chartRef.current?.applyOptions({
          timeScale: {
            timeVisible: timeframe !== "1D",
            secondsVisible: false,
          },
        });

        // Fit all candles into view automatically on timeframe switch
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error(`Error loading trader data for ${ticker}:`, err);
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe]);

  // Real-time WebSocket: Streams live exchange trade ticks directly into active candle
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimer: any = null;

    const connectWs = () => {
      try {
        ws = new WebSocket("wss://streamer.finance.yahoo.com");

        ws.onopen = () => {
          if (!isMounted) return;
          setIsLiveConnected(true);
          ws?.send(JSON.stringify({ subscribe: [ticker] }));
        };

        ws.onmessage = (evt) => {
          if (!isMounted) return;
          try {
            const raw = typeof evt.data === "string" ? evt.data : "";
            if (!raw) return;
            const quote = decodeYahooQuote(raw);
            if (!quote || quote.id !== ticker || !quote.price) return;

            const newPrice = quote.price;
            setSpotPrice(newPrice);
            setPriceFlash(true);
            setTimeout(() => setPriceFlash(false), 200);

            // Update active candle in real-time
            if (seriesRef.current && lastCandleRef.current) {
              const cur = lastCandleRef.current;
              const nowSec = Math.floor(Date.now() / 1000);

              let barSec = 900;
              if (timeframe === "5m") barSec = 300;
              else if (timeframe === "15m") barSec = 900;
              else if (timeframe === "1h") barSec = 3600;
              else if (timeframe === "1D" || timeframe === "D") barSec = 86400;

              const curBarTime = Math.floor(nowSec / barSec) * barSec;

              // If tick belongs to current bar, update high, low, close
              if (cur.time >= curBarTime || (timeframe === "1D" && Math.abs(cur.time - nowSec) < 86400)) {
                const updated = {
                  time: cur.time as any,
                  open: cur.open,
                  high: Math.max(cur.high, newPrice),
                  low: Math.min(cur.low, newPrice),
                  close: newPrice,
                };
                lastCandleRef.current = updated;
                seriesRef.current.update(updated as any);
              } else {
                // Candle closed, open new bar
                const newBar = {
                  time: curBarTime as any,
                  open: newPrice,
                  high: newPrice,
                  low: newPrice,
                  close: newPrice,
                };
                lastCandleRef.current = newBar;
                seriesRef.current.update(newBar as any);
              }
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsLiveConnected(false);
          reconnectTimer = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (e) {
        setIsLiveConnected(false);
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [ticker, timeframe]);

  // Initial Chart Initialization
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Create Lightweight Chart with pure black background, Bulgarian timezone, and hidden grids
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
        autoScale: true,
      },
      autoSize: true,
    });

    // 2. Add Candlestick Series:
    // Up candles: Warm golden yellow (#fbc02d - distinct yellow, not orange, not neon bright)
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
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch initial data on timeframe change and mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Periodic background refresh for options levels & Sinclair metrics every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData();
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  return (
    <div className="relative w-full h-[480px] bg-black border border-[#1e293b] rounded-lg overflow-hidden flex flex-col shadow-2xl">
      {/* Top Header Strip: Symbol, Timeframes, Live Ticks Status */}
      <div className="h-9 px-3 bg-[#05070e] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono select-none z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Live Tick Status Badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0b0f19] border border-[#1e293b] rounded text-[10px] font-mono shadow-sm"
            title={isLiveConnected ? "Direct Real-time Market WebSocket active" : "Connecting to real-time feed..."}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLiveConnected ? "bg-[#10b981] animate-ping" : "bg-[#f59e0b] animate-pulse"
              }`}
            />
            <span className={isLiveConnected ? "text-[#10b981] font-bold" : "text-neutral-400 font-semibold"}>
              {isLiveConnected ? "LIVE" : "SYNCING"}
            </span>
          </div>

          <span className="font-bold text-white tracking-wide">{chartTitle}</span>
          <span className="text-neutral-500">·</span>
          <span className="text-neutral-400 font-bold">{timeframe}</span>
          <span className="text-neutral-500">·</span>
          <span className="text-[#38bdf8] font-bold">{exchangeName}</span>

          {/* Live Spot Price with real-time flash animation on ticks */}
          {spotPrice > 0 && (
            <span
              className={`ml-1 px-2 py-0.5 border rounded text-white font-black text-[11px] transition-colors duration-150 ${
                priceFlash
                  ? "bg-[#10b981]/30 border-[#10b981] text-[#a7f3d0]"
                  : "bg-[#0f172a] border-[#334155]"
              }`}
            >
              ${spotPrice.toFixed(2)}
            </span>
          )}

          {/* Bulgarian Timezone Badge */}
          <span
            className="px-1.5 py-0.5 bg-[#0b0f19] border border-[#334155] rounded text-neutral-300 text-[10px] font-bold"
            title="Chart timescale displayed in Bulgarian Local Time (Europe/Sofia)"
          >
            🇧🇬 SOFIA
          </span>

          {/* Real-time Candle Close Countdown */}
          <div
            className="ml-2 flex items-center gap-1.5 px-2 py-0.5 bg-[#0b0f19] border border-[#f59e0b]/40 rounded text-[11px] font-mono shadow-sm"
            title={`Time remaining until active ${timeframe} candle closes`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
            <span className="text-neutral-400 text-[10px] font-semibold">CLOSE IN</span>
            <span className="text-[#f59e0b] font-black tracking-wider text-[11px]">{candleCountdown}</span>
          </div>
        </div>

        {/* Timeframe Selectors (5m, 15m, 1h, Daily - 4h removed) */}
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

      {/* Main Body: 2-Column Side-by-Side Flex Layout */}
      <div className="relative flex-1 w-full flex flex-row min-h-0 bg-black overflow-hidden">
        {/* Left Column: Dedicated Fixed Space for Options DOM & Sinclair Stats */}
        {/* Cut cleanly from the chart by the right vertical border (as indicated in screenshot) */}
        <div className="w-[316px] min-w-[316px] max-w-[316px] h-full bg-[#080a14] border-r border-[#1e293b] p-2 flex flex-col z-10 overflow-hidden">
          <OptionsDomWidget
            ticker={ticker}
            sinclair={sinclair}
            domData={domData}
            spot={spotPrice}
          />
        </div>

        {/* Right Column: Candlestick Chart Canvas (starts right after the vertical line) */}
        <div className="relative flex-1 h-full min-w-0 bg-black">
          <div ref={containerRef} className="w-full h-full" />

          {/* Loading Spinner */}
          {loading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-10 font-mono text-xs text-neutral-400">
              <span className="animate-pulse">Loading {ticker} {timeframe} candles...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

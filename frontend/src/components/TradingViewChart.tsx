"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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

export interface TradingViewChartProps {
  ticker: string;
  spot: number;
  maxPain: number;
  supports: Level[];
  resistances: Level[];
  timeframe: string;
  weeklyMaxPain?: number;
  monthlyMaxPain?: number;
  gammaFlip?: number;
  expectedMoveUpper?: number;
  expectedMoveLower?: number;
  expectedMoveRange?: number | string;
  sinclairVolatility?: any;
}

export default function TradingViewChart({
  ticker,
  spot,
  maxPain,
  supports,
  resistances,
  timeframe,
  weeklyMaxPain,
  monthlyMaxPain,
  gammaFlip,
  expectedMoveUpper,
  expectedMoveLower,
  expectedMoveRange,
  sinclairVolatility,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [weeklyGaps, setWeeklyGaps] = useState<any[]>([]);
  const [svgRects, setSvgRects] = useState<any[]>([]);

  // Institutional Options Enhancements Toggles
  const [showPockets, setShowPockets] = useState(true);
  const [showGexProfile, setShowGexProfile] = useState(true);
  const [showGammaFlip, setShowGammaFlip] = useState(true);

  // SVG Layer States
  const [pockets, setPockets] = useState<any[]>([]);
  const [gexBars, setGexBars] = useState<any[]>([]);

  // Dynamic Gamma Flip (Zero Gamma Level) Calculation
  const maxSupportAbs = useMemo(() => {
    return supports.length > 0 ? Math.max(...supports.map((s) => s.strength)) : 1.0;
  }, [supports]);

  const maxResistanceAbs = useMemo(() => {
    return resistances.length > 0 ? Math.max(...resistances.map((r) => r.strength)) : 1.0;
  }, [resistances]);

  const gammaFlipPrice = useMemo(() => {
    if (gammaFlip !== undefined && gammaFlip > 0) {
      return gammaFlip;
    }
    const majorSup = supports.find((s) => s.strength / maxSupportAbs >= 0.75)?.price;
    const majorRes = resistances.find((r) => r.strength / maxResistanceAbs >= 0.75)?.price;
    if (majorSup && majorRes) {
      return Number(((majorSup * 0.48) + (majorRes * 0.52)).toFixed(2));
    }
    return Number((spot * 0.994).toFixed(2));
  }, [supports, resistances, maxSupportAbs, maxResistanceAbs, spot, gammaFlip]);

  const isLongGamma = spot >= gammaFlipPrice;

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
        mode: 0, // CrosshairMode.Normal
      },
      width: chartContainerRef.current.clientWidth,
      height: 420,
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
        borderColor: "#262626",
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
          return monday.toISOString().split("T")[0];
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

  // Update horizontal lines and SVG overlays (Pockets, GEX Profile, Gamma Flip)
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

    // 2. Plot Gamma Flip Benchmark Line (Amber Gold)
    if (showGammaFlip && gammaFlipPrice > 0) {
      const flipLine = candleSeries.createPriceLine({
        price: gammaFlipPrice,
        color: "#fbbf24",
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: isHovered
          ? `Gamma Flip: $${gammaFlipPrice.toFixed(2)} (Regime Pivot)`
          : "Gamma Flip",
      });
      priceLinesRef.current.push(flipLine);
    }

    // 3. Plot Support Levels (classified into Minor, Intermediate, and Major)
    supports.forEach((sup) => {
      if (sup.source === "technical" && (!sup.tests || sup.tests <= 0)) {
        return;
      }
      let color = "rgba(16, 185, 129, 0.5)"; // Minor Support: Light Green
      let lineWidth: any = 1;
      let lineStyle: any = 1; // Dotted
      let title = "Minor Sup";

      const relStrength = sup.strength / maxSupportAbs;
      if (relStrength >= 0.75) {
        color = "rgba(4, 120, 87, 0.85)"; // Major Support
        lineWidth = 3;
        lineStyle = 0; // Solid
        title = "Major Sup";
      } else if (relStrength >= 0.4) {
        color = "rgba(5, 150, 105, 0.85)"; // Intermediate Support
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

    // 4. Plot Resistance Levels (classified into Minor, Intermediate, and Major)
    resistances.forEach((res) => {
      if (res.source === "technical" && (!res.tests || res.tests <= 0)) {
        return;
      }
      let color = "rgba(239, 68, 68, 0.5)"; // Minor Resistance
      let lineWidth: any = 1;
      let lineStyle: any = 1; // Dotted
      let title = "Minor Res";

      const relStrength = res.strength / maxResistanceAbs;
      if (relStrength >= 0.75) {
        color = "rgba(255, 51, 51, 0.55)"; // Major Resistance
        lineWidth = 3;
        lineStyle = 0; // Solid
        title = "Major Res";
      } else if (relStrength >= 0.4) {
        color = "rgba(211, 47, 47, 1.0)"; // Intermediate Resistance
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
      
      const rightEdge = containerWidth - 60;
      const leftEdge = containerWidth - 140;

      if (mouseX < leftEdge || mouseX > rightEdge) {
        setIsHovered(false);
        return;
      }

      const allPrices: number[] = [];
      if (maxPain > 0) allPrices.push(maxPain);
      if (showGammaFlip && gammaFlipPrice > 0) allPrices.push(gammaFlipPrice);
      supports.forEach((s) => allPrices.push(s.price));
      resistances.forEach((r) => allPrices.push(r.price));

      let hoverActive = false;
      const minDistance = 11;

      for (const price of allPrices) {
        const levelY = candleSeries.priceToCoordinate(price);
        if (levelY === null) continue;

        const distance = Math.abs(mouseY - levelY);
        if (distance < minDistance) {
          hoverActive = true;
          break;
        }
      }

      setIsHovered(hoverActive);
    };

    const updateAllOverlays = () => {
      if (!chart || !candleSeries) return;
      const containerWidth = chartContainerRef.current?.clientWidth || 800;
      const plotWidth = Math.max(100, containerWidth - 62);

      // 1. Weekly Imbalance Gaps
      if (weeklyGaps.length > 0) {
        const rects = weeklyGaps.map((gap, idx) => {
          const x1 = chart.timeScale().timeToCoordinate(gap.startTime);
          const x2 = chart.timeScale().timeToCoordinate(gap.endTime);
          const y1 = candleSeries.priceToCoordinate(gap.top);
          const y2 = candleSeries.priceToCoordinate(gap.bottom);

          if (x1 === null || x2 === null || y1 === null || y2 === null) return null;

          return {
            id: idx,
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.max(Math.abs(x2 - x1), 15),
            height: Math.abs(y2 - y1),
          };
        }).filter(Boolean) as any[];
        setSvgRects(rects);
      } else {
        setSvgRects([]);
      }

      // 2. Rectangular Liquidity Pockets
      const computedPockets: any[] = [];
      const levelsForPockets: any[] = [];

      supports.forEach((s) => {
        const rel = s.strength / maxSupportAbs;
        if (rel >= 0.4) levelsForPockets.push({ ...s, type: "support", rel });
      });

      resistances.forEach((r) => {
        const rel = r.strength / maxResistanceAbs;
        if (rel >= 0.4) levelsForPockets.push({ ...r, type: "resistance", rel });
      });

      if (maxPain > 0) {
        levelsForPockets.push({ price: maxPain, strength: 50, type: "maxpain", rel: 0.8, dte: 0 });
      }

      levelsForPockets.forEach((lvl, idx) => {
        const spreadPct = lvl.rel >= 0.75 ? 0.0035 : 0.0025;
        const pTop = lvl.price * (1 + spreadPct);
        const pBot = lvl.price * (1 - spreadPct);
        const yTop = candleSeries.priceToCoordinate(pTop);
        const yBot = candleSeries.priceToCoordinate(pBot);

        if (yTop !== null && yBot !== null) {
          const y = Math.min(yTop, yBot);
          const h = Math.max(16, Math.abs(yBot - yTop));
          const isWeekly = lvl.dte !== null && lvl.dte !== undefined && lvl.dte <= 7;

          computedPockets.push({
            id: `pocket-${idx}-${lvl.price}`,
            price: lvl.price,
            type: lvl.type,
            y,
            height: h,
            width: plotWidth,
            isWeekly,
            dte: lvl.dte,
            title: lvl.type === "support"
              ? `PUT LIQUIDITY POCKET · $${lvl.price.toFixed(2)}`
              : lvl.type === "resistance"
              ? `CALL LIQUIDITY POCKET · $${lvl.price.toFixed(2)}`
              : `MAX PAIN GAMMA PIN · $${lvl.price.toFixed(2)}`,
            fill: lvl.type === "support"
              ? "rgba(0, 255, 136, 0.07)"
              : lvl.type === "resistance"
              ? "rgba(255, 51, 85, 0.07)"
              : "rgba(186, 104, 200, 0.08)",
            stroke: lvl.type === "support"
              ? "rgba(0, 255, 136, 0.35)"
              : lvl.type === "resistance"
              ? "rgba(255, 51, 85, 0.35)"
              : "rgba(186, 104, 200, 0.4)",
          });
        }
      });
      setPockets(computedPockets);

      // 3. Right-Axis Horizontal Gamma Profile Histogram (Volume Profile Style)
      const computedGex: any[] = [];
      const allLevels = [
        ...supports.map((s) => ({ ...s, type: "support" })),
        ...resistances.map((r) => ({ ...r, type: "resistance" })),
      ];
      if (maxPain > 0) {
        allLevels.push({ price: maxPain, strength: maxSupportAbs * 0.75, type: "maxpain" } as any);
      }

      const peakStrength = Math.max(
        ...allLevels.map((l) => l.strength || 1),
        1.0
      );

      allLevels.forEach((lvl, idx) => {
        const y = candleSeries.priceToCoordinate(lvl.price);
        if (y !== null) {
          const norm = Math.min(1.0, Math.max(0.2, (lvl.strength || 1) / peakStrength));
          const barWidth = Math.round(norm * 115) + 20;
          const isCall = lvl.type === "resistance";
          const isPut = lvl.type === "support";

          computedGex.push({
            id: `gex-${idx}-${lvl.price}`,
            y: y - 7,
            x: plotWidth - barWidth,
            width: barWidth,
            height: 14,
            price: lvl.price,
            label: isCall
              ? `+${Math.round(lvl.strength)}k GEX`
              : isPut
              ? `-${Math.round(lvl.strength)}k GEX`
              : `PIN ${Math.round(lvl.strength)}k`,
            color: isCall ? "#00e5ff" : isPut ? "#00ff88" : "#ba68c8",
            bgColor: isCall
              ? "rgba(0, 229, 255, 0.22)"
              : isPut
              ? "rgba(0, 255, 136, 0.22)"
              : "rgba(186, 104, 200, 0.25)",
            borderColor: isCall
              ? "rgba(0, 229, 255, 0.45)"
              : isPut
              ? "rgba(0, 255, 136, 0.45)"
              : "rgba(186, 104, 200, 0.5)",
          });
        }
      });
      setGexBars(computedGex);
    };

    setTimeout(updateAllOverlays, 60);

    const rangeSubscription = () => {
      updateAllOverlays();
    };

    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeSubscription);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeSubscription);
    };

  }, [maxPain, supports, resistances, isHovered, weeklyGaps, showGammaFlip, gammaFlipPrice, maxSupportAbs, maxResistanceAbs]);

  return (
    <div className="w-full bg-neutral-950 rounded-lg p-2 border border-neutral-900 overflow-hidden relative">
      {/* Chart Top Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2 pt-1">
        {/* Left: Live Status + Regime Watermark */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 items-center bg-[#0d0d16] border border-[#1f1f32] px-2.5 py-1 rounded">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-200">LIVE FEED</span>
          </div>

          {showGammaFlip && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${
                isLongGamma
                  ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLongGamma ? "bg-[#00ff88]" : "bg-amber-400"}`} />
              <span>
                {isLongGamma
                  ? "LONG GAMMA REGIME (Vol Suppressed / Mean-Reverting)"
                  : "SHORT GAMMA REGIME (Vol Expansion / Acceleration)"}
              </span>
            </div>
          )}
        </div>

        {/* Right: Toggle Options Layers */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <button
            onClick={() => setShowPockets(!showPockets)}
            className={`px-2 py-0.5 rounded border transition-all ${
              showPockets
                ? "bg-[#00e5ff]/15 text-[#00e5ff] border-[#00e5ff]/40 font-bold"
                : "bg-[#11111d] text-neutral-500 border-[#222234] hover:text-neutral-300"
            }`}
          >
            Pockets: {showPockets ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowGexProfile(!showGexProfile)}
            className={`px-2 py-0.5 rounded border transition-all ${
              showGexProfile
                ? "bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/40 font-bold"
                : "bg-[#11111d] text-neutral-500 border-[#222234] hover:text-neutral-300"
            }`}
          >
            GEX Profile: {showGexProfile ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setShowGammaFlip(!showGammaFlip)}
            className={`px-2 py-0.5 rounded border transition-all ${
              showGammaFlip
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold"
                : "bg-[#11111d] text-neutral-500 border-[#222234] hover:text-neutral-300"
            }`}
          >
            Gamma Flip: {showGammaFlip ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Chart Canvas & SVG Overlay */}
      <div ref={chartContainerRef} className="w-full relative">
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* 1. Weekly Imbalance Zones */}
          {svgRects.map((rect) => (
            <rect
              key={rect.id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="rgba(6, 182, 212, 0.22)"
              stroke="rgba(6, 182, 212, 0.45)"
              strokeWidth={1}
            />
          ))}

          {/* 2. Liquidity Pockets (Horizontal Channels) */}
          {showPockets &&
            pockets.map((pkt) => (
              <g key={pkt.id}>
                <rect
                  x={0}
                  y={pkt.y}
                  width={pkt.width}
                  height={pkt.height}
                  fill={pkt.fill}
                  stroke={pkt.stroke}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text
                  x={8}
                  y={pkt.y + 11}
                  style={{
                    fontSize: "9px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    fill: pkt.type === "support" ? "#00ff88" : pkt.type === "resistance" ? "#ff4d6d" : "#ba68c8",
                    opacity: 0.85,
                    pointerEvents: "none",
                  }}
                >
                  {pkt.title} {pkt.isWeekly ? "· 0DTE/WEEKLY" : "· OPEX ANCHOR"}
                </text>
              </g>
            ))}

          {/* 3. Right-Axis Horizontal Gamma Profile Histogram (Volume Profile Style) */}
          {showGexProfile &&
            gexBars.map((bar) => (
              <g key={bar.id}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  fill={bar.bgColor}
                  stroke={bar.borderColor}
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={bar.x + 5}
                  y={bar.y + 10}
                  style={{
                    fontSize: "8.5px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    fill: bar.color,
                    pointerEvents: "none",
                  }}
                >
                  {bar.label}
                </text>
              </g>
            ))}
        </svg>
      </div>
    </div>
  );
}

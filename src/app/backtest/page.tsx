"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import BacktestChart from "@/components/BacktestChart";

export default function BacktestPage() {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"dual" | "spy" | "qqq">("dual");
  const [loadingDates, setLoadingDates] = useState<boolean>(true);

  // Load available trading dates from the backtest API on mount
  useEffect(() => {
    async function loadDates() {
      try {
        const res = await fetch("/api/backtest?ticker=SPY");
        if (res.ok) {
          const data = await res.json();
          if (data.availableDates && data.availableDates.length > 0) {
            setAvailableDates(data.availableDates);
            setSelectedDate(data.availableDates[data.availableDates.length - 1]);
          }
        }
      } catch (err) {
        console.error("Failed to load backtest dates:", err);
      } finally {
        setLoadingDates(false);
      }
    }
    loadDates();
  }, []);

  const currentIndex = availableDates.indexOf(selectedDate);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < availableDates.length - 1 && currentIndex !== -1;

  const goToPrev = () => {
    if (hasPrev) {
      setSelectedDate(availableDates[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      setSelectedDate(availableDates[currentIndex + 1]);
    }
  };

  return (
    <main className="min-h-screen bg-[#05060a] text-neutral-100 flex flex-col">
      {/* Sleek Minimal Header */}
      <header className="h-12 px-4 bg-[#080b14] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors bg-[#0f172a] border border-[#1e293b] px-2.5 py-1 rounded text-[11px]"
          >
            <span>←</span>
            <span>Home</span>
          </Link>
          <Link
            href="/trader-panel"
            className="flex items-center gap-1.5 text-[#00ff88] hover:text-white transition-colors bg-[#00ff88]/10 border border-[#00ff88]/30 px-2.5 py-1 rounded text-[11px] font-bold"
          >
            <span>Live Panel</span>
            <span>⚡</span>
          </Link>

          <div className="h-4 w-[1px] bg-[#1e293b]" />

          <div className="flex items-center gap-2">
            <span className="font-black tracking-wider text-white">HISTORICAL BACKTESTER</span>
            <span className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest">
              REAL OCC &amp; CBOE DATA
            </span>
          </div>
        </div>

        {/* Global Date Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0b0f19] px-2 py-1 rounded border border-[#1e293b]">
            <span className="text-[10px] text-neutral-400 font-semibold mr-1">SESSION DATE:</span>
            <button
              onClick={goToPrev}
              disabled={!hasPrev || loadingDates}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                hasPrev
                  ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                  : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
              }`}
            >
              ← Prev
            </button>

            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={loadingDates}
              className="bg-[#0f172a] text-[#facc15] font-mono text-[11px] font-black px-2.5 py-0.5 rounded border border-[#334155] focus:outline-none focus:border-[#facc15]"
            >
              {availableDates.map((d) => (
                <option key={d} value={d} className="bg-[#080b14] text-white">
                  {d}
                </option>
              ))}
            </select>

            <button
              onClick={goToNext}
              disabled={!hasNext || loadingDates}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                hasNext
                  ? "bg-[#0f172a] hover:bg-[#1e293b] text-neutral-200 border-[#334155]"
                  : "bg-black/30 text-neutral-600 border-[#1e293b] cursor-not-allowed"
              }`}
            >
              Next →
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#0b0f19] p-0.5 rounded border border-[#1e293b]">
            <button
              onClick={() => setViewMode("dual")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                viewMode === "dual"
                  ? "bg-[#38bdf8] text-black font-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Dual
            </button>
            <button
              onClick={() => setViewMode("spy")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                viewMode === "spy"
                  ? "bg-[#38bdf8] text-black font-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              SPY
            </button>
            <button
              onClick={() => setViewMode("qqq")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                viewMode === "qqq"
                  ? "bg-[#38bdf8] text-black font-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              QQQ
            </button>
          </div>
        </div>

        {/* Informational Badges */}
        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 bg-[#0f172a] px-2.5 py-1 rounded border border-[#1e293b]">
            <span className="w-2 h-2 rounded-full bg-[#facc15]" />
            <span className="text-neutral-300 font-bold text-[10px]">DOM: 10m After Open</span>
          </div>
        </div>
      </header>

      {/* Main Container: Stacked Vertically */}
      <div className="flex-1 w-full max-w-[1420px] mx-auto px-3 py-2 flex flex-col gap-3">
        {/* SPY Chart */}
        {(viewMode === "dual" || viewMode === "spy") && (
          <div className="w-full">
            {selectedDate && (
              <BacktestChart
                ticker="SPY"
                exchangeName="AMEX"
                chartTitle="SPDR S&P 500 ETF TRUST"
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                availableDates={availableDates}
                defaultTimeframe="15m"
              />
            )}
          </div>
        )}

        {/* QQQ Chart */}
        {(viewMode === "dual" || viewMode === "qqq") && (
          <div className="w-full">
            {selectedDate && (
              <BacktestChart
                ticker="QQQ"
                exchangeName="NASDAQ"
                chartTitle="INVESCO QQQ TRUST"
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                availableDates={availableDates}
                defaultTimeframe="15m"
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

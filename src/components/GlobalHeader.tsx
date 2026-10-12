"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface GlobalHeaderProps {
  ticker: string;
  setTicker: (t: string) => void;
  onSearchSubmit: (symbol: string) => void;
  onOpenCommandPalette: () => void;
  apiConnected: boolean;
}

export default function GlobalHeader({
  ticker,
  setTicker,
  onSearchSubmit,
  onOpenCommandPalette,
  apiConnected,
}: GlobalHeaderProps) {
  const [inputVal, setInputVal] = useState(ticker);
  const [clocks, setClocks] = useState({
    nyc: "",
    london: "",
    dublin: "",
    tokyo: "",
  });

  useEffect(() => {
    setInputVal(ticker);
  }, [ticker]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClocks({
        nyc: now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        london: now.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        dublin: now.toLocaleTimeString("en-IE", { timeZone: "Europe/Dublin", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        tokyo: now.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearchSubmit(inputVal.trim().toUpperCase());
    }
  };

  return (
    <header className="border-b border-[#1f1f2e] bg-[#07070b]/95 backdrop-blur-md sticky top-0 z-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-neutral-200">
      {/* Left: Logo & Live Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-mono font-bold text-base tracking-tight text-white">
          <span className="text-[#00ff88] text-lg font-black">TrueCharts</span>
          <span className="bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">
            PRO
          </span>
        </div>
        <div className="flex items-center gap-1.5 border border-[#1e293b] bg-[#0b1120] px-2 py-0.5 rounded-full text-[10px] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping" />
          <span className="text-[#00ff88] font-semibold tracking-wider">LIVE</span>
        </div>
      </div>

      {/* Center: Command Palette / Search Bar */}
      <div className="flex-1 max-w-md mx-auto">
        <form onSubmit={handleFormSubmit} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-[#00e5ff] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onFocus={onOpenCommandPalette}
            placeholder="Search symbol (e.g. SPY, AAPL, ES1!)..."
            className="w-full bg-[#0d0d14] border border-[#1e1e2d] rounded-md pl-9 pr-16 py-1.5 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-all uppercase tracking-wider"
          />
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="absolute inset-y-1 right-1 px-2 bg-[#161622] border border-[#27273a] hover:bg-[#202032] text-[10px] font-mono text-neutral-400 rounded flex items-center gap-1 transition-colors"
          >
            <span className="text-[#00e5ff]">⌘K</span>
          </button>
        </form>
      </div>

      {/* Right: Market Clocks & VIX Sparkline Strip */}
      <div className="flex items-center gap-4">
        {/* World Clocks */}
        <div className="hidden xl:flex items-center gap-3 border-r border-[#1e1e2d] pr-4 text-[10px] font-mono text-neutral-400">
          <div className="flex items-center gap-1">
            <span className="text-neutral-500 font-bold uppercase">NYC:</span>
            <span className="text-neutral-200 font-bold">{clocks.nyc || "--:--:--"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-neutral-500 font-bold uppercase">LON:</span>
            <span className="text-neutral-200 font-bold">{clocks.london || "--:--:--"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-neutral-500 font-bold uppercase">DUB:</span>
            <span className="text-neutral-200 font-bold">{clocks.dublin || "--:--:--"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-neutral-500 font-bold uppercase">TYO:</span>
            <span className="text-neutral-200 font-bold">{clocks.tokyo || "--:--:--"}</span>
          </div>
        </div>

        {/* Mini VIX Strip with 5D Sparkline */}
        <div className="flex items-center gap-2 bg-[#0c0c14] border border-[#1f1f30] px-2.5 py-1 rounded">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold text-neutral-400">VIX</span>
              <span className="text-xs font-mono font-bold text-[#00ff88]">14.82</span>
              <span className="text-[9px] font-mono font-semibold text-[#00ff88]">-2.95%</span>
            </div>
            <span className="text-[8px] font-mono text-neutral-500 uppercase">5D Volatility</span>
          </div>
          {/* 5-day Sparkline SVG */}
          <svg className="w-12 h-5 text-[#00ff88]" viewBox="0 0 50 20" fill="none">
            <path
              d="M0 16 L10 12 L20 15 L30 8 L40 10 L50 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Trader Panel Navigation Button */}
        <Link
          href="/trader-panel"
          className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/50 hover:border-purple-400 text-purple-200 hover:text-white rounded text-xs font-mono font-bold transition-all shadow-[0_0_12px_rgba(168,85,247,0.25)] hover:scale-105 active:scale-95"
        >
          <span className="text-purple-400">📊</span>
          <span>Trader Panel</span>
        </Link>

        {/* API Connection Indicator */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
            apiConnected
              ? "text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30"
              : "text-amber-400 bg-amber-500/10 border-amber-500/30"
          }`}>
            {apiConnected ? "API: ONLINE" : "API: OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}

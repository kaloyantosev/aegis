"use client";

import React from "react";

const POLICY_EVENTS = [
  { date: "Sep 2024", fed: "4.75%-5.00%", spx: 5700, label: "Fed 50bps Jumbo Cut", type: "bullish" },
  { date: "Dec 2024", fed: "4.50%-4.75%", spx: 6050, label: "Year-End Easing Step", type: "bullish" },
  { date: "May 2025", fed: "4.25%-4.50%", spx: 6480, label: "Coordinated Global Pivot", type: "bullish" },
  { date: "Nov 2025", fed: "4.00%-4.25%", spx: 6920, label: "Liquidity Re-Injection", type: "bullish" },
  { date: "Apr 2026", fed: "3.75%-4.00%", spx: 7350, label: "Neutral Rate Target Approach", type: "neutral" },
  { date: "Aug 2026", fed: "3.75%-4.00%", spx: 7610, label: "Current Policy Regime", type: "bullish" },
];

const COT_CONTRACTS = [
  { symbol: "ES", name: "E-mini S&P 500", netCommPct: "+18.4%", percentile: 94, status: "Bullish Extreme", signal: "MAX LONG" },
  { symbol: "NQ", name: "E-mini Nasdaq 100", netCommPct: "+14.2%", percentile: 88, status: "Strong Bullish", signal: "HEAVY LONG" },
  { symbol: "6E", name: "Euro FX Futures", netCommPct: "-8.5%", percentile: 22, status: "Bearish Bias", signal: "SHORT" },
  { symbol: "CL", name: "WTI Crude Oil", netCommPct: "-16.1%", percentile: 12, status: "Max Bearish", signal: "EXTREME SHORT" },
];

export default function MacroNarrativeDashboard() {
  return (
    <div className="bg-[#0b0b13] border border-[#1e1e2f] rounded-lg p-5 flex flex-col gap-5">
      {/* Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b1b2a] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#00e5ff] font-mono font-bold text-sm">MODULE 4</span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Macro Narrative & Liquidity Dashboard
            </h2>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Quantamental Edge · Central Bank Rates, Net USD Liquidity & Institutional COT Positioning
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] px-2.5 py-1 rounded font-bold tracking-wider">
            EXPANDING LIQUIDITY REGIME
          </span>
        </div>
      </div>

      {/* THREE-PANEL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* PANEL 1 (LEFT): Central Bank Policy Tracker */}
        <div className="bg-[#08080f] border border-[#1a1a2a] rounded-lg p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#161625] pb-2">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>Central Bank Policy Tracker</span>
            </h3>
            <span className="text-[9px] font-mono text-[#00e5ff]">12M Timeline</span>
          </div>

          {/* Current Rate Gauges */}
          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="bg-[#0d0d16] border border-[#1f1f32] p-2 rounded text-center">
              <span className="text-[9px] text-neutral-500 block uppercase">US Fed</span>
              <span className="text-xs font-bold text-[#00ff88]">3.75 - 4.00%</span>
            </div>
            <div className="bg-[#0d0d16] border border-[#1f1f32] p-2 rounded text-center">
              <span className="text-[9px] text-neutral-500 block uppercase">ECB</span>
              <span className="text-xs font-bold text-[#00e5ff]">2.75%</span>
            </div>
            <div className="bg-[#0d0d16] border border-[#1f1f32] p-2 rounded text-center">
              <span className="text-[9px] text-neutral-500 block uppercase">BOJ</span>
              <span className="text-xs font-bold text-amber-400">0.50%</span>
            </div>
          </div>

          {/* Policy Timeline & SPX Overlay SVG Chart */}
          <div className="bg-[#050508] border border-[#161624] rounded p-3 relative flex flex-col gap-3">
            <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400">
              <span>S&P 500 Index vs Rate Policy</span>
              <span className="text-[#00ff88]">+33.5% 12M Expansion</span>
            </div>

            <svg className="w-full h-28 text-[#00ff88]" viewBox="0 0 300 90" fill="none">
              {/* Background grid */}
              <line x1="0" y1="25" x2="300" y2="25" stroke="#161625" strokeDasharray="3 3" />
              <line x1="0" y1="55" x2="300" y2="55" stroke="#161625" strokeDasharray="3 3" />
              
              {/* SPX Line Path */}
              <path
                d="M 10 75 Q 60 70 90 55 T 160 40 T 230 25 T 290 10"
                stroke="#00ff88"
                strokeWidth="2"
                fill="none"
              />
              
              {/* Event Circles - Clean stable markers, no jumping CSS ping transform */}
              <circle cx="30" cy="73" r="3" fill="#00e5ff" />
              <circle cx="90" cy="55" r="3" fill="#00ff88" />
              <circle cx="160" cy="40" r="3" fill="#00ff88" />
              <circle cx="230" cy="25" r="5" fill="#00ff88" fillOpacity="0.25" />
              <circle cx="230" cy="25" r="3" fill="#00ff88" />
            </svg>

            {/* Event Timeline List */}
            <div className="flex flex-col gap-1.5 font-mono text-[10px]">
              {POLICY_EVENTS.slice(2).map((ev, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-[#141422] pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 font-bold">{ev.date}</span>
                    <span className="text-white font-semibold">{ev.label}</span>
                  </div>
                  <span className="text-[#00ff88] font-bold">{ev.fed}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL 2 (CENTER): Liquidity Conditions & Fed Balance Sheet */}
        <div className="bg-[#08080f] border border-[#1a1a2a] rounded-lg p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#161625] pb-2">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>Liquidity Conditions & QT/QE Gauge</span>
            </h3>
            <span className="text-[9px] font-mono text-[#00ff88]">M2 & Net Liquidity</span>
          </div>

          {/* Color-Coded Gauge */}
          <div className="bg-[#0d0d16] border border-[#00ff88]/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider">Overall Liquidity Gauge</span>
              <span className="text-sm font-mono font-black text-[#00ff88] tracking-wide">
                EXPANDING LIQUIDITY (GREEN)
              </span>
            </div>
            <div className="w-4 h-4 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_12px_#00ff88]" />
          </div>

          {/* Balance Sheet Stats */}
          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="bg-[#050508] border border-[#181827] p-2.5 rounded flex flex-col gap-1">
              <span className="text-[9px] text-neutral-500 uppercase">Fed Total Assets</span>
              <span className="text-base font-black text-white">$7.12 Trillion</span>
              <span className="text-[9px] text-amber-400">QT Pace: -$28B / Month</span>
            </div>
            <div className="bg-[#050508] border border-[#181827] p-2.5 rounded flex flex-col gap-1">
              <span className="text-[9px] text-neutral-500 uppercase">US M2 Money Supply</span>
              <span className="text-base font-black text-[#00ff88]">+2.4% YoY</span>
              <span className="text-[9px] text-neutral-400">Re-Expansion Active</span>
            </div>
          </div>

          {/* Net Liquidity Breakdown */}
          <div className="bg-[#050508] border border-[#161624] rounded p-3 font-mono flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs border-b border-[#141422] pb-1.5">
              <span className="text-neutral-400">Net USD Liquidity Index</span>
              <span className="text-[#00ff88] font-bold">$6.18 Trillion (+3.8% QoQ)</span>
            </div>
            <div className="text-[10px] text-neutral-500 flex justify-between">
              <span>Formula: Fed Assets - RRP Facility - Treasury Gen Acct</span>
              <span className="text-[#00e5ff]">High SPX Correlation (0.92)</span>
            </div>
          </div>
        </div>

        {/* PANEL 3 (RIGHT): COT Positioning (Commitment of Traders) */}
        <div className="bg-[#08080f] border border-[#1a1a2a] rounded-lg p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#161625] pb-2">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>COT Institutional Positioning</span>
            </h3>
            <span className="text-[9px] font-mono text-neutral-500">CFTC Weekly Data</span>
          </div>

          <p className="text-[10px] font-mono text-neutral-400">
            Commercial Net Position % of Open Interest + 52-Week Percentile Rank
          </p>

          <div className="flex flex-col gap-2.5 font-mono">
            {COT_CONTRACTS.map((contract) => {
              const isHighBullish = contract.percentile >= 75;
              const isBearish = contract.percentile <= 30;

              return (
                <div
                  key={contract.symbol}
                  className="bg-[#0d0d16] border border-[#1d1d2f] rounded p-2.5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white bg-[#141422] px-1.5 py-0.5 rounded border border-[#27273d]">
                        {contract.symbol}
                      </span>
                      <span className="text-[10px] text-neutral-300 font-semibold">{contract.name}</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${
                        isHighBullish
                          ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
                          : isBearish
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-neutral-800 text-neutral-300 border-neutral-700"
                      }`}
                    >
                      {contract.signal}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-400">Net Commercial: {contract.netCommPct}</span>
                    <span className="text-neutral-200 font-bold">52W Percentile: {contract.percentile}th</span>
                  </div>

                  {/* Percentile visual bar */}
                  <div className="w-full h-1.5 bg-[#12121e] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        isHighBullish ? "bg-[#00ff88]" : isBearish ? "bg-rose-500" : "bg-[#00e5ff]"
                      }`}
                      style={{ width: `${contract.percentile}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

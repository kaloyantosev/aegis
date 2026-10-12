"use client";

import React from "react";
import Link from "next/link";
import PureTraderChart from "@/components/PureTraderChart";

export default function TraderPanelPage() {
  return (
    <main className="min-h-screen bg-[#05060a] text-neutral-100 flex flex-col">
      {/* Sleek Minimal Header */}
      <header className="h-11 px-4 bg-[#080b14] border-b border-[#1e293b] flex items-center justify-between text-xs font-mono select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors bg-[#0f172a] border border-[#1e293b] px-2.5 py-1 rounded text-[11px]"
          >
            <span>←</span>
            <span>Home</span>
          </Link>
          <div className="h-4 w-[1px] bg-[#1e293b]" />
          <div className="flex items-center gap-2">
            <span className="font-black tracking-wider text-white">TRADER PANEL</span>
            <span className="bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-widest">
              PRO DUAL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5 bg-[#0f172a] px-2.5 py-1 rounded border border-[#1e293b]">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
            <span className="text-neutral-300 font-bold">1-Min Live Sync</span>
          </div>
        </div>
      </header>

      {/* Main Container: Centered, Big but not too wide, stacked vertically */}
      <div className="flex-1 w-full max-w-[1420px] mx-auto px-3 py-2 flex flex-col gap-3">
        {/* Top Chart: SPY AMEX */}
        <div className="w-full flex-1 min-h-[480px]">
          <PureTraderChart
            ticker="SPY"
            exchangeName="AMEX"
            chartTitle="SPDR S&P 500 ETF TRUST"
            defaultTimeframe="15m"
          />
        </div>

        {/* Bottom Chart: QQQ NASDAQ */}
        <div className="w-full flex-1 min-h-[480px]">
          <PureTraderChart
            ticker="QQQ"
            exchangeName="NASDAQ"
            chartTitle="INVESCO QQQ TRUST"
            defaultTimeframe="15m"
          />
        </div>
      </div>
    </main>
  );
}

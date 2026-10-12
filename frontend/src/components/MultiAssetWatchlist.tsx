"use client";

import React, { useState } from "react";

interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change1D: number;
  volVs20D: string;
  volSurge: boolean;
  netDelta: string;
  isDeltaBullish: boolean;
  oiNearestStrike: string;
  trend13F: "Accumulating" | "Distributing" | "Neutral";
}

const DEFAULT_WATCHLIST_DATA: WatchlistItem[] = [
  { ticker: "SPY", name: "S&P 500 ETF", price: 761.22, change1D: -0.42, volVs20D: "+118%", volSurge: false, netDelta: "+58% Buy Delta", isDeltaBullish: true, oiNearestStrike: "$760.00 Call Gamma Magnet", trend13F: "Accumulating" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", price: 709.84, change1D: -0.71, volVs20D: "+142%", volSurge: true, netDelta: "+64% Buy Delta", isDeltaBullish: true, oiNearestStrike: "$710.00 Call Gamma Magnet", trend13F: "Accumulating" },
  { ticker: "NVDA", name: "NVIDIA Corp", price: 211.71, change1D: -3.00, volVs20D: "+185%", volSurge: true, netDelta: "+72% Heavy Call Flow", isDeltaBullish: true, oiNearestStrike: "$210.00 Major Call Strike", trend13F: "Accumulating" },
  { ticker: "AAPL", name: "Apple Inc.", price: 334.23, change1D: 0.51, volVs20D: "+95%", volSurge: false, netDelta: "+51% Neutral Delta", isDeltaBullish: true, oiNearestStrike: "$335.00 Call Wall Magnet", trend13F: "Accumulating" },
  { ticker: "MSFT", name: "Microsoft Corp", price: 505.33, change1D: 2.11, volVs20D: "+124%", volSurge: false, netDelta: "+61% Buy Delta", isDeltaBullish: true, oiNearestStrike: "$500.00 Call Support", trend13F: "Accumulating" },
  { ticker: "META", name: "Meta Platforms", price: 659.64, change1D: 1.85, volVs20D: "+160%", volSurge: true, netDelta: "+68% Buy Delta", isDeltaBullish: true, oiNearestStrike: "$660.00 Gamma Anchor", trend13F: "Accumulating" },
  { ticker: "TSLA", name: "Tesla Inc.", price: 363.36, change1D: -0.52, volVs20D: "+138%", volSurge: false, netDelta: "-58% Put Heavy", isDeltaBullish: false, oiNearestStrike: "$360.00 Put Support Strike", trend13F: "Distributing" },
  { ticker: "IWM", name: "Russell 2000 ETF", price: 288.23, change1D: -0.23, volVs20D: "+88%", volSurge: false, netDelta: "-48% Neutral Delta", isDeltaBullish: false, oiNearestStrike: "$290.00 Resistance Wall", trend13F: "Neutral" },
];

export default function MultiAssetWatchlist({
  activeTicker,
  onSelectTicker,
}: {
  activeTicker: string;
  onSelectTicker: (t: string) => void;
}) {
  const [filterText, setFilterText] = useState("");
  const [newSymbolInput, setNewSymbolInput] = useState("");
  const [items, setItems] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST_DATA);

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbolInput.trim().toUpperCase();
    if (!sym) return;
    if (items.some((i) => i.ticker === sym)) return;

    const newItem: WatchlistItem = {
      ticker: sym,
      name: `${sym} Custom Target`,
      price: 150.00,
      change1D: 0.50,
      volVs20D: "+105%",
      volSurge: false,
      netDelta: "+55% Order Flow",
      isDeltaBullish: true,
      oiNearestStrike: `$${(150.00).toFixed(2)} Magnet`,
      trend13F: "Accumulating",
    };
    setItems((prev) => [newItem, ...prev]);
    setNewSymbolInput("");
    onSelectTicker(sym);
  };

  const filteredItems = items.filter(
    (item) =>
      item.ticker.toLowerCase().includes(filterText.toLowerCase()) ||
      item.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="bg-[#0b0b13] border border-[#1e1e2f] rounded-lg p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b1b2a] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#00e5ff] font-mono font-bold text-sm">MODULE 5</span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Multi-Asset Watchlist with Order Flow Context
            </h2>
          </div>
          <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
            Real-time Volume vs 20D Avg · Net Option Delta % · Gamma Magnet Strikes · 13F Trends
          </p>
        </div>

        {/* Search & Add Ticker Controls */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter watchlist..."
            className="bg-[#0d0d16] border border-[#1e1e2f] text-xs font-mono px-3 py-1.5 rounded text-white focus:outline-none focus:border-[#00e5ff] w-36 uppercase"
          />
          <form onSubmit={handleAddSymbol} className="flex items-center gap-1">
            <input
              type="text"
              value={newSymbolInput}
              onChange={(e) => setNewSymbolInput(e.target.value)}
              placeholder="+ Add Symbol"
              className="bg-[#0d0d16] border border-[#1e1e2f] text-xs font-mono px-2.5 py-1.5 rounded text-white focus:outline-none focus:border-[#00ff88] w-28 uppercase"
            />
            <button
              type="submit"
              className="bg-[#00ff88]/10 border border-[#00ff88]/30 hover:bg-[#00ff88]/20 text-[#00ff88] text-xs font-mono px-2.5 py-1.5 rounded font-bold transition-colors"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-neutral-400 border-b border-[#1d1d2f] bg-[#090910]">
              <th className="py-2.5 px-3">Ticker</th>
              <th className="py-2.5 px-3 text-right">Price</th>
              <th className="py-2.5 px-3 text-right">1D Change</th>
              <th className="py-2.5 px-3 text-right">Vol vs 20D Avg</th>
              <th className="py-2.5 px-3 text-right">Net Delta Flow</th>
              <th className="py-2.5 px-3">OI-Weighted Nearest Strike (Gamma Magnet)</th>
              <th className="py-2.5 px-3 text-right">13F Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151524] text-xs">
            {filteredItems.map((item) => {
              const isActive = activeTicker.toUpperCase() === item.ticker.toUpperCase();
              const isPos = item.change1D >= 0;

              return (
                <tr
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className={`cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#141424] border-l-2 border-l-[#00e5ff]"
                      : "hover:bg-[#11111d]"
                  }`}
                >
                  {/* Ticker & Name */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isActive ? "bg-[#00e5ff] animate-pulse" : "bg-neutral-600"
                        }`}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">{item.ticker}</span>
                        <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">
                          {item.name}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-3 text-right font-bold text-white text-sm">
                    ${item.price.toFixed(2)}
                  </td>

                  {/* 1D Change */}
                  <td className="py-3 px-3 text-right font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        isPos
                          ? "text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/30"
                          : "text-rose-400 bg-rose-500/10 border border-rose-500/30"
                      }`}
                    >
                      {isPos ? "+" : ""}
                      {item.change1D.toFixed(2)}%
                    </span>
                  </td>

                  {/* Vol vs 20D Avg */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-bold text-neutral-200">{item.volVs20D}</span>
                      {item.volSurge && (
                        <span className="text-[9px] font-bold text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30 px-1 py-0.5 rounded uppercase tracking-wider" title="Volume Surge Active">
                          SURGE
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Net Delta Flow */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`font-bold ${
                        item.isDeltaBullish ? "text-[#00ff88]" : "text-rose-400"
                      }`}
                    >
                      {item.netDelta}
                    </span>
                  </td>

                  {/* OI Nearest Strike */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]" />
                      <span className="text-neutral-200 text-xs font-semibold">
                        {item.oiNearestStrike}
                      </span>
                    </div>
                  </td>

                  {/* 13F Trend */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        item.trend13F === "Accumulating"
                          ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
                          : item.trend13F === "Distributing"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-neutral-800 text-neutral-300 border-neutral-700"
                      }`}
                    >
                      {item.trend13F}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

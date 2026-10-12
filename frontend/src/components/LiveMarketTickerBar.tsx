"use client";

import React, { useState, useEffect } from "react";

interface TickerAsset {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  lastTickDir?: "up" | "down" | null;
}

const INITIAL_ASSETS: TickerAsset[] = [
  { symbol: "SPY", name: "S&P 500", price: 761.22, changePct: -0.42 },
  { symbol: "QQQ", name: "Nasdaq 100", price: 709.84, changePct: -0.71 },
  { symbol: "IWM", name: "Russell 2000", price: 288.23, changePct: -0.23 },
  { symbol: "NVDA", name: "NVIDIA Corp", price: 211.71, changePct: -3.00 },
  { symbol: "AAPL", name: "Apple Inc", price: 334.23, changePct: 0.51 },
  { symbol: "MSFT", name: "Microsoft Corp", price: 505.33, changePct: 2.11 },
  { symbol: "DXY", name: "US Dollar Index", price: 99.56, changePct: 0.24 },
  { symbol: "VIX", name: "CBOE Volatility", price: 17.20, changePct: 8.58 },
  { symbol: "TNX", name: "10Y Treasury Yield", price: 4.97, changePct: 0.00 },
  { symbol: "GOLD", name: "Spot Gold ($/oz)", price: 4325.30, changePct: -1.04 },
  { symbol: "CL1!", name: "WTI Crude Oil", price: 103.79, changePct: 0.52 },
  { symbol: "BTC/USD", name: "Bitcoin", price: 78422.50, changePct: 2.11 },
  { symbol: "EUR/USD", name: "Euro FX", price: 1.1620, changePct: 0.00 },
];

export default function LiveMarketTickerBar({
  onSelectTicker,
}: {
  onSelectTicker: (symbol: string) => void;
}) {
  const [assets, setAssets] = useState<TickerAsset[]>(INITIAL_ASSETS);

  // Live price tick simulation to trigger subtle blink animation
  useEffect(() => {
    const interval = setInterval(() => {
      setAssets((prev) =>
        prev.map((item) => {
          if (Math.random() > 0.4) {
            const delta = (Math.random() - 0.49) * (item.price * 0.001);
            const newPrice = Number((item.price + delta).toFixed(item.price < 10 ? 4 : 2));
            const tickDir = newPrice >= item.price ? "up" : "down";
            return {
              ...item,
              price: newPrice,
              lastTickDir: tickDir,
            };
          }
          return { ...item, lastTickDir: null };
        })
      );
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#060609]/95 backdrop-blur-md border-t border-[#1c1c2e] px-3 py-1.5 flex items-center overflow-hidden font-mono shadow-2xl">
      {/* Pinned Label */}
      <div className="shrink-0 flex items-center gap-2 pr-4 border-r border-[#1c1c2e] mr-3 z-10 bg-[#060609]">
        <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
        <span className="text-[10px] font-bold text-[#00ff88] tracking-widest uppercase">
          MARKET TICKER
        </span>
      </div>

      {/* Ticker Scrolling Track */}
      <div className="flex-1 overflow-hidden relative">
        <div className="animate-marquee flex items-center gap-6 text-xs font-mono">
          {[...assets, ...assets].map((item, idx) => {
            const isPos = item.changePct >= 0;
            const flashClass =
              item.lastTickDir === "up"
                ? "animate-tick-green"
                : item.lastTickDir === "down"
                ? "animate-tick-red"
                : "";

            return (
              <div
                key={`${item.symbol}-${idx}`}
                onClick={() => {
                  const cleanSym = item.symbol.split("/")[0].replace("1!", "");
                  onSelectTicker(cleanSym);
                }}
                className={`flex items-center gap-2 cursor-pointer hover:bg-[#151525] px-2 py-0.5 rounded transition-all ${flashClass}`}
              >
                <span className="font-bold text-white uppercase">{item.symbol}</span>
                <span className="text-neutral-300 font-semibold">
                  {item.price < 10 ? item.price.toFixed(4) : item.price.toFixed(2)}
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    isPos ? "text-[#00ff88]" : "text-rose-400"
                  }`}
                >
                  {isPos ? "+" : ""}
                  {item.changePct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

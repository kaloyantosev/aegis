"use client";

import React, { useState, useEffect, useRef } from "react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
}

const PRESET_SYMBOLS = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", category: "Index ETF", trend: "+0.45%" },
  { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", category: "Index ETF", trend: "+0.82%" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", category: "Index ETF", trend: "-0.15%" },
  { symbol: "NVDA", name: "NVIDIA Corporation", category: "Mega Cap Tech", trend: "+2.40%" },
  { symbol: "AAPL", name: "Apple Inc.", category: "Mega Cap Tech", trend: "+0.35%" },
  { symbol: "MSFT", name: "Microsoft Corporation", category: "Mega Cap Tech", trend: "+1.10%" },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "Mega Cap Tech", trend: "+0.95%" },
  { symbol: "META", name: "Meta Platforms Inc.", category: "Mega Cap Tech", trend: "+1.85%" },
  { symbol: "TSLA", name: "Tesla Inc.", category: "Automotive / EV", trend: "-1.20%" },
  { symbol: "SMCI", name: "Super Micro Computer Inc.", category: "AI Hardware", trend: "+4.15%" },
  { symbol: "ES1!", name: "E-mini S&P 500 Futures", category: "Futures", trend: "+0.50%" },
  { symbol: "NQ1!", name: "E-mini Nasdaq 100 Futures", category: "Futures", trend: "+0.88%" },
  { symbol: "XLK", name: "Technology Select Sector SPDR", category: "GICS Sector", trend: "+1.35%" },
  { symbol: "XLF", name: "Financial Select Sector SPDR", category: "GICS Sector", trend: "+0.40%" },
  { symbol: "XLE", name: "Energy Select Sector SPDR", category: "GICS Sector", trend: "-0.90%" },
];

export default function CommandPalette({ isOpen, onClose, onSelectSymbol }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          setSelectedIndex(0);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = PRESET_SYMBOLS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(query.toLowerCase()) ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDownModal = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectSymbol(filtered[selectedIndex].symbol);
        onClose();
      } else if (query.trim()) {
        onSelectSymbol(query.trim().toUpperCase());
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div
        className="bg-[#0b0b12] border border-[#222234] rounded-lg w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
        onKeyDown={handleKeyDownModal}
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-[#1d1d2d] flex items-center gap-3">
          <svg className="w-5 h-5 text-[#00e5ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a ticker symbol or asset name..."
            className="w-full bg-transparent text-sm font-mono text-white placeholder-neutral-500 focus:outline-none uppercase"
          />
          <button
            onClick={onClose}
            className="px-2 py-0.5 text-[10px] font-mono text-neutral-400 bg-[#161624] border border-[#27273c] rounded hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#151522]">
          {filtered.length === 0 ? (
            <div
              onClick={() => {
                if (query.trim()) {
                  onSelectSymbol(query.trim().toUpperCase());
                  onClose();
                }
              }}
              className="p-4 text-center cursor-pointer hover:bg-[#131320] rounded text-xs font-mono text-neutral-400"
            >
              Analyze custom symbol <span className="text-[#00ff88] font-bold">"{query.toUpperCase()}"</span> (Press Enter)
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isPositive = item.trend.startsWith("+");
              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    onSelectSymbol(item.symbol);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-all ${
                    isSelected ? "bg-[#141424] border border-[#00e5ff]/40" : "hover:bg-[#11111d] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-[#00ff88] tracking-wider w-16">
                      {item.symbol}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-200">{item.name}</span>
                      <span className="text-[10px] font-mono text-neutral-500">{item.category}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold ${isPositive ? "text-[#00ff88]" : "text-rose-400"}`}>
                    {item.trend}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-2.5 bg-[#08080f] border-t border-[#1a1a2b] flex items-center justify-between text-[10px] font-mono text-neutral-500">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span className="text-[#00e5ff]">TrueCharts Command Engine v2.4</span>
        </div>
      </div>
    </div>
  );
}

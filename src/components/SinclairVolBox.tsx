"use client";

import React from "react";

export interface SinclairVolatility {
  rv_yang_zhang: number;
  implied_volatility: number;
  vrp_spread: number;
  vrp_pct: number;
  iv_rank: number;
  ivts: number;
  term_structure_regime: string;
  skew_slope: number;
  skew_bias: string;
  weekly_expected_move_dollars?: number;
  weekly_expected_move_pct?: number;
  regime_verdict: string;
  vol_edge: string;
}

interface Props {
  volData?: SinclairVolatility;
  spot?: number;
  ticker?: string;
}

export default function SinclairVolBox({ volData, spot, ticker }: Props) {
  if (!volData) {
    return null;
  }

  const relPct = volData.vrp_pct !== undefined ? volData.vrp_pct : ((volData.vrp_spread / (volData.rv_yang_zhang || 15)) * 100);
  const isChop = relPct >= 15.0 || volData.vrp_spread >= 2.5;
  const isTrend = relPct <= -12.0 || volData.vrp_spread <= -2.0;
  const isStress = volData.ivts > 1.05 || volData.term_structure_regime.toLowerCase().includes("backwardation");

  let simpleRegime = "Neutral";
  let badgeColor = "bg-slate-500/10 border-slate-500/30 text-slate-300";
  if (isStress) {
    simpleRegime = "Event Shock";
    badgeColor = "bg-rose-500/10 border-rose-500/30 text-rose-400";
  } else if (isChop) {
    simpleRegime = "Range-Bound (Chop)";
    badgeColor = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
  } else if (isTrend) {
    simpleRegime = "Trend (Breakout)";
    badgeColor = "bg-sky-500/10 border-sky-500/30 text-sky-400";
  }

  const vrpLabel = isChop ? "Chop" : (isTrend ? "Trend" : "Neutral");
  const vrpColor = isChop ? "text-[#00ff88]" : (isTrend ? "text-sky-400" : "text-neutral-300");

  let simpleTerm = "Flat";
  let termColor = "text-purple-400";
  if (isStress) {
    simpleTerm = "Stress";
    termColor = "text-rose-400";
  } else if (volData.ivts < 0.95 || volData.term_structure_regime.toLowerCase().includes("contango")) {
    simpleTerm = "Normal";
    termColor = "text-emerald-400";
  }

  return (
    <div className="bg-[#0b0b13] border border-[#1e1e2f] rounded-lg p-4 font-mono shadow-lg flex flex-col gap-3">
      {/* Top Banner: Regime Verdict & Weekly Move */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#181827] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse" />
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            Sinclair Volatility Regime
          </span>
          {volData.weekly_expected_move_dollars && (
            <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 font-bold ml-1">
              Weekly Move: ±${volData.weekly_expected_move_dollars.toFixed(2)} ({volData.weekly_expected_move_pct}%)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}>
            {simpleRegime}
          </span>
          <span className="text-[10px] text-neutral-400 bg-[#12121e] px-2 py-0.5 rounded border border-[#232338]">
            {isChop ? "Fade Extremes (Buy Dips / Short Rips)" : (isTrend ? "Play Momentum (Buy Breakouts / Short Breaks)" : "Trade Levels")}
          </span>
        </div>
      </div>

      {/* Core 3-Column Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. IV vs Realized Vol (Yang-Zhang) */}
        <div className="bg-[#06060a] border border-[#181828] rounded p-2.5 flex flex-col justify-between">
          <span className="text-[10px] text-neutral-400 uppercase">Implied vs Realized (YZ)</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-black text-white">{volData.implied_volatility.toFixed(1)}%</span>
            <span className="text-xs text-neutral-400">IV</span>
            <span className="text-neutral-400 text-xs">/</span>
            <span className="text-base font-bold text-neutral-300">{volData.rv_yang_zhang.toFixed(1)}%</span>
            <span className="text-xs text-neutral-400">RV</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1">
            Yang-Zhang (30d Drift & Jump Adjusted)
          </span>
        </div>

        {/* 2. Variance Risk Premium (VRP Edge) */}
        <div className="bg-[#06060a] border border-[#181828] rounded p-2.5 flex flex-col justify-between">
          <span className="text-[10px] text-neutral-400 uppercase">Variance Risk Premium (VRP)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-base font-black ${vrpColor}`}>
              {volData.vrp_spread >= 0 ? `+${volData.vrp_spread.toFixed(1)}` : volData.vrp_spread.toFixed(1)}
            </span>
            <span className="text-xs text-neutral-400">pts</span>
            <span className={`text-xs font-bold ml-1 ${vrpColor}`}>
              ({vrpLabel})
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1">
            {isChop ? "Range Bound · Expect Choppy Reversals" : (isTrend ? "Coiled Spring · Expect Directional Breakouts" : "Fair Price Movement")}
          </span>
        </div>

        {/* 3. Term Structure & Skew */}
        <div className="bg-[#06060a] border border-[#181828] rounded p-2.5 flex flex-col justify-between">
          <span className="text-[10px] text-neutral-400 uppercase">Term Structure & Skew</span>
          <div className="flex items-baseline justify-between mt-1">
            <div>
              <span className="text-xs text-neutral-400">Term: </span>
              <span className={`text-xs font-bold ${termColor}`}>
                {simpleTerm}
              </span>
            </div>
            <div>
              <span className="text-xs text-neutral-400">IVR: </span>
              <span className="text-xs font-bold text-white">{volData.iv_rank}%</span>
            </div>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 truncate" title={volData.skew_bias}>
            Skew: {volData.skew_bias}
          </span>
        </div>
      </div>
    </div>
  );
}

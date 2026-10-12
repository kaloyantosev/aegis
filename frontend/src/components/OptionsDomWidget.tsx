"use client";

import React, { useState, useRef, useEffect } from "react";

export interface DomRow {
  strike: number;
  put_oi: number;
  call_oi: number;
  call_vol?: number;
  put_vol?: number;
  put_bar_pct: number;
  call_bar_pct: number;
  put_0dte_pct: number;
  call_0dte_pct: number;
  put_0dte_oi: number;
  call_0dte_oi: number;
  is_spot: boolean;
}

export interface SinclairStats {
  vrp_spread: number;
  weekly_expected_move_dollars: number;
  implied_volatility: number;
  rv_yang_zhang: number;
}

interface OptionsDomWidgetProps {
  ticker: string;
  sinclair?: SinclairStats;
  domData?: {
    "0dte": DomRow[];
    weekly: DomRow[];
  };
  spot: number;
}

// Vibrancy helper directly from tv_automation.py injector lines 503-526
function getPutStyle(pct: number) {
  if (!pct || pct <= 0) return { bg: "transparent", text: "#64748b", barBorder: "", textWeight: "600", glow: "" };
  if (pct < 20) {
    return { bg: "rgba(16,185,129,0.14)", text: "#a7f3d0", barBorder: "", textWeight: "bold", glow: "" };
  } else if (pct < 50) {
    return { bg: "rgba(16,185,129,0.38)", text: "#34d399", barBorder: "", textWeight: "bold", glow: "" };
  } else if (pct < 80) {
    return { bg: "rgba(16,185,129,0.65)", text: "#ffffff", barBorder: "", textWeight: "900", glow: "" };
  } else {
    return { bg: "rgba(16,185,129,0.90)", text: "#ffffff", barBorder: "", textWeight: "900", glow: "" };
  }
}

function getCallStyle(pct: number) {
  if (!pct || pct <= 0) return { bg: "transparent", text: "#64748b", barBorder: "", textWeight: "600", glow: "" };
  if (pct < 20) {
    return { bg: "rgba(239,68,68,0.14)", text: "#fecaca", barBorder: "", textWeight: "bold", glow: "" };
  } else if (pct < 50) {
    return { bg: "rgba(239,68,68,0.38)", text: "#f87171", barBorder: "", textWeight: "bold", glow: "" };
  } else if (pct < 80) {
    return { bg: "rgba(239,68,68,0.65)", text: "#ffffff", barBorder: "", textWeight: "900", glow: "" };
  } else {
    return { bg: "rgba(239,68,68,0.90)", text: "#ffffff", barBorder: "", textWeight: "900", glow: "" };
  }
}

export default function OptionsDomWidget({
  ticker,
  sinclair,
  domData,
  spot,
}: OptionsDomWidgetProps) {
  const [mode, setMode] = useState<"0dte" | "weekly">("weekly");
  const spotRef = useRef<HTMLDivElement>(null);

  const isWeekly = mode === "weekly";
  const ladder = domData?.[mode] || [];

  // Auto-scroll spot strike to center of ladder on data/mode change
  useEffect(() => {
    if (spotRef.current) {
      spotRef.current.scrollIntoView({ block: "center" });
    }
  }, [ladder, mode]);

  // Sinclair metrics extraction matching tv_automation.py lines 548-558
  let vrpVal = "—";
  let vrpColor = "#94a3b8";
  let rangeVal = "±1σ";
  let ivVal = "—";
  let rvVal = "—";

  if (sinclair) {
    const vrpSpread = parseFloat(sinclair.vrp_spread as any) || 0.0;
    const vrpSign = vrpSpread >= 0 ? "+" : "";
    vrpVal = `${vrpSign}${vrpSpread.toFixed(1)}`;
    vrpColor = vrpSpread >= 0 ? "#10b981" : "#38bdf8";
    ivVal = parseFloat(sinclair.implied_volatility as any) ? `${parseFloat(sinclair.implied_volatility as any).toFixed(1)}%` : "—";
    rvVal = parseFloat(sinclair.rv_yang_zhang as any) ? `${parseFloat(sinclair.rv_yang_zhang as any).toFixed(1)}%` : "—";
    rangeVal = sinclair.weekly_expected_move_dollars ? `±$${parseFloat(sinclair.weekly_expected_move_dollars as any).toFixed(2)}` : "±1σ";
  }

  return (
    <div
      id="tc-options-dom"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
        color: "#f8fafc",
        fontFamily: "Consolas, monospace",
        fontSize: "10.5px",
        lineHeight: 1.3,
        userSelect: "none",
        overflow: "hidden",
      }}
      className="flex flex-col h-full"
    >
      {/* 1. Sinclair Metrics mounted directly on top of DOM (Exact HTML from tv_automation.py lines 561-579) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "7px", fontSize: "10px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(15,23,42,0.7)", padding: "4px 7px", borderRadius: "3px", border: "1px solid #1e293b" }}>
          <span style={{ color: "#94a3b8" }}>VRP:</span>
          <span style={{ color: vrpColor, fontWeight: "bold" }}>{vrpVal}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(15,23,42,0.7)", padding: "4px 7px", borderRadius: "3px", border: "1px solid #1e293b" }}>
          <span style={{ color: "#94a3b8" }}>Range:</span>
          <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{rangeVal}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(15,23,42,0.7)", padding: "4px 7px", borderRadius: "3px", border: "1px solid #1e293b" }}>
          <span style={{ color: "#94a3b8" }}>IV:</span>
          <span style={{ color: "#fff", fontWeight: "bold" }}>{ivVal}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(15,23,42,0.7)", padding: "4px 7px", borderRadius: "3px", border: "1px solid #1e293b" }}>
          <span style={{ color: "#94a3b8" }}>RV:</span>
          <span style={{ color: "#fff", fontWeight: "bold" }}>{rvVal}</span>
        </div>
      </div>

      {/* 2. TITLE ROW WITH 0DTE / WEEKLY TOGGLE (NO LIVE TEXT) (tv_automation.py lines 680-690) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
          borderTop: "1px solid #1e293b",
          borderBottom: "1px solid #1e293b",
          padding: "5px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: 900, color: "#14b8a6", fontSize: "12px", letterSpacing: "0.5px" }}>📊 DOM</span>
          {/* 0DTE vs Weekly Pill */}
          <div
            id="tc-dom-mode-pill"
            style={{
              display: "inline-flex",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "2px",
              fontSize: "9.5px",
              fontWeight: "bold",
            }}
          >
            <button
              id="tc-btn-0dte"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode("0dte");
              }}
              style={{
                border: "none",
                outline: "none",
                padding: "2px 8px",
                borderRadius: "10px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
                transition: "all 0.15s",
                background: mode === "0dte" ? "#0d9488" : "transparent",
                color: mode === "0dte" ? "#fff" : "#64748b",
                boxShadow: mode === "0dte" ? "0 0 6px rgba(13,148,136,0.6)" : "none",
              }}
            >
              0DTE
            </button>
            <button
              id="tc-btn-weekly"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode("weekly");
              }}
              style={{
                border: "none",
                outline: "none",
                padding: "2px 8px",
                borderRadius: "10px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
                transition: "all 0.15s",
                background: mode === "weekly" ? "#0d9488" : "transparent",
                color: mode === "weekly" ? "#fff" : "#64748b",
                boxShadow: mode === "weekly" ? "0 0 6px rgba(13,148,136,0.6)" : "none",
              }}
            >
              Weekly
            </button>
          </div>
        </div>
        <span style={{ fontWeight: "bold", color: "#fff", background: "#1e293b", padding: "2px 6px", borderRadius: "3px", fontSize: "10px", border: "1px solid #334155" }}>
          {ticker}
        </span>
      </div>

      {/* 3. COLUMN HEADERS (tv_automation.py lines 692-696) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 1fr", fontSize: "10px", color: "#94a3b8", marginBottom: "3px", fontWeight: "bold" }}>
        <span style={{ color: "#10b981", textAlign: "left", paddingLeft: "6px" }}>PUT OI</span>
        <span style={{ color: "#cbd5e1", textAlign: "center" }}>STRIKE</span>
        <span style={{ color: "#ef4444", textAlign: "right", paddingRight: "6px" }}>CALL OI</span>
      </div>

      {/* 4. ROWS (Exact row rendering loop matching tv_automation.py lines 614-672) */}
      <div
        className="flex-1 overflow-y-auto flex flex-col pr-0.5"
        style={{ display: "flex", flexDirection: "column", overflowY: "auto", flex: "1 1 0%", minHeight: 0 }}
      >
        {ladder.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: "10px", textAlign: "center", padding: "12px 0" }}>
            Real options chain not available for {ticker}.
          </div>
        ) : (
          ladder.map((row) => {
            const isSpot = row.is_spot || Math.abs(row.strike - spot) < 0.5;
            const spotStyle: React.CSSProperties = isSpot
              ? {
                  background: "rgba(56,189,248,0.22)",
                  border: "1px solid rgba(56,189,248,0.65)",
                  borderRadius: "3px",
                }
              : {};
            const strikeColor = isSpot ? "#38bdf8" : "#e2e8f0";
            const strikeWeight = isSpot ? 900 : "bold";

            const putW = row.put_bar_pct || 0;
            const callW = row.call_bar_pct || 0;
            const put0dteW = isWeekly && row.put_0dte_pct ? row.put_0dte_pct : 0;
            const call0dteW = isWeekly && row.call_0dte_pct ? row.call_0dte_pct : 0;

            const putK = row.put_oi ? (row.put_oi >= 1000 ? (row.put_oi / 1000).toFixed(1) + "k" : String(row.put_oi)) : "";
            const callK = row.call_oi ? (row.call_oi >= 1000 ? (row.call_oi / 1000).toFixed(1) + "k" : String(row.call_oi)) : "";

            const pStyle = getPutStyle(putW);
            const cStyle = getCallStyle(callW);

            // Predominant 0DTE (> 50% of the bar's volume / OI): yellow text for puts, purple text for calls (lines 630-639)
            const putIs0DtePredominant = isWeekly && Boolean((row.put_0dte_oi && row.put_oi && row.put_0dte_oi >= row.put_oi * 0.5) || (put0dteW > 0 && put0dteW >= putW * 0.5));
            const callIs0DtePredominant = isWeekly && Boolean((row.call_0dte_oi && row.call_oi && row.call_0dte_oi >= row.call_oi * 0.5) || (call0dteW > 0 && call0dteW >= callW * 0.5));

            const putTextColor = putIs0DtePredominant ? "#facc15" : pStyle.text;
            const putTextWeight = putIs0DtePredominant ? 900 : pStyle.textWeight === "900" ? 900 : "bold";
            const putTextShadow = putIs0DtePredominant ? "0 1px 2px #000, 0 0 5px rgba(250,204,21,0.6)" : "0 1px 2px #000";

            const callTextColor = callIs0DtePredominant ? "#c084fc" : cStyle.text;
            const callTextWeight = callIs0DtePredominant ? 900 : cStyle.textWeight === "900" ? 900 : "bold";
            const callTextShadow = callIs0DtePredominant ? "0 1px 2px #000, 0 0 5px rgba(192,132,252,0.6)" : "0 1px 2px #000";

            return (
              <div
                key={row.strike}
                ref={isSpot ? spotRef : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 64px 1fr",
                  alignItems: "center",
                  height: "20px",
                  margin: "1px 0",
                  fontSize: "11px",
                  ...spotStyle,
                }}
              >
                {/* PUT BID BAR (Text at outer left end of bar, lines 656-660) */}
                <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: "6px" }}>
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "1.5px",
                      bottom: "1.5px",
                      width: `${putW}%`,
                      background: pStyle.bg,
                      borderRadius: "2px",
                      zIndex: 1,
                    }}
                  />
                  {put0dteW > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "1.5px",
                        bottom: "1.5px",
                        width: `${put0dteW}%`,
                        background: "rgba(250,204,21,0.88)",
                        borderRadius: "2px",
                        borderLeft: "1.5px solid #fef08a",
                        boxShadow: "0 0 5px rgba(250,204,21,0.4)",
                        zIndex: 2,
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: "relative",
                      color: putTextColor,
                      fontWeight: putTextWeight as any,
                      fontSize: "11px",
                      fontFamily: "Consolas, monospace",
                      textShadow: putTextShadow,
                      zIndex: 3,
                    }}
                  >
                    {putK}
                  </span>
                </div>

                {/* STRIKE (lines 662-664) */}
                <div
                  style={{
                    textAlign: "center",
                    color: strikeColor,
                    fontWeight: strikeWeight as any,
                    fontFamily: "Consolas, monospace",
                    fontSize: "12px",
                    textShadow: "0 1px 2px #000",
                  }}
                >
                  ${parseFloat(row.strike as any).toFixed(1)}
                </div>

                {/* CALL ASK BAR (Text at outer right end of bar, lines 666-670) */}
                <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "6px" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "1.5px",
                      bottom: "1.5px",
                      width: `${callW}%`,
                      background: cStyle.bg,
                      borderRadius: "2px",
                      zIndex: 1,
                    }}
                  />
                  {call0dteW > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "1.5px",
                        bottom: "1.5px",
                        width: `${call0dteW}%`,
                        background: "rgba(192,132,252,0.88)",
                        borderRadius: "2px",
                        borderRight: "1.5px solid #e9d5ff",
                        boxShadow: "0 0 5px rgba(192,132,252,0.4)",
                        zIndex: 2,
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: "relative",
                      color: callTextColor,
                      fontWeight: callTextWeight as any,
                      fontSize: "11px",
                      fontFamily: "Consolas, monospace",
                      textShadow: callTextShadow,
                      zIndex: 3,
                    }}
                  >
                    {callK}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

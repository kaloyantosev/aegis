import { NextRequest, NextResponse } from "next/server";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DomRow {
  strike: number;
  put_oi: number;
  call_oi: number;
  put_0dte_oi: number;
  call_0dte_oi: number;
  put_bar_pct: number;
  call_bar_pct: number;
  put_0dte_pct: number;
  call_0dte_pct: number;
  is_spot: boolean;
}

export interface LevelItem {
  price: number;
  title: string;
  color: string;
}

// In-memory cache for throttling
const cache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 25000; // 25s cache

// Cookie / Crumb storage for Yahoo Finance
let cachedCookie = "";
let cachedCrumb = "";
let crumbTimestamp = 0;

async function getYahooCrumb(): Promise<{ cookie: string; crumb: string }> {
  const now = Date.now();
  if (cachedCookie && cachedCrumb && now - crumbTimestamp < 3600000) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  try {
    const resCookie = await fetch("https://fc.yahoo.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const setCookie = resCookie.headers.get("set-cookie");
    const cookieHeader = setCookie ? setCookie.split(";")[0] : "";

    const resCrumb = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: cookieHeader,
      },
    });
    const crumb = (await resCrumb.text()).trim();

    if (crumb && !crumb.includes("html") && !crumb.includes("Error")) {
      cachedCookie = cookieHeader;
      cachedCrumb = crumb;
      crumbTimestamp = now;
      return { cookie: cookieHeader, crumb };
    }
  } catch (err) {
    console.error("Failed to get Yahoo crumb:", err);
  }

  return { cookie: "", crumb: "" };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "SPY").toUpperCase().trim();
  const timeframe = searchParams.get("timeframe") || "15m";

  const cacheKey = `${ticker}_${timeframe}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    // 1. Fetch Real Candle History from Yahoo Finance Chart API
    let interval = "15m";
    let range = "5d";
    if (timeframe === "5m") {
      interval = "5m";
      range = "2d";
    } else if (timeframe === "15m") {
      interval = "15m";
      range = "5d";
    } else if (timeframe === "1h") {
      interval = "60m";
      range = "1mo";
    } else if (timeframe === "1D" || timeframe === "D" || timeframe === "Daily") {
      interval = "1d";
      range = "1y";
    }

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
    const chartRes = await fetch(chartUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 25 },
    });

    let candles: Candle[] = [];
    let spotPrice = 0;

    if (chartRes.ok) {
      const chartJson = await chartRes.json();
      const result = chartJson.chart?.result?.[0];
      if (result) {
        spotPrice = Number(result.meta?.regularMarketPrice || 0);
        const timestamps: number[] = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};
        const opens = quote.open || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const closes = quote.close || [];
        const volumes = quote.volume || [];

        for (let i = 0; i < timestamps.length; i++) {
          const o = opens[i];
          const h = highs[i];
          const l = lows[i];
          const c = closes[i];
          if (o !== null && h !== null && l !== null && c !== null && !isNaN(c)) {
            candles.push({
              time: timestamps[i],
              open: Number(o.toFixed(2)),
              high: Number(h.toFixed(2)),
              low: Number(l.toFixed(2)),
              close: Number(c.toFixed(2)),
              volume: Number(volumes[i] || 0),
            });
          }
        }
      }
    }

    // Strictly sort ascending and deduplicate timestamps for lightweight-charts
    candles.sort((a, b) => a.time - b.time);
    const uniqueCandles: Candle[] = [];
    let lastTime = 0;
    for (const c of candles) {
      if (c.time > lastTime) {
        uniqueCandles.push(c);
        lastTime = c.time;
      }
    }
    candles = uniqueCandles;

    if (spotPrice <= 0 && candles.length > 0) {
      spotPrice = candles[candles.length - 1].close;
    }
    if (spotPrice <= 0) {
      spotPrice = ticker === "QQQ" ? 758.0 : 777.0;
    }

    // 2. Fetch Institutional Options Model & Technical Levels
    // Checks localhost:8000 first (if active), then remote Render backend (matching tv_automation.py lines 1004-1022)
    let levelsData: any = null;
    const endpointsToTry = [
      `http://localhost:8000/api/analyze/${encodeURIComponent(ticker)}`,
      `https://truecharts.onrender.com/api/analyze/${encodeURIComponent(ticker)}`,
    ];

    for (const ep of endpointsToTry) {
      try {
        const timeoutMs = ep.includes("localhost") ? 1500 : 8000;
        const r = await fetch(ep, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (r.ok) {
          levelsData = await r.json();
          if (levelsData) break;
        }
      } catch (e) {
        // Continue to fallback endpoint
      }
    }

    // 3. Fetch Real Options Chain and construct EXACT ladder matching fetch_real_weekly_dom in tv_automation.py
    const { cookie, crumb } = await getYahooCrumb();
    let by_strike_0dte: Record<number, { strike: number; call_oi: number; put_oi: number; call_vol: number; put_vol: number }> = {};
    let by_strike_weekly: Record<number, { strike: number; call_oi: number; put_oi: number; call_vol: number; put_vol: number }> = {};

    if (crumb) {
      try {
        const optBaseUrl = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?crumb=${encodeURIComponent(crumb)}`;
        const baseRes = await fetch(optBaseUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Cookie: cookie,
          },
          signal: AbortSignal.timeout(6000),
        });

        if (baseRes.ok) {
          const baseJson = await baseRes.json();
          const chainRes = baseJson.optionChain?.result?.[0];
          const exps: number[] = chainRes?.expirationDates || [];

          // Expiration 0 (nearest, 0DTE / next session)
          const opt0 = chainRes?.options?.[0];
          if (opt0) {
            (opt0.calls || []).forEach((c: any) => {
              const k = Number(c.strike);
              const oi = parseInt(c.openInterest) || 0;
              const vol = parseInt(c.volume) || 0;
              by_strike_0dte[k] = by_strike_0dte[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_0dte[k].call_oi += oi;
              by_strike_0dte[k].call_vol += vol;
            });
            (opt0.puts || []).forEach((p: any) => {
              const k = Number(p.strike);
              const oi = parseInt(p.openInterest) || 0;
              const vol = parseInt(p.volume) || 0;
              by_strike_0dte[k] = by_strike_0dte[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_0dte[k].put_oi += oi;
              by_strike_0dte[k].put_vol += vol;
            });
          }

          // Gather nearest weekly expirations (<= 7 DTE) matching python tv_automation.py
          const today = new Date();
          const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

          // Include Exp 0 into weekly total
          if (opt0) {
            (opt0.calls || []).forEach((c: any) => {
              const k = Number(c.strike);
              const oi = parseInt(c.openInterest) || 0;
              const vol = parseInt(c.volume) || 0;
              by_strike_weekly[k] = by_strike_weekly[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_weekly[k].call_oi += oi;
              by_strike_weekly[k].call_vol += vol;
            });
            (opt0.puts || []).forEach((p: any) => {
              const k = Number(p.strike);
              const oi = parseInt(p.openInterest) || 0;
              const vol = parseInt(p.volume) || 0;
              by_strike_weekly[k] = by_strike_weekly[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
              by_strike_weekly[k].put_oi += oi;
              by_strike_weekly[k].put_vol += vol;
            });
          }

          // Fetch remaining dates within 7 DTE
          const remainingExps = exps.slice(1).filter((expTs) => {
            const expDate = new Date(expTs * 1000);
            const expDateOnly = new Date(Date.UTC(expDate.getUTCFullYear(), expDate.getUTCMonth(), expDate.getUTCDate()));
            const dte = Math.round((expDateOnly.getTime() - todayDateOnly.getTime()) / (1000 * 3600 * 24));
            return dte <= 7;
          });

          await Promise.all(
            remainingExps.map(async (exp) => {
              try {
                const subUrl = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?date=${exp}&crumb=${encodeURIComponent(crumb)}`;
                const subRes = await fetch(subUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Cookie: cookie,
                  },
                  signal: AbortSignal.timeout(4000),
                });
                if (subRes.ok) {
                  const subJson = await subRes.json();
                  const subOpt = subJson.optionChain?.result?.[0]?.options?.[0];
                  if (subOpt) {
                    (subOpt.calls || []).forEach((c: any) => {
                      const k = Number(c.strike);
                      const oi = parseInt(c.openInterest) || 0;
                      const vol = parseInt(c.volume) || 0;
                      by_strike_weekly[k] = by_strike_weekly[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
                      by_strike_weekly[k].call_oi += oi;
                      by_strike_weekly[k].call_vol += vol;
                    });
                    (subOpt.puts || []).forEach((p: any) => {
                      const k = Number(p.strike);
                      const oi = parseInt(p.openInterest) || 0;
                      const vol = parseInt(p.volume) || 0;
                      by_strike_weekly[k] = by_strike_weekly[k] || { strike: k, call_oi: 0, put_oi: 0, call_vol: 0, put_vol: 0 };
                      by_strike_weekly[k].put_oi += oi;
                      by_strike_weekly[k].put_vol += vol;
                    });
                  }
                }
              } catch (e) {}
            })
          );
        }
      } catch (err) {
        console.error(`Error fetching real options chain for ${ticker}:`, err);
      }
    }

    // Find real major options open interest walls directly from chain
    let realCallWallStrike = 0;
    let realMaxCallOI = 0;
    let realPutWallStrike = 0;
    let realMaxPutOI = 0;
    for (const [kStr, s] of Object.entries(by_strike_weekly)) {
      const k = Number(kStr);
      if (s.call_oi > realMaxCallOI) {
        realMaxCallOI = s.call_oi;
        realCallWallStrike = k;
      }
      if (s.put_oi > realMaxPutOI) {
        realMaxPutOI = s.put_oi;
        realPutWallStrike = k;
      }
    }

    // Fallback options levels matching tv_automation.py lines 1032-1046
    const fallbackGammaFlip = Number((spotPrice * 0.9965).toFixed(2));
    const fallbackExpUp = Number((spotPrice * 1.018).toFixed(2));
    const fallbackExpDn = Number((spotPrice * 0.982).toFixed(2));
    const fallbackSupports = [
      {
        price: realPutWallStrike || Math.round((spotPrice - 9) / 5) * 5,
        strength: 1.0,
        source: "options",
        is_confluence: true,
        sublabel: "PUT WALL + Support",
      },
    ];
    const fallbackResistances = [
      {
        price: realCallWallStrike || Math.round((spotPrice + 8) / 5) * 5,
        strength: 1.0,
        source: "options",
        is_confluence: false,
        has_surge: true,
        sublabel: "CALL WALL",
      },
    ];

    // 4. Sinclair metrics extraction (exact match to tv_automation.py lines 1039-1045)
    const sinclair_vol = levelsData?.sinclair_volatility || {};
    const sinclairPayload = {
      vrp_spread: sinclair_vol.vrp_spread !== undefined ? parseFloat(sinclair_vol.vrp_spread) : (ticker === "QQQ" ? 9.6 : 7.4),
      weekly_expected_move_dollars: sinclair_vol.weekly_expected_move_dollars !== undefined
        ? parseFloat(sinclair_vol.weekly_expected_move_dollars)
        : Number((spotPrice * 0.0245).toFixed(2)),
      implied_volatility: sinclair_vol.implied_volatility !== undefined
        ? parseFloat(sinclair_vol.implied_volatility)
        : (ticker === "QQQ" ? 23.4 : 17.4),
      rv_yang_zhang: sinclair_vol.rv_yang_zhang !== undefined
        ? parseFloat(sinclair_vol.rv_yang_zhang)
        : (ticker === "QQQ" ? 13.9 : 10.0),
    };

    // 5. Build Exact Levels matching tv_automation.py lines 1110-1308
    const rawItems: Array<{
      price: number;
      title: string;
      label: string;
      color: string;
      priority: number;
      dte_tag?: string;
      sublabel?: string;
      is_confluence?: boolean;
    }> = [];

    const todayDate = new Date();
    const todayStr = todayDate.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

    // Gamma Flip (Zero-GEX Regime Compass)
    const gammaFlipNum = Number(levelsData?.gamma_flip || fallbackGammaFlip);
    if (gammaFlipNum > 0) {
      rawItems.push({
        price: gammaFlipNum,
        title: "GAMMA FLIP",
        label: `GAMMA FLIP · $${gammaFlipNum.toFixed(2)} (EOD ${todayStr})`,
        color: "#facc15", // Yellow
        priority: 95,
      });
    }

    // Expected Move Envelope (+- 1-Standard Deviation)
    const emUpperNum = Number(levelsData?.expected_move?.upper || levelsData?.expected_move_upper || fallbackExpUp);
    const emLowerNum = Number(levelsData?.expected_move?.lower || levelsData?.expected_move_lower || fallbackExpDn);
    if (emUpperNum > 0 && emLowerNum > 0) {
      rawItems.push({
        price: emUpperNum,
        title: "+1σ EXP MOVE",
        label: `+1σ EXP MOVE · $${emUpperNum.toFixed(2)} (Weekly Upper 68% Band)`,
        color: "#38bdf8", // Light Cyan
        priority: 70,
      });
      rawItems.push({
        price: emLowerNum,
        title: "-1σ EXP MOVE",
        label: `-1σ EXP MOVE · $${emLowerNum.toFixed(2)} (Weekly Lower 68% Band)`,
        color: "#38bdf8", // Light Cyan
        priority: 70,
      });
    }

    // Resistances (Major Call Walls & Confluences)
    const resistancesList = levelsData?.resistances?.length ? levelsData.resistances : fallbackResistances;
    const maxResAbs = Math.max(...resistancesList.map((r: any) => Number(r.strength || 0)), 1.0);

    for (const res of resistancesList) {
      const p = Number(res.price || 0);
      const st = Number(res.strength || 0);
      const src = String(res.source || "").toLowerCase();
      const isConf = Boolean(res.is_confluence);
      const dteTag = res.dte ? `${res.dte}d DTE` : "";

      if (isConf) {
        const sub = res.sublabel || "Multi-Factor";
        const cleanSub = dteTag && !sub.includes(dteTag) ? `${dteTag} · ${sub}` : sub;
        rawItems.push({
          price: p,
          title: "CONFLUENCE",
          is_confluence: true,
          sublabel: cleanSub,
          label: `CONFLUENCE · $${p.toFixed(2)} [${cleanSub}]`,
          color: "#f97316", // Orange
          priority: 100,
        });
      } else if (src === "options" && (maxResAbs <= 0 || st / maxResAbs >= 0.70)) {
        const dPart = dteTag ? ` (${dteTag} · Gamma Ceiling)` : ` (Gamma Ceiling)`;
        rawItems.push({
          price: p,
          title: "CALL WALL",
          label: `CALL WALL · $${p.toFixed(2)}${dPart}`,
          color: "#dc2626", // Red
          priority: 85,
        });
      }
    }

    // Supports (Major Put Walls & Confluences)
    const supportsList = levelsData?.supports?.length ? levelsData.supports : fallbackSupports;
    const maxSupAbs = Math.max(...supportsList.map((s: any) => Number(s.strength || 0)), 1.0);

    for (const sup of supportsList) {
      const p = Number(sup.price || 0);
      const st = Number(sup.strength || 0);
      const src = String(sup.source || "").toLowerCase();
      const isConf = Boolean(sup.is_confluence);
      const dteTag = sup.dte ? `${sup.dte}d DTE` : "";

      if (isConf) {
        const sub = sup.sublabel || "Multi-Factor";
        const cleanSub = dteTag && !sub.includes(dteTag) ? `${dteTag} · ${sub}` : sub;
        rawItems.push({
          price: p,
          title: "CONFLUENCE",
          is_confluence: true,
          sublabel: cleanSub,
          label: `CONFLUENCE · $${p.toFixed(2)} [${cleanSub}]`,
          color: "#f97316", // Orange
          priority: 100,
        });
      } else if (src === "options" && (maxSupAbs <= 0 || st / maxSupAbs >= 0.70)) {
        const dPart = dteTag ? ` (${dteTag} · OI Absorption)` : ` (OI Absorption)`;
        rawItems.push({
          price: p,
          title: "PUT WALL",
          label: `PUT WALL · $${p.toFixed(2)}${dPart}`,
          color: "#047857", // Green
          priority: 85,
        });
      }
    }

    // Clustering & Deduplication Engine (exact match to tv_automation.py lines 1230-1308)
    const levelsToDraw: LevelItem[] = [];
    if (rawItems.length > 0) {
      rawItems.sort((a, b) => a.price - b.price);
      const clusters: Array<typeof rawItems> = [];
      let currCluster = [rawItems[0]];
      for (let i = 1; i < rawItems.length; i++) {
        const itm = rawItems[i];
        const prevP = currCluster[currCluster.length - 1].price;
        if (Math.abs(itm.price - prevP) <= Math.max(0.05, prevP * 0.002)) {
          currCluster.push(itm);
        } else {
          clusters.push(currCluster);
          currCluster = [itm];
        }
      }
      if (currCluster.length > 0) clusters.push(currCluster);

      for (const cl of clusters) {
        if (cl.length === 1) {
          levelsToDraw.push({
            price: cl[0].price,
            title: cl[0].label,
            color: cl[0].color,
          });
        } else {
          cl.sort((a, b) => b.priority - a.priority);
          const repPrice = cl[0].price;
          const factorList: string[] = [];
          for (const itm of cl) {
            const sub = itm.sublabel;
            const t = itm.title;
            if (itm.is_confluence && sub) {
              sub.split("+").forEach((p) => {
                const clean = p.trim();
                if (!factorList.includes(clean)) factorList.push(clean);
              });
            } else if (!factorList.includes(t)) {
              factorList.push(t);
            }
          }
          const finalFactors = factorList.filter((f) => !f.toLowerCase().includes("confluence"));
          const factorsStr = finalFactors.length ? finalFactors.join(" + ") : "Multi-Factor S/R";
          levelsToDraw.push({
            price: repPrice,
            title: `CONFLUENCE · $${repPrice.toFixed(2)} [${factorsStr}]`,
            color: "#f97316",
          });
        }
      }
    }

    // 6. Build DOM Ladders centered around current spot strike
    const buildLadder = (
      chainObj: Record<number, { strike: number; call_oi: number; put_oi: number }>,
      is_weekly: boolean,
      max_strikes = 34
    ): DomRow[] => {
      const allStrikes = Object.keys(chainObj)
        .map(Number)
        .sort((a, b) => a - b);
      if (allStrikes.length === 0) return [];

      let closest_idx = 0;
      let min_dist = 999999;
      allStrikes.forEach((k, idx) => {
        const d = Math.abs(k - spotPrice);
        if (d < min_dist) {
          min_dist = d;
          closest_idx = idx;
        }
      });

      const closest_strike = allStrikes[closest_idx];
      const half = Math.floor(max_strikes / 2);
      const start_idx = Math.max(0, closest_idx - half);
      const end_idx = Math.min(allStrikes.length, start_idx + max_strikes);
      const selected_strikes = allStrikes.slice(start_idx, end_idx);

      const selected = selected_strikes.map((k) => chainObj[k]);
      selected.sort((a, b) => b.strike - a.strike); // descending order

      const max_c = Math.max(...selected.map((s) => s.call_oi), 1);
      const max_p = Math.max(...selected.map((s) => s.put_oi), 1);

      const ladder: DomRow[] = [];
      for (const s of selected) {
        const k = s.strike;
        const c_pct = Math.min(100, Math.floor((s.call_oi / max_c) * 100));
        const p_pct = Math.min(100, Math.floor((s.put_oi / max_p) * 100));

        let p_0_pct = 0;
        let c_0_pct = 0;
        let p0 = 0;
        let c0 = 0;

        if (is_weekly) {
          const s0 = by_strike_0dte[k] || { put_oi: 0, call_oi: 0 };
          p0 = s0.put_oi || 0;
          c0 = s0.call_oi || 0;
          p_0_pct = max_p > 0 ? Math.min(p_pct, Math.floor((p0 / max_p) * 100)) : 0;
          c_0_pct = max_c > 0 ? Math.min(c_pct, Math.floor((c0 / max_c) * 100)) : 0;
        }

        ladder.push({
          strike: k,
          call_oi: s.call_oi,
          put_oi: s.put_oi,
          call_bar_pct: c_pct,
          put_bar_pct: p_pct,
          put_0dte_pct: p_0_pct,
          call_0dte_pct: c_0_pct,
          put_0dte_oi: p0,
          call_0dte_oi: c0,
          is_spot: k === closest_strike,
        });
      }
      return ladder;
    };

    const dom0dte = buildLadder(by_strike_0dte, false, 34);
    const domWeekly = buildLadder(by_strike_weekly, true, 34);

    const payload = {
      ticker,
      spot: spotPrice,
      timeframe,
      candles,
      levels: levelsToDraw,
      modelLevels: {
        gammaFlip: levelsToDraw.find((l) => l.title.includes("GAMMA FLIP")),
        expMoveUpper: levelsToDraw.find((l) => l.title.includes("+1σ EXP MOVE")),
        expMoveLower: levelsToDraw.find((l) => l.title.includes("-1σ EXP MOVE")),
        confluencePut: levelsToDraw.find((l) => l.title.includes("CONFLUENCE") || l.title.includes("PUT WALL")),
        confluenceCall: levelsToDraw.find((l) => l.title.includes("CALL WALL")),
      },
      sinclair: sinclairPayload,
      dom: {
        "0dte": dom0dte,
        weekly: domWeekly,
      },
      lastUpdated: new Date().toISOString(),
    };

    cache.set(cacheKey, { timestamp: now, data: payload });
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Trader Panel API error:", error);
    return NextResponse.json({ error: error.message || "Failed to load trader data" }, { status: 500 });
  }
}

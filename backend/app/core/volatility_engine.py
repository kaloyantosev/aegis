import math
from math import gamma
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional


# ─────────────────────────────────────────────────────────────
#  SECTION 1: REALIZED VOLATILITY ESTIMATORS
# ─────────────────────────────────────────────────────────────

def _yz_variance(df_sub: pd.DataFrame) -> float:
    """
    Core Yang-Zhang (2000) variance on a pre-sliced DataFrame subset.
    Returns annualized variance (not yet square-rooted).
    """
    o = df_sub['open'].values[1:]
    h = df_sub['high'].values[1:]
    l = df_sub['low'].values[1:]
    c = df_sub['close'].values[1:]
    c_prev = df_sub['close'].values[:-1]

    mask = (o > 0) & (h > 0) & (l > 0) & (c > 0) & (c_prev > 0) & (h >= l)
    o, h, l, c, c_prev = o[mask], h[mask], l[mask], c[mask], c_prev[mask]
    N = len(o)
    if N < 5:
        return 0.0

    log_oc = np.log(o / c_prev)
    mu_o = np.mean(log_oc)
    var_o = np.sum((log_oc - mu_o) ** 2) / (N - 1.0)

    log_co = np.log(c / o)
    mu_c = np.mean(log_co)
    var_c = np.sum((log_co - mu_c) ** 2) / (N - 1.0)

    log_hc = np.log(h / c)
    log_ho = np.log(h / o)
    log_lc = np.log(l / c)
    log_lo = np.log(l / o)
    var_rs = np.sum(log_hc * log_ho + log_lc * log_lo) / N

    k = 0.34 / (1.34 + (N + 1.0) / (N - 1.0))
    var_yz = var_o + k * var_c + (1.0 - k) * var_rs
    return max(var_yz, 0.0)


def _yz_ewma_variance(df_sub: pd.DataFrame, lam: float = 0.94) -> float:
    """
    EWMA-weighted Yang-Zhang variance (RiskMetrics λ=0.94 style).
    More recent days receive exponentially higher weight.
    Returns annualized variance.
    """
    # Need at least 2 rows to get 1 return
    if len(df_sub) < 3:
        return 0.0

    o = df_sub['open'].values[1:]
    h = df_sub['high'].values[1:]
    l = df_sub['low'].values[1:]
    c = df_sub['close'].values[1:]
    c_prev = df_sub['close'].values[:-1]

    mask = (o > 0) & (h > 0) & (l > 0) & (c > 0) & (c_prev > 0) & (h >= l)
    o, h, l, c, c_prev = o[mask], h[mask], l[mask], c[mask], c_prev[mask]
    N = len(o)
    if N < 3:
        return 0.0

    # EWMA weights: most recent = index N-1 gets weight (1-λ)λ^0, oldest gets (1-λ)λ^(N-1)
    idx = np.arange(N)
    weights = (1.0 - lam) * (lam ** (N - 1 - idx))
    weights /= weights.sum()  # normalize to 1.0

    log_oc = np.log(o / c_prev)
    log_co = np.log(c / o)
    log_hc = np.log(h / c)
    log_ho = np.log(h / o)
    log_lc = np.log(l / c)
    log_lo = np.log(l / o)

    mu_o = np.sum(weights * log_oc)
    var_o = np.sum(weights * (log_oc - mu_o) ** 2)

    mu_c = np.sum(weights * log_co)
    var_c = np.sum(weights * (log_co - mu_c) ** 2)

    var_rs = np.sum(weights * (log_hc * log_ho + log_lc * log_lo))

    k = 0.34 / (1.34 + (N + 1.0) / (N - 1.0))
    var_yz = var_o + k * var_c + (1.0 - k) * var_rs
    return max(var_yz, 0.0)


def calculate_yang_zhang_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Yang-Zhang (2000) — equal-weight, single window.
    Backward-compatible entry point. Returns annualized % (e.g. 24.5 for 24.5%).
    """
    if len(df) < window + 1:
        return 0.0
    subset = df.iloc[-(window + 1):].copy()
    var_yz = _yz_variance(subset)
    if var_yz <= 0:
        return 0.0
    return float(np.sqrt(var_yz * 252.0) * 100.0)


def calculate_yang_zhang_blend(df: pd.DataFrame, lam: float = 0.94) -> Dict[str, float]:
    """
    Three-window EWMA Yang-Zhang blend: 5d, 10d, 30d.
    Each window uses EWMA λ=0.94 weighting (recent days count more).
    Blend weights: 35% fast + 35% medium + 30% slow.

    Returns:
        rv_5d, rv_10d, rv_30d   — individual annualized % estimates
        rv_blend                — weighted blend (primary_rv)
        rv_confidence           — 0.0–1.0; low means windows strongly disagree (noisy OHLC)
    """
    result = {'rv_5d': 0.0, 'rv_10d': 0.0, 'rv_30d': 0.0, 'rv_blend': 0.0, 'rv_confidence': 0.5}

    def _yz_for_window(w: int) -> float:
        if len(df) < w + 1:
            return 0.0
        subset = df.iloc[-(w + 1):].copy()
        var_ewma = _yz_ewma_variance(subset, lam=lam)
        if var_ewma <= 0:
            return 0.0
        return float(np.sqrt(var_ewma * 252.0) * 100.0)

    yz5  = _yz_for_window(5)
    yz10 = _yz_for_window(10)
    yz30 = _yz_for_window(30)

    # Only use windows that returned valid values
    valid = [(v, w) for v, w in [(yz5, 0.35), (yz10, 0.35), (yz30, 0.30)] if v > 0]
    if not valid:
        return result

    total_w = sum(w for _, w in valid)
    blend = sum(v * w for v, w in valid) / total_w

    # Confidence: ratio of min/max across valid estimates. 1.0 = perfect agreement.
    vals = [v for v, _ in valid]
    confidence = min(vals) / max(vals) if max(vals) > 0 else 0.5

    result['rv_5d']        = round(yz5, 1)
    result['rv_10d']       = round(yz10, 1)
    result['rv_30d']       = round(yz30, 1)
    result['rv_blend']     = round(blend, 1)
    result['rv_confidence']= round(confidence, 3)
    return result


def calculate_parkinson_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Parkinson (1980) High-Low Range Volatility Estimator.
    Sinclair Chapter 2, Equation 2.14.
    """
    if len(df) < window:
        return 0.0

    subset = df.iloc[-window:].copy()
    h = subset['high'].values
    l = subset['low'].values

    mask = (h > 0) & (l > 0) & (h >= l)
    h = h[mask]
    l = l[mask]
    N = len(h)
    if N < 5:
        return 0.0

    log_hl = np.log(h / l)
    var_p = (1.0 / (4.0 * N * np.log(2.0))) * np.sum(log_hl ** 2)
    if var_p <= 0:
        return 0.0

    return float(np.sqrt(var_p * 252.0) * 100.0)


def calculate_garman_klass_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Garman-Klass (1980) Volatility Estimator.
    Sinclair Chapter 2, Equation 2.15.
    """
    if len(df) < window + 1:
        return 0.0

    subset = df.iloc[-(window + 1):].copy()
    h = subset['high'].values[1:]
    l = subset['low'].values[1:]
    c = subset['close'].values[1:]
    c_prev = subset['close'].values[:-1]

    mask = (h > 0) & (l > 0) & (c > 0) & (c_prev > 0) & (h >= l)
    h, l, c, c_prev = h[mask], l[mask], c[mask], c_prev[mask]
    N = len(h)
    if N < 5:
        return 0.0

    log_hl = np.log(h / l)
    log_cc = np.log(c / c_prev)

    var_gk = (1.0 / N) * np.sum(0.5 * (log_hl ** 2) - (2.0 * np.log(2.0) - 1.0) * (log_cc ** 2))
    if var_gk <= 0:
        return 0.0

    return float(np.sqrt(var_gk * 252.0) * 100.0)


def calculate_close_to_close_volatility(df: pd.DataFrame, window: int = 30) -> float:
    """
    Standard Close-to-Close Volatility with Jensen's Inequality Bias Correction b(N).
    Sinclair Chapter 2, Equations 2.1b, 2.5, 2.6.
    """
    if len(df) < window + 1:
        return 0.0

    closes = df['close'].values[-(window + 1):]
    log_returns = np.diff(np.log(closes))
    N = len(log_returns)
    if N < 5:
        return 0.0

    s2 = np.mean(log_returns ** 2)
    s = np.sqrt(s2)

    try:
        b_n = np.sqrt(2.0 / N) * (gamma(N / 2.0) / gamma((N - 1.0) / 2.0))
        unbiased_s = s / b_n
    except Exception:
        unbiased_s = s

    return float(unbiased_s * np.sqrt(252.0) * 100.0)


# ─────────────────────────────────────────────────────────────
#  SECTION 2: REAL ATM IV EXTRACTION
# ─────────────────────────────────────────────────────────────

def extract_atm_iv(option_chain: List[Dict[str, Any]], spot: float,
                   dte_min: float = 5.0, dte_max: float = 25.0) -> float:
    """
    Extracts the real ATM straddle mid IV from the live option chain.
    Finds the nearest-to-spot strike in the [dte_min, dte_max] expiry window,
    averages the ATM call IV + ATM put IV (bid/ask mid approximation).

    Falls back to wider windows if the tight window has no data.
    Returns annualized IV as a percentage (e.g. 28.5 for 28.5%).
    """
    if not option_chain or spot <= 0:
        return 0.0

    def _best_atm_iv_in_window(dmin: float, dmax: float) -> float:
        window_opts = [c for c in option_chain
                       if dmin <= c.get('dte', 0) <= dmax and c.get('iv', 0) > 0]
        if not window_opts:
            return 0.0

        # Find the ATM strike (closest to spot) within this DTE window
        strikes_in_window = sorted(set(c['strike'] for c in window_opts))
        if not strikes_in_window:
            return 0.0
        atm_strike = min(strikes_in_window, key=lambda s: abs(s - spot))

        # Collect call and put IVs at that strike
        call_ivs = [c['iv'] for c in window_opts
                    if c['strike'] == atm_strike and c.get('type', '').lower() == 'call']
        put_ivs  = [c['iv'] for c in window_opts
                    if c['strike'] == atm_strike and c.get('type', '').lower() == 'put']

        ivs = call_ivs + put_ivs
        if not ivs:
            # fallback: all strikes within 2% of spot
            close_ivs = [c['iv'] for c in window_opts if abs(c['strike'] - spot) <= 0.02 * spot]
            if close_ivs:
                return float(np.mean(close_ivs)) * 100.0
            return 0.0

        return float(np.mean(ivs)) * 100.0

    # Try primary window first, then widen
    for dmin, dmax in [(5, 21), (0, 30), (0, 60)]:
        iv = _best_atm_iv_in_window(dmin, dmax)
        if iv > 0:
            return round(iv, 2)

    return 0.0


# ─────────────────────────────────────────────────────────────
#  SECTION 3: IV RANK (DUAL: RV RANK + IV RANK)
# ─────────────────────────────────────────────────────────────

def calculate_iv_rank_and_percentile(history_iv_list: List[float], current_iv: float) -> Dict[str, float]:
    """
    Computes IV Rank (IVR) and IV Percentile (IVP).
    Sinclair Chapter 4 Volatility Cones context.
    """
    if not history_iv_list or current_iv <= 0:
        return {'iv_rank': 50.0, 'iv_percentile': 50.0}

    valid_ivs = [x for x in history_iv_list if x > 0]
    if not valid_ivs:
        return {'iv_rank': 50.0, 'iv_percentile': 50.0}

    low  = min(valid_ivs)
    high = max(valid_ivs)

    if high <= low:
        iv_rank = 50.0
    else:
        iv_rank = ((current_iv - low) / (high - low)) * 100.0
        iv_rank = max(0.0, min(100.0, iv_rank))

    count_below = sum(1 for x in valid_ivs if x < current_iv)
    iv_percentile = (count_below / len(valid_ivs)) * 100.0

    return {
        'iv_rank':       round(iv_rank, 1),
        'iv_percentile': round(iv_percentile, 1)
    }


def calculate_dual_ranks(df: pd.DataFrame, atm_iv: float,
                          option_chain: List[Dict[str, Any]], spot: float) -> Dict[str, Any]:
    """
    Computes two separate rank metrics:

    1. RV Rank (Parkinson-based) — what percentile is today's realized vol vs its own history?
       This tells you if PRICE has been moving a lot relative to the past year.

    2. IV Rank (ATM IV-based) — what percentile is today's implied vol vs a cross-section of
       the current chain's 30d ATM IV spread (used as a proxy for IV range since we lack
       52-week IV history storage). Flags divergence between the two.

    Returns:
        rv_rank         — 0–100, percentile of current Parkinson RV vs 252d rolling window
        iv_rank         — 0–100, percentile of ATM IV vs current chain's IV spread
        rank_divergence — True if |rv_rank - iv_rank| > 20 (event-driven IV expansion)
        rank_alert      — human-readable flag string or empty string
    """
    # ── RV Rank (rolling Parkinson, same as before) ──
    rolling_rvs = []
    if len(df) >= 60:
        for i in range(30, min(len(df), 252)):
            w = df.iloc[i - 30:i]
            r = calculate_parkinson_volatility(w, window=30)
            if r > 0:
                rolling_rvs.append(r)

    current_rv = calculate_parkinson_volatility(df, window=30)
    rv_rank_data = calculate_iv_rank_and_percentile(rolling_rvs, current_rv)
    rv_rank = rv_rank_data['iv_rank']

    # ── IV Rank (ATM IV vs chain's 30d ATM IV spread as proxy) ──
    # Collect ATM IVs from all available expirations (30d ± 20d window)
    # to approximate the recent IV range without stored history.
    chain_30d_ivs = []
    for exp_window in [(20, 45), (10, 65)]:
        dmin, dmax = exp_window
        window_opts = [c for c in option_chain
                       if dmin <= c.get('dte', 0) <= dmax and c.get('iv', 0) > 0]
        if len(window_opts) >= 4:
            strikes_sorted = sorted(set(c['strike'] for c in window_opts))
            # Sample the middle 60% of strikes to avoid extreme wing distortion
            n = len(strikes_sorted)
            trim_lo = max(0, int(n * 0.20))
            trim_hi = min(n, int(n * 0.80))
            core_strikes = set(strikes_sorted[trim_lo:trim_hi])
            chain_30d_ivs = [c['iv'] * 100.0 for c in window_opts if c['strike'] in core_strikes]
            if len(chain_30d_ivs) >= 4:
                break

    if chain_30d_ivs and atm_iv > 0:
        iv_rank_data = calculate_iv_rank_and_percentile(chain_30d_ivs, atm_iv)
        iv_rank = iv_rank_data['iv_rank']
    else:
        iv_rank = rv_rank  # fallback: same as RV rank

    # ── Divergence flag ──
    divergence = abs(rv_rank - iv_rank) > 20
    if divergence:
        if iv_rank > rv_rank:
            alert = '(!) IV elevated vs RV — event/earnings premium'
        else:
            alert = '(!) IV crushed vs RV — vol collapse post-event'
    else:
        alert = ''

    return {
        'rv_rank':          round(rv_rank, 1),
        'iv_rank':          round(iv_rank, 1),
        'rank_divergence':  divergence,
        'rank_alert':       alert
    }


# ─────────────────────────────────────────────────────────────
#  SECTION 4: IVTS — MULTI-POINT TERM STRUCTURE
# ─────────────────────────────────────────────────────────────

def calculate_ivts_and_skew(option_chain: List[Dict[str, Any]], spot: float,
                             vrp_pct: float = 0.0) -> Dict[str, Any]:
    """
    Analyzes Implied Volatility Term Structure (IVTS) using 4 expiry targets.
    Sinclair Chapter 5, Equations 5.2 – 5.4, 5.9, and Chapter 12 Equation 12.7.

    Multi-point curve: ~7d, ~21d, ~45d, ~90d ATM IVs.
    Per-asset normalization: uses vrp_pct cross-check to avoid SPX-calibrated
    thresholds mis-firing on high-vol single stocks.

    Term curve shape:
        Normal Contango  — iv_7d < iv_21d < iv_45d < iv_90d
        Flat             — all within 4% of each other
        Humped           — iv_21d or iv_45d is local maximum (event priced in mid-term)
        Backwardation    — front (7d/21d) > back (45d/90d) — stress/panic
        Inverted         — front higher than back by >8%, all the way out
    """
    if not option_chain or spot <= 0:
        return {
            'ivts': 1.0,
            'term_structure_regime': 'Flat / Neutral Term Curve',
            'term_curve_shape': 'Flat',
            'skew_slope': 1.0,
            'skew_bias': 'Balanced Smile (1.00x - Symmetric)',
            'front_iv': 25.0,
            'back_iv': 25.0,
            'iv_7d': 25.0,
            'iv_21d': 25.0,
            'iv_45d': 25.0,
            'iv_90d': 25.0,
        }

    def _atm_iv_at_target(target_dte: float, tolerance: float = 12.0) -> float:
        """Pull ATM IV for options nearest to target_dte ± tolerance."""
        lo, hi = target_dte - tolerance, target_dte + tolerance
        lo = max(lo, 0.5)
        candidates = [c for c in option_chain
                      if lo <= c.get('dte', 0) <= hi and c.get('iv', 0) > 0]
        if not candidates:
            # Widen tolerance once
            candidates = [c for c in option_chain
                          if (target_dte * 0.4) <= c.get('dte', 0) <= (target_dte * 2.0) and c.get('iv', 0) > 0]
        if not candidates:
            return 0.0

        atm_strike = min(set(c['strike'] for c in candidates), key=lambda s: abs(s - spot))
        atm_ivs = [c['iv'] for c in candidates if c['strike'] == atm_strike]
        if not atm_ivs:
            # fall back to closest-to-spot 2%
            close = [c['iv'] for c in candidates if abs(c['strike'] - spot) <= 0.02 * spot]
            atm_ivs = close if close else [c['iv'] for c in candidates]
        return float(np.mean(atm_ivs)) * 100.0 if atm_ivs else 0.0

    iv_7d  = _atm_iv_at_target(7.0,  tolerance=6.0)
    iv_21d = _atm_iv_at_target(21.0, tolerance=10.0)
    iv_45d = _atm_iv_at_target(45.0, tolerance=15.0)
    iv_90d = _atm_iv_at_target(90.0, tolerance=20.0)

    # Fill missing points using neighbours
    available = [v for v in [iv_7d, iv_21d, iv_45d, iv_90d] if v > 0]
    fallback   = float(np.mean(available)) if available else 25.0

    iv_7d  = iv_7d  if iv_7d  > 0 else fallback
    iv_21d = iv_21d if iv_21d > 0 else fallback
    iv_45d = iv_45d if iv_45d > 0 else fallback
    iv_90d = iv_90d if iv_90d > 0 else fallback

    # Front = average of 7d and 21d; Back = average of 45d and 90d
    front_iv = (iv_7d + iv_21d) / 2.0
    back_iv  = (iv_45d + iv_90d) / 2.0

    ivts = round(front_iv / back_iv, 3) if back_iv > 0 else 1.0

    # ── Term curve shape ──
    curve = [iv_7d, iv_21d, iv_45d, iv_90d]
    diffs = [curve[i+1] - curve[i] for i in range(len(curve) - 1)]  # positive = rising

    if max(curve) - min(curve) < 0.04 * fallback:
        curve_shape = 'Flat'
    elif all(d >= 0 for d in diffs):
        curve_shape = 'Normal Contango'
    elif all(d <= 0 for d in diffs):
        curve_shape = 'Inverted'
    elif diffs[0] > 0 and diffs[-1] < 0:
        # Rises then falls — humped in the middle
        curve_shape = 'Humped'
    elif diffs[0] < 0 and all(d <= 0 for d in diffs[1:]):
        curve_shape = 'Backwardation'
    else:
        curve_shape = 'Mixed'

    # ── Per-asset normalized regime classification ──
    # Full backwardation (front > back significantly): always Stress regardless of asset
    # Adjusted thresholds: 1.10 = clear backwardation for any asset class.
    # Cross-check with vrp_pct to prevent SPX thresholds misfiring on high-vol names.
    if ivts > 1.10 or curve_shape in ('Inverted', 'Backwardation'):
        ts_regime = 'Backwardation (Acute Event / Panic Shock)'
    elif ivts > 1.04 and vrp_pct > 8.0:
        # Mild backwardation confirmed by elevated VRP → stress
        ts_regime = 'Backwardation (Acute Event / Panic Shock)'
    elif ivts < 0.92:
        ts_regime = 'Contango (Normal Upward Term Premium)'
    elif curve_shape == 'Humped':
        ts_regime = 'Humped (Mid-Term Event Priced In)'
    else:
        ts_regime = 'Flat / Neutral Term Curve'

    # ── Skew ──
    otm_puts  = [c['iv'] for c in option_chain
                 if c.get('type', '').lower() == 'put'
                 and 0.92 * spot <= c['strike'] <= 0.97 * spot and c.get('iv', 0) > 0]
    otm_calls = [c['iv'] for c in option_chain
                 if c.get('type', '').lower() == 'call'
                 and 1.03 * spot <= c['strike'] <= 1.08 * spot and c.get('iv', 0) > 0]

    put_iv  = float(np.mean(otm_puts))  * 100.0 if otm_puts  else front_iv
    call_iv = float(np.mean(otm_calls)) * 100.0 if otm_calls else front_iv

    skew_slope = round(put_iv / call_iv, 2) if call_iv > 0 else 1.0
    if skew_slope >= 1.15:
        skew_bias = f'Heavy Put Skew ({skew_slope:.2f}x - Crash/Tail Hedging)'
    elif skew_slope <= 0.90:
        skew_bias = f'Call Skew Inversion ({skew_slope:.2f}x - Bullish FOMO)'
    else:
        skew_bias = f'Balanced Smile ({skew_slope:.2f}x - Symmetric)'

    return {
        'ivts':                 ivts,
        'term_structure_regime': ts_regime,
        'term_curve_shape':     curve_shape,
        'skew_slope':           skew_slope,
        'skew_bias':            skew_bias,
        'front_iv':             round(front_iv, 1),
        'back_iv':              round(back_iv, 1),
        'iv_7d':                round(iv_7d, 1),
        'iv_21d':               round(iv_21d, 1),
        'iv_45d':               round(iv_45d, 1),
        'iv_90d':               round(iv_90d, 1),
    }


# ─────────────────────────────────────────────────────────────
#  SECTION 5: VOLUME VELOCITY & MARKET IMPACT
# ─────────────────────────────────────────────────────────────

def calculate_volume_velocity_and_impact(df: pd.DataFrame, rv_yz: float,
                                          window: int = 20) -> Dict[str, Any]:
    """
    Calculates Volume Velocity relative to 20d moving average, and
    Sinclair / Gatheral Market Impact parameter alpha = sigma / sqrt(mu) (Eq. 6.22).
    """
    if len(df) < window:
        return {
            'volume_velocity':    1.0,
            'volume_regime':      'Average Volume',
            'market_impact_alpha': 0.001
        }

    volumes    = df['volume'].values[-window:]
    current_vol = float(volumes[-1])
    avg_vol     = float(np.mean(volumes)) if np.mean(volumes) > 0 else 1.0

    velocity = round(current_vol / avg_vol, 2) if avg_vol > 0 else 1.0

    if velocity >= 1.5:
        vol_regime = f'Elevated Volume ({velocity:.1f}x 20d MA - Heavy Institutional Order Flow)'
    elif velocity <= 0.65:
        vol_regime = f'Low Volume ({velocity:.1f}x 20d MA - Holiday/Quiet Drift)'
    else:
        vol_regime = f'Normal Volume ({velocity:.1f}x 20d MA)'

    daily_sigma = (rv_yz / 100.0) / np.sqrt(252.0) if rv_yz > 0 else 0.015
    alpha = daily_sigma / np.sqrt(max(current_vol, 1000.0))

    return {
        'volume_velocity':     velocity,
        'volume_regime':       vol_regime,
        'market_impact_alpha': float(alpha)
    }


# ─────────────────────────────────────────────────────────────
#  SECTION 6: REGIME VERDICT — PROBABILISTIC SCORE SYSTEM
# ─────────────────────────────────────────────────────────────

def calculate_regime_score(vrp_pct: float, ivts: float, rv_rank: float,
                            curve_shape: str, vrp_blended: float) -> Dict[str, Any]:
    """
    Probabilistic regime scoring system (-100 to +100).

    Positive score → IV-Rich (Chop / Range-Bound / Event)
    Negative score → IV-Cheap (Trend / Directional / Squeeze)
    Near zero      → Neutral

    Score contributions:
        VRP (relative %)      — largest driver (up to ±45 pts)
        IVTS / curve shape    — second driver (up to ±35 pts)
        RV Rank               — confirmation signal (up to ±20 pts)

    Regime boundaries:
        score >= 50           → Event Shock (backwardation + rich premium)
        score in [20, 50)     → Range-Bound (chop, IV rich, fade extremes)
        score in (-20, 20)    → Neutral (wait, no clear edge)
        score in (-50, -20]   → Trend (directional move, trade momentum)
        score <= -50          → Vol Squeeze (breakout imminent, strong trend signal)
    """
    score = 0.0

    # ── VRP contribution (±45 pts) ──
    if vrp_pct >= 25.0:
        score += 45.0
    elif vrp_pct >= 15.0:
        score += 30.0
    elif vrp_pct >= 8.0:
        score += 15.0
    elif vrp_pct <= -20.0:
        score -= 45.0
    elif vrp_pct <= -12.0:
        score -= 30.0
    elif vrp_pct <= -5.0:
        score -= 15.0
    # -5% to +8% → 0 contribution

    # ── IVTS / curve shape contribution (±35 pts) ──
    if ivts > 1.10 or curve_shape == 'Inverted':
        score += 35.0   # full backwardation / panic → strongly IV-rich
    elif ivts > 1.04 or curve_shape == 'Backwardation':
        score += 20.0   # mild backwardation / stress
    elif curve_shape == 'Humped':
        score += 12.0   # event in mid-term — elevated but not panic
    elif ivts < 0.92 or curve_shape == 'Normal Contango':
        score -= 20.0   # normal structure → vol not stretched
    # Flat → 0

    # ── RV Rank contribution (±20 pts) ──
    if rv_rank >= 75.0:
        score += 20.0   # RV is historically high → regime matches elevated IV
    elif rv_rank >= 55.0:
        score += 8.0
    elif rv_rank <= 20.0:
        score -= 20.0   # RV historically compressed → strong trend squeeze signal
    elif rv_rank <= 35.0:
        score -= 8.0
    # 35–55 → 0

    score = max(-100.0, min(100.0, score))

    # ── Regime label ──
    if score >= 50.0:
        verdict = 'Event Risk (Backwardation / Front IV Spiked)'
        vol_edge = 'Wait for resolution — both longs and shorts face whipsaw'
    elif score >= 20.0:
        verdict = 'Overpriced Vol (Short Premium Edge)'
        vol_edge = 'Fade extremes — fade rallies at Call Wall, fade drops at Put Wall'
    elif score <= -50.0:
        verdict = 'Vol Squeeze (Underpriced / Breakout Risk)'
        vol_edge = 'Play momentum — enter breakouts aggressively, trails stops wide'
    elif score <= -20.0:
        verdict = 'Vol Squeeze (Underpriced / Breakout Risk)'
        vol_edge = 'Play momentum — directional conviction, hold through pullbacks'
    else:
        verdict = 'Equilibrium Vol (Fair Value)'
        vol_edge = 'Defined Risk at Confluences — smaller size, respect both walls'

    # ── Confidence ──
    abs_score = abs(score)
    if abs_score >= 60.0:
        confidence_label = 'High'
    elif abs_score >= 30.0:
        confidence_label = 'Medium'
    else:
        confidence_label = 'Low'

    return {
        'regime_score':      round(score, 1),
        'regime_confidence': confidence_label,
        'regime_verdict':    verdict,
        'vol_edge':          vol_edge,
    }


# ─────────────────────────────────────────────────────────────
#  SECTION 7: MASTER SYNTHESIS FUNCTION
# ─────────────────────────────────────────────────────────────

def synthesize_sinclair_analysis(
    df: pd.DataFrame,
    option_chain: List[Dict[str, Any]],
    current_iv: float,   # kept for backward compatibility (fallback only)
    spot: float
) -> Dict[str, Any]:
    """
    Executes the full Euan Sinclair Volatility Trading Model:

    1. Multi-estimator EWMA RV blend (5d / 10d / 30d Yang-Zhang)
    2. Real ATM IV from live option chain straddle mid
    3. Time-decayed VRP (50% fast / 30% medium / 20% slow)
    4. 4-point IVTS term structure with curve shape detection
    5. Dual ranks: RV Rank (Parkinson) + IV Rank (ATM chain proxy)
    6. Probabilistic regime score system (-100 to +100)
    7. Weekly Expected Move
    """

    # ── 1. Multi-window EWMA Yang-Zhang blend ──
    yz_blend = calculate_yang_zhang_blend(df, lam=0.94)
    rv_5d    = yz_blend['rv_5d']
    rv_10d   = yz_blend['rv_10d']
    rv_30d   = yz_blend['rv_30d']
    rv_blend = yz_blend['rv_blend']
    rv_confidence = yz_blend['rv_confidence']

    # Primary RV: blended EWMA. Fall back to GK/CC if insufficient history.
    rv_gk = calculate_garman_klass_volatility(df, window=30)
    rv_cc = calculate_close_to_close_volatility(df, window=30)
    primary_rv = rv_blend if rv_blend > 0 else (rv_gk if rv_gk > 0 else (rv_cc if rv_cc > 0 else current_iv))

    # ── 2. Real ATM IV ──
    atm_iv = extract_atm_iv(option_chain, spot)
    if atm_iv <= 0:
        atm_iv = current_iv   # fallback to avg_iv passed by endpoint

    # ── 3. Time-decayed VRP (3 windows vs ATM IV) ──
    vrp_5d  = atm_iv - rv_5d  if rv_5d  > 0 else (atm_iv - primary_rv)
    vrp_10d = atm_iv - rv_10d if rv_10d > 0 else (atm_iv - primary_rv)
    vrp_30d = atm_iv - rv_30d if rv_30d > 0 else (atm_iv - primary_rv)

    # Blend: 50% fast (most recent), 30% medium, 20% slow (history)
    vrp_blended = 0.50 * vrp_5d + 0.30 * vrp_10d + 0.20 * vrp_30d
    vrp_pct = round((vrp_blended / primary_rv) * 100.0, 1) if primary_rv > 0 else 0.0

    # ── 4. IVTS multi-point term structure ──
    surface_metrics = calculate_ivts_and_skew(option_chain, spot, vrp_pct=vrp_pct)
    ivts        = surface_metrics['ivts']
    curve_shape = surface_metrics['term_curve_shape']

    # ── 5. Dual Ranks ──
    rank_data = calculate_dual_ranks(df, atm_iv, option_chain, spot)
    rv_rank   = rank_data['rv_rank']
    iv_rank   = rank_data['iv_rank']

    # ── 6. Probabilistic regime score ──
    regime_data = calculate_regime_score(vrp_pct, ivts, rv_rank, curve_shape, vrp_blended)

    # ── 7. Weekly Expected Move ──
    weekly_em_dollars = round(spot * (atm_iv / 100.0) * math.sqrt(5.0 / 252.0), 2)
    weekly_em_pct     = round((weekly_em_dollars / spot) * 100.0, 2) if spot > 0 else 0.0

    # ── Confidence label for display ──
    if rv_confidence >= 0.85:
        rv_conf_label = 'High'
    elif rv_confidence >= 0.65:
        rv_conf_label = 'Medium'
    else:
        rv_conf_label = 'Low'

    return {
        # Realized volatility (multi-window blend)
        'rv_yang_zhang':    round(primary_rv, 1),    # blended — primary display field
        'rv_yang_zhang_5d': round(rv_5d, 1),
        'rv_yang_zhang_10d': round(rv_10d, 1),
        'rv_yang_zhang_30d': round(rv_30d, 1),
        'rv_confidence':    rv_conf_label,           # Low / Medium / High

        # Implied volatility (real ATM chain)
        'implied_volatility': round(atm_iv, 1),

        # VRP (time-decayed blend)
        'vrp_spread':  round(vrp_blended, 2),        # blended spread (ppts)
        'vrp_pct':     vrp_pct,                      # relative %, normalized
        'vrp_5d':      round(vrp_5d, 2),
        'vrp_10d':     round(vrp_10d, 2),
        'vrp_30d':     round(vrp_30d, 2),

        # Ranks (dual)
        'rv_rank':     rv_rank,                      # Parkinson RV Rank (0–100)
        'iv_rank':     iv_rank,                      # ATM IV Rank proxy (0–100)
        'rank_alert':  rank_data['rank_alert'],      # divergence flag

        # Term structure (multi-point)
        'ivts':                  ivts,
        'term_structure_regime': surface_metrics['term_structure_regime'],
        'term_curve_shape':      curve_shape,
        'front_iv':              surface_metrics['front_iv'],
        'back_iv':               surface_metrics['back_iv'],
        'iv_7d':                 surface_metrics['iv_7d'],
        'iv_21d':                surface_metrics['iv_21d'],
        'iv_45d':                surface_metrics['iv_45d'],
        'iv_90d':                surface_metrics['iv_90d'],

        # Skew
        'skew_slope': surface_metrics['skew_slope'],
        'skew_bias':  surface_metrics['skew_bias'],

        # Regime verdict (probabilistic)
        'regime_score':      regime_data['regime_score'],
        'regime_confidence': regime_data['regime_confidence'],
        'regime_verdict':    regime_data['regime_verdict'],
        'vol_edge':          regime_data['vol_edge'],

        # Expected move
        'weekly_expected_move_dollars': weekly_em_dollars,
        'weekly_expected_move_pct':     weekly_em_pct,
    }

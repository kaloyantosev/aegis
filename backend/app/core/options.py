import numpy as np
from scipy.stats import norm
from typing import List, Dict, Any, Optional

def black_scholes_gamma(S: float, K: float, t: float, sigma: float, r: float = 0.05) -> float:
    """
    Calculate the Black-Scholes option Gamma (second derivative of option price with respect to spot).
    S: Underlyer spot price
    K: Strike price
    t: Time to maturity in years (DTE / 365.0)
    sigma: Implied volatility (e.g. 0.20 for 20%)
    r: Risk-free interest rate
    """
    if t <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0.0
    
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * t) / (sigma * np.sqrt(t))
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(t))
    return float(gamma)

def calculate_gex_profile(spot: float, option_chain: List[Dict[str, Any]], r: float = 0.05) -> Dict[str, Any]:
    """
    Calculates GEX (Gamma Exposure) for each strike and total net GEX.
    option_chain: List of option contracts containing:
                  - strike: float
                  - type: str ("call" or "put")
                  - open_interest: int
                  - iv: float (implied volatility, e.g. 0.25)
                  - dte: float (days to expiration)
    """
    strikes_gex = {}
    total_gex = 0.0
    
    for contract in option_chain:
        strike = contract["strike"]
        option_type = contract["type"].lower()
        oi = contract["open_interest"]
        iv = contract["iv"]
        dte = contract["dte"]
        
        t = max(dte, 0.5) / 365.0  # floor DTE at 0.5 days to avoid division by zero
        gamma = black_scholes_gamma(spot, strike, t, iv, r)
        
        # Call GEX: Long Gamma position for market makers (assuming they are long calls)
        # Put GEX: Short Gamma position for market makers (assuming they are short puts)
        if option_type == "call":
            contract_gex = oi * gamma * 100 * spot
        elif option_type == "put":
            contract_gex = -oi * gamma * 100 * spot
        else:
            continue
            
        strikes_gex[strike] = strikes_gex.get(strike, 0.0) + contract_gex
        total_gex += contract_gex
        
    # Find the Gamma Flip zone (where GEX transitions from net positive to net negative)
    # Usually this is around the spot price. We can return sorted strike values
    sorted_gex = sorted([{"strike": k, "gex": v} for k, v in strikes_gex.items()], key=lambda x: x["strike"])
    
    return {
        "total_net_gex": total_gex,
        "strikes_gex": sorted_gex,
        "spot": spot
    }

def calculate_spatial_gex_velocity(spot: float, option_chain: List[Dict[str, Any]], r: float = 0.05) -> Dict[str, Any]:
    """
    Calculates Spatial GEX Velocity: the directional rate of change / gradient (dGEX / dSpot).
    Evaluates net GEX across spot * 0.99 and spot * 1.01.
    
    Returns:
      - velocity_slope: raw derivative value
      - velocity_regime: 'Sticky' (cushioned/chop), 'Air Pocket' (vacuum/fast candles), or 'Accelerating'
      - dominance_0dte_pct: % of total absolute gamma expiring in <= 1 DTE
    """
    if not option_chain or spot <= 0:
        return {
            "velocity_slope": 0.0,
            "velocity_regime": "Sticky",
            "dominance_0dte_pct": 0.0
        }

    def _eval_net_gex(s_price: float):
        net = 0.0
        for c in option_chain:
            strike = c["strike"]
            oi = c.get("open_interest", 0)
            iv = c.get("iv", 0.25)
            dte = max(c.get("dte", 0.5), 0.5)
            t = dte / 365.0
            g = black_scholes_gamma(s_price, strike, t, iv, r)
            if c.get("type", "").lower() == "call":
                net += oi * g * 100 * s_price
            else:
                net -= oi * g * 100 * s_price
        return net

    s_up = spot * 1.01
    s_dn = spot * 0.99
    delta_s = s_up - s_dn

    gex_up = _eval_net_gex(s_up)
    gex_dn = _eval_net_gex(s_dn)
    gex_center = _eval_net_gex(spot)

    slope = (gex_up - gex_dn) / delta_s if delta_s > 0 else 0.0

    # Calculate 0DTE (Front-Day) Gamma Dominance
    total_abs_gamma = 0.0
    zero_dte_gamma = 0.0
    for c in option_chain:
        strike = c["strike"]
        oi = c.get("open_interest", 0)
        iv = c.get("iv", 0.25)
        dte = c.get("dte", 0.0)
        t = max(dte, 0.5) / 365.0
        g = black_scholes_gamma(spot, strike, t, iv, r)
        gamma_weight = oi * g * 100 * spot
        total_abs_gamma += abs(gamma_weight)
        if dte <= 1.5:
            zero_dte_gamma += abs(gamma_weight)

    dominance_0dte = round((zero_dte_gamma / total_abs_gamma) * 100.0, 1) if total_abs_gamma > 0 else 0.0

    # Spatial Regime determination:
    # If Net GEX is negative or slope is flat/negative in positive territory -> Air Pocket
    # If slope is thick positive -> Sticky cushion
    if gex_center < 0:
        regime = "Air Pocket"
    elif abs(slope) < 0.15 * (abs(gex_center) / (spot * 0.01) if gex_center != 0 else 1.0):
        regime = "Sticky"
    elif slope > 0:
        regime = "Accelerating"
    else:
        regime = "Air Pocket"

    return {
        "velocity_slope": round(float(slope), 2),
        "velocity_regime": regime,
        "dominance_0dte_pct": dominance_0dte
    }

def calculate_max_pain(option_chain: List[Dict[str, Any]], max_dte: Optional[float] = None, min_dte: Optional[float] = None) -> float:
    """
    Finds the Max Pain strike price (where option buyers lose the most money).
    Supports filtering by expiration horizon (e.g. Weekly <= 7 DTE or Monthly OPEX 15-45 DTE).
    """
    if not option_chain:
        return 0.0
        
    filtered = option_chain
    if max_dte is not None or min_dte is not None:
        subset = [
            c for c in option_chain 
            if (max_dte is None or c.get("dte", 0) <= max_dte) and (min_dte is None or c.get("dte", 0) >= min_dte)
        ]
        if subset:
            filtered = subset
            
    strikes = sorted(list(set(contract["strike"] for contract in filtered)))
    if not strikes:
        return 0.0
        
    min_pain = float("inf")
    max_pain_strike = strikes[0]
    
    for test_strike in strikes:
        total_pain = 0.0
        for contract in filtered:
            strike = contract["strike"]
            option_type = contract["type"].lower()
            oi = contract["open_interest"]
            
            if option_type == "call":
                # Value of calls at expiration if spot is test_strike
                total_pain += oi * max(test_strike - strike, 0)
            elif option_type == "put":
                # Value of puts at expiration if spot is test_strike
                total_pain += oi * max(strike - test_strike, 0)
                
        if total_pain < min_pain:
            min_pain = total_pain
            max_pain_strike = test_strike
            
    return float(max_pain_strike)

def calculate_gamma_flip(spot: float, option_chain: List[Dict[str, Any]], r: float = 0.05) -> float:
    """
    Finds the exact price where cumulative Net GEX transitions from positive to negative (Zero Gamma Root).
    Uses a fine-mesh root search around spot price.
    """
    if not option_chain or spot <= 0:
        return round(spot * 0.995, 2)
        
    def net_gex_at(eval_spot: float) -> float:
        net = 0.0
        for contract in option_chain:
            strike = contract["strike"]
            option_type = contract["type"].lower()
            oi = contract["open_interest"]
            iv = contract["iv"]
            dte = max(contract["dte"], 0.5)
            t = dte / 365.0
            
            g = black_scholes_gamma(eval_spot, strike, t, iv, r)
            if option_type == "call":
                net += oi * g * 100 * eval_spot
            elif option_type == "put":
                net -= oi * g * 100 * eval_spot
        return net

    # Scan test prices from -12% to +12% around spot
    steps = 100
    prices = np.linspace(spot * 0.88, spot * 1.12, steps)
    gex_vals = [net_gex_at(p) for p in prices]
    
    # Look for sign change
    for i in range(len(prices) - 1):
        if (gex_vals[i] <= 0 and gex_vals[i+1] > 0) or (gex_vals[i] >= 0 and gex_vals[i+1] < 0):
            # Linear interpolation for precise crossing
            p1, p2 = prices[i], prices[i+1]
            g1, g2 = gex_vals[i], gex_vals[i+1]
            if g2 != g1:
                flip = p1 - g1 * (p2 - p1) / (g2 - g1)
                return round(float(flip), 2)
                
    # If all positive or all negative, return the minimum absolute GEX price
    min_idx = int(np.argmin(np.abs(gex_vals)))
    return round(float(prices[min_idx]), 2)

def calculate_expected_move(spot: float, atm_iv: float, dte: float = 7.0) -> Dict[str, float]:
    """
    Computes McMillan's 1-standard deviation expected move envelope:
    Expected Move = Spot * IV * sqrt(DTE / 365)
    """
    if spot <= 0:
        return {"move": 0.0, "upper": 0.0, "lower": 0.0}
        
    sigma = atm_iv if atm_iv < 2.0 else atm_iv / 100.0  # handle decimal or percentage
    sigma = max(0.05, min(sigma, 2.5))
    t = max(0.5, dte) / 365.0
    
    move = spot * sigma * np.sqrt(t)
    return {
        "move": round(float(move), 2),
        "upper": round(float(spot + move), 2),
        "lower": round(float(spot - move), 2)
    }

def calculate_weekly_options_dom(spot: float, option_chain: List[Dict[str, Any]], max_dte: float = 7.0) -> List[Dict[str, Any]]:
    """
    Extracts Depth of Market (DOM) capped to the Weekly Expiry (DTE <= 7) around spot (+- 4%).
    Aggregates Call OI (Ask/Res) and Put OI (Bid/Sup) per strike with proportional bar depths.
    """
    if not option_chain or spot <= 0:
        return []

    weekly_opts = [c for c in option_chain if 0 < c.get("dte", 0) <= max_dte and c.get("strike", 0) > 0]
    if not weekly_opts:
        # Fallback to shortest available DTE if strict <= 7 is empty
        min_dte = min([c.get("dte", 999) for c in option_chain if c.get("dte", 0) > 0], default=7.0)
        weekly_opts = [c for c in option_chain if c.get("dte", 0) <= max(min_dte + 2, 7.0)]

    # Limit strikes to within +- 4% of current spot
    lower_bound = spot * 0.96
    upper_bound = spot * 1.04

    by_strike = {}
    for c in weekly_opts:
        k = float(c["strike"])
        if k < lower_bound or k > upper_bound:
            continue
        if k not in by_strike:
            by_strike[k] = {"strike": k, "call_oi": 0, "put_oi": 0, "call_vol": 0, "put_vol": 0}
        
        oi = int(c.get("open_interest", 0))
        vol = int(c.get("volume", 0))
        if c.get("type", "").lower() == "call":
            by_strike[k]["call_oi"] += oi
            by_strike[k]["call_vol"] += vol
        else:
            by_strike[k]["put_oi"] += oi
            by_strike[k]["put_vol"] += vol

    if not by_strike:
        return []

    # Sort strikes descending (highest strike at top, like a real DOM ladder)
    sorted_strikes = sorted(by_strike.values(), key=lambda x: x["strike"], reverse=True)

    # Calculate max OI for CSS width normalization (max 100%)
    max_call_oi = max([s["call_oi"] for s in sorted_strikes], default=1) or 1
    max_put_oi = max([s["put_oi"] for s in sorted_strikes], default=1) or 1

    dom_ladder = []
    for s in sorted_strikes:
        c_oi = s["call_oi"]
        p_oi = s["put_oi"]
        c_pct = min(100, int((c_oi / max_call_oi) * 100))
        p_pct = min(100, int((p_oi / max_put_oi) * 100))
        dom_ladder.append({
            "strike": s["strike"],
            "call_oi": c_oi,
            "put_oi": p_oi,
            "call_vol": s["call_vol"],
            "put_vol": s["put_vol"],
            "call_bar_pct": c_pct,
            "put_bar_pct": p_pct,
            "is_spot": abs(s["strike"] - spot) <= (spot * 0.003)
        })

    return dom_ladder[:12]  # return top 12 strikes around spot for clean display

import numpy as np
import pandas as pd
from scipy.stats import gaussian_kde
from typing import List, Dict, Any, Tuple

def find_local_pivots(prices: np.ndarray, window: int = 10) -> Tuple[List[float], List[float]]:
    """
    Identifies local highs (peaks) and lows (troughs) within a rolling window.
    prices: numpy array of close or high/low prices.
    window: Number of bars on either side to check.
    """
    peaks = []
    troughs = []
    n = len(prices)
    
    for i in range(window, n - window):
        chunk = prices[i - window : i + window + 1]
        center_val = prices[i]
        
        # Check if center value is a local maximum
        if center_val == np.max(chunk):
            peaks.append(float(center_val))
        # Check if center value is a local minimum
        if center_val == np.min(chunk):
            troughs.append(float(center_val))
            
    return peaks, troughs

def calculate_sr_levels(
    df: pd.DataFrame, 
    window: int = 10, 
    bandwidth_pct: float = 0.015,
    num_levels: int = 5
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Calculates key Support and Resistance levels from historical OHLCV data.
    df: DataFrame containing 'high', 'low', 'close', and 'volume' columns.
    window: Lookback window for pivot detection.
    bandwidth_pct: Smoothing bandwidth for KDE clustering as a percentage of price.
    num_levels: Max number of support or resistance levels to extract.
    """
    if df.empty or len(df) < (window * 2 + 1):
        return {"supports": [], "resistances": []}
        
    closes = df["close"].to_numpy()
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    
    # 1. Detect raw peaks and troughs
    peaks, _ = find_local_pivots(highs, window=window)
    _, troughs = find_local_pivots(lows, window=window)
    
    all_pivots = peaks + troughs
    if not all_pivots:
        return {"supports": [], "resistances": []}
        
    current_price = closes[-1]
    
    # 2. Kernel Density Estimation to find clusters
    # Bandwidth determines how close levels must be to be grouped together
    std_price = np.std(all_pivots)
    if std_price == 0:
        return {"supports": [], "resistances": []}
        
    # Standardize bandwidth to a percentage of current price
    kde_bandwidth = current_price * bandwidth_pct
    
    # Generate a range of test prices around the pivots to evaluate density
    price_min = min(all_pivots) * 0.9
    price_max = max(all_pivots) * 1.1
    x_grid = np.linspace(price_min, price_max, 1000)
    
    try:
        # Use covariance factor to scale bandwidth
        kde = gaussian_kde(all_pivots, bw_method=kde_bandwidth / std_price)
        density = kde(x_grid)
    except:
        # Fallback to standard KDE if calculation errors out
        kde = gaussian_kde(all_pivots)
        density = kde(x_grid)
        
    # 3. Find peaks in the KDE density profile
    # Simple local maximum finder on the density curve
    density_peaks = []
    for i in range(1, len(density) - 1):
        if density[i] > density[i-1] and density[i] > density[i+1]:
            density_peaks.append((x_grid[i], density[i]))
            
    # Sort peaks by density weight (strength of the S/R level)
    density_peaks = sorted(density_peaks, key=lambda x: x[1], reverse=True)
    
    supports = []
    resistances = []
    
    # 4. Classify levels relative to the current spot price
    for price_level, weight in density_peaks:
        # Count how many historical pivots (peaks/troughs) tested this level within a 1.5% range
        touches = sum(1 for pivot in all_pivots if abs(pivot - price_level) <= 0.015 * price_level)
        if touches <= 0:
            continue
        
        # Check volume concentration near this level (High Volume Nodes)
        volume_mask = (closes >= price_level * 0.985) & (closes <= price_level * 1.015)
        volume_weight = float(df.loc[volume_mask, "volume"].sum()) if "volume" in df.columns else 0.0

        level_info = {
            "price": round(price_level, 2),
            "strength": round(float(weight), 4),
            "volume_concentration": volume_weight,
            "tests": touches
        }
        
        if price_level < current_price:
            supports.append(level_info)
        else:
            resistances.append(level_info)
            
    # Sort supports highest to lowest (closest to spot first)
    supports = sorted(supports, key=lambda x: x["price"], reverse=True)[:num_levels]
    # Sort resistances lowest to highest (closest to spot first)
    resistances = sorted(resistances, key=lambda x: x["price"])[:num_levels]
    
    return {
        "supports": supports,
        "resistances": resistances
    }

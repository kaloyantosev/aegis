import numpy as np
import pandas as pd
from typing import Dict, Any, List

def run_historical_backtest(
    prices: List[float], 
    strategy_type: str = "leveraged_futures"
) -> Dict[str, Any]:
    """
    Simulates a historical backtest over the provided price path using the
    leveraged long/short strategy based on GEX, trend, and S/R levels.
    """
    np.random.seed(100) # stable simulation path
    n_days = len(prices)
    
    # Capital parameters
    starting_capital = 10000.0
    capital = starting_capital
    equity_curve = [starting_capital]
    
    trades = []
    position = None # Current active trade: {"entry_price", "type", "qty", "entry_day", "stop_loss", "target"}
    daily_returns = []
    
    for i in range(1, n_days):
        spot = prices[i]
        
        # Check active position
        if position is not None:
            # Check stops and targets
            pnl = (spot - position["entry_price"]) * position["qty"] if position["type"] == "long" else (position["entry_price"] - spot) * position["qty"]
            current_equity = capital + pnl
            
            # Check exit conditions
            is_stop = spot <= position["stop_loss"] if position["type"] == "long" else spot >= position["stop_loss"]
            is_target = spot >= position["target"] if position["type"] == "long" else spot <= position["target"]
            duration = i - position["entry_day"]
            
            # Exit at stop, target or max 10 days hold time
            if is_stop or is_target or duration >= 10:
                capital += pnl
                trades.append({
                    "type": position["type"],
                    "entry_price": position["entry_price"],
                    "exit_price": spot,
                    "pnl": pnl,
                    "result": "Win" if pnl > 0 else "Loss"
                })
                position = None
                    
        # Signal Generation (only if no active position)
        if position is None and i < n_days - 10:
            # Generate support and resistance zones locally on past window
            past_window = prices[max(0, i-20):i]
            local_support = np.min(past_window) if len(past_window) > 0 else spot * 0.97
            local_resistance = np.max(past_window) if len(past_window) > 0 else spot * 1.03
            
            # Simulated GEX environment (cyclical positive/negative zones)
            gex_is_positive = np.sin(i / 10.0) >= 0
            leverage = 5.0
            risk_capital = capital * 0.10 # risk 10% of capital
            
            # Buy at support in positive GEX (Long)
            if spot <= local_support * 1.01 and gex_is_positive:
                sl = local_support * 0.99
                if sl >= spot:
                    sl = spot * 0.97
                target = spot + 3.0 * (spot - sl) # 1:3 R/R target
                qty = (risk_capital * leverage) / spot
                position = {
                    "type": "long",
                    "entry_price": spot,
                    "qty": qty,
                    "entry_day": i,
                    "stop_loss": sl,
                    "target": target
                }
            # Sell at resistance in negative GEX (Short)
            elif spot >= local_resistance * 0.99 and not gex_is_positive:
                sl = local_resistance * 1.01
                if sl <= spot:
                    sl = spot * 1.03
                target = spot - 3.0 * (sl - spot) # 1:3 R/R target
                qty = (risk_capital * leverage) / spot
                position = {
                    "type": "short",
                    "entry_price": spot,
                    "qty": qty,
                    "entry_day": i,
                    "stop_loss": sl,
                    "target": target
                }
                    
        # Track daily equity
        if position is not None:
            pnl = (spot - position["entry_price"]) * position["qty"] if position["type"] == "long" else (position["entry_price"] - spot) * position["qty"]
            daily_equity = capital + pnl
        else:
            daily_equity = capital
            
        daily_returns.append((daily_equity - equity_curve[-1]) / equity_curve[-1])
        equity_curve.append(daily_equity)

    # 3. Calculate Performance Metrics
    net_return = ((capital - starting_capital) / starting_capital) * 100.0
    wins = [t for t in trades if t["result"] == "Win"]
    win_rate = (len(wins) / len(trades) * 100.0) if trades else 0.0
    
    # Sharpe Ratio
    avg_return = np.mean(daily_returns) if daily_returns else 0.0
    std_return = np.std(daily_returns) if daily_returns else 0.0
    sharpe = (avg_return / std_return * np.sqrt(252)) if std_return > 0 else 0.0
    
    # Max Drawdown
    equity_arr = np.array(equity_curve)
    peaks = np.maximum.accumulate(equity_arr)
    drawdowns = (peaks - equity_arr) / peaks
    max_drawdown = np.max(drawdowns) * 100.0 if len(drawdowns) > 0 else 0.0
    
    return {
        "net_return": round(net_return, 2),
        "win_rate": round(win_rate, 1),
        "sharpe_ratio": round(float(sharpe), 2),
        "max_drawdown": round(max_drawdown, 2),
        "total_trades": len(trades),
        "equity_curve": [round(eq, 2) for eq in equity_curve],
        "trades": trades
    }

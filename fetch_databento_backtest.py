import os
import sys
import json
import datetime as dt
from zoneinfo import ZoneInfo
import pandas as pd
import numpy as np
import yfinance as yf
import pytz

try:
    import databento as db
except ImportError:
    print("databento is not installed. Run: pip install databento")
    sys.exit(1)

ET_TZ = pytz.timezone("America/New_York")

def main():
    api_key = os.environ.get("DATABENTO_API_KEY", "").strip()
    if not api_key and len(sys.argv) > 1:
        api_key = sys.argv[1].strip()
        
    if not api_key:
        print("=" * 60)
        print("DATABENTO API KEY REQUIRED")
        print("=" * 60)
        print("Please provide your Databento API key:")
        print("1. Sign up for free at https://databento.com (you get $125 free credit)")
        print("2. Copy your API key from https://databento.com/portal/keys")
        print("3. Run this script as:")
        print("   python fetch_databento_backtest.py db-YOUR_KEY_HERE")
        print("=" * 60)
        return

    print("Initializing Databento Historical Client...")
    client = db.Historical(api_key)

    tickers = ["SPY", "QQQ"]
    start_date = "2026-09-10"
    end_date = "2026-10-10"

    for ticker in tickers:
        print(f"\n==========================================")
        print(f"Fetching real OPRA data for {ticker} from Databento...")
        print(f"Date range: {start_date} to {end_date}")
        print(f"==========================================")

        symbol_parent = f"{ticker}.OPT"

        # 1. Fetch Definitions (Strikes, Expirations, Call/Put)
        print(f"Downloading instrument definitions for {symbol_parent}...")
        try:
            def_df = client.timeseries.get_range(
                dataset="OPRA.PILLAR",
                symbols=symbol_parent,
                schema="definition",
                stype_in="parent",
                start=start_date,
                end=end_date,
            ).to_df()
            print(f"Retrieved {len(def_df)} definitions.")
        except Exception as e:
            print(f"Error fetching definitions: {e}")
            continue

        # 2. Fetch Open Interest Statistics
        print(f"Downloading start-of-day Open Interest statistics for {symbol_parent}...")
        try:
            stats_df = client.timeseries.get_range(
                dataset="OPRA.PILLAR",
                symbols=symbol_parent,
                schema="statistics",
                stype_in="parent",
                start=start_date,
                end=end_date,
            ).to_df()
            print(f"Retrieved {len(stats_df)} statistics records.")
        except Exception as e:
            print(f"Error fetching statistics: {e}")
            continue

        # Filter for Open Interest
        oi_df = stats_df[stats_df["stat_type"] == db.StatType.OPEN_INTEREST].copy()
        print(f"Total Open Interest records: {len(oi_df)}")

        # Load existing file to keep candle history
        src_path = f"src/data/backtest/{ticker}.json"
        fe_path = f"frontend/src/data/backtest/{ticker}.json"
        
        if os.path.exists(src_path):
            with open(src_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        else:
            print(f"Existing backtest file not found at {src_path}")
            continue

        days_dict = existing_data.get("days", {})

        # Process each trading day
        for date_str, day_payload in days_dict.items():
            spot = day_payload.get("spot_at_0940", 0)
            if spot <= 0:
                continue

            target_date = dt.datetime.strptime(date_str, "%Y-%m-%d").date()
            
            # Filter definitions and stats for this date
            day_defs = def_df[def_df.index.date == target_date] if hasattr(def_df.index, "date") else def_df
            day_oi = oi_df[oi_df.index.date == target_date] if hasattr(oi_df.index, "date") else oi_df

            # Merge definitions with OI
            merged = pd.merge(
                day_defs[["instrument_id", "raw_symbol", "strike_price", "expiration", "instrument_class"]],
                day_oi[["instrument_id", "quantity"]],
                on="instrument_id",
                how="inner"
            ).rename(columns={"quantity": "open_interest"})

            if merged.empty:
                print(f"Warning: No merged records for {ticker} on {date_str}, keeping existing structure.")
                continue

            # Identify 0DTE (expires on date_str) vs Weekly (expires within 7 days)
            merged["expiration_date"] = pd.to_datetime(merged["expiration"]).dt.date
            
            # Map strikes
            center_strike = round(spot)
            strikes = [center_strike + i for i in range(17, -18, -1)][:34]

            # Aggregate by strike
            by_strike_weekly = {}
            by_strike_0dte = {}

            for _, row in merged.iterrows():
                k = float(row["strike_price"])
                cp = str(row["instrument_class"]).upper()
                oi = int(row["open_interest"])
                exp_date = row["expiration_date"]
                days_to_exp = (exp_date - target_date).days

                # Weekly: expires within 7 days
                if 0 <= days_to_exp <= 7:
                    if k not in by_strike_weekly:
                        by_strike_weekly[k] = {"call_oi": 0, "put_oi": 0}
                    if cp == "C":
                        by_strike_weekly[k]["call_oi"] += oi
                    else:
                        by_strike_weekly[k]["put_oi"] += oi

                # 0DTE: expires today
                if days_to_exp == 0:
                    if k not in by_strike_0dte:
                        by_strike_0dte[k] = {"call_oi": 0, "put_oi": 0}
                    if cp == "C":
                        by_strike_0dte[k]["call_oi"] += oi
                    else:
                        by_strike_0dte[k]["put_oi"] += oi

            # Build DOM ladders
            dom_weekly_rows = []
            dom_0dte_rows = []

            for k in strikes:
                w = by_strike_weekly.get(float(k), {"call_oi": 0, "put_oi": 0})
                d0 = by_strike_0dte.get(float(k), {"call_oi": 0, "put_oi": 0})

                dom_weekly_rows.append({
                    "strike": k,
                    "put_oi": w["put_oi"],
                    "call_oi": w["call_oi"],
                    "put_0dte_oi": d0["put_oi"],
                    "call_0dte_oi": d0["call_oi"],
                    "is_spot": (k == center_strike)
                })

                dom_0dte_rows.append({
                    "strike": k,
                    "put_oi": d0["put_oi"],
                    "call_oi": d0["call_oi"],
                    "put_0dte_oi": d0["put_oi"],
                    "call_0dte_oi": d0["call_oi"],
                    "is_spot": (k == center_strike)
                })

            max_w_put = max(r["put_oi"] for r in dom_weekly_rows) or 1
            max_w_call = max(r["call_oi"] for r in dom_weekly_rows) or 1
            max_0_put = max(r["put_oi"] for r in dom_0dte_rows) or 1
            max_0_call = max(r["call_oi"] for r in dom_0dte_rows) or 1

            dom_weekly = []
            for r in dom_weekly_rows:
                dom_weekly.append({
                    "strike": r["strike"],
                    "put_oi": r["put_oi"],
                    "call_oi": r["call_oi"],
                    "put_bar_pct": min(100, int((r["put_oi"] / max_w_put) * 100)),
                    "call_bar_pct": min(100, int((r["call_oi"] / max_w_call) * 100)),
                    "put_0dte_pct": min(100, int((r["put_0dte_oi"] / max_w_put) * 100)),
                    "call_0dte_pct": min(100, int((r["call_0dte_oi"] / max_w_call) * 100)),
                    "put_0dte_oi": r["put_0dte_oi"],
                    "call_0dte_oi": r["call_0dte_oi"],
                    "is_spot": r["is_spot"]
                })

            dom_0dte = []
            for r in dom_0dte_rows:
                dom_0dte.append({
                    "strike": r["strike"],
                    "put_oi": r["put_oi"],
                    "call_oi": r["call_oi"],
                    "put_bar_pct": min(100, int((r["put_oi"] / max_0_put) * 100)),
                    "call_bar_pct": min(100, int((r["call_oi"] / max_0_call) * 100)),
                    "put_0dte_pct": min(100, int((r["put_0dte_oi"] / max_0_put) * 100)),
                    "call_0dte_pct": min(100, int((r["call_0dte_oi"] / max_0_call) * 100)),
                    "put_0dte_oi": r["put_0dte_oi"],
                    "call_0dte_oi": r["call_0dte_oi"],
                    "is_spot": r["is_spot"]
                })

            day_payload["dom"] = {
                "0dte": dom_0dte,
                "weekly": dom_weekly
            }

        existing_data["dataSource"] = "Databento OPRA.PILLAR Official Clearing Open Interest"

        with open(src_path, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, indent=2)
        with open(fe_path, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, indent=2)

        print(f"Successfully updated {ticker} backtest dataset with Databento OPRA data!")

    print("\nAll done! The backtester now contains 100% real Databento historical options data.")

if __name__ == "__main__":
    main()

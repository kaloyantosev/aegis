"""
Builds public/data/prices.json: daily *total-return* closes (dividends and splits
adjusted) for every ticker the strategy uses, from Yahoo Finance via yfinance.

    pip install yfinance pandas
    python scripts/update_data.py

Format (compact, column-oriented):
    {"asOf": "YYYY-MM-DD", "adjusted": true, "dates": [...],
     "prices": {"SPY": [p0, p1, ...], ...}}   # null before a ticker's first trading day
"""
import json
import math
import sys
from pathlib import Path

import yfinance as yf

TICKERS = [
    "SPY", "QQQ", "TLT", "GLD", "BIL", "XLP", "XLE", "XLK", "DBC", "XLV", "XLI", "XLF", "XLG", "XLY", "ICLN", "TQQQ",
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "BRK-B", "TSLA", "LLY", "AVGO",
    "JPM", "WMT", "XOM", "V", "UNH", "MA", "PG", "JNJ", "HD", "ORCL",
    "CVX", "BAC", "KO", "CSCO", "INTC", "IBM", "GE", "PFE", "WFC", "C", "T",
]
START = "2006-01-01"
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "prices.json"


def sig(x: float, digits: int = 6):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    if x == 0:
        return 0
    return round(x, max(0, digits - 1 - int(math.floor(math.log10(abs(x))))))


def main():
    df = yf.download(TICKERS, start=START, auto_adjust=True, progress=False, threads=True)["Close"]
    df = df.dropna(how="all").sort_index()
    missing = [t for t in TICKERS if t not in df.columns or df[t].dropna().empty]
    if missing:
        sys.exit(f"No data for: {', '.join(missing)}")
    # Drop the trailing row if SPY has not printed yet (partial session).
    while df["SPY"].iloc[-1] != df["SPY"].iloc[-1]:
        df = df.iloc[:-1]

    out = {
        "asOf": df.index[-1].strftime("%Y-%m-%d"),
        "adjusted": True,
        "source": "Yahoo Finance via yfinance, auto_adjust=True (total return: dividends and splits)",
        "dates": [d.strftime("%Y-%m-%d") for d in df.index],
        "prices": {t: [sig(v) for v in df[t].tolist()] for t in TICKERS},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB), {len(out['dates'])} days, as of {out['asOf']}")
    for t in TICKERS:
        s = df[t].dropna()
        print(f"  {t:6s} {s.index[0].date()} -> {s.index[-1].date()}  {len(s)} days")


if __name__ == "__main__":
    main()

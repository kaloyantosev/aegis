# Aegis: stress-regime rotation backtest

A rules-based US equity strategy, backtested against the S&P 500:

- **Neutral:** the 10 highest-scoring US mega caps (size × momentum × trend), equal weight, reviewed monthly. With the sleeve switched off, an ETF mix (SPY/XLK/DBC/XLF).
- **Buy → Extreme Buy:** as the USI stress index rises, add Nasdaq and leveraged Nasdaq (TQQQ) in stages.
- **Bear Shield:** 75% T-bills (BIL) / 25% gold (GLD) in structural bear markets, exiting on capitulation or normalisation.

The site shows performance vs SPY, the USI stress index with every rotation, a card for every year from 2006, and the rotation log. Click a year (or set a date range) and the charts, metrics and log switch to that period. Metrics: return, CAGR, max drawdown, volatility and Sharpe (vs T-bills), each next to SPY.

## How it is tested

- **Total-return prices** (dividends reinvested) for every holding and the benchmark.
- **Next-day execution:** signals use the day's close and trade at the next close, with 0.1% cost on turnover.
- **Real data only, every year from 2006:** no synthetic back-fill. Before a fund existed a real instrument stands in and the year is marked †: TQQQ → QQQ (unleveraged) before Feb 2010, BIL → cash before May 2007, other missing funds' weight spread across the rest of the portfolio. Prices start in 2005 so indicators are warmed up on day one.
- **One continuous run:** each year or date range is a slice of the same equity curve, rebased to $10,000 at the prior close, so every year is computed the same way.
- **Robustness row:** the strategy without the Top-10 sleeve. That sleeve is chosen from today's mega caps, so it has survivorship bias.

The USI thresholds and Bear Shield triggers were tuned on this same history. Treat the backtest as in-sample.

## Data

`public/data/prices.json` holds dividend- and split-adjusted daily closes from Yahoo Finance (via `yfinance`). A GitHub Action refreshes it every week; to refresh by hand:

```bash
pip install yfinance pandas
python scripts/update_data.py
```

## Develop

```bash
npm install
npm run dev
```

Not investment advice.

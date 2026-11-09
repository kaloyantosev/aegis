# Aegis: stress-regime rotation backtest

A rules-based US equity strategy, backtested against the S&P 500:

- **Neutral:** the 10 highest-scoring US mega caps (size × momentum × trend), equal weight, reviewed monthly. With the sleeve switched off, an ETF mix (SPY/XLK/DBC/XLF).
- **Buy → Extreme Buy:** as the USI stress index rises, add Nasdaq and leveraged Nasdaq (TQQQ) in stages.
- **Bear Shield:** 75% T-bills (BIL) / 25% gold (GLD) in structural bear markets, exiting on capitulation or normalisation.

The site shows four ratios for the strategy and for SPY (CAGR, volatility, Sharpe vs T-bills, max drawdown), growth of $10,000, every calendar year side by side, and the rotation log.

## How it is tested

- **Total-return prices** (dividends reinvested) for every holding and the benchmark.
- **Next-day execution:** signals use the day's close and trade at the next close, with 0.1% cost on turnover.
- **Real data only:** the test starts in the first full year in which every fund it can hold has real prices (2011, because TQQQ launched in February 2010). No synthetic back-fill.
- **One continuous run:** yearly figures are cut from the same equity curve, so every year is computed the same way.
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

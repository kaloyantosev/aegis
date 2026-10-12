import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'app'))
from api.endpoints import get_13f_quarters, get_quarter_prices, generate_deterministic_inst_data
from database import SessionLocal
from sqlalchemy.orm import Session
import yfinance as yf

# test q_labels
labels = get_13f_quarters()
print("Labels:", labels)

# test history
hist = yf.Ticker("SPY").history(period="2y")
prices = get_quarter_prices(hist, labels)
print("Prices SPY:", prices)

# test deterministic fallback
print("Deterministic:", generate_deterministic_inst_data("SPY")["quarterPrices"])

import yfinance as yf

aapl = yf.Ticker("AAPL")

print("Institutional Holders:")
inst = aapl.institutional_holders
if inst is not None:
    print(inst.columns)
    print(inst.head())
else:
    print("None")

print("\nMutual Fund Holders:")
mf = aapl.mutualfund_holders
if mf is not None:
    print(mf.columns)
    print(mf.head())
else:
    print("None")

print("\nMajor Holders:")
major = aapl.major_holders
if major is not None:
    print(major)
else:
    print("None")

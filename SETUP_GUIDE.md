# Options & Technical Analysis Workstation Setup Guide

This guide details how to run, test, and verify your workstation app.

---

## 1. Directory Structure

Your workstation is structured as follows:
```
trading-workstation/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py # API endpoints (history, analyze, backtest, rotation)
│   │   ├── core/
│   │   │   ├── db.py        # SQLite Database engine configuration
│   │   │   ├── options.py   # Black-Scholes Gamma, GEX, and Max Pain calculators
│   │   │   └── backtest.py  # Historical backtest simulator
│   │   ├── models.py        # Database models (OptionMetrics, TechnicalLevels)
│   │   └── main.py          # FastAPI application startup & routing registry
│   ├── requirements.txt     # Python backend dependencies
│   ├── trading_workstation.db # Persistent SQLite Database file
│   └── venv/                # Python Virtual Environment
└── frontend/                # Next.js Application (TypeScript, Tailwind v4)
    ├── src/
    │   ├── app/
    │   │   ├── globals.css  # Global styles
    │   │   └── page.tsx     # Dashboard grid UI (searches, details, and rotation cards)
    │   └── components/
    │       └── TradingViewChart.tsx # Lightweight Charts React wrapper canvas
    └── package.json         # Node.js frontend dependencies
```

---

## 2. Running Locally

### Start Backend API
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Activate virtual environment:
   * **Windows Powershell**: `.\venv\Scripts\Activate.ps1`
   * **Windows CMD**: `.\venv\Scripts\activate.bat`
3. Run the uvicorn server:
   ```bash
   uvicorn app.main:app --port 8000 --reload
   ```
4. Access backend docs at `http://127.0.0.1:8000/docs`.

### Start Frontend Dashboard
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Start the hot-reloading development server:
   ```bash
   npm run dev
   ```
3. Open `http://127.0.0.1:3000` in your web browser to access the dashboard.

---

## 3. Product Roadmap for Selling to Funds
To maximize your likelihood score (target 8+/10) to secure a €50,000 buyout:
1. **Exchange API keys**:
   Update `generate_mock_options_chain` in [endpoints.py](file:///C:/Users/Terve/.gemini/antigravity/scratch/trading-workstation/backend/app/api/endpoints.py#L10) to query a live feed (Theta Data or Polygon.io).
2. **Collect Audit Trails**:
   Keep the SQLite database running continuously. The daily level logging builds the timestamped track record quant funds require during due diligence.

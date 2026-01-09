# SPX Finance Tracker - PRD

## Original Problem Statement
Build a comprehensive financial analysis application for options trading, starting with SPX quotes from Yahoo Finance.

## User Requirements
1. Current price display (simple quote)
2. Full quote (price, change, volume, high/low, etc.)
3. Historical chart with price data
4. Options chain viewer
5. Strategy scanners (Credit Spreads, Iron Condors, etc.)
6. Paper Trading portfolio
7. Performance analytics
8. Risk management

## Architecture
- **Backend**: FastAPI + yfinance library for Yahoo Finance data
- **Frontend**: React + Recharts for charting
- **Database**: MongoDB for portfolio positions

## Tech Stack
- Backend: FastAPI, yfinance, Motor (MongoDB), scipy (Black-Scholes Greeks)
- Frontend: React, Recharts, Tailwind CSS, Lucide Icons, shadcn/ui

---

## Features Implemented

### Core Features (Dec 2025)
- [x] Real-time SPX (^GSPC) price from Yahoo Finance
- [x] Price change and percentage display (green/red color coding)
- [x] Stats grid: Open, Day High, Day Low, Previous Close
- [x] Historical chart with period selector (1D, 5D, 1M, 3M, 1Y, 5Y)
- [x] 52-Week Range indicator with visual progress bar
- [x] Refresh button with loading state
- [x] Dark theme "Midnight Trader" design with glassmorphism cards
- [x] Auto-refresh at configurable intervals with live countdown
- [x] Options Chain with Calls/Puts tabs, Greeks display
- [x] Credit Spreads Scanner (Bull Put & Bear Call)
- [x] Iron Condors Scanner
- [x] Iron Butterflies Scanner
- [x] Straddles & Strangles Scanner
- [x] Calendar Spreads Scanner
- [x] P/L Chart visualization
- [x] Paper Trading Portfolio
- [x] Position export to CSV

### Major Refactoring (Jan 9, 2026)
- [x] **App.js Refactored**: Reduced from 2749 lines to 932 lines (66% reduction!)
- [x] **Custom Hooks Created**:
  - `useQuoteData` - Quote and market data management
  - `useOptionsData` - Options chain and strategies
  - `usePortfolio` - Portfolio positions CRUD
  - `useAutoClose` - Auto take-profit/stop-loss
  - `useAnalytics` - Trade journal calculations
  - `useRiskManagement` - Risk metrics
  - `useStrategyBuilder` - Multi-leg builder
- [x] **Components Extracted**:
  - `/components/portfolio/` - Portfolio modal, dialogs, tables
  - `/components/analytics/` - Analytics, Risk, Builder dashboards

### Trade Journal & Performance Analytics (Jan 9, 2026)
- [x] **Win Rate tracking** with Win/Loss count
- [x] **P/L Metrics**: Total P/L, Avg P/L, Profit Factor, Max Win, Max Loss
- [x] **Selectable Periods**: 7 Days, 30 Days, 90 Days, All Time
- [x] **Charts**: 
  - Win/Loss Distribution pie chart
  - P/L by Strategy Type bar chart
  - Monthly Performance timeline
  - P/L by Holding Period chart
- [x] **Best/Worst Trades** list

### Risk Management Dashboard (Jan 9, 2026)
- [x] **Trading Capital** input (configurable)
- [x] **Risk Metrics**:
  - Capital at Risk ($ and %)
  - Max Potential Loss
  - Margin Utilization
  - Available Capital
- [x] **Concentration Analysis**:
  - Risk by Symbol pie chart
  - Risk by Strategy pie chart
- [x] **Expiration Timeline** chart
- [x] **Risk Alerts** for high concentration or utilization
- [x] **Capital Utilization** progress bar

### Multi-Leg Strategy Builder (Jan 9, 2026)
- [x] **Custom Strategy Creation** with add/remove legs
- [x] **Quick Add Templates**:
  - Bull Put Spread
  - Bear Call Spread
  - Iron Condor
  - Straddle
  - Strangle
- [x] **Real-time Calculations**:
  - Net Premium (credit/debit)
  - Max Profit
  - Max Loss
  - Breakeven prices
- [x] **P/L at Expiration Chart** - live payoff diagram
- [x] **Save as Template** functionality
- [x] **Paper Trade** directly from builder

### Previous Session Features (Jan 9, 2026)
- [x] Portfolio current price fix for multi-expiration positions
- [x] Calendar Spread real-time P/L calculation
- [x] Auto Take Profit / Stop Loss automation
- [x] Auto-close by expiration time
- [x] Market-aware refresh pausing
- [x] Desktop app (Electron) with auto-update
- [x] Installers for Windows, macOS, Linux
- [x] iOS app scaffolding (React Native)

---

## API Endpoints
- `GET /api/quote` - Current quote with market state
- `GET /api/history` - Historical data
- `GET /api/options/expirations` - Options expiration dates
- `GET /api/options/chain` - Options chain with Greeks
- `GET /api/credit-spreads` - Credit spread opportunities
- `GET /api/iron-condors` - Iron condor opportunities
- `GET /api/iron-butterflies` - Iron butterfly opportunities
- `GET /api/straddles` - Straddle opportunities
- `GET /api/strangles` - Strangle opportunities
- `GET /api/calendar-spreads` - Calendar spread opportunities
- `GET /api/positions` - Portfolio positions
- `POST /api/positions` - Create position
- `PUT /api/positions/{id}/close` - Close position
- `DELETE /api/positions/{id}` - Delete position

---

## File Structure
```
/app
├── backend/
│   ├── models/position.py
│   ├── routes/portfolio.py
│   ├── services/yahoo_finance.py
│   └── server.py
├── frontend/src/
│   ├── hooks/
│   │   ├── useQuoteData.js
│   │   ├── useOptionsData.js
│   │   ├── usePortfolio.js
│   │   ├── useAutoClose.js
│   │   ├── useAnalytics.js
│   │   ├── useRiskManagement.js
│   │   └── useStrategyBuilder.js
│   ├── components/
│   │   ├── analytics/
│   │   │   ├── AnalyticsDashboard.jsx
│   │   │   ├── RiskDashboard.jsx
│   │   │   └── StrategyBuilder.jsx
│   │   ├── portfolio/
│   │   │   ├── PortfolioModal.jsx
│   │   │   ├── AutoClosePanel.jsx
│   │   │   ├── PositionsTable.jsx
│   │   │   ├── TradeDialog.jsx
│   │   │   └── ClosePositionDialog.jsx
│   │   └── ...
│   └── App.js (932 lines, refactored)
└── ...
```

---

## Backlog / Future Enhancements

### P1 - High Priority
- [ ] Save to Watchlist - Save and track specific strategies
- [ ] Complete iOS app UI implementation

### P2 - Medium Priority  
- [ ] Performance Report export (PDF/detailed CSV)
- [ ] Complete Electron app (custom icons, code signing)
- [ ] Historical IV percentile (requires data source)

### P3 - Lower Priority
- [ ] Fix remaining `react-hooks/exhaustive-deps` warnings
- [ ] Add technical indicators (MA, RSI, MACD) to charts
- [ ] Price alerts/notifications

---

## Testing Status
- **Last Test**: Jan 9, 2026
- **Test Report**: `/app/test_reports/iteration_5.json`
- **Result**: 100% pass rate (52 tests passed)
- **Features Tested**: Analytics, Risk Dashboard, Strategy Builder, all header buttons

---

## Known Issues
- None currently blocking

## Notes
- All strategy types support real-time P/L calculation
- Trading capital default is $100,000 (configurable)
- Auto-close thresholds: Take Profit 80%, Stop Loss 80%, Close before expiry 0.5h

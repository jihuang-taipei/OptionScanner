# SPX Finance Tracker - PRD

## Original Problem Statement
Build an app to retrieve SPX quote from Yahoo Finance

## User Requirements
1. Current price display (simple quote)
2. Full quote (price, change, volume, high/low, etc.)
3. Historical chart with price data

## Architecture
- **Backend**: FastAPI + yfinance library for Yahoo Finance data
- **Frontend**: React + Recharts for charting
- **Database**: MongoDB (available but not used for this MVP - data is fetched live)

## Core Features Implemented (Dec 2025)
- [x] Real-time SPX (^GSPC) price from Yahoo Finance
- [x] Price change and percentage display (green/red color coding)
- [x] Stats grid: Open, Day High, Day Low, Previous Close
- [x] Historical chart with period selector (1D, 5D, 1M, 3M, 1Y, 5Y)
- [x] 52-Week Range indicator with visual progress bar
- [x] Refresh button with loading state
- [x] Dark theme "Midnight Trader" design with glassmorphism cards
- [x] **Auto-refresh at configurable intervals** (Off, 10s, 30s, 1min, 5min) with live countdown
- [x] **Options Chain** (SPY as proxy) with Calls/Puts tabs, expiration selector, Strike, Bid/Ask, IV%, Volume, OI
- [x] **Greeks Display** (Delta, Gamma, Theta, Vega) calculated via Black-Scholes model with color-coded columns
- [x] **Credit Spreads Scanner** - Bull Put & Bear Call spreads with configurable width ($1-$20), showing net credit, max profit/loss, breakeven, risk/reward ratio, P(OTM)
- [x] **Credit Spread Filters** - Filter by Min Credit ($0-$2) and Max Risk/Reward (5:1 to 100:1), with Reset button and "X of Y" counter

## API Endpoints
- `GET /api/spx/quote` - Current SPX quote with all metrics
- `GET /api/spx/history?period={1d|5d|1mo|3mo|1y|5y}` - Historical data
- `GET /api/spx/options/expirations` - Available options expiration dates
- `GET /api/spx/options/chain?expiration={date}` - Options chain for specific expiration
- `GET /api/spx/credit-spreads?expiration={date}&spread={width}` - Credit spread opportunities

## Tech Stack
- Backend: FastAPI, yfinance, Motor (MongoDB), scipy (Black-Scholes Greeks)
- Frontend: React, Recharts, Tailwind CSS, Lucide Icons, shadcn/ui

## Backlog / Future Enhancements
- P1: Add multiple stock/index tracking
- P2: Price alerts/notifications
- P2: Save favorite watchlist to MongoDB
- P3: Technical indicators (MA, RSI, MACD)

## Features Implemented (Jan 2026)

### Portfolio Current Price Fix - Jan 9, 2026
- **Fixed**: Iron Condors and other strategies now show correct current prices in Portfolio
- **Root Cause**: The app was only using the currently selected expiration's options chain for price calculation, but positions could have different expirations
- **Solution**: 
  1. Added `positionOptionsCache` state to cache options chains for each position's expiration
  2. Modified `calculateCurrentStrategyPrice` to use cached data matching the position's expiration
  3. Fixed backend NaN/inf values in options data that caused JSON serialization errors
  4. Sorted positions in portfolio table (open positions appear first, then by newest date)
- **Files Modified**:
  - `/app/frontend/src/App.js` - Added caching logic and sorted positions
  - `/app/backend/services/yahoo_finance.py` - Fixed NaN/inf handling in `_process_options`

### Previous Session Fixes (from handoff)
- Fixed "off-by-one" date display bug with `formatExpDate` helper
- Implemented Portfolio CSV export (All/Open/Closed)
- Fixed CSV date format to avoid comma separation
- Added "N/A" display for Calendar Spread current prices (multi-expiration limitation)

## Known Limitations
- **Calendar Spreads**: Still show "N/A" for current price because they have legs with different expirations (requires fetching two option chains)

## Backlog / Future Enhancements
- P1: Save to Watchlist - Allow users to save and track specific strategies
- P2: Frontend refactoring - Extract App.js logic into custom hooks (useQuoteData, useOptionsData, etc.)
- P3: Real-time P/L for Calendar Spreads - Implement multi-expiration data fetching
- P3: Add `react-hooks/exhaustive-deps` lint fixes (recurring technical debt)

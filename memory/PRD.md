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

## API Endpoints
- `GET /api/spx/quote` - Current SPX quote with all metrics
- `GET /api/spx/history?period={1d|5d|1mo|3mo|1y|5y}` - Historical data
- `GET /api/spx/options/expirations` - Available options expiration dates
- `GET /api/spx/options/chain?expiration={date}` - Options chain for specific expiration

## Tech Stack
- Backend: FastAPI, yfinance, Motor (MongoDB), scipy (Black-Scholes Greeks)
- Frontend: React, Recharts, Tailwind CSS, Lucide Icons, shadcn/ui

## Backlog / Future Enhancements
- P1: Add multiple stock/index tracking
- P2: Price alerts/notifications
- P2: Save favorite watchlist to MongoDB
- P3: Technical indicators (MA, RSI, MACD)

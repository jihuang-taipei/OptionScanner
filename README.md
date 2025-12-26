# Options Scanner

A real-time options analysis application that displays stock quotes, historical charts, options chains with Greeks, and various options strategy scanners.

## Features

- **Configurable Symbol** - Track any stock/index (^SPX, SPY, QQQ, AAPL, etc.)
- **Real-time Quotes** - Live price data from Yahoo Finance
- **Historical Charts** - Interactive price charts with multiple timeframes
- **Options Chain** - Full options chain with calculated Greeks (Delta, Gamma, Theta, Vega)
- **Strategy Scanners**:
  - Credit Spreads (Bull Put / Bear Call)
  - Iron Condors
  - Iron Butterflies
  - Straddles & Strangles
  - Calendar Spreads
- **P/L Visualization** - Interactive profit/loss charts for strategies
- **Export to CSV** - Download options data for offline analysis

## Tech Stack

- **Frontend**: React, TailwindCSS, Recharts, Shadcn UI
- **Backend**: FastAPI, Python
- **Data Source**: Yahoo Finance (yfinance library)

## Running with Docker

### Quick Start

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build manually
docker build -t option-scanner .
docker run -p 8000:8000 option-scanner
```

The application will be available at `http://localhost:8000`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8000` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `MONGO_URL` | MongoDB connection (optional) | - |
| `DB_NAME` | Database name | `options_scanner` |

## Running Locally (Development)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
yarn install
yarn start
```

## API Endpoints

### Quote & History
- `GET /api/quote?symbol=SPY` - Get current quote
- `GET /api/history?symbol=SPY&period=1mo` - Get historical data

### Options
- `GET /api/options/expirations?symbol=SPY` - Get available expiration dates
- `GET /api/options/chain?symbol=SPY&expiration=2024-01-19` - Get options chain

### Strategy Scanners
- `GET /api/credit-spreads?symbol=SPY&expiration=...&spread=5`
- `GET /api/iron-condors?symbol=SPY&expiration=...&spread=5`
- `GET /api/iron-butterflies?symbol=SPY&expiration=...&wing=25`
- `GET /api/straddles?symbol=SPY&expiration=...`
- `GET /api/strangles?symbol=SPY&expiration=...&width=50`
- `GET /api/calendar-spreads?symbol=SPY&near_exp=...&far_exp=...`

## License

MIT

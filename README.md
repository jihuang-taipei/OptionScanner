# Option Scanner

A comprehensive options analysis and paper trading application for stocks and indices.

## Features

- **Real-time Quotes**: Live price data from Yahoo Finance
- **Options Chain**: Full options chain with Greeks (Delta, Gamma, Theta, Vega)
- **Strategy Scanners**:
  - Credit Spreads (Bull Put, Bear Call)
  - Iron Condors
  - Iron Butterflies
  - Straddles & Strangles
  - Calendar Spreads
- **P/L Visualization**: Interactive profit/loss charts for all strategies
- **Paper Trading**: Virtual portfolio to practice trading strategies
- **Export**: Download options data as CSV
- **Multi-Symbol**: Analyze any stock or index (SPX, SPY, AAPL, etc.)

## Quick Start with Docker

### Production Build (Recommended)

```bash
# Build and run the application
docker-compose up --build

# Access the application
open http://localhost:8000
```

### Development Mode

For development with hot reload:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Frontend: http://localhost:3000
# Backend API: http://localhost:8001
```

### With MongoDB (Paper Trading Persistence)

To enable persistent paper trading:

1. Edit `docker-compose.yml` and uncomment the MongoDB service
2. Uncomment the `depends_on` and environment variables in the app service
3. Run:

```bash
docker-compose up --build
```

## Manual Installation

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```

## Project Structure

```
option-scanner/
├── backend/
│   ├── server.py           # FastAPI app setup
│   ├── models/             # Pydantic schemas
│   │   ├── schemas.py      # Quote, options, strategy models
│   │   └── position.py     # Portfolio models
│   ├── routes/             # API endpoints
│   │   ├── quotes.py       # Price quotes
│   │   ├── options.py      # Options chain
│   │   ├── strategies.py   # Strategy scanners
│   │   └── portfolio.py    # Paper trading
│   └── services/           # Business logic
│       ├── yahoo_finance.py
│       └── greeks.py
├── frontend/
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   ├── utils/          # Utility functions
│   │   │   ├── calculations.js
│   │   │   ├── exportUtils.js
│   │   │   └── constants.js
│   │   └── components/     # Reusable components
│   └── public/
├── Dockerfile              # Production build
├── docker-compose.yml      # Production deployment
└── docker-compose.dev.yml  # Development setup
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/quote?symbol=SPY` | Get current quote |
| `GET /api/history?symbol=SPY&period=1mo` | Historical data |
| `GET /api/options/expirations?symbol=SPY` | Available expirations |
| `GET /api/options/chain?symbol=SPY&expiration=DATE` | Options chain |
| `GET /api/iron-condors?symbol=SPY&expiration=DATE` | Iron Condor scanner |
| `GET /api/straddles?symbol=SPY&expiration=DATE` | Straddle scanner |
| `GET /api/calendar-spreads?symbol=SPY&near_exp=DATE&far_exp=DATE` | Calendar spreads |
| `POST /api/positions` | Create paper trade |
| `GET /api/positions` | List all positions |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8000 | Server port |
| `CORS_ORIGINS` | * | Allowed CORS origins |
| `MONGO_URL` | - | MongoDB connection (optional) |
| `DB_NAME` | options_scanner | Database name |
| `REACT_APP_BACKEND_URL` | - | Backend URL for frontend |

## License

MIT

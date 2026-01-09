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

---

## Windows Installation

### Quick Install (Recommended)

1. **Install Docker Desktop**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
2. **Start Docker Desktop**: Wait for the whale icon to appear in the system tray
3. **Run the Installer**: 
   - Option A: Run `installer\windows\install.bat`
   - Option B: Run `installer\windows\install.ps1` in PowerShell
4. **Use Desktop Shortcuts**: Double-click "Options Scanner" to start

### Manual Windows Installation

```batch
# Open Command Prompt in the app folder
cd C:\path\to\OptionsScanner

# Build and start
docker-compose up -d

# Open browser
start http://localhost:8000
```

### Windows Files

| File | Description |
|------|-------------|
| `start-options-scanner.bat` | Start the application |
| `stop-options-scanner.bat` | Stop the application |
| `view-logs.bat` | View application logs |
| `installer\windows\install.bat` | Windows installer (batch) |
| `installer\windows\install.ps1` | Windows installer (PowerShell) |
| `installer\windows\options-scanner.iss` | Inno Setup script for GUI installer |

---

## macOS Installation

### Quick Install

1. **Install Docker Desktop**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
2. **Start Docker Desktop**: Wait for the whale icon in the menu bar
3. **Run the Installer**:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
4. **Launch**: Open "Options Scanner" from Applications

### macOS Files

| File | Description |
|------|-------------|
| `start.sh` | Start the application |
| `stop.sh` | Stop the application |
| `logs.sh` | View application logs |
| `installer/macos/install.sh` | macOS installer |

---

## Linux Installation

### Prerequisites

Install Docker Engine for your distribution:

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in
```

**Fedora:**
```bash
sudo dnf install docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

**Arch Linux:**
```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

### Quick Install

```bash
chmod +x install.sh
./install.sh
```

### Linux Files

| File | Description |
|------|-------------|
| `start.sh` | Start the application |
| `stop.sh` | Stop the application |
| `logs.sh` | View application logs |
| `installer/linux/install.sh` | Linux installer |

---

## Cross-Platform Scripts

These scripts work on both macOS and Linux:

| Script | Description |
|--------|-------------|
| `install.sh` | Auto-detects OS and runs appropriate installer |
| `start.sh` | Start the application |
| `stop.sh` | Stop the application |
| `logs.sh` | View live logs |

---

## Creating a Distributable Package

### Windows
```batch
installer\windows\create-package.bat
```

### macOS/Linux
```bash
# Create a tar.gz archive
tar -czvf OptionsScanner.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    backend frontend installer \
    Dockerfile docker-compose*.yml \
    *.sh *.bat *.md
```

---

## License

MIT

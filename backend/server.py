from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import yfinance as yf
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class SPXQuote(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    previous_close: float
    open: float
    day_high: float
    day_low: float
    volume: Optional[int] = None
    market_cap: Optional[float] = None
    fifty_two_week_high: float
    fifty_two_week_low: float
    timestamp: str

class HistoricalDataPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[int] = None

class SPXHistory(BaseModel):
    symbol: str
    period: str
    data: List[HistoricalDataPoint]

class OptionContract(BaseModel):
    strike: float
    lastPrice: float
    bid: float
    ask: float
    change: float
    percentChange: float
    volume: Optional[int] = None
    openInterest: Optional[int] = None
    impliedVolatility: float
    inTheMoney: bool
    # Greeks
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None

class OptionsChain(BaseModel):
    symbol: str
    expirationDate: str
    calls: List[OptionContract]
    puts: List[OptionContract]

class OptionsExpirations(BaseModel):
    symbol: str
    expirations: List[str]


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


@api_router.get("/spx/quote", response_model=SPXQuote)
async def get_spx_quote():
    """Get current SPX (S&P 500) quote from Yahoo Finance"""
    try:
        # ^GSPC is the Yahoo Finance ticker for S&P 500 Index
        ticker = yf.Ticker("^GSPC")
        info = ticker.info
        
        # Get current price data
        hist = ticker.history(period="2d")
        
        if hist.empty:
            raise HTTPException(status_code=503, detail="Unable to fetch market data")
        
        current_price = float(hist['Close'].iloc[-1])
        previous_close = float(info.get('previousClose', hist['Close'].iloc[-2] if len(hist) > 1 else current_price))
        
        change = current_price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close else 0
        
        quote = SPXQuote(
            symbol="^GSPC",
            price=round(current_price, 2),
            change=round(change, 2),
            change_percent=round(change_percent, 2),
            previous_close=round(previous_close, 2),
            open=round(float(info.get('open', hist['Open'].iloc[-1])), 2),
            day_high=round(float(info.get('dayHigh', hist['High'].iloc[-1])), 2),
            day_low=round(float(info.get('dayLow', hist['Low'].iloc[-1])), 2),
            volume=int(hist['Volume'].iloc[-1]) if hist['Volume'].iloc[-1] > 0 else None,
            market_cap=None,  # Index doesn't have market cap
            fifty_two_week_high=round(float(info.get('fiftyTwoWeekHigh', 0)), 2),
            fifty_two_week_low=round(float(info.get('fiftyTwoWeekLow', 0)), 2),
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        logger.info(f"SPX Quote fetched: {quote.price}")
        return quote
        
    except Exception as e:
        logger.error(f"Error fetching SPX quote: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch SPX data: {str(e)}")


@api_router.get("/spx/history", response_model=SPXHistory)
async def get_spx_history(period: str = "1mo"):
    """Get historical SPX data for charting
    
    Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    """
    valid_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
    
    if period not in valid_periods:
        raise HTTPException(status_code=400, detail=f"Invalid period. Valid options: {', '.join(valid_periods)}")
    
    try:
        ticker = yf.Ticker("^GSPC")
        hist = ticker.history(period=period)
        
        if hist.empty:
            raise HTTPException(status_code=503, detail="Unable to fetch historical data")
        
        data_points = []
        for date, row in hist.iterrows():
            data_points.append(HistoricalDataPoint(
                date=date.strftime("%Y-%m-%d"),
                open=round(float(row['Open']), 2),
                high=round(float(row['High']), 2),
                low=round(float(row['Low']), 2),
                close=round(float(row['Close']), 2),
                volume=int(row['Volume']) if row['Volume'] > 0 else None
            ))
        
        logger.info(f"SPX History fetched: {len(data_points)} data points for period {period}")
        
        return SPXHistory(
            symbol="^GSPC",
            period=period,
            data=data_points
        )
        
    except Exception as e:
        logger.error(f"Error fetching SPX history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical data: {str(e)}")


@api_router.get("/spx/options/expirations", response_model=OptionsExpirations)
async def get_options_expirations():
    """Get available expiration dates for SPX options"""
    try:
        # Use SPY as proxy since ^GSPC doesn't have tradeable options
        # SPX options trade under ^SPX but yfinance uses SPY for liquid options
        ticker = yf.Ticker("SPY")
        expirations = ticker.options
        
        if not expirations:
            raise HTTPException(status_code=503, detail="No options data available")
        
        return OptionsExpirations(
            symbol="SPY",
            expirations=list(expirations)
        )
        
    except Exception as e:
        logger.error(f"Error fetching options expirations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch options expirations: {str(e)}")


@api_router.get("/spx/options/chain", response_model=OptionsChain)
async def get_options_chain(expiration: str):
    """Get options chain for a specific expiration date"""
    try:
        ticker = yf.Ticker("SPY")
        
        # Validate expiration date
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date. Available: {', '.join(ticker.options[:5])}...")
        
        opt_chain = ticker.option_chain(expiration)
        
        # Process calls
        calls = []
        for _, row in opt_chain.calls.iterrows():
            calls.append(OptionContract(
                strike=round(float(row['strike']), 2),
                lastPrice=round(float(row['lastPrice']), 2),
                bid=round(float(row['bid']), 2),
                ask=round(float(row['ask']), 2),
                change=round(float(row['change']) if not pd.isna(row['change']) else 0, 2),
                percentChange=round(float(row['percentChange']) if not pd.isna(row['percentChange']) else 0, 2),
                volume=int(row['volume']) if not pd.isna(row['volume']) else None,
                openInterest=int(row['openInterest']) if not pd.isna(row['openInterest']) else None,
                impliedVolatility=round(float(row['impliedVolatility']) * 100, 2),
                inTheMoney=bool(row['inTheMoney']),
                delta=round(float(row['delta']), 4) if 'delta' in row and not pd.isna(row.get('delta')) else None,
                gamma=round(float(row['gamma']), 4) if 'gamma' in row and not pd.isna(row.get('gamma')) else None,
                theta=round(float(row['theta']), 4) if 'theta' in row and not pd.isna(row.get('theta')) else None,
                vega=round(float(row['vega']), 4) if 'vega' in row and not pd.isna(row.get('vega')) else None
            ))
        
        # Process puts
        puts = []
        for _, row in opt_chain.puts.iterrows():
            puts.append(OptionContract(
                strike=round(float(row['strike']), 2),
                lastPrice=round(float(row['lastPrice']), 2),
                bid=round(float(row['bid']), 2),
                ask=round(float(row['ask']), 2),
                change=round(float(row['change']) if not pd.isna(row['change']) else 0, 2),
                percentChange=round(float(row['percentChange']) if not pd.isna(row['percentChange']) else 0, 2),
                volume=int(row['volume']) if not pd.isna(row['volume']) else None,
                openInterest=int(row['openInterest']) if not pd.isna(row['openInterest']) else None,
                impliedVolatility=round(float(row['impliedVolatility']) * 100, 2),
                inTheMoney=bool(row['inTheMoney']),
                delta=round(float(row['delta']), 4) if 'delta' in row and not pd.isna(row.get('delta')) else None,
                gamma=round(float(row['gamma']), 4) if 'gamma' in row and not pd.isna(row.get('gamma')) else None,
                theta=round(float(row['theta']), 4) if 'theta' in row and not pd.isna(row.get('theta')) else None,
                vega=round(float(row['vega']), 4) if 'vega' in row and not pd.isna(row.get('vega')) else None
            ))
        
        logger.info(f"Options chain fetched: {len(calls)} calls, {len(puts)} puts for {expiration}")
        
        return OptionsChain(
            symbol="SPY",
            expirationDate=expiration,
            calls=calls,
            puts=puts
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching options chain: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch options chain: {str(e)}")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

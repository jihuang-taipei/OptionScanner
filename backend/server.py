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
import numpy as np
from scipy.stats import norm
import math

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


class CreditSpread(BaseModel):
    spread_type: str  # "Bull Put" or "Bear Call"
    sell_strike: float
    buy_strike: float
    sell_premium: float
    buy_premium: float
    net_credit: float
    max_profit: float
    max_loss: float
    breakeven: float
    risk_reward_ratio: float
    probability_otm: Optional[float] = None
    sell_delta: Optional[float] = None
    buy_delta: Optional[float] = None


class CreditSpreadsResponse(BaseModel):
    symbol: str
    expiration: str
    current_price: float
    spread_width: int
    bull_put_spreads: List[CreditSpread]
    bear_call_spreads: List[CreditSpread]


class IronCondor(BaseModel):
    # Bull Put Spread (lower side)
    put_sell_strike: float
    put_buy_strike: float
    put_credit: float
    # Bear Call Spread (upper side)
    call_sell_strike: float
    call_buy_strike: float
    call_credit: float
    # Combined metrics
    net_credit: float
    max_profit: float
    max_loss: float
    lower_breakeven: float
    upper_breakeven: float
    profit_zone_width: float
    profit_zone_pct: float
    risk_reward_ratio: float
    probability_profit: Optional[float] = None


class IronCondorsResponse(BaseModel):
    symbol: str
    expiration: str
    current_price: float
    spread_width: int
    iron_condors: List[IronCondor]


class IronButterfly(BaseModel):
    # Center strike (ATM) - sell both call and put
    center_strike: float
    call_premium: float
    put_premium: float
    # Wings
    upper_strike: float  # Buy call
    lower_strike: float  # Buy put
    upper_cost: float
    lower_cost: float
    # Combined metrics
    net_credit: float
    max_profit: float
    max_loss: float
    lower_breakeven: float
    upper_breakeven: float
    risk_reward_ratio: float
    probability_profit: Optional[float] = None
    distance_from_spot: float  # How far center is from current price


class IronButterfliesResponse(BaseModel):
    symbol: str
    expiration: str
    current_price: float
    wing_width: int
    iron_butterflies: List[IronButterfly]


class Straddle(BaseModel):
    strike: float
    call_price: float
    put_price: float
    total_cost: float
    lower_breakeven: float
    upper_breakeven: float
    breakeven_move_pct: float  # % move needed to breakeven
    distance_from_spot: float
    call_iv: float
    put_iv: float
    avg_iv: float


class Strangle(BaseModel):
    call_strike: float
    put_strike: float
    call_price: float
    put_price: float
    total_cost: float
    lower_breakeven: float
    upper_breakeven: float
    breakeven_move_pct: float
    width: float  # Distance between strikes
    call_iv: float
    put_iv: float
    avg_iv: float


class StraddlesResponse(BaseModel):
    symbol: str
    expiration: str
    current_price: float
    straddles: List[Straddle]


class StranglesResponse(BaseModel):
    symbol: str
    expiration: str
    current_price: float
    strangles: List[Strangle]


class CalendarSpread(BaseModel):
    strike: float
    option_type: str  # 'call' or 'put'
    near_expiration: str
    far_expiration: str
    near_price: float  # sell (collect)
    far_price: float  # buy (pay)
    net_debit: float
    near_iv: float
    far_iv: float
    iv_difference: float
    near_theta: Optional[float] = None
    far_theta: Optional[float] = None
    theta_edge: Optional[float] = None
    distance_from_spot: float


class CalendarSpreadsResponse(BaseModel):
    symbol: str
    near_expiration: str
    far_expiration: str
    current_price: float
    calendar_spreads: List[CalendarSpread]


def calculate_greeks(S: float, K: float, T: float, r: float, sigma: float, option_type: str = 'call'):
    """
    Calculate option Greeks using Black-Scholes model
    S: Current stock price
    K: Strike price
    T: Time to expiration (in years)
    r: Risk-free rate (annual)
    sigma: Implied volatility (as decimal, e.g., 0.20 for 20%)
    option_type: 'call' or 'put'
    """
    if T <= 0 or sigma <= 0:
        return None, None, None, None
    
    try:
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        
        # Delta
        if option_type == 'call':
            delta = norm.cdf(d1)
        else:
            delta = norm.cdf(d1) - 1
        
        # Gamma (same for calls and puts)
        gamma = norm.pdf(d1) / (S * sigma * math.sqrt(T))
        
        # Theta (per day)
        if option_type == 'call':
            theta = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T)) 
                     - r * K * math.exp(-r * T) * norm.cdf(d2)) / 365
        else:
            theta = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T)) 
                     + r * K * math.exp(-r * T) * norm.cdf(-d2)) / 365
        
        # Vega (per 1% change in volatility)
        vega = S * norm.pdf(d1) * math.sqrt(T) / 100
        
        return round(delta, 4), round(gamma, 6), round(theta, 4), round(vega, 4)
    except:
        return None, None, None, None


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


@api_router.get("/quote", response_model=SPXQuote)
async def get_quote(symbol: str = "^GSPC"):
    """Get current quote for any stock/index from Yahoo Finance
    
    symbol: Yahoo Finance ticker symbol (e.g., ^GSPC, SPY, AAPL, ^NDX)
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        # Get current price data
        hist = ticker.history(period="2d")
        
        if hist.empty:
            raise HTTPException(status_code=503, detail=f"Unable to fetch market data for {symbol}")
        
        current_price = float(hist['Close'].iloc[-1])
        previous_close = float(info.get('previousClose', hist['Close'].iloc[-2] if len(hist) > 1 else current_price))
        
        change = current_price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close else 0
        
        quote = SPXQuote(
            symbol=symbol,
            price=round(current_price, 2),
            change=round(change, 2),
            change_percent=round(change_percent, 2),
            previous_close=round(previous_close, 2),
            open=round(float(info.get('open', hist['Open'].iloc[-1])), 2),
            day_high=round(float(info.get('dayHigh', hist['High'].iloc[-1])), 2),
            day_low=round(float(info.get('dayLow', hist['Low'].iloc[-1])), 2),
            volume=int(hist['Volume'].iloc[-1]) if hist['Volume'].iloc[-1] > 0 else None,
            market_cap=info.get('marketCap'),
            fifty_two_week_high=round(float(info.get('fiftyTwoWeekHigh', 0)), 2),
            fifty_two_week_low=round(float(info.get('fiftyTwoWeekLow', 0)), 2),
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        logger.info(f"Quote fetched for {symbol}: {quote.price}")
        return quote
        
    except Exception as e:
        logger.error(f"Error fetching quote for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch data for {symbol}: {str(e)}")


# Keep old endpoint for backwards compatibility
@api_router.get("/spx/quote", response_model=SPXQuote)
async def get_spx_quote():
    """Get current SPX (S&P 500) quote - backwards compatible endpoint"""
    return await get_quote("^GSPC")


@api_router.get("/history", response_model=SPXHistory)
async def get_history(symbol: str = "^GSPC", period: str = "1mo"):
    """Get historical data for any stock/index
    
    symbol: Yahoo Finance ticker symbol
    period: Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    """
    valid_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
    
    if period not in valid_periods:
        raise HTTPException(status_code=400, detail=f"Invalid period. Valid options: {', '.join(valid_periods)}")
    
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)
        
        if hist.empty:
            raise HTTPException(status_code=503, detail=f"Unable to fetch historical data for {symbol}")
        
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
        
        logger.info(f"History fetched for {symbol}: {len(data_points)} data points for period {period}")
        
        return SPXHistory(
            symbol=symbol,
            period=period,
            data=data_points
        )
        
    except Exception as e:
        logger.error(f"Error fetching history for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical data for {symbol}: {str(e)}")


# Keep old endpoint for backwards compatibility
@api_router.get("/spx/history", response_model=SPXHistory)
async def get_spx_history(period: str = "1mo"):
    """Get historical SPX data - backwards compatible endpoint"""
    return await get_history("^GSPC", period)


@api_router.get("/options/expirations", response_model=OptionsExpirations)
async def get_options_expirations(symbol: str = "^SPX"):
    """Get available expiration dates for options
    
    symbol: Yahoo Finance ticker symbol (e.g., ^SPX, SPY, AAPL, QQQ)
    """
    try:
        ticker = yf.Ticker(symbol)
        expirations = ticker.options
        
        if not expirations:
            raise HTTPException(status_code=503, detail=f"No options data available for {symbol}")
        
        return OptionsExpirations(
            symbol=symbol,
            expirations=list(expirations)
        )
        
    except Exception as e:
        logger.error(f"Error fetching options expirations for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch options expirations for {symbol}: {str(e)}")


# Keep old endpoint for backwards compatibility
@api_router.get("/spx/options/expirations", response_model=OptionsExpirations)
async def get_spx_options_expirations():
    """Get SPX options expirations - backwards compatible endpoint"""
    return await get_options_expirations("^SPX")


@api_router.get("/spx/options/chain", response_model=OptionsChain)
async def get_options_chain(expiration: str):
    """Get options chain for a specific expiration date"""
    try:
        ticker = yf.Ticker("^SPX")
        
        # Validate expiration date
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date. Available: {', '.join(ticker.options[:5])}...")
        
        opt_chain = ticker.option_chain(expiration)
        
        # Get current SPX price for Greeks calculation
        spx_ticker = yf.Ticker("^GSPC")
        spx_hist = spx_ticker.history(period="1d")
        current_price = float(spx_hist['Close'].iloc[-1]) if not spx_hist.empty else 5900.0
        
        # Calculate time to expiration in years
        exp_date = datetime.strptime(expiration, "%Y-%m-%d")
        today = datetime.now()
        days_to_exp = (exp_date - today).days
        T = max(days_to_exp / 365.0, 1/365.0)  # At least 1 day
        
        # Risk-free rate (approximate)
        r = 0.045  # 4.5% 
        
        # Process calls
        calls = []
        for _, row in opt_chain.calls.iterrows():
            strike = float(row['strike'])
            iv = float(row['impliedVolatility']) if not pd.isna(row['impliedVolatility']) else 0.3
            
            delta, gamma, theta, vega = calculate_greeks(current_price, strike, T, r, iv, 'call')
            
            calls.append(OptionContract(
                strike=round(strike, 2),
                lastPrice=round(float(row['lastPrice']), 2),
                bid=round(float(row['bid']), 2),
                ask=round(float(row['ask']), 2),
                change=round(float(row['change']) if not pd.isna(row['change']) else 0, 2),
                percentChange=round(float(row['percentChange']) if not pd.isna(row['percentChange']) else 0, 2),
                volume=int(row['volume']) if not pd.isna(row['volume']) else None,
                openInterest=int(row['openInterest']) if not pd.isna(row['openInterest']) else None,
                impliedVolatility=round(iv * 100, 2),
                inTheMoney=bool(row['inTheMoney']),
                delta=delta,
                gamma=gamma,
                theta=theta,
                vega=vega
            ))
        
        # Process puts
        puts = []
        for _, row in opt_chain.puts.iterrows():
            strike = float(row['strike'])
            iv = float(row['impliedVolatility']) if not pd.isna(row['impliedVolatility']) else 0.3
            
            delta, gamma, theta, vega = calculate_greeks(current_price, strike, T, r, iv, 'put')
            
            puts.append(OptionContract(
                strike=round(strike, 2),
                lastPrice=round(float(row['lastPrice']), 2),
                bid=round(float(row['bid']), 2),
                ask=round(float(row['ask']), 2),
                change=round(float(row['change']) if not pd.isna(row['change']) else 0, 2),
                percentChange=round(float(row['percentChange']) if not pd.isna(row['percentChange']) else 0, 2),
                volume=int(row['volume']) if not pd.isna(row['volume']) else None,
                openInterest=int(row['openInterest']) if not pd.isna(row['openInterest']) else None,
                impliedVolatility=round(iv * 100, 2),
                inTheMoney=bool(row['inTheMoney']),
                delta=delta,
                gamma=gamma,
                theta=theta,
                vega=vega
            ))
        
        logger.info(f"Options chain fetched: {len(calls)} calls, {len(puts)} puts for {expiration}")
        
        return OptionsChain(
            symbol="^SPX",
            expirationDate=expiration,
            calls=calls,
            puts=puts
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching options chain: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch options chain: {str(e)}")


@api_router.get("/spx/credit-spreads", response_model=CreditSpreadsResponse)
async def get_credit_spreads(expiration: str, spread: int = 5):
    """Get credit spread opportunities for a specific expiration date
    
    spread: Width of the spread in dollars (default 5)
    """
    try:
        ticker = yf.Ticker("^SPX")
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date")
        
        opt_chain = ticker.option_chain(expiration)
        
        # Get current SPX price
        spx_ticker = yf.Ticker("^GSPC")
        spx_hist = spx_ticker.history(period="1d")
        current_price = float(spx_hist['Close'].iloc[-1]) if not spx_hist.empty else 5900.0
        
        # Calculate time to expiration
        exp_date = datetime.strptime(expiration, "%Y-%m-%d")
        today = datetime.now()
        days_to_exp = (exp_date - today).days
        T = max(days_to_exp / 365.0, 1/365.0)
        r = 0.045
        
        # Process puts for Bull Put Spreads (sell higher, buy lower)
        puts_df = opt_chain.puts.copy()
        puts_df = puts_df.sort_values('strike')
        
        bull_put_spreads = []
        for i, sell_row in puts_df.iterrows():
            sell_strike = float(sell_row['strike'])
            buy_strike = sell_strike - spread
            
            # Find the buy leg
            buy_rows = puts_df[puts_df['strike'] == buy_strike]
            if buy_rows.empty:
                continue
            
            buy_row = buy_rows.iloc[0]
            
            # Only show OTM spreads (sell strike below current price)
            if sell_strike >= current_price:
                continue
            
            sell_bid = float(sell_row['bid']) if not pd.isna(sell_row['bid']) else 0
            buy_ask = float(buy_row['ask']) if not pd.isna(buy_row['ask']) else 0
            
            if sell_bid <= 0 or buy_ask <= 0:
                continue
            
            net_credit = sell_bid - buy_ask
            if net_credit <= 0:
                continue
            
            max_profit = net_credit * 100  # per contract
            max_loss = (spread - net_credit) * 100
            breakeven = sell_strike - net_credit
            risk_reward = max_loss / max_profit if max_profit > 0 else 999
            
            # Calculate deltas
            sell_iv = float(sell_row['impliedVolatility']) if not pd.isna(sell_row['impliedVolatility']) else 0.3
            buy_iv = float(buy_row['impliedVolatility']) if not pd.isna(buy_row['impliedVolatility']) else 0.3
            
            sell_delta, _, _, _ = calculate_greeks(current_price, sell_strike, T, r, sell_iv, 'put')
            buy_delta, _, _, _ = calculate_greeks(current_price, buy_strike, T, r, buy_iv, 'put')
            
            # Probability OTM (roughly 1 - |delta| for the short strike)
            prob_otm = (1 - abs(sell_delta)) * 100 if sell_delta else None
            
            bull_put_spreads.append(CreditSpread(
                spread_type="Bull Put",
                sell_strike=sell_strike,
                buy_strike=buy_strike,
                sell_premium=round(sell_bid, 2),
                buy_premium=round(buy_ask, 2),
                net_credit=round(net_credit, 2),
                max_profit=round(max_profit, 2),
                max_loss=round(max_loss, 2),
                breakeven=round(breakeven, 2),
                risk_reward_ratio=round(risk_reward, 2),
                probability_otm=round(prob_otm, 1) if prob_otm else None,
                sell_delta=sell_delta,
                buy_delta=buy_delta
            ))
        
        # Process calls for Bear Call Spreads (sell lower, buy higher)
        calls_df = opt_chain.calls.copy()
        calls_df = calls_df.sort_values('strike')
        
        bear_call_spreads = []
        for i, sell_row in calls_df.iterrows():
            sell_strike = float(sell_row['strike'])
            buy_strike = sell_strike + spread
            
            # Find the buy leg
            buy_rows = calls_df[calls_df['strike'] == buy_strike]
            if buy_rows.empty:
                continue
            
            buy_row = buy_rows.iloc[0]
            
            # Only show OTM spreads (sell strike above current price)
            if sell_strike <= current_price:
                continue
            
            sell_bid = float(sell_row['bid']) if not pd.isna(sell_row['bid']) else 0
            buy_ask = float(buy_row['ask']) if not pd.isna(buy_row['ask']) else 0
            
            if sell_bid <= 0 or buy_ask <= 0:
                continue
            
            net_credit = sell_bid - buy_ask
            if net_credit <= 0:
                continue
            
            max_profit = net_credit * 100
            max_loss = (spread - net_credit) * 100
            breakeven = sell_strike + net_credit
            risk_reward = max_loss / max_profit if max_profit > 0 else 999
            
            # Calculate deltas
            sell_iv = float(sell_row['impliedVolatility']) if not pd.isna(sell_row['impliedVolatility']) else 0.3
            buy_iv = float(buy_row['impliedVolatility']) if not pd.isna(buy_row['impliedVolatility']) else 0.3
            
            sell_delta, _, _, _ = calculate_greeks(current_price, sell_strike, T, r, sell_iv, 'call')
            buy_delta, _, _, _ = calculate_greeks(current_price, buy_strike, T, r, buy_iv, 'call')
            
            prob_otm = (1 - abs(sell_delta)) * 100 if sell_delta else None
            
            bear_call_spreads.append(CreditSpread(
                spread_type="Bear Call",
                sell_strike=sell_strike,
                buy_strike=buy_strike,
                sell_premium=round(sell_bid, 2),
                buy_premium=round(buy_ask, 2),
                net_credit=round(net_credit, 2),
                max_profit=round(max_profit, 2),
                max_loss=round(max_loss, 2),
                breakeven=round(breakeven, 2),
                risk_reward_ratio=round(risk_reward, 2),
                probability_otm=round(prob_otm, 1) if prob_otm else None,
                sell_delta=sell_delta,
                buy_delta=buy_delta
            ))
        
        # Sort by probability OTM (highest first) and limit results
        bull_put_spreads.sort(key=lambda x: x.probability_otm or 0, reverse=True)
        bear_call_spreads.sort(key=lambda x: x.probability_otm or 0, reverse=True)
        
        logger.info(f"Credit spreads fetched: {len(bull_put_spreads)} bull puts, {len(bear_call_spreads)} bear calls")
        
        return CreditSpreadsResponse(
            symbol="^SPX",
            expiration=expiration,
            current_price=round(current_price, 2),
            spread_width=spread,
            bull_put_spreads=bull_put_spreads[:15],  # Top 15
            bear_call_spreads=bear_call_spreads[:15]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching credit spreads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch credit spreads: {str(e)}")


@api_router.get("/spx/iron-condors", response_model=IronCondorsResponse)
async def get_iron_condors(expiration: str, spread: int = 5):
    """Get Iron Condor opportunities for a specific expiration date
    
    An Iron Condor combines a Bull Put Spread (below price) with a Bear Call Spread (above price)
    spread: Width of each spread leg in dollars (default 5)
    """
    try:
        ticker = yf.Ticker("^SPX")
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date")
        
        opt_chain = ticker.option_chain(expiration)
        
        # Get current SPX price
        spx_ticker = yf.Ticker("^GSPC")
        spx_hist = spx_ticker.history(period="1d")
        current_price = float(spx_hist['Close'].iloc[-1]) if not spx_hist.empty else 5900.0
        
        # Calculate time to expiration
        exp_date = datetime.strptime(expiration, "%Y-%m-%d")
        today = datetime.now()
        days_to_exp = (exp_date - today).days
        T = max(days_to_exp / 365.0, 1/365.0)
        r = 0.045
        
        # Process puts for Bull Put Spreads (below current price)
        puts_df = opt_chain.puts.copy()
        puts_df = puts_df.sort_values('strike')
        
        bull_puts = []
        for _, sell_row in puts_df.iterrows():
            sell_strike = float(sell_row['strike'])
            buy_strike = sell_strike - spread
            
            buy_rows = puts_df[puts_df['strike'] == buy_strike]
            if buy_rows.empty:
                continue
            
            # Only OTM puts (sell strike below current price)
            if sell_strike >= current_price:
                continue
                
            buy_row = buy_rows.iloc[0]
            sell_bid = float(sell_row['bid']) if not pd.isna(sell_row['bid']) else 0
            buy_ask = float(buy_row['ask']) if not pd.isna(buy_row['ask']) else 0
            
            if sell_bid <= 0 or buy_ask <= 0:
                continue
            
            net_credit = sell_bid - buy_ask
            if net_credit <= 0:
                continue
            
            sell_iv = float(sell_row['impliedVolatility']) if not pd.isna(sell_row['impliedVolatility']) else 0.3
            sell_delta, _, _, _ = calculate_greeks(current_price, sell_strike, T, r, sell_iv, 'put')
            
            bull_puts.append({
                'sell_strike': sell_strike,
                'buy_strike': buy_strike,
                'credit': net_credit,
                'sell_delta': sell_delta
            })
        
        # Process calls for Bear Call Spreads (above current price)
        calls_df = opt_chain.calls.copy()
        calls_df = calls_df.sort_values('strike')
        
        bear_calls = []
        for _, sell_row in calls_df.iterrows():
            sell_strike = float(sell_row['strike'])
            buy_strike = sell_strike + spread
            
            buy_rows = calls_df[calls_df['strike'] == buy_strike]
            if buy_rows.empty:
                continue
            
            # Only OTM calls (sell strike above current price)
            if sell_strike <= current_price:
                continue
                
            buy_row = buy_rows.iloc[0]
            sell_bid = float(sell_row['bid']) if not pd.isna(sell_row['bid']) else 0
            buy_ask = float(buy_row['ask']) if not pd.isna(buy_row['ask']) else 0
            
            if sell_bid <= 0 or buy_ask <= 0:
                continue
            
            net_credit = sell_bid - buy_ask
            if net_credit <= 0:
                continue
            
            sell_iv = float(sell_row['impliedVolatility']) if not pd.isna(sell_row['impliedVolatility']) else 0.3
            sell_delta, _, _, _ = calculate_greeks(current_price, sell_strike, T, r, sell_iv, 'call')
            
            bear_calls.append({
                'sell_strike': sell_strike,
                'buy_strike': buy_strike,
                'credit': net_credit,
                'sell_delta': sell_delta
            })
        
        # Combine into Iron Condors
        iron_condors = []
        for bp in bull_puts:
            for bc in bear_calls:
                net_credit = bp['credit'] + bc['credit']
                max_profit = net_credit * 100
                max_loss = (spread - net_credit) * 100
                
                lower_breakeven = bp['sell_strike'] - net_credit
                upper_breakeven = bc['sell_strike'] + net_credit
                profit_zone_width = upper_breakeven - lower_breakeven
                profit_zone_pct = (profit_zone_width / current_price) * 100
                
                risk_reward = max_loss / max_profit if max_profit > 0 else 999
                
                # Probability of profit (roughly based on delta of short strikes)
                put_prob = (1 - abs(bp['sell_delta'])) if bp['sell_delta'] else 0.5
                call_prob = (1 - abs(bc['sell_delta'])) if bc['sell_delta'] else 0.5
                # Simplified: probability both expire OTM
                prob_profit = put_prob * call_prob * 100
                
                iron_condors.append(IronCondor(
                    put_sell_strike=bp['sell_strike'],
                    put_buy_strike=bp['buy_strike'],
                    put_credit=round(bp['credit'], 2),
                    call_sell_strike=bc['sell_strike'],
                    call_buy_strike=bc['buy_strike'],
                    call_credit=round(bc['credit'], 2),
                    net_credit=round(net_credit, 2),
                    max_profit=round(max_profit, 2),
                    max_loss=round(max_loss, 2),
                    lower_breakeven=round(lower_breakeven, 2),
                    upper_breakeven=round(upper_breakeven, 2),
                    profit_zone_width=round(profit_zone_width, 2),
                    profit_zone_pct=round(profit_zone_pct, 2),
                    risk_reward_ratio=round(risk_reward, 2),
                    probability_profit=round(prob_profit, 1)
                ))
        
        # Sort by probability of profit and limit
        iron_condors.sort(key=lambda x: x.probability_profit or 0, reverse=True)
        
        logger.info(f"Iron Condors fetched: {len(iron_condors)} combinations")
        
        return IronCondorsResponse(
            symbol="^SPX",
            expiration=expiration,
            current_price=round(current_price, 2),
            spread_width=spread,
            iron_condors=iron_condors[:20]  # Top 20
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching iron condors: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch iron condors: {str(e)}")


@api_router.get("/spx/iron-butterflies", response_model=IronButterfliesResponse)
async def get_iron_butterflies(expiration: str, wing: int = 25):
    """Get Iron Butterfly opportunities for a specific expiration date
    
    An Iron Butterfly sells ATM call + put at same strike, buys OTM wings
    wing: Width of wings from center strike in dollars (default 25)
    """
    try:
        ticker = yf.Ticker("^SPX")
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date")
        
        opt_chain = ticker.option_chain(expiration)
        
        # Get current SPX price
        spx_ticker = yf.Ticker("^GSPC")
        spx_hist = spx_ticker.history(period="1d")
        current_price = float(spx_hist['Close'].iloc[-1]) if not spx_hist.empty else 5900.0
        
        # Calculate time to expiration
        exp_date = datetime.strptime(expiration, "%Y-%m-%d")
        today = datetime.now()
        days_to_exp = (exp_date - today).days
        T = max(days_to_exp / 365.0, 1/365.0)
        r = 0.045
        
        calls_df = opt_chain.calls.copy()
        puts_df = opt_chain.puts.copy()
        
        # Find potential center strikes (near ATM)
        # Look for strikes within 5% of current price
        min_center = current_price * 0.95
        max_center = current_price * 1.05
        
        iron_butterflies = []
        
        for _, call_row in calls_df.iterrows():
            center_strike = float(call_row['strike'])
            
            # Skip if too far from ATM
            if center_strike < min_center or center_strike > max_center:
                continue
            
            upper_strike = center_strike + wing
            lower_strike = center_strike - wing
            
            # Find matching put at center strike
            center_puts = puts_df[puts_df['strike'] == center_strike]
            if center_puts.empty:
                continue
            put_row = center_puts.iloc[0]
            
            # Find wing options
            upper_calls = calls_df[calls_df['strike'] == upper_strike]
            lower_puts = puts_df[puts_df['strike'] == lower_strike]
            
            if upper_calls.empty or lower_puts.empty:
                continue
            
            upper_call = upper_calls.iloc[0]
            lower_put = lower_puts.iloc[0]
            
            # Get premiums (sell center, buy wings)
            center_call_bid = float(call_row['bid']) if not pd.isna(call_row['bid']) else 0
            center_put_bid = float(put_row['bid']) if not pd.isna(put_row['bid']) else 0
            upper_call_ask = float(upper_call['ask']) if not pd.isna(upper_call['ask']) else 0
            lower_put_ask = float(lower_put['ask']) if not pd.isna(lower_put['ask']) else 0
            
            if center_call_bid <= 0 or center_put_bid <= 0 or upper_call_ask <= 0 or lower_put_ask <= 0:
                continue
            
            # Net credit = sell center call + sell center put - buy upper call - buy lower put
            net_credit = center_call_bid + center_put_bid - upper_call_ask - lower_put_ask
            
            if net_credit <= 0:
                continue
            
            max_profit = net_credit * 100  # If expires exactly at center strike
            max_loss = (wing - net_credit) * 100  # If expires beyond wings
            
            lower_breakeven = center_strike - net_credit
            upper_breakeven = center_strike + net_credit
            
            risk_reward = max_loss / max_profit if max_profit > 0 else 999
            
            # Distance from current price
            distance_from_spot = ((center_strike - current_price) / current_price) * 100
            
            # Probability of profit (simplified - based on breakeven range)
            # Using center strike delta as rough estimate
            center_iv = float(call_row['impliedVolatility']) if not pd.isna(call_row['impliedVolatility']) else 0.3
            center_delta, _, _, _ = calculate_greeks(current_price, center_strike, T, r, center_iv, 'call')
            
            # Rough probability - butterfly profits when price stays near center
            # This is simplified; real calculation would use probability distribution
            breakeven_range = upper_breakeven - lower_breakeven
            prob_profit = min(90, max(20, (breakeven_range / current_price) * 1000))
            
            iron_butterflies.append(IronButterfly(
                center_strike=center_strike,
                call_premium=round(center_call_bid, 2),
                put_premium=round(center_put_bid, 2),
                upper_strike=upper_strike,
                lower_strike=lower_strike,
                upper_cost=round(upper_call_ask, 2),
                lower_cost=round(lower_put_ask, 2),
                net_credit=round(net_credit, 2),
                max_profit=round(max_profit, 2),
                max_loss=round(max_loss, 2),
                lower_breakeven=round(lower_breakeven, 2),
                upper_breakeven=round(upper_breakeven, 2),
                risk_reward_ratio=round(risk_reward, 2),
                probability_profit=round(prob_profit, 1),
                distance_from_spot=round(distance_from_spot, 2)
            ))
        
        # Sort by distance from spot (closest to ATM first)
        iron_butterflies.sort(key=lambda x: abs(x.distance_from_spot))
        
        logger.info(f"Iron Butterflies fetched: {len(iron_butterflies)} combinations")
        
        return IronButterfliesResponse(
            symbol="^SPX",
            expiration=expiration,
            current_price=round(current_price, 2),
            wing_width=wing,
            iron_butterflies=iron_butterflies[:15]  # Top 15
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching iron butterflies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch iron butterflies: {str(e)}")


@api_router.get("/spx/straddles", response_model=StraddlesResponse)
async def get_straddles(expiration: str):
    """Get Straddle opportunities - buy call + put at same strike
    
    A straddle profits from large moves in either direction
    """
    try:
        ticker = yf.Ticker("^SPX")
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date")
        
        opt_chain = ticker.option_chain(expiration)
        
        # Get current SPX price
        spx_ticker = yf.Ticker("^GSPC")
        spx_hist = spx_ticker.history(period="1d")
        current_price = float(spx_hist['Close'].iloc[-1]) if not spx_hist.empty else 5900.0
        
        calls_df = opt_chain.calls.copy()
        puts_df = opt_chain.puts.copy()
        
        # Find straddles near ATM (within 5%)
        min_strike = current_price * 0.95
        max_strike = current_price * 1.05
        
        straddles = []
        
        for _, call_row in calls_df.iterrows():
            strike = float(call_row['strike'])
            
            if strike < min_strike or strike > max_strike:
                continue
            
            # Find matching put
            matching_puts = puts_df[puts_df['strike'] == strike]
            if matching_puts.empty:
                continue
            
            put_row = matching_puts.iloc[0]
            
            call_ask = float(call_row['ask']) if not pd.isna(call_row['ask']) else 0
            put_ask = float(put_row['ask']) if not pd.isna(put_row['ask']) else 0
            
            if call_ask <= 0 or put_ask <= 0:
                continue
            
            total_cost = call_ask + put_ask
            lower_breakeven = strike - total_cost
            upper_breakeven = strike + total_cost
            
            # % move needed to breakeven
            breakeven_move_pct = (total_cost / strike) * 100
            
            distance_from_spot = ((strike - current_price) / current_price) * 100
            
            call_iv = float(call_row['impliedVolatility']) * 100 if not pd.isna(call_row['impliedVolatility']) else 0
            put_iv = float(put_row['impliedVolatility']) * 100 if not pd.isna(put_row['impliedVolatility']) else 0
            avg_iv = (call_iv + put_iv) / 2
            
            straddles.append(Straddle(
                strike=strike,
                call_price=round(call_ask, 2),
                put_price=round(put_ask, 2),
                total_cost=round(total_cost, 2),
                lower_breakeven=round(lower_breakeven, 2),
                upper_breakeven=round(upper_breakeven, 2),
                breakeven_move_pct=round(breakeven_move_pct, 2),
                distance_from_spot=round(distance_from_spot, 2),
                call_iv=round(call_iv, 1),
                put_iv=round(put_iv, 1),
                avg_iv=round(avg_iv, 1)
            ))
        
        # Sort by distance from spot
        straddles.sort(key=lambda x: abs(x.distance_from_spot))
        
        logger.info(f"Straddles fetched: {len(straddles)}")
        
        return StraddlesResponse(
            symbol="^SPX",
            expiration=expiration,
            current_price=round(current_price, 2),
            straddles=straddles[:15]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching straddles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch straddles: {str(e)}")


@api_router.get("/spx/strangles", response_model=StranglesResponse)
async def get_strangles(expiration: str, width: int = 50):
    """Get Strangle opportunities - buy OTM call + OTM put at different strikes
    
    A strangle is cheaper than a straddle but needs a larger move to profit
    width: Distance between call and put strikes (default 50)
    """
    try:
        ticker = yf.Ticker("^SPX")
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date")
        
        opt_chain = ticker.option_chain(expiration)
        
        # Get current SPX price
        spx_ticker = yf.Ticker("^GSPC")
        spx_hist = spx_ticker.history(period="1d")
        current_price = float(spx_hist['Close'].iloc[-1]) if not spx_hist.empty else 5900.0
        
        calls_df = opt_chain.calls.copy()
        puts_df = opt_chain.puts.copy()
        
        strangles = []
        
        # Find OTM calls (above current price)
        otm_calls = calls_df[calls_df['strike'] > current_price].copy()
        
        for _, call_row in otm_calls.iterrows():
            call_strike = float(call_row['strike'])
            
            # Find put strike that's approximately 'width' below the call
            # Or symmetrically below current price
            put_strike = call_strike - width
            
            matching_puts = puts_df[puts_df['strike'] == put_strike]
            if matching_puts.empty:
                # Try to find closest put strike
                puts_below = puts_df[puts_df['strike'] < current_price]
                if puts_below.empty:
                    continue
                # Find put with similar distance from spot as the call
                call_distance = call_strike - current_price
                target_put_strike = current_price - call_distance
                closest_put = puts_below.iloc[(puts_below['strike'] - target_put_strike).abs().argsort()[:1]]
                if closest_put.empty:
                    continue
                put_row = closest_put.iloc[0]
                put_strike = float(put_row['strike'])
            else:
                put_row = matching_puts.iloc[0]
            
            # Both must be OTM
            if put_strike >= current_price or call_strike <= current_price:
                continue
            
            call_ask = float(call_row['ask']) if not pd.isna(call_row['ask']) else 0
            put_ask = float(put_row['ask']) if not pd.isna(put_row['ask']) else 0
            
            if call_ask <= 0 or put_ask <= 0:
                continue
            
            total_cost = call_ask + put_ask
            lower_breakeven = put_strike - total_cost
            upper_breakeven = call_strike + total_cost
            
            # % move needed (from current price to nearest breakeven)
            move_to_upper = ((upper_breakeven - current_price) / current_price) * 100
            move_to_lower = ((current_price - lower_breakeven) / current_price) * 100
            breakeven_move_pct = min(move_to_upper, move_to_lower)
            
            actual_width = call_strike - put_strike
            
            call_iv = float(call_row['impliedVolatility']) * 100 if not pd.isna(call_row['impliedVolatility']) else 0
            put_iv = float(put_row['impliedVolatility']) * 100 if not pd.isna(put_row['impliedVolatility']) else 0
            avg_iv = (call_iv + put_iv) / 2
            
            strangles.append(Strangle(
                call_strike=call_strike,
                put_strike=put_strike,
                call_price=round(call_ask, 2),
                put_price=round(put_ask, 2),
                total_cost=round(total_cost, 2),
                lower_breakeven=round(lower_breakeven, 2),
                upper_breakeven=round(upper_breakeven, 2),
                breakeven_move_pct=round(breakeven_move_pct, 2),
                width=actual_width,
                call_iv=round(call_iv, 1),
                put_iv=round(put_iv, 1),
                avg_iv=round(avg_iv, 1)
            ))
        
        # Sort by total cost (cheapest first)
        strangles.sort(key=lambda x: x.total_cost)
        
        # Remove duplicates based on strikes
        seen = set()
        unique_strangles = []
        for s in strangles:
            key = (s.call_strike, s.put_strike)
            if key not in seen:
                seen.add(key)
                unique_strangles.append(s)
        
        logger.info(f"Strangles fetched: {len(unique_strangles)}")
        
        return StranglesResponse(
            symbol="^SPX",
            expiration=expiration,
            current_price=round(current_price, 2),
            strangles=unique_strangles[:15]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching strangles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch strangles: {str(e)}")


@api_router.get("/spx/calendar-spreads", response_model=CalendarSpreadsResponse)
async def get_calendar_spreads(near_exp: str, far_exp: str):
    """Get Calendar Spread opportunities - sell near-term, buy far-term at same strike
    
    Calendar spreads profit from time decay differential between expirations
    """
    try:
        ticker = yf.Ticker("^SPX")
        
        if near_exp not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid near expiration date")
        if far_exp not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid far expiration date")
        
        # Get current SPX price
        spx_ticker = yf.Ticker("^GSPC")
        spx_hist = spx_ticker.history(period="1d")
        current_price = float(spx_hist['Close'].iloc[-1]) if not spx_hist.empty else 5900.0
        
        # Get option chains for both expirations
        near_chain = ticker.option_chain(near_exp)
        far_chain = ticker.option_chain(far_exp)
        
        # Calculate times to expiration
        near_date = datetime.strptime(near_exp, "%Y-%m-%d")
        far_date = datetime.strptime(far_exp, "%Y-%m-%d")
        today = datetime.now()
        near_T = max((near_date - today).days / 365.0, 1/365.0)
        far_T = max((far_date - today).days / 365.0, 1/365.0)
        r = 0.045
        
        calendar_spreads = []
        
        # Process calls
        for _, near_row in near_chain.calls.iterrows():
            strike = float(near_row['strike'])
            
            # Only look at strikes within 5% of current price
            if strike < current_price * 0.95 or strike > current_price * 1.05:
                continue
            
            # Find matching far-term call
            far_calls = far_chain.calls[far_chain.calls['strike'] == strike]
            if far_calls.empty:
                continue
            
            far_row = far_calls.iloc[0]
            
            near_bid = float(near_row['bid']) if not pd.isna(near_row['bid']) else 0
            far_ask = float(far_row['ask']) if not pd.isna(far_row['ask']) else 0
            
            if near_bid <= 0 or far_ask <= 0:
                continue
            
            # Calendar spread: sell near (collect bid), buy far (pay ask)
            net_debit = far_ask - near_bid
            
            if net_debit <= 0:
                continue
            
            near_iv = float(near_row['impliedVolatility']) * 100 if not pd.isna(near_row['impliedVolatility']) else 0
            far_iv = float(far_row['impliedVolatility']) * 100 if not pd.isna(far_row['impliedVolatility']) else 0
            iv_diff = near_iv - far_iv  # Positive = backwardation (favorable)
            
            # Calculate thetas
            near_sigma = near_iv / 100 if near_iv > 0 else 0.3
            far_sigma = far_iv / 100 if far_iv > 0 else 0.3
            _, _, near_theta, _ = calculate_greeks(current_price, strike, near_T, r, near_sigma, 'call')
            _, _, far_theta, _ = calculate_greeks(current_price, strike, far_T, r, far_sigma, 'call')
            
            theta_edge = abs(near_theta or 0) - abs(far_theta or 0) if near_theta and far_theta else None
            
            distance_from_spot = ((strike - current_price) / current_price) * 100
            
            calendar_spreads.append(CalendarSpread(
                strike=strike,
                option_type='call',
                near_expiration=near_exp,
                far_expiration=far_exp,
                near_price=round(near_bid, 2),
                far_price=round(far_ask, 2),
                net_debit=round(net_debit, 2),
                near_iv=round(near_iv, 1),
                far_iv=round(far_iv, 1),
                iv_difference=round(iv_diff, 1),
                near_theta=near_theta,
                far_theta=far_theta,
                theta_edge=round(theta_edge, 4) if theta_edge else None,
                distance_from_spot=round(distance_from_spot, 2)
            ))
        
        # Process puts
        for _, near_row in near_chain.puts.iterrows():
            strike = float(near_row['strike'])
            
            if strike < current_price * 0.95 or strike > current_price * 1.05:
                continue
            
            far_puts = far_chain.puts[far_chain.puts['strike'] == strike]
            if far_puts.empty:
                continue
            
            far_row = far_puts.iloc[0]
            
            near_bid = float(near_row['bid']) if not pd.isna(near_row['bid']) else 0
            far_ask = float(far_row['ask']) if not pd.isna(far_row['ask']) else 0
            
            if near_bid <= 0 or far_ask <= 0:
                continue
            
            net_debit = far_ask - near_bid
            
            if net_debit <= 0:
                continue
            
            near_iv = float(near_row['impliedVolatility']) * 100 if not pd.isna(near_row['impliedVolatility']) else 0
            far_iv = float(far_row['impliedVolatility']) * 100 if not pd.isna(far_row['impliedVolatility']) else 0
            iv_diff = near_iv - far_iv
            
            near_sigma = near_iv / 100 if near_iv > 0 else 0.3
            far_sigma = far_iv / 100 if far_iv > 0 else 0.3
            _, _, near_theta, _ = calculate_greeks(current_price, strike, near_T, r, near_sigma, 'put')
            _, _, far_theta, _ = calculate_greeks(current_price, strike, far_T, r, far_sigma, 'put')
            
            theta_edge = abs(near_theta or 0) - abs(far_theta or 0) if near_theta and far_theta else None
            
            distance_from_spot = ((strike - current_price) / current_price) * 100
            
            calendar_spreads.append(CalendarSpread(
                strike=strike,
                option_type='put',
                near_expiration=near_exp,
                far_expiration=far_exp,
                near_price=round(near_bid, 2),
                far_price=round(far_ask, 2),
                net_debit=round(net_debit, 2),
                near_iv=round(near_iv, 1),
                far_iv=round(far_iv, 1),
                iv_difference=round(iv_diff, 1),
                near_theta=near_theta,
                far_theta=far_theta,
                theta_edge=round(theta_edge, 4) if theta_edge else None,
                distance_from_spot=round(distance_from_spot, 2)
            ))
        
        # Sort by distance from spot (ATM first)
        calendar_spreads.sort(key=lambda x: abs(x.distance_from_spot))
        
        logger.info(f"Calendar spreads fetched: {len(calendar_spreads)}")
        
        return CalendarSpreadsResponse(
            symbol="^SPX",
            near_expiration=near_exp,
            far_expiration=far_exp,
            current_price=round(current_price, 2),
            calendar_spreads=calendar_spreads[:20]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching calendar spreads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch calendar spreads: {str(e)}")


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

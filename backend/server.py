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
        # Use ^SPX for S&P 500 index options
        ticker = yf.Ticker("^SPX")
        expirations = ticker.options
        
        if not expirations:
            raise HTTPException(status_code=503, detail="No options data available")
        
        return OptionsExpirations(
            symbol="^SPX",
            expirations=list(expirations)
        )
        
    except Exception as e:
        logger.error(f"Error fetching options expirations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch options expirations: {str(e)}")


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

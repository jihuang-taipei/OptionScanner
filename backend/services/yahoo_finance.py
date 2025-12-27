import yfinance as yf
import pandas as pd
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException
import logging

from models.schemas import (
    SPXQuote, HistoricalDataPoint, SPXHistory, 
    OptionContract, OptionsChain, OptionsExpirations
)
from services.greeks import calculate_greeks

logger = logging.getLogger(__name__)


class YahooFinanceService:
    """Service class for Yahoo Finance data fetching"""
    
    RISK_FREE_RATE = 0.045  # 4.5%
    
    @staticmethod
    def get_ticker(symbol: str) -> yf.Ticker:
        """Get a Yahoo Finance ticker object"""
        return yf.Ticker(symbol)
    
    @classmethod
    def fetch_quote(cls, symbol: str) -> SPXQuote:
        """Fetch current quote for a symbol"""
        try:
            ticker = cls.get_ticker(symbol)
            info = ticker.info
            hist = ticker.history(period="2d")
            
            if hist.empty:
                raise HTTPException(status_code=503, detail=f"Unable to fetch market data for {symbol}")
            
            current_price = float(hist['Close'].iloc[-1])
            previous_close = float(info.get('previousClose', hist['Close'].iloc[-2] if len(hist) > 1 else current_price))
            
            change = current_price - previous_close
            change_percent = (change / previous_close) * 100 if previous_close else 0
            
            return SPXQuote(
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
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching quote for {symbol}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data for {symbol}: {str(e)}")
    
    @classmethod
    def fetch_history(cls, symbol: str, period: str) -> SPXHistory:
        """Fetch historical data for a symbol"""
        valid_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
        
        if period not in valid_periods:
            raise HTTPException(status_code=400, detail=f"Invalid period. Valid options: {', '.join(valid_periods)}")
        
        try:
            ticker = cls.get_ticker(symbol)
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
            
            return SPXHistory(symbol=symbol, period=period, data=data_points)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching history for {symbol}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch historical data for {symbol}: {str(e)}")
    
    @classmethod
    def fetch_expirations(cls, symbol: str) -> OptionsExpirations:
        """Fetch available expiration dates for options"""
        try:
            ticker = cls.get_ticker(symbol)
            expirations = ticker.options
            
            if not expirations:
                raise HTTPException(status_code=503, detail=f"No options data available for {symbol}")
            
            return OptionsExpirations(symbol=symbol, expirations=list(expirations))
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching options expirations for {symbol}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch options expirations for {symbol}: {str(e)}")
    
    @classmethod
    def get_current_price(cls, symbol: str) -> float:
        """Get current price for a symbol"""
        ticker = cls.get_ticker(symbol)
        hist = ticker.history(period="1d")
        return float(hist['Close'].iloc[-1]) if not hist.empty else 100.0
    
    @classmethod
    def calculate_time_to_expiration(cls, expiration: str) -> float:
        """Calculate time to expiration in years"""
        exp_date = datetime.strptime(expiration, "%Y-%m-%d")
        today = datetime.now()
        days_to_exp = (exp_date - today).days
        return max(days_to_exp / 365.0, 1/365.0)  # At least 1 day
    
    @classmethod
    def fetch_options_chain(cls, symbol: str, expiration: str) -> OptionsChain:
        """Fetch options chain for a specific expiration"""
        if not expiration:
            raise HTTPException(status_code=400, detail="Expiration date is required")
        
        try:
            ticker = cls.get_ticker(symbol)
            
            if expiration not in ticker.options:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid expiration date for {symbol}. Available: {', '.join(ticker.options[:5])}..."
                )
            
            opt_chain = ticker.option_chain(expiration)
            current_price = cls.get_current_price(symbol)
            T = cls.calculate_time_to_expiration(expiration)
            r = cls.RISK_FREE_RATE
            
            # Process calls
            calls = cls._process_options(opt_chain.calls, current_price, T, r, 'call')
            
            # Process puts
            puts = cls._process_options(opt_chain.puts, current_price, T, r, 'put')
            
            logger.info(f"Options chain fetched for {symbol}: {len(calls)} calls, {len(puts)} puts for {expiration}")
            
            return OptionsChain(
                symbol=symbol,
                expirationDate=expiration,
                calls=calls,
                puts=puts
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching options chain for {symbol}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch options chain for {symbol}: {str(e)}")
    
    @classmethod
    def _process_options(cls, df: pd.DataFrame, current_price: float, T: float, r: float, option_type: str) -> List[OptionContract]:
        """Process options dataframe into OptionContract list"""
        options = []
        for _, row in df.iterrows():
            strike = float(row['strike'])
            iv = float(row['impliedVolatility']) if not pd.isna(row['impliedVolatility']) else 0.3
            
            delta, gamma, theta, vega = calculate_greeks(current_price, strike, T, r, iv, option_type)
            
            options.append(OptionContract(
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
        return options

from fastapi import APIRouter, HTTPException
from datetime import datetime
import yfinance as yf
import pandas as pd
import logging

from models.schemas import (
    OptionsChain, OptionsExpirations, CreditSpread, CreditSpreadsResponse
)
from services.yahoo_finance import YahooFinanceService
from services.greeks import calculate_greeks

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/options/expirations", response_model=OptionsExpirations)
async def get_options_expirations(symbol: str = "^SPX"):
    """Get available expiration dates for options"""
    return YahooFinanceService.fetch_expirations(symbol)


@router.get("/spx/options/expirations", response_model=OptionsExpirations)
async def get_spx_options_expirations():
    """Get SPX options expirations - backwards compatible endpoint"""
    return await get_options_expirations("^SPX")


@router.get("/options/chain", response_model=OptionsChain)
async def get_options_chain(symbol: str = "^SPX", expiration: str = None):
    """Get options chain for a specific expiration date"""
    return YahooFinanceService.fetch_options_chain(symbol, expiration)


@router.get("/spx/options/chain", response_model=OptionsChain)
async def get_spx_options_chain(expiration: str):
    """Get SPX options chain - backwards compatible endpoint"""
    return await get_options_chain("^SPX", expiration)


@router.get("/spx/credit-spreads", response_model=CreditSpreadsResponse)
async def get_credit_spreads(symbol: str = "^SPX", expiration: str = None, spread: int = 5):
    """Get credit spread opportunities for a specific expiration date"""
    if not expiration:
        raise HTTPException(status_code=400, detail="Expiration date is required")
    
    try:
        ticker = yf.Ticker(symbol)
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date for {symbol}")
        
        opt_chain = ticker.option_chain(expiration)
        current_price = YahooFinanceService.get_current_price(symbol)
        T = YahooFinanceService.calculate_time_to_expiration(expiration)
        r = YahooFinanceService.RISK_FREE_RATE
        
        # Process puts for Bull Put Spreads
        puts_df = opt_chain.puts.copy()
        puts_df = puts_df.sort_values('strike')
        
        bull_put_spreads = []
        for i, sell_row in puts_df.iterrows():
            sell_strike = float(sell_row['strike'])
            buy_strike = sell_strike - spread
            
            buy_rows = puts_df[puts_df['strike'] == buy_strike]
            if buy_rows.empty:
                continue
            
            buy_row = buy_rows.iloc[0]
            
            sell_bid = float(sell_row['bid']) if not pd.isna(sell_row['bid']) else 0
            buy_ask = float(buy_row['ask']) if not pd.isna(buy_row['ask']) else 0
            
            if sell_bid <= 0 or buy_ask <= 0:
                continue
            
            net_credit = sell_bid - buy_ask
            if net_credit <= 0:
                continue
            
            max_profit = net_credit * 100
            max_loss = (spread - net_credit) * 100
            breakeven = sell_strike - net_credit
            risk_reward = max_loss / max_profit if max_profit > 0 else 999
            
            sell_iv = float(sell_row['impliedVolatility']) if not pd.isna(sell_row['impliedVolatility']) else 0.3
            buy_iv = float(buy_row['impliedVolatility']) if not pd.isna(buy_row['impliedVolatility']) else 0.3
            
            sell_delta, _, _, _ = calculate_greeks(current_price, sell_strike, T, r, sell_iv, 'put')
            buy_delta, _, _, _ = calculate_greeks(current_price, buy_strike, T, r, buy_iv, 'put')
            
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
        
        # Process calls for Bear Call Spreads
        calls_df = opt_chain.calls.copy()
        calls_df = calls_df.sort_values('strike')
        
        bear_call_spreads = []
        for i, sell_row in calls_df.iterrows():
            sell_strike = float(sell_row['strike'])
            buy_strike = sell_strike + spread
            
            buy_rows = calls_df[calls_df['strike'] == buy_strike]
            if buy_rows.empty:
                continue
            
            buy_row = buy_rows.iloc[0]
            
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
        
        # Sort by sell strike (short strike) - descending for puts, ascending for calls
        bull_put_spreads.sort(key=lambda x: x.sell_strike, reverse=True)
        bear_call_spreads.sort(key=lambda x: x.sell_strike)
        
        logger.info(f"Credit spreads fetched for {symbol}: {len(bull_put_spreads)} bull puts, {len(bear_call_spreads)} bear calls")
        
        return CreditSpreadsResponse(
            symbol=symbol,
            expiration=expiration,
            current_price=round(current_price, 2),
            spread_width=spread,
            bull_put_spreads=bull_put_spreads[:30],
            bear_call_spreads=bear_call_spreads[:30]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching credit spreads for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch credit spreads for {symbol}: {str(e)}")


@router.get("/credit-spreads", response_model=CreditSpreadsResponse)
async def get_credit_spreads_generic(symbol: str = "^SPX", expiration: str = None, spread: int = 5):
    """Get credit spread opportunities - generic endpoint"""
    return await get_credit_spreads(symbol, expiration, spread)


@router.get("/spx/credit-spreads-legacy", response_model=CreditSpreadsResponse)
async def get_spx_credit_spreads_legacy(expiration: str, spread: int = 5):
    """Get SPX credit spreads - backwards compatible endpoint"""
    return await get_credit_spreads("^SPX", expiration, spread)

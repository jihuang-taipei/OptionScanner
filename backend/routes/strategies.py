from fastapi import APIRouter, HTTPException
from datetime import datetime
import yfinance as yf
import pandas as pd
import logging

from models.schemas import (
    IronCondor, IronCondorsResponse, IronButterfly, IronButterfliesResponse,
    Straddle, Strangle, StraddlesResponse, StranglesResponse,
    CalendarSpread, CalendarSpreadsResponse
)
from services.yahoo_finance import YahooFinanceService
from services.greeks import calculate_greeks

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/iron-condors", response_model=IronCondorsResponse)
async def get_iron_condors(symbol: str = "^SPX", expiration: str = None, spread: int = 5):
    """Get Iron Condor opportunities for a specific expiration date"""
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
        
        bull_puts = []
        for _, sell_row in puts_df.iterrows():
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
            
            sell_iv = float(sell_row['impliedVolatility']) if not pd.isna(sell_row['impliedVolatility']) else 0.3
            sell_delta, _, _, _ = calculate_greeks(current_price, sell_strike, T, r, sell_iv, 'put')
            
            bull_puts.append({
                'sell_strike': sell_strike,
                'buy_strike': buy_strike,
                'credit': net_credit,
                'sell_delta': sell_delta
            })
        
        # Process calls for Bear Call Spreads
        calls_df = opt_chain.calls.copy()
        calls_df = calls_df.sort_values('strike')
        
        bear_calls = []
        for _, sell_row in calls_df.iterrows():
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
                # Valid Iron Condor: short call strike must be higher than short put strike
                if bc['sell_strike'] <= bp['sell_strike']:
                    continue
                
                net_credit = bp['credit'] + bc['credit']
                max_profit = net_credit * 100
                max_loss = (spread - net_credit) * 100
                
                lower_breakeven = bp['sell_strike'] - net_credit
                upper_breakeven = bc['sell_strike'] + net_credit
                profit_zone_width = upper_breakeven - lower_breakeven
                profit_zone_pct = (profit_zone_width / current_price) * 100
                
                risk_reward = max_loss / max_profit if max_profit > 0 else 999
                
                put_prob = (1 - abs(bp['sell_delta'])) if bp['sell_delta'] else 0.5
                call_prob = (1 - abs(bc['sell_delta'])) if bc['sell_delta'] else 0.5
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
        
        # Sort by net credit (highest first)
        iron_condors.sort(key=lambda x: x.net_credit, reverse=True)
        
        logger.info(f"Iron Condors fetched for {symbol}: {len(iron_condors)} combinations")
        
        return IronCondorsResponse(
            symbol=symbol,
            expiration=expiration,
            current_price=round(current_price, 2),
            spread_width=spread,
            iron_condors=iron_condors[:200]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching iron condors for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch iron condors for {symbol}: {str(e)}")


@router.get("/spx/iron-condors", response_model=IronCondorsResponse)
async def get_spx_iron_condors(expiration: str, spread: int = 5):
    """Get SPX Iron Condors - backwards compatible endpoint"""
    return await get_iron_condors("^SPX", expiration, spread)


@router.get("/iron-butterflies", response_model=IronButterfliesResponse)
async def get_iron_butterflies(symbol: str = "^SPX", expiration: str = None, wing: int = 25):
    """Get Iron Butterfly opportunities for a specific expiration date"""
    if not expiration:
        raise HTTPException(status_code=400, detail="Expiration date is required")
    
    try:
        ticker = yf.Ticker(symbol)
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date for {symbol}")
        
        opt_chain = ticker.option_chain(expiration)
        current_price = YahooFinanceService.get_current_price(symbol)
        
        calls_df = opt_chain.calls.copy()
        puts_df = opt_chain.puts.copy()
        
        iron_butterflies = []
        
        for _, call_row in calls_df.iterrows():
            center_strike = float(call_row['strike'])
            
            upper_strike = center_strike + wing
            lower_strike = center_strike - wing
            
            center_puts = puts_df[puts_df['strike'] == center_strike]
            if center_puts.empty:
                continue
            put_row = center_puts.iloc[0]
            
            upper_calls = calls_df[calls_df['strike'] == upper_strike]
            lower_puts = puts_df[puts_df['strike'] == lower_strike]
            
            if upper_calls.empty or lower_puts.empty:
                continue
            
            upper_call = upper_calls.iloc[0]
            lower_put = lower_puts.iloc[0]
            
            center_call_bid = float(call_row['bid']) if not pd.isna(call_row['bid']) else 0
            center_put_bid = float(put_row['bid']) if not pd.isna(put_row['bid']) else 0
            upper_call_ask = float(upper_call['ask']) if not pd.isna(upper_call['ask']) else 0
            lower_put_ask = float(lower_put['ask']) if not pd.isna(lower_put['ask']) else 0
            
            if center_call_bid <= 0 or center_put_bid <= 0 or upper_call_ask <= 0 or lower_put_ask <= 0:
                continue
            
            net_credit = center_call_bid + center_put_bid - upper_call_ask - lower_put_ask
            
            if net_credit <= 0:
                continue
            
            max_profit = net_credit * 100
            max_loss = (wing - net_credit) * 100
            
            lower_breakeven = center_strike - net_credit
            upper_breakeven = center_strike + net_credit
            
            risk_reward = max_loss / max_profit if max_profit > 0 else 999
            distance_from_spot = ((center_strike - current_price) / current_price) * 100
            
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
        
        iron_butterflies.sort(key=lambda x: abs(x.distance_from_spot))
        
        logger.info(f"Iron Butterflies fetched for {symbol}: {len(iron_butterflies)} combinations")
        
        return IronButterfliesResponse(
            symbol=symbol,
            expiration=expiration,
            current_price=round(current_price, 2),
            wing_width=wing,
            iron_butterflies=iron_butterflies[:15]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching iron butterflies for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch iron butterflies for {symbol}: {str(e)}")


@router.get("/spx/iron-butterflies", response_model=IronButterfliesResponse)
async def get_spx_iron_butterflies(expiration: str, wing: int = 25):
    """Get SPX Iron Butterflies - backwards compatible endpoint"""
    return await get_iron_butterflies("^SPX", expiration, wing)


@router.get("/straddles", response_model=StraddlesResponse)
async def get_straddles(symbol: str = "^SPX", expiration: str = None):
    """Get Straddle opportunities - buy call + put at same strike"""
    if not expiration:
        raise HTTPException(status_code=400, detail="Expiration date is required")
    
    try:
        ticker = yf.Ticker(symbol)
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date for {symbol}")
        
        opt_chain = ticker.option_chain(expiration)
        current_price = YahooFinanceService.get_current_price(symbol)
        
        calls_df = opt_chain.calls.copy()
        puts_df = opt_chain.puts.copy()
        
        straddles = []
        
        for _, call_row in calls_df.iterrows():
            strike = float(call_row['strike'])
            
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
        
        straddles.sort(key=lambda x: abs(x.distance_from_spot))
        
        logger.info(f"Straddles fetched for {symbol}: {len(straddles)}")
        
        return StraddlesResponse(
            symbol=symbol,
            expiration=expiration,
            current_price=round(current_price, 2),
            straddles=straddles[:15]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching straddles for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch straddles for {symbol}: {str(e)}")


@router.get("/spx/straddles", response_model=StraddlesResponse)
async def get_spx_straddles(expiration: str):
    """Get SPX Straddles - backwards compatible endpoint"""
    return await get_straddles("^SPX", expiration)


@router.get("/strangles", response_model=StranglesResponse)
async def get_strangles(symbol: str = "^SPX", expiration: str = None, width: int = 50):
    """Get Strangle opportunities - buy OTM call + OTM put at different strikes"""
    if not expiration:
        raise HTTPException(status_code=400, detail="Expiration date is required")
    
    try:
        ticker = yf.Ticker(symbol)
        
        if expiration not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid expiration date for {symbol}")
        
        opt_chain = ticker.option_chain(expiration)
        current_price = YahooFinanceService.get_current_price(symbol)
        
        calls_df = opt_chain.calls.copy()
        puts_df = opt_chain.puts.copy()
        
        strangles = []
        
        otm_calls = calls_df[calls_df['strike'] > current_price].copy()
        
        for _, call_row in otm_calls.iterrows():
            call_strike = float(call_row['strike'])
            put_strike = call_strike - width
            
            matching_puts = puts_df[puts_df['strike'] == put_strike]
            if matching_puts.empty:
                puts_below = puts_df[puts_df['strike'] < current_price]
                if puts_below.empty:
                    continue
                call_distance = call_strike - current_price
                target_put_strike = current_price - call_distance
                closest_put = puts_below.iloc[(puts_below['strike'] - target_put_strike).abs().argsort()[:1]]
                if closest_put.empty:
                    continue
                put_row = closest_put.iloc[0]
                put_strike = float(put_row['strike'])
            else:
                put_row = matching_puts.iloc[0]
            
            if put_strike >= current_price or call_strike <= current_price:
                continue
            
            call_ask = float(call_row['ask']) if not pd.isna(call_row['ask']) else 0
            put_ask = float(put_row['ask']) if not pd.isna(put_row['ask']) else 0
            
            if call_ask <= 0 or put_ask <= 0:
                continue
            
            total_cost = call_ask + put_ask
            lower_breakeven = put_strike - total_cost
            upper_breakeven = call_strike + total_cost
            
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
        
        strangles.sort(key=lambda x: x.total_cost)
        
        seen = set()
        unique_strangles = []
        for s in strangles:
            key = (s.call_strike, s.put_strike)
            if key not in seen:
                seen.add(key)
                unique_strangles.append(s)
        
        logger.info(f"Strangles fetched for {symbol}: {len(unique_strangles)}")
        
        return StranglesResponse(
            symbol=symbol,
            expiration=expiration,
            current_price=round(current_price, 2),
            strangles=unique_strangles[:15]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching strangles for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch strangles for {symbol}: {str(e)}")


@router.get("/spx/strangles", response_model=StranglesResponse)
async def get_spx_strangles(expiration: str, width: int = 50):
    """Get SPX Strangles - backwards compatible endpoint"""
    return await get_strangles("^SPX", expiration, width)


@router.get("/calendar-spreads", response_model=CalendarSpreadsResponse)
async def get_calendar_spreads(symbol: str = "^SPX", near_exp: str = None, far_exp: str = None):
    """Get Calendar Spread opportunities - sell near-term, buy far-term at same strike"""
    if not near_exp or not far_exp:
        raise HTTPException(status_code=400, detail="Both near_exp and far_exp are required")
    
    try:
        ticker = yf.Ticker(symbol)
        
        if near_exp not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid near expiration date for {symbol}")
        if far_exp not in ticker.options:
            raise HTTPException(status_code=400, detail=f"Invalid far expiration date for {symbol}")
        
        current_price = YahooFinanceService.get_current_price(symbol)
        
        near_chain = ticker.option_chain(near_exp)
        far_chain = ticker.option_chain(far_exp)
        
        near_date = datetime.strptime(near_exp, "%Y-%m-%d")
        far_date = datetime.strptime(far_exp, "%Y-%m-%d")
        today = datetime.now()
        near_T = max((near_date - today).days / 365.0, 1/365.0)
        far_T = max((far_date - today).days / 365.0, 1/365.0)
        r = YahooFinanceService.RISK_FREE_RATE
        
        calendar_spreads = []
        
        # Process calls
        for _, near_row in near_chain.calls.iterrows():
            strike = float(near_row['strike'])
            
            if strike < current_price * 0.95 or strike > current_price * 1.05:
                continue
            
            far_calls = far_chain.calls[far_chain.calls['strike'] == strike]
            if far_calls.empty:
                continue
            
            far_row = far_calls.iloc[0]
            
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
        
        calendar_spreads.sort(key=lambda x: abs(x.distance_from_spot))
        
        logger.info(f"Calendar spreads fetched for {symbol}: {len(calendar_spreads)}")
        
        return CalendarSpreadsResponse(
            symbol=symbol,
            near_expiration=near_exp,
            far_expiration=far_exp,
            current_price=round(current_price, 2),
            calendar_spreads=calendar_spreads[:20]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching calendar spreads for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch calendar spreads for {symbol}: {str(e)}")


@router.get("/spx/calendar-spreads", response_model=CalendarSpreadsResponse)
async def get_spx_calendar_spreads(near_exp: str, far_exp: str):
    """Get SPX Calendar Spreads - backwards compatible endpoint"""
    return await get_calendar_spreads("^SPX", near_exp, far_exp)

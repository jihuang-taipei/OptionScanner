from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime, timezone, timedelta
import yfinance as yf
import logging

from models.position import (
    PositionCreate, Position, PositionWithPnL, PortfolioSummary
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Database will be injected
db = None

def set_database(database):
    global db
    db = database


@router.post("/positions", response_model=Position)
async def create_position(position: PositionCreate):
    """Create a new paper trading position"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        new_position = Position(
            symbol=position.symbol,
            strategy_type=position.strategy_type,
            strategy_name=position.strategy_name,
            expiration=position.expiration,
            legs=[leg.model_dump() for leg in position.legs],
            entry_price=position.entry_price,
            quantity=position.quantity,
            notes=position.notes
        )
        
        await db.positions.insert_one(new_position.model_dump())
        logger.info(f"Position created: {new_position.strategy_name} for {new_position.symbol}")
        return new_position
        
    except Exception as e:
        logger.error(f"Error creating position: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create position: {str(e)}")


@router.get("/positions", response_model=List[PositionWithPnL])
async def get_positions(symbol: str = None, status: str = None):
    """Get all positions with current P/L calculations"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        query = {}
        if symbol:
            query["symbol"] = symbol
        if status:
            query["status"] = status
            
        positions = await db.positions.find(query, {"_id": 0}).to_list(1000)
        
        positions_with_pnl = []
        for pos in positions:
            pos_with_pnl = PositionWithPnL(**pos)
            
            if pos["status"] == "open":
                try:
                    ticker = yf.Ticker(pos["symbol"])
                    hist = ticker.history(period="1d")
                    if not hist.empty:
                        current_underlying = float(hist['Close'].iloc[-1])
                        
                        entry_value = pos["entry_price"] * pos["quantity"] * 100
                        
                        if pos["strategy_type"] in ['bull_put', 'bear_call', 'iron_condor', 'iron_butterfly']:
                            pos_with_pnl.current_price = current_underlying
                            pos_with_pnl.unrealized_pnl = entry_value * 0.5
                        else:
                            pos_with_pnl.current_price = current_underlying
                            pos_with_pnl.unrealized_pnl = 0
                            
                        if entry_value != 0:
                            pos_with_pnl.pnl_percent = (pos_with_pnl.unrealized_pnl / abs(entry_value)) * 100
                except Exception as e:
                    logger.warning(f"Could not calculate P/L for position: {e}")
            
            positions_with_pnl.append(pos_with_pnl)
        
        return positions_with_pnl
        
    except Exception as e:
        logger.error(f"Error fetching positions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch positions: {str(e)}")


@router.get("/positions/{position_id}", response_model=PositionWithPnL)
async def get_position(position_id: str):
    """Get a specific position by ID"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        position = await db.positions.find_one({"id": position_id}, {"_id": 0})
        if not position:
            raise HTTPException(status_code=404, detail="Position not found")
        return PositionWithPnL(**position)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching position: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch position: {str(e)}")


@router.put("/positions/{position_id}/close")
async def close_position(position_id: str, exit_price: float):
    """Close a position and calculate realized P/L"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        position = await db.positions.find_one({"id": position_id}, {"_id": 0})
        if not position:
            raise HTTPException(status_code=404, detail="Position not found")
        
        if position["status"] == "closed":
            raise HTTPException(status_code=400, detail="Position is already closed")
        
        entry_value = position["entry_price"] * position["quantity"] * 100
        exit_value = exit_price * position["quantity"] * 100
        
        if position["strategy_type"] in ['bull_put', 'bear_call', 'iron_condor', 'iron_butterfly']:
            realized_pnl = entry_value - exit_value
        else:
            realized_pnl = exit_value - entry_value
        
        await db.positions.update_one(
            {"id": position_id},
            {"$set": {
                "status": "closed",
                "closed_at": datetime.now(timezone.utc).isoformat(),
                "exit_price": exit_price,
                "realized_pnl": round(realized_pnl, 2)
            }}
        )
        
        logger.info(f"Position closed: {position_id}, P/L: ${realized_pnl:.2f}")
        
        updated_position = await db.positions.find_one({"id": position_id}, {"_id": 0})
        return PositionWithPnL(**updated_position)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing position: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to close position: {str(e)}")


@router.delete("/positions/{position_id}")
async def delete_position(position_id: str):
    """Delete a position"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        result = await db.positions.delete_one({"id": position_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Position not found")
        
        logger.info(f"Position deleted: {position_id}")
        return {"message": "Position deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting position: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete position: {str(e)}")


@router.post("/positions/expire")
async def expire_positions():
    """
    Check all open positions and expire those past their expiration date.
    Calculate final P/L based on closing price at expiration.
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        today = datetime.now(timezone.utc).date()
        
        # Get all open positions
        open_positions = await db.positions.find({"status": "open"}, {"_id": 0}).to_list(1000)
        
        expired_count = 0
        expired_positions = []
        
        for pos in open_positions:
            try:
                # Parse expiration date
                exp_date = datetime.fromisoformat(pos["expiration"].replace('Z', '+00:00')).date()
                
                # Check if position has expired
                if exp_date < today:
                    symbol = pos["symbol"]
                    
                    # Get closing price on expiration date
                    ticker = yf.Ticker(symbol)
                    
                    # Try to get historical data around expiration date
                    hist = ticker.history(start=exp_date.isoformat(), end=(exp_date + timedelta(days=5)).isoformat())
                    
                    if hist.empty:
                        # Fallback to recent price
                        hist = ticker.history(period="5d")
                    
                    if not hist.empty:
                        closing_price = float(hist['Close'].iloc[0])
                    else:
                        logger.warning(f"Could not get closing price for {symbol}, using current price")
                        info = ticker.info
                        closing_price = info.get('regularMarketPrice', info.get('previousClose', 0))
                    
                    # Calculate P/L based on option expiration values
                    exit_price = 0
                    for leg in pos["legs"]:
                        strike = leg["strike"]
                        option_type = leg["option_type"]
                        action = leg["action"]
                        
                        # Calculate intrinsic value at expiration
                        if option_type == "call":
                            intrinsic = max(0, closing_price - strike)
                        else:  # put
                            intrinsic = max(0, strike - closing_price)
                        
                        # Add or subtract based on position
                        if action == "sell":
                            exit_price += intrinsic  # Have to pay intrinsic if ITM
                        else:  # buy
                            exit_price -= intrinsic  # Receive intrinsic if ITM
                    
                    # Calculate realized P/L
                    entry_value = pos["entry_price"] * pos["quantity"] * 100
                    exit_value = exit_price * pos["quantity"] * 100
                    
                    # For credit strategies: profit = entry - exit
                    # For debit strategies: profit = -exit - entry (entry is negative)
                    if pos["entry_price"] >= 0:  # Credit strategy
                        realized_pnl = entry_value - exit_value
                    else:  # Debit strategy
                        realized_pnl = -exit_value + entry_value
                    
                    # Update position as expired
                    await db.positions.update_one(
                        {"id": pos["id"]},
                        {"$set": {
                            "status": "expired",
                            "closed_at": datetime.now(timezone.utc).isoformat(),
                            "exit_price": round(exit_price, 2),
                            "realized_pnl": round(realized_pnl, 2)
                        }}
                    )
                    
                    expired_count += 1
                    expired_positions.append({
                        "id": pos["id"],
                        "strategy_name": pos["strategy_name"],
                        "expiration": pos["expiration"],
                        "closing_price": closing_price,
                        "exit_price": round(exit_price, 2),
                        "realized_pnl": round(realized_pnl, 2)
                    })
                    
                    logger.info(f"Position expired: {pos['strategy_name']}, P/L: ${realized_pnl:.2f}")
                    
            except Exception as e:
                logger.error(f"Error processing position {pos.get('id')}: {str(e)}")
                continue
        
        return {
            "message": f"Expired {expired_count} positions",
            "expired_positions": expired_positions
        }
        
    except Exception as e:
        logger.error(f"Error expiring positions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to expire positions: {str(e)}")


@router.get("/portfolio/summary", response_model=PortfolioSummary)
async def get_portfolio_summary():
    """Get portfolio summary with all positions and P/L"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        positions = await get_positions()
        
        open_positions = [p for p in positions if p.status == "open"]
        closed_positions = [p for p in positions if p.status == "closed"]
        
        total_unrealized = sum(p.unrealized_pnl or 0 for p in open_positions)
        total_realized = sum(p.realized_pnl or 0 for p in closed_positions)
        
        return PortfolioSummary(
            total_positions=len(positions),
            open_positions=len(open_positions),
            closed_positions=len(closed_positions),
            total_unrealized_pnl=round(total_unrealized, 2),
            total_realized_pnl=round(total_realized, 2),
            positions=positions
        )
        
    except Exception as e:
        logger.error(f"Error fetching portfolio summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio summary: {str(e)}")

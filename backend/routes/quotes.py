from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime, timezone

from models.schemas import StatusCheck, StatusCheckCreate, SPXQuote, SPXHistory
from services.yahoo_finance import YahooFinanceService

router = APIRouter()

# Database will be injected
db = None

def set_database(database):
    global db
    db = database


@router.get("/")
async def root():
    return {"message": "Hello World"}


@router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj


@router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


@router.get("/quote", response_model=SPXQuote)
async def get_quote(symbol: str = "^GSPC"):
    """Get current quote for any stock/index from Yahoo Finance"""
    return YahooFinanceService.fetch_quote(symbol)


@router.get("/spx/quote", response_model=SPXQuote)
async def get_spx_quote():
    """Get current SPX (S&P 500) quote - backwards compatible endpoint"""
    return await get_quote("^GSPC")


@router.get("/history", response_model=SPXHistory)
async def get_history(symbol: str = "^GSPC", period: str = "1mo", interval: str = None):
    """Get historical data for any stock/index
    
    Args:
        symbol: Stock/index symbol (default: ^GSPC)
        period: Time period - 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
        interval: Data interval - 1m, 5m, 15m, 1h, 1d (auto-selected if not provided)
    """
    return YahooFinanceService.fetch_history(symbol, period, interval)


@router.get("/spx/history", response_model=SPXHistory)
async def get_spx_history(period: str = "1mo"):
    """Get historical SPX data - backwards compatible endpoint"""
    return await get_history("^GSPC", period)

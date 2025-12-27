from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


class PositionLeg(BaseModel):
    option_type: str  # 'call' or 'put'
    action: str  # 'buy' or 'sell'
    strike: float
    price: float
    quantity: int = 1


class PositionCreate(BaseModel):
    symbol: str
    strategy_type: str  # 'bull_put', 'bear_call', 'iron_condor', 'straddle', 'strangle', etc.
    strategy_name: str  # Display name like "Bull Put 6400/6395"
    expiration: str
    legs: List[PositionLeg]
    entry_price: float  # Net credit/debit per contract
    quantity: int = 1  # Number of contracts
    notes: Optional[str] = None


class Position(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    strategy_type: str
    strategy_name: str
    expiration: str
    legs: List[PositionLeg]
    entry_price: float
    quantity: int
    notes: Optional[str] = None
    status: str = "open"  # 'open' or 'closed'
    opened_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    closed_at: Optional[str] = None
    exit_price: Optional[float] = None
    realized_pnl: Optional[float] = None


class PositionWithPnL(Position):
    current_price: Optional[float] = None
    unrealized_pnl: Optional[float] = None
    pnl_percent: Optional[float] = None


class PortfolioSummary(BaseModel):
    total_positions: int
    open_positions: int
    closed_positions: int
    total_unrealized_pnl: float
    total_realized_pnl: float
    positions: List[PositionWithPnL]

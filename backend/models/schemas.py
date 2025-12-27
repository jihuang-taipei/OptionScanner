from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


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
    spread_type: str
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
    put_sell_strike: float
    put_buy_strike: float
    put_credit: float
    call_sell_strike: float
    call_buy_strike: float
    call_credit: float
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
    center_strike: float
    call_premium: float
    put_premium: float
    upper_strike: float
    lower_strike: float
    upper_cost: float
    lower_cost: float
    net_credit: float
    max_profit: float
    max_loss: float
    lower_breakeven: float
    upper_breakeven: float
    risk_reward_ratio: float
    probability_profit: Optional[float] = None
    distance_from_spot: float


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
    breakeven_move_pct: float
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
    width: float
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
    option_type: str
    near_expiration: str
    far_expiration: str
    near_price: float
    far_price: float
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

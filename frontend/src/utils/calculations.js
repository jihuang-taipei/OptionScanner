// P/L calculation functions for different strategies

export const calculatePLData = (strategy, currentPrice) => {
  if (!strategy || !currentPrice) return [];
  
  const points = [];
  const range = currentPrice * 0.15; // ±15% range
  const minPrice = currentPrice - range;
  const maxPrice = currentPrice + range;
  const step = range / 50;
  
  for (let price = minPrice; price <= maxPrice; price += step) {
    let pl = 0;
    
    switch (strategy.type) {
      case 'bull_put':
        pl = calculateBullPutPL(price, strategy.sell_strike, strategy.buy_strike, strategy.net_credit);
        break;
      case 'bear_call':
        pl = calculateBearCallPL(price, strategy.sell_strike, strategy.buy_strike, strategy.net_credit);
        break;
      case 'iron_condor':
        pl = calculateIronCondorPL(price, strategy);
        break;
      case 'iron_butterfly':
        pl = calculateIronButterflyPL(price, strategy);
        break;
      case 'straddle':
        pl = calculateStraddlePL(price, strategy.strike, strategy.total_cost);
        break;
      case 'strangle':
        pl = calculateStranglePL(price, strategy.call_strike, strategy.put_strike, strategy.total_cost);
        break;
      default:
        pl = 0;
    }
    
    points.push({
      price: Math.round(price),
      pl: Math.round(pl),
      breakeven: pl === 0
    });
  }
  
  return points;
};

export const calculateBullPutPL = (price, sellStrike, buyStrike, credit) => {
  const creditPer = credit * 100;
  if (price >= sellStrike) return creditPer;
  if (price <= buyStrike) return creditPer - (sellStrike - buyStrike) * 100;
  return creditPer - (sellStrike - price) * 100;
};

export const calculateBearCallPL = (price, sellStrike, buyStrike, credit) => {
  const creditPer = credit * 100;
  if (price <= sellStrike) return creditPer;
  if (price >= buyStrike) return creditPer - (buyStrike - sellStrike) * 100;
  return creditPer - (price - sellStrike) * 100;
};

export const calculateIronCondorPL = (price, strategy) => {
  const putPL = calculateBullPutPL(price, strategy.put_sell_strike, strategy.put_buy_strike, strategy.put_credit);
  const callPL = calculateBearCallPL(price, strategy.call_sell_strike, strategy.call_buy_strike, strategy.call_credit);
  return putPL + callPL;
};

export const calculateIronButterflyPL = (price, strategy) => {
  const credit = strategy.net_credit * 100;
  const wing = strategy.upper_strike - strategy.center_strike;
  
  if (price === strategy.center_strike) return credit;
  if (price <= strategy.lower_strike || price >= strategy.upper_strike) {
    return credit - wing * 100;
  }
  
  const distanceFromCenter = Math.abs(price - strategy.center_strike);
  return credit - distanceFromCenter * 100;
};

export const calculateStraddlePL = (price, strike, cost) => {
  const costPer = cost * 100;
  const intrinsicValue = Math.abs(price - strike) * 100;
  return intrinsicValue - costPer;
};

export const calculateStranglePL = (price, callStrike, putStrike, cost) => {
  const costPer = cost * 100;
  let intrinsicValue = 0;
  if (price > callStrike) intrinsicValue = (price - callStrike) * 100;
  else if (price < putStrike) intrinsicValue = (putStrike - price) * 100;
  return intrinsicValue - costPer;
};

export const calculateCalendarSpreadPL = (price, strike, netDebit, optionType) => {
  // Calendar spread P/L at near-term expiration
  // At near-term expiration, the short option expires and we're left with the long option value
  // This is a simplified model - actual P/L depends on IV and time remaining
  const debitPer = netDebit * 100;
  
  // Max profit occurs at the strike price (short option expires worthless, long retains time value)
  // Max loss is limited to the net debit paid
  // The P/L curve is tent-shaped for calendar spreads
  
  const distanceFromStrike = Math.abs(price - strike);
  const maxProfitEstimate = debitPer * 0.5; // Estimated max profit (50% of debit as rough estimate)
  
  // Tent-shaped P/L: max at strike, decreasing as price moves away
  const profitDecayRate = maxProfitEstimate / (strike * 0.05); // Decay over ~5% move
  const profit = maxProfitEstimate - (distanceFromStrike * profitDecayRate);
  
  // P/L is capped at max profit and max loss (net debit)
  return Math.max(-debitPer, Math.min(maxProfitEstimate, profit));
};

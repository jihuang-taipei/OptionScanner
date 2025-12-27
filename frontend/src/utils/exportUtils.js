// CSV Export utility functions

export const downloadCSV = (data, filename) => {
  const blob = new Blob([data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportOptionsChain = (options, type, expiration) => {
  if (!options || options.length === 0) return;
  
  const headers = ['Strike', 'Last', 'Bid', 'Ask', 'Change', 'Change%', 'Volume', 'OI', 'IV%', 'Delta', 'Gamma', 'Theta', 'Vega', 'ITM'];
  const rows = options.map(opt => [
    opt.strike,
    opt.lastPrice,
    opt.bid,
    opt.ask,
    opt.change,
    opt.percentChange,
    opt.volume || '',
    opt.openInterest || '',
    opt.impliedVolatility,
    opt.delta || '',
    opt.gamma || '',
    opt.theta || '',
    opt.vega || '',
    opt.inTheMoney ? 'Yes' : 'No'
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_${type}_${expiration}.csv`);
};

export const exportCreditSpreads = (spreads, type, expiration) => {
  if (!spreads || spreads.length === 0) return;
  
  const headers = ['Sell Strike', 'Buy Strike', 'Sell Premium', 'Buy Premium', 'Net Credit', 'Max Profit', 'Max Loss', 'Breakeven', 'Risk/Reward', 'P(OTM)'];
  const rows = spreads.map(s => [
    s.sell_strike,
    s.buy_strike,
    s.sell_premium,
    s.buy_premium,
    s.net_credit,
    s.max_profit,
    s.max_loss,
    s.breakeven,
    s.risk_reward_ratio,
    s.probability_otm || ''
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_${type.replace(' ', '')}_${expiration}.csv`);
};

export const exportIronCondors = (condors, expiration) => {
  if (!condors || condors.length === 0) return;
  
  const headers = ['Put Sell', 'Put Buy', 'Put Credit', 'Call Sell', 'Call Buy', 'Call Credit', 'Net Credit', 'Max Profit', 'Max Loss', 'Lower BE', 'Upper BE', 'Profit Zone', 'Risk/Reward', 'P(Profit)'];
  const rows = condors.map(c => [
    c.put_sell_strike,
    c.put_buy_strike,
    c.put_credit,
    c.call_sell_strike,
    c.call_buy_strike,
    c.call_credit,
    c.net_credit,
    c.max_profit,
    c.max_loss,
    c.lower_breakeven,
    c.upper_breakeven,
    `${c.profit_zone_pct}%`,
    c.risk_reward_ratio,
    c.probability_profit || ''
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_IronCondors_${expiration}.csv`);
};

export const exportStraddles = (straddles, expiration) => {
  if (!straddles || straddles.length === 0) return;
  
  const headers = ['Strike', 'Call Price', 'Put Price', 'Total Cost', 'Lower BE', 'Upper BE', 'BE Move %', 'Distance', 'Call IV', 'Put IV', 'Avg IV'];
  const rows = straddles.map(s => [
    s.strike,
    s.call_price,
    s.put_price,
    s.total_cost,
    s.lower_breakeven,
    s.upper_breakeven,
    s.breakeven_move_pct,
    `${s.distance_from_spot}%`,
    s.call_iv,
    s.put_iv,
    s.avg_iv
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_Straddles_${expiration}.csv`);
};

export const exportStrangles = (strangles, expiration) => {
  if (!strangles || strangles.length === 0) return;
  
  const headers = ['Call Strike', 'Put Strike', 'Call Price', 'Put Price', 'Total Cost', 'Lower BE', 'Upper BE', 'BE Move %', 'Width', 'Call IV', 'Put IV', 'Avg IV'];
  const rows = strangles.map(s => [
    s.call_strike,
    s.put_strike,
    s.call_price,
    s.put_price,
    s.total_cost,
    s.lower_breakeven,
    s.upper_breakeven,
    s.breakeven_move_pct,
    s.width,
    s.call_iv,
    s.put_iv,
    s.avg_iv
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_Strangles_${expiration}.csv`);
};

export const exportIronButterflies = (butterflies, expiration) => {
  if (!butterflies || butterflies.length === 0) return;
  
  const headers = ['Center Strike', 'Call Premium', 'Put Premium', 'Upper Wing', 'Lower Wing', 'Upper Cost', 'Lower Cost', 'Net Credit', 'Max Profit', 'Max Loss', 'Lower BE', 'Upper BE', 'Risk/Reward', 'P(Profit)', 'Distance'];
  const rows = butterflies.map(b => [
    b.center_strike,
    b.call_premium,
    b.put_premium,
    b.upper_strike,
    b.lower_strike,
    b.upper_cost,
    b.lower_cost,
    b.net_credit,
    b.max_profit,
    b.max_loss,
    b.lower_breakeven,
    b.upper_breakeven,
    b.risk_reward_ratio,
    b.probability_profit || '',
    `${b.distance_from_spot}%`
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_IronButterflies_${expiration}.csv`);
};

export const exportCalendarSpreads = (spreads, nearExp, farExp) => {
  if (!spreads || spreads.length === 0) return;
  
  const headers = ['Strike', 'Type', 'Near Exp', 'Far Exp', 'Near Price', 'Far Price', 'Net Debit', 'Near IV', 'Far IV', 'IV Diff', 'Near Theta', 'Far Theta', 'Theta Edge', 'Distance'];
  const rows = spreads.map(s => [
    s.strike,
    s.option_type,
    s.near_expiration,
    s.far_expiration,
    s.near_price,
    s.far_price,
    s.net_debit,
    s.near_iv,
    s.far_iv,
    s.iv_difference,
    s.near_theta || '',
    s.far_theta || '',
    s.theta_edge || '',
    `${s.distance_from_spot}%`
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_CalendarSpreads_${nearExp}_${farExp}.csv`);
};

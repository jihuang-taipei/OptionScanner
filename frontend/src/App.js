import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Clock, ChevronDown, Table2, Calculator, Plus, Trash2, X, Layers, Triangle, ArrowLeftRight, LineChart as LineChartIcon, Download, Calendar } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine, ComposedChart } from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// P/L calculation functions for different strategies
const calculatePLData = (strategy, currentPrice) => {
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
        // Bull Put Spread: sell higher put, buy lower put
        pl = calculateBullPutPL(price, strategy.sell_strike, strategy.buy_strike, strategy.net_credit);
        break;
      case 'bear_call':
        // Bear Call Spread: sell lower call, buy higher call
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

const calculateBullPutPL = (price, sellStrike, buyStrike, credit) => {
  const creditPer = credit * 100;
  if (price >= sellStrike) return creditPer;
  if (price <= buyStrike) return creditPer - (sellStrike - buyStrike) * 100;
  return creditPer - (sellStrike - price) * 100;
};

const calculateBearCallPL = (price, sellStrike, buyStrike, credit) => {
  const creditPer = credit * 100;
  if (price <= sellStrike) return creditPer;
  if (price >= buyStrike) return creditPer - (buyStrike - sellStrike) * 100;
  return creditPer - (price - sellStrike) * 100;
};

const calculateIronCondorPL = (price, strategy) => {
  const putPL = calculateBullPutPL(price, strategy.put_sell_strike, strategy.put_buy_strike, strategy.put_credit);
  const callPL = calculateBearCallPL(price, strategy.call_sell_strike, strategy.call_buy_strike, strategy.call_credit);
  return putPL + callPL;
};

const calculateIronButterflyPL = (price, strategy) => {
  const credit = strategy.net_credit * 100;
  const wing = strategy.upper_strike - strategy.center_strike;
  
  if (price === strategy.center_strike) return credit;
  if (price <= strategy.lower_strike || price >= strategy.upper_strike) {
    return credit - wing * 100;
  }
  
  const distanceFromCenter = Math.abs(price - strategy.center_strike);
  return credit - distanceFromCenter * 100;
};

const calculateStraddlePL = (price, strike, cost) => {
  const costPer = cost * 100;
  const intrinsicValue = Math.abs(price - strike) * 100;
  return intrinsicValue - costPer;
};

const calculateStranglePL = (price, callStrike, putStrike, cost) => {
  const costPer = cost * 100;
  let intrinsicValue = 0;
  if (price > callStrike) intrinsicValue = (price - callStrike) * 100;
  else if (price < putStrike) intrinsicValue = (putStrike - price) * 100;
  return intrinsicValue - costPer;
};

// P/L Chart Tooltip
const PLTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const pl = payload[0].value;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
        <p className="text-zinc-400 text-sm">Price: <span className="text-white font-mono">${label}</span></p>
        <p className={`text-sm font-mono font-medium ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          P/L: {pl >= 0 ? '+' : ''}${pl.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

// P/L Chart Component
const PLChart = ({ strategy, currentPrice, onClose }) => {
  if (!strategy) return null;
  
  const plData = calculatePLData(strategy, currentPrice);
  const maxProfit = Math.max(...plData.map(d => d.pl));
  const maxLoss = Math.min(...plData.map(d => d.pl));
  
  // Find breakeven points
  const breakevenPoints = [];
  for (let i = 1; i < plData.length; i++) {
    if ((plData[i-1].pl < 0 && plData[i].pl >= 0) || (plData[i-1].pl >= 0 && plData[i].pl < 0)) {
      breakevenPoints.push(plData[i].price);
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <p className="text-zinc-500 text-xs">Max Profit</p>
          <p className="text-green-400 font-mono font-medium">${maxProfit.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <p className="text-zinc-500 text-xs">Max Loss</p>
          <p className="text-red-400 font-mono font-medium">${Math.abs(maxLoss).toLocaleString()}</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <p className="text-zinc-500 text-xs">Breakeven(s)</p>
          <p className="text-white font-mono text-xs">
            {breakevenPoints.length > 0 ? breakevenPoints.map(b => `$${b}`).join(', ') : 'N/A'}
          </p>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={plData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="plGradientPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="plGradientNegative" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="price" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
              domain={[maxLoss * 1.1, maxProfit * 1.1]}
            />
            <Tooltip content={<PLTooltip />} />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
            <ReferenceLine x={currentPrice} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Current', fill: '#3b82f6', fontSize: 10 }} />
            <Area 
              type="monotone" 
              dataKey="pl" 
              stroke="none"
              fill="url(#plGradientPositive)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            <Line 
              type="monotone" 
              dataKey="pl" 
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="text-xs text-zinc-500 text-center">
        P/L at expiration based on ^SPX price. Current price: ${currentPrice?.toLocaleString()}
      </div>
    </div>
  );
};

// CSV Export utility functions
const downloadCSV = (data, filename) => {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const exportOptionsChain = (options, type, expiration) => {
  if (!options || options.length === 0) return;
  
  const headers = ['Strike', 'Last', 'Bid', 'Ask', 'IV%', 'Delta', 'Gamma', 'Theta', 'Vega', 'Volume', 'OpenInterest', 'ITM'];
  const rows = options.map(opt => [
    opt.strike,
    opt.lastPrice,
    opt.bid,
    opt.ask,
    opt.impliedVolatility,
    opt.delta || '',
    opt.gamma || '',
    opt.theta || '',
    opt.vega || '',
    opt.volume || '',
    opt.openInterest || '',
    opt.inTheMoney ? 'Yes' : 'No'
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_${type}_${expiration}.csv`);
};

const exportCreditSpreads = (spreads, type, expiration) => {
  if (!spreads || spreads.length === 0) return;
  
  const headers = ['SellStrike', 'BuyStrike', 'SellPremium', 'BuyPremium', 'NetCredit', 'MaxProfit', 'MaxLoss', 'Breakeven', 'RiskReward', 'ProbOTM'];
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
  downloadCSV(csv, `SPX_${type}_Spreads_${expiration}.csv`);
};

const exportIronCondors = (condors, expiration) => {
  if (!condors || condors.length === 0) return;
  
  const headers = ['PutSell', 'PutBuy', 'PutCredit', 'CallSell', 'CallBuy', 'CallCredit', 'NetCredit', 'MaxProfit', 'MaxLoss', 'LowerBE', 'UpperBE', 'RiskReward', 'ProbProfit'];
  const rows = condors.map(ic => [
    ic.put_sell_strike,
    ic.put_buy_strike,
    ic.put_credit,
    ic.call_sell_strike,
    ic.call_buy_strike,
    ic.call_credit,
    ic.net_credit,
    ic.max_profit,
    ic.max_loss,
    ic.lower_breakeven,
    ic.upper_breakeven,
    ic.risk_reward_ratio,
    ic.probability_profit || ''
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_IronCondors_${expiration}.csv`);
};

const exportStraddles = (straddles, expiration) => {
  if (!straddles || straddles.length === 0) return;
  
  const headers = ['Strike', 'CallPrice', 'PutPrice', 'TotalCost', 'LowerBE', 'UpperBE', 'MoveToBreakeven%', 'AvgIV'];
  const rows = straddles.map(s => [
    s.strike,
    s.call_price,
    s.put_price,
    s.total_cost,
    s.lower_breakeven,
    s.upper_breakeven,
    s.breakeven_move_pct,
    s.avg_iv
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_Straddles_${expiration}.csv`);
};

const exportStrangles = (strangles, expiration) => {
  if (!strangles || strangles.length === 0) return;
  
  const headers = ['PutStrike', 'CallStrike', 'PutPrice', 'CallPrice', 'TotalCost', 'LowerBE', 'UpperBE', 'MoveToBreakeven%', 'Width', 'AvgIV'];
  const rows = strangles.map(s => [
    s.put_strike,
    s.call_strike,
    s.put_price,
    s.call_price,
    s.total_cost,
    s.lower_breakeven,
    s.upper_breakeven,
    s.breakeven_move_pct,
    s.width,
    s.avg_iv
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_Strangles_${expiration}.csv`);
};

const exportIronButterflies = (butterflies, expiration) => {
  if (!butterflies || butterflies.length === 0) return;
  
  const headers = ['CenterStrike', 'LowerStrike', 'UpperStrike', 'CallPremium', 'PutPremium', 'UpperCost', 'LowerCost', 'NetCredit', 'MaxProfit', 'MaxLoss', 'LowerBE', 'UpperBE', 'RiskReward', 'FromSpot%'];
  const rows = butterflies.map(b => [
    b.center_strike,
    b.lower_strike,
    b.upper_strike,
    b.call_premium,
    b.put_premium,
    b.upper_cost,
    b.lower_cost,
    b.net_credit,
    b.max_profit,
    b.max_loss,
    b.lower_breakeven,
    b.upper_breakeven,
    b.risk_reward_ratio,
    b.distance_from_spot
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_IronButterflies_${expiration}.csv`);
};

const exportCalendarSpreads = (spreads, nearExp, farExp) => {
  if (!spreads || spreads.length === 0) return;
  
  const headers = ['Strike', 'Type', 'NearExp', 'FarExp', 'NearPrice', 'FarPrice', 'NetDebit', 'NearIV', 'FarIV', 'IVDiff', 'ThetaEdge', 'FromSpot%'];
  const rows = spreads.map(cs => [
    cs.strike,
    cs.option_type,
    cs.near_expiration,
    cs.far_expiration,
    cs.near_price,
    cs.far_price,
    cs.net_debit,
    cs.near_iv,
    cs.far_iv,
    cs.iv_difference,
    cs.theta_edge || '',
    cs.distance_from_spot
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, `SPX_CalendarSpreads_${nearExp}_${farExp}.csv`);
};

// Auto-refresh interval options
const REFRESH_INTERVALS = [
  { value: 0, label: "Off" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
];

// Custom Tooltip for Chart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip bg-zinc-900 border border-white/10 rounded-lg p-3">
        <p className="text-zinc-400 text-sm mb-1">{label}</p>
        <p className="font-mono text-lg text-white font-medium">
          ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

// Stats Card Component
const StatCard = ({ label, value, icon: Icon, isLoading }) => (
  <div className="glass-card p-5 hover:border-white/20 transition-all duration-300">
    <div className="flex items-center justify-between mb-2">
      <span className="text-zinc-500 text-sm">{label}</span>
      <Icon className="w-4 h-4 text-zinc-600" />
    </div>
    {isLoading ? (
      <div className="h-7 w-24 bg-zinc-800 rounded animate-pulse" />
    ) : (
      <p className="font-mono text-xl text-white font-medium">
        {typeof value === 'number' 
          ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : value}
      </p>
    )}
  </div>
);

// Period Selector Button
const PeriodButton = ({ period, currentPeriod, onClick, label }) => (
  <button
    onClick={() => onClick(period)}
    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
      currentPeriod === period
        ? 'bg-white text-black'
        : 'text-zinc-400 hover:text-white hover:bg-white/10'
    }`}
    data-testid={`period-${period}`}
  >
    {label}
  </button>
);

// Options Table Component
const OptionsTable = ({ options, type, currentPrice, strikeRange }) => {
  if (!options || options.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No {type} data available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Apply strike range filter based on percentage
  const rangePct = strikeRange / 100;
  const minS = currentPrice * (1 - rangePct);
  const maxS = currentPrice * (1 + rangePct);
  const filteredOptions = options.filter(opt => opt.strike >= minS && opt.strike <= maxS);

  // Check if Greeks are available
  const hasGreeks = filteredOptions.some(opt => opt.delta !== null);

  if (filteredOptions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No options in selected strike range</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the ± range</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredOptions.length} of {options.length} options (${minS.toFixed(0)} - ${maxS.toFixed(0)})
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strike</th>
            <th className="text-right py-3 px-2 font-medium">Last</th>
            <th className="text-right py-3 px-2 font-medium">Bid</th>
            <th className="text-right py-3 px-2 font-medium">Ask</th>
            <th className="text-right py-3 px-2 font-medium">IV%</th>
            {hasGreeks && (
              <>
                <th className="text-right py-3 px-2 font-medium text-blue-400">Δ</th>
                <th className="text-right py-3 px-2 font-medium text-purple-400">Γ</th>
                <th className="text-right py-3 px-2 font-medium text-amber-400">Θ</th>
                <th className="text-right py-3 px-2 font-medium text-emerald-400">V</th>
              </>
            )}
            <th className="text-right py-3 px-2 font-medium">Vol</th>
            <th className="text-right py-3 px-2 font-medium">OI</th>
          </tr>
        </thead>
        <tbody>
          {filteredOptions.map((opt, idx) => (
            <tr 
              key={idx} 
              className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                opt.inTheMoney ? (type === 'calls' ? 'bg-green-500/5' : 'bg-red-500/5') : ''
              }`}
            >
              <td className="py-2.5 px-2 font-mono font-medium text-white">
                ${opt.strike.toFixed(2)}
                {opt.inTheMoney && (
                  <span className={`ml-2 text-xs ${type === 'calls' ? 'text-green-500' : 'text-red-500'}`}>ITM</span>
                )}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-white">${opt.lastPrice.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${opt.bid.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${opt.ask.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.impliedVolatility.toFixed(1)}%</td>
              {hasGreeks && (
                <>
                  <td className="text-right py-2.5 px-2 font-mono text-blue-400">
                    {opt.delta !== null ? opt.delta.toFixed(3) : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-purple-400">
                    {opt.gamma !== null ? opt.gamma.toFixed(4) : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-amber-400">
                    {opt.theta !== null ? opt.theta.toFixed(3) : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-emerald-400">
                    {opt.vega !== null ? opt.vega.toFixed(3) : '-'}
                  </td>
                </>
              )}
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.volume?.toLocaleString() || '-'}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.openInterest?.toLocaleString() || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredOptions.length === 0 && (
        <p className="text-zinc-500 text-center py-4">No options near current price</p>
      )}
      {hasGreeks && (
        <div className="flex gap-4 mt-3 text-xs text-zinc-500 justify-end">
          <span><span className="text-blue-400">Δ</span> Delta</span>
          <span><span className="text-purple-400">Γ</span> Gamma</span>
          <span><span className="text-amber-400">Θ</span> Theta</span>
          <span><span className="text-emerald-400">V</span> Vega</span>
        </div>
      )}
    </div>
  );
};

// Credit Spread Table Component
const CreditSpreadTable = ({ spreads, type, currentPrice, minCredit, maxRiskReward, onSelectStrategy }) => {
  if (!spreads || spreads.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No {type} spreads available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Apply filters
  const filteredSpreads = spreads.filter(spread => 
    spread.net_credit >= minCredit && 
    spread.risk_reward_ratio <= maxRiskReward
  );

  const isBullPut = type === "Bull Put";

  if (filteredSpreads.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No spreads match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try lowering min credit or increasing max risk/reward</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredSpreads.length} of {spreads.length} spreads
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strikes</th>
            <th className="text-right py-3 px-2 font-medium">Sell</th>
            <th className="text-right py-3 px-2 font-medium">Buy</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Breakeven</th>
            <th className="text-right py-3 px-2 font-medium">Risk/Reward</th>
            <th className="text-right py-3 px-2 font-medium text-cyan-400">P(OTM)</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
          </tr>
        </thead>
        <tbody>
          {filteredSpreads.map((spread, idx) => {
            const distanceFromPrice = isBullPut 
              ? ((currentPrice - spread.sell_strike) / currentPrice * 100).toFixed(1)
              : ((spread.sell_strike - currentPrice) / currentPrice * 100).toFixed(1);
            
            return (
              <tr 
                key={idx} 
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="py-2.5 px-2">
                  <div className="font-mono font-medium text-white">
                    ${spread.sell_strike} / ${spread.buy_strike}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {distanceFromPrice}% {isBullPut ? 'below' : 'above'} spot
                  </div>
                </td>
                <td className="text-right py-2.5 px-2 font-mono text-red-400">${spread.sell_premium.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${spread.buy_premium.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">${spread.net_credit.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-green-400">${spread.max_profit.toFixed(0)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-red-400">${spread.max_loss.toFixed(0)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-white">${spread.breakeven.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{spread.risk_reward_ratio.toFixed(1)}:1</td>
                <td className="text-right py-2.5 px-2 font-mono text-cyan-400 font-medium">
                  {spread.probability_otm ? `${spread.probability_otm.toFixed(0)}%` : '-'}
                </td>
                <td className="text-center py-2.5 px-2">
                  <button
                    onClick={() => onSelectStrategy({
                      type: isBullPut ? 'bull_put' : 'bear_call',
                      name: `${type} ${spread.sell_strike}/${spread.buy_strike}`,
                      sell_strike: spread.sell_strike,
                      buy_strike: spread.buy_strike,
                      net_credit: spread.net_credit
                    })}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                    title="View P/L Chart"
                  >
                    <LineChartIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Iron Condor Table Component
const IronCondorTable = ({ condors, currentPrice, minCredit, maxRiskReward, onSelectStrategy }) => {
  if (!condors || condors.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Iron Condors available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Apply filters
  const filteredCondors = condors.filter(ic => 
    ic.net_credit >= minCredit && 
    ic.risk_reward_ratio <= maxRiskReward
  );

  if (filteredCondors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Iron Condors match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try lowering min credit or increasing max risk/reward</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredCondors.length} of {condors.length} Iron Condors
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Put Spread</th>
            <th className="text-left py-3 px-2 font-medium">Call Spread</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Profit Zone</th>
            <th className="text-right py-3 px-2 font-medium">R/R</th>
            <th className="text-right py-3 px-2 font-medium text-cyan-400">P(Profit)</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
          </tr>
        </thead>
        <tbody>
          {filteredCondors.map((ic, idx) => (
            <tr 
              key={idx} 
              className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
            >
              <td className="py-2.5 px-2">
                <div className="font-mono text-white">
                  <span className="text-red-400">${ic.put_sell_strike}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-400">${ic.put_buy_strike}</span>
                </div>
                <div className="text-xs text-green-400">+${ic.put_credit.toFixed(2)}</div>
              </td>
              <td className="py-2.5 px-2">
                <div className="font-mono text-white">
                  <span className="text-red-400">${ic.call_sell_strike}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-400">${ic.call_buy_strike}</span>
                </div>
                <div className="text-xs text-green-400">+${ic.call_credit.toFixed(2)}</div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">
                ${ic.net_credit.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">
                ${ic.max_profit.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">
                ${ic.max_loss.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2">
                <div className="font-mono text-white text-xs">
                  ${ic.lower_breakeven.toFixed(0)} - ${ic.upper_breakeven.toFixed(0)}
                </div>
                <div className="text-xs text-zinc-500">
                  {ic.profit_zone_pct.toFixed(1)}% width
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                {ic.risk_reward_ratio.toFixed(1)}:1
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-cyan-400 font-medium">
                {ic.probability_profit ? `${ic.probability_profit.toFixed(0)}%` : '-'}
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'iron_condor',
                    name: `IC ${ic.put_sell_strike}/${ic.put_buy_strike} - ${ic.call_sell_strike}/${ic.call_buy_strike}`,
                    put_sell_strike: ic.put_sell_strike,
                    put_buy_strike: ic.put_buy_strike,
                    put_credit: ic.put_credit,
                    call_sell_strike: ic.call_sell_strike,
                    call_buy_strike: ic.call_buy_strike,
                    call_credit: ic.call_credit,
                    net_credit: ic.net_credit
                  })}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  title="View P/L Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Iron Butterfly Table Component
const IronButterflyTable = ({ butterflies, currentPrice, minCredit, maxRiskReward, onSelectStrategy }) => {
  if (!butterflies || butterflies.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Iron Butterflies available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Apply filters
  const filteredButterflies = butterflies.filter(ib => 
    ib.net_credit >= minCredit && 
    ib.risk_reward_ratio <= maxRiskReward
  );

  if (filteredButterflies.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Iron Butterflies match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try lowering min credit or increasing max risk/reward</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredButterflies.length} of {butterflies.length} Iron Butterflies
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Center (Sell)</th>
            <th className="text-left py-3 px-2 font-medium">Wings (Buy)</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Breakevens</th>
            <th className="text-right py-3 px-2 font-medium">R/R</th>
            <th className="text-right py-3 px-2 font-medium">From Spot</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
          </tr>
        </thead>
        <tbody>
          {filteredButterflies.map((ib, idx) => (
            <tr 
              key={idx} 
              className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
            >
              <td className="py-2.5 px-2">
                <div className="font-mono font-medium text-white">
                  ${ib.center_strike.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500">
                  C: <span className="text-green-400">+${ib.call_premium}</span>
                  {' '}P: <span className="text-green-400">+${ib.put_premium}</span>
                </div>
              </td>
              <td className="py-2.5 px-2">
                <div className="font-mono text-zinc-400">
                  ${ib.lower_strike.toLocaleString()} / ${ib.upper_strike.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500">
                  <span className="text-red-400">-${ib.lower_cost}</span>
                  {' / '}
                  <span className="text-red-400">-${ib.upper_cost}</span>
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">
                ${ib.net_credit.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">
                ${ib.max_profit.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">
                ${ib.max_loss.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2">
                <div className="font-mono text-white text-xs">
                  ${ib.lower_breakeven.toFixed(0)} - ${ib.upper_breakeven.toFixed(0)}
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                {ib.risk_reward_ratio.toFixed(1)}:1
              </td>
              <td className={`text-right py-2.5 px-2 font-mono ${Math.abs(ib.distance_from_spot) < 1 ? 'text-green-400' : 'text-zinc-400'}`}>
                {ib.distance_from_spot >= 0 ? '+' : ''}{ib.distance_from_spot.toFixed(1)}%
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'iron_butterfly',
                    name: `IB ${ib.lower_strike}/${ib.center_strike}/${ib.upper_strike}`,
                    center_strike: ib.center_strike,
                    lower_strike: ib.lower_strike,
                    upper_strike: ib.upper_strike,
                    net_credit: ib.net_credit
                  })}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  title="View P/L Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Straddle Table Component
const StraddleTable = ({ straddles, currentPrice, onSelectStrategy }) => {
  if (!straddles || straddles.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Straddles available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {straddles.length} straddles near ATM
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strike</th>
            <th className="text-right py-3 px-2 font-medium">Call</th>
            <th className="text-right py-3 px-2 font-medium">Put</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Total Cost</th>
            <th className="text-right py-3 px-2 font-medium">Breakevens</th>
            <th className="text-right py-3 px-2 font-medium text-amber-400">Move to B/E</th>
            <th className="text-right py-3 px-2 font-medium text-purple-400">Avg IV</th>
            <th className="text-right py-3 px-2 font-medium">From Spot</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
          </tr>
        </thead>
        <tbody>
          {straddles.map((s, idx) => (
            <tr 
              key={idx} 
              className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${Math.abs(s.distance_from_spot) < 0.5 ? 'bg-blue-500/5' : ''}`}
            >
              <td className="py-2.5 px-2 font-mono font-medium text-white">
                ${s.strike.toLocaleString()}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                ${s.call_price.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                ${s.put_price.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400 font-medium">
                ${s.total_cost.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2">
                <div className="font-mono text-white text-xs">
                  ${s.lower_breakeven.toFixed(0)} - ${s.upper_breakeven.toFixed(0)}
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-amber-400">
                ±{s.breakeven_move_pct.toFixed(1)}%
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-purple-400">
                {s.avg_iv.toFixed(1)}%
              </td>
              <td className={`text-right py-2.5 px-2 font-mono ${Math.abs(s.distance_from_spot) < 0.5 ? 'text-green-400' : 'text-zinc-400'}`}>
                {s.distance_from_spot >= 0 ? '+' : ''}{s.distance_from_spot.toFixed(1)}%
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'straddle',
                    name: `Straddle ${s.strike}`,
                    strike: s.strike,
                    total_cost: s.total_cost
                  })}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  title="View P/L Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Strangle Table Component
const StrangleTable = ({ strangles, currentPrice, onSelectStrategy }) => {
  if (!strangles || strangles.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Strangles available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {strangles.length} strangles (sorted by cost)
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Put Strike</th>
            <th className="text-left py-3 px-2 font-medium">Call Strike</th>
            <th className="text-right py-3 px-2 font-medium">Width</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Total Cost</th>
            <th className="text-right py-3 px-2 font-medium">Breakevens</th>
            <th className="text-right py-3 px-2 font-medium text-amber-400">Move to B/E</th>
            <th className="text-right py-3 px-2 font-medium text-purple-400">Avg IV</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
          </tr>
        </thead>
        <tbody>
          {strangles.map((s, idx) => (
            <tr 
              key={idx} 
              className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
            >
              <td className="py-2.5 px-2">
                <div className="font-mono font-medium text-white">${s.put_strike.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">${s.put_price.toFixed(2)}</div>
              </td>
              <td className="py-2.5 px-2">
                <div className="font-mono font-medium text-white">${s.call_strike.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">${s.call_price.toFixed(2)}</div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                ${s.width.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400 font-medium">
                ${s.total_cost.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2">
                <div className="font-mono text-white text-xs">
                  ${s.lower_breakeven.toFixed(0)} - ${s.upper_breakeven.toFixed(0)}
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-amber-400">
                ±{s.breakeven_move_pct.toFixed(1)}%
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-purple-400">
                {s.avg_iv.toFixed(1)}%
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'strangle',
                    name: `Strangle ${s.put_strike}/${s.call_strike}`,
                    call_strike: s.call_strike,
                    put_strike: s.put_strike,
                    total_cost: s.total_cost
                  })}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  title="View P/L Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Calendar Spread Table Component
const CalendarSpreadTable = ({ spreads, currentPrice }) => {
  if (!spreads || spreads.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Calendar Spreads available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {spreads.length} calendar spreads (sorted by distance from ATM)
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strike</th>
            <th className="text-center py-3 px-2 font-medium">Type</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Sell (Near)</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Buy (Far)</th>
            <th className="text-right py-3 px-2 font-medium text-amber-400">Net Debit</th>
            <th className="text-right py-3 px-2 font-medium">Near IV</th>
            <th className="text-right py-3 px-2 font-medium">Far IV</th>
            <th className="text-right py-3 px-2 font-medium text-cyan-400">IV Diff</th>
            <th className="text-right py-3 px-2 font-medium text-purple-400">θ Edge</th>
            <th className="text-right py-3 px-2 font-medium">From Spot</th>
          </tr>
        </thead>
        <tbody>
          {spreads.map((cs, idx) => (
            <tr 
              key={idx} 
              className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${Math.abs(cs.distance_from_spot) < 0.5 ? 'bg-blue-500/5' : ''}`}
            >
              <td className="py-2.5 px-2 font-mono font-medium text-white">
                ${cs.strike.toLocaleString()}
              </td>
              <td className="text-center py-2.5 px-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${cs.option_type === 'call' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {cs.option_type.toUpperCase()}
                </span>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">
                ${cs.near_price.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">
                ${cs.far_price.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-amber-400 font-medium">
                ${cs.net_debit.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                {cs.near_iv.toFixed(1)}%
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                {cs.far_iv.toFixed(1)}%
              </td>
              <td className={`text-right py-2.5 px-2 font-mono ${cs.iv_difference > 0 ? 'text-cyan-400' : 'text-zinc-500'}`}>
                {cs.iv_difference > 0 ? '+' : ''}{cs.iv_difference.toFixed(1)}%
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-purple-400">
                {cs.theta_edge ? `$${cs.theta_edge.toFixed(2)}` : '-'}
              </td>
              <td className={`text-right py-2.5 px-2 font-mono ${Math.abs(cs.distance_from_spot) < 0.5 ? 'text-green-400' : 'text-zinc-400'}`}>
                {cs.distance_from_spot >= 0 ? '+' : ''}{cs.distance_from_spot.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Common stock/index symbols with options
const POPULAR_SYMBOLS = [
  { value: "^SPX", label: "^SPX (S&P 500 Index)" },
  { value: "^GSPC", label: "^GSPC (S&P 500)" },
  { value: "SPY", label: "SPY (S&P 500 ETF)" },
  { value: "QQQ", label: "QQQ (Nasdaq-100 ETF)" },
  { value: "^NDX", label: "^NDX (Nasdaq-100 Index)" },
  { value: "IWM", label: "IWM (Russell 2000 ETF)" },
  { value: "AAPL", label: "AAPL (Apple)" },
  { value: "MSFT", label: "MSFT (Microsoft)" },
  { value: "NVDA", label: "NVDA (Nvidia)" },
  { value: "TSLA", label: "TSLA (Tesla)" },
  { value: "AMZN", label: "AMZN (Amazon)" },
  { value: "META", label: "META (Meta)" },
  { value: "GOOGL", label: "GOOGL (Google)" },
];

function App() {
  // Symbol state
  const [symbol, setSymbol] = useState("^SPX");
  const [symbolInput, setSymbolInput] = useState("^SPX");
  
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [period, setPeriod] = useState("1mo");
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  
  // Options chain state
  const [expirations, setExpirations] = useState([]);
  const [selectedExpiration, setSelectedExpiration] = useState("");
  const [optionsChain, setOptionsChain] = useState(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [strikeRange, setStrikeRange] = useState(15); // ±15% default
  
  // Credit spreads state
  const [creditSpreads, setCreditSpreads] = useState(null);
  const [isLoadingSpreads, setIsLoadingSpreads] = useState(false);
  const [spreadWidth, setSpreadWidth] = useState(5);
  const [minCredit, setMinCredit] = useState(0);
  const [maxRiskReward, setMaxRiskReward] = useState(100);
  
  // Iron Condors state
  const [ironCondors, setIronCondors] = useState(null);
  const [isLoadingCondors, setIsLoadingCondors] = useState(false);
  
  // Iron Butterflies state
  const [ironButterflies, setIronButterflies] = useState(null);
  const [isLoadingButterflies, setIsLoadingButterflies] = useState(false);
  const [wingWidth, setWingWidth] = useState(25);
  
  // Straddle/Strangle state
  const [straddles, setStraddles] = useState(null);
  const [strangles, setStrangles] = useState(null);
  const [isLoadingStraddles, setIsLoadingStraddles] = useState(false);
  const [isLoadingStrangles, setIsLoadingStrangles] = useState(false);
  
  // Calendar spreads state
  const [calendarSpreads, setCalendarSpreads] = useState(null);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [farExpiration, setFarExpiration] = useState("");
  
  // P/L Chart state
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [showPLChart, setShowPLChart] = useState(false);

  const fetchQuote = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/quote?symbol=${symbol}`);
      setQuote(response.data);
      setError(null);
    } catch (e) {
      console.error(`Error fetching ${symbol} quote:`, e);
      setError(`Failed to fetch ${symbol} data. Make sure the symbol is valid.`);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [symbol]);

  const fetchHistory = useCallback(async (selectedPeriod) => {
    setIsLoadingHistory(true);
    try {
      const response = await axios.get(`${API}/history?symbol=${symbol}&period=${selectedPeriod}`);
      setHistory(response.data.data);
    } catch (e) {
      console.error(`Error fetching ${symbol} history:`, e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [symbol]);

  const fetchExpirations = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/options/expirations?symbol=${symbol}`);
      setExpirations(response.data.expirations);
      if (response.data.expirations.length > 0 && !selectedExpiration) {
        setSelectedExpiration(response.data.expirations[0]);
      }
    } catch (e) {
      console.error(`Error fetching ${symbol} options expirations:`, e);
      setExpirations([]);
    }
  }, [symbol, selectedExpiration]);

  const fetchOptionsChain = useCallback(async (expiration) => {
    if (!expiration) return;
    setIsLoadingOptions(true);
    try {
      const response = await axios.get(`${API}/options/chain?symbol=${symbol}&expiration=${expiration}`);
      setOptionsChain(response.data);
    } catch (e) {
      console.error("Error fetching options chain:", e);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  const fetchCreditSpreads = useCallback(async (expiration, width) => {
    if (!expiration) return;
    setIsLoadingSpreads(true);
    try {
      const response = await axios.get(`${API}/credit-spreads?symbol=${symbol}&expiration=${expiration}&spread=${width}`);
      setCreditSpreads(response.data);
    } catch (e) {
      console.error(`Error fetching ${symbol} credit spreads:`, e);
    } finally {
      setIsLoadingSpreads(false);
    }
  }, [symbol]);

  const fetchIronCondors = useCallback(async (expiration, width) => {
    if (!expiration) return;
    setIsLoadingCondors(true);
    try {
      const response = await axios.get(`${API}/iron-condors?symbol=${symbol}&expiration=${expiration}&spread=${width}`);
      setIronCondors(response.data);
    } catch (e) {
      console.error(`Error fetching ${symbol} iron condors:`, e);
    } finally {
      setIsLoadingCondors(false);
    }
  }, [symbol]);

  const fetchIronButterflies = useCallback(async (expiration, wing) => {
    if (!expiration) return;
    setIsLoadingButterflies(true);
    try {
      const response = await axios.get(`${API}/iron-butterflies?symbol=${symbol}&expiration=${expiration}&wing=${wing}`);
      setIronButterflies(response.data);
    } catch (e) {
      console.error(`Error fetching ${symbol} iron butterflies:`, e);
    } finally {
      setIsLoadingButterflies(false);
    }
  }, [symbol]);

  const fetchStraddles = useCallback(async (expiration) => {
    if (!expiration) return;
    setIsLoadingStraddles(true);
    try {
      const response = await axios.get(`${API}/straddles?symbol=${symbol}&expiration=${expiration}`);
      setStraddles(response.data);
    } catch (e) {
      console.error(`Error fetching ${symbol} straddles:`, e);
    } finally {
      setIsLoadingStraddles(false);
    }
  }, [symbol]);

  const fetchStrangles = useCallback(async (expiration) => {
    if (!expiration) return;
    setIsLoadingStrangles(true);
    try {
      const response = await axios.get(`${API}/strangles?symbol=${symbol}&expiration=${expiration}`);
      setStrangles(response.data);
    } catch (e) {
      console.error(`Error fetching ${symbol} strangles:`, e);
    } finally {
      setIsLoadingStrangles(false);
    }
  }, [symbol]);

  const fetchCalendarSpreads = useCallback(async (nearExp, farExp) => {
    if (!nearExp || !farExp) return;
    setIsLoadingCalendars(true);
    try {
      const response = await axios.get(`${API}/calendar-spreads?symbol=${symbol}&near_exp=${nearExp}&far_exp=${farExp}`);
      setCalendarSpreads(response.data);
    } catch (e) {
      console.error(`Error fetching ${symbol} calendar spreads:`, e);
    } finally {
      setIsLoadingCalendars(false);
    }
  }, [symbol]);

  // Function to change symbol
  const handleSymbolChange = useCallback((newSymbol) => {
    setSymbol(newSymbol);
    setSymbolInput(newSymbol);
    // Reset data when symbol changes
    setQuote(null);
    setHistory([]);
    setExpirations([]);
    setSelectedExpiration("");
    setFarExpiration("");
    setOptionsChain(null);
    setCreditSpreads(null);
    setIronCondors(null);
    setIronButterflies(null);
    setStraddles(null);
    setStrangles(null);
    setCalendarSpreads(null);
    setIsLoadingQuote(true);
    setIsLoadingHistory(true);
    setError(null);
  }, []);

  const handleSymbolInputSubmit = useCallback((e) => {
    e.preventDefault();
    const trimmed = symbolInput.trim().toUpperCase();
    if (trimmed && trimmed !== symbol) {
      handleSymbolChange(trimmed);
    }
  }, [symbolInput, symbol, handleSymbolChange]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchQuote(), fetchHistory(period)]);
    setIsRefreshing(false);
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    fetchHistory(newPeriod);
  };

  const handleSelectStrategy = (strategy) => {
    setSelectedStrategy(strategy);
    setShowPLChart(true);
  };

  // Auto-refresh effect
  useEffect(() => {
    // Clear existing intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (autoRefreshInterval > 0) {
      setCountdown(autoRefreshInterval);

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return autoRefreshInterval;
          return prev - 1;
        });
      }, 1000);

      // Data refresh interval
      intervalRef.current = setInterval(() => {
        handleRefresh();
      }, autoRefreshInterval * 1000);
    } else {
      setCountdown(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefreshInterval]);

  const handleAutoRefreshChange = (value) => {
    setAutoRefreshInterval(value);
  };

  useEffect(() => {
    fetchQuote();
    fetchHistory(period);
    fetchExpirations();
  }, [fetchQuote, fetchHistory, period, fetchExpirations]);

  useEffect(() => {
    if (selectedExpiration) {
      fetchOptionsChain(selectedExpiration);
      fetchCreditSpreads(selectedExpiration, spreadWidth);
      fetchIronCondors(selectedExpiration, spreadWidth);
      fetchIronButterflies(selectedExpiration, wingWidth);
      fetchStraddles(selectedExpiration);
      fetchStrangles(selectedExpiration);
    }
  }, [selectedExpiration, fetchOptionsChain, fetchCreditSpreads, fetchIronCondors, fetchIronButterflies, fetchStraddles, fetchStrangles, spreadWidth, wingWidth]);

  // Set far expiration when expirations are loaded (pick a later one)
  useEffect(() => {
    if (expirations.length > 2 && !farExpiration) {
      // Pick an expiration that's a few weeks after the first one
      const farIndex = Math.min(3, expirations.length - 1);
      setFarExpiration(expirations[farIndex]);
    }
  }, [expirations, farExpiration]);

  // Fetch calendar spreads when both expirations are set
  useEffect(() => {
    if (selectedExpiration && farExpiration && selectedExpiration !== farExpiration) {
      fetchCalendarSpreads(selectedExpiration, farExpiration);
    }
  }, [selectedExpiration, farExpiration, fetchCalendarSpreads]);

  const isPositive = quote?.change >= 0;
  const priceColor = isPositive ? 'text-green-500' : 'text-red-500';
  const glowClass = isPositive ? 'glow-green' : 'glow-red';

  return (
    <div className="min-h-screen bg-[#09090b] noise-overlay">
      {/* Ambient Background Glows */}
      <div 
        className="ambient-glow bg-green-500/20 top-20 -left-40"
        style={{ position: 'fixed' }}
      />
      <div 
        className="ambient-glow bg-blue-500/10 bottom-20 -right-40"
        style={{ position: 'fixed' }}
      />

      <div className="max-w-7xl mx-auto px-6 py-8 md:px-12 md:py-12 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-zinc-400" />
              Options Scanner
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Real-time market data from Yahoo Finance</p>
          </div>
          
          {/* Symbol Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <form onSubmit={handleSymbolInputSubmit} className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                  placeholder="Enter symbol"
                  className="bg-zinc-900 border border-zinc-800 text-white px-4 py-2 rounded-lg font-mono text-sm w-28 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  data-testid="symbol-input"
                />
              </div>
              <button
                type="submit"
                className="bg-zinc-800 text-zinc-300 px-3 py-2 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                data-testid="symbol-submit"
              >
                Go
              </button>
            </form>
            
            <Select value={symbol} onValueChange={handleSymbolChange}>
              <SelectTrigger className="w-48 bg-zinc-900 border-zinc-800 text-white" data-testid="symbol-select">
                <SelectValue placeholder="Select symbol" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 max-h-64">
                {POPULAR_SYMBOLS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-white hover:bg-zinc-800">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Auto-refresh dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2.5 rounded-full font-medium hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-200"
                  data-testid="auto-refresh-dropdown"
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    {autoRefreshInterval === 0 
                      ? "Auto: Off" 
                      : `Auto: ${REFRESH_INTERVALS.find(i => i.value === autoRefreshInterval)?.label}`}
                  </span>
                  {autoRefreshInterval > 0 && (
                    <span className="text-xs text-zinc-500 font-mono">({countdown}s)</span>
                  )}
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                {REFRESH_INTERVALS.map((interval) => (
                  <DropdownMenuItem
                    key={interval.value}
                    onClick={() => handleAutoRefreshChange(interval.value)}
                    className={`cursor-pointer ${autoRefreshInterval === interval.value ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                    data-testid={`auto-refresh-${interval.value}`}
                  >
                    {interval.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Manual refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-medium hover:bg-zinc-200 transition-all duration-200 active:scale-95 disabled:opacity-50"
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="glass-card border-red-500/30 bg-red-500/10 p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero Ticker Card - Spans 1 column */}
          <div className={`glass-card p-8 ${glowClass} transition-all duration-500`} data-testid="price-display">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-zinc-400 text-lg">^GSPC</span>
              <span className="text-zinc-600 text-sm">S&P 500</span>
            </div>
            
            {isLoadingQuote ? (
              <div className="space-y-4">
                <div className="h-16 w-48 bg-zinc-800 rounded animate-pulse" />
                <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <span className="font-mono text-6xl font-bold text-white tracking-tight" data-testid="current-price">
                    {quote?.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                <div className={`flex items-center gap-3 ${priceColor}`}>
                  {isPositive ? (
                    <ArrowUpRight className="w-6 h-6" />
                  ) : (
                    <ArrowDownRight className="w-6 h-6" />
                  )}
                  <span className="font-mono text-2xl font-medium" data-testid="price-change">
                    {isPositive ? '+' : ''}{quote?.change.toFixed(2)}
                  </span>
                  <span className="font-mono text-lg opacity-80" data-testid="change-percent">
                    ({isPositive ? '+' : ''}{quote?.change_percent.toFixed(2)}%)
                  </span>
                </div>

                <p className="text-zinc-600 text-sm mt-4 font-mono">
                  Last updated: {quote?.timestamp ? new Date(quote.timestamp).toLocaleTimeString() : 'N/A'}
                </p>
              </>
            )}
          </div>

          {/* Chart Card - Spans 2 columns */}
          <div className="glass-card p-6 lg:col-span-2" data-testid="chart-container">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-zinc-400" />
                Historical Performance
              </h2>
              <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-full">
                <PeriodButton period="1d" currentPeriod={period} onClick={handlePeriodChange} label="1D" />
                <PeriodButton period="5d" currentPeriod={period} onClick={handlePeriodChange} label="5D" />
                <PeriodButton period="1mo" currentPeriod={period} onClick={handlePeriodChange} label="1M" />
                <PeriodButton period="3mo" currentPeriod={period} onClick={handlePeriodChange} label="3M" />
                <PeriodButton period="1y" currentPeriod={period} onClick={handlePeriodChange} label="1Y" />
                <PeriodButton period="5y" currentPeriod={period} onClick={handlePeriodChange} label="5Y" />
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="h-72 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-zinc-600 animate-spin" />
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#52525b', fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return period === '1d' || period === '5d' 
                          ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      interval="preserveStartEnd"
                      minTickGap={50}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#52525b', fontSize: 12 }}
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => value.toLocaleString()}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="close" 
                      stroke={isPositive ? "#22c55e" : "#ef4444"}
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Stats Grid - Full width, 4 columns */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              label="Open" 
              value={quote?.open} 
              icon={TrendingUp}
              isLoading={isLoadingQuote}
            />
            <StatCard 
              label="Day High" 
              value={quote?.day_high} 
              icon={TrendingUp}
              isLoading={isLoadingQuote}
            />
            <StatCard 
              label="Day Low" 
              value={quote?.day_low} 
              icon={TrendingDown}
              isLoading={isLoadingQuote}
            />
            <StatCard 
              label="Prev Close" 
              value={quote?.previous_close} 
              icon={Activity}
              isLoading={isLoadingQuote}
            />
          </div>

          {/* 52-Week Range */}
          <div className="lg:col-span-3 glass-card p-6">
            <h3 className="text-zinc-400 text-sm mb-4">52-Week Range</h3>
            <div className="flex items-center gap-4">
              <span className="font-mono text-white">
                {isLoadingQuote ? (
                  <span className="inline-block h-5 w-20 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  quote?.fifty_two_week_low?.toLocaleString('en-US', { minimumFractionDigits: 2 })
                )}
              </span>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                {!isLoadingQuote && quote && (
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative"
                    style={{ 
                      width: `${((quote.price - quote.fifty_two_week_low) / (quote.fifty_two_week_high - quote.fifty_two_week_low)) * 100}%` 
                    }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                  </div>
                )}
              </div>
              <span className="font-mono text-white">
                {isLoadingQuote ? (
                  <span className="inline-block h-5 w-20 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  quote?.fifty_two_week_high?.toLocaleString('en-US', { minimumFractionDigits: 2 })
                )}
              </span>
            </div>
          </div>

          {/* Options Chain Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="options-chain">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Table2 className="w-5 h-5 text-zinc-400" />
                Options Chain (^SPX)
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-sm">Expiration:</span>
                <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
                  <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-white" data-testid="expiration-select">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {expirations.slice(0, 12).map((exp) => (
                      <SelectItem key={exp} value={exp} className="text-white hover:bg-zinc-800">
                        {new Date(exp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingOptions && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button
                  onClick={() => exportOptionsChain(optionsChain?.calls, 'Calls', selectedExpiration)}
                  disabled={!optionsChain?.calls?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Calls to CSV"
                >
                  <Download className="w-3 h-3" />
                  Calls
                </button>
                <button
                  onClick={() => exportOptionsChain(optionsChain?.puts, 'Puts', selectedExpiration)}
                  disabled={!optionsChain?.puts?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Puts to CSV"
                >
                  <Download className="w-3 h-3" />
                  Puts
                </button>
              </div>
            </div>

            <p className="text-zinc-500 text-xs mb-3">
              S&P 500 Index Options (^SPX). European-style, cash-settled.
            </p>

            {/* Strike Range Filter */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2">
                <label className="text-zinc-400 text-sm">Strike Range:</label>
                <Select value={strikeRange.toString()} onValueChange={(v) => setStrikeRange(parseInt(v))}>
                  <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8" data-testid="strike-range-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[2, 5, 10, 15, 20, 25, 30, 50].map((pct) => (
                      <SelectItem key={pct} value={pct.toString()} className="text-white hover:bg-zinc-800">
                        ±{pct}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {quote && (
                <span className="text-zinc-500 text-xs">
                  Current: <span className="text-white font-mono">${quote.price.toLocaleString()}</span>
                  <span className="text-zinc-600 mx-2">|</span>
                  Range: <span className="text-white font-mono">${(quote.price * (1 - strikeRange/100)).toFixed(0)} - ${(quote.price * (1 + strikeRange/100)).toFixed(0)}</span>
                </span>
              )}
            </div>

            <Tabs defaultValue="calls" className="w-full">
              <TabsList className="bg-zinc-900/50 mb-4">
                <TabsTrigger value="calls" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500" data-testid="calls-tab">
                  Calls
                </TabsTrigger>
                <TabsTrigger value="puts" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500" data-testid="puts-tab">
                  Puts
                </TabsTrigger>
              </TabsList>
              <TabsContent value="calls" className="max-h-96 overflow-y-auto">
                {isLoadingOptions ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <OptionsTable 
                    options={optionsChain?.calls} 
                    type="calls" 
                    currentPrice={quote?.price}
                    strikeRange={strikeRange}
                  />
                )}
              </TabsContent>
              <TabsContent value="puts" className="max-h-96 overflow-y-auto">
                {isLoadingOptions ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <OptionsTable 
                    options={optionsChain?.puts} 
                    type="puts" 
                    currentPrice={quote?.price}
                    strikeRange={strikeRange}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Credit Spreads Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="credit-spreads">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-zinc-400" />
                Credit Spreads (${spreadWidth} wide)
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-sm">Width:</span>
                <Select value={spreadWidth.toString()} onValueChange={(v) => setSpreadWidth(parseInt(v))}>
                  <SelectTrigger className="w-20 bg-zinc-900 border-zinc-800 text-white" data-testid="spread-width-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[1, 2, 5, 10, 15, 20].map((w) => (
                      <SelectItem key={w} value={w.toString()} className="text-white hover:bg-zinc-800">
                        ${w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingSpreads && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button
                  onClick={() => exportCreditSpreads(creditSpreads?.bull_put_spreads, 'BullPut', selectedExpiration)}
                  disabled={!creditSpreads?.bull_put_spreads?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Bull Put Spreads to CSV"
                >
                  <Download className="w-3 h-3" />
                  Bull Put
                </button>
                <button
                  onClick={() => exportCreditSpreads(creditSpreads?.bear_call_spreads, 'BearCall', selectedExpiration)}
                  disabled={!creditSpreads?.bear_call_spreads?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Bear Call Spreads to CSV"
                >
                  <Download className="w-3 h-3" />
                  Bear Call
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2">
                <label className="text-zinc-400 text-sm">Min Credit:</label>
                <Select value={minCredit.toString()} onValueChange={(v) => setMinCredit(parseFloat(v))}>
                  <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8" data-testid="min-credit-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.50, 0.75, 1.00, 1.50, 2.00].map((c) => (
                      <SelectItem key={c} value={c.toString()} className="text-white hover:bg-zinc-800">
                        ${c.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-zinc-400 text-sm">Max Risk/Reward:</label>
                <Select value={maxRiskReward.toString()} onValueChange={(v) => setMaxRiskReward(parseFloat(v))}>
                  <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8" data-testid="max-rr-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[5, 10, 15, 20, 25, 50, 100].map((rr) => (
                      <SelectItem key={rr} value={rr.toString()} className="text-white hover:bg-zinc-800">
                        {rr}:1
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button 
                onClick={() => { setMinCredit(0); setMaxRiskReward(100); }}
                className="text-zinc-500 hover:text-white text-sm underline transition-colors"
              >
                Reset filters
              </button>
            </div>

            {creditSpreads && (
              <div className="mb-4 flex gap-4 text-sm">
                <span className="text-zinc-400">^SPX: <span className="text-white font-mono">${creditSpreads.current_price.toLocaleString()}</span></span>
                <span className="text-zinc-400">Exp: <span className="text-white">{new Date(creditSpreads.expiration).toLocaleDateString()}</span></span>
              </div>
            )}

            <Tabs defaultValue="bull-put" className="w-full">
              <TabsList className="bg-zinc-900/50 mb-4">
                <TabsTrigger value="bull-put" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500" data-testid="bull-put-tab">
                  Bull Put Spreads ({creditSpreads?.bull_put_spreads?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="bear-call" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500" data-testid="bear-call-tab">
                  Bear Call Spreads ({creditSpreads?.bear_call_spreads?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bull-put" className="max-h-96 overflow-y-auto">
                {isLoadingSpreads ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <p className="text-zinc-500 text-xs mb-3">
                      Bullish strategy: Sell higher strike put, buy lower strike put. Profit if SPY stays above sell strike.
                    </p>
                    <CreditSpreadTable 
                      spreads={creditSpreads?.bull_put_spreads} 
                      type="Bull Put" 
                      currentPrice={creditSpreads?.current_price}
                      minCredit={minCredit}
                      maxRiskReward={maxRiskReward}
                      onSelectStrategy={handleSelectStrategy}
                    />
                  </>
                )}
              </TabsContent>
              <TabsContent value="bear-call" className="max-h-96 overflow-y-auto">
                {isLoadingSpreads ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <p className="text-zinc-500 text-xs mb-3">
                      Bearish strategy: Sell lower strike call, buy higher strike call. Profit if SPY stays below sell strike.
                    </p>
                    <CreditSpreadTable 
                      spreads={creditSpreads?.bear_call_spreads} 
                      type="Bear Call" 
                      currentPrice={creditSpreads?.current_price}
                      minCredit={minCredit}
                      maxRiskReward={maxRiskReward}
                      onSelectStrategy={handleSelectStrategy}
                    />
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Iron Condor Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="iron-condors">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-zinc-400" />
                Iron Condors (${spreadWidth} wide legs)
              </h2>
              <div className="flex items-center gap-2">
                {isLoadingCondors && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button
                  onClick={() => exportIronCondors(ironCondors?.iron_condors, selectedExpiration)}
                  disabled={!ironCondors?.iron_condors?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Iron Condors to CSV"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>
            </div>

            <p className="text-zinc-500 text-xs mb-4">
              Neutral strategy: Combines Bull Put Spread (below price) + Bear Call Spread (above price). 
              Profit if ^SPX stays within the profit zone at expiration.
            </p>

            {ironCondors && (
              <div className="mb-4 flex gap-4 text-sm">
                <span className="text-zinc-400">^SPX: <span className="text-white font-mono">${ironCondors.current_price?.toLocaleString()}</span></span>
                <span className="text-zinc-400">Exp: <span className="text-white">{new Date(ironCondors.expiration).toLocaleDateString()}</span></span>
                <span className="text-zinc-400">Found: <span className="text-white">{ironCondors.iron_condors?.length || 0}</span></span>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              {isLoadingCondors ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : (
                <IronCondorTable 
                  condors={ironCondors?.iron_condors} 
                  currentPrice={ironCondors?.current_price}
                  minCredit={minCredit}
                  maxRiskReward={maxRiskReward}
                  onSelectStrategy={handleSelectStrategy}
                />
              )}
            </div>
          </div>

          {/* Iron Butterfly Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="iron-butterflies">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Triangle className="w-5 h-5 text-zinc-400" />
                Iron Butterflies
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-sm">Wing Width:</span>
                <Select value={wingWidth.toString()} onValueChange={(v) => setWingWidth(parseInt(v))}>
                  <SelectTrigger className="w-20 bg-zinc-900 border-zinc-800 text-white" data-testid="wing-width-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[10, 15, 20, 25, 50, 75, 100].map((w) => (
                      <SelectItem key={w} value={w.toString()} className="text-white hover:bg-zinc-800">
                        ${w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingButterflies && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button
                  onClick={() => exportIronButterflies(ironButterflies?.iron_butterflies, selectedExpiration)}
                  disabled={!ironButterflies?.iron_butterflies?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Iron Butterflies to CSV"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>
            </div>

            <p className="text-zinc-500 text-xs mb-4">
              Neutral strategy: Sell ATM call + put at same strike, buy OTM wings. 
              Max profit if ^SPX expires exactly at center strike.
            </p>

            {ironButterflies && (
              <div className="mb-4 flex gap-4 text-sm">
                <span className="text-zinc-400">^SPX: <span className="text-white font-mono">${ironButterflies.current_price?.toLocaleString()}</span></span>
                <span className="text-zinc-400">Exp: <span className="text-white">{new Date(ironButterflies.expiration).toLocaleDateString()}</span></span>
                <span className="text-zinc-400">Found: <span className="text-white">{ironButterflies.iron_butterflies?.length || 0}</span></span>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              {isLoadingButterflies ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : (
                <IronButterflyTable 
                  butterflies={ironButterflies?.iron_butterflies} 
                  currentPrice={ironButterflies?.current_price}
                  minCredit={minCredit}
                  maxRiskReward={maxRiskReward}
                  onSelectStrategy={handleSelectStrategy}
                />
              )}
            </div>
          </div>

          {/* Straddle/Strangle Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="straddle-strangle">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-zinc-400" />
                Straddles & Strangles
              </h2>
              <div className="flex items-center gap-2">
                {(isLoadingStraddles || isLoadingStrangles) && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button
                  onClick={() => exportStraddles(straddles?.straddles, selectedExpiration)}
                  disabled={!straddles?.straddles?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Straddles to CSV"
                >
                  <Download className="w-3 h-3" />
                  Straddles
                </button>
                <button
                  onClick={() => exportStrangles(strangles?.strangles, selectedExpiration)}
                  disabled={!strangles?.strangles?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Strangles to CSV"
                >
                  <Download className="w-3 h-3" />
                  Strangles
                </button>
              </div>
            </div>

            <p className="text-zinc-500 text-xs mb-4">
              Volatility plays: Profit from large moves in either direction. Max loss = premium paid. Unlimited profit potential.
            </p>

            {straddles && (
              <div className="mb-4 flex gap-4 text-sm">
                <span className="text-zinc-400">^SPX: <span className="text-white font-mono">${straddles.current_price?.toLocaleString()}</span></span>
                <span className="text-zinc-400">Exp: <span className="text-white">{new Date(straddles.expiration).toLocaleDateString()}</span></span>
              </div>
            )}

            <Tabs defaultValue="straddles" className="w-full">
              <TabsList className="bg-zinc-900/50 mb-4">
                <TabsTrigger value="straddles" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400" data-testid="straddles-tab">
                  Straddles ({straddles?.straddles?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="strangles" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400" data-testid="strangles-tab">
                  Strangles ({strangles?.strangles?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="straddles" className="max-h-96 overflow-y-auto">
                {isLoadingStraddles ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <p className="text-zinc-500 text-xs mb-3">
                      Buy call + put at same strike. Profit if ^SPX moves more than the total premium paid.
                    </p>
                    <StraddleTable straddles={straddles?.straddles} currentPrice={straddles?.current_price} onSelectStrategy={handleSelectStrategy} />
                  </>
                )}
              </TabsContent>
              <TabsContent value="strangles" className="max-h-96 overflow-y-auto">
                {isLoadingStrangles ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <p className="text-zinc-500 text-xs mb-3">
                      Buy OTM call + OTM put. Cheaper than straddles but needs larger move to profit.
                    </p>
                    <StrangleTable strangles={strangles?.strangles} currentPrice={strangles?.current_price} onSelectStrategy={handleSelectStrategy} />
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Calendar Spreads Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="calendar-spreads">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-zinc-400" />
                Calendar Spreads
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-sm">Far Exp:</span>
                <Select value={farExpiration} onValueChange={setFarExpiration}>
                  <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-white" data-testid="far-expiration-select">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {expirations.slice(1, 12).map((exp) => (
                      <SelectItem 
                        key={exp} 
                        value={exp} 
                        className="text-white hover:bg-zinc-800"
                        disabled={exp === selectedExpiration}
                      >
                        {new Date(exp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingCalendars && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button
                  onClick={() => exportCalendarSpreads(calendarSpreads?.calendar_spreads, selectedExpiration, farExpiration)}
                  disabled={!calendarSpreads?.calendar_spreads?.length}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Export Calendar Spreads to CSV"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>
            </div>

            <p className="text-zinc-500 text-xs mb-4">
              Time decay strategy: Sell near-term option, buy far-term option at same strike. 
              Profits from faster theta decay of near-term option and/or IV increase.
            </p>

            {calendarSpreads && (
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <span className="text-zinc-400">^SPX: <span className="text-white font-mono">${calendarSpreads.current_price?.toLocaleString()}</span></span>
                <span className="text-zinc-400">Near: <span className="text-white">{new Date(calendarSpreads.near_expiration).toLocaleDateString()}</span></span>
                <span className="text-zinc-400">Far: <span className="text-white">{new Date(calendarSpreads.far_expiration).toLocaleDateString()}</span></span>
                <span className="text-zinc-400">Found: <span className="text-white">{calendarSpreads.calendar_spreads?.length || 0}</span></span>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              {isLoadingCalendars ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : (
                <CalendarSpreadTable spreads={calendarSpreads?.calendar_spreads} currentPrice={calendarSpreads?.current_price} />
              )}
            </div>
          </div>
        </div>

        {/* P/L Chart Dialog */}
        {showPLChart && selectedStrategy && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowPLChart(false)}>
            <div className="glass-card p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-purple-400" />
                  P/L at Expiration: {selectedStrategy.name}
                </h3>
                <button 
                  onClick={() => setShowPLChart(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PLChart 
                strategy={selectedStrategy} 
                currentPrice={quote?.price} 
                onClose={() => setShowPLChart(false)}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-zinc-600 text-sm">
          <p>Data provided by Yahoo Finance. Prices may be delayed.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;

import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Clock, ChevronDown, ChevronRight, Table2, Calculator, Plus, Trash2, X, Layers, Triangle, ArrowLeftRight, LineChart as LineChartIcon, Download, Calendar, Briefcase, DollarSign, CheckCircle, XCircle } from "lucide-react";
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
  DialogFooter,
  DialogDescription,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";

// Import utilities and constants from modular structure
import { API, REFRESH_INTERVALS, POPULAR_SYMBOLS } from "./utils/constants";
import {
  calculatePLData,
  calculateBullPutPL,
  calculateBearCallPL,
  calculateIronCondorPL,
  calculateIronButterflyPL,
  calculateStraddlePL,
  calculateStranglePL,
} from "./utils/calculations";
import {
  downloadCSV,
  exportOptionsChain,
  exportCreditSpreads,
  exportIronCondors,
  exportStraddles,
  exportStrangles,
  exportIronButterflies,
  exportCalendarSpreads,
} from "./utils/exportUtils";

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
        P/L at expiration based on underlying price. Current price: ${currentPrice?.toLocaleString()}
      </div>
    </div>
  );
};

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

// Generated Credit Spreads from Filtered Options
const GeneratedSpreadsTable = ({ options, type, currentPrice, strikeRange, spreadWidth, onTrade }) => {
  if (!options || options.length === 0 || !currentPrice) {
    return <p className="text-zinc-500 text-center py-8">No options data available</p>;
  }

  // Apply strike range filter
  const rangePct = strikeRange / 100;
  const minS = currentPrice * (1 - rangePct);
  const maxS = currentPrice * (1 + rangePct);
  const filteredOptions = options.filter(opt => opt.strike >= minS && opt.strike <= maxS);

  if (filteredOptions.length < 2) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">Need at least 2 options to generate spreads</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the ± range</p>
      </div>
    );
  }

  // Generate credit spreads from filtered options
  const spreads = [];
  const sortedOptions = [...filteredOptions].sort((a, b) => a.strike - b.strike);

  if (type === 'puts') {
    // Bull Put Spreads: Sell higher strike put, buy lower strike put (below current price)
    const otmPuts = sortedOptions.filter(opt => opt.strike < currentPrice);
    for (let i = 0; i < otmPuts.length; i++) {
      for (let j = 0; j < i; j++) {
        const sellPut = otmPuts[i]; // Higher strike (sell)
        const buyPut = otmPuts[j];  // Lower strike (buy)
        const width = sellPut.strike - buyPut.strike;
        
        if (width > 0 && width <= spreadWidth * 2 && sellPut.bid > 0 && buyPut.ask > 0) {
          const netCredit = sellPut.bid - buyPut.ask;
          if (netCredit > 0) {
            const maxProfit = netCredit * 100;
            const maxLoss = (width - netCredit) * 100;
            spreads.push({
              type: 'Bull Put',
              sell_strike: sellPut.strike,
              buy_strike: buyPut.strike,
              sell_premium: sellPut.bid,
              buy_premium: buyPut.ask,
              net_credit: netCredit,
              max_profit: maxProfit,
              max_loss: maxLoss,
              breakeven: sellPut.strike - netCredit,
              risk_reward: maxLoss / maxProfit,
              width: width,
              sell_delta: sellPut.delta,
              buy_delta: buyPut.delta,
              probability_otm: sellPut.delta ? (1 - Math.abs(sellPut.delta)) * 100 : null
            });
          }
        }
      }
    }
  } else {
    // Bear Call Spreads: Sell lower strike call, buy higher strike call (above current price)
    const otmCalls = sortedOptions.filter(opt => opt.strike > currentPrice);
    for (let i = 0; i < otmCalls.length; i++) {
      for (let j = i + 1; j < otmCalls.length; j++) {
        const sellCall = otmCalls[i]; // Lower strike (sell)
        const buyCall = otmCalls[j];  // Higher strike (buy)
        const width = buyCall.strike - sellCall.strike;
        
        if (width > 0 && width <= spreadWidth * 2 && sellCall.bid > 0 && buyCall.ask > 0) {
          const netCredit = sellCall.bid - buyCall.ask;
          if (netCredit > 0) {
            const maxProfit = netCredit * 100;
            const maxLoss = (width - netCredit) * 100;
            spreads.push({
              type: 'Bear Call',
              sell_strike: sellCall.strike,
              buy_strike: buyCall.strike,
              sell_premium: sellCall.bid,
              buy_premium: buyCall.ask,
              net_credit: netCredit,
              max_profit: maxProfit,
              max_loss: maxLoss,
              breakeven: sellCall.strike + netCredit,
              risk_reward: maxLoss / maxProfit,
              width: width,
              sell_delta: sellCall.delta,
              buy_delta: buyCall.delta,
              probability_otm: sellCall.delta ? (1 - Math.abs(sellCall.delta)) * 100 : null
            });
          }
        }
      }
    }
  }

  // Sort by probability OTM (highest first), then by credit
  spreads.sort((a, b) => {
    if (a.probability_otm && b.probability_otm) {
      return b.probability_otm - a.probability_otm;
    }
    return b.net_credit - a.net_credit;
  });

  const topSpreads = spreads.slice(0, 15);

  if (topSpreads.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No valid {type === 'puts' ? 'Bull Put' : 'Bear Call'} spreads found</p>
        <p className="text-zinc-600 text-sm mt-1">
          {type === 'puts' ? 'Need OTM puts below current price' : 'Need OTM calls above current price'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Generated {topSpreads.length} {type === 'puts' ? 'Bull Put' : 'Bear Call'} spreads from filtered options
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Spread</th>
            <th className="text-right py-3 px-2 font-medium">Width</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Breakeven</th>
            <th className="text-right py-3 px-2 font-medium">R/R</th>
            <th className="text-right py-3 px-2 font-medium text-blue-400">P(OTM)</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {topSpreads.map((spread, idx) => (
            <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="py-2.5 px-2 font-mono">
                <div className="text-red-400 text-xs">Sell ${spread.sell_strike}</div>
                <div className="text-green-400 text-xs">Buy ${spread.buy_strike}</div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${spread.width}</td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">${spread.net_credit.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">${spread.max_profit.toFixed(0)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">${spread.max_loss.toFixed(0)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-white">${spread.breakeven.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{spread.risk_reward.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-blue-400">
                {spread.probability_otm ? `${spread.probability_otm.toFixed(1)}%` : '-'}
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    spread,
                    type === 'puts' ? 'bull_put' : 'bear_call',
                    `${spread.type} ${spread.sell_strike}/${spread.buy_strike}`,
                    [
                      { option_type: type === 'puts' ? 'put' : 'call', action: 'sell', strike: spread.sell_strike, price: spread.sell_premium, quantity: 1 },
                      { option_type: type === 'puts' ? 'put' : 'call', action: 'buy', strike: spread.buy_strike, price: spread.buy_premium, quantity: 1 }
                    ],
                    spread.net_credit
                  )}
                  className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 px-2 py-1 rounded transition-colors"
                >
                  <Plus className="w-3 h-3 inline mr-1" />
                  Trade
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Options Table Component
const OptionsTable = ({ options, type, currentPrice, strikeRange, onTrade }) => {
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
  const optionType = type === 'calls' ? 'call' : 'put';

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
            <th className="text-center py-3 px-2 font-medium">Trade</th>
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
              <td className="text-center py-2.5 px-2">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => onTrade && onTrade(
                      opt,
                      `long_${optionType}`,
                      `Buy ${optionType.toUpperCase()} ${opt.strike}`,
                      [{ option_type: optionType, action: 'buy', strike: opt.strike, price: opt.ask, quantity: 1 }],
                      -opt.ask  // Negative because buying is a debit
                    )}
                    className="text-green-400 hover:text-green-300 transition-colors text-xs px-1"
                    title={`Buy ${optionType.toUpperCase()}`}
                  >
                    BUY
                  </button>
                  <span className="text-zinc-600">|</span>
                  <button
                    onClick={() => onTrade && onTrade(
                      opt,
                      `short_${optionType}`,
                      `Sell ${optionType.toUpperCase()} ${opt.strike}`,
                      [{ option_type: optionType, action: 'sell', strike: opt.strike, price: opt.bid, quantity: 1 }],
                      opt.bid  // Positive because selling is a credit
                    )}
                    className="text-red-400 hover:text-red-300 transition-colors text-xs px-1"
                    title={`Sell ${optionType.toUpperCase()}`}
                  >
                    SELL
                  </button>
                </div>
              </td>
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
const CreditSpreadTable = ({ spreads, type, currentPrice, minCredit, maxRiskReward, onSelectStrategy, onTrade, maxRiskAmount, minRewardAmount }) => {
  if (!spreads || spreads.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No {type} spreads available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Calculate contracts and check reward threshold
  const calculatePositionSize = (maxLoss, maxProfit) => {
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    const totalReward = maxProfit * contracts;
    const meetsReward = totalReward >= minRewardAmount;
    return { contracts: Math.max(1, contracts), totalReward, meetsReward };
  };

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
            <th className="text-right py-3 px-2 font-medium text-cyan-400">P(OTM)</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredSpreads.map((spread, idx) => {
            const distanceFromPrice = isBullPut 
              ? ((currentPrice - spread.sell_strike) / currentPrice * 100).toFixed(1)
              : ((spread.sell_strike - currentPrice) / currentPrice * 100).toFixed(1);
            const posSize = calculatePositionSize(spread.max_loss, spread.max_profit);
            
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
                <td className="text-right py-2.5 px-2 font-mono text-cyan-400 font-medium">
                  {spread.probability_otm ? `${spread.probability_otm.toFixed(0)}%` : '-'}
                </td>
                <td className="text-center py-2.5 px-2">
                  <div className={`font-mono font-medium ${posSize.meetsReward ? 'text-green-400' : 'text-zinc-500'}`}>
                    {posSize.contracts}
                  </div>
                  <div className={`text-xs ${posSize.meetsReward ? 'text-green-500' : 'text-zinc-600'}`}>
                    ${posSize.totalReward.toFixed(0)}
                  </div>
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
                <td className="text-center py-2.5 px-2">
                  <button
                    onClick={() => onTrade && onTrade(
                      spread,
                      isBullPut ? 'bull_put' : 'bear_call',
                      `${type} ${spread.sell_strike}/${spread.buy_strike}`,
                      [
                        { option_type: 'put', action: 'sell', strike: spread.sell_strike, price: spread.sell_premium, quantity: 1 },
                        { option_type: 'put', action: 'buy', strike: spread.buy_strike, price: spread.buy_premium, quantity: 1 }
                      ],
                      spread.net_credit
                    )}
                    className="text-green-400 hover:text-green-300 transition-colors"
                    title="Paper Trade"
                  >
                    <Plus className="w-4 h-4" />
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
const IronCondorTable = ({ condors, currentPrice, minCredit, maxRiskReward, minProfitProb, onSelectStrategy, onTrade, maxRiskAmount, minRewardAmount }) => {
  if (!condors || condors.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Iron Condors available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Calculate contracts and check reward threshold
  const calculatePositionSize = (maxLoss, maxProfit) => {
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    const totalReward = maxProfit * contracts;
    const meetsReward = totalReward >= minRewardAmount;
    return { contracts: Math.max(1, contracts), totalReward, meetsReward };
  };

  // Apply filters including P(Profit)
  const filteredCondors = condors.filter(ic => 
    ic.net_credit >= minCredit && 
    ic.risk_reward_ratio <= maxRiskReward &&
    (ic.probability_profit || 0) >= minProfitProb
  );

  if (filteredCondors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Iron Condors match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try lowering min credit, P(Profit), or increasing max risk/reward</p>
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
            <th className="text-right py-3 px-2 font-medium text-cyan-400">P(Profit)</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredCondors.map((ic, idx) => {
            const posSize = calculatePositionSize(ic.max_loss, ic.max_profit);
            return (
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
              <td className="text-right py-2.5 px-2 font-mono text-cyan-400 font-medium">
                {ic.probability_profit ? `${ic.probability_profit.toFixed(0)}%` : '-'}
              </td>
              <td className="text-center py-2.5 px-2">
                <div className={`font-mono font-medium ${posSize.meetsReward ? 'text-green-400' : 'text-zinc-500'}`}>
                  {posSize.contracts}
                </div>
                <div className={`text-xs ${posSize.meetsReward ? 'text-green-500' : 'text-zinc-600'}`}>
                  ${posSize.totalReward.toFixed(0)}
                </div>
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
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    ic,
                    'iron_condor',
                    `IC ${ic.put_sell_strike}/${ic.put_buy_strike} - ${ic.call_sell_strike}/${ic.call_buy_strike}`,
                    [
                      { option_type: 'put', action: 'sell', strike: ic.put_sell_strike, price: ic.put_credit, quantity: 1 },
                      { option_type: 'put', action: 'buy', strike: ic.put_buy_strike, price: 0, quantity: 1 },
                      { option_type: 'call', action: 'sell', strike: ic.call_sell_strike, price: ic.call_credit, quantity: 1 },
                      { option_type: 'call', action: 'buy', strike: ic.call_buy_strike, price: 0, quantity: 1 }
                    ],
                    ic.net_credit
                  )}
                  className="text-green-400 hover:text-green-300 transition-colors"
                  title="Paper Trade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

// Iron Butterfly Table Component
const IronButterflyTable = ({ butterflies, currentPrice, minCredit, maxRiskReward, centerRange, onSelectStrategy, onTrade, maxRiskAmount, minRewardAmount }) => {
  if (!butterflies || butterflies.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Iron Butterflies available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Calculate contracts and check reward threshold
  const calculatePositionSize = (maxLoss, maxProfit) => {
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    const totalReward = maxProfit * contracts;
    const meetsReward = totalReward >= minRewardAmount;
    return { contracts: Math.max(1, contracts), totalReward, meetsReward };
  };

  // Apply filters including center range
  const rangePct = centerRange / 100;
  const minCenter = currentPrice * (1 - rangePct);
  const maxCenter = currentPrice * (1 + rangePct);
  
  const filteredButterflies = butterflies.filter(ib => 
    ib.net_credit >= minCredit && 
    ib.risk_reward_ratio <= maxRiskReward &&
    ib.center_strike >= minCenter &&
    ib.center_strike <= maxCenter
  );

  if (filteredButterflies.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Iron Butterflies match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing center range or adjusting other filters</p>
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
            <th className="text-right py-3 px-2 font-medium">From Spot</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredButterflies.map((ib, idx) => {
            const posSize = calculatePositionSize(ib.max_loss, ib.max_profit);
            return (
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
              <td className={`text-right py-2.5 px-2 font-mono ${Math.abs(ib.distance_from_spot) < 1 ? 'text-green-400' : 'text-zinc-400'}`}>
                {ib.distance_from_spot >= 0 ? '+' : ''}{ib.distance_from_spot.toFixed(1)}%
              </td>
              <td className="text-center py-2.5 px-2">
                <div className={`font-mono font-medium ${posSize.meetsReward ? 'text-green-400' : 'text-zinc-500'}`}>
                  {posSize.contracts}
                </div>
                <div className={`text-xs ${posSize.meetsReward ? 'text-green-500' : 'text-zinc-600'}`}>
                  ${posSize.totalReward.toFixed(0)}
                </div>
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
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    ib,
                    'iron_butterfly',
                    `IB ${ib.lower_strike}/${ib.center_strike}/${ib.upper_strike}`,
                    [
                      { option_type: 'call', action: 'sell', strike: ib.center_strike, price: ib.call_premium, quantity: 1 },
                      { option_type: 'put', action: 'sell', strike: ib.center_strike, price: ib.put_premium, quantity: 1 },
                      { option_type: 'call', action: 'buy', strike: ib.upper_strike, price: ib.upper_cost, quantity: 1 },
                      { option_type: 'put', action: 'buy', strike: ib.lower_strike, price: ib.lower_cost, quantity: 1 }
                    ],
                    ib.net_credit
                  )}
                  className="text-green-400 hover:text-green-300 transition-colors"
                  title="Paper Trade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

// Straddle Table Component
const StraddleTable = ({ straddles, currentPrice, strikeRange, onSelectStrategy, onTrade, maxRiskAmount, minRewardPercent }) => {
  if (!straddles || straddles.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Straddles available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Calculate contracts for debit strategies (unlimited profit potential)
  const calculatePositionSize = (totalCost) => {
    const maxLoss = totalCost * 100; // Cost per contract
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    return { contracts: Math.max(1, contracts), maxLoss };
  };

  // Apply strike range filter
  const rangePct = strikeRange / 100;
  const minStrike = currentPrice * (1 - rangePct);
  const maxStrike = currentPrice * (1 + rangePct);
  
  const filteredStraddles = straddles.filter(s => 
    s.strike >= minStrike && s.strike <= maxStrike
  );

  if (filteredStraddles.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Straddles match your filter</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the strike range %</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredStraddles.length} of {straddles.length} straddles
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
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredStraddles.map((s, idx) => {
            const posSize = calculatePositionSize(s.total_cost);
            return (
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
                <div className="font-mono font-medium text-green-400">
                  {posSize.contracts}
                </div>
                <div className="text-xs text-zinc-500">
                  ${posSize.maxLoss.toFixed(0)}
                </div>
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
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    s,
                    'straddle',
                    `Straddle ${s.strike}`,
                    [
                      { option_type: 'call', action: 'buy', strike: s.strike, price: s.call_price, quantity: 1 },
                      { option_type: 'put', action: 'buy', strike: s.strike, price: s.put_price, quantity: 1 }
                    ],
                    -s.total_cost  // Negative because it's a debit
                  )}
                  className="text-green-400 hover:text-green-300 transition-colors"
                  title="Paper Trade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

// Strangle Table Component
const StrangleTable = ({ strangles, currentPrice, strikeRange, onSelectStrategy, onTrade, maxRiskAmount, minRewardPercent }) => {
  if (!strangles || strangles.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Strangles available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Calculate contracts for debit strategies (unlimited profit potential)
  const calculatePositionSize = (totalCost) => {
    const maxLoss = totalCost * 100; // Cost per contract
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    return { contracts: Math.max(1, contracts), maxLoss };
  };

  // Apply strike range filter - both put and call strikes should be within range
  const rangePct = strikeRange / 100;
  const minStrike = currentPrice * (1 - rangePct);
  const maxStrike = currentPrice * (1 + rangePct);
  
  const filteredStrangles = strangles.filter(s => 
    s.put_strike >= minStrike && s.call_strike <= maxStrike
  );

  if (filteredStrangles.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Strangles match your filter</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the strike range %</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredStrangles.length} of {strangles.length} strangles
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
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredStrangles.map((s, idx) => {
            const posSize = calculatePositionSize(s.total_cost);
            return (
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
                <div className="font-mono font-medium text-green-400">
                  {posSize.contracts}
                </div>
                <div className="text-xs text-zinc-500">
                  ${posSize.maxLoss.toFixed(0)}
                </div>
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
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    s,
                    'strangle',
                    `Strangle ${s.put_strike}/${s.call_strike}`,
                    [
                      { option_type: 'call', action: 'buy', strike: s.call_strike, price: s.call_price, quantity: 1 },
                      { option_type: 'put', action: 'buy', strike: s.put_strike, price: s.put_price, quantity: 1 }
                    ],
                    -s.total_cost  // Negative because it's a debit
                  )}
                  className="text-green-400 hover:text-green-300 transition-colors"
                  title="Paper Trade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

// Calendar Spread Table Component
const CalendarSpreadTable = ({ spreads, currentPrice, strikeRange, onSelectStrategy, onTrade, nearExpiration, farExpiration, maxRiskAmount, minRewardPercent }) => {
  if (!spreads || spreads.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Calendar Spreads available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Calculate contracts for debit strategies
  const calculatePositionSize = (netDebit) => {
    const maxLoss = netDebit * 100; // Cost per contract
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    return { contracts: Math.max(1, contracts), maxLoss };
  };

  // Apply strike range filter
  const rangePct = strikeRange / 100;
  const minStrike = currentPrice * (1 - rangePct);
  const maxStrike = currentPrice * (1 + rangePct);
  
  const filteredSpreads = spreads.filter(cs => 
    cs.strike >= minStrike && cs.strike <= maxStrike
  );

  if (filteredSpreads.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Calendar Spreads match your filter</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the strike range %</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredSpreads.length} of {spreads.length} calendar spreads
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
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredSpreads.map((cs, idx) => {
            const posSize = calculatePositionSize(cs.net_debit);
            return (
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
              <td className="text-center py-2.5 px-2">
                <div className="font-mono font-medium text-green-400">
                  {posSize.contracts}
                </div>
                <div className="text-xs text-zinc-500">
                  ${posSize.maxLoss.toFixed(0)}
                </div>
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'calendar_spread',
                    name: `Calendar ${cs.option_type.toUpperCase()} ${cs.strike}`,
                    strike: cs.strike,
                    net_debit: cs.net_debit,
                    option_type: cs.option_type,
                    near_price: cs.near_price,
                    far_price: cs.far_price
                  })}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  title="View P/L Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    cs,
                    'calendar_spread',
                    `Calendar ${cs.option_type.toUpperCase()} ${cs.strike}`,
                    [
                      { option_type: cs.option_type, action: 'sell', strike: cs.strike, price: cs.near_price, quantity: 1, expiration: nearExpiration },
                      { option_type: cs.option_type, action: 'buy', strike: cs.strike, price: cs.far_price, quantity: 1, expiration: farExpiration }
                    ],
                    -cs.net_debit  // Negative because it's a debit
                  )}
                  className="text-green-400 hover:text-green-300 transition-colors"
                  title="Paper Trade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

 

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
  const [minProfitProb, setMinProfitProb] = useState(60);  // P(Profit) filter for Iron Condors, default 60%
  
  // Iron Butterflies state
  const [ironButterflies, setIronButterflies] = useState(null);
  const [isLoadingButterflies, setIsLoadingButterflies] = useState(false);
  const [wingWidth, setWingWidth] = useState(25);
  const [centerRange, setCenterRange] = useState(0.5);  // Center strike within ±x% of current price
  
  // Straddle/Strangle state
  const [straddles, setStraddles] = useState(null);
  const [strangles, setStrangles] = useState(null);
  const [isLoadingStraddles, setIsLoadingStraddles] = useState(false);
  const [isLoadingStrangles, setIsLoadingStrangles] = useState(false);
  const [straddleStrangleRange, setStraddleStrangleRange] = useState(0.5);  // Strike within ±x% of current price (shared for both)
  
  // Calendar spreads state
  const [calendarSpreads, setCalendarSpreads] = useState(null);
  const [calendarRange, setCalendarRange] = useState(0.5);  // Strike within ±x% of current price
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [farExpiration, setFarExpiration] = useState("");
  
  // P/L Chart state
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [showPLChart, setShowPLChart] = useState(false);

  // Portfolio state
  const [positions, setPositions] = useState([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [tradeDialog, setTradeDialog] = useState({ open: false, strategy: null });
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [closeDialog, setCloseDialog] = useState({ open: false, position: null });
  const [closePrice, setClosePrice] = useState("");

  // Position sizing state
  const [maxRiskAmount, setMaxRiskAmount] = useState(1000);  // Default $1,000 risk per trade
  const [minRewardAmount, setMinRewardAmount] = useState(1000);  // Default $1,000 min reward
  const [showPositionSizing, setShowPositionSizing] = useState(true);  // Show by default

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState({
    optionsChain: false,
    creditSpreads: false,
    ironCondors: true,  // Start collapsed
    ironButterflies: true,  // Start collapsed
    straddlesStrangles: true,  // Start collapsed
    calendarSpreads: true,  // Start collapsed
  });

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    setIsLoadingPositions(true);
    try {
      const response = await axios.get(`${API}/positions`);
      setPositions(response.data);
    } catch (e) {
      console.error("Error fetching positions:", e);
    } finally {
      setIsLoadingPositions(false);
    }
  }, []);

  // Create a new position (paper trade)
  const createPosition = async (strategy, strategyType, strategyName, legs, entryPrice) => {
    try {
      const position = {
        symbol: symbol,
        strategy_type: strategyType,
        strategy_name: strategyName,
        expiration: selectedExpiration,
        legs: legs,
        entry_price: entryPrice,
        quantity: tradeQuantity,
        notes: ""
      };
      
      await axios.post(`${API}/positions`, position);
      await fetchPositions();
      setTradeDialog({ open: false, strategy: null });
      setTradeQuantity(1);
    } catch (e) {
      console.error("Error creating position:", e);
      alert("Failed to create position. Make sure the database is available.");
    }
  };

  // Close a position
  const closePosition = async (positionId, exitPrice) => {
    try {
      await axios.put(`${API}/positions/${positionId}/close?exit_price=${exitPrice}`);
      await fetchPositions();
      setCloseDialog({ open: false, position: null });
      setClosePrice("");
    } catch (e) {
      console.error("Error closing position:", e);
      alert("Failed to close position.");
    }
  };

  // Delete a position
  const deletePosition = async (positionId) => {
    if (!window.confirm("Are you sure you want to delete this position?")) return;
    try {
      await axios.delete(`${API}/positions/${positionId}`);
      await fetchPositions();
    } catch (e) {
      console.error("Error deleting position:", e);
      alert("Failed to delete position.");
    }
  };

  // Handler to open trade dialog
  const handleTrade = (strategy, strategyType, strategyName, legs, entryPrice) => {
    setTradeDialog({
      open: true,
      strategy: { strategy, strategyType, strategyName, legs, entryPrice }
    });
  };

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
  }, [symbol]);

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
    fetchPositions();  // Fetch portfolio positions
  }, [fetchQuote, fetchHistory, period, fetchExpirations, fetchPositions]);

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
            
            {/* Portfolio Button */}
            <button
              onClick={() => setShowPortfolio(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-emerald-500 transition-all duration-200 active:scale-95 relative"
              data-testid="portfolio-button"
            >
              <Briefcase className="w-4 h-4" />
              Portfolio
              {positions.filter(p => p.status === 'open').length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {positions.filter(p => p.status === 'open').length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Position Sizing Settings Bar */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-400" />
            <span className="text-zinc-300 font-medium">Position Sizing</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Max Risk $</label>
            <Input
              type="number"
              min="100"
              max="100000"
              step="100"
              value={maxRiskAmount}
              onChange={(e) => setMaxRiskAmount(Math.max(100, parseInt(e.target.value) || 1000))}
              className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8 text-center font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Min Reward $</label>
            <Input
              type="number"
              min="0"
              max="100000"
              step="100"
              value={minRewardAmount}
              onChange={(e) => setMinRewardAmount(Math.max(0, parseInt(e.target.value) || 1000))}
              className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8 text-center font-mono"
            />
          </div>
          <div className="text-zinc-500 text-xs">
            <span className="text-zinc-400">Contracts</span> = Max Risk ÷ Max Loss | 
            <span className="text-green-400 ml-2">✓ Reward ≥ ${minRewardAmount.toLocaleString()}</span>
          </div>
        </div>

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
              <span className="text-zinc-400 text-lg font-mono">{symbol}</span>
              <span className="text-zinc-600 text-sm">{quote?.symbol || symbol}</span>
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
                  Last updated: {quote?.timestamp ? new Date(quote.timestamp).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    timeZoneName: 'short'
                  }) : 'N/A'}
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
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => toggleSection('optionsChain')}
            >
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.optionsChain ? (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                )}
                <Table2 className="w-5 h-5 text-zinc-400" />
                Options Chain ({symbol})
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  {optionsChain ? `${optionsChain.calls?.length || 0} calls, ${optionsChain.puts?.length || 0} puts` : ''}
                </span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
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

            {!collapsedSections.optionsChain && (
              <>
                <p className="text-zinc-500 text-xs mb-3">
                  {symbol} Options Chain. Includes Greeks calculation.
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
                        onTrade={handleTrade}
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
                        onTrade={handleTrade}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          {/* Credit Spreads Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="credit-spreads">
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => toggleSection('creditSpreads')}
            >
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.creditSpreads ? (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                )}
                <Calculator className="w-5 h-5 text-zinc-400" />
                Credit Spreads (${spreadWidth} wide)
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  {creditSpreads ? `${creditSpreads.bull_put_spreads?.length || 0} bull put, ${creditSpreads.bear_call_spreads?.length || 0} bear call` : ''}
                </span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
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

            {!collapsedSections.creditSpreads && (
              <>
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
                    <span className="text-zinc-400">{symbol}: <span className="text-white font-mono">${creditSpreads.current_price.toLocaleString()}</span></span>
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
                          onTrade={handleTrade}
                          maxRiskAmount={maxRiskAmount}
                          minRewardAmount={minRewardAmount}
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
                          onTrade={handleTrade}
                          maxRiskAmount={maxRiskAmount}
                          minRewardAmount={minRewardAmount}
                        />
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          {/* Iron Condor Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="iron-condors">
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => toggleSection('ironCondors')}
            >
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.ironCondors ? (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                )}
                <Layers className="w-5 h-5 text-zinc-400" />
                Iron Condors (${spreadWidth} wide legs)
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  {ironCondors?.iron_condors?.length || 0} found
                </span>
              </h2>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

            {!collapsedSections.ironCondors && (
              <>
                <p className="text-zinc-500 text-xs mb-4">
                  Neutral strategy: Combines Bull Put Spread (below price) + Bear Call Spread (above price). 
                  Profit if {symbol} stays within the profit zone at expiration.
                </p>

                {/* P(Profit) Filter */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Min P(Profit) ≥</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={minProfitProb}
                        onChange={(e) => setMinProfitProb(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                  {ironCondors && (
                    <span className="text-zinc-500 text-xs">
                      {symbol}: <span className="text-white font-mono">${ironCondors.current_price?.toLocaleString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Exp: <span className="text-white">{new Date(ironCondors.expiration).toLocaleDateString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Found: <span className="text-white">{ironCondors.iron_condors?.length || 0}</span>
                    </span>
                  )}
                </div>

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
                      minProfitProb={minProfitProb}
                      onSelectStrategy={handleSelectStrategy}
                      onTrade={handleTrade}
                      maxRiskAmount={maxRiskAmount}
                      minRewardPercent={minRewardPercent}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Iron Butterfly Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="iron-butterflies">
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => toggleSection('ironButterflies')}
            >
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.ironButterflies ? (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                )}
                <Triangle className="w-5 h-5 text-zinc-400" />
                Iron Butterflies
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  {ironButterflies?.iron_butterflies?.length || 0} found
                </span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
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

            {!collapsedSections.ironButterflies && (
              <>
                <p className="text-zinc-500 text-xs mb-4">
                  Neutral strategy: Sell ATM call + put at same strike, buy OTM wings. 
                  Max profit if {symbol} expires exactly at center strike.
                </p>

                {/* Center Range Filter */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Center Strike ±</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={centerRange}
                        onChange={(e) => setCenterRange(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.5)))}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                    <span className="text-zinc-500 text-xs">
                      (${ironButterflies?.current_price ? (ironButterflies.current_price * (1 - centerRange/100)).toFixed(0) : '...'} - ${ironButterflies?.current_price ? (ironButterflies.current_price * (1 + centerRange/100)).toFixed(0) : '...'})
                    </span>
                  </div>
                  {ironButterflies && (
                    <span className="text-zinc-500 text-xs">
                      {symbol}: <span className="text-white font-mono">${ironButterflies.current_price?.toLocaleString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Exp: <span className="text-white">{new Date(ironButterflies.expiration).toLocaleDateString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Found: <span className="text-white">{ironButterflies.iron_butterflies?.length || 0}</span>
                    </span>
                  )}
                </div>

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
                      centerRange={centerRange}
                      onSelectStrategy={handleSelectStrategy}
                      onTrade={handleTrade}
                      maxRiskAmount={maxRiskAmount}
                      minRewardPercent={minRewardPercent}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Straddle/Strangle Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="straddle-strangle">
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => toggleSection('straddlesStrangles')}
            >
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.straddlesStrangles ? (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                )}
                <ArrowLeftRight className="w-5 h-5 text-zinc-400" />
                Straddles & Strangles
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  {(straddles?.straddles?.length || 0) + (strangles?.strangles?.length || 0)} found
                </span>
              </h2>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

            {!collapsedSections.straddlesStrangles && (
              <>
                <p className="text-zinc-500 text-xs mb-4">
                  Volatility plays: Profit from large moves in either direction. Max loss = premium paid. Unlimited profit potential.
                </p>

                {/* Strike Range Filter */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Strike ±</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={straddleStrangleRange}
                        onChange={(e) => setStraddleStrangleRange(Math.round(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.5)) * 10) / 10)}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                  {straddles && (
                    <span className="text-zinc-500 text-xs">
                      {symbol}: <span className="text-white font-mono">${straddles.current_price?.toLocaleString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Exp: <span className="text-white">{new Date(straddles.expiration).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>

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
                          Buy call + put at same strike. Profit if {symbol} moves more than the total premium paid.
                        </p>
                        <StraddleTable straddles={straddles?.straddles} currentPrice={straddles?.current_price} strikeRange={straddleStrangleRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardPercent={minRewardPercent} />
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
                        <StrangleTable strangles={strangles?.strangles} currentPrice={strangles?.current_price} strikeRange={straddleStrangleRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardPercent={minRewardPercent} />
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          {/* Calendar Spreads Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="calendar-spreads">
            <div 
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => toggleSection('calendarSpreads')}
            >
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.calendarSpreads ? (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                )}
                <Calendar className="w-5 h-5 text-zinc-400" />
                Calendar Spreads
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  {calendarSpreads?.calendar_spreads?.length || 0} found
                </span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
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

            {!collapsedSections.calendarSpreads && (
              <>
                <p className="text-zinc-500 text-xs mb-4">
                  Time decay strategy: Sell near-term option, buy far-term option at same strike. 
                  Profits from faster theta decay of near-term option and/or IV increase.
                </p>

                {/* Strike Range Filter */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Strike ±</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={calendarRange}
                        onChange={(e) => setCalendarRange(Math.round(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.5)) * 10) / 10)}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                    <span className="text-zinc-500 text-xs">
                      (${calendarSpreads?.current_price ? (calendarSpreads.current_price * (1 - calendarRange/100)).toFixed(0) : '...'} - ${calendarSpreads?.current_price ? (calendarSpreads.current_price * (1 + calendarRange/100)).toFixed(0) : '...'})
                    </span>
                  </div>
                  {calendarSpreads && (
                    <span className="text-zinc-500 text-xs">
                      {symbol}: <span className="text-white font-mono">${calendarSpreads.current_price?.toLocaleString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Near: <span className="text-white">{new Date(calendarSpreads.near_expiration).toLocaleDateString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Far: <span className="text-white">{new Date(calendarSpreads.far_expiration).toLocaleDateString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Found: <span className="text-white">{calendarSpreads.calendar_spreads?.length || 0}</span>
                    </span>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {isLoadingCalendars ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                    </div>
                  ) : (
                    <CalendarSpreadTable 
                      spreads={calendarSpreads?.calendar_spreads} 
                      currentPrice={calendarSpreads?.current_price}
                      strikeRange={calendarRange}
                      onSelectStrategy={handleSelectStrategy}
                      onTrade={handleTrade}
                      nearExpiration={selectedExpiration}
                      farExpiration={farExpiration}
                      maxRiskAmount={maxRiskAmount}
                      minRewardPercent={minRewardPercent}
                    />
                  )}
                </div>
              </>
            )}
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

        {/* Portfolio Modal */}
        {showPortfolio && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowPortfolio(false)}>
            <div className="glass-card p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-medium text-white flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-emerald-400" />
                  Paper Trading Portfolio
                </h3>
                <button 
                  onClick={() => setShowPortfolio(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Portfolio Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Open Positions</div>
                  <div className="text-2xl font-bold text-white">{positions.filter(p => p.status === 'open').length}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Closed Positions</div>
                  <div className="text-2xl font-bold text-white">{positions.filter(p => p.status === 'closed').length}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Unrealized P/L</div>
                  <div className={`text-2xl font-bold ${positions.filter(p => p.status === 'open').reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${positions.filter(p => p.status === 'open').reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Realized P/L</div>
                  <div className={`text-2xl font-bold ${positions.filter(p => p.status === 'closed').reduce((sum, p) => sum + (p.realized_pnl || 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${positions.filter(p => p.status === 'closed').reduce((sum, p) => sum + (p.realized_pnl || 0), 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Positions Table */}
              {isLoadingPositions ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No positions yet</p>
                  <p className="text-sm mt-1">Click the <Plus className="w-4 h-4 inline" /> button on any strategy to add a paper trade</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="text-left py-3 px-2">Symbol</th>
                        <th className="text-left py-3 px-2">Strategy</th>
                        <th className="text-left py-3 px-2">Expiration</th>
                        <th className="text-right py-3 px-2">Entry</th>
                        <th className="text-right py-3 px-2">Qty</th>
                        <th className="text-right py-3 px-2">P/L</th>
                        <th className="text-center py-3 px-2">Status</th>
                        <th className="text-center py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => (
                        <tr key={pos.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="py-3 px-2 font-mono text-white">{pos.symbol}</td>
                          <td className="py-3 px-2">
                            <div className="font-medium text-white">{pos.strategy_name}</div>
                            <div className="text-xs text-zinc-500">{pos.strategy_type}</div>
                          </td>
                          <td className="py-3 px-2 text-zinc-400">{new Date(pos.expiration).toLocaleDateString()}</td>
                          <td className="py-3 px-2 text-right font-mono text-green-400">${pos.entry_price.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right text-white">{pos.quantity}</td>
                          <td className={`py-3 px-2 text-right font-mono ${pos.status === 'closed' ? (pos.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400') : 'text-zinc-400'}`}>
                            {pos.status === 'closed' 
                              ? `$${pos.realized_pnl?.toFixed(2) || '0.00'}`
                              : '-'
                            }
                          </td>
                          <td className="py-3 px-2 text-center">
                            {pos.status === 'open' ? (
                              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Open</span>
                            ) : (
                              <span className="px-2 py-1 bg-zinc-500/20 text-zinc-400 rounded text-xs">Closed</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {pos.status === 'open' && (
                                <button
                                  onClick={() => {
                                    setCloseDialog({ open: true, position: pos });
                                    setClosePrice(pos.entry_price.toString());
                                  }}
                                  className="text-amber-400 hover:text-amber-300"
                                  title="Close Position"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => deletePosition(pos.id)}
                                className="text-red-400 hover:text-red-300"
                                title="Delete Position"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trade Dialog */}
        {tradeDialog.open && tradeDialog.strategy && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setTradeDialog({ open: false, strategy: null })}>
            <div className="glass-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Paper Trade
                </h3>
                <button onClick={() => setTradeDialog({ open: false, strategy: null })} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-zinc-400 text-sm mb-1">Strategy</div>
                  <div className="text-white font-medium">{tradeDialog.strategy.strategyName}</div>
                </div>
                
                <div>
                  <div className="text-zinc-400 text-sm mb-1">Symbol</div>
                  <div className="text-white font-mono">{symbol}</div>
                </div>
                
                <div>
                  <div className="text-zinc-400 text-sm mb-1">Expiration</div>
                  <div className="text-white">{selectedExpiration}</div>
                </div>
                
                <div>
                  <div className="text-zinc-400 text-sm mb-1">Entry Credit/Debit</div>
                  <div className="text-green-400 font-mono">${tradeDialog.strategy.entryPrice.toFixed(2)}</div>
                </div>
                
                <div>
                  <label className="text-zinc-400 text-sm mb-1 block">Number of Contracts</label>
                  <input
                    type="number"
                    min="1"
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded-lg"
                  />
                </div>
                
                <div className="pt-2">
                  <div className="text-zinc-400 text-sm">Total Premium</div>
                  <div className="text-xl font-bold text-white">
                    ${(tradeDialog.strategy.entryPrice * tradeQuantity * 100).toFixed(2)}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setTradeDialog({ open: false, strategy: null })}
                    className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createPosition(
                      tradeDialog.strategy.strategy,
                      tradeDialog.strategy.strategyType,
                      tradeDialog.strategy.strategyName,
                      tradeDialog.strategy.legs,
                      tradeDialog.strategy.entryPrice
                    )}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
                  >
                    Execute Trade
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Close Position Dialog */}
        {closeDialog.open && closeDialog.position && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCloseDialog({ open: false, position: null })}>
            <div className="glass-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Close Position</h3>
                <button onClick={() => setCloseDialog({ open: false, position: null })} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-zinc-400 text-sm mb-1">Position</div>
                  <div className="text-white font-medium">{closeDialog.position.strategy_name}</div>
                </div>
                
                <div>
                  <div className="text-zinc-400 text-sm mb-1">Entry Price</div>
                  <div className="text-green-400 font-mono">${closeDialog.position.entry_price.toFixed(2)}</div>
                </div>
                
                <div>
                  <label className="text-zinc-400 text-sm mb-1 block">Exit Price (per contract)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={closePrice}
                    onChange={(e) => setClosePrice(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setCloseDialog({ open: false, position: null })}
                    className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => closePosition(closeDialog.position.id, parseFloat(closePrice) || 0)}
                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                  >
                    Close Position
                  </button>
                </div>
              </div>
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

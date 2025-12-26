import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Clock, ChevronDown, Table2, Calculator, Plus, Trash2, X } from "lucide-react";
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
import { Input } from "./components/ui/input";
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
const OptionsTable = ({ options, type, currentPrice }) => {
  if (!options || options.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No {type} data available</p>;
  }

  // Filter to show strikes around current price (±20%)
  const minStrike = currentPrice * 0.85;
  const maxStrike = currentPrice * 1.15;
  const filteredOptions = options.filter(opt => opt.strike >= minStrike && opt.strike <= maxStrike);

  // Check if Greeks are available
  const hasGreeks = filteredOptions.some(opt => opt.delta !== null);

  return (
    <div className="overflow-x-auto">
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
const CreditSpreadTable = ({ spreads, type, currentPrice, minCredit, maxRiskReward }) => {
  if (!spreads || spreads.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No {type} spreads available</p>;
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function App() {
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
  const [spyPrice, setSpyPrice] = useState(null);
  
  // Credit spreads state
  const [creditSpreads, setCreditSpreads] = useState(null);
  const [isLoadingSpreads, setIsLoadingSpreads] = useState(false);
  const [spreadWidth, setSpreadWidth] = useState(5);
  const [minCredit, setMinCredit] = useState(0);
  const [maxRiskReward, setMaxRiskReward] = useState(100);

  const fetchQuote = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/spx/quote`);
      setQuote(response.data);
      setError(null);
    } catch (e) {
      console.error("Error fetching SPX quote:", e);
      setError("Failed to fetch SPX data");
    } finally {
      setIsLoadingQuote(false);
    }
  }, []);

  const fetchHistory = useCallback(async (selectedPeriod) => {
    setIsLoadingHistory(true);
    try {
      const response = await axios.get(`${API}/spx/history?period=${selectedPeriod}`);
      setHistory(response.data.data);
    } catch (e) {
      console.error("Error fetching SPX history:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const fetchExpirations = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/spx/options/expirations`);
      setExpirations(response.data.expirations);
      if (response.data.expirations.length > 0 && !selectedExpiration) {
        setSelectedExpiration(response.data.expirations[0]);
      }
    } catch (e) {
      console.error("Error fetching options expirations:", e);
    }
  }, [selectedExpiration]);

  const fetchOptionsChain = useCallback(async (expiration) => {
    if (!expiration) return;
    setIsLoadingOptions(true);
    try {
      const response = await axios.get(`${API}/spx/options/chain?expiration=${expiration}`);
      setOptionsChain(response.data);
      // Use SPX price directly (not divided by 10 like SPY)
      if (quote?.price) {
        setSpyPrice(quote.price);
      }
    } catch (e) {
      console.error("Error fetching options chain:", e);
    } finally {
      setIsLoadingOptions(false);
    }
  }, [quote?.price]);

  const fetchCreditSpreads = useCallback(async (expiration, width) => {
    if (!expiration) return;
    setIsLoadingSpreads(true);
    try {
      const response = await axios.get(`${API}/spx/credit-spreads?expiration=${expiration}&spread=${width}`);
      setCreditSpreads(response.data);
    } catch (e) {
      console.error("Error fetching credit spreads:", e);
    } finally {
      setIsLoadingSpreads(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchQuote(), fetchHistory(period)]);
    setIsRefreshing(false);
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    fetchHistory(newPeriod);
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
    }
  }, [selectedExpiration, fetchOptionsChain, fetchCreditSpreads, spreadWidth]);

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
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-zinc-400" />
              S&P 500 Tracker
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Real-time market data from Yahoo Finance</p>
          </div>
          <div className="flex items-center gap-3">
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
            <div className="flex items-center justify-between mb-6">
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
              </div>
            </div>

            <p className="text-zinc-500 text-xs mb-4">
              S&P 500 Index Options (^SPX). European-style, cash-settled. Showing strikes within ±15% of current price.
            </p>

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
                  <OptionsTable options={optionsChain?.calls} type="calls" currentPrice={spyPrice || (quote?.price / 10)} />
                )}
              </TabsContent>
              <TabsContent value="puts" className="max-h-96 overflow-y-auto">
                {isLoadingOptions ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <OptionsTable options={optionsChain?.puts} type="puts" currentPrice={spyPrice || (quote?.price / 10)} />
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
                <span className="text-zinc-400">SPY: <span className="text-white font-mono">${creditSpreads.current_price}</span></span>
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
                    />
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-zinc-600 text-sm">
          <p>Data provided by Yahoo Finance. Prices may be delayed.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;

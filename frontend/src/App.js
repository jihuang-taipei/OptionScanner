import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Clock, ChevronDown, Table2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strike</th>
            <th className="text-right py-3 px-2 font-medium">Last</th>
            <th className="text-right py-3 px-2 font-medium">Bid</th>
            <th className="text-right py-3 px-2 font-medium">Ask</th>
            <th className="text-right py-3 px-2 font-medium">Change</th>
            <th className="text-right py-3 px-2 font-medium">IV%</th>
            <th className="text-right py-3 px-2 font-medium">Volume</th>
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
              <td className={`text-right py-2.5 px-2 font-mono ${opt.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {opt.change >= 0 ? '+' : ''}{opt.change.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.impliedVolatility.toFixed(1)}%</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.volume?.toLocaleString() || '-'}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.openInterest?.toLocaleString() || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredOptions.length === 0 && (
        <p className="text-zinc-500 text-center py-4">No options near current price</p>
      )}
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
      // Estimate SPY price from ATM options (SPY ≈ SPX / 10)
      if (quote?.price) {
        setSpyPrice(quote.price / 10);
      }
    } catch (e) {
      console.error("Error fetching options chain:", e);
    } finally {
      setIsLoadingOptions(false);
    }
  }, [quote?.price]);

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
    }
  }, [selectedExpiration, fetchOptionsChain]);

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
                Options Chain (SPY)
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
              Using SPY as proxy for S&P 500 options. SPY ≈ SPX/10. Showing strikes within ±15% of current price.
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

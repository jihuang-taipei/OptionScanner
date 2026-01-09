import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import "@/App.css";
import axios from "axios";
import { RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Clock, ChevronDown, ChevronRight, Table2, Calculator, Plus, Trash2, X, Layers, Triangle, ArrowLeftRight, LineChart as LineChartIcon, Download, Calendar, Briefcase, DollarSign, CheckCircle, XCircle, CandlestickChart, TrendingUpDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Bar, ComposedChart, Cell, BarChart, Rectangle, ReferenceArea } from "recharts";
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

// Import refactored components
import { StatCard, PeriodButton, CustomTooltip } from "./components/common";
import { PLChart } from "./components/charts";
import {
  OptionsTable,
  CreditSpreadTable,
  IronCondorTable,
  IronButterflyTable,
  StraddleTable,
  StrangleTable,
  CalendarSpreadTable,
  GeneratedSpreadsTable,
} from "./components/tables";

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
  exportPortfolio,
} from "./utils/exportUtils";

// Format X-axis tick based on period
const formatChartTick = (value, period) => {
  if (!value) return '';
  
  // For 1D intraday, show only time
  if (period === '1d') {
    if (value.includes(' ')) {
      return value.split(' ')[1]; // "HH:MM"
    }
  }
  
  // Extract date part
  const datePart = value.includes(' ') ? value.split(' ')[0] : value;
  
  // Parse date parts manually to avoid timezone issues
  const [year, month, day] = datePart.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${months[month - 1]} ${day}`;
};

// Safe date formatting to avoid timezone issues
// Use this instead of new Date(dateString).toLocaleDateString()
const formatExpDate = (dateString, options = {}) => {
  if (!dateString) return '';
  
  // Parse YYYY-MM-DD format manually to avoid timezone shift
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (options.includeYear) {
    return `${months[month - 1]} ${day}, ${year}`;
  }
  return `${months[month - 1]} ${day}`;
};

// Custom debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// Calculate Bollinger Bands with adaptive period
const calculateBollingerBands = (data, period = 20, multiplier = 2) => {
  if (!data || data.length === 0) return data;
  
  // Adjust period based on data length (min 5, max 20)
  const effectivePeriod = Math.min(period, Math.max(5, Math.floor(data.length / 3)));
  
  return data.map((item, index) => {
    if (index < effectivePeriod - 1) {
      return { ...item, sma: null, upperBand: null, lowerBand: null };
    }
    
    // Get last 'effectivePeriod' closing prices
    const slice = data.slice(index - effectivePeriod + 1, index + 1);
    const closes = slice.map(d => d.close);
    
    // Calculate SMA
    const sma = closes.reduce((sum, val) => sum + val, 0) / effectivePeriod;
    
    // Calculate Standard Deviation
    const squaredDiffs = closes.map(val => Math.pow(val - sma, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / effectivePeriod;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    // Calculate bands
    const upperBand = sma + (multiplier * stdDev);
    const lowerBand = sma - (multiplier * stdDev);
    
    return {
      ...item,
      sma: Math.round(sma * 100) / 100,
      upperBand: Math.round(upperBand * 100) / 100,
      lowerBand: Math.round(lowerBand * 100) / 100
    };
  });
};

// Helper function to format date without timezone issues
const formatDateLabel = (label) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (label && label.includes(' ')) {
    const [datePart, timePart] = label.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    return `${months[month - 1]} ${day}, ${timePart}`;
  } else if (label) {
    const [year, month, day] = label.split('-').map(Number);
    return `${months[month - 1]} ${day}, ${year}`;
  }
  return label;
};

// Bollinger Bands Tooltip
const BollingerTooltip = memo(({ active, payload, label }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    const displayLabel = formatDateLabel(label);
    
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm">
        <p className="text-zinc-400 mb-2">{displayLabel}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
          <span className="text-zinc-500">Price:</span>
          <span className="text-white">${data.close?.toLocaleString()}</span>
          {data.upperBand && (
            <>
              <span className="text-zinc-500">Upper:</span>
              <span className="text-purple-400">${data.upperBand?.toLocaleString()}</span>
              <span className="text-zinc-500">SMA(20):</span>
              <span className="text-amber-400">${data.sma?.toLocaleString()}</span>
              <span className="text-zinc-500">Lower:</span>
              <span className="text-purple-400">${data.lowerBand?.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
});

// OHLC Tooltip for Candlestick Chart
const OHLCTooltip = memo(({ active, payload, label }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    const displayLabel = formatDateLabel(label);
    const isBullish = data.close >= data.open;
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm">
        <p className="text-zinc-400 mb-2">{displayLabel}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
          <span className="text-zinc-500">Open:</span>
          <span className="text-white">${data.open?.toLocaleString()}</span>
          <span className="text-zinc-500">High:</span>
          <span className="text-green-400">${data.high?.toLocaleString()}</span>
          <span className="text-zinc-500">Low:</span>
          <span className="text-red-400">${data.low?.toLocaleString()}</span>
          <span className="text-zinc-500">Close:</span>
          <span className={isBullish ? 'text-green-400' : 'text-red-400'}>${data.close?.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
});

// Candlestick shape component
const CandlestickBar = memo(({ x, y, width, height, payload, yAxisDomain }) => {
  if (!payload || !yAxisDomain) return null;
  
  const { open, high, low, close } = payload;
  const isBullish = close >= open;
  const color = isBullish ? '#22c55e' : '#ef4444';
  
  const [minVal, maxVal] = yAxisDomain;
  const range = maxVal - minVal;
  const chartHeight = 250;
  
  const scaleY = (val) => chartHeight - ((val - minVal) / range) * chartHeight + 10;
  
  const bodyTop = scaleY(Math.max(open, close));
  const bodyBottom = scaleY(Math.min(open, close));
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);
  const wickTop = scaleY(high);
  const wickBottom = scaleY(low);
  const candleWidth = Math.max(2, width * 0.7);
  const candleX = x + (width - candleWidth) / 2;
  const wickX = x + width / 2;
  
  return (
    <g>
      <line x1={wickX} y1={wickTop} x2={wickX} y2={bodyTop} stroke={color} strokeWidth={1} />
      <line x1={wickX} y1={bodyBottom} x2={wickX} y2={wickBottom} stroke={color} strokeWidth={1} />
      <rect x={candleX} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} stroke={color} strokeWidth={1} />
    </g>
  );
});

// Create a shape render function factory
const createCandlestickShape = (yAxisDomain) => (props) => <CandlestickBar {...props} yAxisDomain={yAxisDomain} />;

function App() {
  // Symbol state
  const [symbol, setSymbol] = useState("^SPX");
  const [symbolInput, setSymbolInput] = useState("^SPX");
  const debouncedSymbolInput = useDebounce(symbolInput, 500); // Debounce symbol input by 500ms
  
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [period, setPeriod] = useState("1mo");
  const [chartType, setChartType] = useState("bollinger"); // bollinger, line, candle
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60); // Default: 1 minute
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  
  // Memoized candlestick shape renderer
  const candlestickShape = useMemo(() => {
    if (history.length === 0) return null;
    const yAxisDomain = [Math.min(...history.map(d => d.low)), Math.max(...history.map(d => d.high))];
    return createCandlestickShape(yAxisDomain);
  }, [history]);
  
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
  const [minProbOTM, setMinProbOTM] = useState(50);  // P(OTM) filter for Credit Spreads, default 50%
  
  // Iron Condors state
  const [ironCondors, setIronCondors] = useState(null);
  const [isLoadingCondors, setIsLoadingCondors] = useState(false);
  const [minProfitProb, setMinProfitProb] = useState(50);  // P(Profit) filter for Iron Condors, default 50%
  
  // Iron Butterflies state
  const [ironButterflies, setIronButterflies] = useState(null);
  const [isLoadingButterflies, setIsLoadingButterflies] = useState(false);
  const [wingWidth, setWingWidth] = useState(30);
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
  
  // Cache for position-specific options chains (keyed by expiration date)
  const [positionOptionsCache, setPositionOptionsCache] = useState({});

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

  // Expire positions that have passed their expiration date
  const expirePositions = useCallback(async () => {
    try {
      const response = await axios.post(`${API}/positions/expire`);
      if (response.data.expired_positions?.length > 0) {
        console.log(`Expired ${response.data.expired_positions.length} positions`);
      }
    } catch (e) {
      console.error("Error expiring positions:", e);
    }
  }, []);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    setIsLoadingPositions(true);
    try {
      // First expire any positions that need to be expired
      await expirePositions();
      // Then fetch all positions
      const response = await axios.get(`${API}/positions`);
      setPositions(response.data);
    } catch (e) {
      console.error("Error fetching positions:", e);
    } finally {
      setIsLoadingPositions(false);
    }
  }, [expirePositions]);

  // Track which expirations we've already tried to fetch (to prevent infinite loops)
  const fetchedExpirationsRef = useRef(new Set());

  // Fetch options chains for open positions to enable current price calculation
  const fetchPositionOptionsChains = useCallback(async (openPositions) => {
    if (!openPositions || openPositions.length === 0) return;
    
    // Collect all unique expirations needed:
    // 1. Position expirations for non-calendar strategies
    // 2. Individual leg expirations for calendar spreads
    const expirationsNeeded = new Set();
    
    openPositions
      .filter(p => p.status === 'open')
      .forEach(p => {
        if (p.strategy_type === 'calendar_spread') {
          // For calendar spreads, collect each leg's expiration
          p.legs?.forEach(leg => {
            if (leg.expiration && !fetchedExpirationsRef.current.has(leg.expiration)) {
              expirationsNeeded.add(leg.expiration);
            }
          });
        } else {
          // For other strategies, use position expiration
          if (p.expiration && !fetchedExpirationsRef.current.has(p.expiration)) {
            expirationsNeeded.add(p.expiration);
          }
        }
      });
    
    const uniqueExpirations = [...expirationsNeeded];
    
    if (uniqueExpirations.length === 0) return;
    
    // Mark all as fetching to prevent duplicate fetches
    uniqueExpirations.forEach(exp => fetchedExpirationsRef.current.add(exp));
    
    // Fetch options chains for each unique expiration
    const newChains = {};
    
    for (const expiration of uniqueExpirations) {
      try {
        // Get the symbol from any open position
        const posSymbol = openPositions.find(p => p.status === 'open')?.symbol || symbol;
        
        const response = await axios.get(`${API}/options/chain?symbol=${posSymbol}&expiration=${expiration}`);
        newChains[expiration] = response.data;
      } catch (e) {
        console.error(`Error fetching options chain for expiration ${expiration}:`, e);
      }
    }
    
    // Only update state if we got some new data
    if (Object.keys(newChains).length > 0) {
      setPositionOptionsCache(prev => ({ ...prev, ...newChains }));
    }
  }, [symbol]);

  // Fetch options chains when positions change
  useEffect(() => {
    const openPositions = positions.filter(p => p.status === 'open');
    if (openPositions.length > 0) {
      fetchPositionOptionsChains(positions);
    }
  }, [positions, fetchPositionOptionsChains]);

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

  // Calculate current price to CLOSE a strategy from options chain
  // For credit strategies: returns what you'd PAY to close (debit)
  // For debit strategies: returns what you'd RECEIVE to close (credit)
  const calculateCurrentStrategyPrice = useCallback((position) => {
    if (!position?.legs) return null;
    
    // For calendar spreads, we need to look up each leg's expiration separately
    if (position.strategy_type === 'calendar_spread') {
      let closePrice = 0;
      
      for (const leg of position.legs) {
        // Each leg has its own expiration
        const legExpiration = leg.expiration;
        if (!legExpiration) return null;
        
        // Get the chain for this leg's expiration
        let chainToUse = positionOptionsCache[legExpiration];
        if (!chainToUse && optionsChain && legExpiration === selectedExpiration) {
          chainToUse = optionsChain;
        }
        
        if (!chainToUse) return null;
        
        const { calls, puts } = chainToUse;
        if (!calls || !puts) return null;
        
        const optionList = leg.option_type === 'call' ? calls : puts;
        const option = optionList.find(o => o.strike === leg.strike);
        
        if (!option) return null;
        
        const currentPrice = option.lastPrice || option.bid || 0;
        
        if (leg.action === 'sell') {
          closePrice += currentPrice; // Pay to buy back
        } else {
          closePrice -= currentPrice; // Receive from selling
        }
      }
      
      return closePrice;
    }
    
    // For non-calendar strategies, use position's expiration
    // Use cached options chain for the position's specific expiration
    // Fall back to current optionsChain if expiration matches
    let chainToUse = null;
    if (position.expiration && positionOptionsCache[position.expiration]) {
      chainToUse = positionOptionsCache[position.expiration];
    } else if (optionsChain && position.expiration === selectedExpiration) {
      chainToUse = optionsChain;
    }
    
    if (!chainToUse) return null;
    
    const { calls, puts } = chainToUse;
    if (!calls || !puts) return null;
    
    let closePrice = 0;
    
    for (const leg of position.legs) {
      const optionList = leg.option_type === 'call' ? calls : puts;
      const option = optionList.find(o => o.strike === leg.strike);
      
      if (!option) return null; // Option not found in current chain
      
      // Use mid price (average of bid and ask) or last price
      const currentPrice = option.lastPrice || option.bid || 0;
      
      // To CLOSE: reverse the original action
      // If originally SOLD, need to BUY back (pay)
      // If originally BOUGHT, need to SELL (receive)
      if (leg.action === 'sell') {
        closePrice += currentPrice; // Pay to buy back
      } else {
        closePrice -= currentPrice; // Receive from selling
      }
    }
    
    // closePrice > 0 means you PAY to close (credit strategy profitable scenario)
    // closePrice < 0 means you RECEIVE to close (debit strategy)
    return closePrice;
  }, [optionsChain, positionOptionsCache, selectedExpiration]);

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
      // Client-side filtering: remove any expired dates (dates before today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validExpirations = response.data.expirations.filter(exp => {
        const [year, month, day] = exp.split('-').map(Number);
        const expDate = new Date(year, month - 1, day);
        return expDate >= today;
      });
      setExpirations(validExpirations);
      // Set first valid expiration if none selected or current selection is invalid/expired
      if (validExpirations.length > 0) {
        if (!selectedExpiration || !validExpirations.includes(selectedExpiration)) {
          setSelectedExpiration(validExpirations[0]);
        }
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

  // Auto-submit when debounced symbol input changes
  useEffect(() => {
    const trimmed = debouncedSymbolInput.trim().toUpperCase();
    if (trimmed && trimmed !== symbol && trimmed.length >= 1) {
      handleSymbolChange(trimmed);
    }
  }, [debouncedSymbolInput]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Set far expiration to date after near expiration
  useEffect(() => {
    if (expirations.length > 1 && selectedExpiration) {
      const nearIndex = expirations.indexOf(selectedExpiration);
      if (nearIndex >= 0 && nearIndex < expirations.length - 1) {
        // Set far to the next available date after near
        const nextFarIndex = nearIndex + 1;
        // Only update if current far is not after near or not set
        const farIndex = expirations.indexOf(farExpiration);
        if (!farExpiration || farIndex <= nearIndex) {
          setFarExpiration(expirations[nextFarIndex]);
        }
      }
    }
  }, [expirations, selectedExpiration]); // eslint-disable-line react-hooks/exhaustive-deps

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
              <div className="flex items-center gap-3">
                {/* Chart Type Selector */}
                <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg">
                  <button
                    onClick={() => setChartType("bollinger")}
                    className={`p-1.5 rounded transition-colors ${chartType === "bollinger" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`}
                    title="Bollinger Bands"
                  >
                    <Activity className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType("line")}
                    className={`p-1.5 rounded transition-colors ${chartType === "line" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`}
                    title="Line Chart"
                  >
                    <LineChartIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType("candle")}
                    className={`p-1.5 rounded transition-colors ${chartType === "candle" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`}
                    title="Candlestick Chart"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
                {/* Period Selector */}
                <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-full">
                  <PeriodButton period="1d" currentPeriod={period} onClick={handlePeriodChange} label="1D" />
                  <PeriodButton period="5d" currentPeriod={period} onClick={handlePeriodChange} label="5D" />
                  <PeriodButton period="1mo" currentPeriod={period} onClick={handlePeriodChange} label="1M" />
                  <PeriodButton period="3mo" currentPeriod={period} onClick={handlePeriodChange} label="3M" />
                  <PeriodButton period="1y" currentPeriod={period} onClick={handlePeriodChange} label="1Y" />
                  <PeriodButton period="5y" currentPeriod={period} onClick={handlePeriodChange} label="5Y" />
                </div>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="h-72 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-zinc-600 animate-spin" />
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bollinger" ? (
                    <ComposedChart data={calculateBollingerBands(history)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#52525b', fontSize: 12 }}
                        tickFormatter={(value) => formatChartTick(value, period)}
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
                      <Tooltip content={<BollingerTooltip />} />
                      {/* Upper Band */}
                      <Area 
                        type="monotone" 
                        dataKey="upperBand" 
                        stroke="#a855f7"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        fillOpacity={0}
                        fill="none"
                        connectNulls
                      />
                      {/* Lower Band */}
                      <Area 
                        type="monotone" 
                        dataKey="lowerBand" 
                        stroke="#a855f7"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        fillOpacity={0}
                        fill="none"
                        connectNulls
                      />
                      {/* SMA (Middle Band) */}
                      <Line 
                        type="monotone" 
                        dataKey="sma" 
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                      {/* Price Line */}
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke={isPositive ? "#22c55e" : "#ef4444"}
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  ) : chartType === "line" ? (
                    <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#52525b', fontSize: 12 }}
                        tickFormatter={(value) => formatChartTick(value, period)}
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
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke={isPositive ? "#22c55e" : "#ef4444"}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  ) : (
                    /* Candlestick Chart */
                    <ComposedChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#52525b', fontSize: 12 }}
                        tickFormatter={(value) => formatChartTick(value, period)}
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
                      <Tooltip content={<OHLCTooltip />} />
                      {/* Render candlesticks using Bar */}
                      <Bar 
                        dataKey="close" 
                        shape={candlestickShape}
                      />
                    </ComposedChart>
                  )}
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
                        {formatExpDate(exp, { includeYear: true })}
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
                    <label className="text-zinc-400 text-sm">Min P(OTM) ≥</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        value={minProbOTM}
                        onChange={(e) => setMinProbOTM(Math.max(0, Math.min(100, parseInt(e.target.value) || 50)))}
                        className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setMinCredit(0); setMaxRiskReward(100); setMinProbOTM(50); }}
                    className="text-zinc-500 hover:text-white text-sm underline transition-colors"
                  >
                    Reset filters
                  </button>
                </div>

                {creditSpreads && (
                  <div className="mb-4 flex gap-4 text-sm">
                    <span className="text-zinc-400">{symbol}: <span className="text-white font-mono">${creditSpreads.current_price.toLocaleString()}</span></span>
                    <span className="text-zinc-400">Exp: <span className="text-white">{formatExpDate(creditSpreads.expiration, { includeYear: true })}</span></span>
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
                          minProbOTM={minProbOTM}
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
                          minProbOTM={minProbOTM}
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
                      Exp: <span className="text-white">{formatExpDate(ironCondors.expiration, { includeYear: true })}</span>
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
                      minRewardAmount={minRewardAmount}
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
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((w) => (
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
                      Exp: <span className="text-white">{formatExpDate(ironButterflies.expiration, { includeYear: true })}</span>
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
                      minRewardAmount={minRewardAmount}
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
                      Exp: <span className="text-white">{formatExpDate(straddles.expiration, { includeYear: true })}</span>
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
                        <StraddleTable straddles={straddles?.straddles} currentPrice={straddles?.current_price} strikeRange={straddleStrangleRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />
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
                        <StrangleTable strangles={strangles?.strangles} currentPrice={strangles?.current_price} strikeRange={straddleStrangleRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />
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
                <span className="text-zinc-500 text-sm">Near:</span>
                <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
                  <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-white" data-testid="near-expiration-select">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {expirations.slice(0, 10).map((exp) => (
                      <SelectItem 
                        key={exp} 
                        value={exp} 
                        className="text-white hover:bg-zinc-800"
                      >
                        {formatExpDate(exp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-zinc-500 text-sm">Far:</span>
                <Select value={farExpiration} onValueChange={setFarExpiration}>
                  <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-white" data-testid="far-expiration-select">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {expirations
                      .filter((exp) => exp > selectedExpiration)
                      .slice(0, 10)
                      .map((exp) => (
                      <SelectItem 
                        key={exp} 
                        value={exp} 
                        className="text-white hover:bg-zinc-800"
                      >
                        {formatExpDate(exp)}
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
                      Near: <span className="text-white">{formatExpDate(calendarSpreads.near_expiration, { includeYear: true })}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Far: <span className="text-white">{formatExpDate(calendarSpreads.far_expiration, { includeYear: true })}</span>
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
                      minRewardAmount={minRewardAmount}
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
                <div className="flex items-center gap-3">
                  {/* Export Buttons */}
                  <button
                    onClick={() => exportPortfolio(positions, 'all')}
                    disabled={!positions.length}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Export All Positions to CSV"
                  >
                    <Download className="w-3 h-3" />
                    All
                  </button>
                  <button
                    onClick={() => exportPortfolio(positions, 'open')}
                    disabled={!positions.filter(p => p.status === 'open').length}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Export Open Positions to CSV"
                  >
                    <Download className="w-3 h-3" />
                    Open
                  </button>
                  <button
                    onClick={() => exportPortfolio(positions, 'closed')}
                    disabled={!positions.filter(p => p.status === 'closed' || p.status === 'expired').length}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Export Closed/Expired Positions to CSV"
                  >
                    <Download className="w-3 h-3" />
                    Closed
                  </button>
                  <button 
                    onClick={() => setShowPortfolio(false)}
                    className="text-zinc-400 hover:text-white transition-colors ml-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Portfolio Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Open Positions</div>
                  <div className="text-2xl font-bold text-white">{positions.filter(p => p.status === 'open').length}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Closed/Expired</div>
                  <div className="text-2xl font-bold text-white">{positions.filter(p => p.status === 'closed' || p.status === 'expired').length}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Unrealized P/L</div>
                  {(() => {
                    const totalUnrealizedPnL = positions
                      .filter(p => p.status === 'open')
                      .reduce((sum, pos) => {
                        const closePrice = calculateCurrentStrategyPrice(pos);
                        if (closePrice !== null) {
                          const isDebitStrategy = pos.entry_price < 0;
                          if (isDebitStrategy) {
                            return sum + (-closePrice + pos.entry_price) * pos.quantity * 100;
                          } else {
                            return sum + (pos.entry_price - closePrice) * pos.quantity * 100;
                          }
                        }
                        return sum + (pos.unrealized_pnl || 0);
                      }, 0);
                    return (
                      <div className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
                      </div>
                    );
                  })()}
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-sm">Realized P/L</div>
                  <div className={`text-2xl font-bold ${positions.filter(p => p.status === 'closed' || p.status === 'expired').reduce((sum, p) => sum + (p.realized_pnl || 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${positions.filter(p => p.status === 'closed' || p.status === 'expired').reduce((sum, p) => sum + (p.realized_pnl || 0), 0).toFixed(2)}
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
                        <th className="text-left py-3 px-2">Opened</th>
                        <th className="text-left py-3 px-2">Expiration</th>
                        <th className="text-right py-3 px-2">Entry</th>
                        <th className="text-right py-3 px-2">Current/Exit</th>
                        <th className="text-right py-3 px-2">Qty</th>
                        <th className="text-right py-3 px-2">P/L</th>
                        <th className="text-center py-3 px-2">Status</th>
                        <th className="text-center py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...positions].sort((a, b) => {
                        // Sort: open positions first, then by opened date (newest first)
                        if (a.status === 'open' && b.status !== 'open') return -1;
                        if (a.status !== 'open' && b.status === 'open') return 1;
                        return new Date(b.opened_at) - new Date(a.opened_at);
                      }).map((pos) => {
                        const closePrice = pos.status === 'open' ? calculateCurrentStrategyPrice(pos) : null;
                        const isDebitStrategy = pos.entry_price < 0; // Negative entry = debit strategy
                        
                        // P/L calculation:
                        // Credit strategy: Entry (positive) - Close Price (positive) = profit if close < entry
                        // Debit strategy: -Close Price (what you receive) - Entry (negative cost) = profit if receive > cost
                        let unrealizedPnL = null;
                        if (closePrice !== null) {
                          if (isDebitStrategy) {
                            // Debit: you paid |entry|, now you'd receive |closePrice|
                            // closePrice is negative (you receive), entry is negative (you paid)
                            unrealizedPnL = (-closePrice + pos.entry_price) * pos.quantity * 100;
                          } else {
                            // Credit: you received entry, now you'd pay closePrice
                            unrealizedPnL = (pos.entry_price - closePrice) * pos.quantity * 100;
                          }
                        }
                        
                        return (
                        <tr key={pos.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="py-3 px-2 font-mono text-white">{pos.symbol}</td>
                          <td className="py-3 px-2">
                            <div className="font-medium text-white">{pos.strategy_name}</div>
                            <div className="text-xs text-zinc-500">{pos.strategy_type}</div>
                          </td>
                          <td className="py-3 px-2 text-zinc-400">
                            <div className="text-sm">{new Date(pos.opened_at).toLocaleDateString()}</div>
                            <div className="text-xs text-zinc-500">{new Date(pos.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </td>
                          <td className="py-3 px-2 text-zinc-400">{formatExpDate(pos.expiration, { includeYear: true })}</td>
                          <td className={`py-3 px-2 text-right font-mono ${isDebitStrategy ? 'text-red-400' : 'text-green-400'}`}>
                            {isDebitStrategy ? `-$${Math.abs(pos.entry_price).toFixed(2)}` : `$${pos.entry_price.toFixed(2)}`}
                          </td>
                          <td className={`py-3 px-2 text-right font-mono ${
                            pos.status === 'open' 
                              ? (closePrice !== null ? (closePrice > 0 ? 'text-red-400' : 'text-green-400') : 'text-zinc-400')
                              : (pos.exit_price !== null ? (isDebitStrategy ? 'text-green-400' : 'text-red-400') : 'text-zinc-400')
                          }`}>
                            {pos.status === 'open' && closePrice !== null 
                              ? (closePrice > 0 ? `-$${closePrice.toFixed(2)}` : `$${Math.abs(closePrice).toFixed(2)}`)
                              : pos.status === 'open' && closePrice === null
                                ? <span className="text-zinc-500 text-xs" title="Loading price data...">...</span>
                                : (pos.status === 'closed' || pos.status === 'expired') && pos.exit_price !== null
                                  ? (isDebitStrategy 
                                      ? `$${Math.abs(pos.exit_price).toFixed(2)}`
                                      : `-$${Math.abs(pos.exit_price).toFixed(2)}`)
                                  : '-'
                            }
                          </td>
                          <td className="py-3 px-2 text-right text-white">{pos.quantity}</td>
                          <td className={`py-3 px-2 text-right font-mono ${
                            (pos.status === 'closed' || pos.status === 'expired')
                              ? (pos.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400')
                              : unrealizedPnL !== null
                                ? (unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400')
                                : 'text-zinc-400'
                          }`}>
                            {(pos.status === 'closed' || pos.status === 'expired')
                              ? `$${pos.realized_pnl?.toFixed(2) || '0.00'}`
                              : unrealizedPnL !== null
                                ? `${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}`
                                : '-'
                            }
                          </td>
                          <td className="py-3 px-2 text-center">
                            {pos.status === 'open' ? (
                              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Open</span>
                            ) : pos.status === 'expired' ? (
                              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">Expired</span>
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
                                    // Auto-fill exit price with current strategy quote
                                    const currentPrice = calculateCurrentStrategyPrice(pos);
                                    setClosePrice(currentPrice !== null ? Math.abs(currentPrice).toFixed(2) : "");
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
                      );})}
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

                {(() => {
                  const currentStrategyPrice = calculateCurrentStrategyPrice(closeDialog.position);
                  return currentStrategyPrice !== null ? (
                    <div>
                      <div className="text-zinc-400 text-sm mb-1">Current Strategy Quote</div>
                      <div className="text-cyan-400 font-mono">${Math.abs(currentStrategyPrice).toFixed(2)}</div>
                      <p className="text-zinc-500 text-xs mt-1">Based on current option prices</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-zinc-400 text-sm mb-1">Current {symbol} Price</div>
                      <div className="text-white font-mono">${quote?.price?.toFixed(2) || 'N/A'}</div>
                      <p className="text-zinc-500 text-xs mt-1">Option chain not loaded for this expiration</p>
                    </div>
                  );
                })()}
                
                <div>
                  <label className="text-zinc-400 text-sm mb-1 block">Exit Price (per contract)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={closePrice}
                    onChange={(e) => setClosePrice(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded-lg font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-zinc-500 text-xs mt-1">
                    For credit spreads: Enter the debit to close (typically less than entry credit if profitable)
                  </p>
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

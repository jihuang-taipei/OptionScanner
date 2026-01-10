import { useState, useMemo, memo } from "react";
import "@/App.css";
import { RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Clock, ChevronDown, ChevronRight, Table2, Calculator, Download, Calendar, Briefcase, LineChart as LineChartIcon, Shield, Target, Zap, FileText } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Bar } from "recharts";
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

// Import components
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
} from "./components/tables";
import {
  PortfolioModal,
  TradeDialog,
  ClosePositionDialog,
} from "./components/portfolio";
import {
  AnalyticsDashboard,
  RiskDashboard,
  StrategyBuilder,
} from "./components/analytics";

// Import custom hooks
import { useQuoteData, useOptionsData, usePortfolio, useAutoClose, useAnalytics, useRiskManagement, useStrategyBuilder } from "./hooks";

// Import utilities and constants
import { REFRESH_INTERVALS, POPULAR_SYMBOLS } from "./utils/constants";
import {
  exportOptionsChain,
  exportCreditSpreads,
  exportIronCondors,
  exportStraddles,
  exportStrangles,
  exportIronButterflies,
  exportCalendarSpreads,
} from "./utils/exportUtils";
import { generatePerformanceReport } from "./utils/pdfExport";

// ============================================================================
// CHART UTILITIES
// ============================================================================

const formatChartTick = (value, period) => {
  if (!value) return '';
  if (period === '1d') {
    if (value.includes(' ')) return value.split(' ')[1];
  }
  const datePart = value.includes(' ') ? value.split(' ')[0] : value;
  const [year, month, day] = datePart.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}`;
};

const formatExpDate = (dateString, options = {}) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (options.includeYear) return `${months[month - 1]} ${day}, ${year}`;
  return `${months[month - 1]} ${day}`;
};

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

const calculateBollingerBands = (data, period = 20, multiplier = 2) => {
  if (!data || data.length === 0) return data;
  const effectivePeriod = Math.min(period, Math.max(5, Math.floor(data.length / 3)));
  
  return data.map((item, index) => {
    if (index < effectivePeriod - 1) {
      return { ...item, sma: null, upperBand: null, lowerBand: null };
    }
    const slice = data.slice(index - effectivePeriod + 1, index + 1);
    const closes = slice.map(d => d.close);
    const sma = closes.reduce((sum, val) => sum + val, 0) / effectivePeriod;
    const squaredDiffs = closes.map(val => Math.pow(val - sma, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / effectivePeriod;
    const stdDev = Math.sqrt(avgSquaredDiff);
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

// ============================================================================
// CHART TOOLTIPS
// ============================================================================

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

// Candlestick component
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

const createCandlestickShape = (yAxisDomain) => (props) => <CandlestickBar {...props} yAxisDomain={yAxisDomain} />;

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

function App() {
  // Quote and market data
  const quoteData = useQuoteData("^SPX");
  const {
    symbol, symbolInput, setSymbolInput, handleSymbolChange, handleSymbolInputSubmit,
    quote, history, period, chartType, setChartType,
    isLoadingQuote, isLoadingHistory, isRefreshing, error,
    handleRefresh, handlePeriodChange, autoRefreshInterval, setAutoRefreshInterval, countdown,
    isPositive, priceColor, glowClass, isMarketClosed,
  } = quoteData;

  // Options data
  const optionsData = useOptionsData(symbol, quote);
  const {
    expirations, selectedExpiration, setSelectedExpiration, farExpiration, setFarExpiration,
    optionsChain, isLoadingOptions, strikeRange, setStrikeRange,
    creditSpreads, isLoadingSpreads, spreadWidth, setSpreadWidth,
    minCredit, setMinCredit, maxRiskReward, minProbOTM, setMinProbOTM,
    ironCondors, isLoadingCondors, minProfitProb, setMinProfitProb,
    ironButterflies, isLoadingButterflies, wingWidth, setWingWidth, centerRange, setCenterRange,
    straddles, strangles, isLoadingStraddles, isLoadingStrangles, straddleStrangleRange, setStraddleStrangleRange,
    calendarSpreads, isLoadingCalendars, calendarRange, setCalendarRange,
    resetOptionsData,
  } = optionsData;

  // Portfolio management
  const portfolio = usePortfolio(symbol, selectedExpiration, optionsChain);
  const {
    positions, openPositions, closedPositions, isLoadingPositions,
    showPortfolio, setShowPortfolio,
    tradeDialog, setTradeDialog, tradeQuantity, setTradeQuantity,
    closeDialog, setCloseDialog, closePrice, setClosePrice,
    maxRiskAmount, setMaxRiskAmount, minRewardAmount, setMinRewardAmount,
    createPosition, closePosition, deletePosition, handleTrade,
    calculateCurrentStrategyPrice, calculatePLPercent,
    totalUnrealizedPnL, totalRealizedPnL,
  } = portfolio;

  // Auto-close functionality
  const autoClose = useAutoClose(
    positions,
    calculateCurrentStrategyPrice,
    calculatePLPercent,
    portfolio.getHoursToExpiry,
    portfolio.fetchPositions
  );

  // Analytics
  const analytics = useAnalytics(positions);

  // Risk Management
  const risk = useRiskManagement(positions, calculateCurrentStrategyPrice);

  // Strategy Builder
  const strategyBuilder = useStrategyBuilder(quote, optionsChain, selectedExpiration);

  // P/L Chart state
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [showPLChart, setShowPLChart] = useState(false);

  // Dashboard modals
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showRisk, setShowRisk] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState({
    optionsChain: false,
    creditSpreads: false,
    ironCondors: true,
    ironButterflies: true,
    straddlesStrangles: true,
    calendarSpreads: true,
  });

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Candlestick shape memoization
  const candlestickShape = useMemo(() => {
    if (history.length === 0) return null;
    const yAxisDomain = [Math.min(...history.map(d => d.low)), Math.max(...history.map(d => d.high))];
    return createCandlestickShape(yAxisDomain);
  }, [history]);

  const handleSelectStrategy = (strategy) => {
    setSelectedStrategy(strategy);
    setShowPLChart(true);
  };

  // Handle close position dialog open
  const handleOpenCloseDialog = (pos) => {
    setCloseDialog({ open: true, position: pos });
    const currentPrice = calculateCurrentStrategyPrice(pos);
    setClosePrice(currentPrice !== null ? Math.abs(currentPrice).toFixed(2) : "");
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    try {
      await generatePerformanceReport({
        positions,
        winRateStats: analytics.winRateStats,
        overallStats: analytics.overallStats,
        pnlByStrategy: analytics.pnlByStrategy,
        pnlByHoldingPeriod: analytics.pnlByHoldingPeriod,
        monthlyPerformance: analytics.monthlyPerformance,
        topTrades: analytics.topTrades,
        analyticsPeriod: analytics.analyticsPeriod,
        tradingCapital: risk.tradingCapital,
        riskMetrics: risk.riskMetrics,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] noise-overlay">
      {/* Ambient Background Glows */}
      <div className="ambient-glow bg-green-500/20 top-20 -left-40" style={{ position: 'fixed' }} />
      <div className="ambient-glow bg-blue-500/10 bottom-20 -right-40" style={{ position: 'fixed' }} />

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
              <input
                type="text"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                placeholder="Enter symbol"
                className="bg-zinc-900 border border-zinc-800 text-white px-4 py-2 rounded-lg font-mono text-sm w-28 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                data-testid="symbol-input"
              />
              <button type="submit" className="bg-zinc-800 text-zinc-300 px-3 py-2 rounded-lg hover:bg-zinc-700 transition-colors text-sm" data-testid="symbol-submit">
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
                <button className={`flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2.5 rounded-full font-medium hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-200 ${isMarketClosed ? 'border-amber-800/50' : ''}`} data-testid="auto-refresh-dropdown">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    {isMarketClosed ? "Market Closed" : autoRefreshInterval === 0 ? "Auto: Off" : `Auto: ${REFRESH_INTERVALS.find(i => i.value === autoRefreshInterval)?.label}`}
                  </span>
                  {autoRefreshInterval > 0 && countdown > 0 && !isMarketClosed && (
                    <span className="text-xs text-zinc-500 font-mono">({countdown}s)</span>
                  )}
                  {isMarketClosed && <span className="text-xs text-amber-500">Paused</span>}
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                {REFRESH_INTERVALS.map((interval) => (
                  <DropdownMenuItem
                    key={interval.value}
                    onClick={() => setAutoRefreshInterval(interval.value)}
                    className={`cursor-pointer ${autoRefreshInterval === interval.value ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  >
                    {interval.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Manual refresh */}
            <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-medium hover:bg-zinc-200 transition-all duration-200 active:scale-95 disabled:opacity-50" data-testid="refresh-button">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {/* Portfolio Button */}
            <button onClick={() => setShowPortfolio(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-emerald-500 transition-all duration-200 active:scale-95 relative" data-testid="portfolio-button">
              <Briefcase className="w-4 h-4" />
              Portfolio
              {openPositions.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {openPositions.length}
                </span>
              )}
            </button>

            {/* Analytics Button */}
            <button onClick={() => setShowAnalytics(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-full font-medium hover:bg-purple-500 transition-all duration-200 active:scale-95" data-testid="analytics-button">
              <Target className="w-4 h-4" />
              Analytics
            </button>

            {/* Risk Button */}
            <button onClick={() => setShowRisk(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-full font-medium hover:bg-blue-500 transition-all duration-200 active:scale-95" data-testid="risk-button">
              <Shield className="w-4 h-4" />
              Risk
            </button>

            {/* Strategy Builder Button */}
            <button onClick={() => setShowBuilder(true)} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-full font-medium hover:bg-amber-500 transition-all duration-200 active:scale-95" data-testid="builder-button">
              <Zap className="w-4 h-4" />
              Builder
            </button>
          </div>
        </header>

        {/* Position Sizing Settings */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-400" />
            <span className="text-zinc-300 font-medium">Position Sizing</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Max Risk $</label>
            <Input type="number" min="100" max="100000" step="100" value={maxRiskAmount} onChange={(e) => setMaxRiskAmount(Math.max(100, parseInt(e.target.value) || 1000))} className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8 text-center font-mono" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Min Reward $</label>
            <Input type="number" min="0" max="100000" step="100" value={minRewardAmount} onChange={(e) => setMinRewardAmount(Math.max(0, parseInt(e.target.value) || 1000))} className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8 text-center font-mono" />
          </div>
          <div className="text-zinc-500 text-xs">
            <span className="text-zinc-400">Contracts</span> = Max Risk ÷ Max Loss | <span className="text-green-400 ml-2">✓ Reward ≥ ${minRewardAmount.toLocaleString()}</span>
          </div>
        </div>

        {error && (
          <div className="glass-card border-red-500/30 bg-red-500/10 p-4 mb-6 text-red-400">{error}</div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero Ticker Card */}
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
                  {isPositive ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                  <span className="font-mono text-2xl font-medium" data-testid="price-change">
                    {isPositive ? '+' : ''}{quote?.change.toFixed(2)}
                  </span>
                  <span className="font-mono text-lg opacity-80" data-testid="change-percent">
                    ({isPositive ? '+' : ''}{quote?.change_percent.toFixed(2)}%)
                  </span>
                </div>
                <p className="text-zinc-600 text-sm mt-4 font-mono">
                  Last updated: {quote?.timestamp ? new Date(quote.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }) : 'N/A'}
                </p>
              </>
            )}
          </div>

          {/* Chart Card */}
          <div className="glass-card p-6 lg:col-span-2" data-testid="chart-container">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-zinc-400" />
                Historical Performance
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg">
                  <button onClick={() => setChartType("bollinger")} className={`p-1.5 rounded transition-colors ${chartType === "bollinger" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`} title="Bollinger Bands">
                    <Activity className="w-4 h-4" />
                  </button>
                  <button onClick={() => setChartType("line")} className={`p-1.5 rounded transition-colors ${chartType === "line" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`} title="Line Chart">
                    <LineChartIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => setChartType("candle")} className={`p-1.5 rounded transition-colors ${chartType === "candle" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`} title="Candlestick Chart">
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
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
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 12 }} tickFormatter={(v) => formatChartTick(v, period)} interval="preserveStartEnd" minTickGap={50} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(v) => v.toLocaleString()} width={60} />
                      <Tooltip content={<BollingerTooltip />} />
                      <Area type="monotone" dataKey="upperBand" stroke="#a855f7" strokeWidth={1} strokeDasharray="3 3" fillOpacity={0} fill="none" connectNulls />
                      <Area type="monotone" dataKey="lowerBand" stroke="#a855f7" strokeWidth={1} strokeDasharray="3 3" fillOpacity={0} fill="none" connectNulls />
                      <Line type="monotone" dataKey="sma" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="close" stroke={isPositive ? "#22c55e" : "#ef4444"} strokeWidth={2} dot={false} />
                    </ComposedChart>
                  ) : chartType === "line" ? (
                    <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 12 }} tickFormatter={(v) => formatChartTick(v, period)} interval="preserveStartEnd" minTickGap={50} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(v) => v.toLocaleString()} width={60} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="close" stroke={isPositive ? "#22c55e" : "#ef4444"} strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <ComposedChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 12 }} tickFormatter={(v) => formatChartTick(v, period)} interval="preserveStartEnd" minTickGap={50} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(v) => v.toLocaleString()} width={60} />
                      <Tooltip content={<OHLCTooltip />} />
                      <Bar dataKey="close" shape={candlestickShape} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Open" value={quote?.open} icon={TrendingUp} isLoading={isLoadingQuote} />
            <StatCard label="Day High" value={quote?.day_high} icon={TrendingUp} isLoading={isLoadingQuote} />
            <StatCard label="Day Low" value={quote?.day_low} icon={TrendingDown} isLoading={isLoadingQuote} />
            <StatCard label="Prev Close" value={quote?.previous_close} icon={Activity} isLoading={isLoadingQuote} />
          </div>

          {/* 52-Week Range */}
          <div className="lg:col-span-3 glass-card p-6">
            <h3 className="text-zinc-400 text-sm mb-4">52-Week Range</h3>
            <div className="flex items-center gap-4">
              <span className="font-mono text-white">
                {isLoadingQuote ? <span className="inline-block h-5 w-20 bg-zinc-800 rounded animate-pulse" /> : quote?.fifty_two_week_low?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                {!isLoadingQuote && quote && (
                  <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative" style={{ width: `${((quote.price - quote.fifty_two_week_low) / (quote.fifty_two_week_high - quote.fifty_two_week_low)) * 100}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                  </div>
                )}
              </div>
              <span className="font-mono text-white">
                {isLoadingQuote ? <span className="inline-block h-5 w-20 bg-zinc-800 rounded animate-pulse" /> : quote?.fifty_two_week_high?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Options Chain Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="options-chain">
            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleSection('optionsChain')}>
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.optionsChain ? <ChevronRight className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                <Table2 className="w-5 h-5 text-zinc-400" />
                Options Chain ({symbol})
                <span className="text-xs text-zinc-500 font-normal ml-2">{optionsChain ? `${optionsChain.calls?.length || 0} calls, ${optionsChain.puts?.length || 0} puts` : ''}</span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <span className="text-zinc-500 text-sm">Expiration:</span>
                <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
                  <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-white" data-testid="expiration-select">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {expirations.slice(0, 12).map((exp) => (
                      <SelectItem key={exp} value={exp} className="text-white hover:bg-zinc-800">{formatExpDate(exp, { includeYear: true })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingOptions && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button onClick={() => exportOptionsChain(optionsChain?.calls, 'Calls', selectedExpiration)} disabled={!optionsChain?.calls?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <Download className="w-3 h-3" />Calls
                </button>
                <button onClick={() => exportOptionsChain(optionsChain?.puts, 'Puts', selectedExpiration)} disabled={!optionsChain?.puts?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <Download className="w-3 h-3" />Puts
                </button>
              </div>
            </div>
            {!collapsedSections.optionsChain && (
              <>
                <p className="text-zinc-500 text-xs mb-3">{symbol} Options Chain. Includes Greeks calculation.</p>
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Strike Range:</label>
                    <Select value={strikeRange.toString()} onValueChange={(v) => setStrikeRange(parseInt(v))}>
                      <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8" data-testid="strike-range-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {[2, 5, 10, 15, 20, 25, 30, 50].map((pct) => (
                          <SelectItem key={pct} value={pct.toString()} className="text-white hover:bg-zinc-800">±{pct}%</SelectItem>
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
                    <TabsTrigger value="calls" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500" data-testid="calls-tab">Calls</TabsTrigger>
                    <TabsTrigger value="puts" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500" data-testid="puts-tab">Puts</TabsTrigger>
                  </TabsList>
                  <TabsContent value="calls" className="max-h-96 overflow-y-auto">
                    {isLoadingOptions ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : <OptionsTable options={optionsChain?.calls} type="calls" currentPrice={quote?.price} strikeRange={strikeRange} onTrade={handleTrade} />}
                  </TabsContent>
                  <TabsContent value="puts" className="max-h-96 overflow-y-auto">
                    {isLoadingOptions ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : <OptionsTable options={optionsChain?.puts} type="puts" currentPrice={quote?.price} strikeRange={strikeRange} onTrade={handleTrade} />}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          {/* Credit Spreads Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="credit-spreads">
            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleSection('creditSpreads')}>
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.creditSpreads ? <ChevronRight className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                <Calculator className="w-5 h-5 text-zinc-400" />
                Credit Spreads (${spreadWidth} wide)
                <span className="text-xs text-zinc-500 font-normal ml-2">{creditSpreads ? `${creditSpreads.bull_put_spreads?.length || 0} bull put, ${creditSpreads.bear_call_spreads?.length || 0} bear call` : ''}</span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <span className="text-zinc-500 text-sm">Width:</span>
                <Select value={spreadWidth.toString()} onValueChange={(v) => setSpreadWidth(parseInt(v))}>
                  <SelectTrigger className="w-20 bg-zinc-900 border-zinc-800 text-white" data-testid="spread-width-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[1, 2, 5, 10, 15, 20].map((w) => (
                      <SelectItem key={w} value={w.toString()} className="text-white hover:bg-zinc-800">${w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingSpreads && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button onClick={() => exportCreditSpreads(creditSpreads?.bull_put_spreads, 'BullPut', selectedExpiration)} disabled={!creditSpreads?.bull_put_spreads?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Download className="w-3 h-3" />Bull Put</button>
                <button onClick={() => exportCreditSpreads(creditSpreads?.bear_call_spreads, 'BearCall', selectedExpiration)} disabled={!creditSpreads?.bear_call_spreads?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Download className="w-3 h-3" />Bear Call</button>
              </div>
            </div>
            {!collapsedSections.creditSpreads && (
              <>
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Min Credit:</label>
                    <Select value={minCredit.toString()} onValueChange={(v) => setMinCredit(parseFloat(v))}>
                      <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700 text-white text-sm h-8" data-testid="min-credit-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {[0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.50, 0.75, 1.00, 1.50, 2.00].map((c) => (
                          <SelectItem key={c} value={c.toString()} className="text-white hover:bg-zinc-800">${c.toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Min P(OTM) ≥</label>
                    <div className="relative">
                      <Input type="number" min="0" max="100" step="5" value={minProbOTM} onChange={(e) => setMinProbOTM(Math.max(0, Math.min(100, parseInt(e.target.value) || 50)))} className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                  <button onClick={() => { setMinCredit(0); setMinProbOTM(50); }} className="text-zinc-500 hover:text-white text-sm underline transition-colors">Reset filters</button>
                </div>
                {creditSpreads && (
                  <div className="mb-4 flex gap-4 text-sm">
                    <span className="text-zinc-400">{symbol}: <span className="text-white font-mono">${creditSpreads.current_price.toLocaleString()}</span></span>
                    <span className="text-zinc-400">Exp: <span className="text-white">{formatExpDate(creditSpreads.expiration, { includeYear: true })}</span></span>
                  </div>
                )}
                <Tabs defaultValue="bull-put" className="w-full">
                  <TabsList className="bg-zinc-900/50 mb-4">
                    <TabsTrigger value="bull-put" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500" data-testid="bull-put-tab">Bull Put Spreads ({creditSpreads?.bull_put_spreads?.length || 0})</TabsTrigger>
                    <TabsTrigger value="bear-call" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500" data-testid="bear-call-tab">Bear Call Spreads ({creditSpreads?.bear_call_spreads?.length || 0})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="bull-put" className="max-h-96 overflow-y-auto">
                    {isLoadingSpreads ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : (
                      <>
                        <p className="text-zinc-500 text-xs mb-3">Bullish strategy: Sell higher strike put, buy lower strike put. Profit if SPY stays above sell strike.</p>
                        <CreditSpreadTable spreads={creditSpreads?.bull_put_spreads} type="Bull Put" currentPrice={creditSpreads?.current_price} minCredit={minCredit} maxRiskReward={maxRiskReward} minProbOTM={minProbOTM} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="bear-call" className="max-h-96 overflow-y-auto">
                    {isLoadingSpreads ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : (
                      <>
                        <p className="text-zinc-500 text-xs mb-3">Bearish strategy: Sell lower strike call, buy higher strike call. Profit if SPY stays below sell strike.</p>
                        <CreditSpreadTable spreads={creditSpreads?.bear_call_spreads} type="Bear Call" currentPrice={creditSpreads?.current_price} minCredit={minCredit} maxRiskReward={maxRiskReward} minProbOTM={minProbOTM} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          {/* Iron Condor Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="iron-condors">
            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleSection('ironCondors')}>
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.ironCondors ? <ChevronRight className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                Iron Condors (${spreadWidth} wide legs)
                <span className="text-xs text-zinc-500 font-normal ml-2">{ironCondors?.iron_condors?.length || 0} found</span>
              </h2>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {isLoadingCondors && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button onClick={() => exportIronCondors(ironCondors?.iron_condors, selectedExpiration)} disabled={!ironCondors?.iron_condors?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Download className="w-3 h-3" />Export</button>
              </div>
            </div>
            {!collapsedSections.ironCondors && (
              <>
                <p className="text-zinc-500 text-xs mb-4">Neutral strategy: Combines Bull Put Spread (below price) + Bear Call Spread (above price). Profit if {symbol} stays within the profit zone at expiration.</p>
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Min P(Profit) ≥</label>
                    <div className="relative">
                      <Input type="number" min="0" max="100" value={minProfitProb} onChange={(e) => setMinProfitProb(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                  {ironCondors && (
                    <span className="text-zinc-500 text-xs">
                      {symbol}: <span className="text-white font-mono">${ironCondors.current_price?.toLocaleString()}</span>
                      <span className="text-zinc-600 mx-2">|</span>
                      Exp: <span className="text-white">{formatExpDate(ironCondors.expiration, { includeYear: true })}</span>
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {isLoadingCondors ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : <IronCondorTable condors={ironCondors?.iron_condors} currentPrice={ironCondors?.current_price} minCredit={minCredit} maxRiskReward={maxRiskReward} minProfitProb={minProfitProb} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />}
                </div>
              </>
            )}
          </div>

          {/* Iron Butterfly Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="iron-butterflies">
            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleSection('ironButterflies')}>
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.ironButterflies ? <ChevronRight className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                Iron Butterflies
                <span className="text-xs text-zinc-500 font-normal ml-2">{ironButterflies?.iron_butterflies?.length || 0} found</span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <span className="text-zinc-500 text-sm">Wing Width:</span>
                <Select value={wingWidth.toString()} onValueChange={(v) => setWingWidth(parseInt(v))}>
                  <SelectTrigger className="w-20 bg-zinc-900 border-zinc-800 text-white" data-testid="wing-width-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((w) => (
                      <SelectItem key={w} value={w.toString()} className="text-white hover:bg-zinc-800">${w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingButterflies && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button onClick={() => exportIronButterflies(ironButterflies?.iron_butterflies, selectedExpiration)} disabled={!ironButterflies?.iron_butterflies?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Download className="w-3 h-3" />Export</button>
              </div>
            </div>
            {!collapsedSections.ironButterflies && (
              <>
                <p className="text-zinc-500 text-xs mb-4">Neutral strategy: Sell ATM call + put at same strike, buy OTM wings. Max profit if {symbol} expires exactly at center strike.</p>
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Center Strike ±</label>
                    <div className="relative">
                      <Input type="number" min="0.1" max="10" step="0.1" value={centerRange} onChange={(e) => setCenterRange(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.5)))} className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {isLoadingButterflies ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : <IronButterflyTable butterflies={ironButterflies?.iron_butterflies} currentPrice={ironButterflies?.current_price} minCredit={minCredit} maxRiskReward={maxRiskReward} centerRange={centerRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />}
                </div>
              </>
            )}
          </div>

          {/* Straddle/Strangle Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="straddle-strangle">
            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleSection('straddlesStrangles')}>
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.straddlesStrangles ? <ChevronRight className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                Straddles & Strangles
                <span className="text-xs text-zinc-500 font-normal ml-2">{(straddles?.straddles?.length || 0) + (strangles?.strangles?.length || 0)} found</span>
              </h2>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {(isLoadingStraddles || isLoadingStrangles) && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button onClick={() => exportStraddles(straddles?.straddles, selectedExpiration)} disabled={!straddles?.straddles?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Download className="w-3 h-3" />Straddles</button>
                <button onClick={() => exportStrangles(strangles?.strangles, selectedExpiration)} disabled={!strangles?.strangles?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Download className="w-3 h-3" />Strangles</button>
              </div>
            </div>
            {!collapsedSections.straddlesStrangles && (
              <>
                <p className="text-zinc-500 text-xs mb-4">Volatility plays: Profit from large moves in either direction. Max loss = premium paid. Unlimited profit potential.</p>
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Strike ±</label>
                    <div className="relative">
                      <Input type="number" min="0.1" max="10" step="0.1" value={straddleStrangleRange} onChange={(e) => setStraddleStrangleRange(Math.round(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.5)) * 10) / 10)} className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                </div>
                <Tabs defaultValue="straddles" className="w-full">
                  <TabsList className="bg-zinc-900/50 mb-4">
                    <TabsTrigger value="straddles" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400" data-testid="straddles-tab">Straddles ({straddles?.straddles?.length || 0})</TabsTrigger>
                    <TabsTrigger value="strangles" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400" data-testid="strangles-tab">Strangles ({strangles?.strangles?.length || 0})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="straddles" className="max-h-96 overflow-y-auto">
                    {isLoadingStraddles ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : <StraddleTable straddles={straddles?.straddles} currentPrice={straddles?.current_price} strikeRange={straddleStrangleRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />}
                  </TabsContent>
                  <TabsContent value="strangles" className="max-h-96 overflow-y-auto">
                    {isLoadingStrangles ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : <StrangleTable strangles={strangles?.strangles} currentPrice={strangles?.current_price} strikeRange={straddleStrangleRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          {/* Calendar Spreads Section */}
          <div className="lg:col-span-3 glass-card p-6" data-testid="calendar-spreads">
            <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => toggleSection('calendarSpreads')}>
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                {collapsedSections.calendarSpreads ? <ChevronRight className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                <Calendar className="w-5 h-5 text-zinc-400" />
                Calendar Spreads
                <span className="text-xs text-zinc-500 font-normal ml-2">{calendarSpreads?.calendar_spreads?.length || 0} found</span>
              </h2>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <span className="text-zinc-500 text-sm">Near:</span>
                <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
                  <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-white" data-testid="near-expiration-select">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {expirations.slice(0, 10).map((exp) => (
                      <SelectItem key={exp} value={exp} className="text-white hover:bg-zinc-800">{formatExpDate(exp)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-zinc-500 text-sm">Far:</span>
                <Select value={farExpiration} onValueChange={setFarExpiration}>
                  <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-white" data-testid="far-expiration-select">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {expirations.filter((exp) => exp > selectedExpiration).slice(0, 10).map((exp) => (
                      <SelectItem key={exp} value={exp} className="text-white hover:bg-zinc-800">{formatExpDate(exp)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingCalendars && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />}
                <button onClick={() => exportCalendarSpreads(calendarSpreads?.calendar_spreads, selectedExpiration, farExpiration)} disabled={!calendarSpreads?.calendar_spreads?.length} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Download className="w-3 h-3" />Export</button>
              </div>
            </div>
            {!collapsedSections.calendarSpreads && (
              <>
                <p className="text-zinc-500 text-xs mb-4">Time decay strategy: Sell near-term option, buy far-term option at same strike. Profits from faster theta decay of near-term option and/or IV increase.</p>
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <label className="text-zinc-400 text-sm">Strike ±</label>
                    <div className="relative">
                      <Input type="number" min="0.1" max="10" step="0.1" value={calendarRange} onChange={(e) => setCalendarRange(Math.round(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.5)) * 10) / 10)} className="w-20 bg-zinc-800 border-zinc-700 text-white text-sm h-8 pr-6 text-center font-mono" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                    </div>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {isLoadingCalendars ? <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" /></div> : <CalendarSpreadTable spreads={calendarSpreads?.calendar_spreads} currentPrice={calendarSpreads?.current_price} strikeRange={calendarRange} onSelectStrategy={handleSelectStrategy} onTrade={handleTrade} nearExpiration={selectedExpiration} farExpiration={farExpiration} maxRiskAmount={maxRiskAmount} minRewardAmount={minRewardAmount} />}
                </div>
              </>
            )}
          </div>
        </div>

        {/* P/L Chart Dialog */}
        {showPLChart && selectedStrategy && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowPLChart(false)}>
            <div className="glass-card p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <PLChart strategy={selectedStrategy} currentPrice={quote?.price} onClose={() => setShowPLChart(false)} />
            </div>
          </div>
        )}

        {/* Portfolio Modal */}
        <PortfolioModal
          showPortfolio={showPortfolio}
          setShowPortfolio={setShowPortfolio}
          positions={positions}
          openPositions={openPositions}
          closedPositions={closedPositions}
          isLoadingPositions={isLoadingPositions}
          totalUnrealizedPnL={totalUnrealizedPnL}
          totalRealizedPnL={totalRealizedPnL}
          calculateCurrentStrategyPrice={calculateCurrentStrategyPrice}
          calculatePLPercent={calculatePLPercent}
          onClosePosition={handleOpenCloseDialog}
          onDeletePosition={deletePosition}
          autoCloseEnabled={autoClose.autoCloseEnabled}
          setAutoCloseEnabled={autoClose.setAutoCloseEnabled}
          takeProfitPercent={autoClose.takeProfitPercent}
          setTakeProfitPercent={autoClose.setTakeProfitPercent}
          stopLossPercent={autoClose.stopLossPercent}
          setStopLossPercent={autoClose.setStopLossPercent}
          closeBeforeExpiryHours={autoClose.closeBeforeExpiryHours}
          setCloseBeforeExpiryHours={autoClose.setCloseBeforeExpiryHours}
          autoCloseLog={autoClose.autoCloseLog}
        />

        {/* Trade Dialog */}
        <TradeDialog
          tradeDialog={tradeDialog}
          setTradeDialog={setTradeDialog}
          tradeQuantity={tradeQuantity}
          setTradeQuantity={setTradeQuantity}
          symbol={symbol}
          selectedExpiration={selectedExpiration}
          onCreatePosition={createPosition}
        />

        {/* Close Position Dialog */}
        <ClosePositionDialog
          closeDialog={closeDialog}
          setCloseDialog={setCloseDialog}
          closePrice={closePrice}
          setClosePrice={setClosePrice}
          quote={quote}
          calculateCurrentStrategyPrice={calculateCurrentStrategyPrice}
          onClosePosition={closePosition}
        />

        {/* Analytics Modal */}
        {showAnalytics && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAnalytics(false)}>
            <div className="glass-card p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-medium text-white flex items-center gap-2">
                  <Target className="w-6 h-6 text-purple-400" />
                  Trade Journal & Analytics
                </h3>
                <button onClick={() => setShowAnalytics(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <AnalyticsDashboard
                analyticsPeriod={analytics.analyticsPeriod}
                setAnalyticsPeriod={analytics.setAnalyticsPeriod}
                winRateStats={analytics.winRateStats}
                pnlByStrategy={analytics.pnlByStrategy}
                pnlByHoldingPeriod={analytics.pnlByHoldingPeriod}
                monthlyPerformance={analytics.monthlyPerformance}
                topTrades={analytics.topTrades}
                overallStats={analytics.overallStats}
                onExport={handleExportPDF}
              />
            </div>
          </div>
        )}

        {/* Risk Management Modal */}
        {showRisk && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowRisk(false)}>
            <div className="glass-card p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-medium text-white flex items-center gap-2">
                  <Shield className="w-6 h-6 text-blue-400" />
                  Risk Management Dashboard
                </h3>
                <button onClick={() => setShowRisk(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <RiskDashboard
                tradingCapital={risk.tradingCapital}
                setTradingCapital={risk.setTradingCapital}
                riskMetrics={risk.riskMetrics}
                symbolConcentration={risk.symbolConcentration}
                strategyConcentration={risk.strategyConcentration}
                riskAlerts={risk.riskAlerts}
                expirationRisk={risk.expirationRisk}
              />
            </div>
          </div>
        )}

        {/* Strategy Builder Modal */}
        {showBuilder && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowBuilder(false)}>
            <div className="glass-card p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-medium text-white flex items-center gap-2">
                  <Zap className="w-6 h-6 text-amber-400" />
                  Multi-Leg Strategy Builder
                </h3>
                <button onClick={() => setShowBuilder(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <StrategyBuilder
                legs={strategyBuilder.legs}
                builderName={strategyBuilder.builderName}
                setBuilderName={strategyBuilder.setBuilderName}
                savedStrategies={strategyBuilder.savedStrategies}
                addLeg={strategyBuilder.addLeg}
                updateLeg={strategyBuilder.updateLeg}
                removeLeg={strategyBuilder.removeLeg}
                clearLegs={strategyBuilder.clearLegs}
                saveStrategy={strategyBuilder.saveStrategy}
                loadStrategy={strategyBuilder.loadStrategy}
                deleteStrategy={strategyBuilder.deleteStrategy}
                addCommonStrategy={strategyBuilder.addCommonStrategy}
                netPremium={strategyBuilder.netPremium}
                profitLoss={strategyBuilder.profitLoss}
                strategyType={strategyBuilder.strategyType}
                selectedExpiration={selectedExpiration}
                onTrade={handleTrade}
                symbol={symbol}
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

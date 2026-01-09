import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API } from "../utils/constants";

/**
 * Custom hook for managing quote and history data
 * Handles fetching, auto-refresh, and market state detection
 */
export const useQuoteData = (initialSymbol = "^SPX") => {
  // Symbol state
  const [symbol, setSymbol] = useState(initialSymbol);
  const [symbolInput, setSymbolInput] = useState(initialSymbol);
  
  // Quote and history data
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [period, setPeriod] = useState("1mo");
  const [chartType, setChartType] = useState("bollinger");
  
  // Loading states
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Auto-refresh
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Fetch quote data
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

  // Fetch history data
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

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchQuote(), fetchHistory(period)]);
    setIsRefreshing(false);
  }, [fetchQuote, fetchHistory, period]);

  // Handle symbol change
  const handleSymbolChange = useCallback((newSymbol) => {
    setSymbol(newSymbol);
    setSymbolInput(newSymbol);
    setQuote(null);
    setHistory([]);
    setIsLoadingQuote(true);
    setIsLoadingHistory(true);
    setError(null);
  }, []);

  // Handle symbol input submit
  const handleSymbolInputSubmit = useCallback((e) => {
    e.preventDefault();
    const trimmed = symbolInput.trim().toUpperCase();
    if (trimmed && trimmed !== symbol) {
      handleSymbolChange(trimmed);
    }
  }, [symbolInput, symbol, handleSymbolChange]);

  // Handle period change
  const handlePeriodChange = useCallback((newPeriod) => {
    setPeriod(newPeriod);
    fetchHistory(newPeriod);
  }, [fetchHistory]);

  // Auto-refresh effect
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    const isMarketClosed = quote?.market_state === 'CLOSED' || quote?.market_state === 'POSTPOST';
    
    if (autoRefreshInterval > 0 && !isMarketClosed) {
      setCountdown(autoRefreshInterval);

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return autoRefreshInterval;
          return prev - 1;
        });
      }, 1000);

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
  }, [autoRefreshInterval, quote?.market_state, handleRefresh]);

  // Initial data fetch
  useEffect(() => {
    fetchQuote();
    fetchHistory(period);
  }, [fetchQuote, fetchHistory, period]);

  // Derived values
  const isPositive = quote?.change >= 0;
  const priceColor = isPositive ? 'text-green-500' : 'text-red-500';
  const glowClass = isPositive ? 'glow-green' : 'glow-red';
  const isMarketClosed = quote?.market_state === 'CLOSED' || quote?.market_state === 'POSTPOST';

  return {
    // Symbol
    symbol,
    symbolInput,
    setSymbolInput,
    handleSymbolChange,
    handleSymbolInputSubmit,
    
    // Quote data
    quote,
    history,
    period,
    chartType,
    setChartType,
    
    // Loading states
    isLoadingQuote,
    isLoadingHistory,
    isRefreshing,
    error,
    
    // Refresh
    handleRefresh,
    handlePeriodChange,
    autoRefreshInterval,
    setAutoRefreshInterval,
    countdown,
    
    // Derived values
    isPositive,
    priceColor,
    glowClass,
    isMarketClosed,
  };
};

export default useQuoteData;

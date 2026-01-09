/**
 * API Context - Manages API connections and data
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface Quote {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  previous_close: number;
  open: number;
  day_high: number;
  day_low: number;
  volume: number | null;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  timestamp: string;
  market_state: string | null;
}

interface OptionContract {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  change: number;
  percentChange: number;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number;
  inTheMoney: boolean;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

interface OptionsChain {
  calls: OptionContract[];
  puts: OptionContract[];
}

interface Position {
  id: string;
  symbol: string;
  strategy_type: string;
  strategy_name: string;
  status: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  opened_at: string;
  closed_at: string | null;
  expiration: string;
  legs: any[];
  notes: string;
  realized_pnl: number | null;
}

interface ApiContextType {
  api: AxiosInstance;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  isConnected: boolean;
  
  // Data
  symbol: string;
  setSymbol: (symbol: string) => void;
  quote: Quote | null;
  optionsChain: OptionsChain | null;
  expirations: string[];
  selectedExpiration: string;
  setSelectedExpiration: (exp: string) => void;
  positions: Position[];
  
  // Actions
  fetchQuote: () => Promise<void>;
  fetchExpirations: () => Promise<void>;
  fetchOptionsChain: (expiration: string) => Promise<void>;
  fetchPositions: () => Promise<void>;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

const ApiContext = createContext<ApiContextType | null>(null);

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
}

interface ApiProviderProps {
  children: ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps) {
  const [baseUrl, setBaseUrlState] = useState('http://localhost:8000');
  const [isConnected, setIsConnected] = useState(false);
  const [symbol, setSymbol] = useState('^SPX');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [optionsChain, setOptionsChain] = useState<OptionsChain | null>(null);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [selectedExpiration, setSelectedExpiration] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create axios instance
  const api = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Load saved base URL
  useEffect(() => {
    AsyncStorage.getItem('apiBaseUrl').then((url) => {
      if (url) setBaseUrlState(url);
    });
  }, []);

  // Set base URL and save
  const setBaseUrl = useCallback(async (url: string) => {
    setBaseUrlState(url);
    await AsyncStorage.setItem('apiBaseUrl', url);
  }, []);

  // Check connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await api.get('/api/');
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };
    checkConnection();
  }, [baseUrl]);

  // Fetch quote
  const fetchQuote = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
      setQuote(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quote');
    } finally {
      setIsLoading(false);
    }
  }, [api, symbol]);

  // Fetch expirations
  const fetchExpirations = useCallback(async () => {
    try {
      const response = await api.get(`/api/options/expirations?symbol=${encodeURIComponent(symbol)}`);
      setExpirations(response.data.expirations || []);
      if (response.data.expirations?.length > 0 && !selectedExpiration) {
        setSelectedExpiration(response.data.expirations[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch expirations:', err);
    }
  }, [api, symbol, selectedExpiration]);

  // Fetch options chain
  const fetchOptionsChain = useCallback(async (expiration: string) => {
    setIsLoading(true);
    try {
      const response = await api.get(
        `/api/options/chain?symbol=${encodeURIComponent(symbol)}&expiration=${expiration}`
      );
      setOptionsChain(response.data);
    } catch (err: any) {
      console.error('Failed to fetch options chain:', err);
    } finally {
      setIsLoading(false);
    }
  }, [api, symbol]);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    try {
      const response = await api.get('/api/positions');
      setPositions(response.data);
    } catch (err: any) {
      console.error('Failed to fetch positions:', err);
    }
  }, [api]);

  // Initial data fetch
  useEffect(() => {
    if (isConnected) {
      fetchQuote();
      fetchExpirations();
      fetchPositions();
    }
  }, [isConnected, symbol]);

  // Fetch options when expiration changes
  useEffect(() => {
    if (selectedExpiration && isConnected) {
      fetchOptionsChain(selectedExpiration);
    }
  }, [selectedExpiration, isConnected]);

  return (
    <ApiContext.Provider
      value={{
        api,
        baseUrl,
        setBaseUrl,
        isConnected,
        symbol,
        setSymbol,
        quote,
        optionsChain,
        expirations,
        selectedExpiration,
        setSelectedExpiration,
        positions,
        fetchQuote,
        fetchExpirations,
        fetchOptionsChain,
        fetchPositions,
        isLoading,
        error,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
}

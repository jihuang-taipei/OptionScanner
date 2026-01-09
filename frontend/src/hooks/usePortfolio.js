import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API } from "../utils/constants";

/**
 * Custom hook for managing portfolio positions
 * Handles CRUD operations, price calculations, and position-specific options chains
 */
export const usePortfolio = (symbol, selectedExpiration, optionsChain) => {
  // Positions state
  const [positions, setPositions] = useState([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  
  // Dialog states
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [tradeDialog, setTradeDialog] = useState({ open: false, strategy: null });
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [closeDialog, setCloseDialog] = useState({ open: false, position: null });
  const [closePrice, setClosePrice] = useState("");
  
  // Position sizing
  const [maxRiskAmount, setMaxRiskAmount] = useState(1000);
  const [minRewardAmount, setMinRewardAmount] = useState(1000);
  
  // Cache for position-specific options chains
  const [positionOptionsCache, setPositionOptionsCache] = useState({});
  const fetchedExpirationsRef = useRef(new Set());

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
      await expirePositions();
      const response = await axios.get(`${API}/positions`);
      setPositions(response.data);
    } catch (e) {
      console.error("Error fetching positions:", e);
    } finally {
      setIsLoadingPositions(false);
    }
  }, [expirePositions]);

  // Fetch options chains for open positions
  const fetchPositionOptionsChains = useCallback(async (openPositions) => {
    if (!openPositions || openPositions.length === 0) return;
    
    const expirationsNeeded = new Set();
    
    openPositions
      .filter(p => p.status === 'open')
      .forEach(p => {
        if (p.strategy_type === 'calendar_spread') {
          p.legs?.forEach(leg => {
            if (leg.expiration && !fetchedExpirationsRef.current.has(leg.expiration)) {
              expirationsNeeded.add(leg.expiration);
            }
          });
        } else {
          if (p.expiration && !fetchedExpirationsRef.current.has(p.expiration)) {
            expirationsNeeded.add(p.expiration);
          }
        }
      });
    
    const uniqueExpirations = [...expirationsNeeded];
    if (uniqueExpirations.length === 0) return;
    
    uniqueExpirations.forEach(exp => fetchedExpirationsRef.current.add(exp));
    
    const newChains = {};
    
    for (const expiration of uniqueExpirations) {
      try {
        const posSymbol = openPositions.find(p => p.status === 'open')?.symbol || symbol;
        const response = await axios.get(`${API}/options/chain?symbol=${posSymbol}&expiration=${expiration}`);
        newChains[expiration] = response.data;
      } catch (e) {
        console.error(`Error fetching options chain for expiration ${expiration}:`, e);
      }
    }
    
    if (Object.keys(newChains).length > 0) {
      setPositionOptionsCache(prev => ({ ...prev, ...newChains }));
    }
  }, [symbol]);

  // Calculate current strategy price
  const calculateCurrentStrategyPrice = useCallback((position) => {
    if (!position?.legs) return null;
    
    // For calendar spreads, look up each leg's expiration separately
    if (position.strategy_type === 'calendar_spread') {
      let closePrice = 0;
      
      for (const leg of position.legs) {
        const legExpiration = leg.expiration;
        if (!legExpiration) return null;
        
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
          closePrice += currentPrice;
        } else {
          closePrice -= currentPrice;
        }
      }
      
      return closePrice;
    }
    
    // For non-calendar strategies
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
      
      if (!option) return null;
      
      const currentPrice = option.lastPrice || option.bid || 0;
      
      if (leg.action === 'sell') {
        closePrice += currentPrice;
      } else {
        closePrice -= currentPrice;
      }
    }
    
    return closePrice;
  }, [optionsChain, positionOptionsCache, selectedExpiration]);

  // Calculate P/L percentage
  const calculatePLPercent = useCallback((position, closePrice) => {
    if (closePrice === null || !position) return null;
    
    const isDebitStrategy = position.entry_price < 0;
    const entryPrice = Math.abs(position.entry_price);
    
    if (entryPrice === 0) return null;
    
    if (isDebitStrategy) {
      const currentValue = Math.abs(closePrice);
      return ((currentValue - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - closePrice) / entryPrice) * 100;
    }
  }, []);

  // Calculate hours until expiration
  const getHoursToExpiry = useCallback((position) => {
    if (!position.expiration) return null;
    
    const expDate = new Date(position.expiration + 'T16:00:00-05:00');
    const now = new Date();
    const hoursRemaining = (expDate - now) / (1000 * 60 * 60);
    
    return hoursRemaining;
  }, []);

  // Create position
  const createPosition = useCallback(async (strategy, strategyType, strategyName, legs, entryPrice, quantity) => {
    try {
      const position = {
        symbol: symbol,
        strategy_type: strategyType,
        strategy_name: strategyName,
        expiration: selectedExpiration,
        legs: legs,
        entry_price: entryPrice,
        quantity: quantity,
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
  }, [symbol, selectedExpiration, fetchPositions]);

  // Close position
  const closePosition = useCallback(async (positionId, exitPrice, notes = "") => {
    try {
      const url = notes 
        ? `${API}/positions/${positionId}/close?exit_price=${exitPrice}&notes=${encodeURIComponent(notes)}`
        : `${API}/positions/${positionId}/close?exit_price=${exitPrice}`;
      await axios.put(url);
      await fetchPositions();
      setCloseDialog({ open: false, position: null });
      setClosePrice("");
    } catch (e) {
      console.error("Error closing position:", e);
      alert("Failed to close position.");
    }
  }, [fetchPositions]);

  // Delete position
  const deletePosition = useCallback(async (positionId) => {
    if (!window.confirm("Are you sure you want to delete this position?")) return;
    try {
      await axios.delete(`${API}/positions/${positionId}`);
      await fetchPositions();
    } catch (e) {
      console.error("Error deleting position:", e);
      alert("Failed to delete position.");
    }
  }, [fetchPositions]);

  // Open trade dialog
  const handleTrade = useCallback((strategy, strategyType, strategyName, legs, entryPrice) => {
    setTradeDialog({
      open: true,
      strategy: { strategy, strategyType, strategyName, legs, entryPrice }
    });
  }, []);

  // Fetch options chains when positions change
  useEffect(() => {
    const openPositions = positions.filter(p => p.status === 'open');
    if (openPositions.length > 0) {
      fetchPositionOptionsChains(positions);
    }
  }, [positions, fetchPositionOptionsChains]);

  // Initial positions fetch
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Calculate totals
  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status === 'closed' || p.status === 'expired');
  
  const totalUnrealizedPnL = openPositions.reduce((sum, pos) => {
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

  const totalRealizedPnL = closedPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);

  return {
    // Positions
    positions,
    openPositions,
    closedPositions,
    isLoadingPositions,
    
    // Dialogs
    showPortfolio,
    setShowPortfolio,
    tradeDialog,
    setTradeDialog,
    tradeQuantity,
    setTradeQuantity,
    closeDialog,
    setCloseDialog,
    closePrice,
    setClosePrice,
    
    // Position sizing
    maxRiskAmount,
    setMaxRiskAmount,
    minRewardAmount,
    setMinRewardAmount,
    
    // Methods
    fetchPositions,
    createPosition,
    closePosition,
    deletePosition,
    handleTrade,
    calculateCurrentStrategyPrice,
    calculatePLPercent,
    getHoursToExpiry,
    
    // Totals
    totalUnrealizedPnL,
    totalRealizedPnL,
    
    // Cache
    positionOptionsCache,
  };
};

export default usePortfolio;

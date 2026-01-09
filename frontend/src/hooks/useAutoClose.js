import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API } from "../utils/constants";

/**
 * Custom hook for auto take-profit and stop-loss functionality
 * Monitors positions and automatically closes based on configured thresholds
 */
export const useAutoClose = (
  positions,
  calculateCurrentStrategyPrice,
  calculatePLPercent,
  getHoursToExpiry,
  fetchPositions
) => {
  // Auto-close settings
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(true);
  const [takeProfitPercent, setTakeProfitPercent] = useState(80);
  const [stopLossPercent, setStopLossPercent] = useState(80);
  const [closeBeforeExpiryHours, setCloseBeforeExpiryHours] = useState(0.5);
  const [autoCloseLog, setAutoCloseLog] = useState([]);
  
  // Track positions being auto-closed to prevent duplicate closes
  const autoClosingRef = useRef(new Set());

  // Auto-close position based on P/L
  const autoClosePosition = useCallback(async (position, closePrice, plPercent) => {
    try {
      const exitPrice = Math.abs(closePrice);
      const reason = plPercent >= takeProfitPercent ? 'Take Profit' : 'Stop Loss';
      const notes = `Auto-closed: ${reason} at ${plPercent.toFixed(1)}%`;
      
      await axios.put(`${API}/positions/${position.id}/close?exit_price=${exitPrice}&notes=${encodeURIComponent(notes)}`);
      
      setAutoCloseLog(prev => [...prev, {
        id: position.id,
        name: position.strategy_name,
        reason,
        plPercent: plPercent.toFixed(1),
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      await fetchPositions();
      console.log(`Auto-closed ${position.strategy_name}: ${reason} at ${plPercent.toFixed(1)}%`);
    } catch (e) {
      console.error(`Error auto-closing position ${position.strategy_name}:`, e);
    }
  }, [takeProfitPercent, fetchPositions]);

  // Auto-close position due to approaching expiration
  const autoClosePositionExpiry = useCallback(async (position, closePrice, hoursToExpiry) => {
    try {
      const exitPrice = Math.abs(closePrice);
      const notes = `Auto-closed: Expiry in ${hoursToExpiry.toFixed(1)}h (threshold: ${closeBeforeExpiryHours}h)`;
      
      await axios.put(`${API}/positions/${position.id}/close?exit_price=${exitPrice}&notes=${encodeURIComponent(notes)}`);
      
      const plPercent = calculatePLPercent(position, closePrice);
      
      setAutoCloseLog(prev => [...prev, {
        id: position.id,
        name: position.strategy_name,
        reason: `Expiry (${hoursToExpiry.toFixed(1)}h)`,
        plPercent: plPercent !== null ? plPercent.toFixed(1) : 'N/A',
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      await fetchPositions();
      console.log(`Auto-closed ${position.strategy_name}: Approaching expiry (${hoursToExpiry.toFixed(1)}h remaining)`);
    } catch (e) {
      console.error(`Error auto-closing position ${position.strategy_name}:`, e);
    }
  }, [closeBeforeExpiryHours, calculatePLPercent, fetchPositions]);

  // Effect to check and auto-close positions
  // NOTE: This effect intentionally triggers async API calls that update state
  // It's designed to auto-close positions when P/L thresholds are met
  useEffect(() => {
    if (!autoCloseEnabled || positions.length === 0) return;
    
    const openPositions = positions.filter(p => p.status === 'open');
    
    for (const position of openPositions) {
      // Skip if already being closed
      if (autoClosingRef.current.has(position.id)) continue;
      
      const closePrice = calculateCurrentStrategyPrice(position);
      if (closePrice === null) continue;
      
      const plPercent = calculatePLPercent(position, closePrice);
      
      // Check expiration time threshold first (if enabled)
      if (closeBeforeExpiryHours > 0) {
        const hoursToExpiry = getHoursToExpiry(position);
        if (hoursToExpiry !== null && hoursToExpiry > 0 && hoursToExpiry <= closeBeforeExpiryHours) {
          autoClosingRef.current.add(position.id);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          autoClosePositionExpiry(position, closePrice, hoursToExpiry).finally(() => {
            autoClosingRef.current.delete(position.id);
          });
          continue;
        }
      }
      
      if (plPercent === null) continue;
      
      // Check take profit threshold
      if (plPercent >= takeProfitPercent) {
        autoClosingRef.current.add(position.id);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        autoClosePosition(position, closePrice, plPercent).finally(() => {
          autoClosingRef.current.delete(position.id);
        });
      }
      // Check stop loss threshold
      else if (plPercent <= -stopLossPercent) {
        autoClosingRef.current.add(position.id);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        autoClosePosition(position, closePrice, plPercent).finally(() => {
          autoClosingRef.current.delete(position.id);
        });
      }
    }
  }, [
    autoCloseEnabled,
    positions,
    takeProfitPercent,
    stopLossPercent,
    closeBeforeExpiryHours,
    calculateCurrentStrategyPrice,
    calculatePLPercent,
    autoClosePosition,
    autoClosePositionExpiry,
    getHoursToExpiry
  ]);

  return {
    autoCloseEnabled,
    setAutoCloseEnabled,
    takeProfitPercent,
    setTakeProfitPercent,
    stopLossPercent,
    setStopLossPercent,
    closeBeforeExpiryHours,
    setCloseBeforeExpiryHours,
    autoCloseLog,
  };
};

export default useAutoClose;

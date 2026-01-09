import { useState, useMemo } from "react";

/**
 * Custom hook for risk management dashboard
 * Calculates portfolio risk metrics and concentration
 */
export const useRiskManagement = (positions, calculateCurrentStrategyPrice) => {
  // Trading capital (user configurable)
  const [tradingCapital, setTradingCapital] = useState(100000); // Default $100k

  // Calculate risk metrics
  const riskMetrics = useMemo(() => {
    if (!positions || positions.length === 0) {
      return {
        totalCapitalAtRisk: 0,
        maxPotentialLoss: 0,
        capitalAtRiskPercent: 0,
        openPositionValue: 0,
        marginUtilization: 0,
      };
    }
    
    const openPositions = positions.filter(p => p.status === 'open');
    
    // Calculate total capital at risk (max loss for each position)
    let totalCapitalAtRisk = 0;
    let maxPotentialLoss = 0;
    let openPositionValue = 0;
    
    openPositions.forEach(pos => {
      const isCredit = pos.entry_price > 0;
      const entryValue = Math.abs(pos.entry_price) * pos.quantity * 100;
      
      // For credit strategies, max loss is typically spread width - credit received
      // For debit strategies, max loss is the premium paid
      if (isCredit) {
        // Credit spread: estimate max loss from legs
        const legs = pos.legs || [];
        if (legs.length >= 2) {
          const strikes = legs.map(l => l.strike).sort((a, b) => a - b);
          const spreadWidth = strikes[strikes.length - 1] - strikes[0];
          const maxLoss = (spreadWidth * 100 - entryValue) * pos.quantity;
          totalCapitalAtRisk += Math.max(0, maxLoss);
          maxPotentialLoss += Math.max(0, maxLoss);
        } else {
          // Naked option - unlimited risk, estimate as 5x premium
          totalCapitalAtRisk += entryValue * 5;
          maxPotentialLoss += entryValue * 5;
        }
        openPositionValue += entryValue; // Credit received
      } else {
        // Debit strategy: max loss is premium paid
        totalCapitalAtRisk += entryValue;
        maxPotentialLoss += entryValue;
        openPositionValue -= entryValue; // Premium paid
      }
    });
    
    const capitalAtRiskPercent = tradingCapital > 0 ? (totalCapitalAtRisk / tradingCapital) * 100 : 0;
    const marginUtilization = tradingCapital > 0 ? (totalCapitalAtRisk / tradingCapital) * 100 : 0;
    
    return {
      totalCapitalAtRisk,
      maxPotentialLoss,
      capitalAtRiskPercent: Math.round(capitalAtRiskPercent * 10) / 10,
      openPositionValue,
      marginUtilization: Math.round(marginUtilization * 10) / 10,
    };
  }, [positions, tradingCapital]);

  // Position concentration by symbol
  const symbolConcentration = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    
    const openPositions = positions.filter(p => p.status === 'open');
    const symbolMap = {};
    let totalRisk = 0;
    
    openPositions.forEach(pos => {
      const symbol = pos.symbol || 'Unknown';
      const isCredit = pos.entry_price > 0;
      const entryValue = Math.abs(pos.entry_price) * pos.quantity * 100;
      
      let positionRisk = entryValue;
      if (isCredit && pos.legs?.length >= 2) {
        const strikes = pos.legs.map(l => l.strike).sort((a, b) => a - b);
        const spreadWidth = strikes[strikes.length - 1] - strikes[0];
        positionRisk = (spreadWidth * 100 - entryValue) * pos.quantity;
      }
      
      if (!symbolMap[symbol]) {
        symbolMap[symbol] = { symbol, risk: 0, positions: 0 };
      }
      symbolMap[symbol].risk += Math.max(0, positionRisk);
      symbolMap[symbol].positions += 1;
      totalRisk += Math.max(0, positionRisk);
    });
    
    return Object.values(symbolMap)
      .map(s => ({
        ...s,
        percent: totalRisk > 0 ? (s.risk / totalRisk) * 100 : 0,
      }))
      .sort((a, b) => b.risk - a.risk);
  }, [positions]);

  // Strategy type concentration
  const strategyConcentration = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    
    const openPositions = positions.filter(p => p.status === 'open');
    const strategyMap = {};
    let totalRisk = 0;
    
    openPositions.forEach(pos => {
      const stratType = pos.strategy_type || 'unknown';
      const isCredit = pos.entry_price > 0;
      const entryValue = Math.abs(pos.entry_price) * pos.quantity * 100;
      
      let positionRisk = entryValue;
      if (isCredit && pos.legs?.length >= 2) {
        const strikes = pos.legs.map(l => l.strike).sort((a, b) => a - b);
        const spreadWidth = strikes[strikes.length - 1] - strikes[0];
        positionRisk = (spreadWidth * 100 - entryValue) * pos.quantity;
      }
      
      if (!strategyMap[stratType]) {
        strategyMap[stratType] = { strategy: stratType, risk: 0, positions: 0 };
      }
      strategyMap[stratType].risk += Math.max(0, positionRisk);
      strategyMap[stratType].positions += 1;
      totalRisk += Math.max(0, positionRisk);
    });
    
    return Object.values(strategyMap)
      .map(s => ({
        ...s,
        percent: totalRisk > 0 ? (s.risk / totalRisk) * 100 : 0,
      }))
      .sort((a, b) => b.risk - a.risk);
  }, [positions]);

  // Risk alerts
  const riskAlerts = useMemo(() => {
    const alerts = [];
    
    // High capital utilization
    if (riskMetrics.capitalAtRiskPercent > 50) {
      alerts.push({
        level: 'warning',
        message: `High capital at risk: ${riskMetrics.capitalAtRiskPercent.toFixed(1)}% of trading capital`,
      });
    }
    if (riskMetrics.capitalAtRiskPercent > 80) {
      alerts.push({
        level: 'danger',
        message: `Critical: ${riskMetrics.capitalAtRiskPercent.toFixed(1)}% capital at risk - consider reducing exposure`,
      });
    }
    
    // Concentration alerts
    symbolConcentration.forEach(s => {
      if (s.percent > 50) {
        alerts.push({
          level: 'warning',
          message: `${s.symbol} concentration: ${s.percent.toFixed(1)}% of portfolio risk`,
        });
      }
    });
    
    // Single position risk
    const openPositions = positions?.filter(p => p.status === 'open') || [];
    openPositions.forEach(pos => {
      const posRisk = Math.abs(pos.entry_price) * pos.quantity * 100;
      const posRiskPercent = tradingCapital > 0 ? (posRisk / tradingCapital) * 100 : 0;
      if (posRiskPercent > 10) {
        alerts.push({
          level: 'info',
          message: `${pos.strategy_name}: ${posRiskPercent.toFixed(1)}% of capital in single position`,
        });
      }
    });
    
    return alerts;
  }, [riskMetrics, symbolConcentration, positions, tradingCapital]);

  // Days to expiration analysis
  const expirationRisk = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    
    const openPositions = positions.filter(p => p.status === 'open');
    const now = new Date();
    
    const buckets = {
      "Expiring Today": { min: 0, max: 1, positions: [], risk: 0 },
      "Within 3 Days": { min: 1, max: 3, positions: [], risk: 0 },
      "Within 1 Week": { min: 3, max: 7, positions: [], risk: 0 },
      "Within 2 Weeks": { min: 7, max: 14, positions: [], risk: 0 },
      "Within 1 Month": { min: 14, max: 30, positions: [], risk: 0 },
      "> 1 Month": { min: 30, max: Infinity, positions: [], risk: 0 },
    };
    
    openPositions.forEach(pos => {
      if (!pos.expiration) return;
      
      const expDate = new Date(pos.expiration + 'T16:00:00-05:00');
      const daysToExp = (expDate - now) / (1000 * 60 * 60 * 24);
      
      const posRisk = Math.abs(pos.entry_price) * pos.quantity * 100;
      
      for (const [label, bucket] of Object.entries(buckets)) {
        if (daysToExp >= bucket.min && daysToExp < bucket.max) {
          bucket.positions.push(pos);
          bucket.risk += posRisk;
          break;
        }
      }
    });
    
    return Object.entries(buckets).map(([label, data]) => ({
      period: label,
      count: data.positions.length,
      risk: data.risk,
    }));
  }, [positions]);

  return {
    tradingCapital,
    setTradingCapital,
    riskMetrics,
    symbolConcentration,
    strategyConcentration,
    riskAlerts,
    expirationRisk,
  };
};

export default useRiskManagement;

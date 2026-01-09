import { useState, useMemo, useCallback } from "react";

/**
 * Custom hook for trade journal and performance analytics
 * Calculates win rate, P/L by strategy type, and performance over time
 */
export const useAnalytics = (positions) => {
  const [analyticsPeriod, setAnalyticsPeriod] = useState("all"); // "7d", "30d", "90d", "all"

  // Filter positions by period
  const filteredPositions = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    
    const closedPositions = positions.filter(p => p.status === 'closed' || p.status === 'expired');
    
    if (analyticsPeriod === "all") return closedPositions;
    
    const now = new Date();
    const periodDays = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };
    
    const cutoffDate = new Date(now.getTime() - periodDays[analyticsPeriod] * 24 * 60 * 60 * 1000);
    
    return closedPositions.filter(p => {
      const closedDate = new Date(p.closed_at || p.opened_at);
      return closedDate >= cutoffDate;
    });
  }, [positions, analyticsPeriod]);

  // Calculate win rate
  const winRateStats = useMemo(() => {
    if (filteredPositions.length === 0) {
      return { wins: 0, losses: 0, winRate: 0, totalTrades: 0 };
    }
    
    const wins = filteredPositions.filter(p => (p.realized_pnl || 0) > 0).length;
    const losses = filteredPositions.filter(p => (p.realized_pnl || 0) <= 0).length;
    const winRate = (wins / filteredPositions.length) * 100;
    
    return {
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      totalTrades: filteredPositions.length,
    };
  }, [filteredPositions]);

  // P/L by strategy type
  const pnlByStrategy = useMemo(() => {
    if (filteredPositions.length === 0) return [];
    
    const strategyMap = {};
    
    filteredPositions.forEach(p => {
      const type = p.strategy_type || 'unknown';
      if (!strategyMap[type]) {
        strategyMap[type] = { type, totalPnL: 0, trades: 0, wins: 0 };
      }
      strategyMap[type].totalPnL += p.realized_pnl || 0;
      strategyMap[type].trades += 1;
      if ((p.realized_pnl || 0) > 0) strategyMap[type].wins += 1;
    });
    
    return Object.values(strategyMap).map(s => ({
      ...s,
      avgPnL: s.trades > 0 ? s.totalPnL / s.trades : 0,
      winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
    })).sort((a, b) => b.totalPnL - a.totalPnL);
  }, [filteredPositions]);

  // P/L by holding period
  const pnlByHoldingPeriod = useMemo(() => {
    if (filteredPositions.length === 0) return [];
    
    const periods = {
      "< 1 day": { min: 0, max: 1, pnl: 0, count: 0 },
      "1-3 days": { min: 1, max: 3, pnl: 0, count: 0 },
      "3-7 days": { min: 3, max: 7, pnl: 0, count: 0 },
      "1-2 weeks": { min: 7, max: 14, pnl: 0, count: 0 },
      "2-4 weeks": { min: 14, max: 28, pnl: 0, count: 0 },
      "> 4 weeks": { min: 28, max: Infinity, pnl: 0, count: 0 },
    };
    
    filteredPositions.forEach(p => {
      const openDate = new Date(p.opened_at);
      const closeDate = new Date(p.closed_at || p.opened_at);
      const holdingDays = (closeDate - openDate) / (1000 * 60 * 60 * 24);
      
      for (const [label, range] of Object.entries(periods)) {
        if (holdingDays >= range.min && holdingDays < range.max) {
          range.pnl += p.realized_pnl || 0;
          range.count += 1;
          break;
        }
      }
    });
    
    return Object.entries(periods).map(([label, data]) => ({
      period: label,
      totalPnL: data.pnl,
      trades: data.count,
      avgPnL: data.count > 0 ? data.pnl / data.count : 0,
    }));
  }, [filteredPositions]);

  // Monthly performance
  const monthlyPerformance = useMemo(() => {
    if (filteredPositions.length === 0) return [];
    
    const monthMap = {};
    
    filteredPositions.forEach(p => {
      const date = new Date(p.closed_at || p.opened_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { month: monthKey, pnl: 0, trades: 0, wins: 0 };
      }
      monthMap[monthKey].pnl += p.realized_pnl || 0;
      monthMap[monthKey].trades += 1;
      if ((p.realized_pnl || 0) > 0) monthMap[monthKey].wins += 1;
    });
    
    return Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        winRate: m.trades > 0 ? (m.wins / m.trades) * 100 : 0,
      }));
  }, [filteredPositions]);

  // Best and worst trades
  const topTrades = useMemo(() => {
    if (filteredPositions.length === 0) return { best: [], worst: [] };
    
    const sorted = [...filteredPositions].sort((a, b) => (b.realized_pnl || 0) - (a.realized_pnl || 0));
    
    return {
      best: sorted.slice(0, 5),
      worst: sorted.slice(-5).reverse(),
    };
  }, [filteredPositions]);

  // Overall stats
  const overallStats = useMemo(() => {
    if (filteredPositions.length === 0) {
      return {
        totalPnL: 0,
        avgPnL: 0,
        maxWin: 0,
        maxLoss: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
      };
    }
    
    const totalPnL = filteredPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const avgPnL = totalPnL / filteredPositions.length;
    
    const wins = filteredPositions.filter(p => (p.realized_pnl || 0) > 0);
    const losses = filteredPositions.filter(p => (p.realized_pnl || 0) < 0);
    
    const totalWins = wins.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, p) => sum + (p.realized_pnl || 0), 0));
    
    const maxWin = wins.length > 0 ? Math.max(...wins.map(p => p.realized_pnl || 0)) : 0;
    const maxLoss = losses.length > 0 ? Math.min(...losses.map(p => p.realized_pnl || 0)) : 0;
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    
    return {
      totalPnL,
      avgPnL,
      maxWin,
      maxLoss,
      avgWin,
      avgLoss,
      profitFactor: profitFactor === Infinity ? 999 : Math.round(profitFactor * 100) / 100,
    };
  }, [filteredPositions]);

  return {
    analyticsPeriod,
    setAnalyticsPeriod,
    filteredPositions,
    winRateStats,
    pnlByStrategy,
    pnlByHoldingPeriod,
    monthlyPerformance,
    topTrades,
    overallStats,
  };
};

export default useAnalytics;

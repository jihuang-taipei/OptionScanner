import { useState, useCallback, useMemo } from "react";
import { calculatePLData } from "../utils/calculations";

/**
 * Custom hook for multi-leg strategy builder
 * Allows creating custom option strategies with real-time P/L calculation
 */
export const useStrategyBuilder = (quote, optionsChain, selectedExpiration) => {
  // Builder state
  const [legs, setLegs] = useState([]);
  const [builderName, setBuilderName] = useState("");
  const [savedStrategies, setSavedStrategies] = useState([]);

  // Add a new leg
  const addLeg = useCallback((leg = null) => {
    const currentPrice = quote?.price;
    const newLeg = leg || {
      id: Date.now(),
      option_type: 'call',
      action: 'buy',
      strike: currentPrice ? Math.round(currentPrice / 5) * 5 : 6000,
      quantity: 1,
      price: 0,
    };
    setLegs(prev => [...prev, newLeg]);
  }, [quote]);

  // Update a leg
  const updateLeg = useCallback((legId, updates) => {
    setLegs(prev => prev.map(leg => 
      leg.id === legId ? { ...leg, ...updates } : leg
    ));
  }, []);

  // Remove a leg
  const removeLeg = useCallback((legId) => {
    setLegs(prev => prev.filter(leg => leg.id !== legId));
  }, []);

  // Clear all legs
  const clearLegs = useCallback(() => {
    setLegs([]);
    setBuilderName("");
  }, []);

  // Get option price from chain
  const getOptionPrice = useCallback((strike, optionType) => {
    if (!optionsChain) return 0;
    
    const chain = optionType === 'call' ? optionsChain.calls : optionsChain.puts;
    if (!chain) return 0;
    
    const option = chain.find(o => o.strike === strike);
    if (!option) return 0;
    
    // Use mid price
    const bid = option.bid || 0;
    const ask = option.ask || option.lastPrice || 0;
    return (bid + ask) / 2 || option.lastPrice || 0;
  }, [optionsChain]);

  // Auto-fill prices when legs change
  const legsWithPrices = useMemo(() => {
    return legs.map(leg => ({
      ...leg,
      price: leg.price || getOptionPrice(leg.strike, leg.option_type),
    }));
  }, [legs, getOptionPrice]);

  // Calculate net credit/debit
  const netPremium = useMemo(() => {
    let net = 0;
    legsWithPrices.forEach(leg => {
      const premium = leg.price * leg.quantity;
      if (leg.action === 'sell') {
        net += premium;
      } else {
        net -= premium;
      }
    });
    return net;
  }, [legsWithPrices]);

  // Calculate max profit/loss
  const profitLoss = useMemo(() => {
    if (legsWithPrices.length === 0) {
      return { maxProfit: 0, maxLoss: 0, breakevens: [] };
    }
    
    const currentPrice = quote?.price || 6000;
    const range = currentPrice * 0.20; // ±20% range
    const points = [];
    
    // Calculate P/L at various price points
    for (let price = currentPrice - range; price <= currentPrice + range; price += 1) {
      let pl = netPremium * 100; // Start with net premium
      
      legsWithPrices.forEach(leg => {
        let intrinsicValue = 0;
        
        if (leg.option_type === 'call') {
          intrinsicValue = Math.max(0, price - leg.strike);
        } else {
          intrinsicValue = Math.max(0, leg.strike - price);
        }
        
        const legValue = intrinsicValue * leg.quantity * 100;
        
        if (leg.action === 'buy') {
          pl += legValue;
        } else {
          pl -= legValue;
        }
      });
      
      points.push({ price: Math.round(price), pl: Math.round(pl) });
    }
    
    const pls = points.map(p => p.pl);
    const maxProfit = Math.max(...pls);
    const maxLoss = Math.min(...pls);
    
    // Find breakeven points (where P/L crosses 0)
    const breakevens = [];
    for (let i = 1; i < points.length; i++) {
      if ((points[i-1].pl < 0 && points[i].pl >= 0) || 
          (points[i-1].pl >= 0 && points[i].pl < 0)) {
        breakevens.push(points[i].price);
      }
    }
    
    return { maxProfit, maxLoss, breakevens, plData: points };
  }, [legsWithPrices, netPremium, quote?.price]);

  // Strategy classification
  const strategyType = useMemo(() => {
    if (legsWithPrices.length === 0) return 'custom';
    
    const buyCalls = legsWithPrices.filter(l => l.action === 'buy' && l.option_type === 'call');
    const sellCalls = legsWithPrices.filter(l => l.action === 'sell' && l.option_type === 'call');
    const buyPuts = legsWithPrices.filter(l => l.action === 'buy' && l.option_type === 'put');
    const sellPuts = legsWithPrices.filter(l => l.action === 'sell' && l.option_type === 'put');
    
    // Detect common strategies
    if (buyCalls.length === 1 && sellCalls.length === 1 && buyPuts.length === 0 && sellPuts.length === 0) {
      if (buyCalls[0].strike > sellCalls[0].strike) return 'bear_call_spread';
      return 'bull_call_spread';
    }
    
    if (buyPuts.length === 1 && sellPuts.length === 1 && buyCalls.length === 0 && sellCalls.length === 0) {
      if (buyPuts[0].strike < sellPuts[0].strike) return 'bull_put_spread';
      return 'bear_put_spread';
    }
    
    if (sellCalls.length === 1 && sellPuts.length === 1 && buyCalls.length === 1 && buyPuts.length === 1) {
      return 'iron_condor';
    }
    
    if (buyCalls.length === 1 && buyPuts.length === 1 && buyCalls[0].strike === buyPuts[0].strike) {
      return 'straddle';
    }
    
    if (buyCalls.length === 1 && buyPuts.length === 1) {
      return 'strangle';
    }
    
    return 'custom';
  }, [legsWithPrices]);

  // Save strategy as template
  const saveStrategy = useCallback(() => {
    if (legsWithPrices.length === 0 || !builderName) return;
    
    const strategy = {
      id: Date.now(),
      name: builderName,
      type: strategyType,
      legs: legsWithPrices.map(l => ({
        option_type: l.option_type,
        action: l.action,
        strike: l.strike,
        quantity: l.quantity,
      })),
      createdAt: new Date().toISOString(),
    };
    
    setSavedStrategies(prev => [...prev, strategy]);
    return strategy;
  }, [legsWithPrices, builderName, strategyType]);

  // Load a saved strategy
  const loadStrategy = useCallback((strategy) => {
    setBuilderName(strategy.name);
    setLegs(strategy.legs.map((l, idx) => ({
      ...l,
      id: Date.now() + idx,
      price: getOptionPrice(l.strike, l.option_type),
    })));
  }, [getOptionPrice]);

  // Delete a saved strategy
  const deleteStrategy = useCallback((strategyId) => {
    setSavedStrategies(prev => prev.filter(s => s.id !== strategyId));
  }, []);

  // Generate legs for common strategy
  const generateLeg = useCallback((type, strike, action, optionType, qty = 1) => ({
    id: Date.now() + Math.random(),
    option_type: optionType,
    action: action,
    strike: strike,
    quantity: qty,
    price: getOptionPrice(strike, optionType),
  }), [getOptionPrice]);

  // Quick add common strategies
  const addCommonStrategy = useCallback((type) => {
    const currentPrice = quote?.price;
    const atm = currentPrice ? Math.round(currentPrice / 5) * 5 : 6000;
    const width = 5;
    
    switch (type) {
      case 'bull_put':
        setLegs([
          generateLeg('bull_put', atm - width, 'sell', 'put'),
          generateLeg('bull_put', atm - width * 2, 'buy', 'put'),
        ]);
        setBuilderName(`Bull Put ${atm - width}/${atm - width * 2}`);
        break;
      case 'bear_call':
        setLegs([
          generateLeg('bear_call', atm + width, 'sell', 'call'),
          generateLeg('bear_call', atm + width * 2, 'buy', 'call'),
        ]);
        setBuilderName(`Bear Call ${atm + width}/${atm + width * 2}`);
        break;
      case 'iron_condor':
        setLegs([
          generateLeg('ic', atm - width, 'sell', 'put'),
          generateLeg('ic', atm - width * 2, 'buy', 'put'),
          generateLeg('ic', atm + width, 'sell', 'call'),
          generateLeg('ic', atm + width * 2, 'buy', 'call'),
        ]);
        setBuilderName(`Iron Condor ${atm - width * 2}/${atm - width}/${atm + width}/${atm + width * 2}`);
        break;
      case 'straddle':
        setLegs([
          generateLeg('straddle', atm, 'buy', 'call'),
          generateLeg('straddle', atm, 'buy', 'put'),
        ]);
        setBuilderName(`Straddle ${atm}`);
        break;
      case 'strangle':
        setLegs([
          generateLeg('strangle', atm + width, 'buy', 'call'),
          generateLeg('strangle', atm - width, 'buy', 'put'),
        ]);
        setBuilderName(`Strangle ${atm - width}/${atm + width}`);
        break;
      default:
        break;
    }
  }, [quote, generateLeg]);

  return {
    // State
    legs: legsWithPrices,
    builderName,
    setBuilderName,
    savedStrategies,
    
    // Actions
    addLeg,
    updateLeg,
    removeLeg,
    clearLegs,
    saveStrategy,
    loadStrategy,
    deleteStrategy,
    addCommonStrategy,
    
    // Calculated values
    netPremium,
    profitLoss,
    strategyType,
    selectedExpiration,
  };
};

export default useStrategyBuilder;

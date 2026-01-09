import { useState, useMemo } from "react";

/**
 * Custom hook for technical indicators calculations
 * Calculates MA, RSI, and MACD with configurable periods
 */
export const useTechnicalIndicators = (history) => {
  // Indicator visibility toggles
  const [showMA, setShowMA] = useState(true);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);

  // Configurable periods
  const [maShortPeriod, setMAShortPeriod] = useState(20);
  const [maLongPeriod, setMALongPeriod] = useState(50);
  const [rsiPeriod, setRSIPeriod] = useState(14);
  const [macdFast, setMACDFast] = useState(12);
  const [macdSlow, setMACDSlow] = useState(26);
  const [macdSignal, setMACDSignal] = useState(9);

  // Calculate Simple Moving Average
  const calculateSMA = (data, period) => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const avg = slice.reduce((sum, val) => sum + val, 0) / period;
        result.push(Math.round(avg * 100) / 100);
      }
    }
    return result;
  };

  // Calculate Exponential Moving Average
  const calculateEMA = (data, period) => {
    const result = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
    let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        result.push(Math.round(ema * 100) / 100);
      } else {
        ema = (data[i] - ema) * multiplier + ema;
        result.push(Math.round(ema * 100) / 100);
      }
    }
    return result;
  };

  // Calculate RSI
  const calculateRSI = (data, period) => {
    const result = [];
    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain/loss
    let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    result.push(null); // First data point has no RSI
    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push(Math.round(rsi * 100) / 100);
      } else {
        // Smoothed averages
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push(Math.round(rsi * 100) / 100);
      }
    }
    return result;
  };

  // Calculate MACD
  const calculateMACD = (data, fast, slow, signal) => {
    const emaFast = calculateEMA(data, fast);
    const emaSlow = calculateEMA(data, slow);
    
    // MACD Line = Fast EMA - Slow EMA
    const macdLine = emaFast.map((fastVal, i) => {
      if (fastVal === null || emaSlow[i] === null) return null;
      return Math.round((fastVal - emaSlow[i]) * 100) / 100;
    });

    // Signal Line = EMA of MACD Line
    const validMacd = macdLine.filter(v => v !== null);
    const signalLineValues = calculateEMA(validMacd, signal);
    
    // Map signal line back to full array
    const signalLine = [];
    let signalIdx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null) {
        signalLine.push(null);
      } else {
        signalLine.push(signalLineValues[signalIdx] || null);
        signalIdx++;
      }
    }

    // Histogram = MACD Line - Signal Line
    const histogram = macdLine.map((macd, i) => {
      if (macd === null || signalLine[i] === null) return null;
      return Math.round((macd - signalLine[i]) * 100) / 100;
    });

    return { macdLine, signalLine, histogram };
  };

  // Process history data with indicators
  const dataWithIndicators = useMemo(() => {
    if (!history || history.length === 0) return [];

    const closes = history.map(d => d.close);
    
    // Calculate all indicators
    const smaShort = calculateSMA(closes, maShortPeriod);
    const smaLong = calculateSMA(closes, maLongPeriod);
    const rsi = calculateRSI(closes, rsiPeriod);
    const { macdLine, signalLine, histogram } = calculateMACD(closes, macdFast, macdSlow, macdSignal);

    // Merge with history data
    return history.map((item, i) => ({
      ...item,
      smaShort: showMA ? smaShort[i] : null,
      smaLong: showMA ? smaLong[i] : null,
      rsi: showRSI ? rsi[i] : null,
      macd: showMACD ? macdLine[i] : null,
      macdSignal: showMACD ? signalLine[i] : null,
      macdHistogram: showMACD ? histogram[i] : null,
    }));
  }, [history, showMA, showRSI, showMACD, maShortPeriod, maLongPeriod, rsiPeriod, macdFast, macdSlow, macdSignal]);

  // Get latest indicator values for display
  const latestIndicators = useMemo(() => {
    if (dataWithIndicators.length === 0) return null;
    
    const latest = dataWithIndicators[dataWithIndicators.length - 1];
    return {
      smaShort: latest.smaShort,
      smaLong: latest.smaLong,
      rsi: latest.rsi,
      macd: latest.macd,
      macdSignal: latest.macdSignal,
      macdHistogram: latest.macdHistogram,
    };
  }, [dataWithIndicators]);

  // RSI interpretation
  const rsiSignal = useMemo(() => {
    if (!latestIndicators?.rsi) return null;
    const rsi = latestIndicators.rsi;
    if (rsi >= 70) return { status: 'overbought', color: 'text-red-400' };
    if (rsi <= 30) return { status: 'oversold', color: 'text-green-400' };
    return { status: 'neutral', color: 'text-zinc-400' };
  }, [latestIndicators]);

  // MACD interpretation
  const macdSignalStatus = useMemo(() => {
    if (!latestIndicators?.macd || !latestIndicators?.macdSignal) return null;
    const { macd, macdSignal: signal } = latestIndicators;
    if (macd > signal) return { status: 'bullish', color: 'text-green-400' };
    if (macd < signal) return { status: 'bearish', color: 'text-red-400' };
    return { status: 'neutral', color: 'text-zinc-400' };
  }, [latestIndicators]);

  return {
    // Data
    dataWithIndicators,
    latestIndicators,
    
    // Toggles
    showMA,
    setShowMA,
    showRSI,
    setShowRSI,
    showMACD,
    setShowMACD,
    
    // Configurable periods
    maShortPeriod,
    setMAShortPeriod,
    maLongPeriod,
    setMALongPeriod,
    rsiPeriod,
    setRSIPeriod,
    macdFast,
    setMACDFast,
    macdSlow,
    setMACDSlow,
    macdSignal,
    setMACDSignal,
    
    // Signals
    rsiSignal,
    macdSignalStatus,
  };
};

export default useTechnicalIndicators;

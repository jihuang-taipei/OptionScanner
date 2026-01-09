import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../utils/constants";

/**
 * Custom hook for managing options chain data and all strategies
 * Handles expirations, options chain, credit spreads, iron condors, etc.
 */
export const useOptionsData = (symbol, quote) => {
  // Options chain state
  const [expirations, setExpirations] = useState([]);
  const [selectedExpiration, setSelectedExpiration] = useState("");
  const [optionsChain, setOptionsChain] = useState(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [strikeRange, setStrikeRange] = useState(15);

  // Credit spreads state
  const [creditSpreads, setCreditSpreads] = useState(null);
  const [isLoadingSpreads, setIsLoadingSpreads] = useState(false);
  const [spreadWidth, setSpreadWidth] = useState(5);
  const [minCredit, setMinCredit] = useState(0);
  const [maxRiskReward, setMaxRiskReward] = useState(100);
  const [minProbOTM, setMinProbOTM] = useState(50);

  // Iron Condors state
  const [ironCondors, setIronCondors] = useState(null);
  const [isLoadingCondors, setIsLoadingCondors] = useState(false);
  const [minProfitProb, setMinProfitProb] = useState(50);

  // Iron Butterflies state
  const [ironButterflies, setIronButterflies] = useState(null);
  const [isLoadingButterflies, setIsLoadingButterflies] = useState(false);
  const [wingWidth, setWingWidth] = useState(30);
  const [centerRange, setCenterRange] = useState(0.5);

  // Straddle/Strangle state
  const [straddles, setStraddles] = useState(null);
  const [strangles, setStrangles] = useState(null);
  const [isLoadingStraddles, setIsLoadingStraddles] = useState(false);
  const [isLoadingStrangles, setIsLoadingStrangles] = useState(false);
  const [straddleStrangleRange, setStraddleStrangleRange] = useState(0.5);

  // Calendar spreads state
  const [calendarSpreads, setCalendarSpreads] = useState(null);
  const [calendarRange, setCalendarRange] = useState(0.5);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [farExpiration, setFarExpiration] = useState("");

  // Fetch expirations
  const fetchExpirations = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/options/expirations?symbol=${symbol}`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validExpirations = response.data.expirations.filter(exp => {
        const [year, month, day] = exp.split('-').map(Number);
        const expDate = new Date(year, month - 1, day);
        return expDate >= today;
      });
      setExpirations(validExpirations);
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

  // Fetch options chain
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

  // Fetch credit spreads
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

  // Fetch iron condors
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

  // Fetch iron butterflies
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

  // Fetch straddles
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

  // Fetch strangles
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

  // Fetch calendar spreads
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

  // Reset all data on symbol change
  const resetOptionsData = useCallback(() => {
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
  }, []);

  // Fetch expirations when symbol changes
  useEffect(() => {
    fetchExpirations();
  }, [fetchExpirations]);

  // Fetch data when expiration changes
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

  // Set far expiration automatically
  useEffect(() => {
    if (expirations.length > 1 && selectedExpiration) {
      const nearIndex = expirations.indexOf(selectedExpiration);
      if (nearIndex >= 0 && nearIndex < expirations.length - 1) {
        const nextFarIndex = nearIndex + 1;
        const farIndex = expirations.indexOf(farExpiration);
        if (!farExpiration || farIndex <= nearIndex) {
          setFarExpiration(expirations[nextFarIndex]);
        }
      }
    }
  }, [expirations, selectedExpiration, farExpiration]);

  // Fetch calendar spreads when both expirations are set
  useEffect(() => {
    if (selectedExpiration && farExpiration && selectedExpiration !== farExpiration) {
      fetchCalendarSpreads(selectedExpiration, farExpiration);
    }
  }, [selectedExpiration, farExpiration, fetchCalendarSpreads]);

  return {
    // Expirations
    expirations,
    selectedExpiration,
    setSelectedExpiration,
    farExpiration,
    setFarExpiration,
    
    // Options chain
    optionsChain,
    isLoadingOptions,
    strikeRange,
    setStrikeRange,
    
    // Credit spreads
    creditSpreads,
    isLoadingSpreads,
    spreadWidth,
    setSpreadWidth,
    minCredit,
    setMinCredit,
    maxRiskReward,
    setMaxRiskReward,
    minProbOTM,
    setMinProbOTM,
    
    // Iron condors
    ironCondors,
    isLoadingCondors,
    minProfitProb,
    setMinProfitProb,
    
    // Iron butterflies
    ironButterflies,
    isLoadingButterflies,
    wingWidth,
    setWingWidth,
    centerRange,
    setCenterRange,
    
    // Straddles/Strangles
    straddles,
    strangles,
    isLoadingStraddles,
    isLoadingStrangles,
    straddleStrangleRange,
    setStraddleStrangleRange,
    
    // Calendar spreads
    calendarSpreads,
    isLoadingCalendars,
    calendarRange,
    setCalendarRange,
    
    // Methods
    resetOptionsData,
    fetchExpirations,
  };
};

export default useOptionsData;

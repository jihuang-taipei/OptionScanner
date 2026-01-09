/**
 * Settings Context - App settings management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Settings {
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number; // seconds
  hapticFeedback: boolean;
  darkMode: boolean;
  
  // Auto close settings
  autoCloseEnabled: boolean;
  takeProfitPercent: number;
  stopLossPercent: number;
  closeBeforeExpiryHours: number;
  
  // Display settings
  showGreeks: boolean;
  defaultSymbol: string;
}

const defaultSettings: Settings = {
  autoRefreshEnabled: true,
  autoRefreshInterval: 60,
  hapticFeedback: true,
  darkMode: true,
  autoCloseEnabled: true,
  takeProfitPercent: 80,
  stopLossPercent: 80,
  closeBeforeExpiryHours: 0.5,
  showGreeks: true,
  defaultSymbol: '^SPX',
};

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('appSettings');
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

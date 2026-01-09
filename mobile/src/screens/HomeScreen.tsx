/**
 * Home Screen - Quote and price display
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useApi } from '../context/ApiContext';
import { useSettings } from '../context/SettingsContext';
import { PriceChart } from '../components/PriceChart';
import { QuoteCard } from '../components/QuoteCard';

export function HomeScreen() {
  const { symbol, setSymbol, quote, fetchQuote, isLoading, error, isConnected } = useApi();
  const { settings } = useSettings();
  const [inputSymbol, setInputSymbol] = useState(symbol);
  const [refreshing, setRefreshing] = useState(false);

  // Auto refresh
  useEffect(() => {
    if (settings.autoRefreshEnabled && isConnected) {
      const interval = setInterval(fetchQuote, settings.autoRefreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [settings.autoRefreshEnabled, settings.autoRefreshInterval, isConnected]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchQuote();
    setRefreshing(false);
  };

  const handleSymbolSubmit = () => {
    setSymbol(inputSymbol.toUpperCase());
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatChange = (change: number, percent: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  if (!isConnected) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="cloud-offline-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Not Connected</Text>
        <Text style={styles.errorText}>
          Unable to connect to the server.{'\n'}
          Check your connection settings.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#10b981"
        />
      }
    >
      {/* Symbol Input */}
      <View style={styles.symbolInputContainer}>
        <View style={styles.inputWrapper}>
          <Icon name="search" size={20} color="#71717a" style={styles.inputIcon} />
          <TextInput
            style={styles.symbolInput}
            value={inputSymbol}
            onChangeText={setInputSymbol}
            onSubmitEditing={handleSymbolSubmit}
            placeholder="Enter symbol (e.g., ^SPX, AAPL)"
            placeholderTextColor="#71717a"
            autoCapitalize="characters"
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSymbolSubmit}>
          <Icon name="arrow-forward" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {isLoading && !quote && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading quote...</Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={24} color="#ef4444" />
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      )}

      {/* Quote Display */}
      {quote && (
        <>
          {/* Main Price */}
          <View style={styles.priceContainer}>
            <Text style={styles.symbolText}>{quote.symbol}</Text>
            <Text style={styles.priceText}>${formatPrice(quote.price)}</Text>
            <View style={styles.changeContainer}>
              <Icon
                name={quote.change >= 0 ? 'arrow-up' : 'arrow-down'}
                size={16}
                color={quote.change >= 0 ? '#10b981' : '#ef4444'}
              />
              <Text
                style={[
                  styles.changeText,
                  { color: quote.change >= 0 ? '#10b981' : '#ef4444' },
                ]}
              >
                {formatChange(quote.change, quote.change_percent)}
              </Text>
            </View>
            {quote.market_state && (
              <View style={[
                styles.marketStateTag,
                { backgroundColor: quote.market_state === 'REGULAR' ? '#10b98133' : '#f59e0b33' }
              ]}>
                <Text style={[
                  styles.marketStateText,
                  { color: quote.market_state === 'REGULAR' ? '#10b981' : '#f59e0b' }
                ]}>
                  {quote.market_state === 'REGULAR' ? 'Market Open' : 'Market Closed'}
                </Text>
              </View>
            )}
          </View>

          {/* Price Chart */}
          <View style={styles.chartContainer}>
            <PriceChart symbol={symbol} />
          </View>

          {/* Quote Details */}
          <QuoteCard quote={quote} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  content: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b',
    padding: 20,
  },
  symbolInputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  inputIcon: {
    marginLeft: 12,
  },
  symbolInput: {
    flex: 1,
    height: 48,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 12,
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: '#10b981',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#71717a',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef444433',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorMessage: {
    color: '#ef4444',
    marginLeft: 12,
    flex: 1,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorText: {
    color: '#71717a',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  symbolText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  priceText: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  changeText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  marketStateTag: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  marketStateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    height: 200,
    marginBottom: 20,
  },
});

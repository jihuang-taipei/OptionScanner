/**
 * Options Chain Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useApi } from '../context/ApiContext';
import { useSettings } from '../context/SettingsContext';

type OptionType = 'calls' | 'puts';

export function OptionsChainScreen() {
  const {
    optionsChain,
    expirations,
    selectedExpiration,
    setSelectedExpiration,
    fetchOptionsChain,
    quote,
    isLoading,
  } = useApi();
  const { settings } = useSettings();
  const [optionType, setOptionType] = useState<OptionType>('calls');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOptionsChain(selectedExpiration);
    setRefreshing(false);
  };

  const options = optionType === 'calls' ? optionsChain?.calls : optionsChain?.puts;
  const currentPrice = quote?.price || 0;

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  const renderOptionRow = ({ item, index }: { item: any; index: number }) => {
    const isITM = optionType === 'calls' 
      ? item.strike < currentPrice 
      : item.strike > currentPrice;
    const isATM = Math.abs(item.strike - currentPrice) / currentPrice < 0.005;

    return (
      <View style={[
        styles.optionRow,
        isATM && styles.atmRow,
        isITM && styles.itmRow,
      ]}>
        <View style={styles.strikeCell}>
          <Text style={[styles.strikeText, isATM && styles.atmText]}>
            {formatNumber(item.strike, 0)}
          </Text>
          {isATM && <Text style={styles.atmLabel}>ATM</Text>}
        </View>
        <Text style={styles.priceCell}>${formatNumber(item.lastPrice)}</Text>
        <Text style={styles.bidAskCell}>{formatNumber(item.bid)}</Text>
        <Text style={styles.bidAskCell}>{formatNumber(item.ask)}</Text>
        <Text style={[
          styles.changeCell,
          { color: item.change >= 0 ? '#10b981' : '#ef4444' }
        ]}>
          {item.change >= 0 ? '+' : ''}{formatNumber(item.change)}
        </Text>
        <Text style={styles.ivCell}>{formatNumber(item.impliedVolatility, 1)}%</Text>
        {settings.showGreeks && (
          <>
            <Text style={styles.greekCell}>{formatNumber(item.delta, 3)}</Text>
            <Text style={styles.greekCell}>{formatNumber(item.gamma, 4)}</Text>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Expiration Picker */}
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Expiration:</Text>
        <View style={styles.picker}>
          <Picker
            selectedValue={selectedExpiration}
            onValueChange={setSelectedExpiration}
            style={styles.pickerStyle}
            dropdownIconColor="#ffffff"
          >
            {expirations.map((exp) => (
              <Picker.Item key={exp} label={exp} value={exp} color="#ffffff" />
            ))}
          </Picker>
        </View>
      </View>

      {/* Option Type Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, optionType === 'calls' && styles.toggleActive]}
          onPress={() => setOptionType('calls')}
        >
          <Text style={[styles.toggleText, optionType === 'calls' && styles.toggleTextActive]}>
            Calls
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, optionType === 'puts' && styles.toggleActive]}
          onPress={() => setOptionType('puts')}
        >
          <Text style={[styles.toggleText, optionType === 'puts' && styles.toggleTextActive]}>
            Puts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Current Price Indicator */}
      {quote && (
        <View style={styles.currentPriceContainer}>
          <Icon name="analytics" size={16} color="#10b981" />
          <Text style={styles.currentPriceText}>
            Current: ${formatNumber(currentPrice)}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.strikeCell]}>Strike</Text>
        <Text style={[styles.headerCell, styles.priceCell]}>Last</Text>
        <Text style={[styles.headerCell, styles.bidAskCell]}>Bid</Text>
        <Text style={[styles.headerCell, styles.bidAskCell]}>Ask</Text>
        <Text style={[styles.headerCell, styles.changeCell]}>Chg</Text>
        <Text style={[styles.headerCell, styles.ivCell]}>IV</Text>
        {settings.showGreeks && (
          <>
            <Text style={[styles.headerCell, styles.greekCell]}>Δ</Text>
            <Text style={[styles.headerCell, styles.greekCell]}>Γ</Text>
          </>
        )}
      </View>

      {/* Options List */}
      <FlatList
        data={options || []}
        renderItem={renderOptionRow}
        keyExtractor={(item) => `${item.strike}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
        style={styles.list}
        initialNumToRender={20}
        getItemLayout={(data, index) => ({
          length: 48,
          offset: 48 * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#27272a',
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
  },
  pickerLabel: {
    color: '#a1a1aa',
    fontSize: 14,
    marginRight: 12,
  },
  picker: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 8,
  },
  pickerStyle: {
    color: '#ffffff',
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#27272a',
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#10b981',
  },
  toggleText: {
    color: '#a1a1aa',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  currentPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#10b98120',
  },
  currentPriceText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#27272a',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
  },
  headerCell: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  atmRow: {
    backgroundColor: '#10b98115',
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  itmRow: {
    backgroundColor: '#27272a50',
  },
  strikeCell: {
    width: 70,
    flexDirection: 'column',
  },
  strikeText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  atmText: {
    color: '#10b981',
  },
  atmLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
  },
  priceCell: {
    width: 55,
    color: '#ffffff',
    fontSize: 13,
  },
  bidAskCell: {
    width: 45,
    color: '#a1a1aa',
    fontSize: 13,
  },
  changeCell: {
    width: 50,
    fontSize: 13,
  },
  ivCell: {
    width: 50,
    color: '#a1a1aa',
    fontSize: 13,
  },
  greekCell: {
    width: 45,
    color: '#71717a',
    fontSize: 12,
  },
});

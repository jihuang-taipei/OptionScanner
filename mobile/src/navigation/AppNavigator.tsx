/**
 * App Navigator - Main navigation structure
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { OptionsChainScreen } from '../screens/OptionsChainScreen';
import { StrategiesScreen } from '../screens/StrategiesScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StrategyDetailScreen } from '../screens/StrategyDetailScreen';
import { TradeScreen } from '../screens/TradeScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
            case 'Options':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Strategies':
              iconName = focused ? 'layers' : 'layers-outline';
              break;
            case 'Portfolio':
              iconName = focused ? 'briefcase' : 'briefcase-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#71717a',
        tabBarStyle: {
          backgroundColor: '#18181b',
          borderTopColor: '#27272a',
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#18181b',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Quote' }}
      />
      <Tab.Screen 
        name="Options" 
        component={OptionsChainScreen}
        options={{ title: 'Options' }}
      />
      <Tab.Screen 
        name="Strategies" 
        component={StrategiesScreen}
        options={{ title: 'Strategies' }}
      />
      <Tab.Screen 
        name="Portfolio" 
        component={PortfolioScreen}
        options={{ title: 'Portfolio' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// Main Stack Navigator
export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#18181b',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Main"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StrategyDetail"
        component={StrategyDetailScreen}
        options={{ title: 'Strategy Details' }}
      />
      <Stack.Screen
        name="Trade"
        component={TradeScreen}
        options={{ title: 'Paper Trade' }}
      />
    </Stack.Navigator>
  );
}

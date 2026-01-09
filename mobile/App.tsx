/**
 * Options Scanner - iOS App Entry Point
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import { AppNavigator } from './src/navigation/AppNavigator';
import { ApiProvider } from './src/context/ApiContext';
import { SettingsProvider } from './src/context/SettingsContext';

// Custom dark theme matching the web app
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#10b981',
    background: '#18181b',
    card: '#27272a',
    text: '#ffffff',
    border: '#3f3f46',
    notification: '#10b981',
  },
};

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ApiProvider>
            <NavigationContainer theme={CustomDarkTheme}>
              <StatusBar barStyle="light-content" backgroundColor="#18181b" />
              <AppNavigator />
            </NavigationContainer>
            <Toast />
          </ApiProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

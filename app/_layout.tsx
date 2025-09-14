// app/_layout.tsx - Minimal root layout without loading animations
import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import {
  ThemeProvider,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/lib/toastConfig';

import { UserProvider } from '@/context/UserContext';
import { BluetoothProvider } from '@/contexts/BluetoothContext';
import NetworkBanner from '@/components/NetworkBanner';
import colors from '@/theme/colors';

// Hardware back button and navigation tracking imports
import { HardwareBackProvider } from '@/lib/helpers/hardwareBackHandler';
import { NavigationTracker } from '@/lib/helpers/navigationTracker';
import { initializeNavigation } from '@/lib/helpers/navigation';

const CustomDarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: colors.background,
    card: colors.card,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function Layout() {
  
  // Initialize navigation system immediately (non-blocking)
  useEffect(() => {
    const initNavigation = async () => {
      try {
        console.log('🧭 Root Layout: Initializing navigation system...');
        await initializeNavigation();
        console.log('✅ Root Layout: Navigation system ready');
      } catch (error) {
        console.warn('⚠️ Root Layout: Navigation init warning (non-critical):', error);
      }
    };
    
    initNavigation();
  }, []);

  // No loading screen - let child layouts handle their own loading states
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <ThemeProvider value={CustomDarkTheme}>
            <UserProvider>
              <BluetoothProvider>
                {/* Hardware back button provider - ONLY hardware back handler */}
                <HardwareBackProvider options={{
                  fallbackRoute: '/(drawer)/',
                  replaceIfNoHistory: true
                }}>
                  {/* Navigation tracker - ONLY tracks route changes */}
                  <NavigationTracker fallbackRoute="/(drawer)/">
                    {/* Main app content - child layouts handle their own loading */}
                    <Slot />
                    
                    {/* Network status banner - positioned below header */}
                    <NetworkBanner headerHeight={60} />
                  </NavigationTracker>
                </HardwareBackProvider>
              </BluetoothProvider>
            </UserProvider>
          </ThemeProvider>
        </PaperProvider>
        
        {/* Toast component at the very end */}
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
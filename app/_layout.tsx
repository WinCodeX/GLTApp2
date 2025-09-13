// app/_layout.tsx - Updated with hardware back button integration
import React, { useEffect, useState } from 'react';
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
import LoadingSplashScreen from '@/components/LoadingSplashScreen';
import colors from '@/theme/colors';

// Hardware back button and navigation tracking imports
import { HardwareBackProvider } from '@/lib/helpers/hardwareBackHandler';
import { NavigationTracker, initializeNavigation } from '@/lib/helpers/navigation';

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
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('🚀 App Layout: Starting initialization...');
        
        // Initialize navigation system early in app startup
        console.log('🧭 App Layout: Initializing navigation system...');
        await initializeNavigation();
        console.log('✅ App Layout: Navigation system initialized');
        
        // Minimum time to show our custom splash screen
        const minimumSplashTime = 1800; // 1.8 seconds to ensure it's visible
        const startTime = Date.now();
        
        // Perform any app-level initialization here if needed
        // For now, just ensure minimum display time for smooth UX
        console.log('⏳ App Layout: Showing splash screen for minimum time...');
        
        // Wait for minimum splash time
        await new Promise(resolve => setTimeout(resolve, minimumSplashTime));
        
        // Ensure minimum time has passed
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minimumSplashTime) {
          const remainingTime = minimumSplashTime - elapsedTime;
          console.log(`⏳ App Layout: Waiting additional ${remainingTime}ms for smooth transition...`);
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        // Mark app as ready to proceed to drawer layout
        console.log('✅ App Layout: Initialization complete, app ready');
        setAppIsReady(true);
        
      } catch (error) {
        console.warn('⚠️ App Layout: Initialization warning (non-critical):', error);
        // Even if there's an error, mark as ready to prevent infinite loading
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Show our custom loading screen until app is ready
  if (!appIsReady) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <ThemeProvider value={CustomDarkTheme}>
            <UserProvider>
              <BluetoothProvider>
                {/* Hardware back button provider - handles phone's back button globally */}
                <HardwareBackProvider options={{
                  fallbackRoute: '/(drawer)/',
                  replaceIfNoHistory: true
                }}>
                  {/* Navigation tracker - tracks route changes and integrates with hardware back */}
                  <NavigationTracker 
                    enableHardwareBack={true}
                    fallbackRoute="/(drawer)/"
                    replaceIfNoHistory={true}
                  >
                    {/* Main app content - includes DrawerLayout and other routes */}
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
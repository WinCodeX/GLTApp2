// app/_layout.tsx - Fixed with manual splash screen control
import React, { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import {
  ThemeProvider,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/lib/toastConfig';

import { UserProvider } from '@/context/UserContext';
import { BluetoothProvider } from '@/contexts/BluetoothContext';
import NetworkBanner from '@/components/NetworkBanner';
import LoadingSplashScreen from '@/components/LoadingSplashScreen';
import colors from '@/theme/colors';

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

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors if splash screen is already hidden
});

export default function Layout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Keep splash screen visible
        await SplashScreen.preventAutoHideAsync();
        
        // Simulate minimum loading time to ensure custom splash is always visible
        // This ensures even on fast phones, users see the custom loading screen
        const minimumLoadTime = 1500; // 1.5 seconds minimum
        const startTime = Date.now();
        
        // Perform any necessary app initialization here
        // For now, we'll just wait for the minimum time
        await new Promise(resolve => setTimeout(resolve, minimumLoadTime));
        
        // Ensure we've met the minimum display time
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minimumLoadTime) {
          await new Promise(resolve => setTimeout(resolve, minimumLoadTime - elapsedTime));
        }
        
        // Mark app as ready
        setAppIsReady(true);
        
        // Small delay to ensure custom splash is rendered before hiding Expo splash
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn('Splash screen preparation error:', error);
        // Even if there's an error, mark as ready to prevent infinite loading
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      // Hide the Expo splash screen after our custom splash is ready
      const hideSplash = async () => {
        try {
          await SplashScreen.hideAsync();
          
          // Show custom splash for additional time
          setTimeout(() => {
            setShowCustomSplash(false);
          }, 800); // Show custom splash for 0.8 more seconds
          
        } catch (error) {
          console.warn('Error hiding splash screen:', error);
          setShowCustomSplash(false);
        }
      };
      
      hideSplash();
    }
  }, [appIsReady]);

  // Show custom loading screen until everything is ready
  if (!appIsReady || showCustomSplash) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <ThemeProvider value={CustomDarkTheme}>
            <UserProvider>
              <BluetoothProvider>
                {/* Main app content - includes DrawerLayout and other routes */}
                <Slot />
                
                {/* Network status banner - positioned below header */}
                <NetworkBanner headerHeight={60} />
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
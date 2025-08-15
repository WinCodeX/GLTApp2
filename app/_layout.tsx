// app/_layout.tsx
import React from 'react';
import { Slot } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import {
  ThemeProvider,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// ✅ Add Toast imports
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/lib/toastConfig';

import { UserProvider } from '@/context/UserContext';
import NetworkBanner from '@/components/NetworkBanner';
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

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <ThemeProvider value={CustomDarkTheme}>
            <UserProvider>
              {/* Main app content - includes DrawerLayout and other routes */}
              <Slot />
              
              {/* Network status banner - positioned absolutely above everything */}
              {/* Uses pointerEvents: 'box-none' so touches pass through to content below */}
              <NetworkBanner />
            </UserProvider>
          </ThemeProvider>
        </PaperProvider>
        
        {/* ✅ Toast component at the very end */}
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
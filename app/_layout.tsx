// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { Provider as PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';

import colors from '@/theme/colors';
import { UserProvider } from '@/context/UserContext';
import { bootstrapApp } from '@/lib/bootstrap';
import colors from '@/theme/colors'; // optional if you're using theme constants

SplashScreen.preventAutoHideAsync();

export default function AppLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepareApp() {
      try {
        await bootstrapApp(); // preload things here (e.g. netinfo, tokens)
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepareApp();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <PaperProvider>
      <ThemeProvider value={CustomDarkTheme}>
        <UserProvider>
          <Slot /> {/* This renders the active route */}
        </UserProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
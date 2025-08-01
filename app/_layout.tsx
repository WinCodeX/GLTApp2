// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { Slot, useRouter } from 'expo-router';
import { ThemeProvider } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';

import colors from '@/theme/colors';
import { UserProvider } from '@/context/UserContext';
import { bootstrapApp } from '@/lib/bootstrap';

SplashScreen.preventAutoHideAsync();

const CustomDarkTheme = {
  dark: true,
  colors: {
    background: colors.background,
    card: colors.card,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function AppLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function initialize() {
      try {
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        const role = await SecureStore.getItemAsync('user_role');

        const isAuthenticated = !!(authToken && userId);
        await bootstrapApp();

        if (!isAuthenticated) {
          router.replace('/login');
        } else if (role === 'admin') {
          router.replace('/admin');
        } else {
          // Let drawer routes render
        }
      } catch (err) {
        router.replace('/login');
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    initialize();
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
          <Slot /> {/* Renders the current route (drawer, admin, login, etc) */}
        </UserProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
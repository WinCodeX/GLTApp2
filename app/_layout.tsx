// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';

import { Provider as PaperProvider } from 'react-native-paper';
import {
  DarkTheme as NavigationDarkTheme,
  ThemeProvider,
} from '@react-navigation/native';

import { bootstrapApp } from '@/lib/bootstrap';
import { UserProvider } from '@/context/UserContext';
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

export default function AppLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();

    async function init() {
      console.log('🧭 AppLayout: Starting authentication...');
      try {
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        const role = await SecureStore.getItemAsync('user_role');

        const authenticated = !!(authToken && userId);
        await bootstrapApp();

        if (!authenticated) {
          console.log('❌ Not authenticated. Redirecting to login...');
          router.replace('/login');
        } else if (role === 'admin') {
          console.log('👑 Admin role. Redirecting to admin...');
          router.replace('/admin');
        } else {
          console.log('✅ Regular user. Proceeding...');
          setIsReady(true);
        }

        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('💥 Auth error:', error);
        router.replace('/login');
        await SplashScreen.hideAsync();
      }
    }

    init();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7A5AF8" />
      </View>
    );
  }

  return (
    <PaperProvider>
      <ThemeProvider value={CustomDarkTheme}>
        <UserProvider>
          <Slot />
        </UserProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Slot } from 'expo-router';
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

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    async function init() {
      console.log('🔍 RootLayout: Starting authentication check...');
      
      try {
        await SplashScreen.preventAutoHideAsync();
        
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        const role = await SecureStore.getItemAsync('user_role');

        const authenticated = !!(authToken && userId);
        await bootstrapApp();

        if (!authenticated) {
          console.log('❌ No authentication found, redirecting to /login');
          router.replace('/login');
        } else if (role === 'admin') {
          console.log('👑 Admin detected. Redirecting to /admin');
          router.replace('/admin');
        } else {
          console.log('✅ Client user authenticated.');
        }

      } catch (error) {
        console.error('❌ Initialization error:', error);
        router.replace('/login');
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    init();
  }, []);

  // Show loading screen until initialization is complete
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#007AFF" />
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
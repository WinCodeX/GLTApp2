import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Slot } from 'expo-router';

import { bootstrapApp } from '@/lib/bootstrap';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();

    async function init() {
      console.log('🔍 RootLayout: Starting authentication check...');
      try {
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        const role = await SecureStore.getItemAsync('user_role');

        const authenticated = !!(authToken && userId);
        await bootstrapApp();

        setIsAuthenticated(authenticated);
        setUserRole(role);

        if (!authenticated) {
          console.log('❌ No authentication found, redirecting to /login');
          router.replace('/login');
        } else if (role === 'admin') {
          console.log('👑 Admin detected. Redirecting to /admin');
          router.replace('/admin');
        } else {
          console.log('✅ Client user authenticated.');
        }

        setIsReady(true);
        await SplashScreen.hideAsync();

      } catch (error) {
        console.error('❌ Initialization error:', error);
        router.replace('/login');
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

  return <Slot />;
}
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, usePathname } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import {
  DarkTheme as NavigationDarkTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import {
  Feather,
  Ionicons,
  MaterialIcons,
} from '@expo/vector-icons';
import { ColorValue } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import colors from '@/theme/colors';
import CustomDrawerContent from '@/components/CustomDrawerContent';
import { UserProvider } from '@/context/UserContext';
import { bootstrapApp } from '@/lib/bootstrap';

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

const drawerIcons: Record<string, { name: string; lib: any }> = {
  index: { name: 'home', lib: Feather },
  track: { name: 'map-pin', lib: Feather },
  account: { name: 'user', lib: Feather },
  Support: { name: 'message-circle', lib: Feather },
  FAQs: { name: 'help-circle', lib: Feather },
  History: { name: 'history', lib: MaterialIcons },
  Settings: { name: 'settings-outline', lib: Ionicons },
};

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // 👈 Track current path

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();

    async function init() {
      console.log('🔍 DrawerLayout: Starting authentication check...');
      try {
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        const role = await SecureStore.getItemAsync('user_role');

        const isAuthenticated = !!(authToken && userId);
        await bootstrapApp();

        if (!isAuthenticated) {
          console.log('❌ No authentication found, redirecting to /login');
          router.replace('/login');
          return;
        }

        // ✅ Only redirect to /admin from root pages
        if (role === 'admin' && (pathname === '/' || pathname === '/index' || pathname === '/drawer')) {
          console.log('👑 Admin detected. Redirecting to /admin');
          router.replace('/admin');
          return;
        }

        console.log('✅ Client user. Staying in drawer layout.');
        setIsReady(true);
        await SplashScreen.hideAsync();

      } catch (error) {
        console.error('❌ Initialization error:', error);
        router.replace('/login');
        await SplashScreen.hideAsync();
      }
    }

    init();
  }, [pathname]); // 👈 Watch current path

  if (!isReady) return null;

  return (
    <PaperProvider>
      <ThemeProvider value={CustomDarkTheme}>
        <UserProvider>
          <Drawer
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={({ route }) => {
              const iconData = drawerIcons[route.name] || { name: 'circle', lib: Feather };
              const IconComponent = iconData.lib;

              return {
                headerShown: false,
                drawerStyle: {
                  backgroundColor: colors.background,
                  width: drawerWidth,
                },
                drawerActiveTintColor: colors.primary,
                drawerInactiveTintColor: 'white',
                drawerLabelStyle: {
                  fontSize: 16,
                  marginLeft: -10,
                },
                drawerIcon: ({ color }: { color: ColorValue }) => (
                  <IconComponent name={iconData.name} size={20} color={color} />
                ),
              };
            }}
          />
        </UserProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
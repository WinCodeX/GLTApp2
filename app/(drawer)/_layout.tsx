import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
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
  const [fallbackMode, setFallbackMode] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const router = useRouter();

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();

    async function init() {
      console.log('🔍 DrawerLayout: Starting authentication check...');
      
      try {
        // Check for stored auth tokens directly
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        
        console.log('🔑 DrawerLayout: Auth token exists:', !!authToken);
        console.log('👤 DrawerLayout: User ID exists:', !!userId);
        
        // If we have both token and user ID, consider user authenticated
        const isAuthenticated = !!(authToken && userId);
        
        // Still run bootstrap for other initialization
        const { isOffline } = await bootstrapApp();
        
        setFallbackMode(isOffline);
        setHasAccount(isAuthenticated);
        setIsReady(true);
        
        await SplashScreen.hideAsync();

        // Only redirect to login if we're sure there's no authentication
        if (!isAuthenticated) {
          console.log('❌ DrawerLayout: No authentication found, redirecting to login');
          router.replace('/login');
        } else {
          console.log('✅ DrawerLayout: User authenticated, staying in app');
        }
      } catch (error) {
        console.error('❌ DrawerLayout: Error during initialization:', error);
        setIsReady(true);
        await SplashScreen.hideAsync();
        router.replace('/login');
      }
    }

    init();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Don't render the drawer if user is not authenticated
  if (!hasAccount) {
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
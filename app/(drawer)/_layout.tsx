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
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        console.log('🔍 DrawerLayout: Starting authentication check...');
        
        // Prevent splash screen from hiding
        await SplashScreen.preventAutoHideAsync();
        
        // Bootstrap app
        await bootstrapApp();
        
        // Check authentication
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        const role = await SecureStore.getItemAsync('user_role');

        const isAuthenticated = !!(authToken && userId);

        if (!isMounted) return;

        if (!isAuthenticated) {
          console.log('❌ No authentication found, redirecting to /login');
          setShouldRedirect('/login');
        } else if (role === 'admin') {
          console.log('👑 Admin detected. Redirecting to /admin');
          setShouldRedirect('/admin');
        } else {
          console.log('✅ Client user. Staying in drawer layout.');
          setShouldRedirect(null);
        }
        
        setIsLoading(false);
        
      } catch (error) {
        console.error('❌ Initialization error:', error);
        if (isMounted) {
          setShouldRedirect('/login');
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []); // Remove pathname dependency

  // Handle redirects after component is ready
  useEffect(() => {
    if (!isLoading && shouldRedirect) {
      const redirect = async () => {
        try {
          await SplashScreen.hideAsync();
          router.replace(shouldRedirect);
        } catch (error) {
          console.error('Navigation error:', error);
        }
      };
      
      // Small delay to ensure navigation is ready
      setTimeout(redirect, 100);
    } else if (!isLoading && !shouldRedirect) {
      // No redirect needed, just hide splash
      SplashScreen.hideAsync();
    }
  }, [isLoading, shouldRedirect]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If we should redirect, show loading until redirect happens
  if (shouldRedirect) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Only render drawer if we're staying here
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
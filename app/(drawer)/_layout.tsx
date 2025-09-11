// app/(drawer)/_layout.tsx - Fixed with enhanced navigation system integration
import React, { useEffect, useState, useCallback } from 'react';
import { Dimensions, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { Drawer } from 'expo-router/drawer';
import {
  Feather,
  Ionicons,
  MaterialIcons,
} from '@expo/vector-icons';
import { ColorValue } from 'react-native';

import colors from '@/theme/colors';
import CustomDrawerContent from '@/components/CustomDrawerContent';
import { bootstrapApp } from '@/lib/bootstrap';
import api from '@/lib/api';
import LoadingSplashScreen from '@/components/LoadingSplashScreen';
import { accountManager } from '@/lib/AccountManager';

// CRITICAL: Import enhanced navigation system and tracker
import { initializeNavigation } from '@/lib/helpers/navigation';
import { NavigationTracker } from '@/lib/helpers/navigationTracker';

const drawerIcons: Record<string, { name: string; lib: any }> = {
  index: { name: 'home', lib: Feather },
  track: { name: 'map-pin', lib: Feather },
  account: { name: 'user', lib: Feather },
  business: { name: 'briefcase', lib: Feather },
  Support: { name: 'message-circle', lib: Feather },
  FAQs: { name: 'help-circle', lib: Feather },
  History: { name: 'history', lib: MaterialIcons },
  Settings: { name: 'settings-outline', lib: Ionicons },
};

type InitializationState = 'loading' | 'authenticated' | 'redirect';

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;
  const [initState, setInitState] = useState<InitializationState>('loading');
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [navigationInitialized, setNavigationInitialized] = useState(false);
  const router = useRouter();

  // CRITICAL: Initialize navigation system first and synchronously
  useEffect(() => {
    const initializeNavigationSystem = async () => {
      try {
        console.log('🚀 DrawerLayout: Initializing enhanced navigation system...');
        
        // Initialize navigation synchronously before any routing can happen
        await initializeNavigation();
        setNavigationInitialized(true);
        
        console.log('✅ DrawerLayout: Navigation system initialized successfully');
      } catch (error) {
        console.error('❌ DrawerLayout: Navigation system initialization failed:', error);
        // Continue anyway but log the error
        setNavigationInitialized(true);
      }
    };

    // Initialize immediately on mount
    initializeNavigationSystem();
  }, []);

  // Initialize app only after navigation system is ready
  const initializeApp = useCallback(async () => {
    if (!navigationInitialized) {
      console.log('⏳ DrawerLayout: Waiting for navigation system...');
      return;
    }

    try {
      console.log('🚀 DrawerLayout: Starting app initialization...');
      setInitState('loading');

      // Bootstrap the app
      const result = await bootstrapApp();
      console.log('Bootstrap result:', result);

      if (result.success) {
        if (result.user) {
          console.log('✅ DrawerLayout: User authenticated, proceeding to app');
          setInitState('authenticated');
        } else {
          console.log('🔄 DrawerLayout: No user found, redirecting to login');
          setRedirectPath('/auth/login');
          setInitState('redirect');
        }
      } else {
        console.log('🔄 DrawerLayout: Bootstrap failed, redirecting to login');
        setRedirectPath('/auth/login');
        setInitState('redirect');
      }
    } catch (error) {
      console.error('❌ DrawerLayout: App initialization failed:', error);
      setRedirectPath('/auth/login');
      setInitState('redirect');
    }
  }, [navigationInitialized]);

  // Run initialization when navigation system is ready
  useEffect(() => {
    if (navigationInitialized) {
      initializeApp();
    }
  }, [navigationInitialized, initializeApp]);

  // Handle redirects
  useEffect(() => {
    if (initState === 'redirect' && redirectPath) {
      console.log(`🔄 DrawerLayout: Redirecting to ${redirectPath}`);
      router.replace(redirectPath);
    }
  }, [initState, redirectPath, router]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && initState === 'loading') {
        console.log('📱 DrawerLayout: App became active during loading, re-initializing...');
        initializeApp();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [initState, initializeApp]);

  // Re-check authentication when drawer gains focus
  useFocusEffect(
    useCallback(() => {
      const checkAuthStatus = async () => {
        try {
          if (initState === 'authenticated') {
            const isValid = await accountManager.isTokenValid();
            if (!isValid) {
              console.log('🔒 DrawerLayout: Token invalid, redirecting to login');
              setRedirectPath('/auth/login');
              setInitState('redirect');
            }
          }
        } catch (error) {
          console.error('❌ DrawerLayout: Auth check failed:', error);
        }
      };

      checkAuthStatus();
    }, [initState])
  );

  // Show loading screen while initializing
  if (!navigationInitialized || initState === 'loading') {
    return <LoadingSplashScreen />;
  }

  // Don't render drawer if redirecting
  if (initState === 'redirect') {
    return <LoadingSplashScreen />;
  }

  // Render drawer layout with navigation tracking
  return (
    <NavigationTracker>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          drawerStyle: {
            backgroundColor: colors.background,
            width: drawerWidth,
          },
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.textSecondary,
          drawerLabelStyle: {
            fontSize: 16,
            fontWeight: '600',
            marginLeft: -10,
          },
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 20,
          },
          headerShown: false,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            title: 'Home',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.index.lib;
              return (
                <IconComponent
                  name={drawerIcons.index.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="track"
          options={{
            title: 'Track Package',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.track.lib;
              return (
                <IconComponent
                  name={drawerIcons.track.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="account"
          options={{
            title: 'Account',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.account.lib;
              return (
                <IconComponent
                  name={drawerIcons.account.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="business"
          options={{
            title: 'Business',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.business.lib;
              return (
                <IconComponent
                  name={drawerIcons.business.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="cart"
          options={{
            title: 'Cart',
            drawerIcon: ({ color, size }) => (
              <Feather name="shopping-cart" size={size} color={color as ColorValue} />
            ),
          }}
        />
        <Drawer.Screen
          name="Support"
          options={{
            title: 'Support',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.Support.lib;
              return (
                <IconComponent
                  name={drawerIcons.Support.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="FAQs"
          options={{
            title: 'FAQs',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.FAQs.lib;
              return (
                <IconComponent
                  name={drawerIcons.FAQs.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="History"
          options={{
            title: 'History',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.History.lib;
              return (
                <IconComponent
                  name={drawerIcons.History.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="Settings"
          options={{
            title: 'Settings',
            drawerIcon: ({ color, size }) => {
              const IconComponent = drawerIcons.Settings.lib;
              return (
                <IconComponent
                  name={drawerIcons.Settings.name}
                  size={size}
                  color={color as ColorValue}
                />
              );
            },
          }}
        />
        <Drawer.Screen
          name="contacts"
          options={{
            title: 'Contacts',
            drawerIcon: ({ color, size }) => (
              <Feather name="users" size={size} color={color as ColorValue} />
            ),
          }}
        />
        <Drawer.Screen
          name="findus"
          options={{
            title: 'Find Us',
            drawerIcon: ({ color, size }) => (
              <Feather name="map-pin" size={size} color={color as ColorValue} />
            ),
          }}
        />
        <Drawer.Screen
          name="BusinessDetails"
          options={{
            drawerItemStyle: { display: 'none' },
          }}
        />
      </Drawer>
    </NavigationTracker>
  );
}
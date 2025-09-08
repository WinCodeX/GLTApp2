// app/(drawer)/_layout.tsx - Using native splash screen only
import React, { useEffect, useState, useCallback } from 'react';
import { Dimensions, AppState, AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
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
import { accountManager } from '@/lib/AccountManager';

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

// Prevent auto-hide immediately when module loads
SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('Failed to prevent splash screen auto-hide:', error);
});

type InitializationState = 'loading' | 'authenticated' | 'redirect';

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;
  const [initState, setInitState] = useState<InitializationState>('loading');
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [splashHidden, setSplashHidden] = useState(false);
  const router = useRouter();

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && initState === 'loading') {
        // Re-run initialization if app becomes active while still loading
        console.log('App became active during loading, re-initializing...');
        initializeApp();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [initState]);

  // Properly hide splash screen when ready
  const hideSplashScreen = useCallback(async () => {
    if (!splashHidden) {
      try {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
        console.log('Splash screen hidden successfully');
      } catch (error) {
        console.error('Failed to hide splash screen:', error);
        setSplashHidden(true); // Set to true anyway to prevent infinite loading
      }
    }
  }, [splashHidden]);

  // Initialize the app
  const initializeApp = useCallback(async () => {
    let initializationComplete = false;
    
    try {
      console.log('DrawerLayout: Starting AccountManager-based authentication check...');
      
      // Set a maximum initialization time to prevent infinite loading
      const initTimeout = setTimeout(() => {
        if (!initializationComplete) {
          console.warn('Initialization timeout - proceeding with fallback');
          setInitState('redirect');
          setRedirectPath('/login');
        }
      }, 10000); // 10 second timeout

      try {
        await bootstrapApp();
      } catch (bootstrapError) {
        console.warn('Bootstrap warning (non-critical):', bootstrapError);
      }
      
      // Initialize AccountManager
      await accountManager.initialize();
      
      // Check for existing accounts
      const currentAccount = accountManager.getCurrentAccount();
      
      console.log('AccountManager check:', { 
        hasCurrentAccount: !!currentAccount,
        totalAccounts: accountManager.getAllAccounts().length,
        role: currentAccount?.role
      });

      if (currentAccount) {
        console.log('Found current account - checking role');
        
        if (currentAccount.role === 'admin') {
          console.log('Admin role detected, redirecting to /admin');
          setInitState('redirect');
          setRedirectPath('/admin');
        } else {
          console.log('Client role, staying in drawer layout');
          setInitState('authenticated');
          setRedirectPath(null);
        }
        
        // Verify token in background without blocking UI
        verifyTokenInBackground(currentAccount.token, currentAccount.id);
      } else {
        console.log('No current account found, redirecting to /login');
        setInitState('redirect');
        setRedirectPath('/login');
      }
      
      clearTimeout(initTimeout);
      initializationComplete = true;
      
    } catch (error) {
      console.error('Critical initialization error:', error);
      
      // Fallback check
      const hasAnyAccounts = accountManager.hasAccounts();
      
      if (hasAnyAccounts) {
        console.log('Error during init but found accounts - staying authenticated');
        setInitState('authenticated');
        setRedirectPath(null);
      } else {
        console.log('Error during init and no accounts - redirecting to login');
        setInitState('redirect');
        setRedirectPath('/login');
      }
      
      initializationComplete = true;
    }
  }, []);

  // Background token verification
  const verifyTokenInBackground = useCallback(async (token: string, userId: string) => {
    try {
      console.log('Background: Verifying token with server for user:', userId);
      await api.get('/api/v1/me');
      console.log('Background: Token verified successfully');
    } catch (verifyError) {
      console.warn('Background: Token verification failed (non-critical):', verifyError);
      if (verifyError?.response?.status === 401 || verifyError?.response?.status === 422) {
        console.log('Background: Token is invalid, removing account');
        try {
          const currentAccount = accountManager.getCurrentAccount();
          if (currentAccount && currentAccount.id === userId) {
            await accountManager.removeAccount(currentAccount.id);
            
            // Check if we still have accounts
            if (!accountManager.hasAccounts()) {
              setInitState('redirect');
              setRedirectPath('/login');
            }
          }
        } catch (removeError) {
          console.error('Failed to remove invalid account:', removeError);
        }
      }
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Handle navigation when ready
  useEffect(() => {
    if (initState === 'redirect' && redirectPath) {
      const performRedirect = async () => {
        try {
          // Small delay to ensure smooth transition
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await hideSplashScreen();
          router.replace(redirectPath);
        } catch (error) {
          console.error('Navigation error:', error);
          // Force hide splash screen even on error
          await hideSplashScreen();
        }
      };
      
      performRedirect();
    } else if (initState === 'authenticated') {
      // Hide splash screen when authentication is complete
      hideSplashScreen();
    }
  }, [initState, redirectPath, router, hideSplashScreen]);

  // Use focus effect to ensure proper state on screen focus
  useFocusEffect(
    useCallback(() => {
      // If we're still loading and screen gains focus, ensure we have proper state
      if (initState === 'loading') {
        console.log('Screen focused during loading state');
      }
    }, [initState])
  );

  // Don't render anything during loading or redirect - let splash screen handle it
  if (initState === 'loading' || initState === 'redirect') {
    return null;
  }

  // Only render drawer when authenticated and ready
  if (initState === 'authenticated') {
    return (
      <Drawer
        drawerContent={(props) => 
          <CustomDrawerContent {...props} />
        }
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
    );
  }

  // Fallback - should never reach here
  return null;
}
// app/(drawer)/_layout.tsx - Fixed with proper navigation system integration
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
// IMPORTANT: Import the enhanced navigation system
import { initializeNavigation, NavigationHelper } from '@/lib/helpers/navigation';

const drawerIcons: Record<string, { name: string; lib: any }> = {
  index: { name: 'home', lib: Feather },
  track: { name: 'map-pin', lib: Feather },
  account: { name: 'user', lib: Feather },
  business: { name: 'briefcase', lib: Feather },
  support: { name: 'message-circle', lib: Feather },
  faqs: { name: 'help-circle', lib: Feather },
  history: { name: 'history', lib: MaterialIcons },
  settings: { name: 'settings-outline', lib: Ionicons },
  findus: { name: 'location-on', lib: MaterialIcons },
  contact: { name: 'user', lib: Feather },
};

type InitializationState = 'loading' | 'authenticated' | 'redirect';

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;
  const [initState, setInitState] = useState<InitializationState>('loading');
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [navigationInitialized, setNavigationInitialized] = useState(false);
  const router = useRouter();

  // Initialize navigation system first
  useEffect(() => {
    const initializeNavigationSystem = async () => {
      try {
        console.log('🚀 DrawerLayout: Initializing enhanced navigation system...');
        await initializeNavigation();
        setNavigationInitialized(true);
        console.log('✅ DrawerLayout: Navigation system initialized successfully');
      } catch (error) {
        console.error('❌ DrawerLayout: Navigation system initialization failed:', error);
        // Continue anyway - fallback to basic navigation
        setNavigationInitialized(true);
      }
    };

    initializeNavigationSystem();
  }, []);

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

  // Initialize the app - only after navigation system is ready
  const initializeApp = useCallback(async () => {
    // Wait for navigation system to be initialized first
    if (!navigationInitialized) {
      console.log('⏳ DrawerLayout: Waiting for navigation system to initialize...');
      return;
    }

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
          console.log('Admin role detected, redirecting to admin');
          setInitState('redirect');
          setRedirectPath('/admin');
        } else {
          console.log('Client role, staying in drawer layout');
          setInitState('authenticated');
          setRedirectPath(null);
          
          // FIXED: Track the home screen as the initial route in navigation system
          setTimeout(async () => {
            try {
              await NavigationHelper.trackRouteChange('/', {});
              console.log('✅ DrawerLayout: Home screen tracked in navigation system');
            } catch (error) {
              console.error('❌ DrawerLayout: Failed to track home screen:', error);
            }
          }, 1000);
        }
        
        // Verify token in background without blocking UI
        verifyTokenInBackground(currentAccount.token, currentAccount.id);
      } else {
        console.log('No current account found, redirecting to login');
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
        
        // Track home screen even in error case
        setTimeout(async () => {
          try {
            await NavigationHelper.trackRouteChange('/', {});
            console.log('✅ DrawerLayout: Home screen tracked in navigation system (error recovery)');
          } catch (error) {
            console.error('❌ DrawerLayout: Failed to track home screen in error recovery:', error);
          }
        }, 1000);
      } else {
        console.log('Error during init and no accounts - redirecting to login');
        setInitState('redirect');
        setRedirectPath('/login');
      }
      
      initializationComplete = true;
    }
  }, [navigationInitialized]);

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

  // Initialize app only when navigation system is ready
  useEffect(() => {
    if (navigationInitialized) {
      initializeApp();
    }
  }, [navigationInitialized, initializeApp]);

  // FIXED: Handle navigation when ready with proper route names
  useEffect(() => {
    if (initState === 'redirect' && redirectPath) {
      const performRedirect = async () => {
        try {
          console.log(`🧭 DrawerLayout: Redirecting to ${redirectPath}`);
          
          // Small delay to ensure smooth transition
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // FIXED: Use correct route paths that match your file structure
          if (redirectPath === '/login') {
            // Navigate to login screen - adjust path to match your actual login route
            router.replace('/login');
          } else if (redirectPath === '/admin') {
            // Navigate to admin screen - adjust path to match your actual admin route
            router.replace('/admin');
          } else {
            // Fallback to provided path
            router.replace(redirectPath);
          }
          
          console.log(`✅ DrawerLayout: Successfully redirected to ${redirectPath}`);
        } catch (error) {
          console.error('❌ DrawerLayout: Navigation error:', error);
          
          // Ultimate fallback - try to navigate to home
          try {
            console.log('🧭 DrawerLayout: Attempting fallback navigation to home');
            router.replace('/');
          } catch (fallbackError) {
            console.error('❌ DrawerLayout: Fallback navigation also failed:', fallbackError);
          }
        }
      };
      
      performRedirect();
    }
  }, [initState, redirectPath, router]);

  // Use focus effect to ensure proper state on screen focus
  useFocusEffect(
    useCallback(() => {
      // If we're still loading and screen gains focus, ensure we have proper state
      if (initState === 'loading') {
        console.log('Screen focused during loading state');
      } else if (initState === 'authenticated') {
        // FIXED: Ensure home screen is always tracked when drawer layout gains focus
        setTimeout(async () => {
          try {
            const currentRoute = NavigationHelper.getCurrentRoute();
            if (!currentRoute || currentRoute === null) {
              await NavigationHelper.trackRouteChange('/', {});
              console.log('✅ DrawerLayout: Home screen re-tracked on focus');
            }
          } catch (error) {
            console.error('❌ DrawerLayout: Failed to re-track home screen on focus:', error);
          }
        }, 500);
      }
    }, [initState])
  );

  // Show loading while navigation system initializes
  if (!navigationInitialized) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  // Always show loading screen during initialization
  if (initState === 'loading') {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  // Show loading screen during redirect
  if (initState === 'redirect') {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  // Only render drawer when authenticated and navigation is ready
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

  // Fallback loading screen
  return <LoadingSplashScreen backgroundColor={colors.background} />;
}
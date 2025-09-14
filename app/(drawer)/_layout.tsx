// app/(drawer)/_layout.tsx - Session-first authentication with proper login redirects
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
import { NavigationHelper } from '@/lib/helpers/navigation';

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
  cart: { name: 'shopping-cart', lib: Feather },
};

type AuthState = 'loading' | 'authenticated' | 'redirect_admin' | 'redirect_login';

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;
  const [authState, setAuthState] = useState<AuthState>('loading');
  const router = useRouter();

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && authState === 'loading') {
        console.log('App became active during loading, re-initializing...');
        performSessionValidation();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [authState]);

  // Session validation with proper error handling
  const performSessionValidation = useCallback(async () => {
    try {
      console.log('🔐 DrawerLayout: Starting session validation...');
      
      // Quick initial setup
      try {
        await bootstrapApp();
      } catch (bootstrapError) {
        console.warn('Bootstrap warning (continuing):', bootstrapError);
      }
      
      // Initialize AccountManager
      await accountManager.initialize();
      
      // Check for existing accounts
      const currentAccount = accountManager.getCurrentAccount();
      
      console.log('Session check:', { 
        hasCurrentAccount: !!currentAccount,
        totalAccounts: accountManager.getAllAccounts().length,
        role: currentAccount?.role,
        userId: currentAccount?.id
      });

      if (!currentAccount) {
        console.log('🔐 No current account found - redirecting to login');
        setAuthState('redirect_login');
        return;
      }

      // CRITICAL: Verify token with server before proceeding
      console.log('🔐 Verifying session token with server...');
      
      try {
        const response = await api.get('/api/v1/me');
        console.log('🔐 Session token verified successfully:', {
          userId: response.data?.id,
          role: response.data?.role
        });
        
        // Token is valid - check role routing
        if (currentAccount.role === 'admin') {
          console.log('🔐 Admin role detected - redirecting to admin panel');
          setAuthState('redirect_admin');
        } else {
          console.log('🔐 Client role - entering drawer layout');
          setAuthState('authenticated');
          
          // Track home screen in navigation system
          setTimeout(async () => {
            try {
              await NavigationHelper.trackRouteChange('/', {});
              console.log('✅ Home screen tracked in navigation system');
            } catch (error) {
              console.error('❌ Failed to track home screen:', error);
            }
          }, 1000);
        }
        
      } catch (tokenError) {
        console.error('🔐 Session token verification failed:', tokenError);
        
        // Token is invalid/expired - clean up and redirect to login
        if (tokenError?.response?.status === 401 || 
            tokenError?.response?.status === 422 ||
            tokenError?.response?.status === 403) {
          
          console.log('🔐 Token expired/invalid - cleaning up and redirecting to login');
          
          // Clean up invalid session
          try {
            await accountManager.removeAccount(currentAccount.id);
            console.log('🔐 Invalid account removed from storage');
          } catch (cleanupError) {
            console.warn('Cleanup warning:', cleanupError);
          }
          
          setAuthState('redirect_login');
          
        } else {
          // Network or other error - allow temporary access but log issue
          console.warn('🔐 Network error during token verification - allowing temporary access');
          console.warn('Error details:', tokenError.message);
          
          if (currentAccount.role === 'admin') {
            setAuthState('redirect_admin');
          } else {
            setAuthState('authenticated');
          }
        }
      }
      
    } catch (error) {
      console.error('🔐 Critical session validation error:', error);
      
      // Critical error - redirect to login for safety
      console.log('🔐 Critical error - redirecting to login for security');
      setAuthState('redirect_login');
    }
  }, []);

  // Start session validation immediately
  useEffect(() => {
    // Small delay to ensure smooth initial render
    const timer = setTimeout(() => {
      performSessionValidation();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [performSessionValidation]);

  // Handle redirections when auth state changes
  useEffect(() => {
    const handleRedirection = async () => {
      if (authState === 'redirect_admin') {
        try {
          console.log('🧭 Redirecting to admin panel...');
          await new Promise(resolve => setTimeout(resolve, 200)); // Smooth transition
          router.replace('/admin');
          console.log('✅ Successfully redirected to admin panel');
        } catch (error) {
          console.error('❌ Admin redirect failed:', error);
          // Fallback to login on navigation error
          setAuthState('redirect_login');
        }
      } else if (authState === 'redirect_login') {
        try {
          console.log('🧭 Redirecting to login...');
          await new Promise(resolve => setTimeout(resolve, 200)); // Smooth transition
          router.replace('/login');
          console.log('✅ Successfully redirected to login');
        } catch (error) {
          console.error('❌ Login redirect failed:', error);
          // Try alternative login routes
          try {
            router.replace('/auth/login');
          } catch (altError) {
            console.error('❌ Alternative login redirect also failed:', altError);
          }
        }
      }
    };

    if (authState === 'redirect_admin' || authState === 'redirect_login') {
      handleRedirection();
    }
  }, [authState, router]);

  // Ensure proper state on screen focus
  useFocusEffect(
    useCallback(() => {
      if (authState === 'authenticated') {
        // Ensure home screen tracking when drawer gains focus
        setTimeout(async () => {
          try {
            const currentRoute = NavigationHelper.getCurrentRoute();
            if (!currentRoute || currentRoute === null) {
              await NavigationHelper.trackRouteChange('/', {});
              console.log('✅ Home screen re-tracked on focus');
            }
          } catch (error) {
            console.error('❌ Failed to re-track home screen on focus:', error);
          }
        }, 500);
      }
    }, [authState])
  );

  // Show loading screen during initial validation or redirects
  if (authState === 'loading' || authState === 'redirect_admin' || authState === 'redirect_login') {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  // Render drawer only when properly authenticated
  if (authState === 'authenticated') {
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

  // Fallback loading screen (should never reach here)
  return <LoadingSplashScreen backgroundColor={colors.background} />;
}
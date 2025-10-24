// app/(drawer)/_layout.tsx - Fixed role detection logic and removed non-existent NavigationHelper calls
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Dimensions } from 'react-native';

import {
  Feather,
  Ionicons,
  MaterialIcons,
} from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import { ColorValue } from 'react-native';

import CustomDrawerContent from '@/components/CustomDrawerContent';
import LoadingSplashScreen from '@/components/LoadingSplashScreen';
import { accountManager } from '@/lib/AccountManager';
import api from '@/lib/api';
import { bootstrapApp } from '@/lib/bootstrap';
import colors from '@/theme/colors';

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

type AuthState = 'loading' | 'authenticated' | 'redirect_admin' | 'redirect_support' | 'redirect_agent' | 'redirect_rider' | 'redirect_login';

// Helper function to determine effective role from user data - FIXED
const getEffectiveRole = (userData: any): string => {
  // First priority: use primary_role if it exists
  if (userData.primary_role) {
    return userData.primary_role;
  }
  
  if (userData.roles && Array.isArray(userData.roles)) {
    // Priority order: admin > support > agent > rider > client
    if (userData.roles.includes('admin')) {
      return 'admin';
    }
    if (userData.roles.includes('support')) {
      return 'support';
    }
    if (userData.roles.includes('agent')) {
      return 'agent';
    }
    if (userData.roles.includes('rider')) {
      return 'rider';
    }
  }
  
  return userData.role || 'client';
};

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [lastAccountId, setLastAccountId] = useState<string | null>(null);
  const router = useRouter();
  const segments = useSegments();

  // Monitor for account changes
  useEffect(() => {
    const checkAccountChange = async () => {
      const currentAccount = accountManager.getCurrentAccount();
      const currentId = currentAccount?.id;
      
      if (currentId && lastAccountId && currentId !== lastAccountId) {
        console.log('🔄 Account change detected:', {
          previous: lastAccountId,
          current: currentId,
          role: currentAccount?.role
        });
        
        // Account was switched, re-validate session
        setAuthState('loading');
        setLastAccountId(currentId);
        await performSessionValidation();
      } else if (currentId && !lastAccountId) {
        // First load
        setLastAccountId(currentId);
      }
    };

    checkAccountChange();
  }, [segments, lastAccountId]);

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

  const performSessionValidation = useCallback(async () => {
    try {
      console.log('🔐 DrawerLayout: Starting session validation...');
      
      try {
        await bootstrapApp();
      } catch (bootstrapError) {
        console.warn('Bootstrap warning (continuing):', bootstrapError);
      }
      
      // CRITICAL: Initialize AccountManager first
      await accountManager.initialize();
      
      const currentAccount = accountManager.getCurrentAccount();
      
      // Update last account ID
      if (currentAccount?.id) {
        setLastAccountId(currentAccount.id);
      }
      
      console.log('🔐 Account state:', {
        hasAccount: !!currentAccount,
        accountId: currentAccount?.id,
        email: currentAccount?.email,
        storedRole: currentAccount?.role,
        totalAccounts: accountManager.getAllAccounts().length
      });

      if (!currentAccount) {
        console.log('🔐 No current account - redirecting to login');
        setAuthState('redirect_login');
        return;
      }

      const storedRole = currentAccount.role;
      console.log('🔐 Stored role from account:', storedRole);

      // Verify token with server
      console.log('🔐 Verifying session token with server...');
      
      try {
        const response = await api.get('/api/v1/me');
        
        const userData = response.data?.user || response.data;
        
        console.log('🔐 Server verification successful:', {
          userId: userData?.id,
          serverPrimaryRole: userData?.primary_role,
          serverRoles: userData?.roles
        });
        
        const effectiveRole = getEffectiveRole(userData);
        console.log('🔐 Effective role from server:', effectiveRole);
        
        // Update account if server role differs
        if (storedRole !== effectiveRole) {
          console.log('🔐 Role mismatch - updating:', {
            stored: storedRole,
            server: effectiveRole
          });
          
          try {
            await accountManager.updateAccountRole(currentAccount.id, effectiveRole);
            console.log('✅ Account role updated successfully');
            
            routeBasedOnRole(effectiveRole);
          } catch (updateError) {
            console.error('❌ Failed to update account role:', updateError);
            routeBasedOnRole(effectiveRole);
          }
        } else {
          console.log('✅ Role matches - no update needed');
          routeBasedOnRole(effectiveRole);
        }
        
      } catch (tokenError: any) {
        console.error('🔐 Session token verification failed:', tokenError);
        
        // Token is invalid/expired
        if (tokenError?.response?.status === 401 || 
            tokenError?.response?.status === 422 ||
            tokenError?.response?.status === 403) {
          
          console.log('🔐 Token expired/invalid - cleaning up');
          
          try {
            await accountManager.removeAccount(currentAccount.id);
            console.log('🔐 Invalid account removed');
          } catch (cleanupError) {
            console.warn('Cleanup warning:', cleanupError);
          }
          
          setAuthState('redirect_login');
          
        } else {
          // Network error - use stored role as fallback
          console.warn('🔐 Network error - using stored role as fallback');
          console.warn('Error details:', tokenError.message);
          console.log('🔐 Fallback to stored role:', storedRole);
          
          routeBasedOnRole(storedRole);
        }
      }
      
    } catch (error) {
      console.error('🔐 Critical session validation error:', error);
      
      // Last resort fallback
      try {
        const currentAccount = accountManager.getCurrentAccount();
        if (currentAccount) {
          console.log('🔐 Using emergency fallback with role:', currentAccount.role);
          routeBasedOnRole(currentAccount.role);
          return;
        }
      } catch (fallbackError) {
        console.error('🔐 Fallback also failed:', fallbackError);
      }
      
      console.log('🔐 All fallbacks failed - redirecting to login');
      setAuthState('redirect_login');
    }
  }, []);

  // Routing logic based on role
  const routeBasedOnRole = (role: string) => {
    console.log('🧭 Routing based on role:', role);
    
    if (role === 'admin') {
      console.log('🧭 Admin role - redirecting to admin panel');
      setAuthState('redirect_admin');
    } else if (role === 'support') {
      console.log('🧭 Support role - redirecting to support panel');
      setAuthState('redirect_support');
    } else if (role === 'agent') {
      console.log('🧭 Agent role - redirecting to agent panel');
      setAuthState('redirect_agent');
    } else if (role === 'rider') {
      console.log('🧭 Rider role - redirecting to rider panel');
      setAuthState('redirect_rider');
    } else {
      console.log('🧭 Client role - entering drawer layout');
      setAuthState('authenticated');
      
      // FIXED: Removed NavigationHelper.trackRouteChange call as it doesn't exist
      console.log('✅ Home screen ready');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSessionValidation();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [performSessionValidation]);

  useEffect(() => {
    const handleRedirection = async () => {
      if (authState === 'redirect_admin') {
        try {
          console.log('🧭 Redirecting to admin panel...');
          await new Promise(resolve => setTimeout(resolve, 200));
          router.replace('/admin');
          console.log('✅ Redirected to admin panel');
        } catch (error) {
          console.error('❌ Admin redirect failed:', error);
          setAuthState('redirect_login');
        }
      } else if (authState === 'redirect_support') {
        try {
          console.log('🧭 Redirecting to support panel...');
          await new Promise(resolve => setTimeout(resolve, 200));
          router.replace('/(support)');
          console.log('✅ Redirected to support panel');
        } catch (error) {
          console.error('❌ Support redirect failed:', error);
          setAuthState('redirect_login');
        }
      } else if (authState === 'redirect_agent') {
        try {
          console.log('🧭 Redirecting to agent panel...');
          await new Promise(resolve => setTimeout(resolve, 200));
          router.replace('/(agent)');
          console.log('✅ Redirected to agent panel');
        } catch (error) {
          console.error('❌ Agent redirect failed:', error);
          setAuthState('redirect_login');
        }
      } else if (authState === 'redirect_rider') {
        try {
          console.log('🧭 Redirecting to rider panel...');
          await new Promise(resolve => setTimeout(resolve, 200));
          router.replace('/(rider)');
          console.log('✅ Redirected to rider panel');
        } catch (error) {
          console.error('❌ Rider redirect failed:', error);
          setAuthState('redirect_login');
        }
      } else if (authState === 'redirect_login') {
        try {
          console.log('🧭 Redirecting to login...');
          await new Promise(resolve => setTimeout(resolve, 200));
          router.replace('/login');
          console.log('✅ Redirected to login');
        } catch (error) {
          console.error('❌ Login redirect failed:', error);
          try {
            router.replace('/auth/login');
          } catch (altError) {
            console.error('❌ Alternative login redirect also failed:', altError);
          }
        }
      }
    };

    if (authState.startsWith('redirect_')) {
      handleRedirection();
    }
  }, [authState, router]);

  // FIXED: Removed NavigationHelper.getCurrentRoute call as it doesn't exist
  useFocusEffect(
    useCallback(() => {
      if (authState === 'authenticated') {
        console.log('✅ Home screen focused and ready');
      }
    }, [authState])
  );

  if (authState === 'loading' || authState.startsWith('redirect_')) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

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

  return <LoadingSplashScreen backgroundColor={colors.background} />;
}
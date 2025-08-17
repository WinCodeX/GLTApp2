import React, { useEffect, useState } from 'react';
import { Dimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

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
import LoadingSplashScreen from '@/components/LoadingSplashScreen'; // Import the new splash screen

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
        console.log('🔍 DrawerLayout: Starting offline-first authentication check...');
        
        // Prevent splash screen from hiding
        await SplashScreen.preventAutoHideAsync();
        
        // Bootstrap app (non-blocking)
        try {
          await bootstrapApp();
        } catch (bootstrapError) {
          console.warn('⚠️ Bootstrap warning (non-critical):', bootstrapError);
        }
        
        // OFFLINE-FIRST AUTH: Check stored tokens immediately
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        const role = await SecureStore.getItemAsync('user_role');

        console.log('🔑 Stored auth check:', { 
          hasToken: !!authToken, 
          hasUserId: !!userId, 
          role 
        });

        if (!isMounted) return;

        // If we have stored credentials, trust them and redirect immediately
        if (authToken && userId) {
          console.log('✅ Found stored credentials - redirecting immediately');
          
          if (role === 'admin') {
            console.log('👑 Admin role detected, redirecting to /admin');
            setShouldRedirect('/admin');
          } else {
            console.log('👤 Client role, staying in drawer layout');
            setShouldRedirect(null);
          }
          
          // Background server verification (non-blocking)
          verifyTokenInBackground(authToken);
        } else {
          console.log('❌ No stored credentials found, redirecting to /login');
          setShouldRedirect('/login');
        }
        
        setIsLoading(false);
        
      } catch (error) {
        console.error('❌ Critical initialization error:', error);
        if (isMounted) {
          // Even on error, don't assume we need to login - check tokens
          try {
            const authToken = await SecureStore.getItemAsync('auth_token');
            const userId = await SecureStore.getItemAsync('user_id');
            
            if (authToken && userId) {
              console.log('🔑 Error during init but found tokens - staying authenticated');
              setShouldRedirect(null);
            } else {
              console.log('❌ Error during init and no tokens - redirecting to login');
              setShouldRedirect('/login');
            }
          } catch (tokenError) {
            console.error('❌ Failed to check tokens after error:', tokenError);
            setShouldRedirect('/login');
          }
          
          setIsLoading(false);
        }
      }
    }

    // Background server verification (doesn't affect UI)
    async function verifyTokenInBackground(token: string) {
      try {
        console.log('🔍 Background: Verifying token with server...');
        await api.get('/api/v1/me');
        console.log('✅ Background: Token verified successfully');
      } catch (verifyError) {
        console.warn('⚠️ Background: Token verification failed (non-critical):', verifyError);
        // NOTE: We do NOT clear tokens here - user stays logged in
        // Only clear tokens if we get a specific 401 unauthorized response
        if (verifyError?.response?.status === 401) {
          console.log('🔑 Background: Token is invalid (401), clearing...');
          try {
            await SecureStore.deleteItemAsync('auth_token');
            await SecureStore.deleteItemAsync('user_id');
            await SecureStore.deleteItemAsync('user_role');
            
            // Only redirect if we're still mounted and showing the drawer
            if (isMounted && !shouldRedirect) {
              setShouldRedirect('/login');
            }
          } catch (clearError) {
            console.error('❌ Failed to clear invalid tokens:', clearError);
          }
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []); // Remove any dependencies to prevent loops

  // Handle redirects after component is ready
  useEffect(() => {
    if (!isLoading && shouldRedirect) {
      const redirect = async () => {
        try {
          await SplashScreen.hideAsync();
          router.replace(shouldRedirect);
        } catch (error) {
          console.error('❌ Navigation error:', error);
          // Fallback: hide splash screen anyway
          try {
            await SplashScreen.hideAsync();
          } catch (splashError) {
            console.error('❌ Failed to hide splash screen:', splashError);
          }
        }
      };
      
      // Small delay to ensure navigation is ready
      const timeoutId = setTimeout(redirect, 100);
      return () => clearTimeout(timeoutId);
    } else if (!isLoading && !shouldRedirect) {
      // No redirect needed, just hide splash
      SplashScreen.hideAsync().catch(console.error);
    }
  }, [isLoading, shouldRedirect, router]);

  // Show custom loading splash while checking auth
  if (isLoading) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  // If we should redirect, show custom loading splash until redirect happens
  if (shouldRedirect) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  // Only render drawer if we're staying here (authenticated client)
  // ✅ FIXED: Removed duplicate providers - they're already in main _layout.tsx
  // This prevents provider conflicts and ensures single source of truth
  return (
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
  );
}
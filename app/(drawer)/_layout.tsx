// app/(drawer)/_layout.tsx - Clean version without modals
import React, { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';

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

const drawerIcons: Record<string, { name: string; lib: any }> = {
  index: { name: 'home', lib: Feather },
  track: { name: 'map-pin', lib: Feather },
  account: { name: 'user', lib: Feather },
  business: { name: 'briefcase', lib: Feather }, // ✅ Added business route
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
        console.log('DrawerLayout: Starting AccountManager-based authentication check...');
        
        await SplashScreen.preventAutoHideAsync();
        
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

        if (!isMounted) return;

        if (currentAccount) {
          console.log('Found current account - redirecting immediately');
          
          if (currentAccount.role === 'admin') {
            console.log('Admin role detected, redirecting to /admin');
            setShouldRedirect('/admin');
          } else {
            console.log('Client role, staying in drawer layout');
            setShouldRedirect(null);
          }
          
          // Verify token in background without blocking UI
          verifyTokenInBackground(currentAccount.token, currentAccount.id);
        } else {
          console.log('No current account found, redirecting to /login');
          setShouldRedirect('/login');
        }
        
        setIsLoading(false);
        
      } catch (error) {
        console.error('Critical initialization error:', error);
        if (isMounted) {
          // Fallback check
          const hasAnyAccounts = accountManager.hasAccounts();
          
          if (hasAnyAccounts) {
            console.log('Error during init but found accounts - staying authenticated');
            setShouldRedirect(null);
          } else {
            console.log('Error during init and no accounts - redirecting to login');
            setShouldRedirect('/login');
          }
          
          setIsLoading(false);
        }
      }
    }

    async function verifyTokenInBackground(token: string, userId: string) {
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
              if (!accountManager.hasAccounts() && isMounted && !shouldRedirect) {
                setShouldRedirect('/login');
              }
            }
          } catch (removeError) {
            console.error('Failed to remove invalid account:', removeError);
          }
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && shouldRedirect) {
      const redirect = async () => {
        try {
          await SplashScreen.hideAsync();
          router.replace(shouldRedirect);
        } catch (error) {
          console.error('Navigation error:', error);
          try {
            await SplashScreen.hideAsync();
          } catch (splashError) {
            console.error('Failed to hide splash screen:', splashError);
          }
        }
      };
      
      const timeoutId = setTimeout(redirect, 100);
      return () => clearTimeout(timeoutId);
    } else if (!isLoading && !shouldRedirect) {
      SplashScreen.hideAsync().catch(console.error);
    }
  }, [isLoading, shouldRedirect, router]);

  if (isLoading) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

  if (shouldRedirect) {
    return <LoadingSplashScreen backgroundColor={colors.background} />;
  }

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
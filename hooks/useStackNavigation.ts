// lib/hooks/useStackNavigation.ts - Simple Stack Navigation (replaces ALL custom navigation)
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { BackHandler, Platform } from 'react-native';
import { useEffect } from 'react';

export const useStackNavigation = () => {
  const navigation = useNavigation();
  const router = useRouter();

  return {
    // Simple back navigation
    goBack: (fallbackRoute: string = '/(drawer)/') => {
      if (navigation.canGoBack()) {
        console.log('📱 Stack: Going back');
        navigation.goBack();
        return true;
      } else {
        console.log(`📱 Stack: No history, going to ${fallbackRoute}`);
        router.replace(fallbackRoute);
        return false;
      }
    },

    // Navigate to any screen
    push: (screenName: string, params?: any) => {
      console.log(`📱 Stack: Pushing ${screenName}`);
      router.push({ pathname: screenName, params });
    },

    // Replace current screen
    replace: (screenName: string, params?: any) => {
      console.log(`📱 Stack: Replacing with ${screenName}`);
      router.replace({ pathname: screenName, params });
    },

    // Go to drawer home
    goHome: () => {
      console.log('📱 Stack: Going home');
      router.replace('/(drawer)/');
    },

    // Check if can go back
    canGoBack: () => navigation.canGoBack(),

    // Get current route
    getCurrentRoute: () => {
      const state = navigation.getState();
      return state?.routes?.[state.index]?.name || 'unknown';
    },
  };
};

// Hardware back button hook
export const useHardwareBackButton = (fallbackRoute: string = '/(drawer)/') => {
  const { goBack } = useStackNavigation();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      goBack(fallbackRoute);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [goBack, fallbackRoute]);
};

// Specific navigation helpers (replace your existing NavigationHelper and BusinessNavigation)
export const useAppNavigation = () => {
  const { push, goBack } = useStackNavigation();

  return {
    // Business navigation
    goToBusiness: () => push('/business'),
    goToBusinessDetails: (businessId?: number) => {
      const params = businessId ? { businessId } : {};
      push('/BusinessDetails', params);
    },

    // Account navigation
    goToAccount: () => push('/account'),
    goToSettings: () => push('/settings'),

    // Support navigation
    goToSupport: () => push('/support'),
    goToFAQs: () => push('/faqs'),
    goToContact: () => push('/contact'),
    goToFindUs: () => push('/findus'),

    // Track navigation
    goToTrack: (status?: string) => {
      const params = status ? { status } : {};
      push('/track', params);
    },
    goToTracking: (packageCode?: string) => {
      const params = packageCode ? { packageCode } : {};
      push('/tracking', params);
    },

    // Other navigation
    goToHistory: () => push('/history'),
    goToCart: () => push('/cart'),
    goToHome: () => push('/home'),
    goToNotifications: () => push('/notifications'),

    // Admin navigation
    goToAdmin: () => push('/admin'),
    goToAdminAppManager: () => push('/AdminAppManager'),
    goToAdminNotifications: () => push('/AdminNotifications'),
    goToAdminPackageSearch: () => push('/AdminPackageSearch'),
    goToAdminScanning: () => push('/AdminScanning'),
    goToAdminTermsManagement: () => push('/AdminTermsManagement'),

    // Generic back
    goBack: (fallbackRoute?: string) => goBack(fallbackRoute),
  };
};
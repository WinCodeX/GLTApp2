// lib/helpers/hardwareBackHandler.ts - Simplified Hardware Back Handler
import { useEffect, useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router } from 'expo-router';

interface HardwareBackOptions {
  fallbackRoute?: string;
  onBack?: () => boolean;
}

/**
 * Simple hardware back handler hook
 */
export const useHardwareBackHandler = (options: HardwareBackOptions = {}) => {
  const { fallbackRoute = '/(drawer)/', onBack } = options;

  const handleHardwareBack = useCallback((): boolean => {
    // If custom handler provided, use it
    if (onBack) {
      return onBack();
    }

    // Otherwise use expo-router's built-in navigation
    if (router.canGoBack()) {
      router.back();
      return true;
    }

    // No history - go to fallback
    router.replace(fallbackRoute);
    return true;
  }, [fallbackRoute, onBack]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleHardwareBack
    );

    return () => subscription.remove();
  }, [handleHardwareBack]);

  return { handleBackPress: handleHardwareBack };
};

/**
 * Screen-specific back handlers
 */
export const ScreenBackHandlers = {
  useAdminBackHandler: (fallbackRoute: string = '/admin') => {
    return useHardwareBackHandler({ fallbackRoute });
  },

  useBusinessBackHandler: () => {
    return useHardwareBackHandler({ fallbackRoute: '/business' });
  },

  useModalBackHandler: (onClose: () => void) => {
    return useHardwareBackHandler({
      onBack: () => {
        onClose();
        return true;
      },
    });
  },
};
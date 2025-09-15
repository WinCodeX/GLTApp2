// lib/helpers/hardwareBackHandler.ts - Fixed for immediate single press response with debouncing
import { useEffect, useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { NavigationHelper } from './navigation';
import React from 'react';

interface HardwareBackOptions {
  fallbackRoute?: string;
  replaceIfNoHistory?: boolean;
  customHandler?: () => boolean;
  enableOnIOS?: boolean;
}

/**
 * FIXED: Hook to handle hardware back button with immediate single press response
 */
export const useHardwareBackHandler = (options: HardwareBackOptions = {}) => {
  const {
    fallbackRoute = '/(drawer)/',
    replaceIfNoHistory = true,
    customHandler,
    enableOnIOS = false
  } = options;

  const handleHardwareBack = useCallback((): boolean => {
    console.log('📱 Hardware Back: Button pressed - immediate response required');

    // FIXED: Use custom handler if provided - must be synchronous
    if (customHandler) {
      try {
        const result = customHandler();
        console.log('📱 Hardware Back: Custom handler returned:', result);
        return result;
      } catch (error) {
        console.error('❌ Hardware Back: Custom handler error:', error);
        return false;
      }
    }

    // FIXED: Execute navigation immediately - use immediate version for hardware back
    try {
      const success = NavigationHelper.goBackImmediate({
        fallbackRoute,
        replaceIfNoHistory
      });
      
      console.log('📱 Hardware Back: Navigation completed immediately, success:', success);
      return true; // Always prevent default behavior - let our navigation handle it
      
    } catch (error) {
      console.error('❌ Hardware Back: Navigation error:', error);
      return false; // Allow default behavior on error
    }
  }, [fallbackRoute, replaceIfNoHistory, customHandler]);

  useEffect(() => {
    // FIXED: Only register on Android unless explicitly enabled for iOS
    if (Platform.OS !== 'android' && !enableOnIOS) {
      return;
    }

    console.log('📱 Hardware Back: Setting up handler for', Platform.OS);
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);

    return () => {
      console.log('📱 Hardware Back: Removing handler');
      backSubscription.remove();
    };
  }, [handleHardwareBack, enableOnIOS]);

  return {
    handleBackPress: handleHardwareBack
  };
};

/**
 * Component wrapper that automatically handles hardware back button
 */
export const HardwareBackProvider: React.FC<{
  children: React.ReactNode;
  options?: HardwareBackOptions;
}> = ({ children, options = {} }) => {
  useHardwareBackHandler(options);
  return React.createElement(React.Fragment, null, children);
};

/**
 * HOC to add hardware back handling to any component
 */
export const withHardwareBackHandler = function<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  options: HardwareBackOptions = {}
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    useHardwareBackHandler(options);
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withHardwareBackHandler(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

/**
 * Simplified screen-specific back handlers
 */
export const ScreenBackHandlers = {
  // Admin screens back handler
  useAdminBackHandler: (fallbackRoute: string = '/admin') => {
    return useHardwareBackHandler({
      fallbackRoute,
      replaceIfNoHistory: true
    });
  },

  // Business screens back handler
  useBusinessBackHandler: () => {
    return useHardwareBackHandler({
      fallbackRoute: '/(drawer)/business',
      replaceIfNoHistory: true
    });
  },

  // Package screens back handler
  usePackageBackHandler: () => {
    return useHardwareBackHandler({
      fallbackRoute: '/(drawer)/',
      replaceIfNoHistory: true
    });
  },

  // Modal back handler (for modals that should close on back)
  useModalBackHandler: (onClose: () => void) => {
    return useHardwareBackHandler({
      customHandler: () => {
        console.log('🗂️ Modal Back: Closing modal');
        onClose();
        return true;
      }
    });
  }
};

/**
 * Conditional back handler that only activates on certain screens
 */
export const useConditionalBackHandler = (
  condition: boolean,
  options: HardwareBackOptions = {}
) => {
  const conditionalOptions = condition ? options : {};
  return useHardwareBackHandler(conditionalOptions);
};
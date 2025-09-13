// lib/helpers/hardwareBackHandler.ts - Fixed for single press response
import { useEffect, useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { NavigationHelper } from './navigation';
import React from 'react';

interface HardwareBackOptions {
  fallbackRoute?: string;
  replaceIfNoHistory?: boolean;
  customHandler?: () => Promise<boolean> | boolean;
  enableOnIOS?: boolean;
}

/**
 * Hook to handle hardware back button with immediate single press response
 */
export const useHardwareBackHandler = (options: HardwareBackOptions = {}) => {
  const {
    fallbackRoute = '/(drawer)/',
    replaceIfNoHistory = true,
    customHandler,
    enableOnIOS = false
  } = options;

  const handleHardwareBack = useCallback((): boolean => {
    console.log('📱 Hardware Back: Button pressed');

    // Use custom handler if provided (synchronous check first)
    if (customHandler) {
      try {
        const customResult = customHandler();
        
        // Handle both sync and async custom handlers
        if (customResult instanceof Promise) {
          customResult.then(result => {
            console.log('🎯 Hardware Back: Async custom handler result:', result);
          }).catch(error => {
            console.error('❌ Hardware Back: Custom handler error:', error);
          });
        } else {
          console.log('🎯 Hardware Back: Sync custom handler result:', customResult);
          return customResult;
        }
        
        // For async handlers, prevent default and let handler manage navigation
        return true;
      } catch (error) {
        console.error('❌ Hardware Back: Custom handler error:', error);
      }
    }

    // Use NavigationHelper for back navigation (fire and forget for immediate response)
    NavigationHelper.goBack({
      fallbackRoute,
      replaceIfNoHistory
    }).then(backResult => {
      console.log('🧭 Hardware Back: NavigationHelper completed:', backResult);
    }).catch(error => {
      console.error('❌ Hardware Back: NavigationHelper error:', error);
    });

    // Always prevent default Android back behavior since we handle navigation
    return true;
  }, [fallbackRoute, replaceIfNoHistory, customHandler]);

  useEffect(() => {
    // Only handle on Android by default, unless enableOnIOS is true
    if (Platform.OS !== 'android' && !enableOnIOS) {
      return;
    }

    console.log('📱 Hardware Back: Setting up hardware back handler');

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);

    return () => {
      console.log('📱 Hardware Back: Removing hardware back handler');
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
 * Screen-specific back handlers for different app sections
 */
export const ScreenBackHandlers = {
  // Admin screens back handler
  useAdminBackHandler: (fallbackRoute: string = '/admin') => {
    return useHardwareBackHandler({
      fallbackRoute,
      replaceIfNoHistory: true,
      customHandler: () => {
        console.log('🏢 Admin Back: Handling admin screen back');
        
        // Fire and forget - immediate response
        NavigationHelper.goBack({
          fallbackRoute,
          replaceIfNoHistory: true
        });
        
        return true; // Prevent default behavior
      }
    });
  },

  // Business screens back handler
  useBusinessBackHandler: () => {
    return useHardwareBackHandler({
      fallbackRoute: '/(drawer)/business',
      replaceIfNoHistory: true,
      customHandler: () => {
        console.log('💼 Business Back: Handling business screen back');
        
        NavigationHelper.goBack({
          fallbackRoute: '/(drawer)/business',
          replaceIfNoHistory: true
        });
        
        return true;
      }
    });
  },

  // Package screens back handler
  usePackageBackHandler: () => {
    return useHardwareBackHandler({
      fallbackRoute: '/(drawer)/',
      replaceIfNoHistory: true,
      customHandler: () => {
        console.log('📦 Package Back: Handling package screen back');
        
        NavigationHelper.goBack({
          fallbackRoute: '/(drawer)/',
          replaceIfNoHistory: true
        });
        
        return true;
      }
    });
  },

  // Modal back handler (for modals that should close on back)
  useModalBackHandler: (onClose: () => void) => {
    return useHardwareBackHandler({
      customHandler: () => {
        console.log('🗂️ Modal Back: Closing modal');
        onClose();
        return true; // Prevent default behavior
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
  const conditionalOptions = {
    ...options,
    customHandler: condition ? options.customHandler : undefined
  };

  const baseHandler = useHardwareBackHandler(conditionalOptions);

  useEffect(() => {
    if (condition) {
      console.log('✅ Conditional Back: Handler activated');
    } else {
      console.log('⏸️ Conditional Back: Handler deactivated');
    }
  }, [condition]);

  return baseHandler;
};
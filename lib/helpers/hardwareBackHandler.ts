// lib/helpers/hardwareBackHandler.ts - Hardware back button integration
import { useEffect, useRef, useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { NavigationHelper } from './navigation';

interface HardwareBackOptions {
  fallbackRoute?: string;
  replaceIfNoHistory?: boolean;
  customHandler?: () => Promise<boolean> | boolean;
  enableOnIOS?: boolean;
}

/**
 * Hook to handle hardware back button with your custom navigation system
 */
export const useHardwareBackHandler = (options: HardwareBackOptions = {}) => {
  const {
    fallbackRoute = '/(drawer)/',
    replaceIfNoHistory = true,
    customHandler,
    enableOnIOS = false
  } = options;

  const isHandlingRef = useRef(false);

  const handleHardwareBack = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous back operations
    if (isHandlingRef.current) {
      console.log('🔒 Hardware Back: Already handling back operation');
      return true;
    }

    try {
      isHandlingRef.current = true;
      
      console.log('📱 Hardware Back: Button pressed');

      // Use custom handler if provided
      if (customHandler) {
        const customResult = await customHandler();
        console.log('🎯 Hardware Back: Custom handler result:', customResult);
        return customResult;
      }

      // Use NavigationHelper for back navigation
      const backResult = await NavigationHelper.goBack({
        fallbackRoute,
        replaceIfNoHistory
      });

      console.log('🧭 Hardware Back: NavigationHelper result:', backResult);
      
      // Always return true to prevent default behavior since NavigationHelper handles it
      return true;

    } catch (error) {
      console.error('❌ Hardware Back: Error handling back button:', error);
      
      // On error, allow default behavior as fallback
      return false;
    } finally {
      isHandlingRef.current = false;
    }
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
  return <>{children}</>;
};

/**
 * HOC to add hardware back handling to any component
 */
export const withHardwareBackHandler = <P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  options: HardwareBackOptions = {}
) => {
  const WrappedComponent = (props: P) => {
    useHardwareBackHandler(options);
    return <Component {...props} />;
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
      customHandler: async () => {
        console.log('🏢 Admin Back: Handling admin screen back');
        return await NavigationHelper.goBack({
          fallbackRoute,
          replaceIfNoHistory: true
        });
      }
    });
  },

  // Business screens back handler
  useBusinessBackHandler: () => {
    return useHardwareBackHandler({
      fallbackRoute: '/(drawer)/business',
      replaceIfNoHistory: true,
      customHandler: async () => {
        console.log('💼 Business Back: Handling business screen back');
        return await NavigationHelper.goBack({
          fallbackRoute: '/(drawer)/business',
          replaceIfNoHistory: true
        });
      }
    });
  },

  // Package screens back handler
  usePackageBackHandler: () => {
    return useHardwareBackHandler({
      fallbackRoute: '/(drawer)/',
      replaceIfNoHistory: true,
      customHandler: async () => {
        console.log('📦 Package Back: Handling package screen back');
        return await NavigationHelper.goBack({
          fallbackRoute: '/(drawer)/',
          replaceIfNoHistory: true
        });
      }
    });
  },

  // Modal back handler (for modals that should close on back)
  useModalBackHandler: (onClose: () => void) => {
    return useHardwareBackHandler({
      customHandler: async () => {
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
  const baseHandler = useHardwareBackHandler({
    ...options,
    customHandler: condition ? options.customHandler : undefined
  });

  useEffect(() => {
    if (condition) {
      console.log('✅ Conditional Back: Handler activated');
    } else {
      console.log('⏸️ Conditional Back: Handler deactivated');
    }
  }, [condition]);

  return baseHandler;
};
// lib/helpers/navigationTracker.ts - Fixed to work with synchronous navigation
import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { NavigationHelper } from './navigation';

/**
 * Hook that handles route tracking with synchronous navigation methods
 */
export const useNavigationTracker = (options: {
  fallbackRoute?: string;
  replaceIfNoHistory?: boolean;
} = {}) => {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef<string | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    const initializeAndTrack = async () => {
      try {
        // Ensure NavigationHelper is initialized (still async)
        if (!isInitialized.current) {
          await NavigationHelper.initialize();
          isInitialized.current = true;
          console.log('📍 NavigationTracker: NavigationHelper initialized');
        }

        // Track route changes (now synchronous)
        if (previousPathname.current !== null && previousPathname.current !== pathname) {
          console.log(`📍 NavigationTracker: Route changed from ${previousPathname.current} to ${pathname}`);
          
          // Only track if this isn't already tracked by NavigationHelper
          const currentRoute = NavigationHelper.getCurrentRoute();
          if (currentRoute !== pathname) {
            // trackRouteChange is now synchronous - no await needed
            NavigationHelper.trackRouteChange(pathname);
            console.log(`📍 NavigationTracker: Auto-tracked route change to ${pathname}`);
          }
        }

        previousPathname.current = pathname;
      } catch (error) {
        console.error('❌ NavigationTracker: Error in route tracking:', error);
      }
    };

    initializeAndTrack();
  }, [pathname]);

  return {
    currentRoute: pathname,
    canGoBack: NavigationHelper.canGoBack(),
    goBack: NavigationHelper.goBack,
    navigateTo: NavigationHelper.navigateTo
  };
};

/**
 * HOC to wrap components with automatic navigation tracking
 */
export const withNavigationTracking = <P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  options: {
    fallbackRoute?: string;
    replaceIfNoHistory?: boolean;
  } = {}
): React.ComponentType<P> => {
  const WrappedComponent = (props: P) => {
    useNavigationTracker(options);
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withNavigationTracking(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

/**
 * NavigationTracker component for route tracking
 */
export const NavigationTracker: React.FC<{ 
  children: React.ReactNode;
  fallbackRoute?: string;
  replaceIfNoHistory?: boolean;
}> = ({ 
  children, 
  fallbackRoute = '/(drawer)/',
  replaceIfNoHistory = true
}) => {
  useNavigationTracker({
    fallbackRoute,
    replaceIfNoHistory
  });
  
  return React.createElement(React.Fragment, null, children);
};
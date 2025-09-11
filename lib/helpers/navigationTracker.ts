// lib/helpers/navigationTracker.ts - Enhanced navigation tracking with auto-detection
import { useRouter, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { NavigationHelper } from './navigation';

/**
 * Hook to automatically track route changes when navigation happens outside of NavigationHelper
 * This ensures the persistent navigation history is always up-to-date
 */
export const useNavigationTracker = () => {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef<string | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    const initializeAndTrack = async () => {
      try {
        // Ensure NavigationHelper is initialized
        if (!isInitialized.current) {
          await NavigationHelper.initialize();
          isInitialized.current = true;
          console.log('📍 NavigationTracker: NavigationHelper initialized');
        }

        // Track route changes
        if (previousPathname.current !== null && previousPathname.current !== pathname) {
          console.log(`📍 NavigationTracker: Route changed from ${previousPathname.current} to ${pathname}`);
          
          // Only track if this isn't already tracked by NavigationHelper
          const currentRoute = NavigationHelper.getCurrentRoute();
          if (currentRoute !== pathname) {
            await NavigationHelper.trackRouteChange(pathname);
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
    navigateTo: NavigationHelper.navigateTo,
  };
};

/**
 * HOC to wrap components with automatic navigation tracking
 */
export const withNavigationTracking = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => {
  const WrappedComponent = (props: P) => {
    useNavigationTracker();
    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withNavigationTracking(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

/**
 * Component to be placed at the root level to enable global navigation tracking
 */
export const NavigationTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useNavigationTracker();
  return <>{children}</>;
};
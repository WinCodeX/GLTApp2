// lib/helpers/navigation.ts - Simplified Navigation using expo-router
import { router } from 'expo-router';

/**
 * Simple navigation helper that uses expo-router's built-in navigation stack.
 * No custom state management - the framework handles everything.
 */
export class NavigationHelper {
  /**
   * Go back to the previous screen.
   * If no history exists, navigate to fallback route.
   */
  static goBack(fallbackRoute: string = '/(drawer)/'): void {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute);
    }
  }

  /**
   * Navigate to a route
   */
  static navigateTo(route: string, params?: Record<string, any>): void {
    router.push({ pathname: route, params });
  }

  /**
   * Replace current route
   */
  static replaceTo(route: string, params?: Record<string, any>): void {
    router.replace({ pathname: route, params });
  }

  /**
   * Check if can go back
   */
  static canGoBack(): boolean {
    return router.canGoBack();
  }
}

/**
 * Business-specific navigation helpers
 */
export class BusinessNavigation {
  static goToBusinessDetails(businessId?: number): void {
    const params = businessId ? { businessId } : {};
    router.push({ pathname: '/BusinessDetails', params });
  }

  static goToBusinessList(): void {
    router.push('/business');
  }

  static backFromBusinessDetails(): void {
    NavigationHelper.goBack('/business');
  }

  static backFromBusinessList(): void {
    NavigationHelper.goBack('/(drawer)/');
  }
}

/**
 * Hook for navigation in components
 */
export const useNavigation = () => {
  return {
    goBack: NavigationHelper.goBack,
    navigateTo: NavigationHelper.navigateTo,
    replaceTo: NavigationHelper.replaceTo,
    canGoBack: NavigationHelper.canGoBack,
  };
};
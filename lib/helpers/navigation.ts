// lib/helpers/navigation.ts - Comprehensive navigation helper for Expo Router
import { router } from 'expo-router';

interface NavigationOptions {
  fallbackRoute?: string;
  replaceIfNoHistory?: boolean;
  params?: Record<string, any>;
}

export class NavigationHelper {
  // Enhanced back navigation with smart fallbacks
  static goBack(options: NavigationOptions = {}) {
    const {
      fallbackRoute = '/',
      replaceIfNoHistory = true,
      params = {}
    } = options;

    try {
      console.log('🧭 Navigation: Attempting to go back...');
      
      // Check if we can go back in the navigation stack
      if (router.canGoBack()) {
        console.log('🧭 Navigation: Going back in history');
        router.back();
        return true;
      }
      
      // No history available - handle based on options
      if (replaceIfNoHistory) {
        console.log(`🧭 Navigation: No history, replacing with ${fallbackRoute}`);
        router.replace({ pathname: fallbackRoute, params });
      } else {
        console.log(`🧭 Navigation: No history, pushing ${fallbackRoute}`);
        router.push({ pathname: fallbackRoute, params });
      }
      
      return false;
    } catch (error) {
      console.error('🧭 Navigation: Error during back navigation:', error);
      
      // Ultimate fallback
      try {
        router.replace({ pathname: fallbackRoute, params });
      } catch (fallbackError) {
        console.error('🧭 Navigation: Fallback navigation also failed:', fallbackError);
      }
      
      return false;
    }
  }

  // Smart navigation that handles different scenarios
  static navigateTo(route: string, options: NavigationOptions = {}) {
    const { params = {} } = options;
    
    try {
      console.log(`🧭 Navigation: Navigating to ${route}`);
      router.push({ pathname: route, params });
    } catch (error) {
      console.error(`🧭 Navigation: Failed to navigate to ${route}:`, error);
      
      // Try replace as fallback
      try {
        router.replace({ pathname: route, params });
      } catch (replaceError) {
        console.error('🧭 Navigation: Replace fallback also failed:', replaceError);
      }
    }
  }

  // Replace current route
  static replaceTo(route: string, params: Record<string, any> = {}) {
    try {
      console.log(`🧭 Navigation: Replacing with ${route}`);
      router.replace({ pathname: route, params });
    } catch (error) {
      console.error(`🧭 Navigation: Failed to replace with ${route}:`, error);
    }
  }

  // Navigate with reset (clear history)
  static navigateWithReset(route: string, params: Record<string, any> = {}) {
    try {
      console.log(`🧭 Navigation: Resetting navigation to ${route}`);
      router.dismissAll(); // Dismiss any modals
      router.replace({ pathname: route, params });
    } catch (error) {
      console.error(`🧭 Navigation: Failed to reset to ${route}:`, error);
    }
  }

  // Check if we can go back
  static canGoBack(): boolean {
    return router.canGoBack();
  }

  // Get current route info (if available)
  static getCurrentRoute(): string | null {
    try {
      // Note: Expo Router doesn't expose current route directly
      // You might need to track this manually if needed
      return null;
    } catch (error) {
      console.error('🧭 Navigation: Failed to get current route:', error);
      return null;
    }
  }
}

// Hook for navigation in components
export const useNavigation = () => {
  return {
    goBack: NavigationHelper.goBack,
    navigateTo: NavigationHelper.navigateTo,
    replaceTo: NavigationHelper.replaceTo,
    navigateWithReset: NavigationHelper.navigateWithReset,
    canGoBack: NavigationHelper.canGoBack,
    getCurrentRoute: NavigationHelper.getCurrentRoute,
  };
};

// Business-specific navigation patterns
export class BusinessNavigation {
  // Navigate to business details with proper fallback
  static goToBusinessDetails(businessId?: number) {
    if (businessId) {
      NavigationHelper.navigateTo('/(drawer)/BusinessDetails', {
        params: { businessId }
      });
    } else {
      NavigationHelper.navigateTo('/(drawer)/BusinessDetails');
    }
  }

  // Navigate to business list with fallback
  static goToBusinessList() {
    NavigationHelper.navigateTo('/(drawer)/Business');
  }

  // Go back from business details with smart fallback
  static backFromBusinessDetails() {
    NavigationHelper.goBack({
      fallbackRoute: '/(drawer)/Business',
      replaceIfNoHistory: true
    });
  }

  // Go back from business list with smart fallback  
  static backFromBusinessList() {
    NavigationHelper.goBack({
      fallbackRoute: '/',
      replaceIfNoHistory: true
    });
  }
}

// Optional: Simple navigation tracking (if needed for analytics)
export class NavigationTracker {
  private static navigationHistory: string[] = [];
  private static maxHistorySize = 10;

  static trackNavigation(route: string) {
    console.log(`📊 Navigation Tracker: ${route}`);
    
    this.navigationHistory.push(route);
    
    // Keep history size manageable
    if (this.navigationHistory.length > this.maxHistorySize) {
      this.navigationHistory.shift();
    }
  }

  static getNavigationHistory(): string[] {
    return [...this.navigationHistory];
  }

  static getPreviousRoute(): string | null {
    return this.navigationHistory.length >= 2 
      ? this.navigationHistory[this.navigationHistory.length - 2]
      : null;
  }

  static clearHistory() {
    this.navigationHistory = [];
  }
}
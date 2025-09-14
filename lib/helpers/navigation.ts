// lib/helpers/navigation.ts - Fixed with working navigation tracker
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

interface NavigationEntry {
  route: string;
  params?: Record<string, any>;
  timestamp: number;
  sessionId: string;
  action: 'push' | 'replace' | 'reset' | 'back';
}

interface NavigationState {
  history: NavigationEntry[];
  currentRoute: string | null;
  sessionId: string;
  lastUpdated: number;
}

interface NavigationOptions {
  fallbackRoute?: string;
  replaceIfNoHistory?: boolean;
  params?: Record<string, any>;
  trackInHistory?: boolean;
}

// Constants
const STORAGE_KEY = '@navigation_state';
const MAX_HISTORY_SIZE = 50;
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Manual navigation history tracking since Expo Router's canGoBack() is unreliable in drawer layouts
class PersistentNavigationHistory {
  private static state: NavigationState = {
    history: [],
    currentRoute: null,
    sessionId: '',
    lastUpdated: Date.now()
  };
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🚀 PersistentNavigation: Initializing...');
      await this.loadState();
      await this.cleanupOldEntries();
      this.initialized = true;
      console.log('✅ PersistentNavigation: Initialized successfully');
    } catch (error) {
      console.error('❌ PersistentNavigation: Initialization failed:', error);
      await this.resetState();
      this.initialized = true;
    }
  }

  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async loadState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedState: NavigationState = JSON.parse(stored);
        
        const isRecentState = Date.now() - parsedState.lastUpdated < SESSION_TIMEOUT;
        
        if (isRecentState) {
          this.state = {
            ...parsedState,
            sessionId: this.generateSessionId()
          };
          console.log('📱 PersistentNavigation: Loaded previous state', {
            historyCount: this.state.history.length,
            currentRoute: this.state.currentRoute
          });
        } else {
          console.log('⏰ PersistentNavigation: Previous state too old, starting fresh');
          await this.resetState();
        }
      } else {
        await this.resetState();
      }
    } catch (error) {
      console.error('💾 PersistentNavigation: Failed to load state:', error);
      await this.resetState();
    }
  }

  private static async saveState(): Promise<void> {
    try {
      this.state.lastUpdated = Date.now();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('💾 PersistentNavigation: Failed to save state:', error);
    }
  }

  static async resetState(): Promise<void> {
    this.state = {
      history: [],
      currentRoute: null,
      sessionId: this.generateSessionId(),
      lastUpdated: Date.now()
    };
    await this.saveState();
    console.log('🔄 PersistentNavigation: State reset');
  }

  private static async cleanupOldEntries(): Promise<void> {
    const cutoffTime = Date.now() - SESSION_TIMEOUT;
    const initialCount = this.state.history.length;
    
    this.state.history = this.state.history.filter(entry => 
      entry.timestamp > cutoffTime
    );

    if (this.state.history.length > MAX_HISTORY_SIZE) {
      this.state.history = this.state.history.slice(-MAX_HISTORY_SIZE);
    }

    const removedCount = initialCount - this.state.history.length;
    if (removedCount > 0) {
      console.log(`🧹 PersistentNavigation: Cleaned up ${removedCount} old entries`);
      await this.saveState();
    }
  }

  static push(route: string, params?: Record<string, any>): void {
    const entry: NavigationEntry = {
      route,
      params,
      timestamp: Date.now(),
      sessionId: this.state.sessionId,
      action: 'push'
    };

    // Don't track consecutive identical routes with same params
    const lastEntry = this.state.history[this.state.history.length - 1];
    if (lastEntry && lastEntry.route === route && 
        JSON.stringify(lastEntry.params) === JSON.stringify(params)) {
      console.log('🔄 PersistentNavigation: Skipping duplicate route tracking');
      return;
    }

    this.state.history.push(entry);
    this.state.currentRoute = route;

    if (this.state.history.length > MAX_HISTORY_SIZE) {
      this.state.history.shift();
    }

    console.log('📍 PersistentNavigation: Tracked', {
      route,
      historyLength: this.state.history.length
    });

    // Save asynchronously
    this.saveState().catch(error => {
      console.error('❌ PersistentNavigation: Failed to save after push:', error);
    });
  }

  static pop(): NavigationEntry | null {
    if (this.state.history.length > 0) {
      const popped = this.state.history.pop();
      console.log('📍 PersistentNavigation: Popped', popped?.route);
      
      // Save state asynchronously (non-blocking)
      this.saveState().catch(error => {
        console.error('❌ PersistentNavigation: Failed to save state after pop:', error);
      });
      
      return popped || null;
    }
    return null;
  }

  static getPrevious(): NavigationEntry | null {
    return this.state.history.length >= 2 
      ? this.state.history[this.state.history.length - 2] 
      : null;
  }

  static hasHistory(): boolean {
    return this.state.history.length > 1;
  }

  static canGoBackInHistory(): boolean {
    return this.state.history.length >= 2;
  }

  static getHistory(): NavigationEntry[] {
    return [...this.state.history];
  }

  static getCurrentState(): NavigationState {
    return { ...this.state };
  }

  static async clearHistory(): Promise<void> {
    await this.resetState();
  }

  static updateCurrentRoute(route: string): void {
    this.state.currentRoute = route;
    // Save asynchronously (non-blocking)
    this.saveState().catch(error => {
      console.error('❌ PersistentNavigation: Failed to save state after route update:', error);
    });
  }
}

export class NavigationHelper {
  // Initialize navigation system - call this in your app startup
  static async initialize(): Promise<void> {
    await PersistentNavigationHistory.initialize();
  }

  // Fixed back navigation with immediate response and proper tracking
  static goBack(options: NavigationOptions = {}): boolean {
    const {
      fallbackRoute = '/(drawer)/',
      replaceIfNoHistory = true,
      params = {}
    } = options;

    try {
      console.log('🧭 Navigation: Attempting to go back...');
      
      // Check if we have history to go back to (synchronous check)
      if (PersistentNavigationHistory.canGoBackInHistory()) {
        // Get previous route from our persistent history
        const previousEntry = PersistentNavigationHistory.getPrevious();
        
        if (previousEntry) {
          console.log('🧭 Navigation: Going back to', previousEntry.route);
          
          // Update history immediately (synchronous)
          const popped = PersistentNavigationHistory.pop();
          if (popped) {
            PersistentNavigationHistory.updateCurrentRoute(previousEntry.route);
          }
          
          // Execute navigation immediately
          router.push({ 
            pathname: previousEntry.route, 
            params: { ...previousEntry.params, ...params }
          });
          
          return true;
        }
      }
      
      // Try Expo Router's native back if no persistent history
      if (router.canGoBack()) {
        console.log('🧭 Navigation: Using Expo Router back');
        router.back();
        return true;
      }
      
      // No history available - handle based on options
      console.log(`🧭 Navigation: No history, using fallback: ${fallbackRoute}`);
      
      // Update state immediately (synchronous)
      PersistentNavigationHistory.updateCurrentRoute(fallbackRoute);
      
      if (replaceIfNoHistory) {
        router.replace({ pathname: fallbackRoute, params });
      } else {
        router.push({ pathname: fallbackRoute, params });
        PersistentNavigationHistory.push(fallbackRoute, params);
      }
      
      return false;
    } catch (error) {
      console.error('🧭 Navigation: Error during back navigation:', error);
      
      // Ultimate fallback - immediate execution
      try {
        router.replace({ pathname: fallbackRoute, params });
        PersistentNavigationHistory.updateCurrentRoute(fallbackRoute);
      } catch (fallbackError) {
        console.error('🧭 Navigation: Fallback navigation also failed:', fallbackError);
      }
      
      return false;
    }
  }

  // Enhanced navigation with immediate tracking
  static navigateTo(route: string, options: NavigationOptions = {}): void {
    const { params = {}, trackInHistory = true } = options;
    
    try {
      console.log(`🧭 Navigation: Navigating to ${route}`);
      
      // Track in history immediately (synchronous)
      if (trackInHistory) {
        PersistentNavigationHistory.push(route, params);
      }
      
      // Execute navigation immediately
      router.push({ pathname: route, params });
    } catch (error) {
      console.error(`🧭 Navigation: Failed to navigate to ${route}:`, error);
      
      // Try replace as fallback
      try {
        router.replace({ pathname: route, params });
        if (trackInHistory) {
          PersistentNavigationHistory.push(route, params);
        }
      } catch (replaceError) {
        console.error('🧭 Navigation: Replace fallback also failed:', replaceError);
      }
    }
  }

  // Replace current route
  static replaceTo(route: string, params: Record<string, any> = {}): void {
    try {
      console.log(`🧭 Navigation: Replacing with ${route}`);
      router.replace({ pathname: route, params });
      PersistentNavigationHistory.updateCurrentRoute(route);
    } catch (error) {
      console.error(`🧭 Navigation: Failed to replace with ${route}:`, error);
    }
  }

  // Navigate with reset (clear history)
  static navigateWithReset(route: string, params: Record<string, any> = {}): void {
    try {
      console.log(`🧭 Navigation: Resetting navigation to ${route}`);
      
      // Execute navigation immediately
      router.dismissAll(); // Dismiss any modals
      router.replace({ pathname: route, params });
      
      // Update tracking immediately
      PersistentNavigationHistory.updateCurrentRoute(route);
      
      // Clear history asynchronously
      PersistentNavigationHistory.clearHistory().then(() => {
        PersistentNavigationHistory.push(route, params);
      }).catch(error => {
        console.error('❌ Navigation: Failed to reset history:', error);
      });
    } catch (error) {
      console.error(`🧭 Navigation: Failed to reset to ${route}:`, error);
    }
  }

  // Check if we can go back (using our persistent history)
  static canGoBack(): boolean {
    return PersistentNavigationHistory.canGoBackInHistory() || router.canGoBack();
  }

  // Get current route info
  static getCurrentRoute(): string | null {
    return PersistentNavigationHistory.getCurrentState().currentRoute;
  }

  // Get navigation history
  static getNavigationHistory(): NavigationEntry[] {
    return PersistentNavigationHistory.getHistory();
  }

  // Get previous route
  static getPreviousRoute(): NavigationEntry | null {
    return PersistentNavigationHistory.getPrevious();
  }

  // Clear navigation history
  static async clearNavigationHistory(): Promise<void> {
    await PersistentNavigationHistory.clearHistory();
  }

  // Export navigation state for debugging
  static async exportNavigationState(): Promise<string> {
    const state = PersistentNavigationHistory.getCurrentState();
    return JSON.stringify(state, null, 2);
  }

  // Synchronous track route change for immediate tracking
  static trackRouteChange(route: string, params?: Record<string, any>): void {
    PersistentNavigationHistory.push(route, params);
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
    getNavigationHistory: NavigationHelper.getNavigationHistory,
    getPreviousRoute: NavigationHelper.getPreviousRoute,
    clearNavigationHistory: NavigationHelper.clearNavigationHistory,
    exportNavigationState: NavigationHelper.exportNavigationState,
    trackRouteChange: NavigationHelper.trackRouteChange,
  };
};

// Enhanced Business-specific navigation patterns with persistent tracking
export class BusinessNavigation {
  // Navigate to business details with persistent tracking
  static goToBusinessDetails(businessId?: number): void {
    const route = '/(drawer)/BusinessDetails';
    const params = businessId ? { businessId } : {};
    
    NavigationHelper.navigateTo(route, { params });
  }

  // Navigate to business list with persistent tracking
  static goToBusinessList(): void {
    NavigationHelper.navigateTo('/(drawer)/business');
  }

  // Go back from business details with smart fallback
  static backFromBusinessDetails(): boolean {
    return NavigationHelper.goBack({
      fallbackRoute: '/(drawer)/business',
      replaceIfNoHistory: true
    });
  }

  // Go back from business list with smart fallback  
  static backFromBusinessList(): boolean {
    return NavigationHelper.goBack({
      fallbackRoute: '/(drawer)/',
      replaceIfNoHistory: true
    });
  }
}

// Utility functions for navigation tracking (static methods moved here)
export const NavigationUtils = {
  // Track navigation with persistent storage
  trackNavigation: (route: string): void => {
    console.log(`📊 Navigation Tracker: ${route}`);
    NavigationHelper.trackRouteChange(route);
  },

  // Get navigation history from persistent storage
  getNavigationHistory: (): NavigationEntry[] => {
    return PersistentNavigationHistory.getHistory();
  },

  // Get previous route from persistent storage
  getPreviousRoute: (): NavigationEntry | null => {
    return PersistentNavigationHistory.getPrevious();
  },

  // Clear navigation history
  clearHistory: async (): Promise<void> => {
    await PersistentNavigationHistory.clearHistory();
  },

  // Get navigation statistics
  getNavigationStats: () => {
    const history = PersistentNavigationHistory.getHistory();
    const state = PersistentNavigationHistory.getCurrentState();
    
    return {
      totalNavigations: history.length,
      currentRoute: state.currentRoute,
      sessionId: state.sessionId,
      lastUpdated: new Date(state.lastUpdated).toISOString(),
      canGoBack: PersistentNavigationHistory.hasHistory()
    };
  },

  // Export navigation data for debugging
  exportNavigationData: async (): Promise<string> => {
    return await NavigationHelper.exportNavigationState();
  }
};

// Initialize navigation system - call this in your app startup
export const initializeNavigation = async (): Promise<void> => {
  await NavigationHelper.initialize();
};

export type { NavigationEntry, NavigationState, NavigationOptions };
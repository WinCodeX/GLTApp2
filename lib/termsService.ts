// lib/termsService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

interface TermsData {
  id: number;
  title: string;
  content: string;
  version: string;
  term_type: string;
  effective_date: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}

interface CachedTermsData extends TermsData {
  cached_at: string;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const TERMS_CACHE_KEY = 'cached_terms_data';
const PRIVACY_CACHE_KEY = 'cached_privacy_data';

class TermsService {
  private static instance: TermsService;

  public static getInstance(): TermsService {
    if (!TermsService.instance) {
      TermsService.instance = new TermsService();
    }
    return TermsService.instance;
  }

  /**
   * Initialize terms on app startup
   * This should be called in App.tsx or your root component
   */
  async initializeTerms(): Promise<void> {
    try {
      console.log('🔧 Initializing terms and conditions...');
      
      // Fetch both terms and privacy in parallel
      const [termsPromise, privacyPromise] = await Promise.allSettled([
        this.fetchAndCacheTerms('terms_of_service'),
        this.fetchAndCacheTerms('privacy_policy'),
      ]);

      const termsResult = termsPromise.status === 'fulfilled' ? termsPromise.value : null;
      const privacyResult = privacyPromise.status === 'fulfilled' ? privacyPromise.value : null;

      if (termsResult) {
        console.log('✅ Terms of Service loaded and cached');
      } else {
        console.warn('⚠️ Failed to load Terms of Service');
      }

      if (privacyResult) {
        console.log('✅ Privacy Policy loaded and cached');
      } else {
        console.warn('⚠️ Failed to load Privacy Policy');
      }

      console.log('🎉 Terms initialization complete');
    } catch (error) {
      console.error('❌ Terms initialization failed:', error);
      // Don't throw - app should still work without terms initially
    }
  }

  /**
   * Get terms data, preferring cache but falling back to API
   */
  async getTerms(type: 'terms_of_service' | 'privacy_policy' = 'terms_of_service'): Promise<TermsData | null> {
    try {
      // First try to get from cache
      const cachedData = await this.getCachedTerms(type);
      if (cachedData && this.isCacheValid(cachedData.cached_at)) {
        console.log(`📄 Using cached ${type}`);
        return cachedData;
      }

      // If cache miss or expired, fetch fresh data
      console.log(`🔄 Fetching fresh ${type} from API`);
      const freshData = await this.fetchTermsFromAPI(type);
      
      if (freshData) {
        await this.cacheTerms(type, freshData);
        return freshData;
      }

      // If API fails, return expired cache if available
      if (cachedData) {
        console.log(`⚠️ API failed, using expired cached ${type}`);
        return cachedData;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to get ${type}:`, error);
      
      // Try to return cached data as fallback
      const cachedData = await this.getCachedTerms(type);
      return cachedData || null;
    }
  }

  /**
   * Force refresh terms from API
   */
  async refreshTerms(type: 'terms_of_service' | 'privacy_policy' = 'terms_of_service'): Promise<TermsData | null> {
    try {
      console.log(`🔄 Force refreshing ${type}...`);
      const freshData = await this.fetchTermsFromAPI(type);
      
      if (freshData) {
        await this.cacheTerms(type, freshData);
        console.log(`✅ ${type} refreshed and cached`);
        return freshData;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Failed to refresh ${type}:`, error);
      return null;
    }
  }

  /**
   * Clear cached terms
   */
  async clearCache(type?: 'terms_of_service' | 'privacy_policy'): Promise<void> {
    try {
      if (type) {
        const cacheKey = type === 'privacy_policy' ? PRIVACY_CACHE_KEY : TERMS_CACHE_KEY;
        await AsyncStorage.removeItem(cacheKey);
        console.log(`🗑️ Cleared ${type} cache`);
      } else {
        await AsyncStorage.multiRemove([TERMS_CACHE_KEY, PRIVACY_CACHE_KEY]);
        console.log('🗑️ Cleared all terms cache');
      }
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  /**
   * Get cache status for debugging
   */
  async getCacheStatus(): Promise<{
    terms: { cached: boolean; valid: boolean; version?: string };
    privacy: { cached: boolean; valid: boolean; version?: string };
  }> {
    const termsCache = await this.getCachedTerms('terms_of_service');
    const privacyCache = await this.getCachedTerms('privacy_policy');

    return {
      terms: {
        cached: !!termsCache,
        valid: termsCache ? this.isCacheValid(termsCache.cached_at) : false,
        version: termsCache?.version,
      },
      privacy: {
        cached: !!privacyCache,
        valid: privacyCache ? this.isCacheValid(privacyCache.cached_at) : false,
        version: privacyCache?.version,
      },
    };
  }

  // Private methods
  
  private async fetchAndCacheTerms(type: 'terms_of_service' | 'privacy_policy'): Promise<TermsData | null> {
    try {
      const data = await this.fetchTermsFromAPI(type);
      if (data) {
        await this.cacheTerms(type, data);
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch and cache ${type}:`, error);
      return null;
    }
  }

  private async fetchTermsFromAPI(type: 'terms_of_service' | 'privacy_policy'): Promise<TermsData | null> {
    try {
      const response = await api.get(`/api/v1/terms/current?type=${type}`);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      console.warn(`API returned unsuccessful response for ${type}:`, response.data);
      return null;
    } catch (error: any) {
      console.error(`API request failed for ${type}:`, error?.response?.data || error.message);
      throw error;
    }
  }

  private async getCachedTerms(type: 'terms_of_service' | 'privacy_policy'): Promise<CachedTermsData | null> {
    try {
      const cacheKey = type === 'privacy_policy' ? PRIVACY_CACHE_KEY : TERMS_CACHE_KEY;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData) as CachedTermsData;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get cached ${type}:`, error);
      return null;
    }
  }

  private async cacheTerms(type: 'terms_of_service' | 'privacy_policy', data: TermsData): Promise<void> {
    try {
      const cacheKey = type === 'privacy_policy' ? PRIVACY_CACHE_KEY : TERMS_CACHE_KEY;
      const cachedData: CachedTermsData = {
        ...data,
        cached_at: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
    } catch (error) {
      console.error(`Failed to cache ${type}:`, error);
    }
  }

  private isCacheValid(cachedAt: string): boolean {
    const cacheTime = new Date(cachedAt).getTime();
    const now = Date.now();
    return (now - cacheTime) < CACHE_DURATION;
  }
}

export default TermsService.getInstance();
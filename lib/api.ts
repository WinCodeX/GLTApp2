// lib/api.ts - Updated to use AccountManager with proper JSON headers
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { accountManager } from './AccountManager';

const LOCAL_BASE_1 = 'http://192.168.100.73:3000';
const LOCAL_BASE_2 = 'http://10.214.187.106:3000';
const PROD_BASE = 'https://glt-53x8.onrender.com';
const FALLBACK_BASE = PROD_BASE;

let resolvedBaseUrl: string | null = null;
let isResolvingBaseUrl = false;

// Export API_BASE_URL for compatibility
export const API_BASE_URL = (() => {
  if (resolvedBaseUrl) {
    return `${resolvedBaseUrl}/api/v1`;
  }
  
  const isDev = __DEV__;
  if (isDev) {
    return `${LOCAL_BASE_1}/api/v1`;
  } else {
    return `${PROD_BASE}/api/v1`;
  }
})();

// Safe function to get current API base URL
export const getApiBaseUrl = (): string => {
  try {
    if (resolvedBaseUrl) {
      return `${resolvedBaseUrl}/api/v1`;
    }
    
    const isDev = __DEV__;
    if (isDev) {
      return `${LOCAL_BASE_1}/api/v1`;
    } else {
      return `${PROD_BASE}/api/v1`;
    }
  } catch (error) {
    console.error('❌ Error getting API base URL:', error);
    return `${FALLBACK_BASE}/api/v1`;
  }
};

// Safe function to get base domain for avatar URLs
export const getBaseDomain = (): string => {
  try {
    if (resolvedBaseUrl) {
      return resolvedBaseUrl;
    }
    
    const isDev = __DEV__;
    if (isDev) {
      return LOCAL_BASE_1;
    } else {
      return PROD_BASE;
    }
  } catch (error) {
    console.error('❌ Error getting base domain:', error);
    return FALLBACK_BASE;
  }
};

// Safe avatar URL helper
export const getFullAvatarUrl = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;
  
  try {
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    const baseUrl = getBaseDomain();
    
    if (avatarUrl.startsWith('/')) {
      return `${baseUrl}${avatarUrl}`;
    }
    
    return `${baseUrl}/${avatarUrl}`;
    
  } catch (error) {
    console.error('❌ Error building avatar URL:', error);
    return null;
  }
};

const testConnection = async (baseUrl: string, timeout = 3000): Promise<boolean> => {
  try {
    console.log(`🔍 Testing connection to: ${baseUrl}`);
    
    const response = await axios.get(`${baseUrl}/api/v1/ping`, {
      timeout,
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json' // CRITICAL: This tells the server to respond with JSON
      }
    });
    
    if (response.status === 200) {
      console.log(`✅ Connection successful to: ${baseUrl}`);
      return true;
    }
  } catch (error) {
    console.log(`❌ Connection failed to: ${baseUrl} - ${error.message}`);
  }
  return false;
};

const getBaseUrl = async (): Promise<string> => {
  if (resolvedBaseUrl) {
    console.log(`📍 Using cached base URL: ${resolvedBaseUrl}`);
    return resolvedBaseUrl;
  }

  if (isResolvingBaseUrl) {
    console.log('⏳ Base URL resolution already in progress...');
    let waitTime = 0;
    while (isResolvingBaseUrl && !resolvedBaseUrl && waitTime < 10000) {
      await new Promise(resolve => setTimeout(resolve, 200));
      waitTime += 200;
    }
    return resolvedBaseUrl || FALLBACK_BASE;
  }

  isResolvingBaseUrl = true;
  console.log('🚀 Starting base URL resolution...');

  const bases = [LOCAL_BASE_1, LOCAL_BASE_2, PROD_BASE];

  try {
    for (const base of bases) {
      if (await testConnection(base, 2000)) {
        resolvedBaseUrl = base;
        console.log(`🎯 Selected base URL: ${resolvedBaseUrl}`);
        break;
      }
    }

    if (!resolvedBaseUrl) {
      resolvedBaseUrl = FALLBACK_BASE;
      console.log(`⚠️ No servers reachable, using fallback: ${resolvedBaseUrl}`);
    }
  } catch (error) {
    console.error('❌ Error during base URL resolution:', error);
    resolvedBaseUrl = FALLBACK_BASE;
  } finally {
    isResolvingBaseUrl = false;
  }

  return resolvedBaseUrl;
};

// Create the main API instance with proper JSON headers
const api = axios.create({
  baseURL: PROD_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json', // CRITICAL: This ensures JSON responses
  },
});

// Request interceptor - Updated to use AccountManager with proper JSON headers
api.interceptors.request.use(
  async (config) => {
    try {
      // Get authentication data from AccountManager
      const currentAccount = accountManager.getCurrentAccount();

      // Resolve base URL if needed
      if (!resolvedBaseUrl) {
        const baseUrl = await getBaseUrl();
        config.baseURL = baseUrl;
      } else {
        config.baseURL = resolvedBaseUrl;
      }

      // CRITICAL: Ensure JSON headers are always present
      if (config.headers) {
        config.headers['Content-Type'] = 'application/json';
        config.headers['Accept'] = 'application/json';
      }

      // Add auth header if we have a current account
      if (currentAccount && config.headers) {
        config.headers.Authorization = `Bearer ${currentAccount.token}`;
        
        // Add additional context headers for better server-side validation
        config.headers['X-User-ID'] = currentAccount.id;
        config.headers['X-User-Email'] = currentAccount.email;
        
        console.log(`📡 Making authenticated request for ${currentAccount.email} to: ${config.baseURL}${config.url}`);
      } else {
        console.log(`📡 Making unauthenticated request to: ${config.baseURL}${config.url}`);
      }

      return config;
    } catch (error) {
      console.error('❌ Request interceptor error:', error);
      // Don't fail the request completely, use fallback
      config.baseURL = FALLBACK_BASE;
      
      // CRITICAL: Still ensure JSON headers even on error
      if (config.headers) {
        config.headers['Content-Type'] = 'application/json';
        config.headers['Accept'] = 'application/json';
      }
      
      return config;
    }
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Updated to handle AccountManager
api.interceptors.response.use(
  (response) => {
    const currentAccount = accountManager.getCurrentAccount();
    const accountInfo = currentAccount ? ` (${currentAccount.email})` : ' (unauthenticated)';
    console.log(`✅ Request successful${accountInfo}: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    
    // Log response content type for debugging
    const contentType = response.headers['content-type'];
    if (contentType && !contentType.includes('json')) {
      console.warn('⚠️ Non-JSON response detected:', contentType);
    }
    
    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const currentAccount = accountManager.getCurrentAccount();
    const accountInfo = currentAccount ? ` (${currentAccount.email})` : ' (unauthenticated)';

    console.error(`❌ Request failed${accountInfo}: ${config?.method?.toUpperCase()} ${config?.url} - Status: ${status}`);

    // Log response content type for debugging HTML/JSON issues
    if (error.response?.headers?.['content-type']) {
      const contentType = error.response.headers['content-type'];
      console.error(`❌ Error response content-type: ${contentType}`);
      
      if (contentType.includes('text/html')) {
        console.error('🚨 Server returned HTML instead of JSON! Check your API endpoint and headers.');
      }
    }

    // Handle 401/422 Unauthorized
    if (status === 401 || status === 422) {
      console.log('🔐 Authentication failed - handling account cleanup');
      
      if (currentAccount) {
        console.log('🗑️ Removing invalid account:', currentAccount.email);
        try {
          await accountManager.removeAccount(currentAccount.id);
        } catch (removeError) {
          console.error('❌ Failed to remove invalid account:', removeError);
        }
      }
      
      // Show toast and redirect if no accounts remain
      if (!accountManager.hasAccounts()) {
        Toast.show({ 
          type: 'error', 
          text1: 'Session expired',
          text2: 'Please log in again'
        });
        
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      } else {
        Toast.show({ 
          type: 'warning', 
          text1: 'Account session expired',
          text2: 'Switched to another account'
        });
      }
      
      return Promise.reject(error);
    }

    // Handle network errors
    const isNetworkError = error.code === 'NETWORK_ERROR' || 
                          error.message === 'Network Error' ||
                          error.code === 'ECONNABORTED' ||
                          !error.response;

    if (isNetworkError) {
      console.log('🌐 Network error detected, checking connectivity...');
      
      try {
        const netInfo = await NetInfo.fetch();
        const isOffline = !netInfo.isConnected;

        if (isOffline) {
          Toast.show({
            type: 'error',
            text1: 'No Internet Connection',
            text2: 'Please check your network settings.',
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Server Unreachable',
            text2: 'Trying alternative servers...',
            visibilityTime: 3000,
          });
        }
      } catch (netError) {
        console.error('❌ Network check failed:', netError);
      }
    }

    return Promise.reject(error);
  }
);

// Helper functions
export const refreshBaseUrl = async (): Promise<string> => {
  console.log('🔄 Manually refreshing base URL...');
  resolvedBaseUrl = null;
  isResolvingBaseUrl = false;
  const newBaseUrl = await getBaseUrl();
  api.defaults.baseURL = newBaseUrl;
  return newBaseUrl;
};

export const getCurrentBaseUrl = (): string | null => {
  return resolvedBaseUrl;
};

export const getCurrentApiBaseUrl = (): string => {
  return getApiBaseUrl();
};

export const initializeApi = async (): Promise<void> => {
  try {
    console.log('🏁 Initializing API...');
    const baseUrl = await getBaseUrl();
    api.defaults.baseURL = baseUrl;
    console.log('✅ API initialization complete with base URL:', baseUrl);
  } catch (error) {
    console.error('❌ API initialization failed:', error);
  }
};

export const updateResolvedBaseUrl = (newBaseUrl: string): void => {
  try {
    resolvedBaseUrl = newBaseUrl;
    api.defaults.baseURL = newBaseUrl;
    console.log('📍 Updated resolved base URL to:', newBaseUrl);
  } catch (error) {
    console.error('❌ Error updating resolved base URL:', error);
  }
};

export default api;
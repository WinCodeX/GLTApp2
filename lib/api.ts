import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const LOCAL_BASE_1 = 'http://192.168.100.73:3000';
const LOCAL_BASE_2 = 'http://10.21.135.106:3000'; // Fixed to match your first working version
const PROD_BASE = 'https://glt-53x8.onrender.com'; // Using your production URL
const FALLBACK_BASE = PROD_BASE; // Use production as fallback when no servers are reachable

let resolvedBaseUrl: string | null = null;
let isResolvingBaseUrl = false;

// ✅ FIXED: Export API_BASE_URL for compatibility with avatar components
export const API_BASE_URL = (() => {
  // Return the resolved URL if available, otherwise return a sensible default
  if (resolvedBaseUrl) {
    return `${resolvedBaseUrl}/api/v1`;
  }
  
  // Default based on environment while base URL is being resolved
  const isDev = __DEV__;
  if (isDev) {
    return `${LOCAL_BASE_1}/api/v1`;
  } else {
    return `${PROD_BASE}/api/v1`;
  }
})();

// ✅ FIXED: Safe function to get current API base URL
export const getApiBaseUrl = (): string => {
  try {
    if (resolvedBaseUrl) {
      return `${resolvedBaseUrl}/api/v1`;
    }
    
    // Fallback to environment-appropriate default
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

// ✅ FIXED: Safe function to get base domain for avatar URLs
export const getBaseDomain = (): string => {
  try {
    if (resolvedBaseUrl) {
      return resolvedBaseUrl;
    }
    
    // Fallback to environment-appropriate default
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

// ✅ FIXED: Safe avatar URL helper that works with dynamic base URLs
export const getFullAvatarUrl = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;
  
  try {
    // If it's already a full URL, return as-is
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    // Get the current base domain
    const baseUrl = getBaseDomain();
    
    // If it's a relative URL starting with /, combine with base URL
    if (avatarUrl.startsWith('/')) {
      return `${baseUrl}${avatarUrl}`;
    }
    
    // If it's just a path fragment, build the full URL
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
      // Don't use the main api instance to avoid interceptor loops
      headers: { 'Content-Type': 'application/json' }
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
  // If already resolved, return immediately
  if (resolvedBaseUrl) {
    console.log(`📍 Using cached base URL: ${resolvedBaseUrl}`);
    return resolvedBaseUrl;
  }

  // Prevent multiple concurrent resolutions
  if (isResolvingBaseUrl) {
    console.log('⏳ Base URL resolution already in progress...');
    // Wait for the current resolution to complete (max 10 seconds)
    let waitTime = 0;
    while (isResolvingBaseUrl && !resolvedBaseUrl && waitTime < 10000) {
      await new Promise(resolve => setTimeout(resolve, 200));
      waitTime += 200;
    }
    return resolvedBaseUrl || FALLBACK_BASE;
  }

  isResolvingBaseUrl = true;
  console.log('🚀 Starting base URL resolution...');

  // Try in order of preference: local servers first (for development), then production
  const bases = [LOCAL_BASE_1, LOCAL_BASE_2, PROD_BASE];

  try {
    // Test connections sequentially to prioritize local development servers
    for (const base of bases) {
      if (await testConnection(base, 2000)) {
        resolvedBaseUrl = base;
        console.log(`🎯 Selected base URL: ${resolvedBaseUrl} ${base.includes('localhost') || base.includes('192.168') || base.includes('10.') ? '(local dev server)' : '(production)'}`);
        break;
      }
    }

    if (!resolvedBaseUrl) {
      resolvedBaseUrl = FALLBACK_BASE;
      console.log(`⚠️ No servers reachable, using fallback: ${resolvedBaseUrl}`);
    } else {
      console.log(`🎯 Selected base URL: ${resolvedBaseUrl}`);
    }
  } catch (error) {
    console.error('❌ Error during base URL resolution:', error);
    resolvedBaseUrl = FALLBACK_BASE;
  } finally {
    isResolvingBaseUrl = false;
  }

  return resolvedBaseUrl;
};

// Create the main API instance
const api = axios.create({
  baseURL: PROD_BASE, // Start with production URL
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    try {
      // Get authentication token
      const token = await SecureStore.getItemAsync('auth_token');

      // Only resolve base URL if we haven't already or if explicitly requested
      if (!resolvedBaseUrl) {
        const baseUrl = await getBaseUrl();
        config.baseURL = baseUrl;
      } else {
        config.baseURL = resolvedBaseUrl;
      }

      // Add auth header if token exists
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      console.log(`📡 Making request to: ${config.baseURL}${config.url}`);
      return config;
    } catch (error) {
      console.error('❌ Request interceptor error:', error);
      // Don't fail the request completely, use fallback
      config.baseURL = FALLBACK_BASE;
      return config;
    }
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Request successful: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error.response?.status;

    console.error(`❌ Request failed: ${config?.method?.toUpperCase()} ${config?.url} - Status: ${status}`);

    // Handle 401 Unauthorized
    if (status === 401) {
      console.log('🔐 Unauthorized - clearing auth token');
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_id');
      await SecureStore.deleteItemAsync('user_role');
      
      Toast.show({ 
        type: 'error', 
        text1: 'Session expired',
        text2: 'Please log in again'
      });
      
      setTimeout(() => {
        router.replace('/login');
      }, 2000);
      
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
          // Connected to internet but server unreachable
          console.log('📡 Internet connected but server unreachable');
          
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

// Export a function to manually refresh the base URL
export const refreshBaseUrl = async (): Promise<string> => {
  console.log('🔄 Manually refreshing base URL...');
  resolvedBaseUrl = null;
  isResolvingBaseUrl = false; // Reset the flag
  const newBaseUrl = await getBaseUrl();
  
  // ✅ FIXED: Update the API instance baseURL when URL changes
  api.defaults.baseURL = newBaseUrl;
  
  return newBaseUrl;
};

// Export a function to get current base URL without making requests
export const getCurrentBaseUrl = (): string | null => {
  return resolvedBaseUrl;
};

// ✅ FIXED: Function to get current resolved base URL for components
export const getCurrentApiBaseUrl = (): string => {
  return getApiBaseUrl();
};

// Function to initialize API (call this when app starts, not during module load)
export const initializeApi = async (): Promise<void> => {
  try {
    console.log('🏁 Initializing API...');
    const baseUrl = await getBaseUrl();
    
    // ✅ FIXED: Update the API instance baseURL after resolution
    api.defaults.baseURL = baseUrl;
    
    console.log('✅ API initialization complete with base URL:', baseUrl);
  } catch (error) {
    console.error('❌ API initialization failed:', error);
  }
};

// ✅ FIXED: Helper to update resolved base URL (for when servers come online)
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
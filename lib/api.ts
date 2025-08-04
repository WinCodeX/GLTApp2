import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const LOCAL_BASE_1 = 'http://192.168.100.73:3000';
const LOCAL_BASE_2 = 'http://10.193.211.106:3000';
const PROD_BASE = 'https://your-production-server.com'; // Add your production URL
const FALLBACK_BASE = LOCAL_BASE_1; // Fallback to first local server

let resolvedBaseUrl: string | null = null;
let isResolvingBaseUrl = false;

const testConnection = async (baseUrl: string, timeout = 2000): Promise<boolean> => {
  try {
    console.log(`🔍 Testing connection to: ${baseUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await axios.get(`${baseUrl}/api/v1/ping`, {
      timeout,
      signal: controller.signal,
      // Don't use interceptors for this test
      transformRequest: [(data) => data],
      transformResponse: [(data) => data],
    });
    
    clearTimeout(timeoutId);
    
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
    // Wait for the current resolution to complete
    while (isResolvingBaseUrl && !resolvedBaseUrl) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return resolvedBaseUrl || FALLBACK_BASE;
  }

  isResolvingBaseUrl = true;
  console.log('🚀 Starting base URL resolution...');

  const bases = [LOCAL_BASE_1, LOCAL_BASE_2];
  
  // Add production base only if it's not empty
  if (PROD_BASE && PROD_BASE.trim() !== '') {
    bases.push(PROD_BASE);
  }

  try {
    // Test connections in parallel for faster resolution
    const connectionTests = bases.map(async (base) => ({
      url: base,
      connected: await testConnection(base, 3000)
    }));

    const results = await Promise.all(connectionTests);
    const workingServer = results.find(result => result.connected);

    if (workingServer) {
      resolvedBaseUrl = workingServer.url;
      console.log(`🎯 Selected base URL: ${resolvedBaseUrl}`);
    } else {
      resolvedBaseUrl = FALLBACK_BASE;
      console.log(`⚠️ No servers reachable, using fallback: ${resolvedBaseUrl}`);
      
      // Show user-friendly message
      Toast.show({
        type: 'error',
        text1: 'Server Connection Issue',
        text2: 'Using fallback server. Some features may not work.',
        visibilityTime: 4000,
      });
    }
  } catch (error) {
    console.error('❌ Error during base URL resolution:', error);
    resolvedBaseUrl = FALLBACK_BASE;
  } finally {
    isResolvingBaseUrl = false;
  }

  return resolvedBaseUrl;
};

// Initialize base URL resolution early
const initializeApi = async () => {
  try {
    await getBaseUrl();
    console.log('🏁 API initialization complete');
  } catch (error) {
    console.error('❌ API initialization failed:', error);
  }
};

// Call this when your app starts
initializeApi();

const api = axios.create({
  timeout: 15000, // Increased timeout
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

      // Ensure base URL is resolved
      const baseUrl = await getBaseUrl();
      config.baseURL = baseUrl;

      // Add auth header if token exists
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      console.log(`📡 Making request to: ${baseUrl}${config.url}`);
      return config;
    } catch (error) {
      console.error('❌ Request interceptor error:', error);
      return Promise.reject(error);
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
      console.log('🌐 Checking network connectivity...');
      
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
          console.log('📡 Internet connected but server unreachable - trying to resolve new base URL');
          
          // Reset resolved URL to force re-detection
          resolvedBaseUrl = null;
          
          Toast.show({
            type: 'error',
            text1: 'Server Unreachable',
            text2: 'Trying to reconnect...',
            visibilityTime: 3000,
          });
          
          // Try to resolve base URL again
          setTimeout(() => {
            getBaseUrl();
          }, 1000);
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
  return await getBaseUrl();
};

// Export a function to get current base URL without making requests
export const getCurrentBaseUrl = (): string | null => {
  return resolvedBaseUrl;
};

export default api;
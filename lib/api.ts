// lib/api.ts - Fixed to redirect to login screen on session expiration
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { accountManager } from './AccountManager';
import { NavigationContainerRef, CommonActions } from '@react-navigation/native';

const LOCAL_BASE_1 = 'http://192.168.100.73:3000';
const LOCAL_BASE_2 = 'http://10.209.20.106:3000';
const PROD_BASE = 'https://glt-53x8.onrender.com';
const FALLBACK_BASE = PROD_BASE;

let resolvedBaseUrl: string | null = null;
let isResolvingBaseUrl = false;

// Navigation reference for handling redirects
let navigationRef: NavigationContainerRef<any> | null = null;

// Function to set navigation reference
export const setNavigationRef = (ref: NavigationContainerRef<any>) => {
  navigationRef = ref;
};

// Function to navigate to login screen
const navigateToLogin = () => {
  if (navigationRef && navigationRef.isReady()) {
    try {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
      console.log('🔄 Redirected to login screen due to session expiration');
    } catch (error) {
      console.error('❌ Navigation to login failed:', error);
      // Fallback: try simple navigate
      try {
        navigationRef.navigate('Login' as never);
      } catch (fallbackError) {
        console.error('❌ Fallback navigation failed:', fallbackError);
      }
    }
  } else {
    console.warn('⚠️ Navigation ref not available for redirect');
  }
};

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
        'Accept': 'application/json'
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

// Helper function to detect if request is a file upload
const isFileUpload = (config: any): boolean => {
  // Check if data is FormData (file upload)
  if (config.data && typeof config.data === 'object' && config.data.constructor?.name === 'FormData') {
    return true;
  }
  
  // Check if Content-Type is already set to multipart/form-data
  if (config.headers && config.headers['Content-Type']?.includes('multipart/form-data')) {
    return true;
  }
  
  return false;
};

// Helper to determine if error is genuinely authentication-related
const isGenuineAuthError = (error: any): boolean => {
  const errorMessage = error.response?.data?.message || error.response?.data?.error || '';
  const errorCode = error.response?.data?.code || '';
  
  // Check for specific JWT/authentication error indicators
  const jwtErrors = [
    'jwt expired',
    'jwt malformed', 
    'invalid token',
    'token expired',
    'unauthorized',
    'authentication failed',
    'invalid credentials',
    'session expired',
    'token invalid',
    'jwt decode error',
    'signature has expired',
    'jwt verification failed'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  const lowerCode = errorCode.toLowerCase();
  
  // Only treat as genuine auth error if message explicitly mentions JWT/token issues
  return jwtErrors.some(jwtError => 
    lowerMessage.includes(jwtError) || lowerCode.includes(jwtError)
  );
};

// Helper to check if endpoint is authentication-related
const isAuthEndpoint = (url: string): boolean => {
  const authEndpoints = ['/login', '/signup', '/logout', '/auth/', '/sessions'];
  return authEndpoints.some(endpoint => url.includes(endpoint));
};

// Create the main API instance with conditional headers
const api = axios.create({
  baseURL: PROD_BASE,
  timeout: 15000,
  headers: {
    'Accept': 'application/json', // Accept JSON responses by default
  },
});

// Request interceptor that properly handles file uploads
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

      // Only set JSON headers for non-file uploads
      const isUpload = isFileUpload(config);
      
      if (config.headers) {
        // Always accept JSON responses
        config.headers['Accept'] = 'application/json';
        
        // Only set Content-Type to JSON if it's NOT a file upload
        if (!isUpload && !config.headers['Content-Type']) {
          config.headers['Content-Type'] = 'application/json';
        }
        
        console.log(`📡 Request type: ${isUpload ? 'FILE UPLOAD' : 'JSON'}`);
        if (isUpload) {
          console.log('📎 Preserving multipart/form-data headers for file upload');
        }
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
      
      // Only set JSON headers if not a file upload
      if (config.headers && !isFileUpload(config)) {
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

// Response interceptor with session expiration redirect
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

    // Log detailed error information for debugging
    if (error.response?.data) {
      console.error('❌ Error response data:', error.response.data);
    }

    // Log response content type for debugging HTML/JSON issues
    if (error.response?.headers?.['content-type']) {
      const contentType = error.response.headers['content-type'];
      console.error(`❌ Error response content-type: ${contentType}`);
      
      if (contentType.includes('text/html')) {
        console.error('🚨 Server returned HTML instead of JSON! Check your API endpoint and headers.');
      }
    }

    // Handle authentication errors with redirect to login
    if (status === 401 || status === 422) {
      const url = config?.url || '';
      const isAuthRequest = isAuthEndpoint(url);
      const isGenuineAuth = isGenuineAuthError(error);
      
      console.log(`🔍 Analyzing ${status} error:`, {
        url,
        isAuthRequest,
        isGenuineAuth,
        errorMessage: error.response?.data?.message,
        errorCode: error.response?.data?.code
      });

      // Handle genuine authentication errors with redirect
      if (isGenuineAuth && currentAccount) {
        console.log('🔐 Session expired - redirecting to login');
        
        try {
          // Remove the invalid account
          await accountManager.removeAccount(currentAccount.id);
          
          // Show toast notification
          Toast.show({ 
            type: 'error', 
            text1: 'Session Expired',
            text2: 'Please log in again',
            visibilityTime: 3000
          });
          
          // Redirect to login screen
          setTimeout(() => {
            navigateToLogin();
          }, 1000); // Small delay to ensure toast is visible
          
        } catch (removeError) {
          console.error('❌ Failed to remove invalid account:', removeError);
          
          // Still redirect to login even if account removal fails
          Toast.show({ 
            type: 'error', 
            text1: 'Session Expired',
            text2: 'Please log in again',
            visibilityTime: 3000
          });
          
          setTimeout(() => {
            navigateToLogin();
          }, 1000);
        }
      } else if (isGenuineAuth && !currentAccount) {
        // No current account but authentication error - redirect to login
        console.log('🔐 Authentication required - redirecting to login');
        
        Toast.show({ 
          type: 'info', 
          text1: 'Login Required',
          text2: 'Please log in to continue',
          visibilityTime: 3000
        });
        
        setTimeout(() => {
          navigateToLogin();
        }, 1000);
      } else if (!isAuthRequest) {
        // Handle non-authentication 401/422 errors gracefully
        console.log('⚠️ Non-authentication error - showing error message');
        
        const errorMessage = error.response?.data?.message || 'Request failed';
        Toast.show({
          type: 'error',
          text1: 'Request Failed',
          text2: errorMessage,
          visibilityTime: 4000,
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
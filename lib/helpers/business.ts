// lib/helpers/business.ts - IMPROVED VERSION with Better Cache Management
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from '../api';

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

interface BusinessData {
  name: string;
  phone_number?: string;
  category_ids?: number[];
  categories?: string[]; // Legacy support
}

interface UpdateBusinessData {
  name: string;
  phone_number?: string;
  category_ids?: number[];
}

const CATEGORIES_CACHE_KEY = '@business_categories';
const CATEGORIES_CACHE_EXPIRY = '@categories_cache_expiry';
const CACHE_DURATION = 1 * 60 * 60 * 1000; // Reduced to 1 hour for more frequent updates

// Get auth token with proper error handling
const getAuthToken = async (): Promise<string> => {
  try {
    const token = await SecureStore.getItemAsync("auth_token");
    
    if (!token) {
      throw new Error('AUTH_REQUIRED');
    }
    
    return token;
  } catch (error: any) {
    console.error('Failed to get auth token:', error);
    throw new Error('AUTH_REQUIRED');
  }
};

// Check if error is authentication related
const isAuthenticationError = (error: any): boolean => {
  return error.response?.status === 401 || 
         error.response?.status === 403 ||
         error.message === 'AUTH_REQUIRED';
};

// Check if error is a validation error
const isValidationError = (error: any): boolean => {
  return error.response?.status === 422;
};

// IMPROVED: Clear categories cache with better error handling
export const clearCategoriesCache = async (): Promise<void> => {
  try {
    console.log('🗑️ Clearing categories cache...');
    await AsyncStorage.multiRemove([CATEGORIES_CACHE_KEY, CATEGORIES_CACHE_EXPIRY]);
    console.log('✅ Categories cache cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing categories cache:', error);
    // Try individual removal as fallback
    try {
      await AsyncStorage.removeItem(CATEGORIES_CACHE_KEY);
      await AsyncStorage.removeItem(CATEGORIES_CACHE_EXPIRY);
      console.log('✅ Categories cache cleared using fallback method');
    } catch (fallbackError) {
      console.error('❌ Fallback cache clear also failed:', fallbackError);
    }
  }
};

// IMPROVED: Cache categories with validation and error handling
const cacheCategories = async (categories: Category[]): Promise<void> => {
  try {
    if (!Array.isArray(categories) || categories.length === 0) {
      console.warn('⚠️ Attempted to cache invalid or empty categories array');
      return;
    }

    // Validate categories structure
    const validCategories = categories.filter(cat => 
      cat && typeof cat.id === 'number' && typeof cat.name === 'string'
    );

    if (validCategories.length !== categories.length) {
      console.warn('⚠️ Some categories had invalid structure and were filtered out');
    }

    const cacheData = JSON.stringify(validCategories);
    const expiry = Date.now() + CACHE_DURATION;
    
    await AsyncStorage.multiSet([
      [CATEGORIES_CACHE_KEY, cacheData],
      [CATEGORIES_CACHE_EXPIRY, expiry.toString()]
    ]);
    
    console.log(`✅ Cached ${validCategories.length} categories successfully`);
  } catch (error) {
    console.error('❌ Error caching categories:', error);
    // Don't throw error - caching failure shouldn't break the flow
  }
};

// IMPROVED: Get cached categories with better validation
const getCachedCategories = async (): Promise<Category[]> => {
  try {
    const [cachedData, expiryStr] = await AsyncStorage.multiGet([
      CATEGORIES_CACHE_KEY,
      CATEGORIES_CACHE_EXPIRY
    ]);
    
    const categoriesData = cachedData[1];
    const expiry = expiryStr[1];
    
    if (!categoriesData || !expiry) {
      console.log('📭 No cached categories found');
      return [];
    }
    
    const expiryTime = parseInt(expiry, 10);
    const now = Date.now();
    
    if (isNaN(expiryTime) || now > expiryTime) {
      console.log('⏰ Categories cache expired or invalid');
      await clearCategoriesCache();
      return [];
    }
    
    const categories: Category[] = JSON.parse(categoriesData);
    
    // Validate cached data structure
    if (!Array.isArray(categories)) {
      console.warn('⚠️ Cached categories data is not an array, clearing cache');
      await clearCategoriesCache();
      return [];
    }

    // Validate each category has required fields
    const validCategories = categories.filter(cat => 
      cat && typeof cat.id === 'number' && typeof cat.name === 'string'
    );

    if (validCategories.length === 0) {
      console.warn('⚠️ No valid categories in cache, clearing cache');
      await clearCategoriesCache();
      return [];
    }

    console.log(`📦 Retrieved ${validCategories.length} cached categories`);
    return validCategories;
  } catch (error) {
    console.error('❌ Error reading cached categories:', error);
    // Clear potentially corrupted cache
    await clearCategoriesCache();
    return [];
  }
};

// COMPLETELY REWRITTEN: Fetch categories with aggressive cache clearing and fresh data guarantee
export const fetchCategories = async (forceRefresh = false): Promise<Category[]> => {
  try {
    console.log(`🔄 Fetching categories (forceRefresh: ${forceRefresh})...`);

    // ALWAYS clear cache when force refresh is requested
    if (forceRefresh) {
      console.log('🗑️ Force refresh requested - clearing all cached data');
      await clearCategoriesCache();
    } else {
      // Check cache first only if not forcing refresh
      const cachedCategories = await getCachedCategories();
      if (cachedCategories.length > 0) {
        console.log(`📦 Using ${cachedCategories.length} cached categories`);
        return cachedCategories;
      }
    }

    console.log('🌐 Fetching fresh categories from server...');
    
    // Get auth token
    const token = await getAuthToken();
    
    const response = await api.get('/api/v1/categories', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000, // Increased timeout for server requests
    });
    
    console.log('📡 Categories API response:', {
      status: response.status,
      success: response.data?.success,
      dataType: typeof response.data?.data,
      dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'not array'
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch categories');
    }

    const categories: Category[] = response.data.data || [];
    
    if (!Array.isArray(categories)) {
      throw new Error('Invalid categories data format received from server');
    }

    if (categories.length === 0) {
      console.warn('⚠️ Server returned empty categories array');
      return [];
    }

    // Validate categories structure
    const validCategories = categories.filter(cat => 
      cat && 
      typeof cat.id === 'number' && 
      typeof cat.name === 'string' &&
      cat.id > 0 &&
      cat.name.trim().length > 0
    );

    if (validCategories.length === 0) {
      throw new Error('No valid categories received from server');
    }

    console.log(`✅ Successfully fetched ${validCategories.length} categories from server`);
    console.log('📋 Category IDs:', validCategories.map(c => c.id));
    console.log('📋 Category names:', validCategories.map(c => c.name));
    
    // Cache the fresh categories
    await cacheCategories(validCategories);
    
    return validCategories;
  } catch (error: any) {
    console.error('❌ Fetch Categories Error:', error?.response?.data || error?.message);
    
    // Handle authentication errors
    if (isAuthenticationError(error)) {
      console.log('🔐 Authentication error - clearing cache and showing error');
      await clearCategoriesCache();
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please log in again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error('Session expired. Please log in again.');
    }
    
    // For other errors, try to return cached categories ONLY if not force refreshing
    if (!forceRefresh) {
      const cachedCategories = await getCachedCategories();
      if (cachedCategories.length > 0) {
        console.log('⚠️ Using cached categories as fallback due to server error');
        
        Toast.show({
          type: 'warning',
          text1: 'Using cached categories',
          text2: 'Could not fetch latest categories',
          position: 'bottom',
          visibilityTime: 3000,
        });
        
        return cachedCategories;
      }
    }
    
    // No cache available or force refresh failed
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        error?.message || 
                        'Failed to fetch categories';
    
    console.error('❌ No fallback available, throwing error:', errorMessage);
    
    Toast.show({
      type: 'error',
      text1: 'Failed to load categories',
      text2: errorMessage,
      position: 'bottom',
      visibilityTime: 4000,
    });
    
    throw error;
  }
};

// IMPROVED: Create business with cache clearing on successful creation
export const createBusiness = async (businessData: string | BusinessData) => {
  try {
    console.log('🏢 Starting business creation process...');
    
    // Get auth token with verification
    const token = await getAuthToken();
    console.log('🔐 Found auth token for business creation');

    // Handle both legacy string input and new object input
    let requestData: any;
    
    if (typeof businessData === 'string') {
      // Legacy: just a name string
      requestData = { business: { name: businessData } };
    } else {
      // New: object with name, phone_number, and category_ids
      requestData = {
        business: {
          name: businessData.name,
          ...(businessData.phone_number && { phone_number: businessData.phone_number }),
          ...(businessData.category_ids && businessData.category_ids.length > 0 && {
            category_ids: businessData.category_ids
          })
        }
      };
    }

    console.log('📤 Creating business with data:', JSON.stringify(requestData, null, 2));

    const response = await api.post('/api/v1/businesses', requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    
    console.log('📥 Business creation response:', {
      status: response.status,
      success: response.data?.success,
      hasData: !!response.data?.data
    });
    
    // Check if the response indicates success
    if (response.data.success) {
      console.log('✅ Business created successfully');
      
      // Clear categories cache to ensure fresh data on next fetch
      // (in case new categories were added or business affects category visibility)
      await clearCategoriesCache();
      console.log('🗑️ Cleared categories cache after business creation');
      
      return response.data;
    } else {
      // Server returned success=false
      throw new Error(response.data.message || 'Business creation failed');
    }
    
  } catch (error: any) {
    console.error('❌ Create Business Error:', error?.response?.data || error?.message);
    
    // Handle authentication errors specifically
    if (isAuthenticationError(error)) {
      console.log('🔐 Authentication failed during business creation');
      await clearCategoriesCache(); // Clear cache on auth failure
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please log in again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error('Session expired. Please log in again.');
    }
    
    // Handle validation errors (422) - DON'T redirect to login
    if (isValidationError(error)) {
      const errorMessage = error.response?.data?.message || 'Validation failed';
      const errorDetails = error.response?.data?.errors?.join(', ') || '';
      
      console.log('⚠️ Validation error during business creation:', errorMessage, errorDetails);
      
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: errorDetails || errorMessage,
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error(errorDetails || errorMessage);
    }
    
    // Handle network/connection errors
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network')) {
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Please check your connection and try again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error('Network error. Please check your connection and try again.');
    }
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      Toast.show({
        type: 'error',
        text1: 'Request Timeout',
        text2: 'Please try again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error('Request timeout. Please try again.');
    }
    
    // Handle server errors (500)
    if (error.response?.status >= 500) {
      Toast.show({
        type: 'error',
        text1: 'Server Error',
        text2: 'Please try again later',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error('Server error. Please try again later.');
    }
    
    // Enhanced error handling for other cases
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.errors?.join(', ') ||
                        error?.response?.data?.error || 
                        error?.message || 
                        'Failed to create business';
    
    Toast.show({
      type: 'error',
      text1: 'Failed to create business',
      text2: errorMessage,
      position: 'bottom',
      visibilityTime: 4000,
    });
    
    throw new Error(errorMessage);
  }
};

// UTILITY: Force refresh all cached data (useful for debugging)
export const clearAllBusinessCache = async (): Promise<void> => {
  try {
    console.log('🗑️ Clearing all business-related cache...');
    await clearCategoriesCache();
    // Add other cache clearing here if you have more cached data
    console.log('✅ All business cache cleared');
  } catch (error) {
    console.error('❌ Error clearing all business cache:', error);
  }
};

// Keep all other functions the same but export the cache functions
export const createInvite = async (businessId: number) => {
  try {
    console.log('🔗 Creating invite for business ID:', businessId);
    
    if (!businessId || isNaN(businessId)) {
      throw new Error('Invalid business ID');
    }
    
    const token = await getAuthToken();
    console.log('🔗 Auth token found for invite creation');
    
    const requestPayload = { business_id: businessId };
    console.log('🔗 Request payload:', requestPayload);
    
    const response = await api.post('/api/v1/invites', requestPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    
    console.log('🔗 Invite creation response:', response.data);
    
    // Handle various response formats
    if (response.data) {
      if (response.data.success && response.data.data?.code) {
        console.log('🔗 Invite created successfully (format 1):', response.data.data.code);
        return {
          success: true,
          data: response.data.data,
          code: response.data.data.code
        };
      }
      
      if (response.data.success && response.data.code) {
        console.log('🔗 Invite created successfully (format 2):', response.data.code);
        return {
          success: true,
          data: { code: response.data.code },
          code: response.data.code
        };
      }
      
      if (response.data.code) {
        console.log('🔗 Invite created successfully (legacy format):', response.data.code);
        return {
          success: true,
          data: { code: response.data.code },
          code: response.data.code
        };
      }
      
      if (response.data.success === false) {
        const errorMessage = response.data.message || response.data.error || 'Failed to create invite';
        throw new Error(errorMessage);
      }
    }
    
    console.error('🔗 Unexpected response format:', response.data);
    throw new Error('Unexpected response format from server');
    
  } catch (error: any) {
    console.error('🔗 Create Invite Error:', error?.response?.data || error?.message);
    
    if (isAuthenticationError(error)) {
      console.log('🔗 Authentication failed during invite creation');
      const errorMessage = 'Session expired. Please log in again.';
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please log in again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error(errorMessage);
    }
    
    if (isValidationError(error)) {
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Invalid business or permissions';
      
      console.log('🔗 Validation error during invite creation:', errorMessage);
      
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: errorMessage,
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error(errorMessage);
    }
    
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network')) {
      const errorMessage = 'Network error. Please check your connection.';
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Please check your connection and try again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error(errorMessage);
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const errorMessage = 'Request timeout. Please try again.';
      Toast.show({
        type: 'error',
        text1: 'Request Timeout',
        text2: 'Please try again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error(errorMessage);
    }
    
    if (error.response?.status >= 500) {
      const errorMessage = 'Server error. Please try again later.';
      Toast.show({
        type: 'error',
        text1: 'Server Error',
        text2: 'Please try again later',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error(errorMessage);
    }
    
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        error?.message || 
                        'Failed to generate invite code';
    
    console.log('🔗 Generic error during invite creation:', errorMessage);
    
    Toast.show({
      type: 'error',
      text1: 'Failed to generate invite',
      text2: errorMessage,
      position: 'bottom',
      visibilityTime: 4000,
    });
    
    throw new Error(errorMessage);
  }
};

// Keep other functions unchanged
export const joinBusiness = async (code: string) => {
  try {
    console.log('Joining business with code:', code);
    
    const token = await getAuthToken();
    
    const response = await api.post('/api/v1/invites/accept', { code }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    console.log('Join business response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('Join Business Error:', error?.response?.data || error?.message);
    
    if (isAuthenticationError(error)) {
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please log in again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error('Session expired. Please log in again.');
    }
    
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        'Invalid or expired invite code';
    
    Toast.show({
      type: 'error',
      text1: 'Failed to join business',
      text2: errorMessage,
      position: 'bottom',
      visibilityTime: 4000,
    });
    
    throw error;
  }
};

export const getBusinesses = async () => {
  try {
    console.log('Fetching businesses...');
    
    const token = await getAuthToken();
    
    const response = await api.get('/api/v1/businesses', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000,
    });
    
    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid business data received from server');
    }

    let businessData;
    if (response.data.data) {
      businessData = {
        owned: Array.isArray(response.data.data.owned) ? response.data.data.owned : [],
        joined: Array.isArray(response.data.data.joined) ? response.data.data.joined : []
      };
    } else {
      businessData = {
        owned: Array.isArray(response.data.owned) ? response.data.owned : [],
        joined: Array.isArray(response.data.joined) ? response.data.joined : []
      };
    }

    console.log('Businesses fetched successfully:', {
      owned: businessData.owned.length,
      joined: businessData.joined.length
    });

    return businessData;
  } catch (error: any) {
    console.error('Get Businesses Error:', error?.response?.data || error?.message);
    
    if (isAuthenticationError(error)) {
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please log in again',
        position: 'bottom',
        visibilityTime: 4000,
      });
      throw new Error('Session expired. Please log in again.');
    }
    
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network')) {
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Check your internet connection',
        position: 'bottom',
        visibilityTime: 4000,
      });
      return { owned: [], joined: [] };
    }
    
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        'Check your internet connection';
    
    Toast.show({
      type: 'error',
      text1: 'Failed to load businesses',
      text2: errorMessage,
      position: 'bottom',
      visibilityTime: 4000,
    });
    
    return { owned: [], joined: [] };
  }
};

export const validatePhoneNumber = (phoneNumber: string): boolean => {
  if (!phoneNumber.trim()) return false;
  
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length === 9) {
    return /^[17]\d{8}$/.test(cleaned);
  } else if (cleaned.length === 12) {
    return /^254[17]\d{8}$/.test(cleaned);
  }
  
  return false;
};

export const formatPhoneNumber = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length === 9) {
    return `+254${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('254')) {
    return `+${cleaned}`;
  }
  
  return phoneNumber;
};

export const updateBusiness = async (businessId: number, businessData: UpdateBusinessData) => {
  try {
    console.log('🏢 Starting business update process...', { businessId, businessData });
    
    if (!businessId || isNaN(businessId) || businessId <= 0) {
      throw new Error('Invalid business ID provided');
    }
    
    const token = await getAuthToken();
    console.log('🏢 Found auth token for business update');

    if (!businessData.name || !businessData.name.trim()) {
      throw new Error('Business name is required');
    }

    const requestData = {
      business: {
        name: businessData.name.trim(),
        ...(businessData.phone_number && businessData.phone_number.trim() && { 
          phone_number: formatPhoneNumber(businessData.phone_number.trim()) 
        }),
        ...(Array.isArray(businessData.category_ids) && {
          category_ids: businessData.category_ids
        })
      }
    };

    console.log('🏢 Request data being sent:', JSON.stringify(requestData, null, 2));

    const response = await api.patch(`/api/v1/businesses/${businessId}`, requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    
    console.log('🏢 Business update response status:', response.status);
    console.log('🏢 Business update response data:', response.data);
    
    if (response.data && response.data.success) {
      console.log('✅ Business update successful');
      return response.data;
    } else if (response.status === 200) {
      console.log('✅ Business update successful (200 OK)');
      return { success: true, data: response.data };
    } else {
      console.error('❌ Server returned success=false');
      throw new Error(response.data?.message || 'Business update failed');
    }
    
  } catch (error: any) {
    console.error('🏢 Update Business Error - Full Details:', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      url: error?.config?.url,
      method: error?.config?.method,
      requestData: error?.config?.data,
      responseHeaders: error?.response?.headers,
      responseData: error?.response?.data,
      message: error?.message,
      code: error?.code
    });
    
    if (error?.response?.status === 401) {
      console.error('🚨 401 UNAUTHORIZED - Token invalid or expired');
      throw new Error('Session expired. Please log in again.');
    }
    
    if (error?.response?.status === 403) {
      console.error('🚨 403 FORBIDDEN - User not authorized to edit this business');
      throw new Error('You are not authorized to edit this business. Only the business owner can make changes.');
    }
    
    if (error?.response?.status === 404) {
      console.error('🚨 404 NOT FOUND - Business or endpoint not found');
      throw new Error('Business not found. It may have been deleted or the business ID is invalid.');
    }
    
    if (error?.response?.status === 422) {
      const validationErrors = error.response?.data?.errors || [];
      const errorMessage = validationErrors.length > 0 
        ? validationErrors.join(', ') 
        : error.response?.data?.message || 'Validation failed';
      
      console.error('🚨 422 VALIDATION ERROR:', errorMessage);
      throw new Error(errorMessage);
    }
    
    if (error?.response?.headers?.['content-type']?.includes('text/html')) {
      console.error('🚨 SERVER RETURNED HTML - Route configuration issue');
      throw new Error('Server configuration error. The API endpoint may not be properly configured.');
    }
    
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
      console.error('🚨 NETWORK ERROR');
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      console.error('🚨 TIMEOUT ERROR');
      throw new Error('Request timeout. Please try again.');
    }
    
    if (error?.response?.status >= 500) {
      console.error('🚨 SERVER ERROR (5xx)');
      throw new Error('Server error. Please try again later.');
    }
    
    if (!error?.response && error?.request) {
      console.error('🚨 REQUEST ERROR - No response received');
      throw new Error('No response from server. Please check your connection.');
    }
    
    if (!error?.response && !error?.request) {
      console.error('🚨 REQUEST SETUP ERROR');
      throw new Error('Failed to set up request. Please try again.');
    }
    
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        error?.message || 
                        'Failed to update business. Please try again.';
    
    console.error('🚨 GENERIC ERROR:', errorMessage);
    throw new Error(errorMessage);
  }
};
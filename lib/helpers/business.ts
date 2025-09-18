// lib/helpers/business.ts - COMPLETE FIXED VERSION
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
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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

// Fetch categories from server with caching and auth verification
export const fetchCategories = async (forceRefresh = false): Promise<Category[]> => {
  try {
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cachedCategories = await getCachedCategories();
      if (cachedCategories.length > 0) {
        console.log('Using cached categories:', cachedCategories.length);
        return cachedCategories;
      }
    }

    console.log('Fetching categories from server...');
    
    // Get auth token
    const token = await getAuthToken();
    
    const response = await api.get('/api/v1/categories', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000, // 10 second timeout
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch categories');
    }

    const categories: Category[] = response.data.data || [];
    
    console.log('Categories fetched successfully:', categories.length);
    
    // Cache categories for future use
    await cacheCategories(categories);
    
    return categories;
  } catch (error: any) {
    console.error('Fetch Categories Error:', error?.response?.data || error?.message);
    
    // Handle authentication errors
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
    
    // Try to return cached categories as fallback for other errors
    const cachedCategories = await getCachedCategories();
    if (cachedCategories.length > 0) {
      console.log('Falling back to cached categories');
      
      Toast.show({
        type: 'warning',
        text1: 'Using cached categories',
        text2: 'Could not fetch latest categories',
        position: 'bottom',
        visibilityTime: 3000,
      });
      
      return cachedCategories;
    }
    
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        error?.message || 
                        'Failed to fetch categories';
    
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

// Cache categories in AsyncStorage
const cacheCategories = async (categories: Category[]): Promise<void> => {
  try {
    const cacheData = JSON.stringify(categories);
    const expiry = Date.now() + CACHE_DURATION;
    
    await AsyncStorage.multiSet([
      [CATEGORIES_CACHE_KEY, cacheData],
      [CATEGORIES_CACHE_EXPIRY, expiry.toString()]
    ]);
    
    console.log('Categories cached successfully');
  } catch (error) {
    console.error('Error caching categories:', error);
  }
};

// Get cached categories if they exist and are not expired
const getCachedCategories = async (): Promise<Category[]> => {
  try {
    const [cachedData, expiryStr] = await AsyncStorage.multiGet([
      CATEGORIES_CACHE_KEY,
      CATEGORIES_CACHE_EXPIRY
    ]);
    
    const categoriesData = cachedData[1];
    const expiry = expiryStr[1];
    
    if (!categoriesData || !expiry) {
      return [];
    }
    
    const expiryTime = parseInt(expiry, 10);
    const now = Date.now();
    
    if (now > expiryTime) {
      console.log('Categories cache expired');
      await clearCategoriesCache();
      return [];
    }
    
    const categories: Category[] = JSON.parse(categoriesData);
    return categories;
  } catch (error) {
    console.error('Error reading cached categories:', error);
    return [];
  }
};

// Clear categories cache
export const clearCategoriesCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([CATEGORIES_CACHE_KEY, CATEGORIES_CACHE_EXPIRY]);
    console.log('Categories cache cleared');
  } catch (error) {
    console.error('Error clearing categories cache:', error);
  }
};

// Create a new business with proper error handling
export const createBusiness = async (businessData: string | BusinessData) => {
  try {
    console.log('Starting business creation process...');
    
    // Get auth token with verification
    const token = await getAuthToken();
    console.log('Found auth token for business creation');

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

    console.log('Creating business with data:', requestData);

    const response = await api.post('/api/v1/businesses', requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 second timeout
    });
    
    console.log('Business creation response:', response.data);
    
    // Check if the response indicates success
    if (response.data.success) {
      return response.data;
    } else {
      // Server returned success=false
      throw new Error(response.data.message || 'Business creation failed');
    }
    
  } catch (error: any) {
    console.error('Create Business Error:', error?.response?.data || error?.message);
    
    // Handle authentication errors specifically
    if (isAuthenticationError(error)) {
      console.log('Authentication failed during business creation');
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
      
      console.log('Validation error during business creation:', errorMessage, errorDetails);
      
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

// Fixed invite generation with better error handling and response parsing
export const createInvite = async (businessId: number) => {
  try {
    console.log('🔗 Creating invite for business ID:', businessId);
    
    if (!businessId || isNaN(businessId)) {
      throw new Error('Invalid business ID');
    }
    
    // Get auth token with verification
    const token = await getAuthToken();
    console.log('🔗 Auth token found for invite creation');
    
    const requestPayload = { business_id: businessId };
    console.log('🔗 Request payload:', requestPayload);
    
    const response = await api.post('/api/v1/invites', requestPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 second timeout
    });
    
    console.log('🔗 Invite creation response:', response.data);
    
    // Handle various response formats
    if (response.data) {
      // Format 1: { success: true, data: { code: "abc123" } }
      if (response.data.success && response.data.data?.code) {
        console.log('🔗 Invite created successfully (format 1):', response.data.data.code);
        return {
          success: true,
          data: response.data.data,
          code: response.data.data.code
        };
      }
      
      // Format 2: { success: true, code: "abc123" }
      if (response.data.success && response.data.code) {
        console.log('🔗 Invite created successfully (format 2):', response.data.code);
        return {
          success: true,
          data: { code: response.data.code },
          code: response.data.code
        };
      }
      
      // Format 3: { code: "abc123" } (legacy)
      if (response.data.code) {
        console.log('🔗 Invite created successfully (legacy format):', response.data.code);
        return {
          success: true,
          data: { code: response.data.code },
          code: response.data.code
        };
      }
      
      // Format 4: { success: false, message: "error" }
      if (response.data.success === false) {
        const errorMessage = response.data.message || response.data.error || 'Failed to create invite';
        throw new Error(errorMessage);
      }
    }
    
    // If none of the expected formats match
    console.error('🔗 Unexpected response format:', response.data);
    throw new Error('Unexpected response format from server');
    
  } catch (error: any) {
    console.error('🔗 Create Invite Error:', error?.response?.data || error?.message);
    
    // Handle authentication errors
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
    
    // Handle validation errors
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
    
    // Handle network/connection errors
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
    
    // Handle timeout errors
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
    
    // Handle server errors
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
    
    // Handle other errors
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

// Join a business via invite code with proper error handling
export const joinBusiness = async (code: string) => {
  try {
    console.log('Joining business with code:', code);
    
    // Get auth token with verification
    const token = await getAuthToken();
    
    const response = await api.post('/api/v1/invites/accept', { code }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });
    
    console.log('Join business response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('Join Business Error:', error?.response?.data || error?.message);
    
    // Handle authentication errors
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

// Fetch both owned and joined businesses with proper error handling
export const getBusinesses = async () => {
  try {
    console.log('Fetching businesses...');
    
    // Get auth token with verification
    const token = await getAuthToken();
    
    const response = await api.get('/api/v1/businesses', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000, // 10 second timeout
    });
    
    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid business data received from server');
    }

    // Handle both old and new API response formats
    let businessData;
    if (response.data.data) {
      // New format with success flag and data wrapper
      businessData = {
        owned: Array.isArray(response.data.data.owned) ? response.data.data.owned : [],
        joined: Array.isArray(response.data.data.joined) ? response.data.data.joined : []
      };
    } else {
      // Legacy format
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
    
    // Handle authentication errors
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
    
    // Handle network/connection errors
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network')) {
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Check your internet connection',
        position: 'bottom',
        visibilityTime: 4000,
      });
      // Return safe fallback for network errors
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
    
    // Return safe fallback
    return { owned: [], joined: [] };
  }
};

// Utility function to validate phone number
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  if (!phoneNumber.trim()) return false;
  
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a valid Kenyan number
  // Should be 9 digits (without country code) or 12 digits (with +254)
  if (cleaned.length === 9) {
    // Local format: 712345678
    return /^[17]\d{8}$/.test(cleaned);
  } else if (cleaned.length === 12) {
    // International format: 254712345678
    return /^254[17]\d{8}$/.test(cleaned);
  }
  
  return false;
};

// Utility function to format phone number
export const formatPhoneNumber = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length === 9) {
    // Add +254 prefix
    return `+254${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('254')) {
    // Add + prefix
    return `+${cleaned}`;
  }
  
  return phoneNumber;
};

// COMPLETELY FIXED: updateBusiness function with comprehensive error handling
export const updateBusiness = async (businessId: number, businessData: UpdateBusinessData) => {
  try {
    console.log('🏢 Starting business update process...', { businessId, businessData });
    
    // CRITICAL: Validate business ID
    if (!businessId || isNaN(businessId) || businessId <= 0) {
      throw new Error('Invalid business ID provided');
    }
    
    // Get auth token with verification
    const token = await getAuthToken();
    console.log('🏢 Found auth token for business update');

    // CRITICAL: Validate required data
    if (!businessData.name || !businessData.name.trim()) {
      throw new Error('Business name is required');
    }

    // Prepare request data - match backend expectations exactly
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
    console.log('🏢 Using endpoint:', `/api/v1/businesses/${businessId}`);
    console.log('🏢 Request headers will include:', { 'Authorization': 'Bearer [TOKEN]', 'Content-Type': 'application/json' });

    // Make the API request with detailed logging
    const response = await api.patch(`/api/v1/businesses/${businessId}`, requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    
    console.log('🏢 Business update response status:', response.status);
    console.log('🏢 Business update response data:', response.data);
    
    // Check if the response indicates success
    if (response.data && response.data.success) {
      console.log('✅ Business update successful');
      return response.data;
    } else if (response.status === 200) {
      // Some APIs return 200 without explicit success flag
      console.log('✅ Business update successful (200 OK)');
      return { success: true, data: response.data };
    } else {
      // Server returned success=false
      console.error('❌ Server returned success=false');
      throw new Error(response.data?.message || 'Business update failed');
    }
    
  } catch (error: any) {
    // COMPREHENSIVE ERROR LOGGING
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
    
    // SPECIFIC ERROR HANDLING WITH CLEAR MESSAGES
    
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
    
    // Check if server returned HTML instead of JSON (routing/config issue)
    if (error?.response?.headers?.['content-type']?.includes('text/html')) {
      console.error('🚨 SERVER RETURNED HTML - Route configuration issue');
      throw new Error('Server configuration error. The API endpoint may not be properly configured.');
    }
    
    // Network/timeout errors
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
      console.error('🚨 NETWORK ERROR');
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      console.error('🚨 TIMEOUT ERROR');
      throw new Error('Request timeout. Please try again.');
    }
    
    // Server errors (5xx)
    if (error?.response?.status >= 500) {
      console.error('🚨 SERVER ERROR (5xx)');
      throw new Error('Server error. Please try again later.');
    }
    
    // Axios request configuration errors
    if (!error?.response && error?.request) {
      console.error('🚨 REQUEST ERROR - No response received');
      throw new Error('No response from server. Please check your connection.');
    }
    
    if (!error?.response && !error?.request) {
      console.error('🚨 REQUEST SETUP ERROR');
      throw new Error('Failed to set up request. Please try again.');
    }
    
    // Generic error fallback
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        error?.message || 
                        'Failed to update business. Please try again.';
    
    console.error('🚨 GENERIC ERROR:', errorMessage);
    throw new Error(errorMessage);
  }
};
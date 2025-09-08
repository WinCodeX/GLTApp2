// lib/helpers/business.ts - Updated with categories fetch and phone number support
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const CATEGORIES_CACHE_KEY = '@business_categories';
const CATEGORIES_CACHE_EXPIRY = '@categories_cache_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fetch categories from server with caching
export const fetchCategories = async (forceRefresh = false): Promise<Category[]> => {
  try {
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cachedCategories = await getCachedCategories();
      if (cachedCategories.length > 0) {
        console.log('🏷️ Using cached categories:', cachedCategories.length);
        return cachedCategories;
      }
    }

    console.log('🏷️ Fetching categories from server...');
    
    const response = await api.get('/api/v1/categories');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch categories');
    }

    const categories: Category[] = response.data.data || [];
    
    console.log('🏷️ Categories fetched successfully:', categories.length);
    
    // Cache categories for future use
    await cacheCategories(categories);
    
    return categories;
  } catch (error: any) {
    console.error('❌ Fetch Categories Error:', error?.response?.data || error?.message);
    
    // Try to return cached categories as fallback
    const cachedCategories = await getCachedCategories();
    if (cachedCategories.length > 0) {
      console.log('🏷️ Falling back to cached categories');
      
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
    
    console.log('🏷️ Categories cached successfully');
  } catch (error) {
    console.error('❌ Error caching categories:', error);
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
      console.log('🏷️ Categories cache expired');
      await clearCategoriesCache();
      return [];
    }
    
    const categories: Category[] = JSON.parse(categoriesData);
    return categories;
  } catch (error) {
    console.error('❌ Error reading cached categories:', error);
    return [];
  }
};

// Clear categories cache
export const clearCategoriesCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([CATEGORIES_CACHE_KEY, CATEGORIES_CACHE_EXPIRY]);
    console.log('🏷️ Categories cache cleared');
  } catch (error) {
    console.error('❌ Error clearing categories cache:', error);
  }
};

// Create a new business - Updated to handle phone number and category IDs
export const createBusiness = async (businessData: string | BusinessData) => {
  try {
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

    console.log('🏢 Creating business with data:', requestData);

    const response = await api.post('/api/v1/businesses', requestData);
    
    console.log('🏢 Business creation response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Create Business Error:', error?.response?.data || error?.message);
    
    // Enhanced error handling
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
    
    throw error;
  }
};

// Generate an invite code for a business
export const createInvite = async (businessId: number) => {
  try {
    console.log('🔗 Creating invite for business ID:', businessId);
    
    const response = await api.post('/api/v1/invites', { business_id: businessId });
    
    console.log('🔗 Invite creation response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Create Invite Error:', error?.response?.data || error?.message);
    
    const errorMessage = error?.response?.data?.message || 
                        error?.response?.data?.error || 
                        'Failed to generate invite';
    
    Toast.show({
      type: 'error',
      text1: 'Failed to generate invite',
      text2: errorMessage,
      position: 'bottom',
      visibilityTime: 4000,
    });
    
    throw error;
  }
};

// Join a business via invite code
export const joinBusiness = async (code: string) => {
  try {
    console.log('🤝 Joining business with code:', code);
    
    const response = await api.post('/api/v1/invites/accept', { code });
    
    console.log('🤝 Join business response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Join Business Error:', error?.response?.data || error?.message);
    
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

// Fetch both owned and joined businesses with enhanced error handling
export const getBusinesses = async () => {
  try {
    console.log('📋 Fetching businesses...');
    
    const response = await api.get('/api/v1/businesses');
    
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

    console.log('📋 Businesses fetched successfully:', {
      owned: businessData.owned.length,
      joined: businessData.joined.length
    });

    return businessData;
  } catch (error: any) {
    console.error('❌ Get Businesses Error:', error?.response?.data || error?.message);
    
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
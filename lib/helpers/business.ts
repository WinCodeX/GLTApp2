// lib/helpers/business.ts - Fixed business creation with proper data handling
import Toast from 'react-native-toast-message';
import api from '../api';

// Create a new business - Fixed to handle both string and object input
export const createBusiness = async (businessData: string | { name: string; categories?: string[] }) => {
  try {
    // Handle both legacy string input and new object input
    let requestData;
    
    if (typeof businessData === 'string') {
      // Legacy: just a name string
      requestData = { name: businessData };
    } else {
      // New: object with name and optional categories
      requestData = {
        name: businessData.name,
        ...(businessData.categories && businessData.categories.length > 0 && {
          categories: businessData.categories
        })
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

    // Ensure we have the expected structure
    const businessData = {
      owned: Array.isArray(response.data.owned) ? response.data.owned : [],
      joined: Array.isArray(response.data.joined) ? response.data.joined : []
    };

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
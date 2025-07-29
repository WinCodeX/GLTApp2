import Toast from 'react-native-toast-message';
import api from '../api';

// Create a new business
export const createBusiness = async (name: string) => {
  try {
    const response = await api.post('/api/v1/businesses', { name });
    return response.data;
  } catch (error: any) {
    console.error('Create Business Error:', error?.response?.data || error?.message);
    Toast.show({
      type: 'errorToast',
      text1: 'Failed to create business',
      text2: error?.response?.data?.message || 'Please try again.',
    });
    throw error;
  }
};

// Generate an invite code for a business
export const createInvite = async (businessId: number) => {
  try {
    const response = await api.post('/api/v1/invites', { business_id: businessId });
    return response.data;
  } catch (error: any) {
    console.error('Create Invite Error:', error?.response?.data || error?.message);
    Toast.show({
      type: 'errorToast',
      text1: 'Failed to generate invite',
      text2: error?.response?.data?.message || 'Please try again.',
    });
    throw error;
  }
};

// Join a business via invite code
export const joinBusiness = async (code: string) => {
  try {
    const response = await api.post('/api/v1/invites/accept', { code });
    return response.data;
  } catch (error: any) {
    console.error('Join Business Error:', error?.response?.data || error?.message);
    Toast.show({
      type: 'errorToast',
      text1: 'Failed to join business',
      text2: error?.response?.data?.message || 'Invalid or expired invite code.',
    });
    throw error;
  }
};

// Fetch both owned and joined businesses
export const getBusinesses = async () => {
  try {
    const response = await api.get('/api/v1/businesses');
    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid business data');
    }
    return response.data; // expected: { owned: [...], joined: [...] }
  } catch (error: any) {
    console.error('Get Businesses Error:', error?.response?.data || error?.message);
    Toast.show({
      type: 'errorToast',
      text1: 'Failed to load businesses',
      text2: error?.response?.data?.message || 'Check your internet or try again later.',
    });
    return { owned: [], joined: [] }; // Safe fallback
  }
};
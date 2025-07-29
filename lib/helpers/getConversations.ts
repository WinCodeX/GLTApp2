import api from '../api';
import * as SecureStore from 'expo-secure-store';

const getConversations = async () => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) {
      throw new Error('No token found. Please login again.');
    }

    const response = await api.get('/api/v1/conversations', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    // FastJsonapi: { data: [ { id, attributes: {...} } ] }
    const rawData = response.data?.data || [];

    const conversations = rawData.map((item) => ({
      id: item.id,
      ...item.attributes,
    }));

    return conversations;
  } catch (error: any) {
    console.error('Error fetching conversations:', error.message || error);
    throw error;
  }
};

export { getConversations };
import api from '../api';
import * as SecureStore from 'expo-secure-store';

const sendMessage = async (conversationId: string, content: string) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) {
      throw new Error('No token found. Please login again.');
    }

    const response = await api.post(
      `/api/v1/conversations/${conversationId}/messages`,
      {
        message: { body: content }, // ✅ Rails expects `body`, not `content`
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    // ✅ FastJsonapi response structure: { data: { id, attributes: { body, created_at, user_id } } }
    const { id, attributes } = response.data?.data;

    return {
      id,
      ...attributes,
    };
  } catch (error: any) {
    console.error('Error sending message:', error?.message || error);
    throw error;
  }
};

export { sendMessage };
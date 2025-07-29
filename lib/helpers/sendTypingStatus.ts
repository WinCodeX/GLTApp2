import api from '../api';
import * as SecureStore from 'expo-secure-store';

/**
 * Sends a typing status to the backend via HTTP.
 * This can be adapted later for ActionCable websocket integration.
 */
export const sendTypingStatus = async (receiverId: string) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) {
      throw new Error('No token found. Please login again.');
    }

    await api.post(
      '/api/v1/typing_status',
      { receiver_id: receiverId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Failed to send typing status:', error?.message || error);
  }
};
import api from '../api';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

export const getProductStats = async () => {
  const { isConnected } = await NetInfo.fetch();
  if (!isConnected) throw new Error('No internet connection');

  const token = await SecureStore.getItemAsync('auth_token');

  const res = await api.get('/api/v1/products/stats', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};
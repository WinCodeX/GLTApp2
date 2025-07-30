import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const LOCAL_BASE_1 = 'http://192.168.122.1:3000';
const LOCAL_BASE_2 = 'http://192.168.100.73:3000';
const PROD_BASE = 'https://stockx-3vvh.onrender.com';

let resolvedBaseUrl: string | null = null;

const getBaseUrl = async (): Promise<string> => {
  if (resolvedBaseUrl) return resolvedBaseUrl;

  const bases = [LOCAL_BASE_1, LOCAL_BASE_2, PROD_BASE];

  for (const base of bases) {
    try {
      const res = await axios.get(`${base}/api/v1/ping`, { timeout: 1500 });
      if (res.status === 200) {
        resolvedBaseUrl = base;
        break;
      }
    } catch {
      // Try next
    }
  }

  resolvedBaseUrl ??= PROD_BASE;
  return resolvedBaseUrl;
};

const api = axios.create({
  baseURL: PROD_BASE, // Placeholder, overridden later
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');

  config.baseURL = resolvedBaseUrl ?? await getBaseUrl();

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
      Toast.show({ type: 'warningToast', text1: 'Session expired' });
      setTimeout(() => router.replace('/login'), 2000);
      return;
    }

    const net = await NetInfo.fetch();
    const isOffline = !net.isConnected || error.message === 'Network Error';

    if (isOffline) {
      Toast.show({
        type: 'errorToast',
        text1: 'You are offline',
        text2: 'Some features may not work until you’re back online.',
      });
    }

    return Promise.reject(error);
  }
);

export default api;
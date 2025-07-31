import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';

export async function bootstrapApp() {
  let isOffline = false;
  let hasAccount = false;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) throw new Error('No internet');

    const ping = await api.get('api/v1/ping');
    if (ping.status !== 200) throw new Error('Ping failed');
  } catch {
    isOffline = true;
  }

  const user = await SecureStore.getItemAsync('user_token');
  if (user) hasAccount = true;

  return { isOffline, hasAccount };
}
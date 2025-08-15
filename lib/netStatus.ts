// lib/netStatus.ts
import NetInfo from '@react-native-community/netinfo';
import api from './api';

type NetworkStatus = 'online' | 'offline' | 'server_error';

let statusCallback: ((status: NetworkStatus) => void) | null = null;

export const registerStatusUpdater = (callback: (status: NetworkStatus) => void) => {
  statusCallback = callback;

  NetInfo.addEventListener(async (state) => {
    if (!state.isConnected) {
      console.log('📱 Device is offline');
      statusCallback?.('offline');
      return;
    }

    console.log('📱 Device is online, checking server connectivity...');
    
    try {
      // Use our API instance instead of direct fetch
      const response = await api.get('/api/v1/ping', {
        timeout: 5000, // 5 second timeout for status checks
      });
      
      if (response.status === 200) {
        console.log('✅ Server is reachable');
        statusCallback?.('online');
      } else {
        console.log('⚠️ Server responded with non-200 status:', response.status);
        statusCallback?.('server_error');
      }
    } catch (error) {
      console.log('❌ Server ping failed:', error.message);
      statusCallback?.('server_error');
    }
  });
};

// Function to manually check server status
export const checkServerStatus = async (): Promise<NetworkStatus> => {
  try {
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      return 'offline';
    }

    const response = await api.get('/api/v1/ping', {
      timeout: 5000,
    });
    
    return response.status === 200 ? 'online' : 'server_error';
  } catch (error) {
    console.log('❌ Manual server check failed:', error.message);
    return 'server_error';
  }
};
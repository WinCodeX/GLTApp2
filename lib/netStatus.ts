// lib/netStatus.ts - Enhanced with ActionCable integration
import NetInfo from '@react-native-community/netinfo';
import api from './api';
import ActionCableService from './services/ActionCableService';

type NetworkStatus = 'online' | 'offline' | 'server_error';

let statusCallback: ((status: NetworkStatus) => void) | null = null;
let wasOnline = true;

export const registerStatusUpdater = (callback: (status: NetworkStatus) => void) => {
  statusCallback = callback;

  NetInfo.addEventListener(async (state) => {
    if (!state.isConnected) {
      console.log('📱 Device is offline');
      wasOnline = false;
      statusCallback?.('offline');
      return;
    }

    console.log('📱 Device is online, checking server connectivity...');
    
    try {
      const response = await api.get('/api/v1/ping', {
        timeout: 5000,
      });
      
      if (response.status === 200) {
        console.log('✅ Server is reachable');
        statusCallback?.('online');
        
        // If network just came back, force ActionCable reconnection
        if (!wasOnline) {
          console.log('🔄 Network restored - triggering ActionCable reconnection');
          const actionCable = ActionCableService.getInstance();
          actionCable.forceReconnect();
        }
        
        wasOnline = true;
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
// lib/netStatus.ts
import NetInfo from '@react-native-community/netinfo';

type NetworkStatus = 'online' | 'offline' | 'server_error';

let statusCallback: ((status: NetworkStatus) => void) | null = null;

export const registerStatusUpdater = (callback: (status: NetworkStatus) => void) => {
  statusCallback = callback;

  NetInfo.addEventListener(async (state) => {
    if (!state.isConnected) {
      statusCallback?.('offline');
    } else {
      try {
        const res = await fetch('https://stockx-3vvh.onrender.com');
        if (res.ok) {
          statusCallback?.('online');
        } else {
          statusCallback?.('server_error');
        }
      } catch {
        statusCallback?.('server_error');
      }
    }
  });
};
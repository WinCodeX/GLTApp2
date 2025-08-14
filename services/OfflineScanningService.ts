// services/OfflineScanningService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

interface OfflineScanAction {
  id: string;
  packageCode: string;
  actionType: 'collect' | 'deliver' | 'print' | 'confirm_receipt';
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  metadata: {
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    deviceInfo?: any;
    notes?: string;
  };
  synced: boolean;
  retryCount: number;
}

interface PackageCache {
  [packageCode: string]: {
    package: any;
    availableActions: any[];
    lastUpdated: string;
    offline: boolean;
  };
}

class OfflineScanningService {
  private static instance: OfflineScanningService;
  private readonly STORAGE_KEYS = {
    OFFLINE_ACTIONS: '@offline_scanning_actions',
    PACKAGE_CACHE: '@package_cache',
    SYNC_QUEUE: '@sync_queue',
    LAST_SYNC: '@last_sync_timestamp',
  };

  private syncInProgress = false;
  private networkListenerUnsubscribe: (() => void) | null = null;

  public static getInstance(): OfflineScanningService {
    if (!OfflineScanningService.instance) {
      OfflineScanningService.instance = new OfflineScanningService();
    }
    return OfflineScanningService.instance;
  }

  // Initialize the service and set up network listener
  public async initialize(): Promise<void> {
    try {
      // Set up network state listener
      this.networkListenerUnsubscribe = NetInfo.addEventListener((state) => {
        if (state.isConnected && !this.syncInProgress) {
          this.syncOfflineActions();
        }
      });

      // Try to sync any pending actions on startup
      const isConnected = await NetInfo.fetch();
      if (isConnected.isConnected) {
        await this.syncOfflineActions();
      }
    } catch (error) {
      console.error('Failed to initialize offline scanning service:', error);
    }
  }

  // Clean up listeners
  public destroy(): void {
    if (this.networkListenerUnsubscribe) {
      this.networkListenerUnsubscribe();
      this.networkListenerUnsubscribe = null;
    }
  }

  // Check if device is online
  public async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch (error) {
      return false;
    }
  }

  // Store a scan action for offline processing
  public async storeScanAction(
    packageCode: string,
    actionType: string,
    user: { id: string; name: string; role: string },
    metadata: any = {}
  ): Promise<{ success: boolean; message: string; actionId?: string }> {
    try {
      const actionId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const offlineAction: OfflineScanAction = {
        id: actionId,
        packageCode,
        actionType: actionType as any,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        timestamp: new Date().toISOString(),
        metadata,
        synced: false,
        retryCount: 0,
      };

      // Get existing offline actions
      const existingActions = await this.getOfflineActions();
      
      // Check for duplicate actions
      const isDuplicate = existingActions.some(action => 
        action.packageCode === packageCode && 
        action.actionType === actionType &&
        !action.synced
      );

      if (isDuplicate) {
        return {
          success: false,
          message: 'This action is already queued for sync',
        };
      }

      // Store the new action
      const updatedActions = [...existingActions, offlineAction];
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.OFFLINE_ACTIONS,
        JSON.stringify(updatedActions)
      );

      // Update package state locally if cached
      await this.updateLocalPackageState(packageCode, actionType);

      return {
        success: true,
        message: 'Action stored for offline sync',
        actionId,
      };
    } catch (error) {
      console.error('Failed to store offline scan action:', error);
      return {
        success: false,
        message: 'Failed to store action offline',
      };
    }
  }

  // Get all offline actions
  public async getOfflineActions(): Promise<OfflineScanAction[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.OFFLINE_ACTIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get offline actions:', error);
      return [];
    }
  }

  // Get pending (unsynced) actions count
  public async getPendingActionsCount(): Promise<number> {
    try {
      const actions = await this.getOfflineActions();
      return actions.filter(action => !action.synced).length;
    } catch (error) {
      return 0;
    }
  }

  // Cache package information for offline access
  public async cachePackage(
    packageCode: string,
    packageData: any,
    availableActions: any[] = []
  ): Promise<void> {
    try {
      const cache = await this.getPackageCache();
      
      cache[packageCode] = {
        package: packageData,
        availableActions,
        lastUpdated: new Date().toISOString(),
        offline: false,
      };

      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PACKAGE_CACHE,
        JSON.stringify(cache)
      );
    } catch (error) {
      console.error('Failed to cache package:', error);
    }
  }

  // Get cached package information
  public async getCachedPackage(packageCode: string): Promise<any | null> {
    try {
      const cache = await this.getPackageCache();
      const cached = cache[packageCode];
      
      if (!cached) return null;

      // Check if cache is too old (e.g., older than 24 hours)
      const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
      const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > maxCacheAge) {
        return null;
      }

      return cached;
    } catch (error) {
      console.error('Failed to get cached package:', error);
      return null;
    }
  }

  // Sync all offline actions with the server
  public async syncOfflineActions(): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    message: string;
  }> {
    if (this.syncInProgress) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'Sync already in progress',
      };
    }

    const isConnected = await this.isOnline();
    if (!isConnected) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'No internet connection',
      };
    }

    this.syncInProgress = true;

    try {
      const actions = await this.getOfflineActions();
      const unsyncedActions = actions.filter(action => !action.synced);

      if (unsyncedActions.length === 0) {
        this.syncInProgress = false;
        return {
          success: true,
          synced: 0,
          failed: 0,
          message: 'No actions to sync',
        };
      }

      let syncedCount = 0;
      let failedCount = 0;
      const updatedActions = [...actions];

      // Process each action
      for (let i = 0; i < unsyncedActions.length; i++) {
        const action = unsyncedActions[i];
        const actionIndex = updatedActions.findIndex(a => a.id === action.id);

        try {
          const result = await this.syncSingleAction(action);
          
          if (result.success) {
            // Mark as synced
            updatedActions[actionIndex] = {
              ...action,
              synced: true,
            };
            syncedCount++;
          } else {
            // Increment retry count
            updatedActions[actionIndex] = {
              ...action,
              retryCount: action.retryCount + 1,
            };
            failedCount++;
          }
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);
          updatedActions[actionIndex] = {
            ...action,
            retryCount: action.retryCount + 1,
          };
          failedCount++;
        }
      }

      // Save updated actions
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.OFFLINE_ACTIONS,
        JSON.stringify(updatedActions)
      );

      // Update last sync timestamp
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LAST_SYNC,
        new Date().toISOString()
      );

      // Clean up old synced actions (older than 7 days)
      await this.cleanupOldActions();

      this.syncInProgress = false;

      return {
        success: true,
        synced: syncedCount,
        failed: failedCount,
        message: `Synced ${syncedCount} actions, ${failedCount} failed`,
      };
    } catch (error) {
      console.error('Sync process failed:', error);
      this.syncInProgress = false;
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'Sync process failed',
      };
    }
  }

  // Sync a single action with the server
  private async syncSingleAction(action: OfflineScanAction): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await fetch('/api/v1/scanning/scan_action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          package_code: action.packageCode,
          action_type: action.actionType,
          offline_sync: true,
          original_timestamp: action.timestamp,
          metadata: action.metadata,
        }),
      });

      const result = await response.json();
      return {
        success: result.success,
        message: result.message || 'Action synced',
      };
    } catch (error) {
      return {
        success: false,
        message: `Network error: ${error.message}`,
      };
    }
  }

  // Update local package state based on action
  private async updateLocalPackageState(
    packageCode: string,
    actionType: string
  ): Promise<void> {
    try {
      const cached = await this.getCachedPackage(packageCode);
      if (!cached) return;

      // Update the package state locally
      let newState = cached.package.state;
      
      switch (actionType) {
        case 'collect':
          newState = 'in_transit';
          break;
        case 'deliver':
          newState = 'delivered';
          break;
        case 'confirm_receipt':
          newState = 'collected';
          break;
        // 'print' doesn't change state
      }

      if (newState !== cached.package.state) {
        cached.package.state = newState;
        cached.package.state_display = this.getStateDisplay(newState);
        cached.offline = true; // Mark as modified offline

        await this.cachePackage(
          packageCode,
          cached.package,
          cached.availableActions
        );
      }
    } catch (error) {
      console.error('Failed to update local package state:', error);
    }
  }

  private getStateDisplay(state: string): string {
    const stateMap: { [key: string]: string } = {
      'pending_unpaid': 'Pending Payment',
      'pending': 'Pending',
      'submitted': 'Submitted',
      'in_transit': 'In Transit',
      'delivered': 'Delivered',
      'collected': 'Collected',
      'cancelled': 'Cancelled',
    };
    return stateMap[state] || state;
  }

  private async getPackageCache(): Promise<PackageCache> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.PACKAGE_CACHE);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  private async getAuthToken(): Promise<string> {
    try {
      // Implement your auth token retrieval logic
      const token = await AsyncStorage.getItem('@auth_token');
      return token || '';
    } catch (error) {
      return '';
    }
  }

  // Clean up old synced actions
  private async cleanupOldActions(): Promise<void> {
    try {
      const actions = await this.getOfflineActions();
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      const recentActions = actions.filter(action => {
        const actionTime = new Date(action.timestamp).getTime();
        return !action.synced || actionTime > oneWeekAgo;
      });

      await AsyncStorage.setItem(
        this.STORAGE_KEYS.OFFLINE_ACTIONS,
        JSON.stringify(recentActions)
      );
    } catch (error) {
      console.error('Failed to cleanup old actions:', error);
    }
  }

  // Get sync status information
  public async getSyncStatus(): Promise<{
    lastSync: string | null;
    pendingActions: number;
    isOnline: boolean;
    syncInProgress: boolean;
  }> {
    try {
      const lastSync = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
      const pendingActions = await this.getPendingActionsCount();
      const isOnline = await this.isOnline();

      return {
        lastSync,
        pendingActions,
        isOnline,
        syncInProgress: this.syncInProgress,
      };
    } catch (error) {
      return {
        lastSync: null,
        pendingActions: 0,
        isOnline: false,
        syncInProgress: false,
      };
    }
  }

  // Force sync (with user confirmation)
  public async forceSyncWithConfirmation(): Promise<void> {
    const status = await this.getSyncStatus();
    
    if (status.pendingActions === 0) {
      Alert.alert('Info', 'No pending actions to sync');
      return;
    }

    Alert.alert(
      'Sync Offline Actions',
      `You have ${status.pendingActions} pending action(s). Sync now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: async () => {
            const result = await this.syncOfflineActions();
            Alert.alert(
              result.success ? 'Success' : 'Error',
              result.message
            );
          },
        },
      ]
    );
  }

  // Clear all offline data (use with caution)
  public async clearOfflineData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.STORAGE_KEYS.OFFLINE_ACTIONS,
        this.STORAGE_KEYS.PACKAGE_CACHE,
        this.STORAGE_KEYS.SYNC_QUEUE,
        this.STORAGE_KEYS.LAST_SYNC,
      ]);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }
}

export default OfflineScanningService;
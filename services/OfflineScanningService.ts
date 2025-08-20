// services/OfflineScanningService.ts - Stub implementation for offline functionality
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface CachedPackage {
  package: any;
  available_actions: any[];
  cached_at: string;
}

interface ScanAction {
  id: string;
  package_code: string;
  action_type: string;
  user: any;
  metadata: any;
  timestamp: string;
  synced: boolean;
}

class OfflineScanningService {
  private static instance: OfflineScanningService;
  private isOnlineStatus: boolean = true;
  private syncQueue: ScanAction[] = [];

  static getInstance(): OfflineScanningService {
    if (!OfflineScanningService.instance) {
      OfflineScanningService.instance = new OfflineScanningService();
    }
    return OfflineScanningService.instance;
  }

  async initialize(): Promise<void> {
    console.log('🔄 [OFFLINE-SERVICE] Initializing offline scanning service...');
    
    try {
      // Load sync queue from storage
      const storedQueue = await AsyncStorage.getItem('offline_sync_queue');
      if (storedQueue) {
        this.syncQueue = JSON.parse(storedQueue);
        console.log(`📦 [OFFLINE-SERVICE] Loaded ${this.syncQueue.length} queued actions`);
      }
      
      // Check initial online status
      await this.checkConnectivity();
      
      console.log('✅ [OFFLINE-SERVICE] Offline service initialized');
    } catch (error) {
      console.error('❌ [OFFLINE-SERVICE] Failed to initialize:', error);
    }
  }

  async isOnline(): Promise<boolean> {
    // Simple connectivity check - in a real app you'd use @react-native-community/netinfo
    try {
      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        cache: 'no-cache',
        timeout: 5000,
      });
      
      this.isOnlineStatus = response.ok;
      return this.isOnlineStatus;
    } catch (error) {
      this.isOnlineStatus = false;
      return false;
    }
  }

  private async checkConnectivity(): Promise<void> {
    const online = await this.isOnline();
    console.log(`🌐 [OFFLINE-SERVICE] Network status: ${online ? 'ONLINE' : 'OFFLINE'}`);
    
    if (online && this.syncQueue.length > 0) {
      console.log(`🔄 [OFFLINE-SERVICE] Attempting to sync ${this.syncQueue.length} queued actions...`);
      await this.syncPendingActions();
    }
  }

  async cachePackage(
    packageCode: string, 
    packageData: any, 
    availableActions: any[]
  ): Promise<void> {
    try {
      const cacheKey = `cached_package_${packageCode}`;
      const cachedPackage: CachedPackage = {
        package: packageData,
        available_actions: availableActions,
        cached_at: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedPackage));
      console.log(`💾 [OFFLINE-SERVICE] Cached package: ${packageCode}`);
    } catch (error) {
      console.error(`❌ [OFFLINE-SERVICE] Failed to cache package ${packageCode}:`, error);
    }
  }

  async getCachedPackage(packageCode: string): Promise<CachedPackage | null> {
    try {
      const cacheKey = `cached_package_${packageCode}`;
      const stored = await AsyncStorage.getItem(cacheKey);
      
      if (stored) {
        const cached: CachedPackage = JSON.parse(stored);
        
        // Check if cache is not too old (24 hours)
        const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheAge < maxAge) {
          console.log(`📦 [OFFLINE-SERVICE] Retrieved cached package: ${packageCode}`);
          return cached;
        } else {
          console.log(`🗑️ [OFFLINE-SERVICE] Cache expired for package: ${packageCode}`);
          await AsyncStorage.removeItem(cacheKey);
        }
      }
      
      return null;
    } catch (error) {
      console.error(`❌ [OFFLINE-SERVICE] Failed to get cached package ${packageCode}:`, error);
      return null;
    }
  }

  async storeScanAction(
    packageCode: string,
    actionType: string,
    user: any,
    metadata: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const scanAction: ScanAction = {
        id: actionId,
        package_code: packageCode,
        action_type: actionType,
        user,
        metadata,
        timestamp: new Date().toISOString(),
        synced: false,
      };
      
      this.syncQueue.push(scanAction);
      
      // Persist queue to storage
      await AsyncStorage.setItem('offline_sync_queue', JSON.stringify(this.syncQueue));
      
      console.log(`📝 [OFFLINE-SERVICE] Stored offline action: ${actionType} for ${packageCode}`);
      
      return {
        success: true,
        message: `Action stored offline and will sync when connection is restored`,
      };
    } catch (error) {
      console.error(`❌ [OFFLINE-SERVICE] Failed to store action:`, error);
      return {
        success: false,
        message: `Failed to store action offline: ${error}`,
      };
    }
  }

  private async syncPendingActions(): Promise<void> {
    if (this.syncQueue.length === 0) return;
    
    const unsyncedActions = this.syncQueue.filter(action => !action.synced);
    console.log(`🔄 [OFFLINE-SERVICE] Syncing ${unsyncedActions.length} actions...`);
    
    for (const action of unsyncedActions) {
      try {
        // Mock API call - replace with your actual API endpoint
        const success = await this.syncSingleAction(action);
        
        if (success) {
          action.synced = true;
          console.log(`✅ [OFFLINE-SERVICE] Synced action: ${action.action_type} for ${action.package_code}`);
        }
      } catch (error) {
        console.error(`❌ [OFFLINE-SERVICE] Failed to sync action ${action.id}:`, error);
      }
    }
    
    // Remove synced actions from queue
    this.syncQueue = this.syncQueue.filter(action => !action.synced);
    
    // Update storage
    await AsyncStorage.setItem('offline_sync_queue', JSON.stringify(this.syncQueue));
    
    const remaining = this.syncQueue.length;
    console.log(`🔄 [OFFLINE-SERVICE] Sync complete. ${remaining} actions remain in queue.`);
  }

  private async syncSingleAction(action: ScanAction): Promise<boolean> {
    try {
      // Mock API call - replace with your actual sync logic
      console.log(`🌐 [OFFLINE-SERVICE] Syncing action:`, {
        package_code: action.package_code,
        action_type: action.action_type,
        timestamp: action.timestamp,
      });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock success response
      return true;
    } catch (error) {
      console.error(`❌ [OFFLINE-SERVICE] Sync failed for action ${action.id}:`, error);
      return false;
    }
  }

  async getPendingActionsCount(): Promise<number> {
    return this.syncQueue.filter(action => !action.synced).length;
  }

  async clearCache(): Promise<void> {
    try {
      // Get all stored keys
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter keys that are package caches
      const cacheKeys = keys.filter(key => key.startsWith('cached_package_'));
      
      // Remove all cache keys
      await AsyncStorage.multiRemove(cacheKeys);
      
      console.log(`🗑️ [OFFLINE-SERVICE] Cleared ${cacheKeys.length} cached packages`);
    } catch (error) {
      console.error('❌ [OFFLINE-SERVICE] Failed to clear cache:', error);
    }
  }

  async forceSyncAll(): Promise<{ success: number; failed: number }> {
    console.log('🔄 [OFFLINE-SERVICE] Force syncing all pending actions...');
    
    const unsyncedActions = this.syncQueue.filter(action => !action.synced);
    let success = 0;
    let failed = 0;
    
    for (const action of unsyncedActions) {
      try {
        const synced = await this.syncSingleAction(action);
        if (synced) {
          action.synced = true;
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }
    
    // Update queue
    this.syncQueue = this.syncQueue.filter(action => !action.synced);
    await AsyncStorage.setItem('offline_sync_queue', JSON.stringify(this.syncQueue));
    
    console.log(`✅ [OFFLINE-SERVICE] Force sync complete: ${success} success, ${failed} failed`);
    
    return { success, failed };
  }
}

export default OfflineScanningService;
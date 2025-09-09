// lib/services/updateService.ts

import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_UPDATE_TASK = 'background-update-check';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateMetadata {
  version: string;
  changelog: string[];
  releaseDate: string;
  forceUpdate: boolean;
}

class UpdateService {
  private static instance: UpdateService;
  private updateCheckInProgress = false;

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async initialize() {
    await this.registerBackgroundTask();
    await this.checkPendingInstall();
  }

  private async registerBackgroundTask() {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_UPDATE_TASK, {
        minimumInterval: UPDATE_CHECK_INTERVAL,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (error) {
      console.error('Failed to register background task:', error);
    }
  }

  async checkPendingInstall() {
    try {
      const pendingInstall = await AsyncStorage.getItem('pending_update_install');
      if (pendingInstall === 'true') {
        await AsyncStorage.removeItem('pending_update_install');
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error('Error checking pending install:', error);
    }
  }

  async checkForUpdates(): Promise<{ hasUpdate: boolean; metadata?: UpdateMetadata }> {
    if (this.updateCheckInProgress) {
      return { hasUpdate: false };
    }

    try {
      this.updateCheckInProgress = true;

      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        // Fetch metadata from your backend
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/updates/info`);
        const metadata: UpdateMetadata = await response.json();
        
        return { hasUpdate: true, metadata };
      }
      
      return { hasUpdate: false };
    } catch (error) {
      console.error('Update check failed:', error);
      return { hasUpdate: false };
    } finally {
      this.updateCheckInProgress = false;
    }
  }

  async downloadUpdate(): Promise<boolean> {
    try {
      const result = await Updates.fetchUpdateAsync();
      return result.isNew;
    } catch (error) {
      console.error('Update download failed:', error);
      return false;
    }
  }

  async installUpdate(): Promise<void> {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.error('Update installation failed:', error);
      throw error;
    }
  }

  async scheduleInstallForLater(): Promise<void> {
    await AsyncStorage.setItem('pending_update_install', 'true');
  }

  getCurrentVersion(): string {
    return Updates.manifest?.version || '1.0.0';
  }

  getUpdateId(): string | null {
    return Updates.updateId || null;
  }
}

// Background task definition
TaskManager.defineTask(BACKGROUND_UPDATE_TASK, async () => {
  try {
    const updateService = UpdateService.getInstance();
    const { hasUpdate } = await updateService.checkForUpdates();
    
    if (hasUpdate) {
      // Optionally pre-download the update
      await updateService.downloadUpdate();
    }
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background update check failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default UpdateService;
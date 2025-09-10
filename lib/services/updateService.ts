// lib/services/updateService.ts

import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateMetadata {
  available: boolean;
  version?: string;
  changelog?: string[];
  release_date?: string;
  force_update?: boolean;
  download_url?: string;
  file_size?: number;
}

class UpdateService {
  private static instance: UpdateService;
  private updateCheckInProgress = false;
  private downloadInProgress = false;

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async initialize() {
    // No background tasks needed for APK updates - they're handled manually
    await this.checkPendingInstall();
  }

  async checkPendingInstall() {
    try {
      const pendingInstall = await AsyncStorage.getItem('pending_apk_install');
      if (pendingInstall === 'true') {
        await AsyncStorage.removeItem('pending_apk_install');
        // APK updates don't auto-reload, user manually installs
        console.log('Pending APK install was marked, user may have installed update');
      }
    } catch (error) {
      console.error('Error checking pending install:', error);
    }
  }

  /**
   * Check for available APK updates
   */
  async checkForUpdates(): Promise<{ hasUpdate: boolean; metadata?: UpdateMetadata }> {
    if (this.updateCheckInProgress) {
      return { hasUpdate: false };
    }

    try {
      this.updateCheckInProgress = true;
      
      const currentVersion = this.getCurrentVersion();
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://glt-53x8.onrender.com';
      
      console.log(`Checking for updates: current version ${currentVersion}`);
      
      const response = await fetch(`${apiUrl}/api/v1/updates/info?current_version=${currentVersion}`);
      const data: UpdateMetadata = await response.json();
      
      if (data.available) {
        console.log(`APK Update available: ${data.version} (current: ${currentVersion})`);
        return { hasUpdate: true, metadata: data };
      }
      
      console.log('No APK updates available');
      return { hasUpdate: false };
    } catch (error) {
      console.error('APK update check failed:', error);
      return { hasUpdate: false };
    } finally {
      this.updateCheckInProgress = false;
    }
  }

  /**
   * Download and install APK update
   */
  async downloadUpdate(metadata?: UpdateMetadata): Promise<boolean> {
    if (!metadata?.download_url || this.downloadInProgress) {
      return false;
    }

    if (Platform.OS !== 'android') {
      Alert.alert('Unsupported', 'APK updates are only supported on Android devices.');
      return false;
    }

    try {
      this.downloadInProgress = true;
      
      // Show download progress alert
      Alert.alert(
        'Downloading Update',
        `Downloading version ${metadata.version}...\nSize: ${this.formatFileSize(metadata.file_size || 0)}`,
        [],
        { cancelable: false }
      );

      const fileUri = FileSystem.documentDirectory + 'glt_update.apk';
      
      // Clean up any existing APK file
      const existingFile = await FileSystem.getInfoAsync(fileUri);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(fileUri);
      }
      
      // Download APK with progress tracking
      const downloadResult = await FileSystem.downloadAsync(
        metadata.download_url,
        fileUri
      );

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      console.log('APK downloaded successfully:', downloadResult.uri);

      // Verify file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Downloaded file is invalid');
      }

      // Install APK using Intent Launcher
      await this.installAPK(downloadResult.uri);
      
      // Mark as pending install
      await AsyncStorage.setItem('pending_apk_install', 'true');
      
      return true;
    } catch (error) {
      console.error('APK download/install failed:', error);
      Alert.alert(
        'Update Failed',
        `Failed to download or install update: ${error.message}`
      );
      return false;
    } finally {
      this.downloadInProgress = false;
    }
  }

  /**
   * Install APK using Android Intent
   */
  private async installAPK(fileUri: string): Promise<void> {
    try {
      // First try the standard installation intent
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: fileUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
      
      Alert.alert(
        'Installation Started',
        'The APK installation has started. Please follow the on-screen instructions to complete the update.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Primary APK installation failed:', error);
      
      // Fallback: try opening with VIEW intent
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: fileUri,
          type: 'application/vnd.android.package-archive',
          flags: 1,
        });
        
        Alert.alert(
          'Manual Installation Required',
          'Please tap the downloaded APK file to install the update.',
          [{ text: 'OK' }]
        );
      } catch (fallbackError) {
        console.error('Fallback installation failed:', fallbackError);
        throw new Error('Unable to install APK. Please install manually from Downloads folder.');
      }
    }
  }

  /**
   * Install update - for APK updates, this triggers download and install
   */
  async installUpdate(metadata?: UpdateMetadata): Promise<void> {
    if (!metadata) {
      throw new Error('Update metadata required for APK installation');
    }
    
    const success = await this.downloadUpdate(metadata);
    if (!success) {
      throw new Error('Failed to download and install APK update');
    }
  }

  /**
   * Schedule install for later - for APK updates, just mark preference
   */
  async scheduleInstallForLater(): Promise<void> {
    await AsyncStorage.setItem('user_postponed_update', 'true');
  }

  /**
   * Show update dialog to user
   */
  showUpdateDialog(metadata: UpdateMetadata): Promise<boolean> {
    return new Promise((resolve) => {
      const changelogText = metadata.changelog?.join('\n• ') || 'Bug fixes and improvements';
      const sizeText = metadata.file_size ? ` (${this.formatFileSize(metadata.file_size)})` : '';
      
      Alert.alert(
        metadata.force_update ? 'Required Update' : 'Update Available',
        `Version ${metadata.version}${sizeText}\n\n• ${changelogText}\n\nThis will download and install a new APK file.`,
        [
          ...(metadata.force_update ? [] : [{
            text: 'Later',
            style: 'cancel' as const,
            onPress: () => resolve(false)
          }]),
          {
            text: 'Update Now',
            onPress: () => resolve(true)
          }
        ],
        { cancelable: !metadata.force_update }
      );
    });
  }

  /**
   * Get current app version from Constants
   */
  getCurrentVersion(): string {
    // Use version from Constants (matches app.json and build.gradle)
    return Constants.expoConfig?.version || '1.4.0';
  }

  /**
   * Get update ID - for APK updates, return app version
   */
  getUpdateId(): string | null {
    return this.getCurrentVersion();
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if device supports APK installation
   */
  isUpdateSupported(): boolean {
    return Platform.OS === 'android';
  }

  /**
   * Check if user has postponed update
   */
  async hasUserPostponedUpdate(): Promise<boolean> {
    try {
      const postponed = await AsyncStorage.getItem('user_postponed_update');
      return postponed === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Clear postponed update flag
   */
  async clearPostponedUpdate(): Promise<void> {
    try {
      await AsyncStorage.removeItem('user_postponed_update');
    } catch (error) {
      console.error('Failed to clear postponed update flag:', error);
    }
  }
}

export default UpdateService;
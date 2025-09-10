// lib/services/updateService.ts - Enhanced with background downloads and progress tracking

import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, Alert, AppState, AppStateStatus } from 'react-native';

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const DOWNLOAD_STORAGE_KEY = 'pending_apk_download';
const DOWNLOAD_PROGRESS_KEY = 'download_progress';
const UPDATE_NOTIFICATION_CHANNEL = 'app-updates';

interface UpdateMetadata {
  available: boolean;
  version?: string;
  changelog?: string[];
  release_date?: string;
  force_update?: boolean;
  download_url?: string;
  file_size?: number;
}

interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

interface DownloadProgressCallback {
  (progress: DownloadProgress): void;
}

interface StoredDownload {
  version: string;
  filePath: string;
  metadata: UpdateMetadata;
  downloadedAt: number;
  isComplete: boolean;
}

class UpdateService {
  private static instance: UpdateService;
  private updateCheckInProgress = false;
  private downloadInProgress = false;
  private downloadProgressCallback: DownloadProgressCallback | null = null;
  private downloadStartTime = 0;
  private appStateSubscription: any = null;

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async initialize() {
    try {
      // Setup notification channels
      await this.setupNotificationChannels();
      
      // Check for pending downloads
      await this.checkPendingDownloads();
      
      // Monitor app state changes for background downloads
      this.setupAppStateMonitoring();
      
      console.log('UpdateService initialized successfully');
    } catch (error) {
      console.error('UpdateService initialization failed:', error);
    }
  }

  private async setupNotificationChannels() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(UPDATE_NOTIFICATION_CHANNEL, {
        name: 'App Updates',
        description: 'Notifications for app updates and downloads',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
        sound: 'default',
      });
    }
  }

  private setupAppStateMonitoring() {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background - check if we should start background download
      await this.checkAndStartBackgroundDownload();
    } else if (nextAppState === 'active') {
      // App coming to foreground - check download status
      await this.checkDownloadStatus();
    }
  }

  private async checkAndStartBackgroundDownload() {
    try {
      const pendingDownload = await AsyncStorage.getItem(DOWNLOAD_STORAGE_KEY);
      if (pendingDownload) {
        const downloadInfo = JSON.parse(pendingDownload);
        console.log('Starting background download for version:', downloadInfo.version);
        
        // Start download in background
        this.startBackgroundDownload(downloadInfo.metadata);
      }
    } catch (error) {
      console.error('Failed to start background download:', error);
    }
  }

  private async checkDownloadStatus() {
    try {
      const progressData = await AsyncStorage.getItem(DOWNLOAD_PROGRESS_KEY);
      if (progressData) {
        const progress = JSON.parse(progressData);
        console.log('Resuming download progress tracking:', progress);
        
        // Update progress callback if set
        if (this.downloadProgressCallback) {
          this.downloadProgressCallback(progress);
        }
      }
    } catch (error) {
      console.error('Failed to check download status:', error);
    }
  }

  async checkPendingDownloads() {
    try {
      const storedDownload = await this.getStoredDownload();
      if (storedDownload && storedDownload.isComplete) {
        // Check if file still exists
        const fileInfo = await FileSystem.getInfoAsync(storedDownload.filePath);
        if (fileInfo.exists) {
          console.log('Found completed download for version:', storedDownload.version);
          
          // Show notification about available install
          await this.showDownloadCompleteNotification(storedDownload);
        } else {
          // File was deleted, clean up storage
          await this.clearStoredDownload();
        }
      }
    } catch (error) {
      console.error('Error checking pending downloads:', error);
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
   * Download update with progress tracking
   */
  async downloadUpdateWithProgress(
    metadata: UpdateMetadata, 
    progressCallback?: DownloadProgressCallback
  ): Promise<boolean> {
    if (!metadata.download_url || this.downloadInProgress) {
      return false;
    }

    if (Platform.OS !== 'android') {
      Alert.alert('Unsupported', 'APK updates are only supported on Android devices.');
      return false;
    }

    try {
      this.downloadInProgress = true;
      this.downloadProgressCallback = progressCallback || null;
      this.downloadStartTime = Date.now();

      // Create download directory
      const downloadDir = FileSystem.documentDirectory + 'downloads/';
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      
      const fileName = `glt_update_v${metadata.version}.apk`;
      const fileUri = downloadDir + fileName;
      
      // Clean up any existing file
      const existingFile = await FileSystem.getInfoAsync(fileUri);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(fileUri);
      }

      // Show initial progress notification
      await this.showDownloadProgressNotification(0, metadata.version);

      // Start download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        metadata.download_url,
        fileUri,
        {},
        this.createProgressHandler(metadata)
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result || result.status !== 200) {
        throw new Error(`Download failed with status ${result?.status || 'unknown'}`);
      }

      // Verify file integrity
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Downloaded file is invalid');
      }

      // Store download info
      const storedDownload: StoredDownload = {
        version: metadata.version || 'latest',
        filePath: result.uri,
        metadata,
        downloadedAt: Date.now(),
        isComplete: true,
      };
      
      await this.storeDownload(storedDownload);
      
      // Show completion notification
      await this.showDownloadCompleteNotification(storedDownload);
      
      // Clear progress tracking
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      
      console.log('APK download completed successfully:', result.uri);
      return true;

    } catch (error) {
      console.error('APK download failed:', error);
      
      // Show error notification
      await this.showDownloadErrorNotification(metadata.version || 'latest');
      
      // Clear progress tracking
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      
      return false;
    } finally {
      this.downloadInProgress = false;
      this.downloadProgressCallback = null;
    }
  }

  private createProgressHandler(metadata: UpdateMetadata) {
    return (downloadProgress: FileSystem.DownloadProgressData) => {
      const currentTime = Date.now();
      const elapsedTime = (currentTime - this.downloadStartTime) / 1000; // seconds
      
      const loaded = downloadProgress.totalBytesWritten;
      const total = downloadProgress.totalBytesExpectedToWrite;
      const percentage = total > 0 ? Math.min(100, Math.max(0, (loaded / total) * 100)) : 0;
      const speed = elapsedTime > 0 ? loaded / elapsedTime : 0;
      const remainingBytes = Math.max(0, total - loaded);
      const remainingTime = speed > 0 && remainingBytes > 0 ? remainingBytes / speed : 0;

      const progress: DownloadProgress = {
        loaded,
        total,
        percentage,
        speed,
        remainingTime,
      };

      // Store progress for persistence
      AsyncStorage.setItem(DOWNLOAD_PROGRESS_KEY, JSON.stringify(progress)).catch(console.error);

      // Update progress notification every 5%
      if (Math.floor(percentage) % 5 === 0) {
        this.showDownloadProgressNotification(percentage, metadata.version).catch(console.error);
      }

      // Call progress callback
      if (this.downloadProgressCallback) {
        this.downloadProgressCallback(progress);
      }
    };
  }

  private async showDownloadProgressNotification(percentage: number, version?: string) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Downloading GLT Update',
          body: `Version ${version || 'latest'} - ${Math.round(percentage)}% complete`,
          data: { type: 'download_progress', version, percentage },
          categoryIdentifier: UPDATE_NOTIFICATION_CHANNEL,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to show progress notification:', error);
    }
  }

  private async showDownloadCompleteNotification(download: StoredDownload) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Update Downloaded',
          body: `GLT version ${download.version} is ready to install. Tap to install.`,
          data: { 
            type: 'download_complete', 
            version: download.version,
            filePath: download.filePath 
          },
          categoryIdentifier: UPDATE_NOTIFICATION_CHANNEL,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to show completion notification:', error);
    }
  }

  private async showDownloadErrorNotification(version: string) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Download Failed',
          body: `Failed to download GLT version ${version}. Please try again.`,
          data: { type: 'download_error', version },
          categoryIdentifier: UPDATE_NOTIFICATION_CHANNEL,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to show error notification:', error);
    }
  }

  /**
   * Install downloaded APK
   */
  async installDownloadedAPK(version?: string): Promise<boolean> {
    try {
      const storedDownload = await this.getStoredDownload();
      
      if (!storedDownload || (version && storedDownload.version !== version)) {
        throw new Error('No matching download found');
      }

      // Verify file still exists
      const fileInfo = await FileSystem.getInfoAsync(storedDownload.filePath);
      if (!fileInfo.exists) {
        await this.clearStoredDownload();
        throw new Error('Download file no longer exists');
      }

      // Install APK
      await this.installAPK(storedDownload.filePath);
      
      // Mark as installed
      await AsyncStorage.setItem('pending_apk_install', 'true');
      
      return true;
    } catch (error) {
      console.error('Failed to install downloaded APK:', error);
      Alert.alert(
        'Installation Failed',
        `Failed to install update: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Legacy download method - now uses new progress tracking
   */
  async downloadUpdate(metadata?: UpdateMetadata): Promise<boolean> {
    if (!metadata) return false;
    return this.downloadUpdateWithProgress(metadata);
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
    
    const success = await this.downloadUpdateWithProgress(metadata);
    if (!success) {
      throw new Error('Failed to download and install APK update');
    }
  }

  /**
   * Schedule download for when app goes to background
   */
  async scheduleBackgroundDownload(metadata: UpdateMetadata): Promise<void> {
    try {
      const downloadInfo = {
        version: metadata.version,
        metadata,
        scheduledAt: Date.now(),
      };
      
      await AsyncStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(downloadInfo));
      console.log('Background download scheduled for version:', metadata.version);
    } catch (error) {
      console.error('Failed to schedule background download:', error);
    }
  }

  /**
   * Start background download immediately
   */
  private async startBackgroundDownload(metadata: UpdateMetadata): Promise<void> {
    try {
      // Clear the scheduled download
      await AsyncStorage.removeItem(DOWNLOAD_STORAGE_KEY);
      
      // Start download
      await this.downloadUpdateWithProgress(metadata);
    } catch (error) {
      console.error('Background download failed:', error);
    }
  }

  /**
   * Schedule install for later - for APK updates, just mark preference
   */
  async scheduleInstallForLater(): Promise<void> {
    await AsyncStorage.setItem('user_postponed_update', 'true');
  }

  /**
   * Store download information
   */
  private async storeDownload(download: StoredDownload): Promise<void> {
    try {
      await AsyncStorage.setItem('stored_apk_download', JSON.stringify(download));
    } catch (error) {
      console.error('Failed to store download info:', error);
    }
  }

  /**
   * Get stored download information
   */
  private async getStoredDownload(): Promise<StoredDownload | null> {
    try {
      const stored = await AsyncStorage.getItem('stored_apk_download');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get stored download:', error);
      return null;
    }
  }

  /**
   * Clear stored download information
   */
  private async clearStoredDownload(): Promise<void> {
    try {
      await AsyncStorage.removeItem('stored_apk_download');
    } catch (error) {
      console.error('Failed to clear stored download:', error);
    }
  }

  /**
   * Check if there's a completed download ready for install
   */
  async hasCompletedDownload(): Promise<{ hasDownload: boolean; version?: string }> {
    try {
      const storedDownload = await this.getStoredDownload();
      if (storedDownload && storedDownload.isComplete) {
        // Verify file still exists
        const fileInfo = await FileSystem.getInfoAsync(storedDownload.filePath);
        if (fileInfo.exists) {
          return { hasDownload: true, version: storedDownload.version };
        } else {
          // File was deleted, clean up
          await this.clearStoredDownload();
        }
      }
      return { hasDownload: false };
    } catch (error) {
      console.error('Failed to check completed download:', error);
      return { hasDownload: false };
    }
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

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export default UpdateService;
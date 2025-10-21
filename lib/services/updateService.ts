// lib/services/updateService.ts - With proper OTA version tracking

import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, Alert, AppState, AppStateStatus, Linking } from 'react-native';
import api from '../api';

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const DOWNLOAD_STORAGE_KEY = 'pending_apk_download';
const DOWNLOAD_PROGRESS_KEY = 'download_progress';

interface UpdateMetadata {
  available: boolean;
  version?: string;
  changelog?: string[];
  release_date?: string;
  force_update?: boolean;
  download_url?: string;
  file_size?: number;
  update_type?: 'ota' | 'apk';
  bundle_version?: string; // New: separate bundle version for OTA
}

interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
}

interface DownloadProgressCallback {
  (progress: DownloadProgress): void;
}

interface StoredDownload {
  version: string;
  filePath: string;
  downloadsPath?: string;
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
  private isExpoGo = false;
  private otaUpdatesAvailable = false;

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async initialize() {
    try {
      console.log('UpdateService: Starting initialization...');
      
      this.isExpoGo = Constants.appOwnership === 'expo';
      this.otaUpdatesAvailable = !this.isExpoGo && Updates.isEnabled;
      
      if (this.isExpoGo) {
        console.log('UpdateService: Running in Expo Go - OTA updates NOT available, APK updates only');
      } else if (this.otaUpdatesAvailable) {
        console.log('UpdateService: Running in standalone build - Full OTA and APK update support available');
      } else {
        console.log('UpdateService: OTA updates disabled - APK updates only');
      }
      
      await this.initializeVersionTracking();
      this.setupAppStateMonitoring();
      
      // Check if we just applied an OTA update
      await this.checkForOTAUpdateApplication();
      
      console.log('UpdateService: Initialization completed successfully');
    } catch (error) {
      console.error('UpdateService: Initialization failed:', error);
    }
  }

  /**
   * Check if an OTA update was just applied
   * This runs on app startup to detect OTA bundle changes
   */
  private async checkForOTAUpdateApplication(): Promise<void> {
    if (!this.otaUpdatesAvailable) return;

    try {
      const currentBundleId = await this.getCurrentBundleId();
      const lastKnownBundleId = await AsyncStorage.getItem('last_known_bundle_id');
      
      console.log('UpdateService: Current bundle ID:', currentBundleId);
      console.log('UpdateService: Last known bundle ID:', lastKnownBundleId);
      
      if (lastKnownBundleId && lastKnownBundleId !== currentBundleId) {
        console.log('UpdateService: OTA update detected - bundle changed');
        
        Alert.alert(
          'Update Applied!',
          'An over-the-air update has been applied. Your app is now running the latest code.',
          [{ text: 'Great!' }]
        );
      }
      
      await AsyncStorage.setItem('last_known_bundle_id', currentBundleId);
    } catch (error) {
      console.error('UpdateService: Failed to check OTA update application:', error);
    }
  }

  /**
   * Get the current bundle/update ID from Expo Updates
   * This changes with each OTA update, even if APK version stays the same
   */
  private async getCurrentBundleId(): Promise<string> {
    if (!this.otaUpdatesAvailable) {
      return 'no-ota-support';
    }

    try {
      // Updates.updateId is unique per bundle
      // Updates.createdAt shows when this bundle was created
      const updateId = Updates.updateId || 'unknown';
      const createdAt = Updates.createdAt ? Updates.createdAt.getTime() : Date.now();
      
      return `${updateId}_${createdAt}`;
    } catch (error) {
      console.error('UpdateService: Failed to get bundle ID:', error);
      return 'error';
    }
  }

  private async initializeVersionTracking(): Promise<void> {
    try {
      console.log('UpdateService: Initializing version tracking...');
      
      // Track APK version separately from bundle version
      const currentAPKVersion = await this.getCurrentAPKVersion();
      const lastKnownAPKVersion = await AsyncStorage.getItem('last_known_apk_version');
      
      console.log('UpdateService: Current APK version:', currentAPKVersion);
      console.log('UpdateService: Last known APK version:', lastKnownAPKVersion);
      
      if (!lastKnownAPKVersion) {
        await AsyncStorage.setItem('last_known_apk_version', currentAPKVersion);
        console.log('UpdateService: APK version tracking initialized');
      } else if (lastKnownAPKVersion !== currentAPKVersion) {
        console.log('UpdateService: APK version changed - new APK installed');
        await this.cleanupAfterSuccessfulInstall();
        await AsyncStorage.setItem('last_known_apk_version', currentAPKVersion);
        
        Alert.alert(
          'Update Successful!',
          `GLT has been updated to version ${currentAPKVersion}. Enjoy the new features!`,
          [{ text: 'Great!' }]
        );
      }
    } catch (error) {
      console.error('UpdateService: Failed to initialize version tracking:', error);
    }
  }

  private setupAppStateMonitoring() {
    console.log('UpdateService: Setting up app state monitoring...');
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    console.log(`UpdateService: App state changed to: ${nextAppState}`);
    
    if (nextAppState === 'active') {
      await this.checkPostInstallation();
      
      // Check for OTA bundle changes when app becomes active
      if (this.otaUpdatesAvailable) {
        await this.checkForOTAUpdateApplication();
      }
    }
  }

  private async checkPostInstallation(): Promise<void> {
    try {
      console.log('UpdateService: Checking post-installation status...');
      
      const currentVersion = await this.getCurrentAPKVersion();
      const lastKnownVersion = await AsyncStorage.getItem('last_known_apk_version');
      
      if (lastKnownVersion && lastKnownVersion !== currentVersion) {
        console.log(`UpdateService: APK updated: ${lastKnownVersion} → ${currentVersion}`);
        await this.cleanupAfterSuccessfulInstall();
      }
      
      await AsyncStorage.setItem('last_known_apk_version', currentVersion);
    } catch (error) {
      console.error('UpdateService: Failed to check post-installation:', error);
    }
  }

  private async cleanupAfterSuccessfulInstall(): Promise<void> {
    try {
      console.log('UpdateService: Cleaning up after successful installation...');
      
      await AsyncStorage.multiRemove([
        'stored_apk_download',
        'pending_apk_download', 
        'download_progress',
        'user_postponed_update'
      ]);
      
      console.log('UpdateService: Cleanup completed');
    } catch (error) {
      console.error('UpdateService: Failed to cleanup:', error);
    }
  }

  /**
   * Check for Expo OTA updates
   * OTA updates change the JavaScript bundle, not the APK
   */
  async checkForOTAUpdates(): Promise<{ hasUpdate: boolean; isAvailable?: boolean }> {
    if (this.isExpoGo) {
      console.log('UpdateService: Skipping OTA check - running in Expo Go');
      return { hasUpdate: false };
    }

    if (!this.otaUpdatesAvailable) {
      console.log('UpdateService: Skipping OTA check - Updates not enabled');
      return { hasUpdate: false };
    }

    try {
      console.log('UpdateService: Checking for Expo OTA updates...');
      console.log('UpdateService: Current bundle ID:', await this.getCurrentBundleId());
      
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        console.log('UpdateService: OTA update IS available');
        console.log('UpdateService: This will update JavaScript bundle, NOT the APK');
        return { hasUpdate: true, isAvailable: true };
      } else {
        console.log('UpdateService: No OTA updates available');
        return { hasUpdate: false, isAvailable: false };
      }
    } catch (error) {
      console.error('UpdateService: OTA update check failed:', error);
      return { hasUpdate: false };
    }
  }

  /**
   * Fetch and apply Expo OTA update
   * This updates the JavaScript bundle and reloads the app
   * The APK version number DOES NOT CHANGE
   */
  async fetchAndApplyOTAUpdate(): Promise<boolean> {
    if (this.isExpoGo) {
      console.log('UpdateService: Cannot apply OTA - running in Expo Go');
      return false;
    }

    if (!this.otaUpdatesAvailable) {
      console.log('UpdateService: Cannot apply OTA - Updates not enabled');
      return false;
    }

    try {
      console.log('UpdateService: Fetching OTA update...');
      console.log('UpdateService: NOTE - This will NOT change the APK version');
      console.log('UpdateService: Only JavaScript bundle will update');
      
      const update = await Updates.fetchUpdateAsync();
      
      if (update.isNew) {
        console.log('UpdateService: New OTA bundle fetched');
        console.log('UpdateService: Reloading app with new bundle...');
        
        // This reloads the app with the new JavaScript bundle
        // The APK stays the same, only the bundle changes
        await Updates.reloadAsync();
        return true;
      } else {
        console.log('UpdateService: No new bundle to apply');
        return false;
      }
    } catch (error) {
      console.error('UpdateService: Failed to fetch OTA update:', error);
      return false;
    }
  }

  /**
   * Check for available updates - OTA first, then APK
   */
  async checkForUpdates(): Promise<{ hasUpdate: boolean; metadata?: UpdateMetadata }> {
    if (this.updateCheckInProgress) {
      console.log('UpdateService: Update check already in progress');
      return { hasUpdate: false };
    }

    try {
      this.updateCheckInProgress = true;
      console.log('UpdateService: Starting update check...');
      console.log('UpdateService: Current APK version:', await this.getCurrentAPKVersion());
      
      // Check OTA first (instant, no download)
      if (this.otaUpdatesAvailable) {
        console.log('UpdateService: Checking for OTA (JavaScript bundle) updates...');
        const otaResult = await this.checkForOTAUpdates();
        if (otaResult.hasUpdate) {
          const currentBundleId = await this.getCurrentBundleId();
          return {
            hasUpdate: true,
            metadata: {
              available: true,
              update_type: 'ota',
              version: await this.getCurrentAPKVersion(), // APK version stays same
              bundle_version: currentBundleId,
              changelog: ['JavaScript bundle update available', 'No APK download required'],
            }
          };
        }
      } else {
        console.log('UpdateService: Skipping OTA check - not available');
      }
      
      // Check for APK updates
      const currentAPKVersion = await this.getCurrentAPKVersion();
      console.log('UpdateService: Checking for APK updates via API...');
      
      const response = await api.get(`/api/v1/updates/info?current_version=${currentAPKVersion}`);
      const data: UpdateMetadata = response.data;
      
      console.log('UpdateService: APK update available:', data.available);
      if (data.available) {
        console.log('UpdateService: New APK version available:', data.version);
      }
      
      if (data.available === true) {
        return { 
          hasUpdate: true, 
          metadata: { 
            ...data, 
            update_type: 'apk' 
          } 
        };
      } else {
        console.log('UpdateService: No updates available');
        return { hasUpdate: false };
      }
      
    } catch (error) {
      console.error('UpdateService: Update check failed:', error);
      return { hasUpdate: false };
    } finally {
      this.updateCheckInProgress = false;
    }
  }

  /**
   * Download APK update with progress tracking
   */
  async downloadUpdateWithProgress(
    metadata: UpdateMetadata, 
    progressCallback?: DownloadProgressCallback
  ): Promise<boolean> {
    if (!metadata.download_url || this.downloadInProgress) {
      return false;
    }

    if (Platform.OS !== 'android') {
      Alert.alert('Unsupported', 'APK updates are only supported on Android.');
      return false;
    }

    try {
      console.log('UpdateService: Starting APK download for version:', metadata.version);
      console.log('UpdateService: This WILL change the APK version when installed');
      
      this.downloadInProgress = true;
      this.downloadProgressCallback = progressCallback || null;
      this.downloadStartTime = Date.now();

      const downloadDir = FileSystem.cacheDirectory + 'downloads/';
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      
      const fileName = `GLT_v${metadata.version?.replace(/\./g, '_')}_update.apk`;
      const tempFileUri = downloadDir + fileName;
      
      const existingFile = await FileSystem.getInfoAsync(tempFileUri);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(tempFileUri);
      }

      this.showDownloadStartAlert(metadata.version);

      const downloadResumable = FileSystem.createDownloadResumable(
        metadata.download_url,
        tempFileUri,
        {},
        this.createProgressHandler(metadata)
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result || result.status !== 200) {
        throw new Error(`Download failed with status ${result?.status || 'unknown'}`);
      }

      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Downloaded file is invalid');
      }

      let downloadsPath: string | undefined;
      try {
        downloadsPath = await this.saveToDownloadsFolder(result.uri, fileName);
      } catch (error) {
        console.warn('UpdateService: Failed to save to Downloads:', error);
      }

      const storedDownload: StoredDownload = {
        version: metadata.version || 'latest',
        filePath: result.uri,
        downloadsPath,
        metadata,
        downloadedAt: Date.now(),
        isComplete: true,
      };
      
      await this.storeDownload(storedDownload);
      this.showDownloadCompleteAlert(storedDownload);
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      
      return true;

    } catch (error) {
      console.error('UpdateService: APK download failed:', error);
      this.showDownloadErrorAlert(metadata.version || 'latest');
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      return false;
    } finally {
      this.downloadInProgress = false;
      this.downloadProgressCallback = null;
    }
  }

  private async saveToDownloadsFolder(sourceUri: string, fileName: string): Promise<string> {
    try {
      const downloadsUri = await this.getDownloadsFolderPermission();
      if (!downloadsUri) {
        throw new Error('Downloads folder permission not granted');
      }

      const downloadedFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        downloadsUri,
        fileName,
        'application/vnd.android.package-archive'
      );

      const fileContent = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await FileSystem.StorageAccessFramework.writeAsStringAsync(
        downloadedFileUri,
        fileContent,
        { encoding: FileSystem.EncodingType.Base64 }
      );

      return downloadedFileUri;
    } catch (error) {
      console.error('Failed to save to Downloads:', error);
      throw error;
    }
  }

  private async getDownloadsFolderPermission(): Promise<string | null> {
    try {
      const storedUri = await AsyncStorage.getItem('downloads_folder_uri');
      if (storedUri) {
        try {
          await FileSystem.StorageAccessFramework.readDirectoryAsync(storedUri);
          return storedUri;
        } catch (error) {
          await AsyncStorage.removeItem('downloads_folder_uri');
        }
      }

      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        await AsyncStorage.setItem('downloads_folder_uri', permissions.directoryUri);
        return permissions.directoryUri;
      }

      return null;
    } catch (error) {
      console.error('Failed to get Downloads permission:', error);
      return null;
    }
  }

  private async openDownloadsFolder() {
    try {
      const downloadsIntent = 'content://com.android.providers.downloads.ui.DownloadList';
      const canOpenDownloads = await Linking.canOpenURL(downloadsIntent);
      
      if (canOpenDownloads) {
        await Linking.openURL(downloadsIntent);
        return;
      }

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: 'content://com.android.externalstorage.documents/document/primary%3ADownload',
        type: 'resource/folder'
      });
    } catch (error) {
      console.error('Failed to open Downloads:', error);
      
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.GET_CONTENT', {
          type: '*/*',
          category: 'android.intent.category.OPENABLE'
        });
      } catch (fallbackError) {
        Alert.alert(
          'Downloads Folder', 
          'Please check your Downloads folder in your file manager for the GLT APK file.'
        );
      }
    }
  }

  private createProgressHandler(metadata: UpdateMetadata) {
    return (downloadProgress: FileSystem.DownloadProgressData) => {
      const currentTime = Date.now();
      const elapsedTime = (currentTime - this.downloadStartTime) / 1000;
      
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

      AsyncStorage.setItem(DOWNLOAD_PROGRESS_KEY, JSON.stringify(progress)).catch(console.error);

      if (this.downloadProgressCallback) {
        this.downloadProgressCallback(progress);
      }
    };
  }

  private showDownloadStartAlert(version?: string) {
    console.log(`UpdateService: Starting APK download for version ${version}...`);
  }

  private showDownloadCompleteAlert(download: StoredDownload) {
    const hasDownloadsPath = !!download.downloadsPath;
    const message = hasDownloadsPath 
      ? `GLT version ${download.version} APK is ready to install.\n\nThe APK has been saved to your Downloads folder.`
      : `GLT version ${download.version} APK is ready to install.`;

    const buttons = [
      { text: 'Install Now', onPress: () => this.installDownloadedAPK(download.version) },
      { text: 'Later', style: 'cancel' as const }
    ];

    if (hasDownloadsPath) {
      buttons.unshift({ text: 'Open Downloads', onPress: () => this.openDownloadsFolder() });
    }

    Alert.alert('APK Downloaded', message, buttons);
  }

  private showDownloadErrorAlert(version: string) {
    Alert.alert(
      'Download Failed',
      `Failed to download GLT version ${version}. Check your internet connection and try again.`,
      [
        { text: 'Retry', onPress: () => this.checkForUpdates() },
        { text: 'OK', style: 'cancel' }
      ]
    );
  }

  async installDownloadedAPK(version?: string): Promise<boolean> {
    try {
      const storedDownload = await this.getStoredDownload();
      
      if (!storedDownload || (version && storedDownload.version !== version)) {
        throw new Error('No matching download found');
      }

      let installPath = storedDownload.filePath;
      
      const fileInfo = await FileSystem.getInfoAsync(installPath);
      if (!fileInfo.exists && storedDownload.downloadsPath) {
        installPath = storedDownload.downloadsPath;
      }

      if (!fileInfo.exists) {
        await this.clearStoredDownload();
        throw new Error('Download file no longer exists');
      }

      await this.installAPKMultipleMethods(installPath, storedDownload.version);
      
      return true;
    } catch (error) {
      console.error('Failed to install APK:', error);
      Alert.alert(
        'Installation Error',
        `Unable to install update: ${error.message}\n\nYou can manually install from Downloads.`,
        [
          { text: 'Open Downloads', onPress: () => this.openDownloadsFolder() },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return false;
    }
  }

  private async checkInstallPermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') return false;
      
      const hasPermission = await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
        data: `package:${Constants.expoConfig?.android?.package || 'com.lvl0_x.gltapp2'}`
      }).then(() => true).catch(() => false);
      
      return hasPermission;
    } catch (error) {
      return false;
    }
  }

  private async requestInstallPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Enable App Installation',
        `To install GLT updates, allow this app to install other apps.\n\nSteps:\n1. Tap "Open Settings"\n2. Turn ON "Allow from this source"\n3. Return to GLT\n4. Try installation again`,
        [
          { 
            text: 'Open Settings', 
            onPress: async () => {
              try {
                await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
                  data: `package:${Constants.expoConfig?.android?.package || 'com.lvl0_x.gltapp2'}`
                });
                resolve(true);
              } catch (error) {
                try {
                  await IntentLauncher.startActivityAsync('android.settings.SECURITY');
                  resolve(true);
                } catch (fallbackError) {
                  resolve(false);
                }
              }
            }
          },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }
        ]
      );
    });
  }

  private async installAPKMultipleMethods(fileUri: string, version: string): Promise<void> {
    const hasPermission = await this.checkInstallPermission();
    
    if (!hasPermission) {
      const permissionGranted = await this.requestInstallPermission();
      if (!permissionGranted) {
        this.showManualInstallOptions(fileUri);
        return;
      }
    }

    Alert.alert(
      'Installing Update',
      `Installing GLT version ${version}...\n\nThe Android installer will open. Please:\n• Tap "Install"\n• Wait for installation\n• App will restart automatically`,
      [
        { text: 'Start Installation', onPress: () => this.tryInstallMethods(fileUri) }
      ]
    );
  }

  private async tryInstallMethods(fileUri: string): Promise<void> {
    const methods = [
      () => IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: fileUri,
        type: 'application/vnd.android.package-archive',
        flags: 268435457,
        extra: {
          'android.intent.extra.NOT_UNKNOWN_SOURCE': true,
          'android.intent.extra.INSTALLER_PACKAGE_NAME': Constants.expoConfig?.android?.package || 'com.lvl0_x.gltapp2'
        }
      }),
      
      () => IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: fileUri,
        type: 'application/vnd.android.package-archive',
        flags: 268435457,
        extra: {
          'android.intent.extra.RETURN_RESULT': true,
          'android.intent.extra.NOT_UNKNOWN_SOURCE': true
        }
      }),

      () => IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: fileUri,
        type: 'application/vnd.android.package-archive',
        flags: 1,
        className: 'com.android.packageinstaller/.InstallAppProgress'
      })
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        await methods[i]();
        this.handleInstallationStarted();
        return;
      } catch (error) {
        console.error(`Installation method ${i + 1} failed:`, error);
        if (i === methods.length - 1) {
          this.showManualInstallOptions(fileUri);
        }
      }
    }
  }

  private handleInstallationStarted(): void {
    Alert.alert(
      'Installation Started',
      'The Android installer is running. After installation, the app will restart with the new version.',
      [{ text: 'OK' }]
    );

    setTimeout(() => {
      this.cleanupAfterInstall();
    }, 3000);
  }

  private showManualInstallOptions(fileUri: string): void {
    Alert.alert(
      'Manual Installation Required',
      'Automatic installation failed. You can:\n\n• Find APK in Downloads folder\n• Open file manager\n• Try installation again',
      [
        { text: 'Open Downloads', onPress: () => this.openDownloadsFolder() },
        { text: 'Try Again', onPress: () => this.tryInstallMethods(fileUri) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }

  private async cleanupAfterInstall(): Promise<void> {
    try {
      await this.clearStoredDownload();
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
    } catch (error) {
      console.error('Failed to cleanup after install:', error);
    }
  }

  async downloadUpdate(metadata?: UpdateMetadata): Promise<boolean> {
    if (!metadata) return false;
    return this.downloadUpdateWithProgress(metadata);
  }

  async installUpdate(metadata?: UpdateMetadata): Promise<void> {
    if (!metadata) {
      throw new Error('Update metadata required');
    }
    
    // Handle OTA updates
    if (metadata.update_type === 'ota') {
      if (!this.otaUpdatesAvailable) {
        throw new Error('OTA updates not available');
      }
      
      const success = await this.fetchAndApplyOTAUpdate();
      if (!success) {
        throw new Error('Failed to apply OTA update');
      }
      return;
    }
    
    // Handle APK updates
    const success = await this.downloadUpdateWithProgress(metadata);
    if (!success) {
      throw new Error('Failed to download APK');
    }
  }

  async scheduleBackgroundDownload(metadata: UpdateMetadata): Promise<void> {
    try {
      const downloadInfo = {
        version: metadata.version,
        metadata,
        scheduledAt: Date.now(),
      };
      
      await AsyncStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(downloadInfo));
    } catch (error) {
      console.error('Failed to schedule background download:', error);
    }
  }

  async scheduleInstallForLater(): Promise<void> {
    await AsyncStorage.setItem('user_postponed_update', 'true');
  }

  private async storeDownload(download: StoredDownload): Promise<void> {
    try {
      await AsyncStorage.setItem('stored_apk_download', JSON.stringify(download));
    } catch (error) {
      console.error('Failed to store download:', error);
    }
  }

  private async getStoredDownload(): Promise<StoredDownload | null> {
    try {
      const stored = await AsyncStorage.getItem('stored_apk_download');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  private async clearStoredDownload(): Promise<void> {
    try {
      await AsyncStorage.removeItem('stored_apk_download');
    } catch (error) {
      console.error('Failed to clear stored download:', error);
    }
  }

  async hasCompletedDownload(): Promise<{ hasDownload: boolean; version?: string }> {
    try {
      const storedDownload = await this.getStoredDownload();
      if (storedDownload && storedDownload.isComplete) {
        const fileInfo = await FileSystem.getInfoAsync(storedDownload.filePath);
        if (fileInfo.exists) {
          return { hasDownload: true, version: storedDownload.version };
        } else {
          await this.clearStoredDownload();
        }
      }
      return { hasDownload: false };
    } catch (error) {
      return { hasDownload: false };
    }
  }

  showUpdateDialog(metadata: UpdateMetadata): Promise<boolean> {
    return new Promise((resolve) => {
      const changelogText = metadata.changelog?.join('\n• ') || 'Bug fixes and improvements';
      const sizeText = metadata.file_size ? ` (${this.formatFileSize(metadata.file_size)})` : '';
      
      const isOTA = metadata.update_type === 'ota';
      const updateTypeText = isOTA ? 'JavaScript Bundle Update (OTA)' : 'APK Update';
      const updateDescription = isOTA 
        ? 'This will update your app code instantly without changing the APK version.'
        : 'This will download and install a new APK file, changing your app version.';
      
      Alert.alert(
        metadata.force_update ? 'Required Update' : 'Update Available',
        `${updateTypeText} - Version ${metadata.version}${sizeText}\n\n• ${changelogText}\n\n${updateDescription}`,
        [
          ...(metadata.force_update ? [] : [{
            text: 'Later',
            style: 'cancel' as const,
            onPress: () => resolve(false)
          }]),
          {
            text: isOTA ? 'Update Now' : 'Download',
            onPress: () => resolve(true)
          }
        ],
        { cancelable: !metadata.force_update }
      );
    });
  }

  /**
   * Get current APK version
   * This is the native app version that only changes with new APK installs
   */
  async getCurrentAPKVersion(): Promise<string> {
    try {
      const storedVersion = await this.getStoredCurrentVersion();
      if (storedVersion) {
        return storedVersion;
      }
      
      const configVersion = Constants.expoConfig?.version;
      if (configVersion) {
        await this.setCurrentVersion(configVersion);
        return configVersion;
      }
      
      return '1.8.3';
    } catch (error) {
      console.error('Failed to get APK version:', error);
      return '1.8.3';
    }
  }

  async getCurrentVersion(): Promise<string> {
    return this.getCurrentAPKVersion();
  }

  async setCurrentVersion(version: string): Promise<void> {
    try {
      await AsyncStorage.setItem('app_current_version', version);
    } catch (error) {
      console.error('Failed to set current version:', error);
    }
  }

  private async getStoredCurrentVersion(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('app_current_version');
    } catch (error) {
      return null;
    }
  }

  async getUpdateId(): Promise<string> {
    return await this.getCurrentAPKVersion();
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  isUpdateSupported(): boolean {
    const supported = Platform.OS === 'android' || this.otaUpdatesAvailable;
    return supported;
  }

  async hasUserPostponedUpdate(): Promise<boolean> {
    try {
      const postponed = await AsyncStorage.getItem('user_postponed_update');
      return postponed === 'true';
    } catch {
      return false;
    }
  }

  async clearPostponedUpdate(): Promise<void> {
    try {
      await AsyncStorage.removeItem('user_postponed_update');
    } catch (error) {
      console.error('Failed to clear postponed update:', error);
    }
  }

  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export default UpdateService;
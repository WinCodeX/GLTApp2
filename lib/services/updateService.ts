// lib/services/updateService.ts - Enhanced with Downloads folder and ChangelogModal version integration

import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, Alert, AppState, AppStateStatus, Linking } from 'react-native';

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
  downloadsPath?: string; // Path in Downloads folder
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

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async initialize() {
    try {
      // Detect if running in Expo Go
      this.isExpoGo = Constants.appOwnership === 'expo';
      
      if (this.isExpoGo) {
        console.log('Running in Expo Go - limited functionality');
      }
      
      // Initialize version tracking
      await this.initializeVersionTracking();
      
      // Check for pending downloads
      await this.checkPendingDownloads();
      
      // Monitor app state changes for background downloads
      this.setupAppStateMonitoring();
      
      console.log('UpdateService initialized successfully');
    } catch (error) {
      console.error('UpdateService initialization failed:', error);
    }
  }

  /**
   * Initialize version tracking for update detection
   */
  private async initializeVersionTracking(): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const lastKnownVersion = await AsyncStorage.getItem('last_known_version');
      
      if (!lastKnownVersion) {
        // First run - set current version
        await AsyncStorage.setItem('last_known_version', currentVersion);
        console.log('Version tracking initialized:', currentVersion);
      }
    } catch (error) {
      console.error('Failed to initialize version tracking:', error);
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
      // App coming to foreground - check download status and installation status
      await this.checkDownloadStatus();
      await this.checkPostInstallation();
    }
  }

  /**
   * Check if app was updated after returning from background
   */
  private async checkPostInstallation(): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const lastKnownVersion = await AsyncStorage.getItem('last_known_version');
      
      if (lastKnownVersion && lastKnownVersion !== currentVersion) {
        // Version changed - installation was successful!
        console.log(`App updated successfully: ${lastKnownVersion} → ${currentVersion}`);
        
        // Clean up any remaining download files
        await this.cleanupAfterSuccessfulInstall();
        
        // Show success message
        Alert.alert(
          'Update Successful! ✅',
          `GLT has been updated to version ${currentVersion}. Enjoy the new features and improvements!`,
          [{ text: 'Great!' }]
        );
      }
      
      // Always update the last known version
      await AsyncStorage.setItem('last_known_version', currentVersion);
    } catch (error) {
      console.error('Failed to check post-installation status:', error);
    }
  }

  /**
   * Cleanup after successful installation
   */
  private async cleanupAfterSuccessfulInstall(): Promise<void> {
    try {
      // Clear all update-related storage
      await AsyncStorage.multiRemove([
        'stored_apk_download',
        'pending_apk_download', 
        'download_progress',
        'user_postponed_update'
      ]);
      
      console.log('Cleanup completed after successful installation');
    } catch (error) {
      console.error('Failed to cleanup after successful install:', error);
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
          
          // Show alert about available install
          this.showDownloadCompleteAlert(storedDownload);
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
      
      const currentVersion = await this.getCurrentVersion();
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
   * Download update with progress tracking and Downloads folder support (SDK 54)
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

      // First download to cache, then copy to Downloads using SAF
      const downloadDir = FileSystem.cacheDirectory + 'downloads/';
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      
      const fileName = `GLT_v${metadata.version?.replace(/\./g, '_')}_update.apk`;
      const tempFileUri = downloadDir + fileName;
      
      // Clean up any existing file
      const existingFile = await FileSystem.getInfoAsync(tempFileUri);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(tempFileUri);
      }

      // Show download start alert
      this.showDownloadStartAlert(metadata.version);

      // Start download with progress tracking
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

      // Verify file integrity
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Downloaded file is invalid');
      }

      console.log('APK downloaded to cache:', result.uri);

      // Copy to Downloads folder using Storage Access Framework
      let downloadsPath: string | undefined;
      try {
        downloadsPath = await this.saveToDownloadsFolder(result.uri, fileName);
        console.log('APK saved to Downloads folder:', downloadsPath);
      } catch (error) {
        console.warn('Failed to save to Downloads folder:', error);
        // Continue anyway - we still have the file in cache
      }

      // Store download info
      const storedDownload: StoredDownload = {
        version: metadata.version || 'latest',
        filePath: result.uri,
        downloadsPath,
        metadata,
        downloadedAt: Date.now(),
        isComplete: true,
      };
      
      await this.storeDownload(storedDownload);
      
      // Show completion alert
      this.showDownloadCompleteAlert(storedDownload);
      
      // Clear progress tracking
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      
      console.log('APK download completed successfully:', result.uri);
      return true;

    } catch (error) {
      console.error('APK download failed:', error);
      
      // Show error alert
      this.showDownloadErrorAlert(metadata.version || 'latest');
      
      // Clear progress tracking
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      
      return false;
    } finally {
      this.downloadInProgress = false;
      this.downloadProgressCallback = null;
    }
  }

  /**
   * Save file to Downloads folder using Storage Access Framework (SDK 54)
   */
  private async saveToDownloadsFolder(sourceUri: string, fileName: string): Promise<string> {
    try {
      // Get or request Downloads folder permission
      const downloadsUri = await this.getDownloadsFolderPermission();
      if (!downloadsUri) {
        throw new Error('Downloads folder permission not granted');
      }

      // Create the APK file in Downloads folder
      const downloadedFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        downloadsUri,
        fileName,
        'application/vnd.android.package-archive'
      );

      // Read the source file and write to Downloads
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
      console.error('Failed to save to Downloads folder:', error);
      throw error;
    }
  }

  /**
   * Get Downloads folder permission using Storage Access Framework
   */
  private async getDownloadsFolderPermission(): Promise<string | null> {
    try {
      // Check if we already have permission stored
      const storedUri = await AsyncStorage.getItem('downloads_folder_uri');
      if (storedUri) {
        // Verify the permission is still valid
        try {
          await FileSystem.StorageAccessFramework.readDirectoryAsync(storedUri);
          return storedUri;
        } catch (error) {
          // Permission invalid, need to request again
          await AsyncStorage.removeItem('downloads_folder_uri');
        }
      }

      // Request Downloads folder permission
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        // Save the permission for future use
        await AsyncStorage.setItem('downloads_folder_uri', permissions.directoryUri);
        return permissions.directoryUri;
      }

      return null;
    } catch (error) {
      console.error('Failed to get Downloads folder permission:', error);
      return null;
    }
  }

  /**
   * Open Downloads folder using file manager intent
   */
  private async openDownloadsFolder() {
    try {
      // Method 1: Try Downloads app
      const downloadsIntent = 'content://com.android.providers.downloads.ui.DownloadList';
      const canOpenDownloads = await Linking.canOpenURL(downloadsIntent);
      
      if (canOpenDownloads) {
        await Linking.openURL(downloadsIntent);
        return;
      }

      // Method 2: Try file manager with Downloads path
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: 'content://com.android.externalstorage.documents/document/primary%3ADownload',
        type: 'resource/folder'
      });
    } catch (error) {
      console.error('Failed to open Downloads folder:', error);
      
      // Method 3: Generic file manager
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.GET_CONTENT', {
          type: '*/*',
          category: 'android.intent.category.OPENABLE'
        });
      } catch (fallbackError) {
        console.error('All methods failed to open Downloads:', fallbackError);
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

      // Call progress callback
      if (this.downloadProgressCallback) {
        this.downloadProgressCallback(progress);
      }
    };
  }

  private showDownloadStartAlert(version?: string) {
    console.log(`Starting download for GLT version ${version || 'latest'}...`);
  }

  private showDownloadCompleteAlert(download: StoredDownload) {
    const hasDownloadsPath = !!download.downloadsPath;
    const message = hasDownloadsPath 
      ? `GLT version ${download.version} is ready to install.\n\nThe APK has been saved to your Downloads folder and is ready for installation.`
      : `GLT version ${download.version} is ready to install.\n\nThe APK has been downloaded and is ready for installation.`;

    const buttons = [
      { text: 'Install Now', onPress: () => this.installDownloadedAPK(download.version) },
      { text: 'Later', style: 'cancel' as const }
    ];

    // Add Downloads button if we successfully saved to Downloads folder
    if (hasDownloadsPath) {
      buttons.unshift({ text: 'Open Downloads', onPress: () => this.openDownloadsFolder() });
    }

    Alert.alert('Update Downloaded ✓', message, buttons);
  }

  private showDownloadErrorAlert(version: string) {
    Alert.alert(
      'Download Failed',
      `Failed to download GLT version ${version}. Please check your internet connection and try again.`,
      [
        { text: 'Retry', onPress: () => this.checkForUpdates() },
        { text: 'OK', style: 'cancel' }
      ]
    );
  }

  /**
   * Install downloaded APK with multiple methods
   */
  async installDownloadedAPK(version?: string): Promise<boolean> {
    try {
      const storedDownload = await this.getStoredDownload();
      
      if (!storedDownload || (version && storedDownload.version !== version)) {
        throw new Error('No matching download found');
      }

      // Try app storage file first, then Downloads folder
      let installPath = storedDownload.filePath;
      
      // Verify file still exists
      const fileInfo = await FileSystem.getInfoAsync(installPath);
      if (!fileInfo.exists && storedDownload.downloadsPath) {
        // Try Downloads folder copy
        installPath = storedDownload.downloadsPath;
      }

      if (!fileInfo.exists) {
        await this.clearStoredDownload();
        throw new Error('Download file no longer exists');
      }

      // Install APK with multiple methods
      await this.installAPKMultipleMethods(installPath, storedDownload.version);
      
      return true;
    } catch (error) {
      console.error('Failed to install downloaded APK:', error);
      Alert.alert(
        'Installation Error',
        `Unable to install update: ${error.message}\n\nYou can manually install the APK from your Downloads folder.`,
        [
          { text: 'Open Downloads', onPress: () => this.openDownloadsFolder() },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return false;
    }
  }

  /**
   * Check if app has install permissions and guide user through the process
   */
  private async checkInstallPermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') return false;
      
      // Check if we can install packages (Android 8.0+)
      const hasPermission = await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
        data: `package:${Constants.expoConfig?.android?.package || 'com.lvl0_x.gltapp2'}`
      }).then(() => true).catch(() => false);
      
      return hasPermission;
    } catch (error) {
      console.error('Failed to check install permission:', error);
      return false;
    }
  }

  /**
   * Guide user to enable install permissions if needed
   */
  private async requestInstallPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Enable App Installation',
        `To install GLT updates, you need to allow this app to install other apps.\n\nSteps:\n1. Tap "Open Settings"\n2. Turn ON "Allow from this source"\n3. Come back to GLT\n4. Try installation again`,
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
                console.error('Failed to open install permission settings:', error);
                // Fallback to general security settings
                try {
                  await IntentLauncher.startActivityAsync('android.settings.SECURITY');
                  resolve(true);
                } catch (fallbackError) {
                  console.error('Failed to open security settings:', fallbackError);
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

  /**
   * Try multiple installation methods for better compatibility
   */
  private async installAPKMultipleMethods(fileUri: string, version: string): Promise<void> {
    console.log('Installing APK:', fileUri);

    // First check if we have install permissions
    const hasPermission = await this.checkInstallPermission();
    
    if (!hasPermission) {
      // Guide user to enable permissions
      const permissionGranted = await this.requestInstallPermission();
      if (!permissionGranted) {
        // User cancelled or couldn't enable permissions
        this.showManualInstallOptions(fileUri);
        return;
      }
    }

    // Show installation starting message
    Alert.alert(
      'Installing Update',
      `Installing GLT version ${version}...\n\nThe Android installer will open. Please:\n• Tap "Install" when prompted\n• Wait for installation to complete\n• The app will restart automatically`,
      [
        { text: 'Start Installation', onPress: () => this.tryInstallMethods(fileUri) }
      ]
    );
  }

  private async tryInstallMethods(fileUri: string): Promise<void> {
    const methods = [
      // Method 1: Standard VIEW intent with proper flags
      () => IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: fileUri,
        type: 'application/vnd.android.package-archive',
        flags: 268435457, // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION
        extra: {
          'android.intent.extra.NOT_UNKNOWN_SOURCE': true,
          'android.intent.extra.INSTALLER_PACKAGE_NAME': Constants.expoConfig?.android?.package || 'com.lvl0_x.gltapp2'
        }
      }),
      
      // Method 2: INSTALL_PACKAGE intent (Android 7.0+)
      () => IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: fileUri,
        type: 'application/vnd.android.package-archive',
        flags: 268435457,
        extra: {
          'android.intent.extra.RETURN_RESULT': true,
          'android.intent.extra.NOT_UNKNOWN_SOURCE': true
        }
      }),

      // Method 3: Package manager intent
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
        console.log(`Installation method ${i + 1} launched successfully`);
        
        // Show success message and cleanup
        this.handleInstallationStarted();
        return;
      } catch (error) {
        console.error(`Installation method ${i + 1} failed:`, error);
        if (i === methods.length - 1) {
          // All methods failed, show manual options
          this.showManualInstallOptions(fileUri);
        }
      }
    }
  }

  /**
   * Handle when installation process has started
   */
  private handleInstallationStarted(): void {
    // Show success message
    Alert.alert(
      'Installation Started',
      'The Android installer is now running. After installation completes, the app will restart with the new version.',
      [{ text: 'OK' }]
    );

    // Schedule cleanup after a delay (installer is running)
    setTimeout(() => {
      this.cleanupAfterInstall();
    }, 3000);
  }

  /**
   * Show manual installation options when automatic fails
   */
  private showManualInstallOptions(fileUri: string): void {
    Alert.alert(
      'Manual Installation Required',
      'Automatic installation failed. You can:\n\n• Find the APK in Downloads folder\n• Open your file manager to locate the file\n• Try installation again',
      [
        { text: 'Open Downloads', onPress: () => this.openDownloadsFolder() },
        { text: 'Try Again', onPress: () => this.tryInstallMethods(fileUri) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }

  /**
   * Cleanup after installation attempt
   */
  private async cleanupAfterInstall(): Promise<void> {
    try {
      // Clear stored download info since installation is in progress
      await this.clearStoredDownload();
      
      // Clear progress tracking
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      
      console.log('Cleanup completed after installation');
    } catch (error) {
      console.error('Failed to cleanup after install:', error);
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
   * Install update - for APK updates, this triggers download and install
   */
  async installUpdate(metadata?: UpdateMetadata): Promise<void> {
    if (!metadata) {
      throw new Error('Update metadata required for APK installation');
    }
    
    const success = await this.downloadUpdateWithProgress(metadata);
    if (!success) {
      throw new Error('Failed to download APK update');
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
        `Version ${metadata.version}${sizeText}\n\n• ${changelogText}\n\nThis will download and install a new APK file to your Downloads folder.`,
        [
          ...(metadata.force_update ? [] : [{
            text: 'Later',
            style: 'cancel' as const,
            onPress: () => resolve(false)
          }]),
          {
            text: 'Download',
            onPress: () => resolve(true)
          }
        ],
        { cancelable: !metadata.force_update }
      );
    });
  }

  /**
   * Get current app version from ChangelogModal or Constants
   */
  async getCurrentVersion(): Promise<string> {
    try {
      // First try to get from stored version (set by ChangelogModal)
      const storedVersion = await this.getStoredCurrentVersion();
      if (storedVersion) {
        return storedVersion;
      }
      
      // Fallback to Constants
      const configVersion = Constants.expoConfig?.version;
      if (configVersion) {
        // Store it for future use
        await this.setCurrentVersion(configVersion);
        return configVersion;
      }
      
      // Final fallback
      return '1.7.6';
    } catch (error) {
      console.error('Failed to get current version:', error);
      return '1.7.6';
    }
  }

  /**
   * Set current version from external source (like ChangelogModal)
   */
  async setCurrentVersion(version: string): Promise<void> {
    try {
      await AsyncStorage.setItem('app_current_version', version);
      console.log('Version set to:', version);
    } catch (error) {
      console.error('Failed to set current version:', error);
    }
  }

  /**
   * Get stored current version
   */
  private async getStoredCurrentVersion(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('app_current_version');
    } catch (error) {
      console.error('Failed to get stored version:', error);
      return null;
    }
  }

  /**
   * Get update ID - for APK updates, return app version
   */
  async getUpdateId(): Promise<string> {
    return await this.getCurrentVersion();
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
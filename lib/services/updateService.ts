// lib/services/updateService.ts - Enhanced with Detailed OTA Logging

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';
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
  bundle_version?: string;
  expo_go_incompatible?: boolean;
  reason?: string;
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
      console.log('═══════════════════════════════════════════════════════');
      console.log('🚀 UpdateService: INITIALIZATION STARTING');
      console.log('═══════════════════════════════════════════════════════');
      
      // Detect Expo Go
      this.isExpoGo = Constants.appOwnership === 'expo';
      console.log('📱 App Ownership:', Constants.appOwnership);
      console.log('🔍 Is Expo Go:', this.isExpoGo);
      
      // Check OTA availability
      this.otaUpdatesAvailable = !this.isExpoGo && Updates.isEnabled;
      console.log('⚡ Updates.isEnabled:', Updates.isEnabled);
      console.log('✅ OTA Updates Available:', this.otaUpdatesAvailable);
      
      if (this.isExpoGo) {
        console.log('⚠️  RUNNING IN EXPO GO');
        console.log('⚠️  OTA updates are NOT available in Expo Go');
        console.log('⚠️  You must build a standalone app for OTA updates');
      } else if (this.otaUpdatesAvailable) {
        console.log('✅ RUNNING IN STANDALONE BUILD');
        console.log('✅ OTA updates are AVAILABLE');
        console.log('📦 Current Runtime Version:', Updates.runtimeVersion);
        console.log('🆔 Current Update ID:', Updates.updateId);
        console.log('📺 Current Channel:', Updates.channel);
        console.log('🔗 Update URL:', Updates.manifest?.extra?.expoClient?.updates?.url);
      } else {
        console.log('❌ OTA Updates Disabled');
        console.log('❌ Updates.isEnabled is false');
      }
      
      await this.initializeVersionTracking();
      this.setupAppStateMonitoring();
      await this.checkForOTAUpdateApplication();
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ UpdateService: INITIALIZATION COMPLETED');
      console.log('═══════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('❌ UpdateService: Initialization failed:', error);
    }
  }

  /**
   * Check if an OTA update was just applied
   */
  private async checkForOTAUpdateApplication(): Promise<void> {
    if (!this.otaUpdatesAvailable) {
      console.log('⏭️  Skipping OTA application check (not available)');
      return;
    }

    try {
      const currentUpdateId = Updates.updateId;
      const lastKnownUpdateId = await AsyncStorage.getItem('last_known_update_id');
      
      console.log('🔍 Checking for applied OTA updates...');
      console.log('   Current Update ID:', currentUpdateId);
      console.log('   Last Known Update ID:', lastKnownUpdateId);
      
      if (lastKnownUpdateId && lastKnownUpdateId !== currentUpdateId) {
        console.log('🎉 OTA UPDATE DETECTED - Bundle has changed!');
        
        Alert.alert(
          'Update Applied!',
          'An over-the-air update has been applied. Your app is now running the latest code.',
          [{ text: 'Great!' }]
        );
      } else {
        console.log('   No OTA update detected (IDs match)');
      }
      
      if (currentUpdateId) {
        await AsyncStorage.setItem('last_known_update_id', currentUpdateId);
      }
    } catch (error) {
      console.error('❌ Failed to check OTA application:', error);
    }
  }

  private async initializeVersionTracking(): Promise<void> {
    try {
      console.log('📊 Initializing version tracking...');
      
      const currentAPKVersion = await this.getCurrentAPKVersion();
      const lastKnownAPKVersion = await AsyncStorage.getItem('last_known_apk_version');
      
      console.log('   Current APK Version:', currentAPKVersion);
      console.log('   Last Known APK Version:', lastKnownAPKVersion);
      
      if (!lastKnownAPKVersion) {
        await AsyncStorage.setItem('last_known_apk_version', currentAPKVersion);
        console.log('   ✅ Version tracking initialized');
      } else if (lastKnownAPKVersion !== currentAPKVersion) {
        console.log('   🆕 APK version changed - new installation detected');
        await this.cleanupAfterSuccessfulInstall();
        await AsyncStorage.setItem('last_known_apk_version', currentAPKVersion);
        
        Alert.alert(
          'Update Successful!',
          `GLT has been updated to version ${currentAPKVersion}. Enjoy the new features!`,
          [{ text: 'Great!' }]
        );
      }
    } catch (error) {
      console.error('❌ Failed to initialize version tracking:', error);
    }
  }

  private setupAppStateMonitoring() {
    console.log('👁️  Setting up app state monitoring...');
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    console.log(`📲 App state changed to: ${nextAppState}`);
    
    if (nextAppState === 'active') {
      await this.checkPostInstallation();
      
      if (this.otaUpdatesAvailable) {
        await this.checkForOTAUpdateApplication();
      }
    }
  }

  private async checkPostInstallation(): Promise<void> {
    try {
      console.log('🔍 Checking post-installation status...');
      
      const currentVersion = await this.getCurrentAPKVersion();
      const lastKnownVersion = await AsyncStorage.getItem('last_known_apk_version');
      
      if (lastKnownVersion && lastKnownVersion !== currentVersion) {
        console.log(`🔄 APK updated: ${lastKnownVersion} → ${currentVersion}`);
        await this.cleanupAfterSuccessfulInstall();
      }
      
      await AsyncStorage.setItem('last_known_apk_version', currentVersion);
    } catch (error) {
      console.error('❌ Failed to check post-installation:', error);
    }
  }

  private async cleanupAfterSuccessfulInstall(): Promise<void> {
    try {
      console.log('🧹 Cleaning up after successful installation...');
      
      await AsyncStorage.multiRemove([
        'stored_apk_download',
        'pending_apk_download', 
        'download_progress',
        'user_postponed_update'
      ]);
      
      console.log('   ✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Failed to cleanup:', error);
    }
  }

  /**
   * ✅ ENHANCED: Check for Expo OTA updates with detailed logging
   * Detects Expo Go and provides clear feedback
   */
  async checkForOTAUpdates(): Promise<{ hasUpdate: boolean; isAvailable?: boolean; manifest?: any; reason?: string }> {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║          CHECKING FOR OTA UPDATES                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    // Check if running in Expo Go
    if (this.isExpoGo) {
      console.log('❌ CANNOT CHECK OTA - RUNNING IN EXPO GO');
      console.log('   Reason: Expo Go does not support custom OTA updates');
      console.log('   Solution: Build a standalone app with:');
      console.log('   • eas build --platform android --profile production');
      console.log('   • or: cd android && ./gradlew assembleRelease');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      
      return { 
        hasUpdate: false, 
        reason: 'Running in Expo Go - OTA updates not supported. Build a standalone app to enable OTA updates.' 
      };
    }

    // Check if OTA updates are enabled
    if (!this.otaUpdatesAvailable) {
      console.log('❌ CANNOT CHECK OTA - UPDATES NOT ENABLED');
      console.log('   Updates.isEnabled:', Updates.isEnabled);
      console.log('   Possible reasons:');
      console.log('   • Development build without updates enabled');
      console.log('   • Missing expo-updates configuration');
      console.log('   • Running in simulator/emulator');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      
      return { 
        hasUpdate: false, 
        reason: 'OTA updates not enabled in this build' 
      };
    }

    try {
      console.log('📋 Current Build Information:');
      console.log('   Runtime Version:', Updates.runtimeVersion || 'Not set');
      console.log('   Current Update ID:', Updates.updateId || 'Not set');
      console.log('   Channel:', Updates.channel || 'default');
      console.log('   Platform:', Platform.OS);
      console.log('   App Version:', await this.getCurrentAPKVersion());
      console.log('');
      
      console.log('🌐 Querying Expo Update Server...');
      console.log('   Checking for updates with runtime:', Updates.runtimeVersion);
      
      // ✅ This checks the REMOTE server for new manifests
      const updateCheckStartTime = Date.now();
      const update = await Updates.checkForUpdateAsync();
      const checkDuration = Date.now() - updateCheckStartTime;
      
      console.log(`   ✅ Server responded in ${checkDuration}ms`);
      console.log('');
      console.log('📦 Server Response:');
      console.log('   isAvailable:', update.isAvailable);
      console.log('   manifest:', update.manifest ? 'Present ✓' : 'Null ✗');
      
      if (update.manifest) {
        console.log('   Remote Manifest Details:');
        console.log('      ID:', update.manifest.id || 'N/A');
        console.log('      Created At:', update.manifest.createdAt || 'N/A');
        console.log('      Runtime Version:', update.manifest.runtimeVersion || 'N/A');
      }
      console.log('');
      
      if (update.isAvailable) {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  ✅ NEW OTA UPDATE AVAILABLE ON REMOTE SERVER!        ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('🎉 Update Details:');
        console.log('   Current Bundle ID:', Updates.updateId);
        console.log('   New Bundle ID:', update.manifest?.id);
        console.log('   Runtime Version Match: ✅');
        console.log('   Ready to Download: ✅');
        console.log('   Installation: Instant (no APK change needed)');
        console.log('╚════════════════════════════════════════════════════════╝\n');
        
        return { 
          hasUpdate: true, 
          isAvailable: true,
          manifest: update.manifest
        };
      } else {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  ℹ️  NO OTA UPDATES AVAILABLE                          ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('   Current bundle is the latest available');
        console.log('   Your app is up to date! ✅');
        console.log('');
        console.log('   Possible reasons for no update:');
        console.log('   • Runtime version mismatch (check published update)');
        console.log('   • No updates published for this runtime version');
        console.log('   • Already running the latest bundle');
        console.log('   • Channel mismatch (app vs published update)');
        console.log('╚════════════════════════════════════════════════════════╝\n');
        
        return { hasUpdate: false, isAvailable: false };
      }
    } catch (error: any) {
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║  ❌ OTA UPDATE CHECK FAILED                            ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.error('❌ Error Type:', error.name || 'Unknown');
      console.error('❌ Error Message:', error.message || 'No message');
      console.error('❌ Error Stack:', error.stack || 'No stack trace');
      console.error('');
      console.error('💡 Troubleshooting:');
      console.error('   1. Check internet connection');
      console.error('   2. Verify app.json has correct updates.url');
      console.error('   3. Confirm runtime version matches published update');
      console.error('   4. Check if update server is accessible');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      
      return { 
        hasUpdate: false, 
        reason: `Update check failed: ${error.message}` 
      };
    }
  }

  /**
   * ✅ ENHANCED: Fetch and apply the REMOTE OTA update with detailed logging
   */
  async fetchAndApplyOTAUpdate(): Promise<boolean> {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║          FETCHING & APPLYING OTA UPDATE                ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    if (this.isExpoGo) {
      console.log('❌ CANNOT APPLY OTA - RUNNING IN EXPO GO');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      return false;
    }

    if (!this.otaUpdatesAvailable) {
      console.log('❌ CANNOT APPLY OTA - UPDATES NOT ENABLED');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      return false;
    }

    try {
      console.log('📋 Before Fetch:');
      console.log('   Current Update ID:', Updates.updateId);
      console.log('   Runtime Version:', Updates.runtimeVersion);
      console.log('');
      
      console.log('⬇️  Fetching update from server...');
      const fetchStartTime = Date.now();
      
      // ✅ This fetches the NEW bundle from the server
      const fetchResult = await Updates.fetchUpdateAsync();
      
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`   ✅ Fetch completed in ${fetchDuration}ms`);
      console.log('');
      
      console.log('📦 Fetch Result:');
      console.log('   isNew:', fetchResult.isNew);
      console.log('   manifest:', fetchResult.manifest ? 'Present ✓' : 'Null ✗');
      
      if (fetchResult.manifest) {
        console.log('   Downloaded Bundle Details:');
        console.log('      ID:', fetchResult.manifest.id || 'N/A');
        console.log('      Created At:', fetchResult.manifest.createdAt || 'N/A');
      }
      console.log('');
      
      if (fetchResult.isNew) {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  ✅ NEW BUNDLE DOWNLOADED SUCCESSFULLY!                ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('🔄 Reloading app with new bundle...');
        console.log('   Old Bundle ID:', Updates.updateId);
        console.log('   New Bundle ID:', fetchResult.manifest?.id);
        console.log('   App will restart in 3... 2... 1...');
        console.log('╚════════════════════════════════════════════════════════╝\n');
        
        // This reloads the app with the NEW bundle we just fetched
        await Updates.reloadAsync();
        return true;
      } else {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  ℹ️  NO NEW BUNDLE TO APPLY                            ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('   Already running the latest bundle');
        console.log('   No reload needed');
        console.log('╚════════════════════════════════════════════════════════╝\n');
        return false;
      }
    } catch (error: any) {
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║  ❌ FAILED TO FETCH/APPLY OTA UPDATE                   ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.error('❌ Error Type:', error.name || 'Unknown');
      console.error('❌ Error Message:', error.message || 'No message');
      console.error('❌ Error Stack:', error.stack || 'No stack trace');
      console.log('╚════════════════════════════════════════════════════════╝\n');
      return false;
    }
  }

  /**
   * ✅ ENHANCED: Check for updates with comprehensive logging
   */
  async checkForUpdates(): Promise<{ hasUpdate: boolean; metadata?: UpdateMetadata }> {
    if (this.updateCheckInProgress) {
      console.log('⚠️  Update check already in progress, skipping...');
      return { hasUpdate: false };
    }

    try {
      this.updateCheckInProgress = true;
      
      console.log('\n');
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                  STARTING UPDATE CHECK                    ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('');
      
      const currentAPKVersion = await this.getCurrentAPKVersion();
      console.log('📱 Current APK Version:', currentAPKVersion);
      console.log('🏗️  Build Type:', this.isExpoGo ? 'Expo Go' : 'Standalone');
      console.log('⚡ OTA Available:', this.otaUpdatesAvailable);
      console.log('');
      
      // ✅ Check OTA first (instant, no download)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('STEP 1: Checking for OTA (Over-The-Air) Updates');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (this.isExpoGo) {
        console.log('⚠️  Skipping OTA check - Running in Expo Go');
        console.log('   OTA updates require a standalone build');
        console.log('   Build with: eas build --platform android');
      } else if (!this.otaUpdatesAvailable) {
        console.log('⚠️  Skipping OTA check - Updates not enabled');
      } else {
        const otaResult = await this.checkForOTAUpdates();
        
        if (otaResult.hasUpdate) {
          console.log('');
          console.log('╔═══════════════════════════════════════════════════════════╗');
          console.log('║         ✅ OTA UPDATE FOUND - READY TO INSTALL            ║');
          console.log('╚═══════════════════════════════════════════════════════════╝');
          
          const remoteManifestId = otaResult.manifest?.id || 'unknown';
          
          return {
            hasUpdate: true,
            metadata: {
              available: true,
              update_type: 'ota',
              version: currentAPKVersion,
              bundle_version: remoteManifestId,
              changelog: [
                'JavaScript bundle update available',
                'No APK download required',
                'Update will apply instantly'
              ],
            }
          };
        } else if (otaResult.reason) {
          console.log('');
          console.log('ℹ️  OTA Check Result:', otaResult.reason);
        }
      }
      
      console.log('');
      
      // ✅ Check for APK updates via API
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('STEP 2: Checking for APK Updates via API');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🌐 Querying API with version:', currentAPKVersion);
      
      try {
        const response = await api.get(`/api/v1/updates/info?current_version=${currentAPKVersion}`);
        const data: UpdateMetadata = response.data;
        
        console.log('📡 API Response:');
        console.log('   Available:', data.available);
        console.log('   Remote Version:', data.version);
        console.log('   Force Update:', data.force_update);
        console.log('');
        
        if (data.available === true) {
          console.log('╔═══════════════════════════════════════════════════════════╗');
          console.log('║        ✅ APK UPDATE FOUND - DOWNLOAD AVAILABLE           ║');
          console.log('╚═══════════════════════════════════════════════════════════╝');
          console.log('🆕 New Version:', data.version);
          console.log('📦 Current Version:', currentAPKVersion);
          console.log('');
          
          return { 
            hasUpdate: true, 
            metadata: { 
              ...data, 
              update_type: 'apk' 
            } 
          };
        } else {
          console.log('ℹ️  No APK updates available');
          console.log('   Your APK version is up to date');
        }
      } catch (apiError: any) {
        console.error('❌ API check failed:', apiError.message);
      }
      
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║              ✅ NO UPDATES AVAILABLE                      ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('   Your app is fully up to date!');
      console.log('   • APK Version: Latest ✓');
      console.log('   • JavaScript Bundle: Latest ✓');
      console.log('');
      
      return { hasUpdate: false };
      
    } catch (error: any) {
      console.error('');
      console.error('╔═══════════════════════════════════════════════════════════╗');
      console.error('║              ❌ UPDATE CHECK FAILED                       ║');
      console.error('╚═══════════════════════════════════════════════════════════╝');
      console.error('Error:', error.message);
      console.error('');
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
      console.log('⬇️  Starting APK download for version:', metadata.version);
      
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
        console.warn('⚠️  Failed to save to Downloads:', error);
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
      console.error('❌ APK download failed:', error);
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
    console.log(`⬇️  Starting APK download for version ${version}...`);
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
    } catch (error: any) {
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
      
      return '1.8.5';
    } catch (error) {
      console.error('Failed to get APK version:', error);
      return '1.8.5';
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
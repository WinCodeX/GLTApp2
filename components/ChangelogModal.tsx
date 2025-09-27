// components/ChangelogModal.tsx

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UpdateService from '../lib/services/updateService';

export const CHANGELOG_VERSION = '1.7.8';
export const CHANGELOG_KEY = `changelog_seen_${CHANGELOG_VERSION}`;
const autoDismissDelay = 10000; // Increased from 7000 to 10000 to allow more time for update checks

const CHANGELOG_CONTENT = [
  'Fixed going back in screens',
  'Terms and conditions update',
  'Auto reject feature added',
  'Polished UI in contact screen',
  'Push notifications and sounds added',
'Talk to a representative implemented',
'Support functionality implemented',
  'Other Bug fixes',
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

interface UpdateInfo {
  isAvailable: boolean;
  version?: string;
  changelog?: string[];
  file_size?: number;
  force_update?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
  hasCompletedDownload?: boolean;
  completedVersion?: string;
}

export default function ChangelogModal({ visible, onClose }: Props) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ isAvailable: false });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateService] = useState(() => UpdateService.getInstance());

  useEffect(() => {
    if (visible) {
      console.log('📱 ChangelogModal: Modal became visible, initializing...');
      initializeAndCheckUpdates();
      
      // Auto-dismiss if no updates available (increased delay)
      const timer = setTimeout(() => {
        console.log('⏰ ChangelogModal: Auto-dismiss timer triggered');
        console.log('📋 ChangelogModal: Current state:', { 
          isAvailable: updateInfo.isAvailable, 
          isChecking: isCheckingUpdates, 
          hasCompleted: updateInfo.hasCompletedDownload 
        });
        
        if (!updateInfo.isAvailable && !isCheckingUpdates && !updateInfo.hasCompletedDownload) {
          console.log('🔄 ChangelogModal: Auto-dismissing modal - no updates found');
          onClose();
        } else {
          console.log('✋ ChangelogModal: Not auto-dismissing - updates available or checking in progress');
        }
      }, autoDismissDelay);
      
      return () => {
        console.log('🧹 ChangelogModal: Cleaning up timer');
        clearTimeout(timer);
      };
    }
  }, [visible, updateInfo.isAvailable, isCheckingUpdates, updateInfo.hasCompletedDownload]);

  const initializeAndCheckUpdates = async () => {
    try {
      console.log('🚀 ChangelogModal: Starting initialization and update check...');
      
      // Set current version in UpdateService
      console.log('💾 ChangelogModal: Setting current version to:', CHANGELOG_VERSION);
      await updateService.setCurrentVersion(CHANGELOG_VERSION);
      
      // FIXED: Always check for new updates first, then handle completed downloads
      console.log('🔍 ChangelogModal: Checking for new updates first...');
      await checkForAPKUpdates();
      
      // Then check for completed downloads (but don't skip update check)
      console.log('📦 ChangelogModal: Checking for completed downloads...');
      const { hasDownload, version } = await updateService.hasCompletedDownload();
      if (hasDownload) {
        console.log('📦 ChangelogModal: Found completed download for version:', version);
        setUpdateInfo(prev => ({
          ...prev, // FIXED: Don't override update check results
          hasCompletedDownload: true,
          completedVersion: version,
        }));
      } else {
        console.log('✅ ChangelogModal: No completed downloads found');
      }
      
    } catch (error) {
      console.error('❌ ChangelogModal: Failed to initialize update check:', error);
      setUpdateError('Failed to initialize update check');
    }
  };

  const checkForAPKUpdates = async () => {
    try {
      console.log('🚀 ChangelogModal: Starting APK update check...');
      setIsCheckingUpdates(true);
      setUpdateError(null);
      
      // Check platform support
      if (!updateService.isUpdateSupported()) {
        console.log('❌ ChangelogModal: APK updates not supported on this platform');
        setUpdateInfo({ isAvailable: false });
        return;
      }
      
      console.log('✅ ChangelogModal: Platform supports updates, proceeding...');
      
      // Get current version for logging
      const currentVersion = await updateService.getCurrentVersion();
      console.log('📱 ChangelogModal: Current version for update check:', currentVersion);
      
      // Call the updateService method and log everything
      console.log('📞 ChangelogModal: Calling updateService.checkForUpdates()...');
      const result = await updateService.checkForUpdates();
      
      console.log('📋 ChangelogModal: UpdateService result:', result);
      console.log('📋 ChangelogModal: Has update:', result.hasUpdate);
      console.log('📋 ChangelogModal: Metadata:', result.metadata);
      
      if (result.hasUpdate && result.metadata) {
        console.log('✅ ChangelogModal: Update detected! Version:', result.metadata.version);
        console.log('📋 ChangelogModal: Full metadata:', {
          version: result.metadata.version,
          changelog: result.metadata.changelog,
          file_size: result.metadata.file_size,
          force_update: result.metadata.force_update,
          download_url: result.metadata.download_url
        });
        
        setUpdateInfo(prev => ({
          ...prev, // Preserve any completed download state
          isAvailable: true,
          version: result.metadata.version,
          changelog: result.metadata.changelog,
          file_size: result.metadata.file_size,
          force_update: result.metadata.force_update,
        }));
        
        console.log('💾 ChangelogModal: Update info set successfully');
      } else {
        console.log('❌ ChangelogModal: No updates detected by updateService');
        
        // Only set isAvailable to false if we don't have a completed download
        setUpdateInfo(prev => ({
          ...prev,
          isAvailable: false,
        }));
      }
    } catch (error) {
      console.error('❌ ChangelogModal: Failed to check for APK updates:', error);
      console.error('📋 ChangelogModal: Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      setUpdateError('Failed to check for updates. Please check your internet connection.');
      setUpdateInfo(prev => ({ ...prev, isAvailable: false }));
    } finally {
      setIsCheckingUpdates(false);
      console.log('🏁 ChangelogModal: Update check completed');
    }
  };

  const downloadAndInstallAPK = async () => {
    if (!updateInfo.isAvailable || updateInfo.isDownloading) {
      console.log('🚫 ChangelogModal: Download blocked - not available or already downloading');
      return;
    }
    
    try {
      console.log('📥 ChangelogModal: Starting download and install process...');
      setUpdateInfo(prev => ({ ...prev, isDownloading: true }));
      setUpdateError(null);
      
      // Create metadata object for download
      const metadata = {
        available: true,
        version: updateInfo.version,
        changelog: updateInfo.changelog,
        file_size: updateInfo.file_size,
        force_update: updateInfo.force_update,
        download_url: `${process.env.EXPO_PUBLIC_API_URL || 'https://glt-53x8.onrender.com'}/api/v1/updates/download?version=${updateInfo.version}`,
      };
      
      console.log('📋 ChangelogModal: Download metadata:', metadata);
      
      // Download with progress tracking
      console.log('📥 ChangelogModal: Starting download with progress tracking...');
      const success = await updateService.downloadUpdateWithProgress(
        metadata,
        (progress) => {
          console.log('📊 ChangelogModal: Download progress:', Math.round(progress.percentage), '%');
          setUpdateInfo(prev => ({ 
            ...prev, 
            downloadProgress: Math.round(progress.percentage) 
          }));
        }
      );
      
      if (success) {
        console.log('✅ ChangelogModal: Download completed successfully');
        
        // Mark update as handled and close modal
        await AsyncStorage.setItem('apk_update_handled', updateInfo.version || 'latest');
        setUpdateInfo(prev => ({ ...prev, isDownloading: false }));
        onClose();
        
        console.log('🎉 ChangelogModal: Process completed, modal closing');
      } else {
        throw new Error('Download failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ ChangelogModal: Failed to download APK update:', error);
      setUpdateError(`Update failed: ${error.message}`);
      setUpdateInfo(prev => ({ ...prev, isDownloading: false, downloadProgress: 0 }));
    }
  };

  const installCompletedDownload = async () => {
    try {
      console.log('🔧 ChangelogModal: Installing completed download...');
      setUpdateError(null);
      
      const success = await updateService.installDownloadedAPK(updateInfo.completedVersion);
      
      if (success) {
        console.log('✅ ChangelogModal: Installation started successfully');
        setUpdateInfo(prev => ({ ...prev, hasCompletedDownload: false }));
        onClose();
      } else {
        console.log('❌ ChangelogModal: Installation failed');
      }
    } catch (error) {
      console.error('❌ ChangelogModal: Failed to install completed download:', error);
      setUpdateError('Installation failed. You can manually install from Downloads folder.');
    }
  };

  const installLater = async () => {
    if (updateInfo.force_update) {
      console.log('🚫 ChangelogModal: Cannot postpone force update');
      return;
    }
    
    try {
      console.log('⏰ ChangelogModal: Scheduling install for later...');
      await updateService.scheduleInstallForLater();
      onClose();
    } catch (error) {
      console.error('❌ ChangelogModal: Failed to schedule update for later:', error);
      onClose();
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderUpdateContent = () => {
    console.log('🎨 ChangelogModal: Rendering content with state:', {
      isCheckingUpdates,
      updateError: !!updateError,
      hasCompletedDownload: updateInfo.hasCompletedDownload,
      isAvailable: updateInfo.isAvailable
    });

    if (isCheckingUpdates) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#bd93f9" />
          <Text style={styles.loadingText}>Checking for updates...</Text>
        </View>
      );
    }

    if (updateError) {
      return (
        <View>
          <Text style={styles.title}>Update Check Failed</Text>
          <Text style={styles.errorText}>{updateError}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={checkForAPKUpdates} style={[styles.button, styles.retryButton]}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.laterButton]}>
              <Text style={styles.laterButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (updateInfo.hasCompletedDownload) {
      return (
        <View>
          <Text style={styles.title}>Update Ready to Install</Text>
          <Text style={styles.text}>
            GLT version {updateInfo.completedVersion} has been downloaded and is ready to install.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              onPress={onClose} 
              style={[styles.button, styles.laterButton]}
            >
              <Text style={styles.laterButtonText}>Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={installCompletedDownload} 
              style={[styles.button, styles.installButton]}
            >
              <Text style={styles.buttonText}>Install Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (updateInfo.isAvailable) {
      const fileSizeText = updateInfo.file_size ? ` (${formatFileSize(updateInfo.file_size)})` : '';
      
      return (
        <View>
          <Text style={styles.title}>
            {updateInfo.force_update ? 'Required Update' : 'Update Available'} (v{updateInfo.version || 'Latest'}){fileSizeText}
          </Text>
          
          {Platform.OS !== 'android' && (
            <Text style={styles.warningText}>
              APK updates are only supported on Android devices.
            </Text>
          )}
          
          <Text style={styles.text}>
            {updateInfo.changelog && updateInfo.changelog.length > 0 ? 
              `• ${updateInfo.changelog.join('\n• ')}` : 
              `• ${CHANGELOG_CONTENT.join('\n• ')}`
            }
          </Text>
          
          {updateInfo.force_update && (
            <Text style={styles.forceUpdateText}>
              This update is required to continue using the app.
            </Text>
          )}
          
          {updateInfo.isDownloading && (
            <View style={styles.downloadingContainer}>
              <ActivityIndicator size="small" color="#bd93f9" />
              <Text style={styles.downloadingText}>
                Downloading APK update... {updateInfo.downloadProgress || 0}%
              </Text>
              {updateInfo.downloadProgress && (
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${updateInfo.downloadProgress}%` }
                    ]} 
                  />
                </View>
              )}
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            {!updateInfo.force_update && Platform.OS === 'android' && (
              <TouchableOpacity 
                onPress={installLater} 
                style={[styles.button, styles.laterButton]}
                disabled={updateInfo.isDownloading}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
            )}
            
            {Platform.OS === 'android' ? (
              <TouchableOpacity 
                onPress={downloadAndInstallAPK} 
                style={[styles.button, styles.installButton]}
                disabled={updateInfo.isDownloading}
              >
                <Text style={styles.buttonText}>
                  {updateInfo.isDownloading ? 'Downloading...' : 'Download & Install'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={onClose} 
                style={[styles.button, styles.installButton]}
              >
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Default changelog view (no updates available)
    console.log('🎨 ChangelogModal: Showing default changelog view');
    return (
      <View>
        <Text style={styles.title}>{`What's New (v${CHANGELOG_VERSION})`}</Text>
        <Text style={styles.text}>{`• ${CHANGELOG_CONTENT.join('\n• ')}`}</Text>
        
        <TouchableOpacity onPress={onClose} style={styles.button}>
          <Text style={styles.buttonText}>Got it</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centered}>
        <View style={styles.modal}>
          {renderUpdateContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modal: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#282a36',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 5 },
    borderWidth: 1,
    borderColor: 'rgba(189, 147, 249, 0.3)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#bd93f9',
    marginBottom: 10,
    lineHeight: 24,
  },
  text: {
    color: '#f8f8f2',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  errorText: {
    color: '#ff5555',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  warningText: {
    color: '#ffb86c',
    fontSize: 13,
    marginBottom: 10,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  forceUpdateText: {
    color: '#ff5555',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#6272a4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 12,
  },
  laterButton: {
    backgroundColor: '#44475a',
    flex: 1,
  },
  laterButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  installButton: {
    backgroundColor: '#50fa7b',
    flex: 2,
  },
  retryButton: {
    backgroundColor: '#bd93f9',
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#f8f8f2',
    marginLeft: 10,
    fontSize: 14,
  },
  downloadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    padding: 12,
    backgroundColor: 'rgba(189, 147, 249, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(189, 147, 249, 0.3)',
  },
  downloadingText: {
    color: '#bd93f9',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(189, 147, 249, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#bd93f9',
    borderRadius: 2,
  },
});
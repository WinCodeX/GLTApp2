// components/ChangelogModal.tsx - Fixed for Expo Go compatibility

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UpdateService from '../lib/services/updateService';

export const CHANGELOG_VERSION = '1.8.4';
export const CHANGELOG_KEY = `changelog_seen_${CHANGELOG_VERSION}`;
const AUTO_DISMISS_DELAY = 10000;

const CHANGELOG_CONTENT = [
  'Account adding',
  'Talk to a representative implemented',
  'Support functionality implemented',
  'WhatsApp style messaging in talk to a rep',
  'ActionCable for instant messages and notifications',
  'Bottom tabs new styling',
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
  update_type?: 'ota' | 'apk';
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
  
  const hasInitialized = useRef(false);
  const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible && !hasInitialized.current) {
      console.log('ChangelogModal: Modal opened, initializing...');
      hasInitialized.current = true;
      initializeAndCheckUpdates();
      
      autoDismissTimer.current = setTimeout(() => {
        console.log('ChangelogModal: Auto-dismiss timer triggered');
        if (!updateInfo.isAvailable && !isCheckingUpdates && !updateInfo.hasCompletedDownload) {
          console.log('ChangelogModal: Auto-dismissing - no updates found');
          handleClose();
        }
      }, AUTO_DISMISS_DELAY);
    }

    return () => {
      if (!visible) {
        hasInitialized.current = false;
        if (autoDismissTimer.current) {
          clearTimeout(autoDismissTimer.current);
          autoDismissTimer.current = null;
        }
      }
    };
  }, [visible]);

  const handleClose = () => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    hasInitialized.current = false;
    onClose();
  };

  const initializeAndCheckUpdates = async () => {
    try {
      console.log('ChangelogModal: Starting initialization...');
      
      await updateService.setCurrentVersion(CHANGELOG_VERSION);
      
      // Check for completed APK downloads first
      const { hasDownload, version } = await updateService.hasCompletedDownload();
      if (hasDownload) {
        console.log('ChangelogModal: Found completed download:', version);
        setUpdateInfo({
          isAvailable: false,
          hasCompletedDownload: true,
          completedVersion: version,
        });
        return;
      }
      
      // Check for new updates
      await checkForUpdates();
      
    } catch (error) {
      console.error('ChangelogModal: Initialization failed:', error);
      setUpdateError('Failed to check for updates');
      setIsCheckingUpdates(false);
    }
  };

  const checkForUpdates = async () => {
    if (isCheckingUpdates) {
      console.log('ChangelogModal: Update check already in progress, skipping...');
      return;
    }

    try {
      console.log('ChangelogModal: Checking for updates...');
      setIsCheckingUpdates(true);
      setUpdateError(null);
      
      if (!updateService.isUpdateSupported()) {
        console.log('ChangelogModal: Platform does not support updates');
        setUpdateInfo({ isAvailable: false });
        setIsCheckingUpdates(false);
        return;
      }
      
      // This will now safely skip OTA checks in Expo Go
      const result = await updateService.checkForUpdates();
      
      console.log('ChangelogModal: Update check result:', {
        hasUpdate: result.hasUpdate,
        version: result.metadata?.version,
        type: result.metadata?.update_type
      });
      
      if (result.hasUpdate && result.metadata) {
        console.log('ChangelogModal: Update available:', result.metadata.version, 'Type:', result.metadata.update_type);
        setUpdateInfo({
          isAvailable: true,
          version: result.metadata.version,
          changelog: result.metadata.changelog,
          file_size: result.metadata.file_size,
          force_update: result.metadata.force_update,
          update_type: result.metadata.update_type,
        });
      } else {
        console.log('ChangelogModal: No updates available');
        setUpdateInfo({ isAvailable: false });
      }
    } catch (error) {
      console.error('ChangelogModal: Update check failed:', error);
      setUpdateError('Failed to check for updates. Please check your internet connection.');
      setUpdateInfo({ isAvailable: false });
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleUpdateInstall = async () => {
    if (!updateInfo.isAvailable || updateInfo.isDownloading) {
      return;
    }
    
    try {
      console.log('ChangelogModal: Starting update installation, type:', updateInfo.update_type);
      
      // Handle OTA updates (only available in standalone builds)
      if (updateInfo.update_type === 'ota') {
        setIsCheckingUpdates(true);
        setUpdateError(null);
        
        const metadata = {
          available: true,
          version: updateInfo.version,
          changelog: updateInfo.changelog,
          update_type: 'ota' as const,
        };
        
        try {
          await updateService.installUpdate(metadata);
          // App will reload automatically after OTA update
        } catch (error) {
          console.error('ChangelogModal: OTA update failed:', error);
          setUpdateError('OTA update not available in this build. Please use APK update instead.');
          setIsCheckingUpdates(false);
        }
        return;
      }
      
      // Handle APK updates
      setUpdateInfo(prev => ({ ...prev, isDownloading: true }));
      setUpdateError(null);
      
      const metadata = {
        available: true,
        version: updateInfo.version,
        changelog: updateInfo.changelog,
        file_size: updateInfo.file_size,
        force_update: updateInfo.force_update,
        update_type: 'apk' as const,
        download_url: `${process.env.EXPO_PUBLIC_API_URL || 'https://glt-53x8.onrender.com'}/api/v1/updates/download?version=${updateInfo.version}`,
      };
      
      const success = await updateService.downloadUpdateWithProgress(
        metadata,
        (progress) => {
          setUpdateInfo(prev => ({ 
            ...prev, 
            downloadProgress: Math.round(progress.percentage) 
          }));
        }
      );
      
      if (success) {
        console.log('ChangelogModal: Download completed');
        await AsyncStorage.setItem('apk_update_handled', updateInfo.version || 'latest');
        setUpdateInfo(prev => ({ ...prev, isDownloading: false }));
        handleClose();
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('ChangelogModal: Update failed:', error);
      setUpdateError(`Update failed: ${error.message}`);
      setUpdateInfo(prev => ({ ...prev, isDownloading: false, downloadProgress: 0 }));
      setIsCheckingUpdates(false);
    }
  };

  const installCompletedDownload = async () => {
    try {
      console.log('ChangelogModal: Installing completed download...');
      setUpdateError(null);
      
      const success = await updateService.installDownloadedAPK(updateInfo.completedVersion);
      
      if (success) {
        setUpdateInfo(prev => ({ ...prev, hasCompletedDownload: false }));
        handleClose();
      }
    } catch (error) {
      console.error('ChangelogModal: Installation failed:', error);
      setUpdateError('Installation failed. You can manually install from Downloads folder.');
    }
  };

  const installLater = async () => {
    if (updateInfo.force_update) {
      return;
    }
    
    try {
      await updateService.scheduleInstallForLater();
      handleClose();
    } catch (error) {
      console.error('ChangelogModal: Failed to schedule:', error);
      handleClose();
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderContent = () => {
    // Checking for updates
    if (isCheckingUpdates && !updateInfo.isDownloading) {
      return (
        <View>
          <Text style={styles.title}>Checking for Updates</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#bd93f9" />
            <Text style={styles.loadingText}>Please wait...</Text>
          </View>
        </View>
      );
    }

    // Error state
    if (updateError) {
      return (
        <View>
          <Text style={styles.title}>Update Check Failed</Text>
          <Text style={styles.errorText}>{updateError}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={checkForUpdates} style={[styles.button, styles.retryButton]}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleClose} style={[styles.button, styles.laterButton]}>
              <Text style={styles.laterButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Completed download ready to install
    if (updateInfo.hasCompletedDownload) {
      return (
        <View>
          <Text style={styles.title}>Update Ready to Install</Text>
          <Text style={styles.text}>
            GLT version {updateInfo.completedVersion} has been downloaded and is ready to install.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleClose} style={[styles.button, styles.laterButton]}>
              <Text style={styles.laterButtonText}>Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={installCompletedDownload} style={[styles.button, styles.installButton]}>
              <Text style={styles.buttonText}>Install Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // New update available
    if (updateInfo.isAvailable) {
      const isOTA = updateInfo.update_type === 'ota';
      const fileSizeText = updateInfo.file_size ? ` (${formatFileSize(updateInfo.file_size)})` : '';
      const updateTypeLabel = isOTA ? 'OTA Update' : 'APK Update';
      
      return (
        <View>
          <Text style={styles.title}>
            {updateInfo.force_update ? 'Required Update' : 'Update Available'} - {updateTypeLabel}
          </Text>
          <Text style={styles.versionText}>
            Version {updateInfo.version}{fileSizeText}
          </Text>
          
          {!isOTA && Platform.OS !== 'android' && (
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
          
          {isOTA && (
            <Text style={styles.otaInfoText}>
              This update will apply instantly without downloading a large file.
            </Text>
          )}
          
          {updateInfo.force_update && (
            <Text style={styles.forceUpdateText}>
              This update is required to continue using the app.
            </Text>
          )}
          
          {updateInfo.isDownloading && (
            <View style={styles.downloadingContainer}>
              <ActivityIndicator size="small" color="#bd93f9" />
              <Text style={styles.downloadingText}>
                Downloading... {updateInfo.downloadProgress || 0}%
              </Text>
              {updateInfo.downloadProgress !== undefined && (
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${updateInfo.downloadProgress}%` }]} />
                </View>
              )}
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            {!updateInfo.force_update && (isOTA || Platform.OS === 'android') && (
              <TouchableOpacity 
                onPress={installLater} 
                style={[styles.button, styles.laterButton]}
                disabled={updateInfo.isDownloading}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
            )}
            
            {(isOTA || Platform.OS === 'android') ? (
              <TouchableOpacity 
                onPress={handleUpdateInstall} 
                style={[styles.button, styles.installButton]}
                disabled={updateInfo.isDownloading}
              >
                <Text style={styles.buttonText}>
                  {updateInfo.isDownloading ? 'Downloading...' : isOTA ? 'Update Now' : 'Download & Install'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleClose} style={[styles.button, styles.installButton]}>
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Default: Show changelog (no updates available)
    return (
      <View>
        <Text style={styles.title}>{`What's New (v${CHANGELOG_VERSION})`}</Text>
        <Text style={styles.text}>{`• ${CHANGELOG_CONTENT.join('\n• ')}`}</Text>
        
        <TouchableOpacity onPress={handleClose} style={styles.button}>
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
      onRequestClose={handleClose}
    >
      <View style={styles.centered}>
        <View style={styles.modal}>
          {renderContent()}
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
  versionText: {
    fontSize: 14,
    color: '#f8f8f2',
    marginBottom: 8,
    fontWeight: '600',
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
  otaInfoText: {
    color: '#50fa7b',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
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
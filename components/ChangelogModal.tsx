// components/ChangelogModal.tsx

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UpdateService from '../lib/services/updateService';

export const CHANGELOG_VERSION = '1.5.0';
export const CHANGELOG_KEY = `changelog_seen_${CHANGELOG_VERSION}`;
const autoDismissDelay = 7000;

const CHANGELOG_CONTENT = [
  'Migrated to APK-based updates for better reliability',
  'Enhanced update system with progress tracking',
  'Improved file handling for large updates',
  'Fixed update notification timing',
  'Better error handling and user feedback',
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
}

export default function ChangelogModal({ visible, onClose }: Props) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ isAvailable: false });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      checkForAPKUpdates();
      
      // Auto-dismiss if no updates available
      const timer = setTimeout(() => {
        if (!updateInfo.isAvailable && !isCheckingUpdates) {
          onClose();
        }
      }, autoDismissDelay);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const checkForAPKUpdates = async () => {
    try {
      setIsCheckingUpdates(true);
      setUpdateError(null);
      
      const updateService = UpdateService.getInstance();
      
      // Only check for updates on Android
      if (!updateService.isUpdateSupported()) {
        console.log('APK updates not supported on this platform');
        setUpdateInfo({ isAvailable: false });
        return;
      }
      
      const { hasUpdate, metadata } = await updateService.checkForUpdates();
      
      if (hasUpdate && metadata) {
        setUpdateInfo({
          isAvailable: true,
          version: metadata.version,
          changelog: metadata.changelog,
          file_size: metadata.file_size,
          force_update: metadata.force_update,
        });
      } else {
        setUpdateInfo({ isAvailable: false });
      }
    } catch (error) {
      console.error('Failed to check for APK updates:', error);
      setUpdateError('Failed to check for updates');
      setUpdateInfo({ isAvailable: false });
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const downloadAndInstallAPK = async () => {
    if (!updateInfo.isAvailable || updateInfo.isDownloading) return;
    
    try {
      setUpdateInfo(prev => ({ ...prev, isDownloading: true }));
      setUpdateError(null);
      
      const updateService = UpdateService.getInstance();
      
      // Create metadata object for download
      const metadata = {
        available: true,
        version: updateInfo.version,
        changelog: updateInfo.changelog,
        file_size: updateInfo.file_size,
        force_update: updateInfo.force_update,
        download_url: `${process.env.EXPO_PUBLIC_API_URL}/api/v1/updates/download/${updateInfo.version}`, // Construct download URL
      };
      
      // Download and install APK
      const success = await updateService.downloadUpdate(metadata);
      
      if (success) {
        // Mark update as handled and close modal
        await AsyncStorage.setItem('apk_update_handled', updateInfo.version || 'latest');
        setUpdateInfo(prev => ({ ...prev, isDownloading: false }));
        onClose();
        
        // Note: APK installation is handled by Android system, no reload needed
      } else {
        throw new Error('Failed to download or install APK');
      }
    } catch (error) {
      console.error('Failed to download APK update:', error);
      setUpdateError(`Update failed: ${error.message}`);
      setUpdateInfo(prev => ({ ...prev, isDownloading: false }));
    }
  };

  const installLater = async () => {
    if (updateInfo.force_update) {
      // Cannot postpone force updates
      return;
    }
    
    try {
      const updateService = UpdateService.getInstance();
      await updateService.scheduleInstallForLater();
      onClose();
    } catch (error) {
      console.error('Failed to schedule update for later:', error);
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
                Downloading APK update... This may take a few minutes.
              </Text>
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
    flexDirection: 'row',
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
    marginLeft: 10,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
});
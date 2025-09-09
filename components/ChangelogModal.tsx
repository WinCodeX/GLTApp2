// components/ChangelogModal.tsx

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHANGELOG_VERSION = '1.3.7';
export const CHANGELOG_KEY = `changelog_seen_${CHANGELOG_VERSION}`;
const autoDismissDelay = 7000;

const CHANGELOG_CONTENT = [
  'Added business logo',
  'Select Business fixed',
  'Added edit business section',
  'Other bug fixes',
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

interface UpdateInfo {
  isAvailable: boolean;
  version?: string;
  changelog?: string[];
  isDownloading?: boolean;
  downloadProgress?: number;
}

export default function ChangelogModal({ visible, onClose }: Props) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ isAvailable: false });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  useEffect(() => {
    if (visible) {
      checkForUpdates();
      const timer = setTimeout(() => {
        if (!updateInfo.isAvailable) {
          onClose();
        }
      }, autoDismissDelay);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const checkForUpdates = async () => {
    try {
      setIsCheckingUpdates(true);
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        // Fetch update details from your backend
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/updates/info`);
        const updateDetails = await response.json();
        
        setUpdateInfo({
          isAvailable: true,
          version: updateDetails.version,
          changelog: updateDetails.changelog,
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const downloadAndInstallUpdate = async () => {
    try {
      setUpdateInfo(prev => ({ ...prev, isDownloading: true }));
      
      // Download the update
      const downloadResult = await Updates.fetchUpdateAsync();
      
      if (downloadResult.isNew) {
        // Store that user chose to install
        await AsyncStorage.setItem('pending_update_install', 'true');
        
        // Show success message and close modal
        setUpdateInfo(prev => ({ ...prev, isDownloading: false }));
        onClose();
        
        // Restart to apply update
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error('Failed to download update:', error);
      setUpdateInfo(prev => ({ ...prev, isDownloading: false }));
    }
  };

  const installLater = async () => {
    await AsyncStorage.setItem('pending_update_install', 'true');
    onClose();
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

    if (updateInfo.isAvailable) {
      return (
        <View>
          <Text style={styles.title}>
            {`Update Available (v${updateInfo.version || 'Latest'})`}
          </Text>
          <Text style={styles.text}>
            {updateInfo.changelog ? 
              `• ${updateInfo.changelog.join('\n• ')}` : 
              `• ${CHANGELOG_CONTENT.join('\n• ')}`
            }
          </Text>
          
          {updateInfo.isDownloading && (
            <View style={styles.downloadingContainer}>
              <ActivityIndicator size="small" color="#bd93f9" />
              <Text style={styles.downloadingText}>Downloading update...</Text>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              onPress={installLater} 
              style={[styles.button, styles.laterButton]}
              disabled={updateInfo.isDownloading}
            >
              <Text style={styles.laterButtonText}>Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={downloadAndInstallUpdate} 
              style={[styles.button, styles.installButton]}
              disabled={updateInfo.isDownloading}
            >
              <Text style={styles.buttonText}>
                {updateInfo.isDownloading ? 'Downloading...' : 'Install Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Default changelog view
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
    backgroundColor: 'transparent',
  },
  modal: {
    width: '85%',
    backgroundColor: '#282a36',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 5 },
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#bd93f9',
    marginBottom: 10,
  },
  text: {
    color: '#f8f8f2',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    alignSelf: 'flex-end',
    backgroundColor: '#6272a4',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  laterButton: {
    backgroundColor: '#44475a',
  },
  laterButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  installButton: {
    backgroundColor: '#50fa7b',
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
  },
  downloadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  downloadingText: {
    color: '#bd93f9',
    marginLeft: 10,
  },
});
// components/UpdateModal.tsx - Themed update modal with download progress

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import UpdateService from '../lib/services/updateService';

const { width: screenWidth } = Dimensions.get('window');

interface UpdateMetadata {
  available: boolean;
  version?: string;
  changelog?: string[];
  release_date?: string;
  force_update?: boolean;
  download_url?: string;
  file_size?: number;
}

interface UpdateProgress {
  isDownloading: boolean;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  status: 'checking' | 'downloading' | 'installing' | 'complete' | 'error';
  error?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  metadata?: UpdateMetadata | null;
  onUpdateStart?: () => void;
  onUpdateComplete?: () => void;
}

export default function UpdateModal({ 
  visible, 
  onClose, 
  metadata, 
  onUpdateStart,
  onUpdateComplete 
}: Props) {
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress>({
    isDownloading: false,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    remainingTime: 0,
    status: 'checking',
  });

  const slideAnim = useRef(new Animated.Value(300)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(300);
      scaleAnim.setValue(0.9);
      progressAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: updateProgress.progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [updateProgress.progress]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const formatTime = (seconds: number): string => {
    if (seconds === Infinity || isNaN(seconds) || seconds < 0) return 'calculating...';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const startDownload = async () => {
    if (!metadata?.download_url || updateProgress.isDownloading) return;

    try {
      setUpdateProgress(prev => ({
        ...prev,
        isDownloading: true,
        status: 'downloading',
        progress: 0,
        error: undefined,
      }));

      onUpdateStart?.();

      const updateService = UpdateService.getInstance();
      
      // Start background download with progress tracking
      const success = await updateService.downloadUpdateWithProgress(metadata, (progress) => {
        setUpdateProgress(prev => ({
          ...prev,
          progress: progress.percentage,
          downloadedBytes: progress.loaded,
          totalBytes: progress.total,
          speed: progress.speed,
          remainingTime: progress.remainingTime,
        }));
      });

      if (success) {
        setUpdateProgress(prev => ({
          ...prev,
          isDownloading: false,
          status: 'complete',
          progress: 100,
        }));
        
        onUpdateComplete?.();
        
        // Auto-close modal after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Update download failed:', error);
      setUpdateProgress(prev => ({
        ...prev,
        isDownloading: false,
        status: 'error',
        error: error.message || 'Download failed',
      }));
    }
  };

  const handleInstallLater = async () => {
    if (metadata?.force_update) return;
    
    try {
      const updateService = UpdateService.getInstance();
      await updateService.scheduleInstallForLater();
      onClose();
    } catch (error) {
      console.error('Failed to schedule update for later:', error);
      onClose();
    }
  };

  const renderProgressSection = () => {
    if (!updateProgress.isDownloading && updateProgress.status !== 'complete') return null;

    return (
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            {updateProgress.status === 'complete' ? 'Download Complete!' : 'Downloading Update...'}
          </Text>
          <Text style={styles.progressPercentage}>{Math.round(updateProgress.progress)}%</Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        {updateProgress.status !== 'complete' && (
          <View style={styles.progressDetails}>
            <Text style={styles.progressDetailText}>
              {formatFileSize(updateProgress.downloadedBytes)} / {formatFileSize(updateProgress.totalBytes)}
            </Text>
            {updateProgress.speed > 0 && (
              <>
                <Text style={styles.progressDetailDot}>•</Text>
                <Text style={styles.progressDetailText}>
                  {formatSpeed(updateProgress.speed)}
                </Text>
                <Text style={styles.progressDetailDot}>•</Text>
                <Text style={styles.progressDetailText}>
                  {formatTime(updateProgress.remainingTime)} remaining
                </Text>
              </>
            )}
          </View>
        )}

        {updateProgress.status === 'complete' && (
          <View style={styles.completeSection}>
            <View style={styles.completeIcon}>
              <Feather name="check-circle" size={24} color="#10b981" />
            </View>
            <Text style={styles.completeText}>
              Update downloaded successfully! You can install it from your downloads or when you exit the app.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (updateProgress.status === 'error') {
      return (
        <View>
          <View style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <Feather name="alert-circle" size={32} color="#ef4444" />
            </View>
            <Text style={styles.title}>Update Failed</Text>
          </View>

          <Text style={styles.errorText}>{updateProgress.error}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={startDownload} style={[styles.button, styles.retryButton]}>
              <LinearGradient colors={['#8B5CF6', '#7c3aed']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>Retry</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.cancelButton]}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!metadata?.available) {
      return (
        <View>
          <View style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <Feather name="check-circle" size={32} color="#10b981" />
            </View>
            <Text style={styles.title}>You're Up to Date!</Text>
          </View>

          <Text style={styles.description}>
            You have the latest version of GLT Logistics installed.
          </Text>

          <TouchableOpacity onPress={onClose} style={styles.button}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.buttonGradient}>
              <Text style={styles.buttonText}>Great!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    const fileSizeText = metadata.file_size ? ` (${formatFileSize(metadata.file_size)})` : '';

    return (
      <View>
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <Feather name="download-cloud" size={32} color="#8B5CF6" />
          </View>
          <Text style={styles.title}>
            {metadata.force_update ? 'Required Update' : 'Update Available'}
          </Text>
          <Text style={styles.versionText}>Version {metadata.version}{fileSizeText}</Text>
        </View>

        {Platform.OS !== 'android' && (
          <View style={styles.warningContainer}>
            <Feather name="info" size={16} color="#ffb86c" />
            <Text style={styles.warningText}>
              APK updates are only supported on Android devices.
            </Text>
          </View>
        )}

        <View style={styles.changelogSection}>
          <Text style={styles.changelogTitle}>What's New:</Text>
          <View style={styles.changelogList}>
            {metadata.changelog?.map((item, index) => (
              <View key={index} style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>{item}</Text>
              </View>
            )) || (
              <View style={styles.changelogItem}>
                <Text style={styles.changelogBullet}>•</Text>
                <Text style={styles.changelogText}>Bug fixes and improvements</Text>
              </View>
            )}
          </View>
        </View>

        {metadata.force_update && (
          <View style={styles.forceUpdateContainer}>
            <Feather name="alert-triangle" size={16} color="#ef4444" />
            <Text style={styles.forceUpdateText}>
              This update is required to continue using the app.
            </Text>
          </View>
        )}

        {renderProgressSection()}

        <View style={styles.buttonContainer}>
          {!metadata.force_update && Platform.OS === 'android' && !updateProgress.isDownloading && updateProgress.status !== 'complete' && (
            <TouchableOpacity 
              onPress={handleInstallLater} 
              style={[styles.button, styles.laterButton]}
            >
              <Text style={styles.laterButtonText}>Later</Text>
            </TouchableOpacity>
          )}
          
          {Platform.OS === 'android' && updateProgress.status !== 'complete' ? (
            <TouchableOpacity 
              onPress={startDownload} 
              style={[styles.button, styles.updateButton]}
              disabled={updateProgress.isDownloading}
            >
              <LinearGradient colors={['#10b981', '#059669']} style={styles.buttonGradient}>
                {updateProgress.isDownloading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={[styles.buttonText, { marginLeft: 8 }]}>Downloading...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Update Now</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : Platform.OS !== 'android' ? (
            <TouchableOpacity onPress={onClose} style={[styles.button, styles.updateButton]}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          onPress={metadata?.force_update ? undefined : onClose}
          activeOpacity={1}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#1a1a2e', '#2d3748', '#4a5568']}
              style={styles.modalContent}
            >
              {!metadata?.force_update && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Feather name="x" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              
              {renderContent()}
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  modalContent: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 14,
    color: '#8B5CF6',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 108, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 108, 0.3)',
  },
  warningText: {
    color: '#ffb86c',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  changelogSection: {
    marginBottom: 20,
  },
  changelogTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  changelogList: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  changelogItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  changelogBullet: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  changelogText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  forceUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  forceUpdateText: {
    color: '#ef4444',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  progressSection: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
  },
  progressDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  progressDetailText: {
    fontSize: 12,
    color: '#999',
  },
  progressDetailDot: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },
  completeSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  completeIcon: {
    marginBottom: 8,
  },
  completeText: {
    fontSize: 14,
    color: '#10b981',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  laterButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 14,
    textAlign: 'center',
  },
  updateButton: {
    flex: 2,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 14,
    textAlign: 'center',
  },
  retryButton: {
    flex: 1,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
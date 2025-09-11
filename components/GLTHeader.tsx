// components/GLTHeader.tsx - Fixed with NavigationHelper integration

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Dimensions, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { getFullAvatarUrl } from '../lib/api';
import { SafeLogo } from '../components/SafeLogo';
import UpdateService from '../lib/services/updateService';
import colors from '../theme/colors';
import api from '../lib/api';

// CRITICAL: Import NavigationHelper for proper navigation tracking
import { NavigationHelper } from '../lib/helpers/navigation';

const { width: screenWidth } = Dimensions.get('window');

interface GLTHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  title?: string;
}

interface DownloadProgress {
  isDownloading: boolean;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  remainingTime: number;
  version?: string;
  status: 'checking' | 'downloading' | 'installing' | 'complete' | 'error';
}

// Enhanced Safe Avatar Component matching CustomDrawerContent
interface SafeAvatarProps {
  size: number;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
  updateTrigger?: number;
}

const SafeAvatar: React.FC<SafeAvatarProps> = ({ 
  size, 
  avatarUrl, 
  fallbackSource = require('../assets/images/avatar_placeholder.png'),
  style,
  updateTrigger = 0
}) => {
  const [hasError, setHasError] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  useEffect(() => {
    console.log('🎭 Header SafeAvatar: Update triggered', {
      avatarUrl,
      updateTrigger,
      timestamp: Date.now()
    });
    
    setHasError(false);
    setImageKey(Date.now());
  }, [avatarUrl, updateTrigger]);
  
  if (!fullAvatarUrl || hasError) {
    return (
      <TouchableOpacity style={style} disabled>
        <Image
          source={fallbackSource}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <Image
      source={{ 
        uri: `${fullAvatarUrl}?v=${imageKey}&t=${updateTrigger}`,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      onError={(error) => {
        console.warn('🎭 Header SafeAvatar failed to load:', {
          url: fullAvatarUrl,
          error: error
        });
        setHasError(true);
      }}
    />
  );
};

export default function GLTHeader({ 
  showBackButton = false, 
  onBackPress,
  title = "GLT Logistics" 
}: GLTHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { 
    user, 
    businesses,
    selectedBusiness,
    setSelectedBusiness,
    avatarUpdateTrigger,
  } = useUser();
  
  const [notificationCount, setNotificationCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [updateProgress, setUpdateProgress] = useState<DownloadProgress>({
    isDownloading: false,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    remainingTime: 0,
    status: 'checking',
  });
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // Progress animation
  const progressWidth = useRef(new Animated.Value(0)).current;
  
  // Enhanced avatar tap handling with double-tap detection
  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL: Fixed navigation to business page with NavigationHelper
  const navigateToBusinessPage = async () => {
    try {
      console.log('🧭 Header: Navigating to business page using NavigationHelper');
      
      await NavigationHelper.navigateTo('/(drawer)/business', {
        params: {},
        trackInHistory: true
      });
      
      console.log('✅ Header: Successfully navigated to business page');
    } catch (error) {
      console.error('❌ Header: Navigation to business page failed:', error);
      
      // Fallback navigation with tracking
      try {
        await NavigationHelper.navigateTo('/(drawer)/Business', {
          params: {},
          trackInHistory: true
        });
        console.log('🔄 Header: Used fallback navigation to Business');
      } catch (fallbackError) {
        console.error('❌ Header: Even fallback navigation failed:', fallbackError);
      }
    }
  };

  // Enhanced avatar press handler with proper navigation tracking
  const handleAvatarPress = async () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    
    // Check for double tap (within 300ms)
    if (timeSinceLastTap < 300) {
      console.log('🎭 Header: Double tap detected, cycling business selection');
      handleAvatarDoubleTap();
      lastTapRef.current = 0; // Reset to prevent triple tap
    } else {
      // Single tap - set timeout to navigate to business page
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(async () => {
        console.log('🎭 Header: Single tap, navigating to business page');
        await navigateToBusinessPage();
        tapTimeoutRef.current = null;
      }, 300);
    }
  };

  // Cycle through business selection on double tap
  const handleAvatarDoubleTap = () => {
    const allBusinessOptions = [
      null, // "You" mode
      ...businesses.owned,
      ...businesses.joined
    ];
    
    if (allBusinessOptions.length <= 1) {
      console.log('🎭 Header: No businesses to cycle through');
      return;
    }
    
    // Find current index
    let currentIndex = 0;
    if (selectedBusiness) {
      const businessIndex = allBusinessOptions.findIndex(
        (business) => business && business.id === selectedBusiness.id
      );
      currentIndex = businessIndex !== -1 ? businessIndex : 0;
    }
    
    // Move to next business
    const nextIndex = (currentIndex + 1) % allBusinessOptions.length;
    const nextBusiness = allBusinessOptions[nextIndex];
    
    console.log('🎭 Header: Cycling to business:', nextBusiness?.name || 'You');
    setSelectedBusiness(nextBusiness);
  };

  // FIXED: Enhanced back button handler with NavigationHelper
  const handleBackPress = async () => {
    if (onBackPress) {
      onBackPress();
      return;
    }

    try {
      console.log('🔙 Header: Going back using NavigationHelper...');
      
      const success = await NavigationHelper.goBack({
        fallbackRoute: '/(drawer)/',
        replaceIfNoHistory: true
      });
      
      if (success) {
        console.log('✅ Header: Successfully navigated back');
      } else {
        console.log('🏠 Header: Used fallback navigation to home');
      }
    } catch (error) {
      console.error('❌ Header: Back navigation failed:', error);
    }
  };

  // Load notification and cart counts
  useEffect(() => {
    const loadCounts = async () => {
      try {
        // Load notification count
        const notifResponse = await api.get('/api/v1/notifications/unread-count');
        if (notifResponse.data.success) {
          setNotificationCount(notifResponse.data.count || 0);
        }

        // Load cart count (pending unpaid packages)
        const cartResponse = await api.get('/api/v1/packages', {
          params: { state: 'pending_unpaid', per_page: 1 }
        });
        if (cartResponse.data.success) {
          setCartCount(cartResponse.data.pagination?.total_count || 0);
        }
      } catch (error) {
        console.log('Could not load header counts:', error);
      }
    };

    loadCounts();
  }, []);

  // Update service integration
  useEffect(() => {
    const unsubscribe = UpdateService.onProgress((progress) => {
      setUpdateProgress(progress);
      
      // Animate progress bar
      Animated.timing(progressWidth, {
        toValue: progress.progress,
        duration: 100,
        useNativeDriver: false,
      }).start();
      
      // Show popup for download start
      if (progress.isDownloading && progress.status === 'downloading' && !showUpdatePopup) {
        setShowUpdatePopup(true);
      }
      
      // Hide popup when complete
      if (progress.status === 'complete' || progress.status === 'error') {
        setTimeout(() => {
          setShowUpdatePopup(false);
        }, 2000);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [progressWidth, showUpdatePopup]);

  // Get current avatar based on selected business or user
  const getCurrentAvatar = () => {
    if (selectedBusiness?.logo) {
      return getFullAvatarUrl(selectedBusiness.logo);
    }
    return user?.profile_picture ? getFullAvatarUrl(user.profile_picture) : null;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format speed
  const formatSpeed = (bytesPerSecond: number) => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  // Format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m`;
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 1)', 'rgba(26, 26, 46, 0.95)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            {/* Left Section */}
            <View style={styles.leftSection}>
              {showBackButton ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBackPress}
                  activeOpacity={0.7}
                >
                  <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                  activeOpacity={0.7}
                >
                  <Feather name="menu" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
              
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>{title}</Text>
                {selectedBusiness && (
                  <Text style={styles.businessSubtitle}>
                    {selectedBusiness.name}
                  </Text>
                )}
              </View>
            </View>

            {/* Right Section */}
            <View style={styles.rightSection}>
              {/* Cart Icon */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => NavigationHelper.navigateTo('/(drawer)/cart')}
                activeOpacity={0.7}
              >
                <Feather name="shopping-cart" size={20} color={colors.text} />
                {cartCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {cartCount > 99 ? '99+' : cartCount.toString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Notifications Icon */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => NavigationHelper.navigateTo('/notifications')}
                activeOpacity={0.7}
              >
                <Feather name="bell" size={20} color={colors.text} />
                {notificationCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {notificationCount > 99 ? '99+' : notificationCount.toString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Avatar */}
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={handleAvatarPress}
                activeOpacity={0.8}
              >
                <SafeAvatar
                  size={32}
                  avatarUrl={getCurrentAvatar()}
                  updateTrigger={avatarUpdateTrigger}
                  style={styles.avatar}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Update Progress Bar */}
          {updateProgress.isDownloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressWidth.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </LinearGradient>
      </View>

      {/* Update Popup Modal */}
      <Modal
        visible={showUpdatePopup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpdatePopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.updatePopup}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.updatePopupGradient}
            >
              <View style={styles.updatePopupHeader}>
                <Feather name="download" size={24} color="#fff" />
                <Text style={styles.updatePopupTitle}>
                  {updateProgress.status === 'downloading' ? 'Downloading Update' : 
                   updateProgress.status === 'installing' ? 'Installing Update' :
                   updateProgress.status === 'complete' ? 'Update Complete' : 'Checking for Updates'}
                </Text>
              </View>
              
              {updateProgress.status === 'downloading' && (
                <>
                  <View style={styles.updateProgressBar}>
                    <View 
                      style={[styles.updateProgressFill, { width: `${updateProgress.progress}%` }]}
                    />
                  </View>
                  
                  <View style={styles.updateStats}>
                    <Text style={styles.updateStatsText}>
                      {Math.round(updateProgress.progress)}% • {formatFileSize(updateProgress.downloadedBytes)} of {formatFileSize(updateProgress.totalBytes)}
                    </Text>
                    <Text style={styles.updateStatsText}>
                      {formatSpeed(updateProgress.speed)} • {formatTime(updateProgress.remainingTime)} remaining
                    </Text>
                  </View>
                </>
              )}
              
              {updateProgress.version && (
                <Text style={styles.updateVersion}>
                  Version {updateProgress.version}
                </Text>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Styles remain the same as original
const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  headerGradient: {
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    padding: 8,
    marginRight: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  businessSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  iconButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  avatarButton: {
    padding: 2,
  },
  avatar: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updatePopup: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  updatePopupGradient: {
    padding: 20,
    minWidth: screenWidth * 0.8,
  },
  updatePopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  updatePopupTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  updateProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  updateProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  updateStats: {
    marginBottom: 8,
  },
  updateStatsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 2,
  },
  updateVersion: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
// components/GLTHeader.tsx - Enhanced with update progress indicator

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Dimensions } from 'react-native';
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
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    isDownloading: false,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    remainingTime: 0,
    status: 'checking',
  });
  
  // Double tap detection for avatar cycling
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Progress animation refs
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  const activityIndicatorAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    // Monitor download progress
    const checkDownloadProgress = async () => {
      try {
        const progressData = await AsyncStorage.getItem('download_progress');
        if (progressData) {
          const progress = JSON.parse(progressData);
          setDownloadProgress(prev => ({
            ...prev,
            ...progress,
            isDownloading: true,
            status: 'downloading',
          }));
        }
        
        // Check for completed downloads
        const updateService = UpdateService.getInstance();
        const { hasDownload, version } = await updateService.hasCompletedDownload();
        
        if (hasDownload && version) {
          setDownloadProgress(prev => ({
            ...prev,
            isDownloading: false,
            progress: 100,
            status: 'complete',
            version,
          }));
        }
      } catch (error) {
        console.error('Failed to check download progress:', error);
      }
    };
    
    checkDownloadProgress();
    
    // Check progress every 2 seconds when downloading
    const interval = setInterval(checkDownloadProgress, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Animate progress bar and activity indicator
  useEffect(() => {
    if (downloadProgress.isDownloading || downloadProgress.status === 'complete') {
      // Show activity indicator
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(activityIndicatorAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Update progress bar
      Animated.timing(progressBarAnim, {
        toValue: downloadProgress.progress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      // Hide activity indicator
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(activityIndicatorAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [downloadProgress.isDownloading, downloadProgress.progress, downloadProgress.status]);

  const handleOpenDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const handleNotifications = () => {
    router.push('/(drawer)/notifications');
  };

  const handleCart = () => {
    router.push('/(drawer)/cart');
  };

  const handleInstallUpdate = async () => {
    if (downloadProgress.status === 'complete' && downloadProgress.version) {
      try {
        const updateService = UpdateService.getInstance();
        await updateService.installDownloadedAPK(downloadProgress.version);
      } catch (error) {
        console.error('Failed to install update:', error);
      }
    }
  };

  // Navigate to business page on avatar single tap
  const handleAvatarPress = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    // Clear any existing timeout
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
      tapTimeoutRef.current = setTimeout(() => {
        console.log('🎭 Header: Single tap, navigating to business page');
        
        // Use the same navigation pattern as CustomDrawerContent
        try {
          navigation.navigate('business');
        } catch (error) {
          console.error('🎭 Header: Navigation error:', error);
          try {
            navigation.navigate('Business');
          } catch (fallbackError) {
            console.error('🎭 Header: Fallback navigation also failed:', fallbackError);
            // Final fallback using router
            try {
              router.push('/(drawer)/Business');
            } catch (routerError) {
              console.error('🎭 Header: Router navigation also failed:', routerError);
            }
          }
        }
        
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
    
    // Get next index (cycle back to 0 if at end)
    const nextIndex = (currentIndex + 1) % allBusinessOptions.length;
    const nextSelection = allBusinessOptions[nextIndex];
    
    console.log('🎭 Header: Cycling selection:', {
      from: selectedBusiness?.name || 'You',
      to: nextSelection?.name || 'You',
      currentIndex,
      nextIndex
    });
    
    setSelectedBusiness(nextSelection);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // Fetch notification count
  const fetchNotificationCount = async () => {
    try {
      const response = await api.get('/api/v1/notifications/unread_count');
      if (response.data.success) {
        setNotificationCount(response.data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  // Fetch cart count (all pending_unpaid packages)
  const fetchCartCount = async () => {
    try {
      console.log('🛒 Fetching ALL pending_unpaid packages for cart count...');
      
      const response = await api.get('/api/v1/packages', {
        params: {
          state: 'pending_unpaid',
          per_page: 1000,
          page: 1
        },
        timeout: 15000
      });
      
      if (response.data.success) {
        let totalCount = response.data.data?.length || 0;
        
        const pagination = response.data.pagination;
        if (pagination && pagination.total_pages > 1) {
          console.log(`🛒 Multiple pages detected for cart count: ${pagination.total_pages} pages total`);
          
          const additionalPages = [];
          for (let page = 2; page <= pagination.total_pages; page++) {
            additionalPages.push(
              api.get('/api/v1/packages', {
                params: {
                  state: 'pending_unpaid',
                  per_page: 1000,
                  page: page
                },
                timeout: 15000
              })
            );
          }

          const additionalResponses = await Promise.all(additionalPages);
          const additionalCount = additionalResponses.reduce((acc, res) => {
            return acc + (res.data.success ? (res.data.data?.length || 0) : 0);
          }, 0);

          totalCount += additionalCount;
          console.log(`🛒 Total cart count with all pages: ${totalCount}`);
        }
        
        setCartCount(totalCount);
      }
    } catch (error) {
      console.error('Failed to fetch cart count:', error);
    }
  };

  useEffect(() => {
    fetchNotificationCount();
    fetchCartCount();
    
    // Refresh counts every 30 seconds
    const interval = setInterval(() => {
      fetchNotificationCount();
      fetchCartCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const renderBadge = (count: number, color: string) => {
    if (count === 0) return null;
    
    return (
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>
          {count > 99 ? '99+' : count.toString()}
        </Text>
      </View>
    );
  };

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

  const renderActivityIndicator = () => {
    if (!downloadProgress.isDownloading && downloadProgress.status !== 'complete') return null;

    const statusText = downloadProgress.status === 'complete' 
      ? `Update v${downloadProgress.version} ready to install`
      : `Downloading update v${downloadProgress.version || ''}... ${Math.round(downloadProgress.progress)}%`;

    const statusIcon = downloadProgress.status === 'complete' ? 'check-circle' : 'download';
    const statusColor = downloadProgress.status === 'complete' ? '#10b981' : '#8B5CF6';

    return (
      <Animated.View
        style={[
          styles.activityContainer,
          {
            transform: [{ translateY: slideAnim }],
            opacity: activityIndicatorAnim,
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.95)', 'rgba(45, 55, 72, 0.95)']}
          style={styles.activityContent}
        >
          <View style={styles.activityInfo}>
            <View style={[styles.activityIcon, { backgroundColor: `${statusColor}20` }]}>
              <Feather name={statusIcon as any} size={16} color={statusColor} />
            </View>
            
            <View style={styles.activityText}>
              <Text style={styles.activityTitle}>{statusText}</Text>
              {downloadProgress.isDownloading && downloadProgress.speed > 0 && (
                <Text style={styles.activitySubtitle}>
                  {formatFileSize(downloadProgress.downloadedBytes)} / {formatFileSize(downloadProgress.totalBytes)} • {formatSpeed(downloadProgress.speed)}
                </Text>
              )}
            </View>
            
            {downloadProgress.status === 'complete' && (
              <TouchableOpacity onPress={handleInstallUpdate} style={styles.installButton}>
                <LinearGradient colors={['#10b981', '#059669']} style={styles.installButtonGradient}>
                  <Text style={styles.installButtonText}>Install</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          
          {downloadProgress.isDownloading && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressBarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  // Determine if we're in business mode and get appropriate image
  const isBusinessMode = !!selectedBusiness;

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        {/* Left section: Back/Menu + Title */}
        <View style={styles.leftContainer}>
          {showBackButton ? (
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleOpenDrawer} style={styles.menuIcon}>
              <Feather name="menu" size={26} color="white" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* Right section: Notifications + Cart + Avatar */}
        <View style={styles.rightContainer}>
          {/* Notifications */}
          <TouchableOpacity onPress={handleNotifications} style={styles.iconButton}>
            <View style={styles.iconContainer}>
              <Feather name="bell" size={22} color="white" />
              {renderBadge(notificationCount, '#8b5cf6')}
            </View>
          </TouchableOpacity>

          {/* Cart */}
          <TouchableOpacity onPress={handleCart} style={styles.iconButton}>
            <View style={styles.iconContainer}>
              <Feather name="shopping-cart" size={22} color="white" />
              {renderBadge(cartCount, '#ef4444')}
            </View>
          </TouchableOpacity>

          {/* Avatar Preview with Business Cycling */}
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarButton}>
            <View style={styles.avatarContainer}>
              {/* Context-aware image display: Business logo when business selected, avatar when in "You" mode */}
              {isBusinessMode ? (
                <SafeLogo
                  size={28}
                  logoUrl={selectedBusiness.logo_url}
                  avatarUrl={user?.avatar_url}
                  style={styles.avatar}
                  updateTrigger={avatarUpdateTrigger}
                />
              ) : (
                <SafeAvatar
                  size={28}
                  avatarUrl={user?.avatar_url}
                  style={styles.avatar}
                  updateTrigger={avatarUpdateTrigger}
                />
              )}
              
              {/* Selection indicator */}
              <View style={[
                styles.selectionIndicator,
                { backgroundColor: isBusinessMode ? '#7c3aed' : '#10b981' }
              ]}>
                <Feather 
                  name={isBusinessMode ? 'briefcase' : 'user'} 
                  size={8} 
                  color="white" 
                />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Activity Indicator for Downloads */}
      {renderActivityIndicator()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.header,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    marginRight: 12,
    padding: 4,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'System',
    flex: 1,
  },
  iconButton: {
    padding: 4,
  },
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.header,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  avatarButton: {
    padding: 2,
  },
  avatarContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  selectionIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.header,
  },
  
  // Activity Indicator Styles
  activityContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  activityContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#ccc',
  },
  installButton: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  installButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  installButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginTop: 4,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 1.5,
  },
});
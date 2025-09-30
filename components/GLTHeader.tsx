// components/GLTHeader.tsx - Enhanced with reliable ActionCable integration

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Animated, 
  Dimensions, 
  Modal, 
  Alert, 
  Linking, 
  Platform 
} from 'react-native';
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
import firebase from '../config/firebase';
import ActionCableService from '../lib/services/ActionCableService';
import { accountManager } from '../lib/AccountManager';
import { NavigationHelper } from '../lib/helpers/navigation';

const { width: screenWidth } = Dimensions.get('window');

interface GLTHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  title?: string;
}

interface DownloadProgress {
  isDownloading: boolean;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  remainingTime: number;
  version?: string;
  status: 'checking' | 'downloading' | 'installing' | 'complete' | 'error';
}

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
    setHasError(false);
    setImageKey(Date.now());
  }, [avatarUrl, updateTrigger]);
  
  if (!fullAvatarUrl || hasError) {
    return (
      <Image
        source={fallbackSource}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
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
      onError={() => setHasError(true)}
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
  const [isConnected, setIsConnected] = useState(false);
  
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    isDownloading: false,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    remainingTime: 0,
    status: 'checking',
  });
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [fcmToken, setFcmToken] = useState<string>('');
  
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  const progressBarHeight = useRef(new Animated.Value(0)).current;
  
  const unsubscribeOnMessage = useRef<(() => void) | null>(null);
  const unsubscribeOnNotificationOpenedApp = useRef<(() => void) | null>(null);
  const unsubscribeTokenRefresh = useRef<(() => void) | null>(null);

  const actionCableRef = useRef<ActionCableService | null>(null);
  const subscriptionsSetup = useRef(false);

  // ============================================
  // ACTIONCABLE SETUP - Simplified and Reliable
  // ============================================
  
  const setupActionCable = useCallback(async () => {
    if (!user || subscriptionsSetup.current) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

      console.log('📡 Header: Setting up ActionCable...');

      actionCableRef.current = ActionCableService.getInstance();
      
      const connected = await actionCableRef.current.connect({
        token: currentAccount.token,
        userId: currentAccount.id,
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        setupSubscriptions();
        subscriptionsSetup.current = true;
      }
    } catch (error) {
      console.error('❌ Header: Failed to setup ActionCable:', error);
      setIsConnected(false);
    }
  }, [user]);

  const setupSubscriptions = () => {
    if (!actionCableRef.current) return;

    console.log('📡 Header: Setting up subscriptions...');

    // Connection status
    actionCableRef.current.subscribe('connection_established', () => {
      console.log('✅ Header: Connected');
      setIsConnected(true);
    });

    actionCableRef.current.subscribe('connection_lost', () => {
      console.log('❌ Header: Disconnected');
      setIsConnected(false);
    });

    // Initial state
    actionCableRef.current.subscribe('initial_state', (data) => {
      if (data.counts) {
        setNotificationCount(data.counts.notifications || 0);
        setCartCount(data.counts.cart || 0);
      }
    });

    actionCableRef.current.subscribe('initial_counts', (data) => {
      setNotificationCount(data.notification_count || 0);
      setCartCount(data.cart_count || 0);
    });

    // Real-time updates
    actionCableRef.current.subscribe('notification_count_update', (data) => {
      setNotificationCount(data.notification_count || 0);
    });

    actionCableRef.current.subscribe('cart_count_update', (data) => {
      setCartCount(data.cart_count || 0);
    });

    actionCableRef.current.subscribe('new_notification', () => {
      setNotificationCount(prev => prev + 1);
    });

    console.log('✅ Header: Subscriptions configured');
  };

  useEffect(() => {
    setupActionCable();

    return () => {
      subscriptionsSetup.current = false;
    };
  }, [setupActionCable]);

  // Fallback polling when disconnected
  useEffect(() => {
    if (!isConnected) {
      console.log('⏳ Header: Starting fallback polling...');
      
      const poll = () => {
        fetchNotificationCount();
        fetchCartCount();
      };

      poll();
      const interval = setInterval(poll, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // ============================================
  // FIREBASE SETUP
  // ============================================
  
  useEffect(() => {
    setupFirebaseMessaging();
    
    return () => {
      if (unsubscribeOnMessage.current) unsubscribeOnMessage.current();
      if (unsubscribeOnNotificationOpenedApp.current) unsubscribeOnNotificationOpenedApp.current();
      if (unsubscribeTokenRefresh.current) unsubscribeTokenRefresh.current();
    };
  }, []);

  const setupFirebaseMessaging = async () => {
    try {
      console.log('🔥 Header: Setting up Firebase...');
      
      if (!firebase.isNative || !firebase.messaging()) {
        console.log('🔥 Header: Skipping Firebase - not native');
        return;
      }

      const permissionGranted = await requestFirebasePermissions();
      if (!permissionGranted) return;

      await getFirebaseToken();
      setupFirebaseListeners();
      handleInitialNotification();
      
      console.log('✅ Header: Firebase setup complete');
    } catch (error) {
      console.error('❌ Header: Firebase setup failed:', error);
    }
  };

  const requestFirebasePermissions = async (): Promise<boolean> => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return false;
      
      const authStatus = await messaging.requestPermission();
      const enabled = authStatus === 1 || authStatus === 2;

      if (enabled) {
        console.log('✅ Firebase permissions granted');
        return true;
      } else {
        Alert.alert(
          'Notifications Required',
          'GLT needs notification permissions to send you important updates.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
    } catch (error) {
      console.error('❌ Firebase permissions error:', error);
      return false;
    }
  };

  const getFirebaseToken = async () => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return;
      
      const token = await messaging.getToken();
      console.log('🔥 FCM token received');
      setFcmToken(token);

      await registerFCMTokenWithBackend(token);
      
      unsubscribeTokenRefresh.current = messaging.onTokenRefresh(async (newToken) => {
        console.log('🔥 FCM token refreshed');
        setFcmToken(newToken);
        await registerFCMTokenWithBackend(newToken);
      });
    } catch (error) {
      console.error('❌ FCM token error:', error);
    }
  };

  const registerFCMTokenWithBackend = async (token: string) => {
    try {
      const response = await api.post('/api/v1/push_tokens', {
        push_token: token,
        platform: 'fcm',
        device_info: {
          platform: Platform.OS,
          version: Platform.Version,
          isDevice: true,
          deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
        }
      });
      
      if (response.data?.success) {
        console.log('✅ FCM token registered');
        await AsyncStorage.setItem('fcm_token', token);
        await AsyncStorage.setItem('fcm_token_registered', 'true');
      }
    } catch (error) {
      console.error('❌ FCM token registration failed:', error);
    }
  };

  const setupFirebaseListeners = () => {
    const messaging = firebase.messaging();
    if (!messaging) return;

    unsubscribeOnMessage.current = messaging.onMessage(async (remoteMessage) => {
      console.log('🔥 Foreground message received');
      
      if (!isConnected) {
        setNotificationCount(prev => prev + 1);
      }
      
      if (remoteMessage.notification?.title && remoteMessage.notification?.body) {
        Alert.alert(
          remoteMessage.notification.title,
          remoteMessage.notification.body,
          [
            { text: 'View', onPress: () => handleNotificationData(remoteMessage.data) },
            { text: 'Dismiss', style: 'cancel' }
          ]
        );
      }
    });

    unsubscribeOnNotificationOpenedApp.current = messaging.onNotificationOpenedApp((remoteMessage) => {
      console.log('🔥 Notification opened app');
      handleNotificationData(remoteMessage.data);
    });
  };

  const handleInitialNotification = async () => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return;

      const initialNotification = await messaging.getInitialNotification();
      
      if (initialNotification) {
        console.log('🔥 App opened by notification');
        setTimeout(() => {
          handleNotificationData(initialNotification.data);
        }, 2000);
      }
    } catch (error) {
      console.error('🔥 Initial notification error:', error);
    }
  };

  const handleNotificationData = async (data: any) => {
    console.log('🔥 Handling notification data:', data);
    
    try {
      if (data?.type === 'package_update' && data?.package_id) {
        await NavigationHelper.navigateTo('/(drawer)/track', {
          params: { packageId: data.package_id },
          trackInHistory: true
        });
      } else if (data?.package_code) {
        await NavigationHelper.navigateTo('/(drawer)/track', {
          params: { code: data.package_code },
          trackInHistory: true
        });
      } else {
        await NavigationHelper.navigateTo('/(drawer)/notifications', {
          params: {},
          trackInHistory: true
        });
      }
      
      if (data?.notification_id) {
        markNotificationAsRead(data.notification_id);
      }
    } catch (error) {
      console.error('🔥 Notification handling error:', error);
    }
  };

  // ============================================
  // FALLBACK API METHODS
  // ============================================
  
  const fetchNotificationCount = async () => {
    try {
      const response = await api.get('/api/v1/notifications/unread_count', {
        timeout: 8000
      });
      
      if (response.data?.success) {
        const count = response.data.unread_count || response.data.count || 0;
        setNotificationCount(count);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  const fetchCartCount = async () => {
    try {
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
        }
        
        setCartCount(totalCount);
      }
    } catch (error) {
      console.error('Failed to fetch cart count:', error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      if (isConnected && actionCableRef.current) {
        const success = await actionCableRef.current.markNotificationRead(parseInt(notificationId));
        if (success) {
          console.log('✅ Notification marked as read via ActionCable');
          return;
        }
      }

      await api.patch(`/api/v1/notifications/${notificationId}/mark_as_read`);
      console.log('✅ Notification marked as read via API');
      
      if (!isConnected) {
        fetchNotificationCount();
      }
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
    }
  };

  // ============================================
  // UPDATE PROGRESS MONITORING
  // ============================================
  
  useEffect(() => {
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
          setShowInstallModal(true);
        }
      } catch (error) {
        console.error('Failed to check download progress:', error);
      }
    };
    
    checkDownloadProgress();
    const interval = setInterval(checkDownloadProgress, 2000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (downloadProgress.isDownloading || downloadProgress.progress > 0) {
      Animated.timing(progressBarHeight, {
        toValue: 3,
        duration: 300,
        useNativeDriver: false,
      }).start();
      
      Animated.timing(progressBarAnim, {
        toValue: downloadProgress.progress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(progressBarHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [downloadProgress.isDownloading, downloadProgress.progress]);

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================
  
  const handleOpenDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      try {
        NavigationHelper.goBackImmediate({
          fallbackRoute: '/(drawer)/',
          replaceIfNoHistory: true
        });
      } catch (error) {
        console.error('Back navigation failed:', error);
        router.back();
      }
    }
  };

  const handleNotifications = async () => {
    try {
      await NavigationHelper.navigateTo('/(drawer)/notifications', {
        params: {},
        trackInHistory: true
      });
    } catch (error) {
      console.error('Navigation failed:', error);
      router.push('/(drawer)/notifications');
    }
  };

  const handleCart = async () => {
    try {
      await NavigationHelper.navigateTo('/(drawer)/cart', {
        params: {},
        trackInHistory: true
      });
    } catch (error) {
      console.error('Navigation failed:', error);
      router.push('/(drawer)/cart');
    }
  };

  const handleInstallUpdate = async () => {
    if (downloadProgress.status === 'complete' && downloadProgress.version) {
      try {
        const updateService = UpdateService.getInstance();
        setShowInstallModal(false);
        await updateService.installDownloadedAPK(downloadProgress.version);
      } catch (error) {
        console.error('Failed to install update:', error);
      }
    }
  };

  // ============================================
  // AVATAR & BUSINESS CYCLING
  // ============================================
  
  const handleAvatarPress = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    
    if (timeSinceLastTap < 300) {
      handleAvatarDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(async () => {
        try {
          await NavigationHelper.navigateTo('/(drawer)/business', {
            params: {},
            trackInHistory: true
          });
        } catch (error) {
          console.error('Navigation error:', error);
        }
        tapTimeoutRef.current = null;
      }, 300);
    }
  };

  const handleAvatarDoubleTap = () => {
    const allBusinessOptions = [null, ...businesses.owned, ...businesses.joined];
    
    if (allBusinessOptions.length <= 1) return;
    
    let currentIndex = 0;
    if (selectedBusiness) {
      const businessIndex = allBusinessOptions.findIndex(
        (business) => business && business.id === selectedBusiness.id
      );
      currentIndex = businessIndex !== -1 ? businessIndex : 0;
    }
    
    const nextIndex = (currentIndex + 1) % allBusinessOptions.length;
    const nextSelection = allBusinessOptions[nextIndex];
    
    setSelectedBusiness(nextSelection);
  };

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // ============================================
  // RENDER HELPERS
  // ============================================
  
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

  const getProgressBarColor = () => {
    if (downloadProgress.status === 'complete') return '#10b981';
    if (downloadProgress.status === 'error') return '#ef4444';
    return '#ff6b35';
  };

  const isBusinessMode = !!selectedBusiness;

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
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
          
          {__DEV__ && (
            <View style={[
              styles.connectionIndicator,
              { backgroundColor: isConnected ? '#10b981' : '#ef4444' }
            ]}>
              <Feather 
                name={isConnected ? 'wifi' : 'wifi-off'} 
                size={10} 
                color="white" 
              />
            </View>
          )}
        </View>

        <View style={styles.rightContainer}>
          <TouchableOpacity onPress={handleNotifications} style={styles.iconButton}>
            <View style={styles.iconContainer}>
              <Feather name="bell" size={22} color="white" />
              {renderBadge(notificationCount, '#8b5cf6')}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCart} style={styles.iconButton}>
            <View style={styles.iconContainer}>
              <Feather name="shopping-cart" size={22} color="white" />
              {renderBadge(cartCount, '#ef4444')}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarButton}>
            <View style={styles.avatarContainer}>
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
      
      <Animated.View style={[styles.progressBarContainer, { height: progressBarHeight }]}>
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: getProgressBarColor(),
                width: progressBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </Animated.View>

      <Modal
        visible={showInstallModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInstallModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1a1a2e', '#2d3748']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Feather name="check-circle" size={24} color="#10b981" />
                </View>
                <Text style={styles.modalTitle}>Update Downloaded</Text>
                <TouchableOpacity onPress={() => setShowInstallModal(false)} style={styles.closeButton}>
                  <Feather name="x" size={20} color="#ccc" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalText}>
                GLT version {downloadProgress.version} is ready to install.
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setShowInstallModal(false)} style={styles.laterButton}>
                  <Text style={styles.laterButtonText}>Later</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={handleInstallUpdate} style={styles.installButton}>
                  <LinearGradient colors={['#10b981', '#059669']} style={styles.installButtonGradient}>
                    <Text style={styles.installButtonText}>Install Now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
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
  connectionIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
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
  progressBarContainer: {
    width: '100%',
    backgroundColor: colors.header,
    overflow: 'hidden',
  },
  progressBarBackground: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalText: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  laterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  installButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  installButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  installButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
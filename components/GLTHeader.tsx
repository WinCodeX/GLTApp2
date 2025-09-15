// components/GLTHeader.tsx - FIXED: System notifications now appear in phone's notification tray

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Dimensions, Modal, Alert, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
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
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  remainingTime: number;
  version?: string;
  status: 'checking' | 'downloading' | 'installing' | 'complete' | 'error';
}

// Enhanced Safe Avatar Component
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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  
  // Double tap detection for avatar cycling
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Progress animation refs
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  const progressBarHeight = useRef(new Animated.Value(0)).current;
  
  // Notification listeners refs
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // ============================================
  // FIXED: PROPER SYSTEM NOTIFICATION SETUP
  // ============================================
  useEffect(() => {
    setupSystemNotifications();
    
    return () => {
      // Cleanup notification listeners
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const setupSystemNotifications = async () => {
    try {
      console.log('🔔 SETTING UP SYSTEM NOTIFICATIONS...');
      
      // CRITICAL: Set up notification channels first (Android)
      if (Platform.OS === 'android') {
        await setupAndroidNotificationChannels();
      }
      
      // FIXED: Configure notification handler for proper system notifications
      await Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          console.log('🔔 NOTIFICATION RECEIVED:', {
            title: notification.request.content.title,
            body: notification.request.content.body,
            data: notification.request.content.data
          });
          
          // CRITICAL: Return configuration that forces system notifications
          return {
            shouldShowAlert: false,      // NEVER show in-app alerts
            shouldPlaySound: true,       // Play system sound
            shouldSetBadge: true,        // Update app badge count
          };
        },
      });

      // Set up notification categories with actions
      await setupNotificationCategories();

      // Request permissions with detailed checking
      const permissionGranted = await requestNotificationPermissions();
      if (!permissionGranted) {
        return;
      }

      // Get and register push token
      await registerForPushNotifications();
      
      // Setup notification response listeners
      setupNotificationListeners();
      
      console.log('✅ SYSTEM NOTIFICATIONS SETUP COMPLETE');
      
    } catch (error) {
      console.error('❌ FAILED TO SETUP SYSTEM NOTIFICATIONS:', error);
    }
  };

  const setupAndroidNotificationChannels = async () => {
    try {
      console.log('🔔 Setting up Android notification channels...');
      
      // Default channel
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default GLT Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c3aed',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      // High priority channel for urgent notifications
      await Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgent GLT Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ef4444',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
        bypassDnd: true,
      });

      // Package updates channel
      await Notifications.setNotificationChannelAsync('packages', {
        name: 'Package Updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      console.log('✅ Android notification channels configured');
    } catch (error) {
      console.error('❌ Failed to setup Android channels:', error);
    }
  };

  const setupNotificationCategories = async () => {
    try {
      // Package update category
      await Notifications.setNotificationCategoryAsync('package_update', [
        {
          identifier: 'view_package',
          buttonTitle: 'View Package',
          options: { opensAppToForeground: true }
        },
        {
          identifier: 'track_package',
          buttonTitle: 'Track',
          options: { opensAppToForeground: true }
        }
      ]);

      // General notification category
      await Notifications.setNotificationCategoryAsync('general', [
        {
          identifier: 'view',
          buttonTitle: 'View',
          options: { opensAppToForeground: true }
        }
      ]);

      console.log('✅ Notification categories configured');
    } catch (error) {
      console.error('❌ Failed to setup notification categories:', error);
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      console.log('🔔 CHECKING NOTIFICATION PERMISSIONS...');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('🔔 EXISTING PERMISSION STATUS:', existingStatus);
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('🔔 REQUESTING NOTIFICATION PERMISSIONS...');
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowDisplayInCarPlay: true,
            allowCriticalAlerts: false,
            provideAppNotificationSettings: true,
            allowProvisional: false,
            allowAnnouncements: false,
          },
          android: {},
        });
        finalStatus = status;
        console.log('🔔 NEW PERMISSION STATUS:', finalStatus);
      }
      
      if (finalStatus !== 'granted') {
        console.error('❌ NOTIFICATION PERMISSIONS DENIED');
        Alert.alert(
          'Notifications Required',
          'GLT needs notification permissions to send you important updates about your packages. Please enable notifications in your device settings.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { 
              text: 'Open Settings', 
              style: 'default',
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return false;
      }

      console.log('✅ NOTIFICATION PERMISSIONS GRANTED');
      return true;
    } catch (error) {
      console.error('❌ ERROR REQUESTING PERMISSIONS:', error);
      return false;
    }
  };

  const registerForPushNotifications = async () => {
    try {
      if (!Device.isDevice) {
        console.warn('🔔 SIMULATOR DETECTED - Push notifications only work on physical devices');
        Alert.alert(
          'Simulator Detected',
          'Push notifications only work on physical devices. Please test on a real phone.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('🔔 GETTING EXPO PUSH TOKEN...');
      console.log('🔔 PROJECT ID:', Constants.expoConfig?.extra?.eas?.projectId);
      console.log('🔔 Build Info:', {
        isExpoGo: Constants.appOwnership === 'expo',
        executionEnvironment: Constants.executionEnvironment,
        platform: Platform.OS,
        buildType: __DEV__ ? 'development' : 'production'
      });
      
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })).data;
      
      console.log('🔔 EXPO PUSH TOKEN RECEIVED:', token?.substring(0, 50) + '...');
      setExpoPushToken(token);

      // Register with backend
      await registerPushTokenWithBackend(token);
      
    } catch (error) {
      console.error('❌ DETAILED PUSH TOKEN ERROR:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
        buildInfo: {
          isExpoGo: Constants.appOwnership === 'expo',
          executionEnvironment: Constants.executionEnvironment,
          platform: Platform.OS
        }
      });
      
      Alert.alert(
        'Push Token Error',
        `Failed to register for push notifications: ${error.message}\n\nPlease try restarting the app.`,
        [{ text: 'OK' }]
      );
    }
  };

  const registerPushTokenWithBackend = async (token: string) => {
    try {
      console.log('🔔 REGISTERING PUSH TOKEN WITH BACKEND...');
      console.log('🔔 TOKEN:', token?.substring(0, 50) + '...');
      
      const response = await api.post('/api/v1/push_tokens', {
        push_token: token,
        platform: 'expo',
        device_info: {
          brand: Device.brand,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
          isDevice: Device.isDevice,
          deviceType: Device.deviceType,
        }
      });
      
      console.log('🔔 BACKEND RESPONSE:', response.data);
      
      if (response.data?.success) {
        console.log('✅ PUSH TOKEN REGISTERED SUCCESSFULLY');
        await AsyncStorage.setItem('expo_push_token', token);
        await AsyncStorage.setItem('push_token_registered', 'true');
      } else {
        console.error('❌ BACKEND REJECTED PUSH TOKEN REGISTRATION:', response.data);
      }
      
    } catch (error) {
      console.error('❌ PUSH TOKEN BACKEND REGISTRATION FAILED:', error.response?.data || error);
    }
  };

  const setupNotificationListeners = () => {
    // Listen for notifications received while app is active
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 NOTIFICATION RECEIVED WHILE APP ACTIVE:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
      });
      
      // Update badge count
      setNotificationCount(prev => prev + 1);
      
      // The notification will automatically show in system tray due to our handler config
    });

    // Listen for notification responses (user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    
    console.log('✅ Notification listeners configured');
  };

  // Handle notification taps (when user taps system notification)
  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    console.log('🔔 NOTIFICATION TAPPED BY USER:', {
      actionIdentifier: response.actionIdentifier,
      data: response.notification.request.content.data
    });
    
    const notificationData = response.notification.request.content.data;
    const actionIdentifier = response.actionIdentifier;
    
    try {
      // Handle action-specific responses
      if (actionIdentifier === 'view_package' || actionIdentifier === 'track_package') {
        if (notificationData?.package_id) {
          await NavigationHelper.navigateTo('/(drawer)/track', {
            params: { packageId: notificationData.package_id },
            trackInHistory: true
          });
        } else if (notificationData?.package_code) {
          await NavigationHelper.navigateTo('/(drawer)/track', {
            params: { code: notificationData.package_code },
            trackInHistory: true
          });
        }
      } else if (actionIdentifier === 'view' || !actionIdentifier) {
        // Default action - navigate based on notification type
        if (notificationData?.type === 'package_update' && notificationData?.package_id) {
          await NavigationHelper.navigateTo('/(drawer)/track', {
            params: { packageId: notificationData.package_id },
            trackInHistory: true
          });
        } else if (notificationData?.package_code) {
          await NavigationHelper.navigateTo('/(drawer)/track', {
            params: { code: notificationData.package_code },
            trackInHistory: true
          });
        } else {
          // Navigate to notifications screen
          await NavigationHelper.navigateTo('/(drawer)/notifications', {
            params: {},
            trackInHistory: true
          });
        }
      }
      
      // Mark notification as read if we have the ID
      if (notificationData?.notification_id) {
        markNotificationAsRead(notificationData.notification_id);
      }
      
    } catch (error) {
      console.error('🔔 ERROR HANDLING NOTIFICATION RESPONSE:', error);
      
      // Fallback navigation
      try {
        await NavigationHelper.navigateTo('/(drawer)/notifications', {
          params: {},
          trackInHistory: true
        });
      } catch (fallbackError) {
        console.error('🔔 FALLBACK NAVIGATION FAILED:', fallbackError);
      }
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/api/v1/notifications/${notificationId}/mark_as_read`);
      console.log('✅ Notification marked as read');
      
      // Refresh notification count
      fetchNotificationCount();
      
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
    }
  };

  // ============================================
  // REAL-TIME NOTIFICATION POLLING
  // ============================================
  useEffect(() => {
    // Start aggressive polling for real-time feel
    const startNotificationPolling = () => {
      fetchNotificationCount();
      fetchCartCount();
      
      // Poll every 10 seconds for immediate updates
      const interval = setInterval(() => {
        fetchNotificationCount();
        fetchCartCount();
      }, 10000);
      
      return interval;
    };
    
    const interval = startNotificationPolling();
    
    return () => clearInterval(interval);
  }, []);

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

  // Animate progress bar
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

  const handleOpenDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      try {
        console.log('🔙 Header: UI back button pressed - using immediate navigation');
        const success = NavigationHelper.goBackImmediate({
          fallbackRoute: '/(drawer)/',
          replaceIfNoHistory: true
        });
        
        console.log('🔙 Header: UI back navigation completed immediately:', success);
      } catch (error) {
        console.error('🔙 Header: UI back navigation failed:', error);
        
        // Fallback to router back
        try {
          router.back();
        } catch (fallbackError) {
          console.error('🔙 Header: Router back fallback also failed:', fallbackError);
        }
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
      console.error('Navigation to notifications failed:', error);
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
      console.error('Navigation to cart failed:', error);
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

  const handleCloseInstallModal = () => {
    setShowInstallModal(false);
  };

  const handleAvatarPress = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    
    if (timeSinceLastTap < 300) {
      console.log('🎭 Header: Double tap detected, cycling business selection');
      handleAvatarDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(async () => {
        console.log('🎭 Header: Single tap, navigating to business page');
        
        try {
          await NavigationHelper.navigateTo('/(drawer)/business', {
            params: {},
            trackInHistory: true
          });
        } catch (error) {
          console.error('🎭 Header: Navigation error:', error);
          try {
            await NavigationHelper.navigateTo('/(drawer)/Business', {
              params: {},
              trackInHistory: true
            });
          } catch (fallbackError) {
            console.error('🎭 Header: Fallback navigation also failed:', fallbackError);
          }
        }
        
        tapTimeoutRef.current = null;
      }, 300);
    }
  };

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
    
    let currentIndex = 0;
    if (selectedBusiness) {
      const businessIndex = allBusinessOptions.findIndex(
        (business) => business && business.id === selectedBusiness.id
      );
      currentIndex = businessIndex !== -1 ? businessIndex : 0;
    }
    
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

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced notification count fetching with multiple fallbacks
  const fetchNotificationCount = async () => {
    try {
      console.log('🔔 Fetching notification count from API...');
      
      // Method 1: Try the dedicated unread_count endpoint
      try {
        const response = await api.get('/api/v1/notifications/unread_count', {
          timeout: 8000
        });
        console.log('🔔 Unread count endpoint response:', response.data);
        
        if (response.data && response.data.success) {
          const count = response.data.unread_count || response.data.count || 0;
          setNotificationCount(count);
          console.log('🔔 Notification count updated from unread_count endpoint:', count);
          return;
        }
      } catch (unreadCountError) {
        console.log('🔔 Unread count endpoint failed, trying fallback:', unreadCountError.response?.status);
      }
      
      // Method 2: Fallback to notifications index endpoint
      try {
        const response = await api.get('/api/v1/notifications', {
          params: {
            per_page: 1,
            page: 1,
            unread_only: 'true'
          },
          timeout: 8000
        });
        
        console.log('🔔 Notifications index response:', response.data);
        
        if (response.data && response.data.success) {
          const count = response.data.unread_count || response.data.pagination?.total_count || 0;
          setNotificationCount(count);
          console.log('🔔 Notification count updated from index endpoint:', count);
          return;
        }
      } catch (indexError) {
        console.log('🔔 Index endpoint also failed:', indexError.response?.status);
      }
      
      // Method 3: Manual count fallback
      try {
        const response = await api.get('/api/v1/notifications', {
          params: {
            per_page: 50,
            page: 1
          },
          timeout: 10000
        });
        
        if (response.data && response.data.success && response.data.data) {
          const unreadCount = response.data.data.filter((notification: any) => !notification.read).length;
          setNotificationCount(unreadCount);
          console.log('🔔 Notification count updated from manual count:', unreadCount);
          return;
        }
      } catch (manualCountError) {
        console.log('🔔 Manual count also failed:', manualCountError.response?.status);
      }
      
      console.warn('🔔 All notification count methods failed, keeping previous count');
      
    } catch (error) {
      console.error('🔔 Unexpected error in fetchNotificationCount:', error);
    }
  };

  // Fetch cart count
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
      
      {/* Progress Bar under header */}
      <Animated.View
        style={[
          styles.progressBarContainer,
          {
            height: progressBarHeight,
          },
        ]}
      >
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

      {/* Install Modal */}
      <Modal
        visible={showInstallModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseInstallModal}
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
                <TouchableOpacity onPress={handleCloseInstallModal} style={styles.closeButton}>
                  <Feather name="x" size={20} color="#ccc" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalText}>
                GLT version {downloadProgress.version} is ready to install.
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={handleCloseInstallModal} style={styles.laterButton}>
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
  
  // Progress Bar Styles
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

  // Modal Styles
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
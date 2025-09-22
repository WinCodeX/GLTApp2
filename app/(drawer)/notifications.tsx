// app/(drawer)/notifications.tsx - Fixed Enhanced Purple-themed notifications screen

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GLTHeader from '../../components/GLTHeader';
import colors from '../../theme/colors';
import api from '../../lib/api';
import { NavigationHelper } from '../../lib/helpers/navigation';

// Import Firebase using the same pattern as header
import firebase from '../../config/firebase';

const { width: screenWidth } = Dimensions.get('window');

interface NotificationData {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  priority: string;
  read: boolean;
  delivered: boolean;
  created_at: string;
  time_since_creation: string;
  formatted_created_at: string;
  icon: string;
  action_url?: string;
  expires_at?: string;
  expired: boolean;
  package?: {
    id: number;
    code: string;
    state: string;
    state_display: string;
  };
}

interface NotificationsPagination {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

interface NotificationsResponse {
  success: boolean;
  data: NotificationData[];
  pagination: NotificationsPagination;
  unread_count: number;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<NotificationsPagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  
  // FIXED: Track pressed notifications to prevent blank states
  const [pressedNotifications, setPressedNotifications] = useState<Set<number>>(new Set());
  
  // FIXED: Track read operations in progress to prevent race conditions
  const [markingAsRead, setMarkingAsRead] = useState<Set<number>>(new Set());

  // Toast animation
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Firebase messaging listeners refs
  const unsubscribeOnMessage = useRef<(() => void) | null>(null);
  const unsubscribeOnNotificationOpenedApp = useRef<(() => void) | null>(null);
  const unsubscribeTokenRefresh = useRef<(() => void) | null>(null);

  // FIXED: Helper function to check if notification is read
  const isNotificationRead = (notification: NotificationData) => {
    return notification.read;
  };

  // FIXED: Helper function to check if notification is being processed
  const isNotificationPressed = (notificationId: number) => {
    return pressedNotifications.has(notificationId);
  };

  // Purple gradient colors
  const getGradientColors = () => {
    return ['#1a1b3d', '#2d1b4e', '#4c1d95'];
  };

  // ============================================
  // FIREBASE SETUP - Same as original
  // ============================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setupFirebaseMessaging();
    }, 2000);
    
    return () => {
      clearTimeout(timer);
      if (unsubscribeOnMessage.current) {
        unsubscribeOnMessage.current();
      }
      if (unsubscribeOnNotificationOpenedApp.current) {
        unsubscribeOnNotificationOpenedApp.current();
      }
      if (unsubscribeTokenRefresh.current) {
        unsubscribeTokenRefresh.current();
      }
    };
  }, []);

  const setupFirebaseMessaging = async () => {
    try {
      console.log('🔥 NOTIFICATIONS SCREEN: Setting up Firebase messaging...');
      console.log('🔥 Platform detection:', {
        isNative: firebase.isNative,
        platform: Platform.OS,
        hasMessaging: !!firebase.messaging()
      });
      
      const messaging = firebase.messaging();
      if (!messaging) {
        console.log('🔥 Firebase messaging not available, skipping setup');
        return;
      }

      const permissionGranted = await requestFirebasePermissions();
      if (!permissionGranted) {
        return;
      }

      await getFirebaseToken();
      setupFirebaseListeners();
      
      console.log('✅ NOTIFICATIONS SCREEN: Firebase messaging setup complete');
      
    } catch (error) {
      console.error('❌ NOTIFICATIONS SCREEN: Failed to setup Firebase messaging:', error);
    }
  };

  const requestFirebasePermissions = async (): Promise<boolean> => {
    try {
      console.log('🔥 NOTIFICATIONS SCREEN: Requesting Firebase permissions...');
      
      const messaging = firebase.messaging();
      if (!messaging) {
        console.log('🔥 Firebase messaging not available');
        return false;
      }
      
      const authStatus = await messaging.requestPermission();
      const enabled = authStatus === 1 || authStatus === 2;

      if (enabled) {
        console.log('✅ NOTIFICATIONS SCREEN: Firebase authorization granted:', authStatus);
        return true;
      } else {
        console.log('❌ NOTIFICATIONS SCREEN: Firebase permissions denied');
        showToast('Push notification permissions denied', 'error');
        return false;
      }
    } catch (error) {
      console.error('❌ NOTIFICATIONS SCREEN: Error requesting Firebase permissions:', error);
      return false;
    }
  };

  const getFirebaseToken = async () => {
    try {
      console.log('🔥 NOTIFICATIONS SCREEN: Getting Firebase FCM token...');
      
      const messaging = firebase.messaging();
      if (!messaging) {
        console.log('🔥 Firebase messaging not available for token generation');
        return;
      }
      
      const token = await messaging.getToken();
      
      console.log('🔥 NOTIFICATIONS SCREEN: FCM token received:', token?.substring(0, 50) + '...');
      setFcmToken(token);

      await registerFCMTokenWithBackend(token);
      
      unsubscribeTokenRefresh.current = messaging.onTokenRefresh(async (newToken) => {
        console.log('🔥 NOTIFICATIONS SCREEN: FCM token refreshed:', newToken?.substring(0, 50) + '...');
        setFcmToken(newToken);
        await registerFCMTokenWithBackend(newToken);
      });
      
    } catch (error) {
      console.error('❌ NOTIFICATIONS SCREEN: FCM token error:', error);
    }
  };

  const registerFCMTokenWithBackend = async (token: string) => {
    try {
      console.log('🔥 NOTIFICATIONS SCREEN: Registering FCM token with backend...');
      
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        console.log('No auth token available, skipping push token registration');
        return;
      }
      
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
      
      console.log('🔥 NOTIFICATIONS SCREEN: Backend response:', response.data);
      
      if (response.data?.success) {
        console.log('✅ NOTIFICATIONS SCREEN: FCM token registered successfully');
        await AsyncStorage.setItem('fcm_token', token);
        await AsyncStorage.setItem('fcm_token_registered', 'true');
        showToast('Push notifications enabled', 'success');
      } else {
        console.error('❌ NOTIFICATIONS SCREEN: Backend rejected FCM token registration:', response.data);
      }
      
    } catch (error) {
      console.error('❌ NOTIFICATIONS SCREEN: FCM token backend registration failed:', error);
      
      if (error.response?.status === 401) {
        console.log('Authentication required for push token registration');
        return;
      }
      
      showToast('Failed to register for push notifications', 'error');
    }
  };

  const setupFirebaseListeners = () => {
    const messaging = firebase.messaging();
    if (!messaging) return;

    unsubscribeOnMessage.current = messaging.onMessage(async (remoteMessage) => {
      console.log('🔥 NOTIFICATIONS SCREEN: Foreground message received:', remoteMessage);
      
      fetchNotifications(1, true);
      showToast('New notification received', 'success');
    });

    unsubscribeOnNotificationOpenedApp.current = messaging.onNotificationOpenedApp((remoteMessage) => {
      console.log('🔥 NOTIFICATIONS SCREEN: Notification opened app from background:', remoteMessage);
      handleNotificationData(remoteMessage.data);
    });
  };

  const handleNotificationData = async (data: any) => {
    console.log('🔥 NOTIFICATIONS SCREEN: Handling notification data:', data);
    
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
      }
      
      if (data?.notification_id) {
        markNotificationAsRead(data.notification_id);
      }
      
    } catch (error) {
      console.error('🔥 NOTIFICATIONS SCREEN: Error handling notification data:', error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/api/v1/notifications/${notificationId}/mark_as_read`);
      console.log('✅ NOTIFICATIONS SCREEN: Notification marked as read');
      
      fetchNotifications(1, true);
      
    } catch (error) {
      console.error('❌ NOTIFICATIONS SCREEN: Failed to mark notification as read:', error);
    }
  };

  // Toast functionality
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (page = 1, refresh = false) => {
    try {
      console.log('🔔 Fetching notifications, page:', page, 'refresh:', refresh);
      
      if (refresh) {
        setRefreshing(true);
        setError(null);
      } else if (page > 1) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params: any = {
        page,
        per_page: 20,
      };

      if (filter === 'unread') {
        params.unread_only = 'true';
      }

      const response = await api.get('/api/v1/notifications', {
        params,
        timeout: 15000,
      });

      console.log('🔔 Notifications response:', response.data);

      if (response.data && response.data.success) {
        const newNotifications = response.data.data || [];
        
        if (refresh || page === 1) {
          setNotifications(newNotifications);
          // FIXED: Clear pressed states on refresh
          setPressedNotifications(new Set());
          setMarkingAsRead(new Set());
        } else {
          setNotifications(prev => {
            if (!Array.isArray(prev)) return newNotifications;
            return [...prev, ...newNotifications];
          });
        }
        
        setPagination(response.data.pagination || null);
        setCurrentPage(page);
      } else {
        setError('Failed to load notifications');
      }
    } catch (error) {
      console.error('🔔 Failed to fetch notifications:', error);
      setError('Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filter]);

  // FIXED: Mark notification as read with proper state management
  const markAsRead = async (notificationId: number) => {
    try {
      console.log('🔔 Marking notification as read:', notificationId);
      
      // Prevent duplicate calls
      if (markingAsRead.has(notificationId)) {
        console.log('🔔 Already marking notification as read, skipping:', notificationId);
        return;
      }
      
      // Add to marking set
      setMarkingAsRead(prev => new Set(prev).add(notificationId));
      
      const response = await api.patch(`/api/v1/notifications/${notificationId}/mark_as_read`);
      
      if (response.data && response.data.success) {
        console.log('✅ Notification marked as read successfully');
        
        // Update notifications state
        setNotifications(prev => {
          if (!Array.isArray(prev)) return prev;
          return prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          );
        });
      } else {
        console.error('🔔 API returned unsuccessful response:', response.data);
      }
    } catch (error) {
      console.error('🔔 Failed to mark notification as read:', error);
    } finally {
      // Remove from marking set
      setMarkingAsRead(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  // FIXED: Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      console.log('🔔 Marking all notifications as read');
      
      const response = await api.patch('/api/v1/notifications/mark_all_as_read');
      
      if (response.data && response.data.success) {
        setNotifications(prev => {
          if (!Array.isArray(prev)) return prev;
          return prev.map(notification => ({ ...notification, read: true }));
        });
        showToast('All notifications marked as read', 'success');
      } else {
        showToast('Failed to mark all as read', 'error');
      }
    } catch (error) {
      console.error('🔔 Failed to mark all notifications as read:', error);
      showToast('Failed to mark all as read', 'error');
    }
  };

  // FIXED: Handle notification press with proper state management
  const handleNotificationPress = (notification: NotificationData) => {
    console.log('🔔 Notification pressed:', notification.id, 'read:', notification.read);
    
    // Prevent multiple presses
    if (isNotificationPressed(notification.id)) {
      console.log('🔔 Notification already being processed, ignoring press');
      return;
    }
    
    // FIXED: Add immediate visual feedback
    setPressedNotifications(prev => new Set(prev).add(notification.id));
    
    try {
      // FIXED: Consistent navigation handling
      let navigationParams: any = null;
      
      if (notification.action_url) {
        const url = notification.action_url;
        
        if (url.includes('/track/')) {
          const packageCode = url.split('/track/')[1];
          navigationParams = { code: packageCode }; // FIXED: Use consistent 'code' parameter
        }
      } else if (notification.package?.code) {
        navigationParams = { code: notification.package.code }; // FIXED: Use consistent 'code' parameter
      }
      
      // Navigate if we have parameters
      if (navigationParams) {
        NavigationHelper.navigateTo('/(drawer)/track', {
          params: navigationParams,
          trackInHistory: true
        });
      }
      
      // FIXED: Mark as read without delay if not already read
      if (!notification.read) {
        markAsRead(notification.id);
      }
      
    } catch (error) {
      console.error('🔔 Navigation error:', error);
      showToast('Failed to navigate', 'error');
    } finally {
      // FIXED: Remove pressed state after a short delay
      setTimeout(() => {
        setPressedNotifications(prev => {
          const newSet = new Set(prev);
          newSet.delete(notification.id);
          return newSet;
        });
      }, 1000);
    }
  };

  // Enhanced icon mapping with proper general notification support
  const getNotificationIcon = (type: string, iconName?: string) => {
    if (iconName && iconName !== 'notifications') {
      return iconName as keyof typeof Feather.glyphMap;
    }

    switch (type) {
      case 'package_created':
      case 'package_rejected':
      case 'package_expired':
      case 'package_delivered':
      case 'package_collected':
        return 'package';
      case 'package_submitted':
        return 'send';
      case 'payment_received':
      case 'payment_reminder':
        return 'credit-card';
      case 'final_warning':
      case 'resubmission_available':
        return 'alert-triangle';
      case 'general':
        return 'bell';
      default:
        return 'bell';
    }
  };

  // Get notification color based on type and read status
  const getNotificationColor = (type: string, read: boolean) => {
    if (read) return '#a78bfa';

    switch (type) {
      case 'package_delivered':
      case 'package_collected':
        return '#10b981';
      case 'package_rejected':
      case 'package_expired':
        return '#ef4444';
      case 'final_warning':
      case 'resubmission_available':
        return '#f59e0b';
      case 'payment_received':
      case 'payment_reminder':
        return '#c084fc';
      case 'general':
        return '#8b5cf6';
      default:
        return '#8b5cf6';
    }
  };

  // Format time display
  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInHours * 60);
        return `${diffInMinutes}m ago`;
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      }
    } catch {
      return timeString;
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (pagination && currentPage < pagination.total_pages && !loadingMore) {
      fetchNotifications(currentPage + 1);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setCurrentPage(1);
    fetchNotifications(1, true);
  };

  // Handle filter change
  const handleFilterChange = (newFilter: 'all' | 'unread') => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  // Load notifications on mount and filter change
  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  // FIXED: Render notification item with proper state management
  const renderNotificationItem = ({ item }: { item: NotificationData }) => {
    // FIXED: Extra safety checks with better error handling
    if (!item || typeof item.id === 'undefined') {
      console.warn('🔔 Invalid notification item detected, skipping render');
      return null;
    }

    // FIXED: Ensure required fields exist with fallbacks
    const title = item.title || 'No Title';
    const message = item.message || 'No Message';
    
    const isRead = isNotificationRead(item);
    const isPressed = isNotificationPressed(item.id);
    const isBeingMarkedAsRead = markingAsRead.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !isRead && styles.unreadCard,
          item.expired && styles.expiredCard,
          isPressed && styles.pressedCard, // FIXED: Add pressed state visual feedback
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
        disabled={isPressed || isBeingMarkedAsRead} // FIXED: Prevent multiple presses
      >
        <View style={styles.notificationContent}>
          {/* Icon and status indicator */}
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconBackground,
                { backgroundColor: getNotificationColor(item.notification_type, isRead) + '40' }
              ]}
            >
              <Feather
                name={getNotificationIcon(item.notification_type, item.icon)}
                size={20}
                color={getNotificationColor(item.notification_type, isRead)}
              />
            </View>
            {!isRead && <View style={styles.unreadIndicator} />}
            {/* FIXED: Add loading indicator for marking as read */}
            {isBeingMarkedAsRead && (
              <View style={styles.loadingIndicator}>
                <ActivityIndicator size={12} color="#c084fc" />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <Text style={[styles.title, !isRead && styles.unreadTitle]}>
              {title}
            </Text>
            <Text style={[styles.message, !isRead && styles.unreadMessage]}>
              {message}
            </Text>
            
            {/* Package info if available */}
            {item.package && (
              <View style={styles.packageInfo}>
                <Feather name="package" size={12} color="#c4b5fd" />
                <Text style={styles.packageCode}>{item.package.code}</Text>
                <View style={styles.packageStateBadge}>
                  <Text style={styles.packageStateText}>{item.package.state_display}</Text>
                </View>
              </View>
            )}

            {/* Time and priority */}
            <View style={styles.metaContainer}>
              <Text style={styles.timeText}>
                {item.time_since_creation || formatTime(item.created_at)}
              </Text>
              {item.priority === 'high' && (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>High</Text>
                </View>
              )}
              {item.priority === 'urgent' && (
                <View style={[styles.priorityBadge, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Text style={[styles.priorityText, { color: '#ef4444' }]}>Urgent</Text>
                </View>
              )}
              {item.expired && (
                <View style={styles.expiredBadge}>
                  <Text style={styles.expiredText}>Expired</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="bell-off" size={48} color="#a78bfa" />
      </View>
      <Text style={styles.emptyTitle}>
        {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'unread' 
          ? 'All caught up! No new notifications to show.'
          : 'You\'ll see your notifications here when you receive them.'
        }
      </Text>
    </View>
  );

  // Render error state
  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
      </View>
      <Text style={styles.emptyTitle}>Unable to Load Notifications</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications(1, true)}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  // Render footer for loading more
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#c084fc" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  // Render toast
  const renderToast = () => (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: toastType === 'success' ? '#10b981' : '#ef4444',
          transform: [{ translateY: toastAnim }],
        },
      ]}
    >
      <Feather
        name={toastType === 'success' ? 'check-circle' : 'x-circle'}
        size={16}
        color="white"
      />
      <Text style={styles.toastText}>{toastMessage}</Text>
    </Animated.View>
  );

  const unreadCount = Array.isArray(notifications) 
    ? notifications.filter(n => !isNotificationRead(n)).length 
    : 0;

  return (
    <View style={styles.container}>
      <GLTHeader 
        title="Notifications" 
        showBackButton={true}
        onBackPress={() => NavigationHelper.goBack()}
      />
      
      <LinearGradient colors={getGradientColors()} style={styles.gradient}>
        {/* Filter and Actions Bar */}
        <View style={styles.filterContainer}>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.activeFilterButton]}
              onPress={() => handleFilterChange('all')}
            >
              <Text style={[styles.filterButtonText, filter === 'all' && styles.activeFilterButtonText]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'unread' && styles.activeFilterButton]}
              onPress={() => handleFilterChange('unread')}
            >
              <Text style={[styles.filterButtonText, filter === 'unread' && styles.activeFilterButtonText]}>
                Unread ({unreadCount})
              </Text>
            </TouchableOpacity>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <Feather name="check-square" size={16} color="#c084fc" />
              <Text style={styles.markAllButtonText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Firebase Token Status */}
        {fcmToken && (
          <View style={styles.pushTokenStatus}>
            <Feather name="bell" size={12} color="#10b981" />
            <Text style={styles.pushTokenText}>Push notifications enabled</Text>
          </View>
        )}

        {/* Notifications List */}
        {loading && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c084fc" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : error ? (
          renderErrorState()
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => `notification-${item.id}`}
            contentContainerStyle={[
              styles.listContainer,
              notifications.length === 0 && styles.emptyListContainer
            ]}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#c084fc']}
                tintColor="#c084fc"
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={10}
            // FIXED: Add key prop to force re-render when notifications change
            key={`notifications-${filter}-${notifications.length}`}
          />
        )}
      </LinearGradient>

      {/* Toast */}
      {renderToast()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b3d',
  },
  gradient: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(138, 92, 246, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 123, 250, 0.3)',
  },
  filterButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(138, 92, 246, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeFilterButton: {
    backgroundColor: '#8b5cf6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#c4b5fd',
  },
  activeFilterButtonText: {
    color: 'white',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.4)',
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#c084fc',
  },
  pushTokenStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  pushTokenText: {
    fontSize: 12,
    color: '#10b981',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  emptyListContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  notificationCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.2)',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#c084fc',
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
  },
  expiredCard: {
    opacity: 0.6,
  },
  // FIXED: Add pressed card style for visual feedback
  pressedCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
    transform: [{ scale: 0.98 }],
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
    position: 'relative',
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c084fc',
  },
  // FIXED: Add loading indicator for marking as read
  loadingIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(192, 132, 252, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  unreadTitle: {
    color: '#f3f4f6',
  },
  message: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 20,
    marginBottom: 8,
  },
  unreadMessage: {
    color: '#ddd6fe',
  },
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  packageCode: {
    fontSize: 12,
    fontWeight: '500',
    color: '#c4b5fd',
  },
  packageStateBadge: {
    backgroundColor: 'rgba(192, 132, 252, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packageStateText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#c084fc',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#a78bfa',
  },
  priorityBadge: {
    backgroundColor: 'rgba(251, 146, 60, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fb923c',
  },
  expiredBadge: {
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiredText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  toast: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});
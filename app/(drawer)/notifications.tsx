// app/(drawer)/notifications.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Platform,
  Modal,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GLTHeader from '../../components/GLTHeader';
import api from '../../lib/api';
import { NavigationHelper } from '../../lib/helpers/navigation';
import ActionCableService from '../../lib/services/ActionCableService';
import { accountManager } from '../../lib/AccountManager';

interface NotificationData {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  priority: string;
  read: boolean;
  created_at: string;
  time_since_creation: string;
  icon: string;
  action_url?: string;
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

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const CustomModal: React.FC<CustomModalProps> = ({ visible, title, message, type = 'info', onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'x-circle';
      default: return 'info';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#8b5cf6';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <LinearGradient colors={['#2d1b4e', '#1a1b3d']} style={modalStyles.gradient}>
            <View style={modalStyles.iconContainer}>
              <View style={[modalStyles.iconCircle, { backgroundColor: getIconColor() + '20' }]}>
                <Feather name={getIcon()} size={32} color={getIconColor()} />
              </View>
            </View>
            <Text style={modalStyles.title}>{title}</Text>
            <Text style={modalStyles.message}>{message}</Text>
            <TouchableOpacity style={modalStyles.button} onPress={onClose}>
              <Text style={modalStyles.buttonText}>OK</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

type CategoryType = 'all' | 'customer_care' | 'packages' | 'updates';

export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<NotificationsPagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [category, setCategory] = useState<CategoryType>('all');
  const [error, setError] = useState<string | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const subscriptionsSetup = useRef(false);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);

  const viewableItemsRef = useRef<Set<number>>(new Set());
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markedAsReadRef = useRef<Set<number>>(new Set());
  const initialMarkingDone = useRef(false);

  const [customModal, setCustomModal] = useState<CustomModalProps>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    onClose: () => {},
  });

  const toastAnim = useRef(new Animated.Value(-100)).current;
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showCustomModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setCustomModal({
      visible: true,
      title,
      message,
      type,
      onClose: () => setCustomModal(prev => ({ ...prev, visible: false })),
    });
  };

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

  const setupActionCable = useCallback(async () => {
    if (subscriptionsSetup.current) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

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
      console.error('Failed to setup ActionCable:', error);
      setIsConnected(false);
    }
  }, []);

  const setupSubscriptions = () => {
    if (!actionCableRef.current) return;

    actionCableSubscriptions.current.forEach(unsub => unsub());
    actionCableSubscriptions.current = [];

    const actionCable = actionCableRef.current;

    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    const unsubNewNotification = actionCable.subscribe('new_notification', (data) => {
      if (data.notification) {
        setNotifications(prev => {
          const exists = prev.some(n => n.id === data.notification.id);
          if (exists) return prev;
          return [data.notification, ...prev];
        });
        showToast('New notification received', 'success');
      }
    });
    actionCableSubscriptions.current.push(unsubNewNotification);

    const unsubNotificationRead = actionCable.subscribe('notification_read', (data) => {
      if (data.notification_id) {
        setNotifications(prev =>
          prev.map(n => {
            if (n.id === data.notification_id) {
              return { ...n, read: true };
            }
            return n;
          })
        );
      }
    });
    actionCableSubscriptions.current.push(unsubNotificationRead);

    const unsubAllRead = actionCable.subscribe('all_notifications_read', () => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    });
    actionCableSubscriptions.current.push(unsubAllRead);
  };

  useEffect(() => {
    setupActionCable();
    
    return () => {
      subscriptionsSetup.current = false;
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];
      
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [setupActionCable]);

  const fetchNotifications = useCallback(async (page = 1, refresh = false) => {
    try {
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
        category: category !== 'all' ? category : undefined,
      };

      const response = await api.get('/api/v1/notifications', {
        params,
        timeout: 15000,
      });

      if (response.data?.success) {
        const newNotifications = response.data.data || [];
        
        if (refresh || page === 1) {
          setNotifications(newNotifications);
          initialMarkingDone.current = false;
        } else {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id));
            return [...prev, ...uniqueNew];
          });
        }
        
        setPagination(response.data.pagination || null);
        setCurrentPage(page);
      } else {
        setError('Failed to load notifications');
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setError('Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [category]);

  useEffect(() => {
    fetchNotifications(1);
  }, [category]);

  useEffect(() => {
    if (isConnected && notifications.length > 0 && !loading && !initialMarkingDone.current) {
      const timer = setTimeout(() => {
        if (viewableItemsRef.current.size > 0) {
          markVisibleNotificationsAsRead();
          initialMarkingDone.current = true;
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, notifications.length, loading]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const currentViewableIds = new Set(
      viewableItems
        .map(item => item.item?.id)
        .filter((id): id is number => typeof id === 'number')
    );

    viewableItemsRef.current = currentViewableIds;

    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current);
    }

    markAsReadTimeoutRef.current = setTimeout(() => {
      markVisibleNotificationsAsRead();
    }, 1500);
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
  }).current;

  const markVisibleNotificationsAsRead = async () => {
    const unreadVisibleIds = Array.from(viewableItemsRef.current).filter(id => {
      if (markedAsReadRef.current.has(id)) return false;
      
      const notification = notifications.find(n => n.id === id);
      return notification && !notification.read;
    });

    if (unreadVisibleIds.length === 0) return;

    try {
      // Mark in ref first to prevent duplicate marking
      unreadVisibleIds.forEach(id => markedAsReadRef.current.add(id));

      // Update state with proper deep clone
      setNotifications(prev =>
        prev.map(n => {
          if (unreadVisibleIds.includes(n.id)) {
            // Deep clone to prevent reference issues
            return {
              ...n,
              read: true,
              // Explicitly preserve all fields
              id: n.id,
              title: n.title,
              message: n.message,
              notification_type: n.notification_type,
              priority: n.priority,
              created_at: n.created_at,
              time_since_creation: n.time_since_creation,
              icon: n.icon,
              action_url: n.action_url,
              expired: n.expired,
              package: n.package ? { ...n.package } : undefined,
            };
          }
          return n;
        })
      );

      await api.post('/api/v1/notifications/mark_visible_as_read', {
        notification_ids: unreadVisibleIds,
      });

      console.log(`✓ Marked ${unreadVisibleIds.length} notifications as read`);
    } catch (error) {
      console.error('Failed to mark visible notifications as read:', error);
      
      // Revert on error
      setNotifications(prev =>
        prev.map(n => {
          if (unreadVisibleIds.includes(n.id)) {
            return { ...n, read: false };
          }
          return n;
        })
      );
      
      unreadVisibleIds.forEach(id => markedAsReadRef.current.delete(id));
    }
  };

  const handleNotificationPress = (notification: NotificationData) => {
    try {
      let navigationParams: any = null;
      
      if (notification.action_url) {
        const url = notification.action_url;
        
        if (url.includes('/track/')) {
          const packageCode = url.split('/track/')[1];
          navigationParams = { code: packageCode };
        }
      } else if (notification.package?.code) {
        navigationParams = { code: notification.package.code };
      }
      
      if (navigationParams) {
        NavigationHelper.navigateTo('/(drawer)/track', {
          params: navigationParams,
          trackInHistory: true
        });
      }
      
    } catch (error) {
      console.error('Navigation error:', error);
      showCustomModal('Error', 'Failed to navigate', 'error');
    }
  };

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
      case 'support':
      case 'message':
        return 'message-circle';
      case 'system':
      case 'announcement':
        return 'info';
      default:
        return 'bell';
    }
  };

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
      case 'support':
      case 'message':
        return '#3b82f6';
      default:
        return '#8b5cf6';
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInHours * 60);
        return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
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

  const handleLoadMore = () => {
    if (pagination && currentPage < pagination.total_pages && !loadingMore) {
      fetchNotifications(currentPage + 1);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    markedAsReadRef.current.clear();
    initialMarkingDone.current = false;
    fetchNotifications(1, true);
  };

  const handleCategoryChange = (newCategory: CategoryType) => {
    setCategory(newCategory);
    setCurrentPage(1);
    markedAsReadRef.current.clear();
    initialMarkingDone.current = false;
  };

  const renderNotificationItem = ({ item }: { item: NotificationData }) => {
    // Defensive checks to prevent blank rendering
    if (!item || typeof item.id === 'undefined') {
      return null;
    }

    // Ensure we have valid data with fallbacks
    const title = item.title || 'Notification';
    const message = item.message || '';
    const isRead = item.read === true;
    const notificationType = item.notification_type || 'system';
    const icon = getNotificationIcon(notificationType, item.icon);
    const color = getNotificationColor(notificationType, isRead);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !isRead && styles.unreadCard,
          item.expired && styles.expiredCard,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconBackground,
                { backgroundColor: color + '40' }
              ]}
            >
              <Feather
                name={icon}
                size={20}
                color={color}
              />
            </View>
            {!isRead && <View style={styles.unreadIndicator} />}
          </View>

          <View style={styles.contentContainer}>
            <Text style={[styles.title, !isRead && styles.unreadTitle]}>
              {title}
            </Text>
            <Text style={[styles.message, !isRead && styles.unreadMessage]} numberOfLines={2}>
              {message}
            </Text>
            
            {item.package && item.package.code && (
              <View style={styles.packageInfo}>
                <Feather name="package" size={12} color="#c4b5fd" />
                <Text style={styles.packageCode}>{item.package.code}</Text>
                <View style={styles.packageStateBadge}>
                  <Text style={styles.packageStateText}>{item.package.state_display || 'Unknown'}</Text>
                </View>
              </View>
            )}

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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="bell-off" size={48} color="#a78bfa" />
      </View>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        {category === 'all' 
          ? 'You\'ll see your notifications here when you receive them.'
          : `No ${category.replace('_', ' ')} notifications at this time.`
        }
      </Text>
    </View>
  );

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

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#c084fc" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

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

  const unreadCount = notifications.filter(n => n && n.read === false).length;

  return (
    <View style={styles.container}>
      <GLTHeader 
        title="Notifications" 
        showBackButton={true}
        onBackPress={() => NavigationHelper.goBack()}
      />
      
      <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.gradient}>
        <View style={styles.categoryContainer}>
          <View style={styles.categoryTabs}>
            <TouchableOpacity
              style={[styles.categoryTab, category === 'all' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('all')}
            >
              <Feather 
                name="grid" 
                size={16} 
                color={category === 'all' ? '#fff' : '#c4b5fd'} 
              />
              <Text style={[styles.categoryTabText, category === 'all' && styles.activeCategoryTabText]}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, category === 'customer_care' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('customer_care')}
            >
              <Feather 
                name="message-circle" 
                size={16} 
                color={category === 'customer_care' ? '#fff' : '#c4b5fd'} 
              />
              <Text style={[styles.categoryTabText, category === 'customer_care' && styles.activeCategoryTabText]}>
                Support
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, category === 'packages' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('packages')}
            >
              <Feather 
                name="package" 
                size={16} 
                color={category === 'packages' ? '#fff' : '#c4b5fd'} 
              />
              <Text style={[styles.categoryTabText, category === 'packages' && styles.activeCategoryTabText]}>
                Packages
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, category === 'updates' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('updates')}
            >
              <Feather 
                name="info" 
                size={16} 
                color={category === 'updates' ? '#fff' : '#c4b5fd'} 
              />
              <Text style={[styles.categoryTabText, category === 'updates' && styles.activeCategoryTabText]}>
                Updates
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isConnected && (
          <View style={styles.connectionStatus}>
            <Feather name="wifi" size={12} color="#10b981" />
            <Text style={styles.connectionText}>Live</Text>
          </View>
        )}

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
            keyExtractor={(item) => `notification-${item?.id || Math.random()}`}
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
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === 'android'}
            windowSize={10}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
          />
        )}
      </LinearGradient>

      {renderToast()}
      <CustomModal {...customModal} />
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
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(138, 92, 246, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 123, 250, 0.3)',
  },
  categoryTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(138, 92, 246, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  activeCategoryTab: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  activeCategoryTabText: {
    color: '#fff',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  connectionText: {
    fontSize: 11,
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

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
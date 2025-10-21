// app/(rider)/notifications.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import ActionCableService from '../../lib/services/ActionCableService';
import { accountManager } from '../../lib/AccountManager';
import { NavigationHelper } from '../../lib/helpers/navigation';

interface Notification {
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
  data?: any;
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

type CategoryType = 'all' | 'deliveries' | 'assignments' | 'system';

export default function RiderNotificationsScreen() {
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
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
      };

      if (category === 'deliveries') {
        params.type = 'delivery,package_delivered,package_collected';
      } else if (category === 'assignments') {
        params.type = 'assignment';
      } else if (category === 'system') {
        params.type = 'system,announcement,update';
      }

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
              data: n.data,
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

  const handleNotificationPress = (notification: Notification) => {
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
      } else if (notification.data?.package_code) {
        navigationParams = { code: notification.data.package_code };
      }
      
      if (navigationParams) {
        NavigationHelper.navigateTo('/(drawer)/track', {
          params: navigationParams,
          trackInHistory: true
        });
      } else if (notification.notification_type === 'assignment') {
        router.push('/(rider)/');
      }
      
    } catch (error) {
      console.error('Navigation error:', error);
      showCustomModal('Error', 'Failed to navigate', 'error');
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
      case 'delivery':
        return 'check-circle';
      case 'assignment':
        return 'clipboard';
      case 'alert':
        return 'alert-circle';
      case 'system':
      case 'announcement':
        return 'info';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: string, read: boolean) => {
    if (read) return '#8E8E93';

    switch (type) {
      case 'package_delivered':
      case 'package_collected':
      case 'delivery':
        return '#34C759';
      case 'package_rejected':
      case 'package_expired':
      case 'alert':
        return '#FF3B30';
      case 'final_warning':
      case 'resubmission_available':
        return '#FF9800';
      case 'payment_received':
      case 'payment_reminder':
        return '#7B3F98';
      case 'assignment':
        return '#FF9500';
      case 'system':
      case 'announcement':
        return '#007AFF';
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
        if (diffInDays < 7) return `${diffInDays}d ago`;
        return date.toLocaleDateString();
      }
    } catch {
      return timeString;
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
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
          styles.notificationItem,
          !isRead && styles.notificationItemUnread,
          item.expired && styles.expiredCard,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconBackground, { backgroundColor: color + '20' }]}>
              <Feather name={icon} size={20} color={color} />
            </View>
            {!isRead && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.notificationHeader}>
              <Text style={[styles.notificationTitle, !isRead && styles.unreadTitle]}>
                {title}
              </Text>
            </View>
            
            <Text style={[styles.notificationMessage, !isRead && styles.unreadMessage]} numberOfLines={2}>
              {message}
            </Text>
            
            {item.package && item.package.code && (
              <View style={styles.packageInfo}>
                <Feather name="package" size={12} color="#7B3F98" />
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
                <View style={[styles.priorityBadge, { backgroundColor: '#FF3B3020' }]}>
                  <Text style={[styles.priorityText, { color: '#FF3B30' }]}>Urgent</Text>
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
        <Feather name="bell-off" size={48} color="#8E8E93" />
      </View>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        {category === 'all' 
          ? 'You\'ll see your notifications here when you receive them.'
          : `No ${category} notifications at this time.`
        }
      </Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="alert-circle" size={48} color="#FF3B30" />
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
        <ActivityIndicator size="small" color="#7B3F98" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderToast = () => (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: toastType === 'success' ? '#34C759' : '#FF3B30',
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
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.backButton} />
        </View>
      </LinearGradient>

      <View style={styles.categorySection}>
        <View style={styles.categoryContainer}>
          <View style={styles.categoryTabs}>
            <TouchableOpacity
              style={[styles.categoryTab, category === 'all' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('all')}
            >
              <Feather 
                name="grid" 
                size={14} 
                color={category === 'all' ? '#fff' : '#B8B8B8'} 
              />
              <Text style={[styles.categoryTabText, category === 'all' && styles.activeCategoryTabText]}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, category === 'deliveries' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('deliveries')}
            >
              <Feather 
                name="package" 
                size={14} 
                color={category === 'deliveries' ? '#fff' : '#B8B8B8'} 
              />
              <Text style={[styles.categoryTabText, category === 'deliveries' && styles.activeCategoryTabText]}>
                Deliveries
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, category === 'assignments' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('assignments')}
            >
              <Feather 
                name="clipboard" 
                size={14} 
                color={category === 'assignments' ? '#fff' : '#B8B8B8'} 
              />
              <Text style={[styles.categoryTabText, category === 'assignments' && styles.activeCategoryTabText]}>
                Tasks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, category === 'system' && styles.activeCategoryTab]}
              onPress={() => handleCategoryChange('system')}
            >
              <Feather 
                name="info" 
                size={14} 
                color={category === 'system' ? '#fff' : '#B8B8B8'} 
              />
              <Text style={[styles.categoryTabText, category === 'system' && styles.activeCategoryTabText]}>
                System
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isConnected && (
          <View style={styles.connectionStatus}>
            <Feather name="wifi" size={12} color="#34C759" />
            <Text style={styles.connectionText}>Live</Text>
          </View>
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
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
              colors={['#7B3F98']}
              tintColor="#7B3F98"
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

      {renderToast()}
      <CustomModal {...customModal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categorySection: {
    backgroundColor: '#1F2C34',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#2d3748',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  activeCategoryTab: {
    backgroundColor: '#7B3F98',
    borderColor: '#7B3F98',
  },
  categoryTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B8B8B8',
  },
  activeCategoryTabText: {
    color: '#fff',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  connectionText: {
    fontSize: 11,
    color: '#34C759',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#B8B8B8',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyListContainer: {
    flex: 1,
  },
  notificationItem: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  notificationItemUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#7B3F98',
    backgroundColor: '#252F3A',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7B3F98',
  },
  contentContainer: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  unreadTitle: {
    color: '#fff',
  },
  notificationMessage: {
    color: '#B8B8B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  unreadMessage: {
    color: '#D0D0D0',
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
    color: '#7B3F98',
  },
  packageStateBadge: {
    backgroundColor: 'rgba(123, 63, 152, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packageStateText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#7B3F98',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  priorityBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FF9800',
  },
  expiredBadge: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiredText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#B8B8B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#7B3F98',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
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
    color: '#fff',
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
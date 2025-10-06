// app/(agent)/notifications.tsx - Agent notifications with ActionCable
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
  Modal,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
      default: return '#FF6B35';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <LinearGradient colors={['#FF6B35', '#F7931E']} style={modalStyles.gradient}>
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

export default function AgentNotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<NotificationsPagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const subscriptionsSetup = useRef(false);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);

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
          prev.map(n => n.id === data.notification_id ? { ...n, read: true } : n)
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

      if (filter === 'unread') {
        params.unread_only = 'true';
      }

      const response = await api.get('/api/v1/notifications', {
        params,
        timeout: 15000,
      });

      if (response.data?.success) {
        const newNotifications = response.data.data || [];
        
        if (refresh || page === 1) {
          setNotifications(newNotifications);
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
  }, [filter]);

  useEffect(() => {
    fetchNotifications(1);
  }, [filter]);

  const markAsRead = async (notificationId: number) => {
    try {
      const notificationToUpdate = notifications.find(n => n.id === notificationId);
      if (!notificationToUpdate || notificationToUpdate.read) return;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );

      if (isConnected && actionCableRef.current) {
        await actionCableRef.current.markNotificationRead(notificationId);
      } else {
        await api.patch(`/api/v1/notifications/${notificationId}/mark_as_read`);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      const previousNotifications = [...notifications];
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      const response = await api.patch('/api/v1/notifications/mark_all_as_read');
      
      if (response.data?.success) {
        showToast('All notifications marked as read', 'success');
      } else {
        setNotifications(previousNotifications);
        showCustomModal('Error', 'Failed to mark all as read', 'error');
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      showCustomModal('Error', 'Failed to mark all as read', 'error');
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
      
      if (!notification.read) {
        markAsRead(notification.id);
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
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: string, read: boolean) => {
    if (read) return '#999';

    switch (type) {
      case 'package_delivered':
      case 'package_collected':
        return '#4CAF50';
      case 'package_rejected':
      case 'package_expired':
        return '#ef4444';
      default:
        return '#FF6B35';
    }
  };

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

  const handleLoadMore = () => {
    if (pagination && currentPage < pagination.total_pages && !loadingMore) {
      fetchNotifications(currentPage + 1);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    fetchNotifications(1, true);
  };

  const handleFilterChange = (newFilter: 'all' | 'unread') => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const renderNotificationItem = ({ item }: { item: NotificationData }) => {
    if (!item || typeof item.id === 'undefined') {
      return null;
    }

    const title = item.title || 'No Title';
    const message = item.message || 'No Message';
    const isRead = item.read;

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
          </View>

          <View style={styles.contentContainer}>
            <Text style={[styles.title, !isRead && styles.unreadTitle]}>
              {title}
            </Text>
            <Text style={[styles.message, !isRead && styles.unreadMessage]}>
              {message}
            </Text>
            
            {item.package && (
              <View style={styles.packageInfo}>
                <Feather name="package" size={12} color="#999" />
                <Text style={styles.packageCode}>{item.package.code}</Text>
                <View style={styles.packageStateBadge}>
                  <Text style={styles.packageStateText}>{item.package.state_display}</Text>
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
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="bell-off" size={48} color="#FF6B35" />
      </View>
      <Text style={styles.emptyTitle}>
        {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'unread' 
          ? 'All caught up! No new notifications to show.'
          : 'You\'ll see your package notifications here.'
        }
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderToast = () => (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: toastType === 'success' ? '#4CAF50' : '#ef4444',
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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#FF6B35', '#F7931E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

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
            <Feather name="check-square" size={16} color="#FF6B35" />
            <Text style={styles.markAllButtonText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isConnected && (
        <View style={styles.connectionStatus}>
          <Feather name="wifi" size={12} color="#4CAF50" />
          <Text style={styles.connectionText}>Live updates enabled</Text>
        </View>
      )}

      {loading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.emptyTitle}>Unable to Load</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications(1, true)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
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
              colors={['#FF6B35']}
              tintColor="#FF6B35"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  filterButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 8,
    padding: 2,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeFilterButton: {
    backgroundColor: '#FF6B35',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
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
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF6B35',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  connectionText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  listContainer: {
    paddingHorizontal: 16,
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
    color: '#666',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
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
    backgroundColor: '#FF6B35',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  unreadTitle: {
    color: '#000',
  },
  message: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginBottom: 8,
  },
  unreadMessage: {
    color: '#666',
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
    color: '#666',
  },
  packageStateBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packageStateText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FF6B35',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
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
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF6B35',
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
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    opacity: 0.9,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
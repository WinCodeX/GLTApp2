// app/(drawer)/notifications.tsx - Fixed notifications screen with proper error handling

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import GLTHeader from '../../components/GLTHeader';
import colors from '../../theme/colors';
import api from '../../lib/api';
import { NavigationHelper } from '../../lib/helpers/navigation';

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

  // Safe gradient colors with fallback
  const getGradientColors = () => {
    if (colors?.gradientBackground && Array.isArray(colors.gradientBackground)) {
      return colors.gradientBackground;
    }
    // Fallback gradient colors
    return ['#f3f4f6', '#e5e7eb'];
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
        } else {
          // Append new notifications for pagination
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

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      console.log('🔔 Marking notification as read:', notificationId);
      
      const response = await api.patch(`/api/v1/notifications/${notificationId}/mark_as_read`);
      
      if (response.data && response.data.success) {
        // Update the notification in the local state
        setNotifications(prev => {
          if (!Array.isArray(prev)) return prev;
          return prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          );
        });
      }
    } catch (error) {
      console.error('🔔 Failed to mark notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      console.log('🔔 Marking all notifications as read');
      
      const response = await api.patch('/api/v1/notifications/mark_all_as_read');
      
      if (response.data && response.data.success) {
        // Update all notifications in the local state
        setNotifications(prev => {
          if (!Array.isArray(prev)) return prev;
          return prev.map(notification => ({ ...notification, read: true }));
        });
        
        Alert.alert('Success', 'All notifications marked as read');
      }
    } catch (error) {
      console.error('🔔 Failed to mark all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read');
    }
  };

  // Handle notification press
  const handleNotificationPress = async (notification: NotificationData) => {
    // Mark as read if not already read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to related content if action_url is provided
    if (notification.action_url) {
      try {
        // Extract route from action_url
        const url = notification.action_url;
        
        if (url.includes('/track/')) {
          // Package tracking URL
          const packageCode = url.split('/track/')[1];
          await NavigationHelper.navigateTo('/(drawer)/track', {
            params: { code: packageCode },
            trackInHistory: true
          });
        } else if (notification.package?.code) {
          // Navigate to package details
          await NavigationHelper.navigateTo('/(drawer)/track', {
            params: { code: notification.package.code },
            trackInHistory: true
          });
        }
      } catch (error) {
        console.error('🔔 Navigation error:', error);
      }
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string, iconName?: string) => {
    if (iconName) {
      return iconName as keyof typeof Feather.glyphMap;
    }

    switch (type) {
      case 'package_created':
        return 'package';
      case 'package_submitted':
        return 'send';
      case 'package_delivered':
        return 'check-circle';
      case 'package_rejected':
        return 'x-circle';
      case 'payment_received':
        return 'credit-card';
      case 'final_warning':
        return 'alert-triangle';
      case 'general':
        return 'info';
      default:
        return 'bell';
    }
  };

  // Get notification color based on type and read status
  const getNotificationColor = (type: string, read: boolean) => {
    if (read) return '#64748b'; // Gray for read notifications

    switch (type) {
      case 'package_delivered':
        return '#10b981'; // Green
      case 'package_rejected':
        return '#ef4444'; // Red
      case 'final_warning':
        return '#f59e0b'; // Amber
      case 'payment_received':
        return '#8b5cf6'; // Purple
      default:
        return '#3b82f6'; // Blue
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

  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationData }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.read && styles.unreadCard,
        item.expired && styles.expiredCard,
      ]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        {/* Icon and status indicator */}
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconBackground,
              { backgroundColor: getNotificationColor(item.notification_type, item.read) + '20' }
            ]}
          >
            <Feather
              name={getNotificationIcon(item.notification_type, item.icon)}
              size={20}
              color={getNotificationColor(item.notification_type, item.read)}
            />
          </View>
          {!item.read && <View style={styles.unreadIndicator} />}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <Text style={[styles.title, !item.read && styles.unreadTitle]}>
            {item.title}
          </Text>
          <Text style={[styles.message, !item.read && styles.unreadMessage]}>
            {item.message}
          </Text>
          
          {/* Package info if available */}
          {item.package && (
            <View style={styles.packageInfo}>
              <Feather name="package" size={12} color="#64748b" />
              <Text style={styles.packageCode}>{item.package.code}</Text>
              <View style={styles.packageStateBadge}>
                <Text style={styles.packageStateText}>{item.package.state_display}</Text>
              </View>
            </View>
          )}

          {/* Time and priority */}
          <View style={styles.metaContainer}>
            <Text style={styles.timeText}>
              {formatTime(item.created_at)}
            </Text>
            {item.priority === 'high' && (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>High</Text>
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

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="bell-off" size={48} color="#64748b" />
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
        <ActivityIndicator size="small" color={colors?.primary || '#3b82f6'} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;

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
              <Feather name="check-square" size={16} color={colors?.primary || '#3b82f6'} />
              <Text style={styles.markAllButtonText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications List */}
        {loading && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors?.primary || '#3b82f6'} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : error ? (
          renderErrorState()
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id.toString()}
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
                colors={[colors?.primary || '#3b82f6']}
                tintColor={colors?.primary || '#3b82f6'}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            showsVerticalScrollIndicator={false}
          />
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors?.background || '#f9fafb',
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 2,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeFilterButton: {
    backgroundColor: colors?.primary || '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
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
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors?.primary || '#3b82f6',
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
    color: '#64748b',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors?.primary || '#3b82f6',
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
    backgroundColor: colors?.primary || '#3b82f6',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  unreadTitle: {
    color: '#111827',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
  },
  unreadMessage: {
    color: '#374151',
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
    color: '#64748b',
  },
  packageStateBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packageStateText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors?.primary || '#3b82f6',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  priorityBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ef4444',
  },
  expiredBadge: {
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiredText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors?.primary || '#3b82f6',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});
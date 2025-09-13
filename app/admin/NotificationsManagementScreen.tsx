// app/admin/NotificationsManagementScreen.tsx - Admin Notifications Management
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { NavigationHelper } from '../../lib/helpers/navigation';

const { width, height } = Dimensions.get('window');

interface NotificationData {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  priority: number;
  read: boolean;
  delivered: boolean;
  created_at: string;
  expires_at?: string;
  icon?: string;
  action_url?: string;
  status: string;
  user: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
  };
  package?: {
    id: number;
    code: string;
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  delivered: number;
  pending: number;
  expired: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

interface FilterOptions {
  type: string;
  status: string;
  priority: string;
  read_status: string;
  search: string;
}

const NOTIFICATION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'general', label: 'General' },
  { value: 'package_rejected', label: 'Package Rejected' },
  { value: 'package_expired', label: 'Package Expired' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'package_delivered', label: 'Package Delivered' },
  { value: 'package_collected', label: 'Package Collected' },
  { value: 'resubmission_available', label: 'Resubmission Available' },
  { value: 'final_warning', label: 'Final Warning' },
];

const PRIORITY_LEVELS = [
  { value: '', label: 'All Priorities' },
  { value: '0', label: 'Normal' },
  { value: '1', label: 'High' },
  { value: '2', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

const READ_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread Only' },
  { value: 'read', label: 'Read Only' },
];

export default function NotificationsManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<NotificationData[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    type: '',
    status: '',
    priority: '',
    read_status: '',
    search: '',
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [notifications, filters]);

  const loadNotifications = async (page = 1, append = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      console.log(`📢 Loading notifications - page ${page}`);
      
      const response = await api.get('/api/v1/admin/notifications', {
        params: {
          page,
          per_page: 20,
        },
        timeout: 15000,
      });

      if (response.data?.success) {
        const newNotifications = response.data.data || [];
        const pagination = response.data.pagination || {};
        
        if (append) {
          setNotifications(prev => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
        }
        
        setCurrentPage(page);
        setHasMore(page < (pagination.total_pages || 1));
        setTotalCount(pagination.total_count || 0);
        
        console.log(`📢 Loaded ${newNotifications.length} notifications`);
      }
    } catch (error) {
      console.error('❌ Failed to load notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/api/v1/admin/notifications/stats');
      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('❌ Failed to load notification stats:', error);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...notifications];

    // Apply type filter
    if (filters.type) {
      filtered = filtered.filter(n => n.notification_type === filters.type);
    }

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(n => n.status === filters.status);
    }

    // Apply priority filter
    if (filters.priority) {
      filtered = filtered.filter(n => n.priority.toString() === filters.priority);
    }

    // Apply read status filter
    if (filters.read_status === 'read') {
      filtered = filtered.filter(n => n.read);
    } else if (filters.read_status === 'unread') {
      filtered = filtered.filter(n => !n.read);
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(searchLower) ||
        n.message.toLowerCase().includes(searchLower) ||
        n.user?.name?.toLowerCase().includes(searchLower) ||
        n.package?.code?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredNotifications(filtered);
  }, [notifications, filters]);

  const handleRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    loadNotifications(1);
    loadStats();
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadNotifications(currentPage + 1, true);
    }
  };

  const handleBack = async () => {
    try {
      await NavigationHelper.goBack({
        fallbackRoute: '/admin',
        replaceIfNoHistory: true
      });
    } catch (error) {
      console.error('Navigation error:', error);
      router.back();
    }
  };

  const markAsRead = async (notificationId: number, read: boolean) => {
    try {
      const endpoint = read ? 'mark_as_read' : 'mark_as_unread';
      await api.patch(`/api/v1/admin/notifications/${notificationId}/${endpoint}`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read } : n)
      );
      
      loadStats(); // Refresh stats
    } catch (error) {
      console.error('❌ Failed to update notification:', error);
      Alert.alert('Error', 'Failed to update notification');
    }
  };

  const deleteNotification = async (notificationId: number) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/v1/admin/notifications/${notificationId}`);
              
              // Remove from local state
              setNotifications(prev => prev.filter(n => n.id !== notificationId));
              loadStats(); // Refresh stats
            } catch (error) {
              console.error('❌ Failed to delete notification:', error);
              Alert.alert('Error', 'Failed to delete notification');
            }
          }
        }
      ]
    );
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 2: return '#ff6b6b'; // Urgent - Red
      case 1: return '#ffa726'; // High - Orange  
      default: return '#4caf50'; // Normal - Green
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 2: return 'Urgent';
      case 1: return 'High';
      default: return 'Normal';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return '#4caf50';
      case 'failed': return '#ff6b6b';
      case 'expired': return '#9e9e9e';
      default: return '#2196f3';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderNotificationItem = ({ item }: { item: NotificationData }) => (
    <View style={styles.notificationCard}>
      <LinearGradient
        colors={item.read ? ['#2d3748', '#1a202c'] : ['#4c51bf', '#667eea']}
        style={styles.notificationGradient}
      >
        {/* Header */}
        <View style={styles.notificationHeader}>
          <View style={styles.notificationHeaderLeft}>
            <Ionicons 
              name={item.icon as any || 'notifications'} 
              size={20} 
              color={item.read ? '#a0aec0' : 'white'} 
            />
            <View style={styles.notificationHeaderText}>
              <Text style={[styles.notificationTitle, { color: item.read ? '#e2e8f0' : 'white' }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.notificationMeta, { color: item.read ? '#a0aec0' : 'rgba(255,255,255,0.8)' }]}>
                {item.user?.name} • {formatDate(item.created_at)}
              </Text>
            </View>
          </View>
          
          <View style={styles.notificationActions}>
            <TouchableOpacity
              onPress={() => markAsRead(item.id, !item.read)}
              style={styles.actionButton}
            >
              <Ionicons 
                name={item.read ? 'mail-outline' : 'mail-open-outline'} 
                size={16} 
                color={item.read ? '#a0aec0' : 'white'} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => deleteNotification(item.id)}
              style={styles.actionButton}
            >
              <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message */}
        <Text style={[styles.notificationMessage, { color: item.read ? '#cbd5e0' : 'rgba(255,255,255,0.9)' }]} numberOfLines={2}>
          {item.message}
        </Text>

        {/* Footer */}
        <View style={styles.notificationFooter}>
          <View style={styles.notificationBadges}>
            <View style={[styles.badge, { backgroundColor: getPriorityColor(item.priority) }]}>
              <Text style={styles.badgeText}>{getPriorityLabel(item.priority)}</Text>
            </View>
            
            <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
            
            <View style={[styles.badge, { backgroundColor: '#6c5ce7' }]}>
              <Text style={styles.badgeText}>{item.notification_type}</Text>
            </View>
          </View>
          
          {item.package && (
            <Text style={[styles.packageCode, { color: item.read ? '#a0aec0' : 'rgba(255,255,255,0.8)' }]}>
              #{item.package.code}
            </Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Notifications Management</Text>
              <Text style={styles.headerSubtitle}>
                {totalCount} total • {filteredNotifications.length} filtered
              </Text>
            </View>
          </View>
          
          <TouchableOpacity onPress={() => setShowStatsModal(true)} style={styles.statsButton}>
            <Ionicons name="analytics" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const renderControls = () => (
    <View style={styles.controls}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#a0aec0" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notifications..."
          placeholderTextColor="#a0aec0"
          value={filters.search}
          onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
        />
      </View>
      
      <View style={styles.controlButtons}>
        <TouchableOpacity onPress={() => setShowFiltersModal(true)} style={styles.controlButton}>
          <LinearGradient colors={['#6c5ce7', '#a29bfe']} style={styles.controlButtonGradient}>
            <Ionicons name="filter" size={16} color="white" />
            <Text style={styles.controlButtonText}>Filter</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.controlButton}>
          <LinearGradient colors={['#00b894', '#00a085']} style={styles.controlButtonGradient}>
            <Ionicons name="add" size={16} color="white" />
            <Text style={styles.controlButtonText}>Create</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStatsModal = () => (
    <Modal visible={showStatsModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#2d3748', '#1a202c']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Statistics</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#a0aec0" />
              </TouchableOpacity>
            </View>
            
            {stats && (
              <ScrollView style={styles.statsContent}>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.unread}</Text>
                    <Text style={styles.statLabel}>Unread</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.delivered}</Text>
                    <Text style={styles.statLabel}>Delivered</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.pending}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                  </View>
                </View>
                
                <Text style={styles.sectionTitle}>By Type</Text>
                {Object.entries(stats.by_type || {}).map(([type, count]) => (
                  <View key={type} style={styles.statRow}>
                    <Text style={styles.statRowLabel}>{type}</Text>
                    <Text style={styles.statRowValue}>{count}</Text>
                  </View>
                ))}
                
                <Text style={styles.sectionTitle}>By Priority</Text>
                {Object.entries(stats.by_priority || {}).map(([priority, count]) => (
                  <View key={priority} style={styles.statRow}>
                    <Text style={styles.statRowLabel}>{getPriorityLabel(parseInt(priority))}</Text>
                    <Text style={styles.statRowValue}>{count}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c5ce7" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderControls()}
      
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6c5ce7" />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#6c5ce7" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off" size={64} color="#a0aec0" />
            <Text style={styles.emptyText}>No notifications found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        }
      />
      
      {renderStatsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a202c',
  },
  header: {
    backgroundColor: 'transparent',
  },
  headerGradient: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  statsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  controls: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d3748',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    marginLeft: 12,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  controlButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  controlButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  notificationCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notificationGradient: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationBadges: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  packageCode: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a0aec0',
    marginTop: 12,
    fontSize: 16,
  },
  loadingMore: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#a0aec0',
    fontSize: 14,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsContent: {
    maxHeight: height * 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#4a5568',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: (width * 0.9 - 80) / 2,
  },
  statNumber: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#a0aec0',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
  },
  statRowLabel: {
    color: '#cbd5e0',
    fontSize: 14,
  },
  statRowValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
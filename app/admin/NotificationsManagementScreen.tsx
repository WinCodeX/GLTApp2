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

interface CreateNotificationData {
  title: string;
  message: string;
  notification_type: string;
  priority: number;
  user_id: string;
  expires_at: string;
  action_url: string;
  icon: string;
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
  const [createData, setCreateData] = useState<CreateNotificationData>({
    title: '',
    message: '',
    notification_type: 'general',
    priority: 0,
    user_id: '',
    expires_at: '',
    action_url: '',
    icon: 'notifications',
  });
  const [creating, setCreating] = useState(false);
  
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

  const handleCreateNotification = async () => {
    if (!createData.title || !createData.message) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }

    try {
      setCreating(true);
      
      const payload = {
        notification: {
          ...createData,
          user_id: createData.user_id || undefined,
        }
      };

      const response = await api.post('/api/v1/admin/notifications', payload);
      
      if (response.data?.success) {
        Alert.alert('Success', 'Notification created successfully');
        setShowCreateModal(false);
        setCreateData({
          title: '',
          message: '',
          notification_type: 'general',
          priority: 0,
          user_id: '',
          expires_at: '',
          action_url: '',
          icon: 'notifications',
        });
        loadNotifications(1);
        loadStats();
      }
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
      Alert.alert('Error', 'Failed to create notification');
    } finally {
      setCreating(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      priority: '',
      read_status: '',
      search: '',
    });
    setShowFiltersModal(false);
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 2: return '#ff6b6b'; // Urgent - Red
      case 1: return '#ffa726'; // High - Orange  
      default: return '#10b981'; // Normal - Green
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
      case 'sent': return '#10b981';
      case 'failed': return '#ff6b6b';
      case 'expired': return '#a78bfa';
      default: return '#8b5cf6';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderNotificationItem = ({ item }: { item: NotificationData }) => (
    <View style={styles.notificationCard}>
      <LinearGradient
        colors={item.read ? ['#2d1b4e', '#1a1b3d'] : ['#8b5cf6', '#c084fc']}
        style={styles.notificationGradient}
      >
        {/* Header */}
        <View style={styles.notificationHeader}>
          <View style={styles.notificationHeaderLeft}>
            <Ionicons 
              name={item.icon as any || 'notifications'} 
              size={20} 
              color={item.read ? '#a78bfa' : 'white'} 
            />
            <View style={styles.notificationHeaderText}>
              <Text style={[styles.notificationTitle, { color: item.read ? '#c4b5fd' : 'white' }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.notificationMeta, { color: item.read ? '#a78bfa' : 'rgba(255,255,255,0.8)' }]}>
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
                color={item.read ? '#a78bfa' : 'white'} 
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
        <Text style={[styles.notificationMessage, { color: item.read ? '#e5e7eb' : 'rgba(255,255,255,0.9)' }]} numberOfLines={2}>
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
            
            <View style={[styles.badge, { backgroundColor: '#c084fc' }]}>
              <Text style={styles.badgeText}>{item.notification_type}</Text>
            </View>
          </View>
          
          {item.package && (
            <Text style={[styles.packageCode, { color: item.read ? '#a78bfa' : 'rgba(255,255,255,0.8)' }]}>
              #{item.package.code}
            </Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.headerGradient}>
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
        <Ionicons name="search" size={20} color="#a78bfa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notifications..."
          placeholderTextColor="#a78bfa"
          value={filters.search}
          onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
        />
      </View>
      
      <View style={styles.controlButtons}>
        <TouchableOpacity onPress={() => setShowFiltersModal(true)} style={styles.controlButton}>
          <LinearGradient colors={['#8b5cf6', '#c084fc']} style={styles.controlButtonGradient}>
            <Ionicons name="filter" size={16} color="white" />
            <Text style={styles.controlButtonText}>Filter</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.controlButton}>
          <LinearGradient colors={['#10b981', '#34d399']} style={styles.controlButtonGradient}>
            <Ionicons name="add" size={16} color="white" />
            <Text style={styles.controlButtonText}>Create</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCreateModal = () => (
    <Modal visible={showCreateModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#2d1b4e', '#1a1b3d']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Notification</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#a78bfa" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.createForm} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter notification title"
                  placeholderTextColor="#a78bfa"
                  value={createData.title}
                  onChangeText={(text) => setCreateData(prev => ({ ...prev, title: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Message *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter notification message"
                  placeholderTextColor="#a78bfa"
                  value={createData.message}
                  onChangeText={(text) => setCreateData(prev => ({ ...prev, message: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.pickerContainer}>
                  {NOTIFICATION_TYPES.slice(1).map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.pickerOption,
                        createData.notification_type === type.value && styles.pickerOptionSelected
                      ]}
                      onPress={() => setCreateData(prev => ({ ...prev, notification_type: type.value }))}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        createData.notification_type === type.value && styles.pickerOptionTextSelected
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Priority</Text>
                <View style={styles.priorityContainer}>
                  {PRIORITY_LEVELS.slice(1).map((priority) => (
                    <TouchableOpacity
                      key={priority.value}
                      style={[
                        styles.priorityOption,
                        createData.priority.toString() === priority.value && styles.priorityOptionSelected
                      ]}
                      onPress={() => setCreateData(prev => ({ ...prev, priority: parseInt(priority.value) }))}
                    >
                      <Text style={[
                        styles.priorityOptionText,
                        createData.priority.toString() === priority.value && styles.priorityOptionTextSelected
                      ]}>
                        {priority.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>User ID (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter user ID for specific user"
                  placeholderTextColor="#a78bfa"
                  value={createData.user_id}
                  onChangeText={(text) => setCreateData(prev => ({ ...prev, user_id: text }))}
                />
              </View>

              <View style={styles.createActions}>
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleCreateNotification}
                  style={styles.createButton}
                  disabled={creating}
                >
                  <LinearGradient colors={['#10b981', '#34d399']} style={styles.createButtonGradient}>
                    {creating ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.createButtonText}>Create</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const renderFiltersModal = () => (
    <Modal visible={showFiltersModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#2d1b4e', '#1a1b3d']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Notifications</Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <Ionicons name="close" size={24} color="#a78bfa" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.filtersForm} showsVerticalScrollIndicator={false}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Type</Text>
                <View style={styles.filterOptions}>
                  {NOTIFICATION_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.filterOption,
                        filters.type === type.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, type: type.value }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.type === type.value && styles.filterOptionTextSelected
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.filterOptions}>
                  {STATUS_OPTIONS.map((status) => (
                    <TouchableOpacity
                      key={status.value}
                      style={[
                        styles.filterOption,
                        filters.status === status.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, status: status.value }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.status === status.value && styles.filterOptionTextSelected
                      ]}>
                        {status.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Priority</Text>
                <View style={styles.filterOptions}>
                  {PRIORITY_LEVELS.map((priority) => (
                    <TouchableOpacity
                      key={priority.value}
                      style={[
                        styles.filterOption,
                        filters.priority === priority.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, priority: priority.value }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.priority === priority.value && styles.filterOptionTextSelected
                      ]}>
                        {priority.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Read Status</Text>
                <View style={styles.filterOptions}>
                  {READ_STATUS_OPTIONS.map((readStatus) => (
                    <TouchableOpacity
                      key={readStatus.value}
                      style={[
                        styles.filterOption,
                        filters.read_status === readStatus.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, read_status: readStatus.value }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.read_status === readStatus.value && styles.filterOptionTextSelected
                      ]}>
                        {readStatus.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterActions}>
                <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setShowFiltersModal(false)}
                  style={styles.applyButton}
                >
                  <LinearGradient colors={['#8b5cf6', '#c084fc']} style={styles.applyButtonGradient}>
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const renderStatsModal = () => (
    <Modal visible={showStatsModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#2d1b4e', '#1a1b3d']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Statistics</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#a78bfa" />
              </TouchableOpacity>
            </View>
            
            {stats && (
              <ScrollView style={styles.statsContent} showsVerticalScrollIndicator={false}>
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
        <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c084fc" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.gradient}>
        {renderControls()}
        
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            filteredNotifications.length === 0 && styles.emptyListContent
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#8b5cf6" />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#8b5cf6" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="notifications-off" size={48} color="#a78bfa" />
              </View>
              <Text style={styles.emptyText}>No notifications found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
        
        {renderCreateModal()}
        {renderFiltersModal()}
        {renderStatsModal()}
      </LinearGradient>
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
    borderBottomColor: 'rgba(168, 123, 250, 0.3)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  searchInput: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 16,
    marginLeft: 12,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    borderRadius: 20,
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
  emptyListContent: {
    flex: 1,
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
    gap: 12,
  },
  loadingText: {
    color: '#c4b5fd',
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
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 20,
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
    maxHeight: height * 0.8,
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
  createForm: {
    maxHeight: height * 0.6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e5e7eb',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  pickerOptionSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  pickerOptionText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: 'white',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  priorityOptionSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  priorityOptionText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '500',
  },
  priorityOptionTextSelected: {
    color: 'white',
  },
  createActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  createButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  filtersForm: {
    maxHeight: height * 0.6,
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  filterOptionSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  filterOptionText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '500',
  },
  filterOptionTextSelected: {
    color: 'white',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: (width * 0.9 - 80) / 2,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  statNumber: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#c4b5fd',
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
    borderBottomColor: 'rgba(168, 123, 250, 0.3)',
  },
  statRowLabel: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  statRowValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
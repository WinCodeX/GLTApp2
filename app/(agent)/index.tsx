// app/(agent)/index.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AgentBottomTabs } from '../../components/agent/AgentBottomTabs';
import { useUser } from '../../context/UserContext';
import api from '../../lib/api';
import ActionCableService from '../../lib/services/ActionCableService';
import { accountManager } from '../../lib/AccountManager';

interface DashboardStats {
  active_deliveries: number;
  completed_today: number;
  revenue_today: number;
  pending_packages: {
    total: number;
    by_location: Array<{
      office_name: string;
      location: string;
      type: string;
      count: number;
      packages: Array<{
        id: number;
        code: string;
        state: string;
        receiver_name: string;
        destination: string;
      }>;
    }>;
  };
  staff_info: {
    id: number;
    name: string;
    role: string;
    role_display: string;
  };
  activity_summary: {
    scans_today: number;
    prints_today: number;
    packages_handled_today: number;
  };
}

interface Activity {
  id: number;
  title: string;
  time: string;
  status: 'completed' | 'pending' | 'active';
  type?: string;
}

export default function AgentHomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const actionCableRef = useRef<ActionCableService | null>(null);
  const subscriptionsSetup = useRef(false);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);

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

    // Clear existing subscriptions
    actionCableSubscriptions.current.forEach(unsub => unsub());
    actionCableSubscriptions.current = [];

    const actionCable = actionCableRef.current;

    // Connection status
    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    // Dashboard stats updates
    const unsubStatsUpdate = actionCable.subscribe('dashboard_stats_update', (data) => {
      if (data.stats) {
        setStats(data.stats);
      }
    });
    actionCableSubscriptions.current.push(unsubStatsUpdate);

    // Package events
    const unsubPackageScanned = actionCable.subscribe('package_scanned', () => {
      // Refresh stats when package is scanned
      fetchDashboardStats();
    });
    actionCableSubscriptions.current.push(unsubPackageScanned);

    const unsubPackageRejected = actionCable.subscribe('package_rejected', () => {
      // Refresh stats when package is rejected
      fetchDashboardStats();
    });
    actionCableSubscriptions.current.push(unsubPackageRejected);
  };

  useEffect(() => {
    setupActionCable();
    
    return () => {
      subscriptionsSetup.current = false;
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];
    };
  }, [setupActionCable]);

  const fetchDashboardStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await api.get('/api/v1/staff/dashboard/stats', {
        timeout: 15000,
      });

      if (response.data?.success) {
        setStats(response.data.data);
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error);
      setError(error.response?.data?.message || 'Unable to load dashboard. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const handleRefresh = () => {
    fetchDashboardStats(true);
  };

  const handleNotificationPress = () => {
    router.push('/(staff)/notifications');
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'scan':
        // Navigate to scan screen
        router.push('/(staff)/scan');
        break;
      case 'track':
        // Navigate to track screen
        router.push('/(staff)/track');
        break;
      case 'packages':
        // Navigate to packages list
        router.push('/(staff)/packages');
        break;
      case 'history':
        // Navigate to activity history
        router.push('/(staff)/activities');
        break;
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  if (loading && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View>
            <Text style={styles.headerGreeting}>Welcome back,</Text>
            <Text style={styles.headerName}>
              {user?.display_name || user?.first_name || 'Staff'}
            </Text>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View>
            <Text style={styles.headerGreeting}>Welcome back,</Text>
            <Text style={styles.headerName}>
              {user?.display_name || user?.first_name || 'Staff'}
            </Text>
          </View>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchDashboardStats()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayStats = [
    { 
      label: 'Active Deliveries', 
      value: stats?.active_deliveries.toString() || '0', 
      icon: 'package' as const
    },
    { 
      label: 'Completed Today', 
      value: stats?.completed_today.toString() || '0', 
      icon: 'check-circle' as const
    },
    { 
      label: 'Revenue Today', 
      value: formatCurrency(stats?.revenue_today || 0), 
      icon: 'trending-up' as const
    },
  ];

  // Generate recent activities from API data
  const recentActivities: Activity[] = [];
  
  if (stats?.activity_summary.packages_handled_today > 0) {
    recentActivities.push({
      id: 1,
      title: `Handled ${stats.activity_summary.packages_handled_today} packages today`,
      time: 'Today',
      status: 'completed',
      type: 'package'
    });
  }
  
  if (stats?.activity_summary.scans_today > 0) {
    recentActivities.push({
      id: 2,
      title: `Scanned ${stats.activity_summary.scans_today} packages`,
      time: 'Today',
      status: 'completed',
      type: 'scan'
    });
  }
  
  if (stats?.activity_summary.prints_today > 0) {
    recentActivities.push({
      id: 3,
      title: `Printed ${stats.activity_summary.prints_today} labels`,
      time: 'Today',
      status: 'completed',
      type: 'print'
    });
  }

  if (stats?.pending_packages.total > 0) {
    recentActivities.push({
      id: 4,
      title: `${stats.pending_packages.total} packages pending`,
      time: 'Now',
      status: 'pending',
      type: 'pending'
    });
  }

  // Fill with placeholder if no activities
  if (recentActivities.length === 0) {
    recentActivities.push({
      id: 5,
      title: 'No recent activity',
      time: 'Today',
      status: 'pending',
      type: 'none'
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerGreeting}>Welcome back,</Text>
          <Text style={styles.headerName}>
            {stats?.staff_info.name || user?.display_name || user?.first_name || 'Staff'}
          </Text>
          {stats?.staff_info.role_display && (
            <Text style={styles.headerRole}>{stats.staff_info.role_display}</Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={handleNotificationPress}
        >
          <Feather name="bell" size={24} color="#fff" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#7B3F98']}
            tintColor="#7B3F98"
          />
        }
      >
        {/* Connection Status */}
        {isConnected && (
          <View style={styles.connectionBanner}>
            <Feather name="wifi" size={12} color="#34C759" />
            <Text style={styles.connectionText}>Live Updates Active</Text>
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {displayStats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Feather name={stat.icon} size={20} color="#7B3F98" />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Pending Packages Summary */}
        {stats && stats.pending_packages.total > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Packages</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{stats.pending_packages.total}</Text>
              </View>
            </View>
            
            {stats.pending_packages.by_location.slice(0, 3).map((location, index) => (
              <View key={index} style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <View style={styles.locationIcon}>
                    <Feather name="map-pin" size={16} color="#7B3F98" />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{location.office_name}</Text>
                    <Text style={styles.locationAddress}>{location.location}</Text>
                  </View>
                  <View style={styles.locationCount}>
                    <Text style={styles.locationCountText}>{location.count}</Text>
                  </View>
                </View>
              </View>
            ))}
            
            {stats.pending_packages.by_location.length > 3 && (
              <TouchableOpacity 
                style={styles.viewMoreButton}
                onPress={() => handleQuickAction('packages')}
              >
                <Text style={styles.viewMoreText}>
                  View {stats.pending_packages.by_location.length - 3} more locations
                </Text>
                <Feather name="arrow-right" size={14} color="#7B3F98" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => handleQuickAction('scan')}
            >
              <Feather name="maximize" size={24} color="#7B3F98" />
              <Text style={styles.actionText}>Scan Package</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => handleQuickAction('track')}
            >
              <Feather name="map-pin" size={24} color="#7B3F98" />
              <Text style={styles.actionText}>Track Package</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => handleQuickAction('packages')}
            >
              <Feather name="list" size={24} color="#7B3F98" />
              <Text style={styles.actionText}>View Packages</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => handleQuickAction('history')}
            >
              <Feather name="clock" size={24} color="#7B3F98" />
              <Text style={styles.actionText}>Activity</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          {recentActivities.map((activity) => (
            <View key={activity.id} style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Feather 
                  name={activity.status === 'completed' ? 'check' : 'package'} 
                  size={18} 
                  color="#7B3F98" 
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: activity.status === 'completed' ? '#4CAF50' : '#FFA500' }
              ]}>
                <Text style={styles.statusText}>{activity.status}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <AgentBottomTabs currentTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  headerGreeting: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  headerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  headerRole: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#B8B8B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
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
  content: {
    flex: 1,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  connectionText: {
    fontSize: 11,
    color: '#34C759',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#FFA500',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationCard: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  locationAddress: {
    color: '#8E8E93',
    fontSize: 12,
  },
  locationCount: {
    backgroundColor: 'rgba(123, 63, 152, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  locationCountText: {
    color: '#7B3F98',
    fontSize: 14,
    fontWeight: 'bold',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  viewMoreText: {
    color: '#7B3F98',
    fontSize: 14,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
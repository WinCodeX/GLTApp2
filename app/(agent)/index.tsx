// app/(agent)/index.tsx - CRASH-SAFE VERSION
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
  incoming_deliveries: number;
  completed_today: number;
  pending_packages: {
    total: number;
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
  id: string;
  type: 'scan' | 'print';
  activity_type: string;
  description: string;
  package_code: string;
  timestamp: string;
}

// Safe defaults
const DEFAULT_STATS: DashboardStats = {
  incoming_deliveries: 0,
  completed_today: 0,
  pending_packages: { total: 0 },
  staff_info: {
    id: 0,
    name: 'Staff',
    role: 'agent',
    role_display: 'Agent'
  },
  activity_summary: {
    scans_today: 0,
    prints_today: 0,
    packages_handled_today: 0
  }
};

export default function AgentHomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
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
      if (!currentAccount) {
        console.log('No current account, skipping ActionCable setup');
        return;
      }

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
        console.log('✅ ActionCable connected successfully');
      }
    } catch (error) {
      console.error('❌ Failed to setup ActionCable:', error);
      setIsConnected(false);
      // Don't crash, just log the error
    }
  }, []);

  const setupSubscriptions = () => {
    if (!actionCableRef.current) return;

    try {
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];

      const actionCable = actionCableRef.current;

      const unsubConnected = actionCable.subscribe('connection_established', () => {
        console.log('🔌 ActionCable connection established');
        setIsConnected(true);
      });
      actionCableSubscriptions.current.push(unsubConnected);

      const unsubLost = actionCable.subscribe('connection_lost', () => {
        console.log('🔌 ActionCable connection lost');
        setIsConnected(false);
      });
      actionCableSubscriptions.current.push(unsubLost);

      const unsubStatsUpdate = actionCable.subscribe('dashboard_stats_update', (data) => {
        try {
          if (data?.stats) {
            console.log('📊 Received stats update via ActionCable');
            const updatedStats = safeParseStats(data.stats);
            setStats(updatedStats);
          }
        } catch (err) {
          console.error('❌ Error processing stats update:', err);
        }
      });
      actionCableSubscriptions.current.push(unsubStatsUpdate);

      const unsubPackageScanned = actionCable.subscribe('package_scanned', () => {
        console.log('📦 Package scanned event received');
        fetchDashboardData(true);
      });
      actionCableSubscriptions.current.push(unsubPackageScanned);

      const unsubPackageRejected = actionCable.subscribe('package_rejected', () => {
        console.log('❌ Package rejected event received');
        fetchDashboardData(true);
      });
      actionCableSubscriptions.current.push(unsubPackageRejected);

      console.log('✅ ActionCable subscriptions setup complete');
    } catch (error) {
      console.error('❌ Error setting up subscriptions:', error);
      // Don't crash, just log
    }
  };

  useEffect(() => {
    setupActionCable();
    
    return () => {
      try {
        subscriptionsSetup.current = false;
        actionCableSubscriptions.current.forEach(unsub => unsub());
        actionCableSubscriptions.current = [];
      } catch (err) {
        console.error('❌ Error cleaning up ActionCable:', err);
      }
    };
  }, [setupActionCable]);

  // Safe stats parser
  const safeParseStats = useCallback((apiStats: any): DashboardStats => {
    try {
      return {
        incoming_deliveries: apiStats?.pending_packages?.total || apiStats?.incoming_deliveries || 0,
        completed_today: apiStats?.completed_today || 0,
        pending_packages: {
          total: apiStats?.pending_packages?.total || 0
        },
        staff_info: {
          id: apiStats?.staff_info?.id || user?.id || 0,
          name: apiStats?.staff_info?.name || user?.display_name || user?.first_name || 'Staff',
          role: apiStats?.staff_info?.role || 'agent',
          role_display: apiStats?.staff_info?.role_display || 'Agent'
        },
        activity_summary: {
          scans_today: apiStats?.activity_summary?.scans_today || 0,
          prints_today: apiStats?.activity_summary?.prints_today || 0,
          packages_handled_today: apiStats?.activity_summary?.packages_handled_today || 0
        }
      };
    } catch (err) {
      console.error('❌ Error parsing stats:', err);
      return DEFAULT_STATS;
    }
  }, [user]);

  // Safe activity parser
  const safeParseActivities = useCallback((activities: any[]): Activity[] => {
    try {
      if (!Array.isArray(activities)) {
        console.warn('⚠️ Activities is not an array:', activities);
        return [];
      }

      return activities.map((activity, index) => {
        try {
          return {
            id: activity?.id || `activity-${index}`,
            type: activity?.type || 'scan',
            activity_type: activity?.activity_type || 'unknown',
            description: activity?.description || 'Activity',
            package_code: activity?.package_code || 'N/A',
            timestamp: activity?.timestamp || new Date().toISOString()
          };
        } catch (err) {
          console.error('❌ Error parsing activity:', err, activity);
          return {
            id: `error-${index}`,
            type: 'scan',
            activity_type: 'unknown',
            description: 'Error loading activity',
            package_code: 'N/A',
            timestamp: new Date().toISOString()
          };
        }
      }).filter(Boolean);
    } catch (err) {
      console.error('❌ Error parsing activities array:', err);
      return [];
    }
  }, []);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      console.log('🔄 Fetching dashboard data...', { isRefresh });
      
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch stats with timeout
      let statsResponse: any = null;
      try {
        statsResponse = await Promise.race([
          api.get('/api/v1/staff/dashboard/stats'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Stats request timeout')), 15000)
          )
        ]);
        
        console.log('📊 Stats response:', statsResponse?.data?.success ? 'Success' : 'Failed');
      } catch (statsError: any) {
        console.error('❌ Stats fetch error:', statsError.message);
        // Continue with activities fetch even if stats fail
      }

      // Parse stats safely
      if (statsResponse?.data?.success && statsResponse?.data?.data) {
        const parsedStats = safeParseStats(statsResponse.data.data);
        setStats(parsedStats);
        console.log('✅ Stats updated successfully');
      } else {
        console.warn('⚠️ Using default stats');
        setStats(DEFAULT_STATS);
      }

      // Fetch activities with timeout
      let activitiesResponse: any = null;
      try {
        activitiesResponse = await Promise.race([
          api.get('/api/v1/staff/activities', { params: { limit: 5 } }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Activities request timeout')), 15000)
          )
        ]);
        
        console.log('📋 Activities response:', activitiesResponse?.data?.success ? 'Success' : 'Failed');
      } catch (activitiesError: any) {
        console.error('❌ Activities fetch error:', activitiesError.message);
        // Continue even if activities fail
      }

      // Parse activities safely
      if (activitiesResponse?.data?.success && activitiesResponse?.data?.data?.activities) {
        const parsedActivities = safeParseActivities(activitiesResponse.data.data.activities);
        setRecentActivities(parsedActivities);
        console.log('✅ Activities updated successfully:', parsedActivities.length);
      } else {
        console.warn('⚠️ No activities available');
        setRecentActivities([]);
      }

    } catch (error: any) {
      console.error('❌ Dashboard fetch failed:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unable to load dashboard';
      setError(errorMessage);
      
      // Set safe defaults on error
      setStats(DEFAULT_STATS);
      setRecentActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('✅ Dashboard fetch complete');
    }
  }, [safeParseStats, safeParseActivities]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleNotificationPress = () => {
    try {
      router.push('/(agent)/notifications');
    } catch (err) {
      console.error('❌ Navigation error:', err);
    }
  };

  const handleQuickAction = (action: string) => {
    try {
      console.log('🎯 Quick action:', action);
      switch (action) {
        case 'scan':
          router.push('/(agent)/scan');
          break;
        case 'track':
          router.push('/(agent)/track');
          break;
        case 'packages':
          router.push('/(agent)/packages');
          break;
        case 'history':
          router.push('/(agent)/activities');
          break;
        default:
          console.warn('⚠️ Unknown action:', action);
      }
    } catch (err) {
      console.error('❌ Navigation error:', err);
    }
  };

  const getActivityIcon = (type: string, activityType: string) => {
    try {
      if (type === 'print') return 'printer';
      if (activityType.includes('scan')) return 'maximize';
      return 'package';
    } catch {
      return 'package';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Recently';
    }
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

  const displayStats = [
    { 
      label: 'Incoming Deliveries', 
      value: (stats?.incoming_deliveries || 0).toString(), 
      icon: 'inbox' as const
    },
    { 
      label: 'Completed Today', 
      value: (stats?.completed_today || 0).toString(), 
      icon: 'check-circle' as const
    },
  ];

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
            {stats?.staff_info?.name || user?.display_name || user?.first_name || 'Staff'}
          </Text>
          {stats?.staff_info?.role_display && (
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
        {error && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color="#FF3B30" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {isConnected && (
          <View style={styles.connectionBanner}>
            <Feather name="wifi" size={12} color="#34C759" />
            <Text style={styles.connectionText}>Live Updates Active</Text>
          </View>
        )}

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
              <Feather name="search" size={24} color="#7B3F98" />
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity onPress={() => handleQuickAction('history')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {recentActivities.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color="#8E8E93" />
              <Text style={styles.emptyStateText}>No recent activity</Text>
              <Text style={styles.emptyStateSubtext}>Your activities will appear here</Text>
            </View>
          ) : (
            recentActivities.map((activity) => (
              <View key={activity.id} style={styles.activityCard}>
                <View style={styles.activityIcon}>
                  <Feather 
                    name={getActivityIcon(activity.type, activity.activity_type) as any} 
                    size={18} 
                    color="#7B3F98" 
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.description}</Text>
                  <View style={styles.activityMeta}>
                    <Text style={styles.activityPackage}>{activity.package_code}</Text>
                    <Text style={styles.activityTime}>{formatTimestamp(activity.timestamp)}</Text>
                  </View>
                </View>
                <View style={[
                  styles.activityTypeBadge,
                  { backgroundColor: activity.type === 'print' ? '#FF9500' : '#34C759' }
                ]}>
                  <Text style={styles.activityTypeText}>
                    {activity.type === 'print' ? 'Print' : 'Scan'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
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
  content: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#FF3B30',
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
  viewAllText: {
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
    marginBottom: 4,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityPackage: {
    color: '#7B3F98',
    fontSize: 12,
    fontWeight: '600',
  },
  activityTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  activityTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityTypeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },
});
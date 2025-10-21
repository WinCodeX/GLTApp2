// app/(agent)/activities.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../lib/api';

interface Activity {
  id: string;
  type: 'scan' | 'print';
  activity_type: string;
  description: string;
  package_code: string;
  package_id: number;
  timestamp: string;
  metadata?: any;
  copies?: number;
  status?: string;
}

interface ActivitySummary {
  total_activities: number;
  scans: number;
  prints: number;
  packages_handled: number;
}

export default function ActivitiesScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'scan' | 'print'>('all');

  const fetchActivities = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params: any = { limit: 50 };
      if (filter !== 'all') {
        params.activity_type = filter;
      }

      const response = await api.get('/api/v1/staff/activities', { params });

      if (response.data.success) {
        setActivities(response.data.data.activities || []);
        setSummary(response.data.data.summary || null);
      }
    } catch (error: any) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchActivities();
  }, [filter]);

  const getActivityIcon = (type: string, activityType: string) => {
    if (type === 'print') return 'printer';
    if (activityType.includes('scan')) return 'maximize';
    if (activityType.includes('collect')) return 'truck';
    if (activityType.includes('process')) return 'package';
    return 'check-circle';
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'print':
        return '#FF9500';
      case 'scan':
        return '#34C759';
      default:
        return '#007AFF';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleActivityPress = (item: Activity) => {
    router.push({
      pathname: '/(agent)/track',
      params: { 
        code: item.package_code,
        packageId: item.package_id.toString() 
      }
    });
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <TouchableOpacity 
      style={styles.activityCard}
      onPress={() => handleActivityPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.activityIconContainer, { backgroundColor: `${getActivityColor(item.type)}15` }]}>
        <Feather
          name={getActivityIcon(item.type, item.activity_type) as any}
          size={20}
          color={getActivityColor(item.type)}
        />
      </View>

      <View style={styles.activityContent}>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <View style={styles.activityMeta}>
          <View style={styles.packageTag}>
            <Feather name="package" size={12} color="#7B3F98" />
            <Text style={styles.packageCode}>{item.package_code}</Text>
          </View>
          <Text style={styles.activityTime}>{formatTimestamp(item.timestamp)}</Text>
        </View>
        {item.copies && item.copies > 1 && (
          <Text style={styles.copiesText}>{item.copies} copies printed</Text>
        )}
      </View>

      <View style={[styles.typeBadge, { backgroundColor: getActivityColor(item.type) }]}>
        <Text style={styles.typeBadgeText}>{item.type}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <>
      {summary && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Activity Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.total_activities}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#34C759' }]}>
                {summary.scans}
              </Text>
              <Text style={styles.summaryLabel}>Scans</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#FF9500' }]}>
                {summary.prints}
              </Text>
              <Text style={styles.summaryLabel}>Prints</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#007AFF' }]}>
                {summary.packages_handled}
              </Text>
              <Text style={styles.summaryLabel}>Packages</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Filter Activities</Text>
        <View style={styles.filterButtons}>
          {[
            { value: 'all', label: 'All', icon: 'list' },
            { value: 'scan', label: 'Scans', icon: 'maximize' },
            { value: 'print', label: 'Prints', icon: 'printer' },
          ].map((filterOption) => (
            <TouchableOpacity
              key={filterOption.value}
              style={[
                styles.filterButton,
                filter === filterOption.value && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(filterOption.value as any)}
            >
              <Feather
                name={filterOption.icon as any}
                size={16}
                color={filter === filterOption.value ? '#fff' : '#8E8E93'}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  filter === filterOption.value && styles.filterButtonTextActive,
                ]}
              >
                {filterOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.listTitle}>Recent Activities</Text>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.replace('/(agent)')} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity History</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Loading activities...</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchActivities(true)}
              colors={['#7B3F98']}
              tintColor="#7B3F98"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="clock" size={64} color="#8E8E93" />
              <Text style={styles.emptyStateText}>No activities yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Your scan and print activities will appear here
              </Text>
            </View>
          }
        />
      )}
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
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
  listContent: {
    padding: 16,
  },
  summarySection: {
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#7B3F98',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 6,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  packageCode: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7B3F98',
  },
  activityTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  copiesText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
});
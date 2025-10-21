// app/(agent)/track.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../lib/api';

interface TrackingEvent {
  id: number;
  event_type: string;
  event_type_display: string;
  description: string;
  created_at: string;
  timestamp: string;
  user: {
    name: string;
    role: string;
  };
  metadata: any;
  location: string;
}

interface PackageInfo {
  code: string;
  state: string;
  state_display: string;
  delivery_type: string;
  delivery_type_display: string;
  package_size: string;
  cost: number;
  receiver: {
    name: string;
    phone: string;
  };
  sender: {
    name: string;
    phone: string;
  };
  route: {
    origin: string;
    destination: string;
    description: string;
  };
  created_at: string;
  updated_at: string;
}

export default function TrackPackageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [packageCode, setPackageCode] = useState(params.code as string || '');
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>('');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (params.code) {
      handleTrack();
    }
  }, [params.code]);

  useEffect(() => {
    const pulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulseAnimation());
    };
    
    if (packageInfo && ['in_transit', 'submitted'].includes(packageInfo.state)) {
      pulseAnimation();
    }
    
    return () => {
      pulseAnim.stopAnimation();
    };
  }, [packageInfo]);

  const handleTrack = async () => {
    if (!packageCode.trim()) {
      Alert.alert('Error', 'Please enter a package code');
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/api/v1/staff/packages/${packageCode.trim()}/track`);

      if (response.data.success) {
        setPackageInfo(response.data.data.package);
        setTrackingEvents(response.data.data.tracking_events || []);
        setEstimatedDelivery(response.data.data.estimated_delivery || '');
      } else {
        Alert.alert('Error', response.data.message);
        setPackageInfo(null);
        setTrackingEvents([]);
      }
    } catch (error: any) {
      console.error('Track error:', error);
      Alert.alert(
        'Track Failed',
        error.response?.data?.message || 'Package not found'
      );
      setPackageInfo(null);
      setTrackingEvents([]);
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await handleTrack();
    setRefreshing(false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('print')) return 'printer';
    if (eventType.includes('collect')) return 'truck';
    if (eventType.includes('deliver')) return 'home';
    if (eventType.includes('process')) return 'package';
    if (eventType.includes('reject')) return 'x-circle';
    return 'check-circle';
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'pending': return '#FF9500';
      case 'submitted': return '#007AFF';
      case 'in_transit': return '#5856D6';
      case 'delivered': return '#34C759';
      case 'collected': return '#2563eb';
      case 'rejected': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getDeliveryTypeColor = (deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep':
      case 'home': return '#8b5cf6';
      case 'office':
      case 'agent': return '#3b82f6';
      case 'fragile': return '#f97316';
      case 'collection': return '#10b981';
      default: return '#8b5cf6';
    }
  };

  const getPackageTypeIcon = (deliveryType: string) => {
    switch (deliveryType) {
      case 'collection': return 'shopping-bag';
      case 'fragile': return 'shield';
      case 'doorstep':
      case 'home': return 'home';
      case 'office':
      case 'agent': return 'briefcase';
      default: return 'package';
    }
  };

  const renderTimelineItem = (event: TrackingEvent, index: number) => {
    const isActive = index === 0;
    
    return (
      <View key={event.id} style={styles.timelineItem}>
        <View style={styles.timelineIndicator}>
          <Animated.View style={[
            styles.timelineDot,
            { 
              backgroundColor: isActive ? getStateColor(packageInfo?.state || '') : '#444',
              transform: isActive ? [{ scale: pulseAnim }] : [{ scale: 1 }]
            }
          ]}>
            <Feather 
              name={getEventIcon(event.event_type) as any} 
              size={isActive ? 10 : 8} 
              color={isActive ? '#fff' : '#888'} 
            />
          </Animated.View>
          {index < trackingEvents.length - 1 && (
            <View style={[
              styles.timelineLine,
              { backgroundColor: isActive ? getStateColor(packageInfo?.state || '') : '#444' }
            ]} />
          )}
        </View>
        
        <View style={styles.timelineContent}>
          <View style={styles.timelineHeader}>
            <Text style={[
              styles.timelineDescription,
              { color: isActive ? '#fff' : '#888' },
              isActive && styles.currentTimelineDescription
            ]}>
              {event.description}
            </Text>
            <Text style={styles.timelineTimestamp}>
              {formatTimeAgo(event.timestamp)}
            </Text>
          </View>
          
          <Text style={styles.timelineFullTimestamp}>
            {formatTimestamp(event.timestamp)}
          </Text>
          
          {event.user && (
            <View style={styles.timelineUser}>
              <Feather name="user" size={12} color="#10b981" />
              <Text style={styles.timelineUserText}>
                {event.user.name} ({event.user.role})
              </Text>
            </View>
          )}
          
          {event.location && (
            <View style={styles.timelineLocation}>
              <Feather name="map-pin" size={12} color="#8b5cf6" />
              <Text style={styles.timelineLocationText}>{event.location}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Package</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7B3F98"
            colors={['#7B3F98']}
          />
        }
      >
        <View style={styles.searchSection}>
          <View style={styles.inputContainer}>
            <Feather name="search" size={20} color="#8E8E93" />
            <TextInput
              style={styles.input}
              placeholder="Enter package code"
              placeholderTextColor="#8E8E93"
              value={packageCode}
              onChangeText={setPackageCode}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={handleTrack}
            />
          </View>

          <TouchableOpacity
            style={[styles.searchButton, searching && styles.searchButtonDisabled]}
            onPress={handleTrack}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="search" size={20} color="#fff" />
                <Text style={styles.searchButtonText}>Track</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {packageInfo && (
          <>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)']}
                style={styles.statusGradient}
              >
                <View style={styles.statusHeader}>
                  <View style={styles.statusIcon}>
                    <Feather name="activity" size={20} color="#8b5cf6" />
                  </View>
                  <Text style={styles.statusTitle}>Current Status</Text>
                  {['in_transit', 'submitted'].includes(packageInfo.state) && (
                    <View style={styles.liveIndicator}>
                      <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.statusDescription}>
                  {packageInfo.state_display}
                </Text>
                
                {estimatedDelivery && (
                  <View style={styles.statusEstimate}>
                    <Feather name="clock" size={14} color="#f59e0b" />
                    <Text style={styles.statusEstimateText}>
                      Est. delivery: {estimatedDelivery}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Package Summary Card */}
            <View style={styles.packageSection}>
              <Text style={styles.sectionTitle}>Package Information</Text>
              <View style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <View style={styles.packageMainInfo}>
                    <Text style={styles.packageCode}>{packageInfo.code}</Text>
                    <Text style={styles.packageRoute}>{packageInfo.route.description}</Text>
                  </View>
                  <View style={styles.packageBadges}>
                    <View style={[
                      styles.deliveryTypeBadge,
                      { borderColor: getDeliveryTypeColor(packageInfo.delivery_type) }
                    ]}>
                      <Feather 
                        name={getPackageTypeIcon(packageInfo.delivery_type) as any} 
                        size={12} 
                        color={getDeliveryTypeColor(packageInfo.delivery_type)} 
                      />
                      <Text style={[styles.badgeText, { color: getDeliveryTypeColor(packageInfo.delivery_type) }]}>
                        {packageInfo.delivery_type_display}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStateColor(packageInfo.state) }
                    ]}>
                      <Text style={styles.badgeText}>{packageInfo.state_display.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Feather name="user" size={16} color="#8E8E93" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Sender</Text>
                    <Text style={styles.infoValue}>{packageInfo.sender.name}</Text>
                    <Text style={styles.infoSubValue}>{packageInfo.sender.phone}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Feather name="user-check" size={16} color="#8E8E93" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Receiver</Text>
                    <Text style={styles.infoValue}>{packageInfo.receiver.name}</Text>
                    <Text style={styles.infoSubValue}>{packageInfo.receiver.phone}</Text>
                  </View>
                </View>

                <View style={styles.routeSection}>
                  <View style={styles.routePoint}>
                    <View style={styles.routeDot} />
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeLabel}>Origin</Text>
                      <Text style={styles.routeValue}>{packageInfo.route.origin}</Text>
                    </View>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDot, styles.routeDotDestination]} />
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeLabel}>Destination</Text>
                      <Text style={styles.routeValue}>{packageInfo.route.destination}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.packageDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Cost</Text>
                    <Text style={styles.detailValue}>
                      KES {packageInfo.cost?.toLocaleString() || '0'}
                    </Text>
                  </View>
                  {packageInfo.package_size && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Size</Text>
                      <Text style={styles.detailValue}>{packageInfo.package_size}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Enhanced Timeline */}
            <View style={styles.trackingSection}>
              <Text style={styles.sectionTitle}>Journey Timeline</Text>
              {trackingEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="clock" size={48} color="#8E8E93" />
                  <Text style={styles.emptyStateText}>No tracking events yet</Text>
                </View>
              ) : (
                <View style={styles.timelineContainer}>
                  {trackingEvents.map((event, index) => renderTimelineItem(event, index))}
                </View>
              )}
            </View>
          </>
        )}

        {!packageInfo && !searching && (
          <View style={styles.placeholderContainer}>
            <Feather name="search" size={64} color="#8E8E93" />
            <Text style={styles.placeholderText}>
              Enter a package code to track
            </Text>
            <Text style={styles.placeholderSubtext}>
              View detailed tracking information and history
            </Text>
          </View>
        )}
      </ScrollView>
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
  content: {
    flex: 1,
  },
  searchSection: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7B3F98',
    borderRadius: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 16,
    color: '#e5e7eb',
    fontWeight: '600',
    marginBottom: 8,
  },
  statusEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusEstimateText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  packageSection: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  packageCard: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  packageMainInfo: {
    flex: 1,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  packageRoute: {
    fontSize: 13,
    color: '#888',
  },
  packageBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  deliveryTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  infoSubValue: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  routeSection: {
    marginVertical: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7B3F98',
    marginTop: 4,
  },
  routeDotDestination: {
    backgroundColor: '#34C759',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: 'rgba(123, 63, 152, 0.3)',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  routeValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  packageDetails: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  trackingSection: {
    padding: 16,
    paddingTop: 8,
  },
  timelineContainer: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    minHeight: 60,
  },
  timelineIndicator: {
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  currentTimelineDescription: {
    color: '#10b981',
    fontWeight: '600',
  },
  timelineTimestamp: {
    fontSize: 11,
    color: '#666',
    fontWeight: '400',
  },
  timelineFullTimestamp: {
    fontSize: 11,
    color: '#888',
    marginBottom: 6,
  },
  timelineUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timelineUserText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  timelineLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timelineLocationText: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#1F2C34',
    borderRadius: 12,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
});
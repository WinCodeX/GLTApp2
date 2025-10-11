// app/(drawer)/track/tracking.tsx - Enhanced tracking with proper location display
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Share,
  Linking,
  RefreshControl,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { 
  getPackageDetails,
  getPackageQRCode,
  getPackageTracking,
  type Package,
  type QRCodeResponse
} from '@/lib/helpers/packageHelpers';
import colors from '@/theme/colors';
import api from '@/lib/api';

// Import NavigationHelper
import { NavigationHelper } from '@/lib/helpers/navigation';

interface TimelineEvent {
  id: string;
  status: string;
  timestamp: string;
  description: string;
  active: boolean;
  icon?: string;
  details?: string;
  location?: string;
  agent_name?: string;
  rider_name?: string;
  estimated_time?: string;
  is_current?: boolean;
}

interface TrackingData {
  current_status: string;
  current_location?: string;
  estimated_delivery?: string;
  last_updated: string;
  delivery_attempts: number;
  special_instructions?: string;
  timeline: TimelineEvent[];
  real_time_updates: boolean;
}

export default function PackageTracking() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const packageCode = params.packageCode as string;
  const packageId = params.packageId as string;
  
  // State management
  const [package_, setPackage] = useState<Package | null>(null);
  const [qrData, setQrData] = useState<QRCodeResponse['data'] | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Real-time update animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get delivery type badge color (matching track.tsx exactly)
  const getDeliveryTypeBadgeColor = useCallback((deliveryType: string): string => {
    switch (deliveryType) {
      case 'doorstep':
      case 'home': return '#8b5cf6';
      case 'office':
      case 'agent': return '#3b82f6';
      case 'fragile': return '#f97316';
      case 'collection': return '#10b981';
      default: return '#8b5cf6';
    }
  }, []);

  // Get delivery type display name (matching track.tsx exactly)
  const getDeliveryTypeDisplay = useCallback((deliveryType: string): string => {
    switch (deliveryType) {
      case 'doorstep':
      case 'home': return 'Home';
      case 'office':
      case 'agent': return 'Office';
      case 'fragile': return 'Fragile';
      case 'collection': return 'Collection';
      default: return 'Office';
    }
  }, []);

  // Get state badge color (matching track.tsx exactly)
  const getStateBadgeColor = useCallback((state: string): string => {
    switch (state) {
      case 'pending_unpaid': return '#ef4444';
      case 'pending': return '#f97316';
      case 'submitted': return '#eab308';
      case 'in_transit': return '#8b5cf6';
      case 'delivered': return '#10b981';
      case 'collected': return '#2563eb';
      case 'rejected': return '#ef4444';
      default: return colors.primary;
    }
  }, []);

  // Get package type specific icon
  const getPackageTypeIcon = useCallback((deliveryType: string): string => {
    switch (deliveryType) {
      case 'collection': return 'shopping-bag';
      case 'fragile': return 'shield-alert';
      case 'doorstep':
      case 'home': return 'home';
      case 'office':
      case 'agent': return 'briefcase';
      default: return 'package';
    }
  }, []);

  // ENHANCED: Get proper delivery location display
  const getDeliveryLocationDisplay = useCallback((pkg: Package | null): string => {
    if (!pkg) return 'Location not available';
    
    // Priority order for location display
    if (pkg.delivery_location) {
      return pkg.delivery_location;
    }
    
    if (pkg.pickup_location) {
      return pkg.pickup_location;
    }
    
    if (pkg.destination_area) {
      const area = pkg.destination_area_name || pkg.destination_area;
      const location = pkg.destination_location_name;
      return location ? `${area}, ${location}` : area;
    }
    
    if (pkg.destination_agent_name) {
      return `Agent: ${pkg.destination_agent_name}`;
    }
    
    // Fallback based on delivery type
    switch (pkg.delivery_type) {
      case 'agent':
        return 'Agent Pickup';
      case 'collection':
        return 'Collection Service';
      default:
        return 'To be confirmed';
    }
  }, []);

  // ENHANCED: Real-time tracking data fetch
  const fetchTrackingData = useCallback(async (packageCodeOrId: string): Promise<TrackingData | null> => {
    try {
      console.log('📍 Fetching real-time tracking data for:', packageCodeOrId);
      
      const response = await api.get(`/api/v1/packages/${packageCodeOrId}/tracking`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.success) {
        const data = response.data.data;
        
        // Transform tracking events into timeline format
        const timelineEvents: TimelineEvent[] = (data.tracking_events || []).map((event: any, index: number) => ({
          id: event.id || `event-${index}`,
          status: event.event_type || event.status || 'unknown',
          timestamp: event.created_at || event.timestamp || new Date().toISOString(),
          description: event.description || event.event_description || 'Status update',
          active: true,
          icon: getEventIcon(event.event_type || event.status),
          details: event.details || event.metadata?.details,
          location: event.location || event.metadata?.location,
          agent_name: event.agent_name || event.metadata?.agent_name,
          rider_name: event.rider_name || event.metadata?.rider_name,
          estimated_time: event.estimated_time || event.metadata?.estimated_delivery,
          is_current: event.is_current || false
        }));

        // Sort timeline by timestamp
        timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const trackingData: TrackingData = {
          current_status: data.current_status || 'unknown',
          current_location: data.current_location,
          estimated_delivery: data.estimated_delivery,
          last_updated: data.last_updated || new Date().toISOString(),
          delivery_attempts: data.delivery_attempts || 0,
          special_instructions: data.special_instructions,
          timeline: timelineEvents,
          real_time_updates: data.real_time_updates !== false
        };

        console.log('✅ Real-time tracking data loaded:', {
          status: trackingData.current_status,
          location: trackingData.current_location,
          timelineEvents: timelineEvents.length,
          realTime: trackingData.real_time_updates
        });

        return trackingData;
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Failed to fetch tracking data:', error);
      return null;
    }
  }, []);

  // Get icon for timeline events
  const getEventIcon = useCallback((eventType: string): string => {
    switch (eventType) {
      case 'created': return 'plus-circle';
      case 'payment_received': return 'credit-card';
      case 'submitted_for_delivery': return 'upload';
      case 'printed_by_agent': return 'printer';
      case 'collected_by_rider': return 'user-check';
      case 'in_transit': return 'truck';
      case 'out_for_delivery': return 'navigation';
      case 'delivered_by_rider': return 'package';
      case 'confirmed_by_receiver': return 'check-circle';
      case 'collection_scheduled': return 'calendar';
      case 'collection_in_progress': return 'shopping-cart';
      case 'collection_completed': return 'check-square';
      case 'rejected': return 'x-circle';
      case 'returned': return 'rotate-ccw';
      default: return 'info';
    }
  }, []);

  // ENHANCED: Load package data with real-time tracking
  const loadPackageData = useCallback(async () => {
    if (!packageCode) {
      setError('Package code is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📦 Loading enhanced package data for code:', packageCode);
      
      // Load package details
      let packageData;
      if (packageId) {
        console.log('📦 Attempting to load by ID:', packageId);
        try {
          packageData = await getPackageDetails(packageId);
        } catch (idError) {
          console.warn('⚠️ Failed to load by ID, trying by code:', idError);
          packageData = await getPackageDetails(packageCode);
        }
      } else {
        console.log('📦 Loading by code only:', packageCode);
        packageData = await getPackageDetails(packageCode);
      }
      
      if (!packageData) {
        throw new Error('Package not found');
      }

      console.log('✅ Package data loaded:', packageData.code || packageData.id);
      setPackage(packageData);
      
      // Load real-time tracking data
      const tracking = await fetchTrackingData(packageCode);
      if (tracking) {
        setTrackingData(tracking);
        setTimeline(tracking.timeline);
        setLastUpdateTime(new Date(tracking.last_updated));
        
        // Start real-time updates if enabled
        if (tracking.real_time_updates && ['in_transit', 'out_for_delivery', 'collection_in_progress'].includes(tracking.current_status)) {
          startRealTimeUpdates();
        }
      } else {
        // Fallback to basic timeline
        setTimeline(createBasicTimelineFromPackage(packageData));
      }
      
      // Load QR code
      setIsLoadingQR(true);
      try {
        const qrResponse = await getPackageQRCode(packageCode);
        if (qrResponse?.data) {
          setQrData(qrResponse.data);
          console.log('✅ QR code loaded for tracking');
        }
      } catch (qrError) {
        console.warn('⚠️ Failed to load QR code, creating fallback:', qrError);
        setQrData({
          qr_code_base64: null,
          tracking_url: `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/public/track/${packageCode}`,
          package_code: packageCode,
          package_state: packageData.state,
          route_description: packageData.route_description
        });
      } finally {
        setIsLoadingQR(false);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load package data:', error);
      setError(error.message || 'Failed to load package details');
      
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Package',
        text2: error.message || 'Unable to load package details',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [packageCode, packageId, fetchTrackingData]);

  // Create basic timeline from package data (fallback)
  const createBasicTimelineFromPackage = useCallback((pkg: Package): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        id: 'created',
        status: 'created',
        timestamp: pkg.created_at,
        description: pkg.delivery_type === 'collection' ? 
          'Collection request created' : 
          'Package created and details submitted',
        active: true,
        icon: 'plus-circle',
        details: `Cost: KES ${pkg.cost?.toLocaleString() || '0'}`
      }
    ];

    // Add current state if different
    if (pkg.state !== 'pending_unpaid') {
      events.push({
        id: pkg.state,
        status: pkg.state,
        timestamp: pkg.updated_at,
        description: getStatusDescription(pkg.state, pkg.delivery_type),
        active: true,
        icon: getEventIcon(pkg.state)
      });
    }

    return events;
  }, []);

  // Get status description
  const getStatusDescription = useCallback((state: string, deliveryType: string): string => {
    switch (state) {
      case 'pending_unpaid':
        return deliveryType === 'collection' ? 
          'Collection request created - awaiting payment' :
          'Package created - awaiting payment';
      case 'pending':
        return 'Payment received - preparing for pickup';
      case 'submitted':
        return deliveryType === 'collection' ? 
          'Collection scheduled' :
          'Package submitted for delivery';
      case 'in_transit':
        return 'Package is being transported';
      case 'out_for_delivery':
        return 'Package is out for delivery';
      case 'delivered':
        return 'Package delivered successfully';
      case 'collected':
        return 'Package collected by recipient';
      case 'rejected':
        return 'Package delivery was rejected';
      default:
        return state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }, []);

  // Start real-time updates
  const startRealTimeUpdates = useCallback(() => {
    console.log('🔄 Starting real-time updates...');
    
    // Pulse animation for real-time indicator
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
    pulseAnimation();

    // Update tracking data every 30 seconds
    updateIntervalRef.current = setInterval(async () => {
      try {
        console.log('🔄 Fetching real-time update...');
        const tracking = await fetchTrackingData(packageCode);
        if (tracking) {
          setTrackingData(tracking);
          setTimeline(tracking.timeline);
          setLastUpdateTime(new Date(tracking.last_updated));
        }
      } catch (error) {
        console.error('❌ Real-time update failed:', error);
      }
    }, 30000); // 30 seconds

  }, [fetchTrackingData, packageCode, pulseAnim]);

  // Stop real-time updates
  const stopRealTimeUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    pulseAnim.stopAnimation();
  }, [pulseAnim]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPackageData();
    setIsRefreshing(false);
  }, [loadPackageData]);

  // Handle share tracking
  const handleShareTracking = useCallback(async () => {
    if (!package_ || !qrData) return;
    
    try {
      await Share.share({
        message: `Track your GLT ${getDeliveryTypeDisplay(package_.delivery_type)} package: ${package_.code}\n\nRoute: ${package_.route_description}\n\nTracking: ${qrData.tracking_url}`,
        title: `GLT ${getDeliveryTypeDisplay(package_.delivery_type)} Package ${package_.code}`,
        url: qrData.tracking_url,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [package_, qrData, getDeliveryTypeDisplay]);

  // Handle open tracking URL
  const handleOpenTrackingUrl = useCallback(async () => {
    if (!qrData?.tracking_url) return;
    
    try {
      await Linking.openURL(qrData.tracking_url);
    } catch (error) {
      console.error('Failed to open tracking URL:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Open Link',
        text2: 'Could not open tracking URL',
        position: 'top',
        visibilityTime: 2000,
      });
    }
  }, [qrData]);

  // ENHANCED: Navigation handlers using NavigationHelper
  const handleBack = useCallback(() => {
    console.log('🔙 Back button pressed');
    
    // Stop real-time updates when leaving
    stopRealTimeUpdates();
    
    if (params.from) {
      console.log('🔙 Going to from parameter:', params.from);
      NavigationHelper.navigateTo(params.from as string);
    } else {
      console.log('🔙 Going to track listing (default)');
      NavigationHelper.navigateTo('/(drawer)/track');
    }
  }, [params, stopRealTimeUpdates]);

  // Handle report package
  const handleReportPackage = useCallback(() => {
    if (!package_) return;
    
    console.log('📋 Reporting package from tracking:', package_.code);
    
    // Stop real-time updates
    stopRealTimeUpdates();
    
    // Navigate to support screen with package pre-filled
    NavigationHelper.navigateTo('/(drawer)/support', {
      params: { 
        autoSelectPackage: 'true',
        packageCode: package_.code,
        packageId: package_.id.toString()
      }
    });
  }, [package_, stopRealTimeUpdates]);

  // Load data when component mounts
  useEffect(() => {
    if (packageCode) {
      loadPackageData();
    } else {
      setError('Package code is required');
      setIsLoading(false);
    }

    // Cleanup on unmount
    return () => {
      stopRealTimeUpdates();
    };
  }, [loadPackageData, packageCode, stopRealTimeUpdates]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  }, []);

  // Format time ago
  const formatTimeAgo = useCallback((timestamp: string): string => {
    try {
      const now = new Date();
      const time = new Date(timestamp);
      const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } catch {
      return 'Unknown';
    }
  }, []);

  // Render timeline item with enhanced styling
  const renderTimelineItem = useCallback(({ item, index }: { item: TimelineEvent; index: number }) => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIndicator}>
        <Animated.View style={[
          styles.timelineDot,
          { 
            backgroundColor: item.active ? getStateBadgeColor(item.status) : '#444',
            transform: item.is_current ? [{ scale: pulseAnim }] : [{ scale: 1 }]
          }
        ]}>
          {item.icon && (
            <Feather 
              name={item.icon as any} 
              size={item.is_current ? 10 : 8} 
              color={item.active ? '#fff' : '#888'} 
            />
          )}
        </Animated.View>
        {index < timeline.length - 1 && (
          <View style={[
            styles.timelineLine,
            { backgroundColor: item.active ? getStateBadgeColor(item.status) : '#444' }
          ]} />
        )}
      </View>
      
      <View style={styles.timelineContent}>
        <View style={styles.timelineHeader}>
          <Text style={[
            styles.timelineDescription,
            { color: item.active ? '#fff' : '#888' },
            item.is_current && styles.currentTimelineDescription
          ]}>
            {item.description}
          </Text>
          <Text style={styles.timelineTimestamp}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
        
        {item.details && (
          <Text style={styles.timelineDetails}>{item.details}</Text>
        )}
        
        {item.location && (
          <View style={styles.timelineLocation}>
            <Feather name="map-pin" size={12} color="#8b5cf6" />
            <Text style={styles.timelineLocationText}>{item.location}</Text>
          </View>
        )}
        
        {(item.agent_name || item.rider_name) && (
          <View style={styles.timelineAgent}>
            <Feather name="user" size={12} color="#10b981" />
            <Text style={styles.timelineAgentText}>
              {item.agent_name || item.rider_name}
            </Text>
          </View>
        )}
        
        {item.estimated_time && (
          <View style={styles.timelineEstimate}>
            <Feather name="clock" size={12} color="#f59e0b" />
            <Text style={styles.timelineEstimateText}>
              Est: {formatTimestamp(item.estimated_time)}
            </Text>
          </View>
        )}
      </View>
    </View>
  ), [timeline.length, formatTimestamp, getStateBadgeColor, pulseAnim]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={[colors.background, 'rgba(22, 33, 62, 0.95)']}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>Loading...</Text>
          </LinearGradient>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading package details...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error || !package_) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={[colors.background, 'rgba(22, 33, 62, 0.95)']}
            style={styles.header}
          >
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Error</Text>
          </LinearGradient>
        </View>
        
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Package Not Found</Text>
          <Text style={styles.errorMessage}>{error || 'Unable to load package details'}</Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={loadPackageData}>
            <Feather name="refresh-cw" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      {/* Fixed Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[colors.background, 'rgba(22, 33, 62, 0.95)']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>
                {getDeliveryTypeDisplay(package_.delivery_type)} Tracking
              </Text>
              <Text style={styles.headerSubtitle}>{package_.code}</Text>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerActionButton} onPress={handleReportPackage}>
                <Feather name="flag" size={18} color="#f97316" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.headerActionButton} onPress={handleShareTracking}>
                <Feather name="share" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Real-time status indicator */}
          {trackingData?.real_time_updates && (
            <View style={styles.realTimeIndicator}>
              <Animated.View style={[styles.realTimeDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.realTimeText}>
                Live tracking • Updated {formatTimeAgo(lastUpdateTime.toISOString())}
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Real-time Status Card */}
        {trackingData && (
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
              </View>
              
              <Text style={styles.statusDescription}>
                {getStatusDescription(trackingData.current_status, package_.delivery_type)}
              </Text>
              
              {trackingData.current_location && (
                <View style={styles.statusLocation}>
                  <Feather name="map-pin" size={14} color="#10b981" />
                  <Text style={styles.statusLocationText}>{trackingData.current_location}</Text>
                </View>
              )}
              
              {trackingData.estimated_delivery && (
                <View style={styles.statusEstimate}>
                  <Feather name="clock" size={14} color="#f59e0b" />
                  <Text style={styles.statusEstimateText}>
                    Est. delivery: {formatTimestamp(trackingData.estimated_delivery)}
                  </Text>
                </View>
              )}
              
              {trackingData.delivery_attempts > 0 && (
                <View style={styles.statusAttempts}>
                  <Feather name="repeat" size={14} color="#ef4444" />
                  <Text style={styles.statusAttemptsText}>
                    Delivery attempts: {trackingData.delivery_attempts}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>
        )}

        {/* Package Summary Card */}
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryHeader}>
              <View style={styles.summaryInfo}>
                <View style={styles.summaryMainInfo}>
                  <Text style={styles.summaryCode}>{package_.code}</Text>
                  <Text style={styles.summaryRoute}>{package_.route_description}</Text>
                </View>
                <View style={styles.summaryBadges}>
                  <View style={[
                    styles.deliveryTypeBadge, 
                    { borderColor: getDeliveryTypeBadgeColor(package_.delivery_type) }
                  ]}>
                    <Feather 
                      name={getPackageTypeIcon(package_.delivery_type) as any} 
                      size={12} 
                      color={getDeliveryTypeBadgeColor(package_.delivery_type)} 
                    />
                    <Text style={[styles.badgeText, { color: getDeliveryTypeBadgeColor(package_.delivery_type) }]}>
                      {getDeliveryTypeDisplay(package_.delivery_type)}
                    </Text>
                  </View>
                  <View style={[
                    styles.stateBadge, 
                    { backgroundColor: getStateBadgeColor(package_.state) }
                  ]}>
                    <Text style={styles.badgeText}>{package_.state_display?.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </View>
            
            <View style={styles.summaryDetails}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sender</Text>
                <Text style={styles.summaryValue}>{package_.sender_name}</Text>
                <Text style={styles.summarySubValue}>{package_.sender_phone}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Receiver</Text>
                <Text style={styles.summaryValue}>{package_.receiver_name}</Text>
                <Text style={styles.summarySubValue}>{package_.receiver_phone}</Text>
              </View>
              
              <View style={styles.summaryRowHorizontal}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Cost</Text>
                  <Text style={styles.summaryCost}>
                    KES {package_.cost?.toLocaleString() || '0'}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Delivery Location</Text>
                  <Text style={styles.summaryValue}>
                    {getDeliveryLocationDisplay(package_)}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Enhanced Timeline Card */}
        <View style={styles.timelineCard}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
            style={styles.timelineGradient}
          >
            <View style={styles.timelineHeader}>
              <Feather name="clock" size={20} color={colors.primary} />
              <Text style={styles.timelineTitle}>Journey Timeline</Text>
              {trackingData?.real_time_updates && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            
            <View style={styles.timelineList}>
              {timeline.map((item, index) => (
                <View key={item.id || `${item.status}-${index}`}>
                  {renderTimelineItem({ item, index })}
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* QR Code Section */}
        <View style={styles.qrCodeCard}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
            style={styles.qrCodeGradient}
          >
            <View style={styles.qrCodeHeader}>
              <Feather name="smartphone" size={20} color={colors.primary} />
              <Text style={styles.qrCodeTitle}>QR Code for Tracking</Text>
            </View>
            
            {isLoadingQR ? (
              <View style={styles.qrCodeLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.qrCodeLoadingText}>Generating QR code...</Text>
              </View>
            ) : qrData?.qr_code_base64 ? (
              <View style={styles.qrCodeContainer}>
                <View style={styles.qrCodeImageContainer}>
                  <Image
                    source={{ uri: qrData.qr_code_base64 }}
                    style={styles.qrCodeImage}
                    resizeMode="contain"
                  />
                </View>
                
                <Text style={styles.qrCodeInstructions}>
                  Scan this QR code to track your package from any device
                </Text>
                
                <View style={styles.qrCodeActions}>
                  <TouchableOpacity style={styles.qrCodeAction} onPress={handleOpenTrackingUrl}>
                    <Feather name="external-link" size={16} color={colors.primary} />
                    <Text style={styles.qrCodeActionText}>Open Tracking Page</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.qrCodeAction} onPress={handleShareTracking}>
                    <Feather name="share-2" size={16} color={colors.primary} />
                    <Text style={styles.qrCodeActionText}>Share Tracking</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : qrData?.tracking_url ? (
              <View style={styles.qrCodeFallback}>
                <Feather name="link" size={48} color="#666" />
                <Text style={styles.qrCodeFallbackTitle}>QR Code Unavailable</Text>
                <Text style={styles.qrCodeFallbackSubtitle}>
                  Use tracking code: {package_.code}
                </Text>
                
                <TouchableOpacity style={styles.trackingUrlButton} onPress={handleOpenTrackingUrl}>
                  <Feather name="external-link" size={16} color="#fff" />
                  <Text style={styles.trackingUrlButtonText}>Open Tracking Page</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.qrCodeError}>
                <Feather name="alert-circle" size={32} color="#ef4444" />
                <Text style={styles.qrCodeErrorText}>Unable to generate QR code</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header styles
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  header: {
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Real-time indicator
  realTimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  realTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  realTimeText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },

  // Content
  content: {
    flex: 1,
  },

  // Status card
  statusCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
  },
  statusDescription: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20,
    marginBottom: 12,
  },
  statusLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusLocationText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  statusEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusEstimateText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  statusAttempts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusAttemptsText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },

  // Summary card
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  summaryGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  summaryHeader: {
    marginBottom: 20,
  },
  summaryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryMainInfo: {
    flex: 1,
  },
  summaryCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  summaryRoute: {
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  summaryBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  deliveryTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    gap: 4,
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  summaryDetails: {
    gap: 16,
  },
  summaryRow: {
    gap: 4,
  },
  summaryRowHorizontal: {
    flexDirection: 'row',
    gap: 20,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  summarySubValue: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  summaryCost: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },

  // Timeline card
  timelineCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  timelineGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginLeft: 8,
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
  timelineList: {
    gap: 0,
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
  timelineDetails: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
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
  timelineAgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timelineAgentText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  timelineEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timelineEstimateText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },

  // QR Code card
  qrCodeCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  qrCodeGradient: {
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    alignItems: 'center',
  },
  qrCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  qrCodeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  qrCodeLoading: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  qrCodeLoadingText: {
    fontSize: 14,
    color: '#888',
  },
  qrCodeContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrCodeImageContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrCodeImage: {
    width: 160,
    height: 160,
  },
  qrCodeInstructions: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  qrCodeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  qrCodeAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    gap: 6,
  },
  qrCodeActionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },

  // QR Code fallback
  qrCodeFallback: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  qrCodeFallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginTop: 8,
  },
  qrCodeFallbackSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  trackingUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 8,
  },
  trackingUrlButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },

  // QR Code error
  qrCodeError: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  qrCodeErrorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
  },

  // Error states
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
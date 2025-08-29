// app/(drawer)/track/tracking.tsx - Enhanced detailed tracking with collection and fragile package support
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { 
  getPackageDetails,
  getPackageQRCode,
  type Package,
  type QRCodeResponse
} from '@/lib/helpers/packageHelpers';
import colors from '@/theme/colors';

interface TimelineEvent {
  status: string;
  timestamp: string;
  description: string;
  active: boolean;
  icon?: string;
  details?: string;
}

export default function PackageTracking() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const packageCode = params.packageCode as string;
  const packageId = params.packageId as string;
  
  // State management
  const [package_, setPackage] = useState<Package | null>(null);
  const [qrData, setQrData] = useState<QRCodeResponse['data'] | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get delivery type badge color (matching track.tsx)
  const getDeliveryTypeBadgeColor = useCallback((deliveryType: string): string => {
    switch (deliveryType) {
      case 'collection': return '#f59e0b'; // Amber for collections
      case 'fragile': return '#ef4444'; // Red for fragile items
      case 'doorstep': return '#10b981'; // Green for doorstep
      case 'office': return '#3b82f6'; // Blue for office
      case 'mixed': return '#8b5cf6'; // Purple for mixed
      default: return colors.primary;
    }
  }, []);

  // Get delivery type display name (matching track.tsx)
  const getDeliveryTypeDisplay = useCallback((deliveryType: string): string => {
    switch (deliveryType) {
      case 'collection': return 'Collection';
      case 'fragile': return 'Fragile';
      case 'doorstep': return 'Home';
      case 'office': return 'Office';
      case 'agent': return 'Office';
      case 'mixed': return 'Mixed';
      default: return deliveryType.charAt(0).toUpperCase() + deliveryType.slice(1);
    }
  }, []);

  // Get state badge color (enhanced)
  const getStateBadgeColor = useCallback((state: string): string => {
    switch (state) {
      case 'pending_unpaid': return '#f59e0b';
      case 'pending': return '#10b981';
      case 'submitted': return '#3b82f6';
      case 'in_transit': return '#8b5cf6';
      case 'out_for_delivery': return '#0ea5e9';
      case 'delivered': return '#059669';
      case 'collected': return '#0d9488';
      case 'collection_scheduled': return '#f97316';
      case 'collection_in_progress': return '#eab308';
      case 'collection_completed': return '#22c55e';
      case 'rejected': return '#ef4444';
      case 'returned': return '#6b7280';
      default: return colors.primary;
    }
  }, []);

  // Get package type specific icon
  const getPackageTypeIcon = useCallback((deliveryType: string): string => {
    switch (deliveryType) {
      case 'collection': return 'shopping-bag';
      case 'fragile': return 'shield-alert';
      case 'doorstep': return 'home';
      case 'office': return 'building';
      default: return 'package';
    }
  }, []);

  // Get delivery type badge style with outline pattern (matching track.tsx)
  const getDeliveryTypeBadgeStyle = useCallback((deliveryType: string) => {
    const baseColor = getDeliveryTypeBadgeColor(deliveryType);
    // Convert hex to rgba for outline effect
    const colorMap: Record<string, { bg: string; border: string }> = {
      '#f59e0b': { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.4)' }, // Collection
      '#ef4444': { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' },   // Fragile  
      '#3b82f6': { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.4)' }, // Home
      '#8b5cf6': { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgba(139, 92, 246, 0.4)' }, // Office
    };
    
    return colorMap[baseColor] || { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgba(139, 92, 246, 0.4)' };
  }, [getDeliveryTypeBadgeColor]);

  // Get status description based on package type
  const getStatusDescription = useCallback((state: string, deliveryType: string): string => {
    switch (state) {
      case 'pending_unpaid':
        return deliveryType === 'collection' ? 
          'Collection request created - awaiting payment' :
          'Package created - awaiting payment';
      
      case 'pending':
        return deliveryType === 'collection' ? 
          'Collection request paid - awaiting scheduling' :
          'Package paid - awaiting pickup scheduling';
      
      case 'submitted':
        return deliveryType === 'collection' ? 
          'Collection scheduled - rider will visit shop' :
          deliveryType === 'fragile' ?
            'Fragile package submitted - special handling assigned' :
            'Package submitted and ready for pickup';
      
      case 'collection_scheduled':
        return 'Collection appointment scheduled with shop';
      
      case 'collection_in_progress':
        return 'Rider is currently collecting items from shop';
      
      case 'collection_completed':
        return 'Items collected successfully - now in transit';
      
      case 'in_transit':
        return deliveryType === 'fragile' ? 
          'Fragile package in transit - handled with special care' :
          'Package is being transported to destination';
      
      case 'out_for_delivery':
        return deliveryType === 'fragile' ? 
          'Fragile package out for delivery - rider will handle with care' :
          'Package is out for delivery to final destination';
      
      case 'delivered':
        return deliveryType === 'doorstep' ? 
          'Package delivered to your home' :
          'Package delivered to destination area';
      
      case 'collected':
        return deliveryType === 'office' || deliveryType === 'agent' ? 
          'Package collected from our office' :
          'Package collected by recipient';
      
      case 'rejected':
        return 'Package delivery was rejected or failed';
      
      case 'returned':
        return 'Package returned to sender';
      
      default:
        return state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }, []);

  // Create enhanced timeline from package data
  const createTimelineFromPackage = useCallback((pkg: Package): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        status: 'created',
        timestamp: pkg.created_at,
        description: pkg.delivery_type === 'collection' ? 
          'Collection request created' : 
          'Package created and details submitted',
        active: true,
        icon: 'plus-circle',
        details: pkg.delivery_type === 'collection' ? 
          `Items to collect: ${pkg.items_to_collect || 'Various items'}` :
          `From: ${pkg.sender_name}`
      }
    ];

    // Add payment event if not pending unpaid
    if (pkg.state !== 'pending_unpaid') {
      events.push({
        status: 'paid',
        timestamp: pkg.updated_at,
        description: pkg.delivery_type === 'collection' ?
          'Collection fee paid successfully' :
          'Payment processed successfully',
        active: true,
        icon: 'credit-card',
        details: `Amount: KES ${pkg.cost?.toLocaleString() || '0'}`
      });
    }

    // Add collection-specific events
    if (pkg.delivery_type === 'collection') {
      if (['collection_scheduled', 'collection_in_progress', 'collection_completed', 'in_transit', 'delivered', 'collected'].includes(pkg.state)) {
        events.push({
          status: 'collection_scheduled',
          timestamp: pkg.collection_scheduled_at || pkg.updated_at,
          description: 'Collection appointment scheduled',
          active: true,
          icon: 'calendar',
          details: pkg.shop_name ? `Shop: ${pkg.shop_name}` : 'Collection location confirmed'
        });
      }

      if (['collection_in_progress', 'collection_completed', 'in_transit', 'delivered', 'collected'].includes(pkg.state)) {
        events.push({
          status: 'collection_in_progress',
          timestamp: pkg.updated_at,
          description: 'Rider collecting items from shop',
          active: pkg.state !== 'collection_in_progress',
          icon: 'user-check',
          details: 'Items being collected as requested'
        });
      }

      if (['collection_completed', 'in_transit', 'delivered', 'collected'].includes(pkg.state)) {
        events.push({
          status: 'collection_completed',
          timestamp: pkg.updated_at,
          description: 'Collection completed successfully',
          active: pkg.state !== 'collection_completed',
          icon: 'check-circle',
          details: 'All items collected and verified'
        });
      }
    }

    // Add fragile-specific handling events
    if (pkg.delivery_type === 'fragile') {
      events.push({
        status: 'special_handling',
        timestamp: pkg.updated_at,
        description: 'Special handling procedures applied',
        active: true,
        icon: 'shield',
        details: 'Package marked for careful handling'
      });
    }

    // Add current state if different and not already covered
    const coveredStates = ['created', 'paid', 'collection_scheduled', 'collection_in_progress', 'collection_completed'];
    if (!coveredStates.includes(pkg.state)) {
      events.push({
        status: pkg.state,
        timestamp: pkg.updated_at,
        description: getStatusDescription(pkg.state, pkg.delivery_type),
        active: true,
        icon: pkg.state === 'delivered' ? 'check-circle' : 
              pkg.state === 'in_transit' ? 'truck' :
              pkg.state === 'rejected' ? 'x-circle' : 'info'
      });
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [getStatusDescription]);

  // Load package data
  const loadPackageData = useCallback(async () => {
    if (!packageCode) {
      setError('Package code is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📦 Loading package data for code:', packageCode);
      console.log('📦 Package ID:', packageId);
      console.log('📦 From page:', params.from);
      
      // Try to use packageId first if available, then fallback to packageCode
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
      
      if (packageData) {
        console.log('✅ Package data loaded:', packageData.code || packageData.id);
        console.log('📦 Package state:', packageData.state);
        console.log('📦 Package type:', packageData.delivery_type);
        
        setPackage(packageData);
        setTimeline(createTimelineFromPackage(packageData));
        
        // Load QR code
        setIsLoadingQR(true);
        try {
          // Use package ID for QR code endpoint (not package code)
          const qrResponse = await getPackageQRCode(packageData.id);
          if (qrResponse?.data) {
            setQrData(qrResponse.data);
            console.log('✅ QR code loaded for tracking');
          }
        } catch (qrError) {
          console.warn('⚠️ Failed to load QR code (non-critical):', qrError);
        } finally {
          setIsLoadingQR(false);
        }
        
      } else {
        throw new Error('Package not found or invalid response');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load package data:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        response: error.response?.data
      });
      
      const errorMessage = error.message || 'Failed to load package details';
      setError(errorMessage);
      
      Toast.show({
        type: 'errorToast',
        text1: 'Failed to Load Package',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [packageCode, packageId, params.from, createTimelineFromPackage]);

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
        type: 'errorToast',
        text1: 'Failed to Open Link',
        text2: 'Could not open tracking URL',
        position: 'top',
        visibilityTime: 2000,
      });
    }
  }, [qrData]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    console.log('🔙 Back button pressed');
    
    if (params.from) {
      console.log('🔙 Going to from parameter:', params.from);
      router.replace(params.from as string);
    } else {
      console.log('🔙 Going to track listing (default)');
      router.replace('/(drawer)/track');
    }
  }, [router, params]);

  // Load data when component mounts
  useEffect(() => {
    if (packageCode) {
      loadPackageData().catch((error) => {
        console.error('Failed to load package data in useEffect:', error);
        setError(error.message || 'Failed to load package data');
        setIsLoading(false);
      });
    } else {
      setError('Package code is required');
      setIsLoading(false);
    }
  }, [loadPackageData, packageCode]);

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

  // Render collection-specific details
  const renderCollectionDetails = useCallback(() => {
    if (!package_ || package_.delivery_type !== 'collection') return null;

    return (
      <View style={styles.specialDetailsCard}>
        <LinearGradient
          colors={['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.05)']}
          style={styles.specialDetailsGradient}
        >
          <View style={styles.specialDetailsHeader}>
            <View style={styles.specialDetailsIcon}>
              <Feather name="shopping-bag" size={20} color="#f59e0b" />
            </View>
            <Text style={styles.specialDetailsTitle}>Collection Details</Text>
          </View>
          
          <View style={styles.specialDetailsContent}>
            {package_.shop_name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shop/Store:</Text>
                <Text style={styles.detailValue}>{package_.shop_name}</Text>
              </View>
            )}
            
            {package_.shop_contact && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shop Contact:</Text>
                <Text style={styles.detailValue}>{package_.shop_contact}</Text>
              </View>
            )}
            
            {package_.collection_address && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Collection Address:</Text>
                <Text style={styles.detailValue}>{package_.collection_address}</Text>
              </View>
            )}
            
            {package_.items_to_collect && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Items to Collect:</Text>
                <Text style={styles.detailValue}>{package_.items_to_collect}</Text>
              </View>
            )}
            
            {package_.item_value && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Item Value:</Text>
                <Text style={[styles.detailValue, styles.valueText]}>
                  KES {package_.item_value.toLocaleString()}
                </Text>
              </View>
            )}
            
            {package_.special_instructions && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Special Instructions:</Text>
                <Text style={styles.detailValue}>{package_.special_instructions}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }, [package_]);

  // Render fragile-specific details
  const renderFragileDetails = useCallback(() => {
    if (!package_ || package_.delivery_type !== 'fragile') return null;

    return (
      <View style={styles.specialDetailsCard}>
        <LinearGradient
          colors={['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.05)']}
          style={styles.specialDetailsGradient}
        >
          <View style={styles.specialDetailsHeader}>
            <View style={styles.specialDetailsIcon}>
              <Feather name="shield-alert" size={20} color="#ef4444" />
            </View>
            <Text style={styles.specialDetailsTitle}>Fragile Item Handling</Text>
          </View>
          
          <View style={styles.specialDetailsContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Special Care:</Text>
              <Text style={styles.detailValue}>This package requires careful handling</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Priority:</Text>
              <Text style={[styles.detailValue, { color: '#ef4444' }]}>High Priority Delivery</Text>
            </View>
            
            {package_.item_description && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Item Description:</Text>
                <Text style={styles.detailValue}>{package_.item_description}</Text>
              </View>
            )}
            
            {package_.special_instructions && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Handling Instructions:</Text>
                <Text style={styles.detailValue}>{package_.special_instructions}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }, [package_]);

  // Render timeline item
  const renderTimelineItem = useCallback(({ item, index }: { item: TimelineEvent; index: number }) => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIndicator}>
        <View style={[
          styles.timelineDot,
          { backgroundColor: item.active ? getStateBadgeColor(item.status) : '#444' }
        ]}>
          {item.icon && (
            <Feather 
              name={item.icon as any} 
              size={8} 
              color={item.active ? '#fff' : '#888'} 
            />
          )}
        </View>
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
            { color: item.active ? '#fff' : '#888' }
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
      </View>
    </View>
  ), [timeline.length, formatTimestamp, getStateBadgeColor]);

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
            
            <TouchableOpacity style={styles.shareButton} onPress={handleShareTracking}>
              <Feather name="share" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                    { 
                      backgroundColor: getDeliveryTypeBadgeStyle(package_.delivery_type).bg,
                      borderColor: getDeliveryTypeBadgeStyle(package_.delivery_type).border
                    }
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
                    <Text style={styles.badgeText}>{package_.state_display}</Text>
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
                    {package_.delivery_location || 'Standard delivery'}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Collection-specific details */}
        {renderCollectionDetails()}

        {/* Fragile-specific details */}
        {renderFragileDetails()}

        {/* Timeline Card */}
        <View style={styles.timelineCard}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
            style={styles.timelineGradient}
          >
            <View style={styles.timelineHeader}>
              <Feather name="clock" size={20} color={colors.primary} />
              <Text style={styles.timelineTitle}>Journey Timeline</Text>
            </View>
            
            <View style={styles.timelineList}>
              {timeline.map((item, index) => (
                <View key={`${item.status}-${index}`}>
                  {renderTimelineItem({ item, index })}
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* QR Code Card */}
        {qrData && (
          <View style={styles.qrCard}>
            <LinearGradient
              colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
              style={styles.qrGradient}
            >
              <View style={styles.qrHeader}>
                <Feather name="qr-code" size={20} color={colors.primary} />
                <Text style={styles.qrTitle}>QR Code</Text>
              </View>
              
              <View style={styles.qrContent}>
                {isLoadingQR ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <Image 
                    source={{ uri: qrData.qr_code_url }} 
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                )}
                
                <Text style={styles.qrDescription}>
                  Scan this QR code to track your package
                </Text>
                
                <TouchableOpacity 
                  style={styles.trackingButton}
                  onPress={handleOpenTrackingUrl}
                >
                  <Feather name="external-link" size={16} color="#fff" />
                  <Text style={styles.trackingButtonText}>Open Tracking Page</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

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
    paddingBottom: 16,
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
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  
  // Content
  content: {
    flex: 1,
  },
  
  // Summary card
  summaryCard: {
    margin: 20,
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
  
  // Special details card
  specialDetailsCard: {
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
  specialDetailsGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  specialDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  specialDetailsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  specialDetailsContent: {
    gap: 12,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 18,
  },
  valueText: {
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
    gap: 8,
    marginBottom: 20,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  
  // QR card
  qrCard: {
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
  qrGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  qrContent: {
    alignItems: 'center',
    gap: 16,
  },
  qrImage: {
    width: 200,
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  qrDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  trackingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
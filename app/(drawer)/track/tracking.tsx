// app/(drawer)/track/tracking.tsx - Detailed tracking with timeline and QR code
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

  // Get status description
  const getStatusDescription = useCallback((state: string): string => {
    switch (state) {
      case 'submitted':
        return 'Package submitted and ready for pickup';
      case 'in_transit':
        return 'Package is being transported to destination';
      case 'delivered':
        return 'Package delivered to destination area';
      case 'collected':
        return 'Package collected by recipient';
      case 'rejected':
        return 'Package delivery was rejected or failed';
      default:
        return state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }, []);

  // Create timeline from package data
  const createTimelineFromPackage = useCallback((pkg: Package): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        status: 'created',
        timestamp: pkg.created_at,
        description: 'Package created and details submitted',
        active: true
      }
    ];

    // Add payment event if not pending unpaid
    if (pkg.state !== 'pending_unpaid') {
      events.push({
        status: 'paid',
        timestamp: pkg.updated_at, // Approximation
        description: 'Payment processed successfully',
        active: true
      });
    }

    // Add current state if different from payment
    if (!['pending_unpaid', 'pending'].includes(pkg.state)) {
      events.push({
        status: pkg.state,
        timestamp: pkg.updated_at,
        description: getStatusDescription(pkg.state),
        active: true
      });
    }

    return events;
  }, [getStatusDescription]);

  // Load package details and QR code
  const loadPackageData = useCallback(async () => {
    if (!packageCode) {
      setError('Package code is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📦 Loading package details for:', packageCode);
      
      // Load package details - getPackageDetails returns Package directly, not wrapped
      const packageData = await getPackageDetails(packageCode);
      setPackage(packageData);
      
      // Create timeline from package data
      const timelineData = createTimelineFromPackage(packageData);
      setTimeline(timelineData);
      
      // Load QR code
      setIsLoadingQR(true);
      try {
        const qrResponse = await getPackageQRCode(packageCode);
        setQrData(qrResponse.data);
        console.log('✅ QR code loaded for package:', packageCode);
      } catch (qrError) {
        console.warn('⚠️ Failed to load QR code:', qrError);
        // Create fallback QR data
        setQrData({
          qr_code_base64: null,
          tracking_url: `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/track/${packageCode}`,
          package_code: packageCode,
          package_state: packageData.state,
          route_description: packageData.route_description
        });
      } finally {
        setIsLoadingQR(false);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load package data:', error);
      setError(error.message);
      
      Toast.show({
        type: 'errorToast',
        text1: 'Failed to Load Package',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [packageCode, createTimelineFromPackage]);

  // Get state badge color
  const getStateBadgeColor = useCallback((state: string) => {
    switch (state) {
      case 'pending_unpaid': return '#f59e0b';
      case 'pending': return '#10b981';
      case 'submitted': return '#3b82f6';
      case 'in_transit': return '#8b5cf6';
      case 'delivered': return '#059669';
      case 'collected': return '#0d9488';
      case 'rejected': return '#ef4444';
      default: return colors.primary;
    }
  }, []);

  // Handle share tracking
  const handleShareTracking = useCallback(async () => {
    if (!package_ || !qrData) return;
    
    try {
      await Share.share({
        message: `Track your GLT package: ${package_.code}\n\nRoute: ${package_.route_description}\n\nTracking: ${qrData.tracking_url}`,
        title: `GLT Package ${package_.code}`,
        url: qrData.tracking_url,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [package_, qrData]);

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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(drawer)/track');
    }
  }, [router]);

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

  // Render timeline item
  const renderTimelineItem = useCallback(({ item, index }: { item: TimelineEvent; index: number }) => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIndicator}>
        <View style={[
          styles.timelineDot,
          { backgroundColor: item.active ? colors.primary : '#444' }
        ]} />
        {index < timeline.length - 1 && (
          <View style={[
            styles.timelineLine,
            { backgroundColor: item.active ? colors.primary : '#444' }
          ]} />
        )}
      </View>
      
      <View style={styles.timelineContent}>
        <Text style={[
          styles.timelineDescription,
          { color: item.active ? '#fff' : '#888' }
        ]}>
          {item.description}
        </Text>
        <Text style={styles.timelineTimestamp}>
          {new Date(item.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    </View>
  ), [timeline]);

  if (isLoading) {
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
              <Text style={styles.headerTitle}>Package Tracking</Text>
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
                <Text style={styles.summaryCode}>{package_.code}</Text>
                <Text style={styles.summaryRoute}>{package_.route_description}</Text>
              </View>
              <View style={[styles.summaryBadge, { backgroundColor: getStateBadgeColor(package_.state) }]}>
                <Text style={styles.summaryBadgeText}>{package_.state_display}</Text>
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
                  <Text style={styles.summaryCost}>KES {package_.cost.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Delivery Type</Text>
                  <Text style={styles.summaryValue}>
                    {package_.delivery_type === 'doorstep' ? 'Doorstep' : 
                     package_.delivery_type === 'mixed' ? 'Mixed' : 'Agent'}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Timeline Section */}
        <View style={styles.timelineCard}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.6)', 'rgba(22, 33, 62, 0.6)']}
            style={styles.timelineGradient}
          >
            <View style={styles.timelineHeader}>
              <Feather name="clock" size={20} color={colors.primary} />
              <Text style={styles.timelineTitle}>Package Timeline</Text>
            </View>
            
            <View style={styles.timelineList}>
              {timeline.map((event, index) => (
                <View key={index}>
                  {renderTimelineItem({ item: event, index })}
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Package Details Section */}
        <View style={styles.detailsCard}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.6)', 'rgba(22, 33, 62, 0.6)']}
            style={styles.detailsGradient}
          >
            <View style={styles.detailsHeader}>
              <Feather name="info" size={20} color={colors.primary} />
              <Text style={styles.detailsTitle}>Package Information</Text>
            </View>
            
            <View style={styles.detailsList}>
              <View style={styles.detailItem}>
                <Text style={styles.detailItemLabel}>Package Code</Text>
                <Text style={styles.detailItemValue}>{package_.code}</Text>
              </View>
              
              <View style={styles.detailItem}>
                <Text style={styles.detailItemLabel}>Created At</Text>
                <Text style={styles.detailItemValue}>
                  {new Date(package_.created_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              
              <View style={styles.detailItem}>
                <Text style={styles.detailItemLabel}>Last Updated</Text>
                <Text style={styles.detailItemValue}>
                  {new Date(package_.updated_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              
              {package_.origin_area && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailItemLabel}>Origin Area</Text>
                  <Text style={styles.detailItemValue}>
                    {package_.origin_area.name}
                    {package_.origin_area.location?.name && `, ${package_.origin_area.location.name}`}
                  </Text>
                </View>
              )}
              
              {package_.destination_area && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailItemLabel}>Destination Area</Text>
                  <Text style={styles.detailItemValue}>
                    {package_.destination_area.name}
                    {package_.destination_area.location?.name && `, ${package_.destination_area.location.name}`}
                  </Text>
                </View>
              )}
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

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
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
    position: 'relative',
    zIndex: 1000,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Content
  content: {
    flex: 1,
  },
  
  // Loading and error states
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Summary card
  summaryCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryCode: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  summaryRoute: {
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  summaryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  summaryBadgeText: {
    fontSize: 12,
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
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
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
  timelineDescription: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  timelineTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  
  // Details card
  detailsCard: {
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
  detailsGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  detailsList: {
    gap: 16,
  },
  detailItem: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailItemLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    marginBottom: 6,
  },
  detailItemValue: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
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
  
  // Bottom spacing
  bottomSpacing: {
    height: 40,
  },
});
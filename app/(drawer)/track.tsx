// app/(drawer)/track.tsx - Enhanced with proper header and navigation
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { 
  getPackages,
  STATE_MAPPING,
  type Package,
  type DrawerState
} from '@/lib/helpers/packageHelpers';
import colors from '@/theme/colors';

export default function Track() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Get status from params (from drawer navigation)
  const selectedStatus = params.status as DrawerState | undefined;
  
  // State management
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized state display
  const stateDisplayInfo = useMemo(() => {
    if (!selectedStatus) {
      return {
        title: 'All Packages',
        subtitle: 'View all your packages',
        icon: 'package' as const,
        color: colors.primary
      };
    }

    const statusConfig = {
      'pending': {
        title: 'Pending Payment',
        subtitle: 'Packages awaiting payment',
        icon: 'clock' as const,
        color: '#f59e0b'
      },
      'paid': {
        title: 'Paid Packages',
        subtitle: 'Payment received, preparing for pickup',
        icon: 'check-circle' as const,
        color: '#10b981'
      },
      'submitted': {
        title: 'Submitted Packages',
        subtitle: 'Packages submitted for delivery',
        icon: 'upload' as const,
        color: '#3b82f6'
      },
      'in-transit': {
        title: 'In Transit',
        subtitle: 'Packages currently being delivered',
        icon: 'truck' as const,
        color: '#8b5cf6'
      },
      'delivered': {
        title: 'Delivered',
        subtitle: 'Successfully delivered packages',
        icon: 'box' as const,
        color: '#059669'
      },
      'collected': {
        title: 'Collected',
        subtitle: 'Packages collected by recipients',
        icon: 'archive' as const,
        color: '#0d9488'
      },
      'rejected': {
        title: 'Rejected',
        subtitle: 'Delivery rejected or failed',
        icon: 'x-circle' as const,
        color: '#ef4444'
      }
    };

    return statusConfig[selectedStatus] || statusConfig['pending'];
  }, [selectedStatus]);

  // Load packages based on selected status
  const loadPackages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      console.log('📦 Loading packages for status:', selectedStatus);
      
      const filters = selectedStatus ? { state: selectedStatus } : undefined;
      const response = await getPackages(filters);
      
      console.log('✅ Packages loaded:', {
        count: response.data.length,
        status: selectedStatus,
        totalCount: response.pagination.total_count
      });
      
      setPackages(response.data);
      
    } catch (error: any) {
      console.error('❌ Failed to load packages:', error);
      setError(error.message);
      
      Toast.show({
        type: 'errorToast',
        text1: 'Failed to Load Packages',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus]);

  // Load data when component mounts or status changes
  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    loadPackages(true);
  }, [loadPackages]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

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

  // Check if package can be edited
  const canEditPackage = useCallback((state: string) => {
    return ['pending_unpaid', 'pending', 'rejected'].includes(state);
  }, []);

  // Check if package needs payment
  const needsPayment = useCallback((state: string) => {
    return ['pending_unpaid', 'pending'].includes(state);
  }, []);

  // Handle edit package
  const handleEditPackage = useCallback((packageItem: Package) => {
    console.log('🔧 Editing package:', packageItem.code);
    router.push({
      pathname: '/(drawer)/(tabs)/send',
      params: { 
        edit: 'true',
        packageCode: packageItem.code,
        packageId: packageItem.id.toString()
      }
    });
  }, [router]);

  // Handle pay for package
  const handlePayPackage = useCallback((packageItem: Package) => {
    console.log('💳 Processing payment for package:', packageItem.code);
    router.push({
      pathname: '/(drawer)/payment',
      params: { 
        packageCode: packageItem.code,
        packageId: packageItem.id.toString(),
        amount: packageItem.cost.toString()
      }
    });
  }, [router]);

  // Handle view tracking details
  const handleViewTracking = useCallback((packageItem: Package) => {
    console.log('🔍 Viewing tracking for package:', packageItem.code);
    router.push({
      pathname: '/(drawer)/track/tracking',
      params: { 
        packageCode: packageItem.code,
        packageId: packageItem.id.toString()
      }
    });
  }, [router]);

  // Render package item without QR code
  const renderPackageItem = useCallback(({ item }: { item: Package }) => {
    const canEdit = canEditPackage(item.state);
    const showPayButton = needsPayment(item.state);
    
    return (
      <View style={styles.packageCard}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
          style={styles.packageCardGradient}
        >
          {/* Package Header */}
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageCode}>{item.code}</Text>
              <Text style={styles.routeDescription}>{item.route_description}</Text>
            </View>
            <View style={[styles.stateBadge, { backgroundColor: getStateBadgeColor(item.state) }]}>
              <Text style={styles.stateBadgeText}>{item.state_display}</Text>
            </View>
          </View>

          {/* Package Details */}
          <View style={styles.packageDetails}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>From</Text>
                <Text style={styles.detailValue}>{item.sender_name}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>To</Text>
                <Text style={styles.detailValue}>{item.receiver_name}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Cost</Text>
                <Text style={styles.costValue}>KES {item.cost.toLocaleString()}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>
                  {item.delivery_type === 'doorstep' ? 'Doorstep' : 
                   item.delivery_type === 'mixed' ? 'Mixed' : 'Agent'}
                </Text>
              </View>
            </View>
            
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Created:</Text>
              <Text style={styles.timestampValue}>
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          </View>

          {/* Tracking Button */}
          <TouchableOpacity 
            style={styles.trackingButton}
            onPress={() => handleViewTracking(item)}
          >
            <Feather name="search" size={16} color={colors.primary} />
            <Text style={styles.trackingButtonText}>View Tracking Details</Text>
            <Feather name="chevron-right" size={16} color="#888" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {/* Edit Button */}
            <TouchableOpacity 
              style={[
                styles.actionButton,
                !canEdit && styles.actionButtonDisabled
              ]}
              onPress={() => canEdit && handleEditPackage(item)}
              disabled={!canEdit}
            >
              <Feather 
                name="edit-3" 
                size={16} 
                color={canEdit ? colors.primary : '#666'} 
              />
              <Text style={[
                styles.actionButtonText,
                !canEdit && styles.actionButtonTextDisabled
              ]}>
                Edit
              </Text>
            </TouchableOpacity>
            
            {/* Pay Button */}
            <TouchableOpacity 
              style={[
                styles.actionButton,
                showPayButton ? styles.payButton : styles.actionButtonDisabled
              ]}
              onPress={() => showPayButton && handlePayPackage(item)}
              disabled={!showPayButton}
            >
              <Feather 
                name="credit-card" 
                size={16} 
                color={showPayButton ? '#fff' : '#666'} 
              />
              <Text style={[
                styles.actionButtonText,
                showPayButton ? styles.payButtonText : styles.actionButtonTextDisabled
              ]}>
                {showPayButton ? 'Pay Now' : 'Paid'}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }, [getStateBadgeColor, canEditPackage, needsPayment, handleEditPackage, handlePayPackage, handleViewTracking]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyStateContainer}>
      <LinearGradient
        colors={['rgba(26, 26, 46, 0.6)', 'rgba(22, 33, 62, 0.6)']}
        style={styles.emptyStateCard}
      >
        <Feather name={stateDisplayInfo.icon} size={64} color="#666" />
        <Text style={styles.emptyStateTitle}>
          No {stateDisplayInfo.title} Found
        </Text>
        <Text style={styles.emptyStateSubtitle}>
          {selectedStatus 
            ? `You don't have any packages in "${stateDisplayInfo.title.toLowerCase()}" state.`
            : 'You haven\'t created any packages yet.'
          }
        </Text>
        
        <TouchableOpacity style={styles.emptyStateButton} onPress={() => router.push('/')}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.emptyStateButtonText}>Create Package</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  ), [stateDisplayInfo, selectedStatus, router]);

  // Render error state
  const renderErrorState = useCallback(() => (
    <View style={styles.errorContainer}>
      <LinearGradient
        colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.1)']}
        style={styles.errorCard}
      >
        <Feather name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Failed to Load Packages</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        
        <TouchableOpacity style={styles.retryButton} onPress={() => loadPackages()}>
          <Feather name="refresh-cw" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  ), [error, loadPackages]);

  // Main render
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      {/* Fixed Header with Back Button */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[colors.background, 'rgba(22, 33, 62, 0.95)']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Header Info */}
            <View style={styles.headerInfo}>
              <View style={styles.headerIconContainer}>
                <Feather 
                  name={stateDisplayInfo.icon} 
                  size={20} 
                  color={stateDisplayInfo.color} 
                />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{stateDisplayInfo.title}</Text>
                <Text style={styles.headerSubtitle}>{stateDisplayInfo.subtitle}</Text>
              </View>
            </View>
            
            {/* Package Count */}
            {packages.length > 0 && (
              <View style={styles.packageCount}>
                <Text style={styles.packageCountText}>{packages.length}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      ) : error ? (
        renderErrorState()
      ) : packages.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView
          style={styles.packagesList}
          contentContainerStyle={styles.packagesListContent}
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
          {packages.map((pkg) => (
            <View key={pkg.id}>
              {renderPackageItem({ item: pkg })}
            </View>
          ))}
          
          {/* Load more indicator if needed */}
          <View style={styles.listFooter}>
            <Text style={styles.listFooterText}>
              Showing {packages.length} packages
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Fixed header styles
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
    marginRight: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  packageCount: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 28,
    alignItems: 'center',
  },
  packageCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  
  // Loading states
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
  
  // Error states
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    width: '100%',
    maxWidth: 400,
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
  
  // Empty state
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyStateCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    width: '100%',
    maxWidth: 400,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 8,
  },
  emptyStateButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Package list
  packagesList: {
    flex: 1,
  },
  packagesListContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  
  // Package card styles
  packageCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  packageCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  
  // Package header
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  packageInfo: {
    flex: 1,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  routeDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  stateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Package details
  packageDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 20,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  costValue: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  timestampLabel: {
    fontSize: 12,
    color: '#888',
  },
  timestampValue: {
    fontSize: 12,
    color: '#666',
  },
  
  // Tracking button
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    marginBottom: 16,
  },
  trackingButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  
  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
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
  actionButtonDisabled: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
    borderColor: 'rgba(102, 102, 102, 0.3)',
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  actionButtonTextDisabled: {
    color: '#666',
  },
  
  // Pay button specific styles
  payButton: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // List footer
  listFooter: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  listFooterText: {
    fontSize: 12,
    color: '#666',
  },
});
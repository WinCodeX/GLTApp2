import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

import GLTHeader from '../../components/GLTHeader';
import PackageEditModal from '../../components/PackageEditModal';
import { useUser } from '../../context/UserContext';
import { getPackages } from '../../lib/helpers/packageHelpers';
import colors from '../../theme/colors';

const { width: screenWidth } = Dimensions.get('window');

interface Package {
  id: string;
  code: string;
  state: string;
  state_display: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone: string;
  route_description: string;
  cost: number;
  delivery_type: string;
  created_at: string;
  sender_phone?: string;
}

interface TrackScreenProps {
  initialStatus?: string;
}

export default function TrackScreen({ initialStatus }: TrackScreenProps) {
  // State management
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(initialStatus);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  
  // Hooks
  const router = useRouter();
  const { user } = useUser();

  // Status filter options
  const statusOptions = useMemo(() => [
    { label: 'All', value: undefined, color: '#6b7280' },
    { label: 'Pending', value: 'pending_unpaid', color: '#ef4444' },
    { label: 'Paid', value: 'pending', color: '#f59e0b' },
    { label: 'Submitted', value: 'submitted', color: '#667eea' },
    { label: 'In Transit', value: 'in_transit', color: '#764ba2' },
    { label: 'Delivered', value: 'delivered', color: '#10b981' },
    { label: 'Collected', value: 'collected', color: '#059669' },
    { label: 'Rejected', value: 'rejected', color: '#dc2626' },
  ], []);

  // Load packages
  const loadPackages = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    setError(null);

    try {
      console.log('🔄 Loading packages with status:', selectedStatus);
      
      const filters = selectedStatus ? 
        { state: selectedStatus } : undefined;
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

  // Get delivery type display
  const getDeliveryTypeDisplay = useCallback((deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return 'Home';
      case 'agent': return 'Office';
      case 'mixed': return 'Mixed';
      default: return 'Office';
    }
  }, []);

  // Get delivery type badge color
  const getDeliveryTypeBadgeColor = useCallback((deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return '#3b82f6'; // Blue
      case 'agent': return '#8b5cf6';    // Purple
      case 'mixed': return '#f59e0b';    // Orange
      default: return '#8b5cf6';
    }
  }, []);

  // Group packages by date
  const groupPackagesByDate = useCallback((packages: Package[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const groups: { [key: string]: Package[] } = {};
    
    packages.forEach(pkg => {
      const pkgDate = new Date(pkg.created_at);
      let groupKey: string;
      
      if (pkgDate.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (pkgDate.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = pkgDate.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(pkg);
    });
    
    return groups;
  }, []);

  // Get state badge color
  const getStateBadgeColor = useCallback((state: string) => {
    switch (state) {
      case 'pending_unpaid': return '#ef4444';
      case 'pending': return '#f59e0b';
      case 'submitted': return '#667eea';
      case 'in_transit': return '#764ba2';
      case 'delivered': return '#10b981';
      case 'collected': return '#059669';
      case 'rejected': return '#dc2626';
      default: return '#6b7280';
    }
  }, []);

  // Package action handlers
  const handleViewTracking = useCallback((pkg: Package) => {
    router.push(`/track/tracking?code=${pkg.code}`);
  }, [router]);

  const handleEditPackage = useCallback((pkg: Package) => {
    setSelectedPackage(pkg);
    setEditModalVisible(true);
  }, []);

  const handlePayPackage = useCallback((pkg: Package) => {
    // TODO: Implement payment flow
    console.log('Pay for package:', pkg.code);
  }, []);

  const handleEditModalClose = useCallback(() => {
    setEditModalVisible(false);
    setSelectedPackage(null);
  }, []);

  const handleEditModalSuccess = useCallback(() => {
    handleEditModalClose();
    loadPackages(); // Reload packages after successful edit
  }, [handleEditModalClose, loadPackages]);

  // Determine if package can be edited based on user role and package state
  const canEditPackage = useCallback((pkg: Package) => {
    if (!user) return false;
    
    // Admin can edit most states except collected
    if (user.role === 'admin' || user.role === 'super_admin') {
      return !['collected'].includes(pkg.state);
    }
    
    // Agents can edit limited states
    if (user.role === 'agent') {
      return ['pending', 'submitted', 'in_transit'].includes(pkg.state);
    }
    
    // Users can only edit unpaid packages
    return pkg.state === 'pending_unpaid';
  }, [user]);

  // Render status filter
  const renderStatusFilter = useCallback(() => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={statusOptions}
        keyExtractor={(item) => item.value || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => {
          const isSelected = selectedStatus === item.value;
          return (
            <TouchableOpacity
              style={[
                styles.filterButton,
                isSelected && [styles.filterButtonActive, { backgroundColor: item.color }]
              ]}
              onPress={() => setSelectedStatus(item.value)}
            >
              <Text style={[
                styles.filterButtonText,
                isSelected && styles.filterButtonTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  ), [statusOptions, selectedStatus]);

  // Render package item with dynamic action buttons
  const renderPackageItem = useCallback(({ item }: { item: Package }) => {
    const canEdit = canEditPackage(item);
    const showPayButton = item.state === 'pending_unpaid';
    
    // Determine button layout based on state
    const actionButtons = [];
    
    // Track button - always available
    actionButtons.push({
      key: 'track',
      icon: 'search',
      text: 'Track',
      onPress: () => handleViewTracking(item),
      style: styles.actionButton,
      textStyle: styles.actionButtonText,
      iconColor: colors.primary
    });
    
    // Edit button - only if editable
    if (canEdit) {
      actionButtons.push({
        key: 'edit',
        icon: 'edit-3',
        text: 'Edit',
        onPress: () => handleEditPackage(item),
        style: styles.actionButton,
        textStyle: styles.actionButtonText,
        iconColor: colors.primary
      });
    }
    
    // Pay button - only if needs payment
    if (showPayButton) {
      actionButtons.push({
        key: 'pay',
        icon: 'credit-card',
        text: 'Pay',
        onPress: () => handlePayPackage(item),
        style: [styles.actionButton, styles.payButton],
        textStyle: [styles.actionButtonText, styles.payButtonText],
        iconColor: '#fff'
      });
    }
    
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
            <View style={styles.badgeContainer}>
              {/* Delivery Type Badge */}
              <View style={[styles.deliveryTypeBadge, { backgroundColor: getDeliveryTypeBadgeColor(item.delivery_type) }]}>
                <Text style={styles.badgeText}>{getDeliveryTypeDisplay(item.delivery_type)}</Text>
              </View>
              {/* State Badge */}
              <View style={[styles.stateBadge, { backgroundColor: getStateBadgeColor(item.state) }]}>
                <Text style={styles.badgeText}>{item.state_display}</Text>
              </View>
            </View>
          </View>
          
          {/* Receiver Section */}
          <View style={styles.receiverSection}>
            <Text style={styles.receiverText}>To: {item.receiver_name}</Text>
          </View>
          
          {/* Cost Section */}
          <View style={styles.costSection}>
            <Text style={styles.costLabel}>Amount</Text>
            <Text style={styles.costValue}>KES {item.cost.toLocaleString()}</Text>
          </View>
          
          {/* Dynamic Action Buttons */}
          <View style={[
            styles.actionButtons,
            actionButtons.length === 1 && styles.singleButton,
            actionButtons.length === 2 && styles.doubleButtons,
            actionButtons.length === 3 && styles.tripleButtons,
          ]}>
            {actionButtons.map((button) => (
              <TouchableOpacity
                key={button.key}
                style={button.style}
                onPress={button.onPress}
              >
                <Feather name={button.icon as any} size={14} color={button.iconColor} />
                <Text style={button.textStyle}>{button.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>
      </View>
    );
  }, [
    canEditPackage,
    handleViewTracking,
    handleEditPackage,
    handlePayPackage,
    getDeliveryTypeDisplay,
    getDeliveryTypeBadgeColor,
    getStateBadgeColor
  ]);

  // Render date section header
  const renderDateHeader = useCallback((date: string, count: number) => (
    <View style={styles.dateHeaderContainer}>
      <LinearGradient
        colors={['rgba(124, 58, 237, 0.15)', 'rgba(124, 58, 237, 0.05)']}
        style={styles.dateHeader}
      >
        <Text style={styles.dateHeaderText}>{date}</Text>
        <Text style={styles.dateHeaderCount}>{count} package{count !== 1 ? 's' : ''}</Text>
      </LinearGradient>
    </View>
  ), []);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Feather name="package" size={48} color="#666" />
      <Text style={styles.emptyStateTitle}>No Packages Found</Text>
      <Text style={styles.emptyStateText}>
        {selectedStatus 
          ? `No packages with status "${statusOptions.find(opt => opt.value === selectedStatus)?.label}"`
          : "You haven't created any packages yet"}
      </Text>
    </View>
  ), [selectedStatus, statusOptions]);

  // Render loading state
  const renderLoadingState = useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading packages...</Text>
    </View>
  ), []);

  // Render error state
  const renderErrorState = useCallback(() => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={48} color="#ef4444" />
      <Text style={styles.errorTitle}>Failed to Load Packages</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => loadPackages()}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ), [error, loadPackages]);

  // Render main content
  const renderContent = useCallback(() => {
    if (isLoading) return renderLoadingState();
    if (error) return renderErrorState();
    if (packages.length === 0) return renderEmptyState();

    const groupedPackages = groupPackagesByDate(packages);
    const sections = Object.entries(groupedPackages).map(([date, packages]) => ({
      date,
      packages
    }));

    return (
      <FlatList
        data={sections}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item: section }) => (
          <View>
            {renderDateHeader(section.date, section.packages.length)}
            {section.packages.map((pkg) => (
              <View key={pkg.id}>
                {renderPackageItem({ item: pkg })}
              </View>
            ))}
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        ListFooterComponent={() => (
          <View style={styles.listFooter}>
            <Text style={styles.listFooterText}>
              {packages.length} package{packages.length !== 1 ? 's' : ''} total
            </Text>
          </View>
        )}
      />
    );
  }, [
    isLoading,
    error,
    packages,
    isRefreshing,
    renderLoadingState,
    renderErrorState,
    renderEmptyState,
    groupPackagesByDate,
    handleRefresh,
    renderDateHeader,
    renderPackageItem
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <GLTHeader
        title="Track Packages"
        onBackPress={handleBack}
        showBackButton
      />
      
      {/* Status Filter */}
      {renderStatusFilter()}
      
      {/* Main Content */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
      
      {/* Edit Modal */}
      <PackageEditModal
        visible={editModalVisible}
        package={selectedPackage}
        userRole={user?.role || 'user'}
        onClose={handleEditModalClose}
        onSuccess={handleEditModalSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  
  // Filter styles
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterButtonActive: {
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#ccc',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Content container
  contentContainer: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  
  // Date header styles
  dateHeaderContainer: {
    marginVertical: 8,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dateHeaderCount: {
    fontSize: 12,
    color: '#888',
  },
  
  // Package card styles
  packageCard: {
    marginVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  packageCardGradient: {
    padding: 16,
  },
  
  // Package header (code + badges)
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  packageInfo: {
    flex: 1,
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  routeDescription: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  
  // Badge container and styles
  badgeContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  deliveryTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Receiver section
  receiverSection: {
    marginBottom: 8,
  },
  receiverText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Cost section
  costSection: {
    marginBottom: 12,
  },
  costLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
    fontWeight: '500',
  },
  costValue: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '700',
  },
  
  // Dynamic action buttons - adaptive layout
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  
  // Button layout variations
  singleButton: {
    justifyContent: 'center',
  },
  doubleButtons: {
    justifyContent: 'space-between',
  },
  tripleButtons: {
    justifyContent: 'space-between',
  },
  
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    gap: 4,
  },
  
  actionButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
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
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
  },
  
  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
// app/(drawer)/track.tsx - FIXED: Removed QR code calls from navigation
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
  TextInput,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { 
  getPackages,
  STATE_MAPPING,
  canEditPackage,
  needsPayment,
  type Package,
  type DrawerState
} from '@/lib/helpers/packageHelpers';
import colors from '@/theme/colors';
import PackageCreationModal from '@/components/PackageCreationModal';

export default function Track() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Get status from params (from drawer navigation)
  const selectedStatus = params.status as DrawerState | undefined;
  
  // State management
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAnimation] = useState(new Animated.Value(0));
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Status display helper
  const getStatusDisplay = useCallback((status: DrawerState): string => {
    const displays = {
      'pending': 'Pending Payment',
      'paid': 'Payment Processed',
      'submitted': 'Submitted for Pickup',
      'in-transit': 'In Transit',
      'delivered': 'Delivered',
      'collected': 'Collected',
      'rejected': 'Rejected'
    };
    return displays[status] || status;
  }, []);

  // Get status color
  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'pending_unpaid':
      case 'pending':
        return '#f59e0b'; // amber
      case 'submitted':
        return '#3b82f6'; // blue
      case 'in_transit':
        return '#8b5cf6'; // purple
      case 'delivered':
        return '#10b981'; // green
      case 'collected':
        return '#059669'; // emerald
      case 'rejected':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }, []);

  // Load packages function
  const loadPackages = useCallback(async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setIsLoading(true);
      }
      setError(null);

      console.log('📦 Loading packages with status:', selectedStatus);
      
      const response = await getPackages({
        state: selectedStatus,
        per_page: 50
      });

      console.log('✅ Packages loaded:', response.data.length);
      setPackages(response.data || []);
      setFilteredPackages(response.data || []);
      
    } catch (error: any) {
      console.error('❌ Failed to load packages:', error);
      setError(error.message || 'Failed to load packages');
      Toast.show({
        type: 'error',
        text1: 'Loading Failed',
        text2: error.message || 'Could not load packages',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPackages(false);
  }, [loadPackages]);

  // Search functionality
  const handleSearchToggle = useCallback(() => {
    const toValue = searchVisible ? 0 : 1;
    setSearchVisible(!searchVisible);
    
    Animated.timing(searchAnimation, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    if (searchVisible) {
      setSearchQuery('');
      setFilteredPackages(packages);
    }
  }, [searchVisible, searchAnimation, packages]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setFilteredPackages(packages);
    } else {
      const filtered = packages.filter(pkg => 
        pkg.code.toLowerCase().includes(query.toLowerCase()) ||
        pkg.receiver_name.toLowerCase().includes(query.toLowerCase()) ||
        pkg.sender_name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredPackages(filtered);
    }
  }, [packages]);

  // Load packages on mount and when status changes
  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

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

  // FIXED: Handle view tracking details - NO QR CODE CALLS
  const handleViewTracking = useCallback((packageItem: Package) => {
    console.log('🔍 Viewing tracking for package:', packageItem.code);
    
    // Simple navigation without any API calls
    router.push({
      pathname: '/(drawer)/track/tracking',
      params: { 
        packageCode: packageItem.code,
        packageId: packageItem.id.toString(),
        from: '/(drawer)/track'
      }
    });
  }, [router]);

  // Get receiver name display - handle various possible field names
  const getReceiverName = useCallback((packageItem: Package) => {
    return packageItem.receiver_name || 
           packageItem.recipient_name || 
           packageItem.receiver?.name ||
           packageItem.recipient?.name ||
           packageItem.to_name ||
           'Unknown Recipient';
  }, []);

  // Render package item with conditional button rendering
  const renderPackageItem = useCallback(({ item }: { item: Package }) => {
    const canEdit = canEditPackage(item.state);
    const showPayButton = needsPayment(item.state);
    const receiverName = getReceiverName(item);
    
    // Build action buttons array based on package state and permissions
    const actionButtons = [];
    
    if (showPayButton) {
      actionButtons.push({
        label: 'Pay Now',
        action: () => handlePayPackage(item),
        style: 'primary',
        icon: 'credit-card'
      });
    }
    
    if (canEdit) {
      actionButtons.push({
        label: 'Edit',
        action: () => handleEditPackage(item),
        style: 'secondary',
        icon: 'edit-2'
      });
    }
    
    // Always show track button
    actionButtons.push({
      label: 'Track',
      action: () => handleViewTracking(item),
      style: 'outline',
      icon: 'navigation'
    });

    return (
      <View style={styles.packageCard}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
          style={styles.packageGradient}
        >
          {/* Package Header */}
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageCode}>{item.code}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.state) }]}>
                <Text style={styles.statusText}>{item.state_display}</Text>
              </View>
            </View>
            <Text style={styles.packageCost}>KSh {item.cost}</Text>
          </View>

          {/* Package Details */}
          <View style={styles.packageDetails}>
            <View style={styles.detailRow}>
              <Feather name="user" size={14} color="#888" />
              <Text style={styles.detailText}>To: {receiverName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color="#888" />
              <Text style={styles.detailText}>{item.route_description}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="clock" size={14} color="#888" />
              <Text style={styles.detailText}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {actionButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.actionButton,
                  button.style === 'primary' && styles.primaryButton,
                  button.style === 'secondary' && styles.secondaryButton,
                  button.style === 'outline' && styles.outlineButton
                ]}
                onPress={button.action}
              >
                <Feather 
                  name={button.icon as any} 
                  size={16} 
                  color={
                    button.style === 'primary' ? '#fff' :
                    button.style === 'secondary' ? colors.primary :
                    colors.primary
                  } 
                />
                <Text style={[
                  styles.actionButtonText,
                  button.style === 'primary' && styles.primaryButtonText,
                  button.style === 'secondary' && styles.secondaryButtonText,
                  button.style === 'outline' && styles.outlineButtonText
                ]}>
                  {button.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>
      </View>
    );
  }, [getStatusColor, getReceiverName, handlePayPackage, handleEditPackage, handleViewTracking]);

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
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>
                {selectedStatus ? getStatusDisplay(selectedStatus) : 'All Packages'}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={[colors.background, 'rgba(22, 33, 62, 0.95)']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Error</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Packages</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPackages()}>
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
            <Text style={styles.headerTitle}>
              {selectedStatus ? getStatusDisplay(selectedStatus) : 'All Packages'}
            </Text>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={[styles.headerButton, searchVisible && styles.headerButtonActive]} 
                onPress={handleSearchToggle}
              >
                <Feather name="search" size={20} color={searchVisible ? colors.primary : '#fff'} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.headerButton} 
                onPress={() => setShowCreateModal(true)}
              >
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <Animated.View style={[
            styles.searchContainer,
            { height: searchAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 50] }) }
          ]}>
            {searchVisible && (
              <TextInput
                style={styles.searchInput}
                placeholder="Search packages..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
            )}
          </Animated.View>
        </LinearGradient>
      </View>

      {/* Package List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {filteredPackages.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="package" size={64} color="#555" />
            <Text style={styles.emptyStateTitle}>No Packages Found</Text>
            <Text style={styles.emptyStateMessage}>
              {searchQuery ? 'No packages match your search' : 
               selectedStatus ? `No ${getStatusDisplay(selectedStatus).toLowerCase()} packages` : 
               'No packages available'}
            </Text>
            
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.createButton} 
                onPress={() => setShowCreateModal(true)}
              >
                <Feather name="plus" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Package</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.packageList}>
            {filteredPackages.map((item) => (
              <React.Fragment key={item.id}>
                {renderPackageItem({ item })}
              </React.Fragment>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Package Creation Modal */}
      <PackageCreationModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          handleRefresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  searchContainer: {
    overflow: 'hidden',
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 21,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
  },
  content: {
    flex: 1,
    marginTop: 120, // Account for fixed header
  },
  packageList: {
    padding: 16,
    gap: 12,
  },
  packageCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  packageGradient: {
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  packageInfo: {
    flex: 1,
    gap: 6,
  },
  packageCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packageCost: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  packageDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButtonText: {
    color: colors.primary,
  },
  outlineButtonText: {
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    minHeight: 400,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#888',
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});
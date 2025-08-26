// app/(drawer)/track.tsx - Enhanced with proper state filtering and delivery type support
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
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { 
  getPackages,
  canEditPackage,
  needsPayment,
  getStateDisplay,
  getStateColor,
  STATE_MAPPING,
  type Package,
  type DrawerState,
  type PackageFilters
} from '@/lib/helpers/packageHelpers';
import colors from '@/theme/colors';
import PackageCreationModal from '@/components/PackageCreationModal';

// Enhanced delivery type colors with fragile and collection support
const DELIVERY_TYPE_COLORS = {
  doorstep: {
    background: ['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)'],
    border: '#3b82f6',
    text: '#3b82f6',
    icon: '🏠'
  },
  agent: {
    background: ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.05)'],
    border: '#10b981',
    text: '#10b981', 
    icon: '🏢'
  },
  fragile: {
    background: ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)'],
    border: '#ef4444',
    text: '#ef4444',
    icon: '⚠️'
  },
  collection: {
    background: ['rgba(147, 51, 234, 0.15)', 'rgba(147, 51, 234, 0.05)'],
    border: '#9333ea',
    text: '#9333ea',
    icon: '📦'
  },
  express: {
    background: ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)'],
    border: '#f59e0b',
    text: '#f59e0b',
    icon: '⚡'
  },
  bulk: {
    background: ['rgba(107, 114, 128, 0.15)', 'rgba(107, 114, 128, 0.05)'],
    border: '#6b7280',
    text: '#6b7280',
    icon: '📚'
  }
} as const;

// Enhanced state display names
const STATE_DISPLAYS = {
  'pending': 'Pending Payment',
  'paid': 'Processing', 
  'submitted': 'Ready for Pickup',
  'in-transit': 'In Transit',
  'delivered': 'Delivered',
  'collected': 'Collected',
  'rejected': 'Cancelled'
} as const;

export default function Track() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // FIXED: Get status from params (from drawer navigation)
  const selectedStatus = params.status as DrawerState | undefined;
  
  // State management
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAnimation] = useState(new Animated.Value(0));
  
  // Modal state
  const [showPackageModal, setShowPackageModal] = useState(false);
  
  // FIXED: Load packages with proper state filtering
  const loadPackages = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      if (isRefresh) setIsRefreshing(true);
      setError(null);
      
      console.log('📦 Loading packages for status:', selectedStatus);
      
      // Build filters based on selected status
      const filters: PackageFilters = {};
      
      // CRITICAL: Only add state filter if a specific status is selected
      if (selectedStatus && selectedStatus !== 'pending') {
        filters.state = selectedStatus;
        console.log('🔍 Filtering by state:', selectedStatus, '-> API state:', STATE_MAPPING[selectedStatus]);
      }
      
      // Add search filter if active
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }
      
      const response = await getPackages(filters);
      
      if (response.success) {
        const packagesData = response.data || [];
        console.log('✅ Packages loaded:', packagesData.length);
        
        // Additional client-side filtering for edge cases
        let filteredData = packagesData;
        
        if (selectedStatus && selectedStatus !== 'pending') {
          const apiState = STATE_MAPPING[selectedStatus];
          filteredData = packagesData.filter(pkg => pkg.state === apiState);
          console.log('🔍 Client-side filtered packages:', filteredData.length, 'for state:', apiState);
        }
        
        setPackages(filteredData);
      } else {
        throw new Error(response.message || 'Failed to load packages');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load packages:', error);
      setError(error.message || 'Failed to load packages');
      
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Packages',
        text2: error.message || 'Please check your connection and try again',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus, searchQuery]);
  
  // Load packages when screen focuses or selectedStatus changes
  useFocusEffect(
    useCallback(() => {
      loadPackages();
    }, [loadPackages])
  );
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadPackages(true);
  }, [loadPackages]);
  
  // Search functionality
  const toggleSearch = useCallback(() => {
    const toValue = searchVisible ? 0 : 1;
    setSearchVisible(!searchVisible);
    
    Animated.timing(searchAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    if (searchVisible) {
      setSearchQuery('');
    }
  }, [searchVisible, searchAnimation]);
  
  // Handle search query changes with debouncing
  useEffect(() => {
    if (!searchVisible) return;
    
    const debounceTimer = setTimeout(() => {
      loadPackages();
    }, 500);
    
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchVisible, loadPackages]);
  
  // Package action handlers
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
  
  const handleViewTracking = useCallback((packageItem: Package) => {
    console.log('🔍 Viewing tracking for package:', packageItem.code);
    router.push({
      pathname: '/(drawer)/track/tracking',
      params: { 
        packageCode: packageItem.code,
        packageId: packageItem.id.toString(),
        from: '/(drawer)/track'
      }
    });
  }, [router]);
  
  // Get receiver name display with compatibility
  const getReceiverName = useCallback((packageItem: Package) => {
    return packageItem.receiver_name || 
           packageItem.recipient_name || 
           packageItem.receiver?.name ||
           packageItem.recipient?.name ||
           packageItem.to_name ||
           'Unknown Recipient';
  }, []);
  
  // ENHANCED: Get delivery type styling
  const getDeliveryTypeStyle = useCallback((deliveryType: string) => {
    const normalizedType = deliveryType.toLowerCase();
    return DELIVERY_TYPE_COLORS[normalizedType as keyof typeof DELIVERY_TYPE_COLORS] || DELIVERY_TYPE_COLORS.agent;
  }, []);
  
  // Render individual package item with enhanced delivery type support
  const renderPackageItem = useCallback(({ item, index }: { item: Package; index: number }) => {
    const canEdit = canEditPackage(item.state);
    const showPayButton = needsPayment(item.state);
    const receiverName = getReceiverName(item);
    const deliveryStyle = getDeliveryTypeStyle(item.delivery_type);
    
    // Build action buttons
    const actionButtons = [];
    
    if (showPayButton) {
      actionButtons.push({
        label: 'Pay Now',
        icon: 'credit-card',
        color: '#10b981',
        onPress: () => handlePayPackage(item)
      });
    }
    
    if (canEdit) {
      actionButtons.push({
        label: 'Edit',
        icon: 'edit-3',
        color: colors.primary,
        onPress: () => handleEditPackage(item)
      });
    }
    
    actionButtons.push({
      label: 'Track',
      icon: 'map-pin',
      color: '#3b82f6',
      onPress: () => handleViewTracking(item)
    });
    
    return (
      <View style={[styles.packageItem, { marginTop: index === 0 ? 16 : 8 }]}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
          style={styles.packageGradient}
        >
          {/* Package Header */}
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <View style={styles.packageCodeContainer}>
                <Text style={styles.packageCode}>{item.code}</Text>
                <View style={[
                  styles.deliveryTypeBadge, 
                  { 
                    backgroundColor: deliveryStyle.border + '20',
                    borderColor: deliveryStyle.border 
                  }
                ]}>
                  <Text style={[styles.deliveryTypeText, { color: deliveryStyle.text }]}>
                    {deliveryStyle.icon} {item.delivery_type.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={[
                styles.stateBadge,
                { backgroundColor: getStateColor(item.state) + '20' }
              ]}>
                <View style={[
                  styles.stateIndicator,
                  { backgroundColor: getStateColor(item.state) }
                ]} />
                <Text style={[
                  styles.stateText,
                  { color: getStateColor(item.state) }
                ]}>
                  {getStateDisplay(item.state)}
                </Text>
              </View>
            </View>
            
            <Text style={styles.packageCost}>KES {item.cost}</Text>
          </View>
          
          {/* Package Details */}
          <View style={styles.packageDetails}>
            <View style={styles.detailRow}>
              <Feather name="user" size={14} color="#888" />
              <Text style={styles.detailText} numberOfLines={1}>
                To: {receiverName}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color="#888" />
              <Text style={styles.detailText} numberOfLines={2}>
                {item.route_description || 'Route information unavailable'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Feather name="calendar" size={14} color="#888" />
              <Text style={styles.detailText}>
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
            
            {/* Enhanced: Show delivery location for doorstep/fragile packages */}
            {item.delivery_location && ['doorstep', 'fragile'].includes(item.delivery_type) && (
              <View style={styles.detailRow}>
                <Feather name="home" size={14} color="#888" />
                <Text style={styles.detailText} numberOfLines={2}>
                  {item.delivery_location}
                </Text>
              </View>
            )}
            
            {/* Enhanced: Show collection details for collection packages */}
            {item.delivery_type === 'collection' && item.collection_details && (
              <View style={styles.collectionDetails}>
                <View style={styles.detailRow}>
                  <Feather name="shopping-bag" size={14} color="#9333ea" />
                  <Text style={[styles.detailText, { color: '#9333ea' }]} numberOfLines={1}>
                    From: {item.collection_details.shop_name || 'Collection Point'}
                  </Text>
                </View>
                {item.collection_details.items_to_collect && (
                  <View style={styles.detailRow}>
                    <Feather name="package" size={14} color="#9333ea" />
                    <Text style={[styles.detailText, { color: '#9333ea' }]} numberOfLines={2}>
                      Items: {item.collection_details.items_to_collect}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
          
          {/* Action Buttons */}
          {actionButtons.length > 0 && (
            <View style={styles.actionButtons}>
              {actionButtons.map((button, buttonIndex) => (
                <TouchableOpacity
                  key={buttonIndex}
                  style={[styles.actionButton, { borderColor: button.color }]}
                  onPress={button.onPress}
                >
                  <Feather name={button.icon as any} size={16} color={button.color} />
                  <Text style={[styles.actionButtonText, { color: button.color }]}>
                    {button.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </LinearGradient>
      </View>
    );
  }, [canEditPackage, needsPayment, getReceiverName, getDeliveryTypeStyle, handlePayPackage, handleEditPackage, handleViewTracking]);
  
  // Render search bar
  const renderSearchBar = useCallback(() => (
    <Animated.View style={[
      styles.searchContainer,
      {
        height: searchAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 60]
        }),
        opacity: searchAnimation
      }
    ]}>
      <View style={styles.searchInputContainer}>
        <Feather name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${selectedStatus ? STATE_DISPLAYS[selectedStatus] : 'packages'}...`}
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus={searchVisible}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  ), [searchAnimation, searchVisible, searchQuery, selectedStatus]);
  
  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Feather name="inbox" size={64} color="#444" />
      <Text style={styles.emptyStateTitle}>
        {selectedStatus 
          ? `No ${STATE_DISPLAYS[selectedStatus]} Packages`
          : 'No Packages Found'
        }
      </Text>
      <Text style={styles.emptyStateMessage}>
        {searchQuery.trim()
          ? `No packages match "${searchQuery}"`
          : selectedStatus
          ? `You don't have any ${STATE_DISPLAYS[selectedStatus].toLowerCase()} packages yet.`
          : 'You haven\'t created any packages yet.'
        }
      </Text>
      
      {!searchQuery.trim() && (
        <TouchableOpacity style={styles.createPackageButton} onPress={() => setShowPackageModal(true)}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.createPackageButtonText}>Create Package</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [selectedStatus, searchQuery]);
  
  // Render header
  const renderHeader = useCallback(() => (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.background, 'rgba(22, 33, 62, 0.95)']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.drawerButton} onPress={router.back}>
              <Feather name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Track Packages</Text>
              {selectedStatus && (
                <Text style={styles.headerSubtitle}>
                  {STATE_DISPLAYS[selectedStatus]} • {packages.length} package{packages.length !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerAction} onPress={toggleSearch}>
              <Feather name={searchVisible ? "x" : "search"} size={20} color={colors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.headerAction} onPress={() => setShowPackageModal(true)}>
              <Feather name="plus" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  ), [insets.top, selectedStatus, packages.length, searchVisible, toggleSearch, router]);
  
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        {renderHeader()}
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            Loading {selectedStatus ? STATE_DISPLAYS[selectedStatus].toLowerCase() : ''} packages...
          </Text>
        </View>
      </View>
    );
  }
  
  if (error && packages.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        {renderHeader()}
        
        <View style={styles.errorContainer}>
          <Feather name="wifi-off" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Connection Error</Text>
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
      {renderHeader()}
      
      {/* Search Bar */}
      {renderSearchBar()}
      
      {/* Package List */}
      <FlatList
        data={packages}
        renderItem={renderPackageItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          packages.length === 0 && styles.listContainerEmpty
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            title={`Pull to refresh ${selectedStatus ? STATE_DISPLAYS[selectedStatus].toLowerCase() : ''} packages`}
            titleColor="#888"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
      
      {/* Package Creation Modal */}
      <PackageCreationModal
        visible={showPackageModal}
        onClose={() => setShowPackageModal(false)}
        onSubmit={async () => {
          setShowPackageModal(false);
          loadPackages();
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
  
  // Header styles
  headerContainer: {
    zIndex: 1000,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Search styles
  searchContainer: {
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  
  // List styles
  listContainer: {
    padding: 20,
    paddingTop: 8,
  },
  listContainerEmpty: {
    flex: 1,
  },
  
  // Package item styles
  packageItem: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  packageGradient: {
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  packageInfo: {
    flex: 1,
    marginRight: 16,
  },
  packageCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  deliveryTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  deliveryTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  stateIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageCost: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  
  // Package details styles
  packageDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  
  // Collection details styles
  collectionDetails: {
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 6,
  },
  
  // Action buttons styles
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Loading styles
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  
  // Error styles
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 25,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  createPackageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 25,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
  },
  createPackageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
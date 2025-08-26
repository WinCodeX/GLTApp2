// app/(drawer)/track.tsx - Simplified with proper filtering and date grouping
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
  SectionList,
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

// Enhanced delivery type colors
const DELIVERY_TYPE_COLORS = {
  doorstep: { color: '#3b82f6', label: 'Doorstep' },
  agent: { color: '#10b981', label: 'Agent' },
  fragile: { color: '#ef4444', label: 'Fragile' },
  collection: { color: '#9333ea', label: 'Collection' },
  express: { color: '#f59e0b', label: 'Express' },
  bulk: { color: '#6b7280', label: 'Bulk' }
} as const;

// State display names with proper capitalization
const STATE_DISPLAYS = {
  'pending': 'Pending Payment',
  'paid': 'Processing', 
  'submitted': 'Ready for Pickup',
  'in-transit': 'In Transit',
  'delivered': 'Delivered',
  'collected': 'Collected',
  'rejected': 'Cancelled'
} as const;

interface GroupedPackage {
  title: string;
  data: Package[];
  count: number;
}

export default function Track() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // FIXED: Get status from params properly
  const selectedStatus = params.status as DrawerState | undefined;
  
  // State management
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
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
      
      // Build filters for API call
      const filters: PackageFilters = {};
      
      // CRITICAL: Apply state filter if specific status is selected
      if (selectedStatus) {
        filters.state = selectedStatus;
        console.log('🔍 Filtering by state:', selectedStatus, '-> API state:', STATE_MAPPING[selectedStatus]);
      }
      
      const response = await getPackages(filters);
      
      if (response.success) {
        const packagesData = response.data || [];
        console.log('✅ Packages loaded:', packagesData.length);
        
        setAllPackages(packagesData);
        // Initially show all loaded packages (search will filter later)
        setFilteredPackages(packagesData);
        
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
  }, [selectedStatus]);
  
  // Load packages when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadPackages();
    }, [loadPackages])
  );
  
  // FIXED: Local search instead of server requests
  const performLocalSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredPackages(allPackages);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = allPackages.filter(pkg => 
      pkg.code.toLowerCase().includes(query) ||
      pkg.receiver_name.toLowerCase().includes(query) ||
      pkg.route_description.toLowerCase().includes(query) ||
      pkg.delivery_location?.toLowerCase().includes(query)
    );
    
    setFilteredPackages(filtered);
    console.log('🔍 Local search results:', filtered.length, 'of', allPackages.length);
  }, [searchQuery, allPackages]);
  
  // Apply local search when query changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performLocalSearch();
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [performLocalSearch]);
  
  // FIXED: Group packages by date
  const groupedPackages = useMemo((): GroupedPackage[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const groups: { [key: string]: Package[] } = {};
    
    filteredPackages.forEach(pkg => {
      const packageDate = new Date(pkg.created_at);
      const packageDay = new Date(packageDate.getFullYear(), packageDate.getMonth(), packageDate.getDate());
      
      let groupKey: string;
      
      if (packageDay.getTime() === today.getTime()) {
        groupKey = 'Today';
      } else if (packageDay.getTime() === yesterday.getTime()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = packageDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: packageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(pkg);
    });
    
    // Sort groups by date (Today, Yesterday, then chronological)
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      
      // For other dates, sort by most recent first
      const dateA = new Date(a + ', ' + now.getFullYear());
      const dateB = new Date(b + ', ' + now.getFullYear());
      return dateB.getTime() - dateA.getTime();
    });
    
    return sortedGroups.map(title => ({
      title,
      data: groups[title].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      count: groups[title].length
    }));
  }, [filteredPackages]);
  
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
  
  // Get receiver name display
  const getReceiverName = useCallback((packageItem: Package) => {
    return packageItem.receiver_name || 
           packageItem.recipient_name || 
           packageItem.receiver?.name ||
           packageItem.recipient?.name ||
           packageItem.to_name ||
           'Unknown Recipient';
  }, []);
  
  // Get delivery type styling
  const getDeliveryTypeStyle = useCallback((deliveryType: string) => {
    const normalizedType = deliveryType.toLowerCase();
    return DELIVERY_TYPE_COLORS[normalizedType as keyof typeof DELIVERY_TYPE_COLORS] || DELIVERY_TYPE_COLORS.agent;
  }, []);
  
  // FIXED: Render package item matching the design
  const renderPackageItem = useCallback(({ item }: { item: Package }) => {
    const canEdit = canEditPackage(item.state);
    const showPayButton = needsPayment(item.state);
    const receiverName = getReceiverName(item);
    const deliveryStyle = getDeliveryTypeStyle(item.delivery_type);
    
    // Build action buttons
    const actionButtons = [];
    
    actionButtons.push({
      label: 'Track',
      icon: 'search',
      color: '#7c3aed',
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
      onPress: () => handleViewTracking(item)
    });
    
    if (canEdit) {
      actionButtons.push({
        label: 'Edit',
        icon: 'edit-3',
        color: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        onPress: () => handleEditPackage(item)
      });
    }
    
    if (showPayButton) {
      actionButtons.push({
        label: 'Pay',
        icon: 'credit-card',
        color: '#fff',
        backgroundColor: '#10b981',
        onPress: () => handlePayPackage(item)
      });
    }
    
    return (
      <View style={styles.packageItem}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']}
          style={styles.packageGradient}
        >
          {/* Package Header */}
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageCode}>{item.code}</Text>
              <Text style={styles.routeDescription}>{item.route_description}</Text>
            </View>
            
            <View style={styles.packageBadges}>
              <View style={[styles.deliveryTypeBadge, { backgroundColor: deliveryStyle.color }]}>
                <Text style={styles.deliveryTypeText}>{deliveryStyle.label}</Text>
              </View>
              
              <View style={[
                styles.stateBadge,
                { backgroundColor: getStateColor(item.state) }
              ]}>
                <Text style={styles.stateText}>
                  {getStateDisplay(item.state).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Package Details */}
          <View style={styles.packageDetails}>
            <Text style={styles.receiverText}>To: {receiverName}</Text>
            
            <View style={styles.costContainer}>
              <Text style={styles.costLabel}>Cost</Text>
              <Text style={styles.costValue}>KES {item.cost}</Text>
            </View>
          </View>
          
          {/* Action Buttons */}
          {actionButtons.length > 0 && (
            <View style={styles.actionButtons}>
              {actionButtons.map((button, buttonIndex) => (
                <TouchableOpacity
                  key={buttonIndex}
                  style={[
                    styles.actionButton, 
                    { backgroundColor: button.backgroundColor }
                  ]}
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
  
  // Render section header
  const renderSectionHeader = useCallback(({ section }: { section: GroupedPackage }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionCountBadge}>
        <Text style={styles.sectionCountText}>{section.count} package{section.count !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  ), []);
  
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
          placeholder="Search packages..."
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
  ), [searchAnimation, searchVisible, searchQuery]);
  
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
  
  // FIXED: Render header matching the design
  const renderHeader = useCallback(() => {
    const totalPackages = filteredPackages.length;
    const statusTitle = selectedStatus ? STATE_DISPLAYS[selectedStatus] : 'All Packages';
    const statusSubtitle = selectedStatus 
      ? `Packages ${selectedStatus === 'pending' ? 'awaiting payment' : 'in this category'}`
      : 'All your packages';
    
    return (
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[colors.background, 'rgba(22, 33, 62, 0.95)']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Feather name="arrow-left" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.headerTitleContainer}>
                <View style={styles.headerTitleRow}>
                  <Feather name="clock" size={20} color="#f59e0b" style={styles.headerIcon} />
                  <Text style={styles.headerTitle}>{statusTitle}</Text>
                </View>
                <Text style={styles.headerSubtitle}>{statusSubtitle}</Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              {totalPackages > 0 && (
                <View style={styles.packageCountBadge}>
                  <Text style={styles.packageCountText}>{totalPackages}</Text>
                </View>
              )}
              
              <TouchableOpacity style={styles.headerActionButton} onPress={toggleSearch}>
                <Feather name={searchVisible ? "x" : "search"} size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }, [insets.top, selectedStatus, filteredPackages.length, searchVisible, toggleSearch, router]);
  
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        {renderHeader()}
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      </View>
    );
  }
  
  if (error && filteredPackages.length === 0) {
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
      <SectionList
        sections={groupedPackages}
        renderItem={renderPackageItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          groupedPackages.length === 0 && styles.listContainerEmpty
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            title="Pull to refresh packages"
            titleColor="#888"
          />
        }
        ListEmptyComponent={renderEmptyState}
        stickySectionHeadersEnabled={false}
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
  
  // Header styles matching the design
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
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
    gap: 12,
  },
  packageCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  packageCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  headerActionButton: {
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
  
  // Section header styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sectionCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Package item styles matching the design
  packageItem: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  packageGradient: {
    padding: 20,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  packageInfo: {
    flex: 1,
    marginRight: 16,
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
    lineHeight: 20,
  },
  packageBadges: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deliveryTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  deliveryTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  stateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  
  // Package details styles
  packageDetails: {
    marginBottom: 16,
  },
  receiverText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  costContainer: {
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  costValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  
  // Action buttons styles
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
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
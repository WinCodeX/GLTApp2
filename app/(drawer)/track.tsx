// app/(drawer)/track.tsx - FIXED: Removed QR code call and updated styling
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
import api from '@/lib/api';
import colors from '@/theme/colors';
import PackageCreationModal from '@/components/PackageCreationModal';

// Types
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
  updated_at: string;
  origin_area?: any;
  destination_area?: any;
  origin_agent?: any;
  destination_agent?: any;
  delivery_location?: string;
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
  business_name?: string;
  // Additional fields for compatibility
  recipient_name?: string;
  receiver?: { name: string };
  recipient?: { name: string };
  to_name?: string;
  from_location?: string;
  to_location?: string;
}

interface PackageResponse {
  data: Package[];
  pagination: {
    total_count: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  success: boolean;
  message?: string;
}

// Drawer state type
type DrawerState = 
  | 'pending' 
  | 'paid' 
  | 'submitted' 
  | 'in-transit' 
  | 'delivered' 
  | 'collected' 
  | 'rejected';

// State mapping based on backend expectations
const STATE_MAPPING: Record<DrawerState, string> = {
  'pending': 'pending_unpaid',     // Drawer "Pending" = API "pending_unpaid"
  'paid': 'pending',               // Drawer "Paid" = API "pending"  
  'submitted': 'submitted',        // Direct mapping
  'in-transit': 'in_transit',      // Drawer uses hyphen, API uses underscore
  'delivered': 'delivered',        // Direct mapping
  'collected': 'collected',        // Direct mapping
  'rejected': 'rejected'           // Direct mapping
};

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

  // Get packages with proper API integration
  const getPackages = useCallback(async (filters?: { state?: string; search?: string; page?: number; per_page?: number }): Promise<PackageResponse> => {
    try {
      console.log('📦 getPackages called with filters:', filters);
      
      // Build query parameters
      const params = new URLSearchParams();
      
      if (filters?.state) {
        params.append('state', filters.state);
        console.log('🎯 Adding state filter:', filters.state);
      }
      
      if (filters?.page) {
        params.append('page', filters.page.toString());
      }
      
      if (filters?.per_page) {
        params.append('per_page', filters.per_page.toString());
      }
      
      if (filters?.search) {
        params.append('search', filters.search);
      }
      
      const queryString = params.toString();
      const url = `/api/v1/packages${queryString ? '?' + queryString : ''}`;
      
      console.log('📡 Making API request to:', url);
      
      const response = await api.get(url, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 API Response status:', response.status);
      console.log('📡 API Response data keys:', Object.keys(response.data));
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch packages');
      }
      
      // Transform the response data to match expected format
      const transformedPackages = response.data.data.map((pkg: any) => ({
        id: String(pkg.id || ''),
        code: pkg.code || '',
        state: pkg.state || 'unknown',
        state_display: pkg.state_display || pkg.state?.charAt(0).toUpperCase() + pkg.state?.slice(1) || 'Unknown',
        sender_name: pkg.sender_name || 'Unknown Sender',
        receiver_name: pkg.receiver_name || 'Unknown Receiver',
        receiver_phone: pkg.receiver_phone || '',
        route_description: pkg.route_description || 'Route information unavailable',
        cost: Number(pkg.cost) || 0,
        delivery_type: pkg.delivery_type || 'agent',
        created_at: pkg.created_at || new Date().toISOString(),
        updated_at: pkg.updated_at || pkg.created_at || new Date().toISOString(),
        origin_area: pkg.origin_area,
        destination_area: pkg.destination_area,
        origin_agent: pkg.origin_agent,
        destination_agent: pkg.destination_agent,
        delivery_location: pkg.delivery_location,
        sender_phone: pkg.sender_phone,
        sender_email: pkg.sender_email,
        receiver_email: pkg.receiver_email,
        business_name: pkg.business_name,
        // Additional fields for compatibility
        recipient_name: pkg.recipient_name || pkg.receiver_name,
        receiver: pkg.receiver || { name: pkg.receiver_name },
        recipient: pkg.recipient || { name: pkg.receiver_name },
        to_name: pkg.to_name || pkg.receiver_name,
        from_location: pkg.from_location || pkg.origin_area?.name,
        to_location: pkg.to_location || pkg.destination_area?.name,
      }));
      
      const result: PackageResponse = {
        data: transformedPackages,
        pagination: response.data.pagination || {
          total_count: transformedPackages.length,
          page: 1,
          per_page: transformedPackages.length,
          total_pages: 1
        },
        success: true,
        message: response.data.message
      };
      
      console.log('✅ Transformed packages:', result.data.length);
      return result;
      
    } catch (error: any) {
      console.error('❌ getPackages error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }, []);

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
        color: '#f97316' // Orange for pending payment
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

  // Search functionality
  const filterPackages = useCallback((packages: Package[], query: string) => {
    if (!query.trim()) {
      return packages;
    }

    const lowercaseQuery = query.toLowerCase().trim();
    
    return packages.filter(pkg => {
      // Get receiver name
      const receiverName = (pkg.receiver_name || 
                           pkg.recipient_name || 
                           pkg.receiver?.name ||
                           pkg.recipient?.name ||
                           pkg.to_name || '').toLowerCase();
      
      // Get route/location info
      const routeDescription = (pkg.route_description || '').toLowerCase();
      const fromLocation = (pkg.from_location || '').toLowerCase();
      const toLocation = (pkg.to_location || '').toLowerCase();
      const packageCode = (pkg.code || '').toLowerCase();
      
      // Search in multiple fields
      return receiverName.includes(lowercaseQuery) ||
             routeDescription.includes(lowercaseQuery) ||
             fromLocation.includes(lowercaseQuery) ||
             toLocation.includes(lowercaseQuery) ||
             packageCode.includes(lowercaseQuery);
    });
  }, []);

  // Update filtered packages when search query or packages change
  useEffect(() => {
    const filtered = filterPackages(packages, searchQuery);
    setFilteredPackages(filtered);
  }, [packages, searchQuery, filterPackages]);

  // Toggle search functionality
  const toggleSearch = useCallback(() => {
    const newVisible = !searchVisible;
    setSearchVisible(newVisible);
    
    Animated.timing(searchAnimation, {
      toValue: newVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (!newVisible) {
      setSearchQuery('');
    }
  }, [searchVisible, searchAnimation]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Modal handlers
  const handleOpenCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handlePackageCreated = useCallback(() => {
    setShowCreateModal(false);
    loadPackages(true);
  }, []);

  // Load packages with correct state mapping and error handling
  const loadPackages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      console.log('🎯 === DEBUGGING PACKAGE FILTERING ===');
      console.log('📦 selectedStatus from drawer params:', selectedStatus);
      console.log('🔄 STATE_MAPPING:', STATE_MAPPING);
      
      let apiState: string | undefined;
      if (selectedStatus) {
        apiState = STATE_MAPPING[selectedStatus];
        console.log('🗺️ Mapping:', { 
          drawerState: selectedStatus, 
          apiState: apiState,
          mappingExists: apiState !== undefined 
        });
      }
      
      // Build filters with the correctly mapped API state
      const filters = apiState ? { state: apiState } : undefined;
      
      console.log('📨 Final filters for API:', JSON.stringify(filters, null, 2));
      
      const response = await getPackages(filters);
      
      console.log('✅ API Response received:', {
        success: response.success,
        totalPackages: response.data.length,
        totalCount: response.pagination?.total_count,
        message: response.message
      });

      // Log the actual states of returned packages to verify filtering worked
      if (response.data.length > 0) {
        const states = response.data.map(pkg => pkg.state);
        const uniqueStates = [...new Set(states)];
        console.log('📊 Actual returned package states:', uniqueStates);
        console.log('🎯 Expected state was:', apiState || 'ALL');
        
        // Check if filtering worked correctly
        if (apiState) {
          const correctlyFiltered = states.every(state => state === apiState);
          console.log('✅ Filtering working correctly:', correctlyFiltered);
          
          if (!correctlyFiltered) {
            console.error('❌ FILTERING FAILED!');
            console.error('Expected all packages to have state:', apiState);
            console.error('But got states:', uniqueStates);
            
            // FALLBACK: Apply client-side filtering as backup
            console.log('🔧 Applying client-side filtering as fallback...');
            const clientFiltered = response.data.filter(pkg => pkg.state === apiState);
            console.log('🔧 Client-side filtered:', clientFiltered.length, 'packages');
            
            if (clientFiltered.length > 0) {
              console.log('✅ Client-side filtering successful, using filtered results');
              setPackages(clientFiltered);
              return;
            } else {
              console.log('⚠️ Client-side filtering returned no results, using all results with warning');
              Toast.show({
                type: 'info',
                text1: 'Backend Filtering Issue',
                text2: 'Showing all packages due to backend filtering problem',
                position: 'top',
                visibilityTime: 4000,
              });
            }
          }
        }
      } else {
        console.log('📦 No packages returned for state:', apiState || 'ALL');
      }
      console.log('🎯 === END DEBUGGING ===');
      
      setPackages(response.data);
      
    } catch (error: any) {
      console.error('❌ Failed to load packages:', error);
      setError(error.message);
      
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Packages',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus, getPackages]);

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

  // Get delivery type display with all types
  const getDeliveryTypeDisplay = useCallback((deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return 'Doorstep';
      case 'agent': return 'Office';
      case 'fragile': return 'Fragile';
      case 'collection': return 'Collection';
      case 'mixed': return 'Mixed';
      default: return 'Office';
    }
  }, []);

  // Get delivery type badge color with requested colors
  const getDeliveryTypeBadgeColor = useCallback((deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return '#8b5cf6';    // Purple
      case 'agent': return '#3b82f6';       // Blue (Office)
      case 'fragile': return '#f97316';     // Orange
      case 'collection': return '#10b981';  // Green
      case 'mixed': return '#10b981';       // Green for mixed
      default: return '#8b5cf6';
    }
  }, []);

  // Group packages by date
  const groupPackagesByDate = useCallback((packages: Package[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const groups: { [key: string]: Package[] } = {
      'Today': [],
      'Yesterday': [],
    };

    packages.forEach(pkg => {
      const pkgDate = new Date(pkg.created_at);
      const pkgDateStr = pkgDate.toDateString();
      const todayStr = today.toDateString();
      const yesterdayStr = yesterday.toDateString();

      if (pkgDateStr === todayStr) {
        groups['Today'].push(pkg);
      } else if (pkgDateStr === yesterdayStr) {
        groups['Yesterday'].push(pkg);
      } else {
        const dateKey = pkgDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(pkg);
      }
    });

    // Remove empty groups and sort packages within groups by newest first
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      } else {
        groups[key].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    });

    return groups;
  }, []);
  
  const getStateBadgeColor = useCallback((state: string) => {
    switch (state) {
      case 'pending_unpaid': return '#f97316'; // Orange to match image
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
    return state === 'pending_unpaid';
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

  // FIXED: Handle view tracking details - REMOVED QR code generation
  const handleViewTracking = useCallback((packageItem: Package) => {
    console.log('🔍 Viewing tracking for package:', packageItem.code);
    
    // Navigate directly to tracking page without QR code generation
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

  // Render package item
  const renderPackageItem = useCallback(({ item }: { item: Package }) => {
    const canEdit = canEditPackage(item.state);
    const showPayButton = needsPayment(item.state);
    const receiverName = getReceiverName(item);
    
    // Build action buttons array based on state
    const actionButtons = [];
    
    // Track button - always available - FIXED: Updated icon color to match outline
    actionButtons.push({
      key: 'track',
      icon: 'navigation',
      text: 'Track',
      onPress: () => handleViewTracking(item),
      style: [styles.actionButton, styles.trackButton],
      textStyle: [styles.actionButtonText, styles.trackButtonText],
      iconColor: '#64748b' // Updated to match the border color
    });
    
    // Edit button - only if editable
    if (canEdit) {
      actionButtons.push({
        key: 'edit',
        icon: 'edit-3',
        text: 'Edit',
        onPress: () => handleEditPackage(item),
        style: [styles.actionButton, styles.editButton],
        textStyle: [styles.actionButtonText, styles.editButtonText],
        iconColor: '#8b5cf6'
      });
    }
    
    // Pay button - only if needs payment - FIXED: Changed to solid purple background
    if (showPayButton) {
      actionButtons.push({
        key: 'pay',
        icon: 'credit-card',
        text: 'Pay Now',
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
              {/* Delivery Type Badge - transparent style */}
              <View style={[styles.deliveryTypeBadge, { borderColor: getDeliveryTypeBadgeColor(item.delivery_type) }]}>
                <Text style={[styles.badgeText, { color: getDeliveryTypeBadgeColor(item.delivery_type) }]}>
                  {getDeliveryTypeDisplay(item.delivery_type)}
                </Text>
              </View>
              {/* State Badge - solid background style like in image */}
              <View style={[styles.stateBadge, { backgroundColor: getStateBadgeColor(item.state) }]}>
                <Text style={styles.badgeText}>{item.state_display?.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Receiver Section */}
          <View style={styles.receiverSection}>
            <Text style={styles.receiverText}>To: {receiverName}</Text>
          </View>

          {/* Cost Section - FIXED: Changed color to purple */}
          <View style={styles.costSection}>
            <Text style={styles.costLabel}>Cost</Text>
            <Text style={styles.costValue}>KES {item.cost.toLocaleString()}</Text>
          </View>

          {/* Dynamic Action Buttons */}
          <View style={[
            styles.actionButtons,
            actionButtons.length === 1 && styles.singleButton,
            actionButtons.length === 2 && styles.doubleButtons,
            actionButtons.length === 3 && styles.tripleButtons
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
  }, [getStateBadgeColor, getDeliveryTypeDisplay, getDeliveryTypeBadgeColor, canEditPackage, needsPayment, handleEditPackage, handlePayPackage, handleViewTracking, getReceiverName]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyStateContainer}>
      <LinearGradient
        colors={['rgba(26, 26, 46, 0.6)', 'rgba(22, 33, 62, 0.6)']}
        style={styles.emptyStateCard}
      >
        <Feather name={stateDisplayInfo.icon} size={64} color="#666" />
        <Text style={styles.emptyStateTitle}>
          {searchQuery ? 'No Matching Packages' : `No ${stateDisplayInfo.title} Found`}
        </Text>
        <Text style={styles.emptyStateSubtitle}>
          {searchQuery 
            ? `No packages found matching "${searchQuery}". Try a different search term.`
            : selectedStatus 
              ? `You don't have any packages in "${stateDisplayInfo.title.toLowerCase()}" state.`
              : 'You haven\'t created any packages yet.'
          }
        </Text>
        
        {!searchQuery && (
          <TouchableOpacity style={styles.emptyStateButton} onPress={handleOpenCreateModal}>
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.emptyStateButtonText}>Create Package</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  ), [stateDisplayInfo, selectedStatus, searchQuery, handleOpenCreateModal]);

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

  // Use filtered packages for display
  const displayPackages = filteredPackages;

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
            
            {/* Search Button */}
            <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
              <Feather name="search" size={20} color="#fff" />
            </TouchableOpacity>
            
            {/* Package Count */}
            {displayPackages.length > 0 && (
              <View style={styles.packageCount}>
                <Text style={styles.packageCountText}>{displayPackages.length}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
        
        {/* Search Input Dropdown */}
        <Animated.View style={[
          styles.searchContainer,
          {
            maxHeight: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 60],
            }),
            opacity: searchAnimation,
          }
        ]}>
          <LinearGradient
            colors={['rgba(22, 33, 62, 0.95)', 'rgba(26, 26, 46, 0.95)']}
            style={styles.searchInputContainer}
          >
            <Feather name="search" size={18} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by receiver, location, or package code..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Feather name="x" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      ) : error ? (
        renderErrorState()
      ) : displayPackages.length === 0 ? (
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
          {/* Search Results Info */}
          {searchQuery && (
            <View style={styles.searchResultsInfo}>
              <Text style={styles.searchResultsText}>
                Found {displayPackages.length} package{displayPackages.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </Text>
            </View>
          )}
          
          {/* Render Grouped Packages */}
          {(() => {
            const groupedPackages = groupPackagesByDate(displayPackages);
            return Object.entries(groupedPackages).map(([dateGroup, packages]) => (
              <View key={dateGroup} style={styles.dateGroup}>
                {/* Date Group Header */}
                <View style={styles.dateGroupHeader}>
                  <Text style={styles.dateGroupTitle}>{dateGroup}</Text>
                  <Text style={styles.dateGroupCount}>{packages.length} package{packages.length !== 1 ? 's' : ''}</Text>
                </View>
                
                {/* Packages in this date group */}
                {packages.map((pkg) => (
                  <View key={pkg.id}>
                    {renderPackageItem({ item: pkg })}
                  </View>
                ))}
              </View>
            ));
          })()}
          
          {/* Load more indicator if needed */}
          <View style={styles.listFooter}>
            <Text style={styles.listFooterText}>
              Showing {displayPackages.length} packages
            </Text>
          </View>
        </ScrollView>
      )}
      
      {/* Package Creation Modal */}
      <PackageCreationModal
        visible={showCreateModal}
        onClose={handleCloseCreateModal}
        onPackageCreated={handlePackageCreated}
      />
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
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
  
  // Search functionality styles
  searchContainer: {
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchResultsInfo: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchResultsText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  
  // Date grouping styles
  dateGroup: {
    marginBottom: 20,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 12,
  },
  dateGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dateGroupCount: {
    fontSize: 12,
    color: '#888',
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  
  // Package card styles
  packageCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  packageCardGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  
  // Package header
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  
  // Badge container and styles - mixed styles
  badgeContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  deliveryTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
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
  
  // Cost section - FIXED: Changed color to purple
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
    color: '#8b5cf6', // Changed from green to purple
    fontWeight: '700',
  },
  
  // Action buttons
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
  
  // Base action button styling
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    gap: 6,
    minHeight: 36,
  },
  
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Track button - FIXED: Brighter border for visibility
  trackButton: {
    borderColor: '#64748b', // Light slate gray - much more visible
    backgroundColor: 'transparent',
  },
  trackButtonText: {
    color: '#64748b', // Match the border color
  },
  
  // Edit button - purple outline  
  editButton: {
    borderColor: '#8b5cf6',
    backgroundColor: 'transparent',
  },
  editButtonText: {
    color: '#8b5cf6',
  },
  
  // Pay button - FIXED: Solid purple background to match image
  payButton: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf6', // Solid purple background
  },
  payButtonText: {
    color: '#fff', // White text on purple background
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
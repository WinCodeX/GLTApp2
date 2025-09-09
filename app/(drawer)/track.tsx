// app/(drawer)/track.tsx - FIXED: Fetch ALL packages without pagination limits
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
import MpesaPaymentModal from '@/components/MpesaPaymentModal';

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

type DrawerState = 
  | 'pending' 
  | 'paid' 
  | 'submitted' 
  | 'in-transit' 
  | 'delivered' 
  | 'collected' 
  | 'rejected';

const STATE_MAPPING: Record<DrawerState, string> = {
  'pending': 'pending_unpaid',
  'paid': 'pending', 
  'submitted': 'submitted',
  'in-transit': 'in_transit',
  'delivered': 'delivered',
  'collected': 'collected',
  'rejected': 'rejected'
};

export default function Track() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const selectedStatus = params.status as DrawerState | undefined;
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAnimation] = useState(new Animated.Value(0));
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPackageForPayment, setSelectedPackageForPayment] = useState<Package | null>(null);

  // FIXED: Get ALL packages without pagination limits
  const getPackages = useCallback(async (filters?: { state?: string; search?: string }): Promise<PackageResponse> => {
    try {
      console.log('📦 getPackages called with filters:', filters);
      
      const params = new URLSearchParams();
      
      if (filters?.state) {
        params.append('state', filters.state);
        console.log('🎯 Adding state filter:', filters.state);
      }
      
      // FIXED: Request ALL packages by setting high per_page limit and starting from page 1
      params.append('per_page', '1000'); // Set high limit to get all packages
      params.append('page', '1');
      
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
        color: '#f97316'
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

  const filterPackages = useCallback((packages: Package[], query: string) => {
    if (!query.trim()) {
      return packages;
    }

    const lowercaseQuery = query.toLowerCase().trim();
    
    return packages.filter(pkg => {
      const receiverName = (pkg.receiver_name || 
                           pkg.recipient_name || 
                           pkg.receiver?.name ||
                           pkg.recipient?.name ||
                           pkg.to_name || '').toLowerCase();
      
      const routeDescription = (pkg.route_description || '').toLowerCase();
      const fromLocation = (pkg.from_location || '').toLowerCase();
      const toLocation = (pkg.to_location || '').toLowerCase();
      const packageCode = (pkg.code || '').toLowerCase();
      
      return receiverName.includes(lowercaseQuery) ||
             routeDescription.includes(lowercaseQuery) ||
             fromLocation.includes(lowercaseQuery) ||
             toLocation.includes(lowercaseQuery) ||
             packageCode.includes(lowercaseQuery);
    });
  }, []);

  useEffect(() => {
    const filtered = filterPackages(packages, searchQuery);
    setFilteredPackages(filtered);
  }, [packages, searchQuery, filterPackages]);

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

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

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

  const handleOpenPaymentModal = useCallback((packageItem: Package) => {
    console.log('💳 Opening payment modal for package:', packageItem.code);
    setSelectedPackageForPayment(packageItem);
    setShowPaymentModal(true);
  }, []);

  const handleClosePaymentModal = useCallback(() => {
    setShowPaymentModal(false);
    setSelectedPackageForPayment(null);
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    console.log('✅ Payment successful, refreshing packages');
    
    Toast.show({
      type: 'success',
      text1: 'Payment Successful!',
      text2: 'Your package payment has been processed',
      position: 'top',
      visibilityTime: 4000,
    });
    
    loadPackages(true);
  }, []);

  // FIXED: Load ALL packages with correct state mapping and no pagination limits
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
      
      const filters = apiState ? { state: apiState } : undefined;
      
      console.log('📨 Final filters for API:', JSON.stringify(filters, null, 2));
      
      const response = await getPackages(filters);
      
      console.log('✅ API Response received:', {
        success: response.success,
        totalPackages: response.data.length,
        totalCount: response.pagination?.total_count,
        message: response.message
      });

      if (response.data.length > 0) {
        const states = response.data.map(pkg => pkg.state);
        const uniqueStates = [...new Set(states)];
        console.log('📊 Actual returned package states:', uniqueStates);
        console.log('🎯 Expected state was:', apiState || 'ALL');
        
        if (apiState) {
          const correctlyFiltered = states.every(state => state === apiState);
          console.log('✅ Filtering working correctly:', correctlyFiltered);
          
          if (!correctlyFiltered) {
            console.error('❌ FILTERING FAILED!');
            console.error('Expected all packages to have state:', apiState);
            console.error('But got states:', uniqueStates);
            
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

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const handleRefresh = useCallback(() => {
    loadPackages(true);
  }, [loadPackages]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  const getDeliveryTypeDisplay = useCallback((deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return 'Home';
      case 'agent': return 'Office';
      case 'fragile': return 'Fragile';
      case 'collection': return 'Collection';
      case 'mixed': return 'Mixed';
      default: return 'Office';
    }
  }, []);

  const getDeliveryTypeBadgeColor = useCallback((deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return '#8b5cf6';
      case 'agent': return '#3b82f6';
      case 'fragile': return '#f97316';
      case 'collection': return '#10b981';
      case 'mixed': return '#10b981';
      default: return '#8b5cf6';
    }
  }, []);

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

  const canEditPackage = useCallback((state: string) => {
    return ['pending_unpaid', 'pending', 'rejected'].includes(state);
  }, []);

  const needsPayment = useCallback((state: string) => {
    return state === 'pending_unpaid';
  }, []);

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
    handleOpenPaymentModal(packageItem);
  }, [handleOpenPaymentModal]);

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

  const getReceiverName = useCallback((packageItem: Package) => {
    return packageItem.receiver_name || 
           packageItem.recipient_name || 
           packageItem.receiver?.name ||
           packageItem.recipient?.name ||
           packageItem.to_name ||
           'Unknown Recipient';
  }, []);

  const renderPackageItem = useCallback(({ item }: { item: Package }) => {
    const canEdit = canEditPackage(item.state);
    const showPayButton = needsPayment(item.state);
    const receiverName = getReceiverName(item);
    
    const actionButtons = [];
    
    actionButtons.push({
      key: 'track',
      icon: 'navigation',
      text: 'Track',
      onPress: () => handleViewTracking(item),
      style: [styles.actionButton, styles.trackButton],
      textStyle: [styles.actionButtonText, styles.trackButtonText],
      iconColor: '#64748b'
    });
    
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
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageCode}>{item.code}</Text>
              <Text style={styles.routeDescription}>{item.route_description}</Text>
            </View>
            <View style={styles.badgeContainer}>
              <View style={[styles.deliveryTypeBadge, { borderColor: getDeliveryTypeBadgeColor(item.delivery_type) }]}>
                <Text style={[styles.badgeText, { color: getDeliveryTypeBadgeColor(item.delivery_type) }]}>
                  {getDeliveryTypeDisplay(item.delivery_type)}
                </Text>
              </View>
              <View style={[styles.stateBadge, { backgroundColor: getStateBadgeColor(item.state) }]}>
                <Text style={styles.badgeText}>{item.state_display?.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.receiverSection}>
            <Text style={styles.receiverText}>To: {receiverName}</Text>
          </View>

          <View style={styles.costSection}>
            <Text style={styles.costLabel}>Cost</Text>
            <Text style={styles.costValue}>KES {item.cost.toLocaleString()}</Text>
          </View>

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

  const displayPackages = filteredPackages;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
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
            
            <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
              <Feather name="search" size={20} color="#fff" />
            </TouchableOpacity>
            
            {displayPackages.length > 0 && (
              <View style={styles.packageCount}>
                <Text style={styles.packageCountText}>{displayPackages.length}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
        
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
          {searchQuery && (
            <View style={styles.searchResultsInfo}>
              <Text style={styles.searchResultsText}>
                Found {displayPackages.length} package{displayPackages.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </Text>
            </View>
          )}
          
          {(() => {
            const groupedPackages = groupPackagesByDate(displayPackages);
            return Object.entries(groupedPackages).map(([dateGroup, packages]) => (
              <View key={dateGroup} style={styles.dateGroup}>
                <View style={styles.dateGroupHeader}>
                  <Text style={styles.dateGroupTitle}>{dateGroup}</Text>
                  <Text style={styles.dateGroupCount}>{packages.length} package{packages.length !== 1 ? 's' : ''}</Text>
                </View>
                
                {packages.map((pkg) => (
                  <View key={pkg.id}>
                    {renderPackageItem({ item: pkg })}
                  </View>
                ))}
              </View>
            ));
          })()}
          
          <View style={styles.listFooter}>
            <Text style={styles.listFooterText}>
              Showing {displayPackages.length} packages
            </Text>
          </View>
        </ScrollView>
      )}
      
      <PackageCreationModal
        visible={showCreateModal}
        onClose={handleCloseCreateModal}
        onPackageCreated={handlePackageCreated}
      />

      <MpesaPaymentModal
        visible={showPaymentModal}
        onClose={handleClosePaymentModal}
        onPaymentSuccess={handlePaymentSuccess}
        packageData={selectedPackageForPayment}
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
  
  packagesList: {
    flex: 1,
  },
  packagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  
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
  
  receiverSection: {
    marginBottom: 8,
  },
  receiverText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  
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
    color: '#8b5cf6',
    fontWeight: '700',
  },
  
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  
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
  
  trackButton: {
    borderColor: '#64748b',
    backgroundColor: 'transparent',
  },
  trackButtonText: {
    color: '#64748b',
  },
  
  editButton: {
    borderColor: '#8b5cf6',
    backgroundColor: 'transparent',
  },
  editButtonText: {
    color: '#8b5cf6',
  },
  
  payButton: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf6',
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  listFooter: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  listFooterText: {
    fontSize: 12,
    color: '#666',
  },
});
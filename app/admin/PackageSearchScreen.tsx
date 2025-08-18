// app/admin/PackageSearchScreen.tsx - FIXED: Status bar spacing and improved UX

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import QRScanner from '../../components/QRScanner';
import PackageEditModal from '../../components/PackageEditModal';
import api from '../../lib/api';

const { width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

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
  available_actions?: AvailableAction[];
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
  business_name?: string;
  origin_area?: Area;
  destination_area?: Area;
  origin_agent?: Agent;
  destination_agent?: Agent;
  delivery_location?: string;
}

interface Area {
  id: string;
  name: string;
  location?: Location;
}

interface Location {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  phone: string;
  area?: Area;
}

interface AvailableAction {
  action: string;
  label: string;
  description: string;
}

interface PackageSearchScreenProps {
  userRole?: 'client' | 'agent' | 'rider' | 'warehouse' | 'admin';
}

const PackageSearchScreen: React.FC<PackageSearchScreenProps> = ({
  userRole = 'agent',
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>(userRole);
  const [isOnline, setIsOnline] = useState(true);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [loadingPackageDetails, setLoadingPackageDetails] = useState<string | null>(null);
  
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadUserRole();
    loadRecentSearches();
  }, []);

  const loadUserRole = async () => {
    try {
      const storedRole = await SecureStore.getItemAsync('user_role');
      if (storedRole) {
        setCurrentUserRole(storedRole);
        console.log('👤 Loaded user role:', storedRole);
      }
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const recent = await SecureStore.getItemAsync('recent_package_searches');
      if (recent) {
        setRecentSearches(JSON.parse(recent));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      setRecentSearches(updated);
      await SecureStore.setItemAsync('recent_package_searches', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  };

  const handleSearch = async (query: string = searchQuery) => {
    if (!query.trim()) {
      Toast.show({
        type: 'info',
        text1: 'Search Required',
        text2: 'Please enter a package code to search',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    Keyboard.dismiss();

    try {
      console.log('🔍 Searching for packages with query:', query);
      
      // Check connectivity
      const response = await api.get('/api/v1/ping');
      setIsOnline(true);
      
      // Search packages using the API
      const searchResponse = await api.get(`/api/v1/packages/search?query=${encodeURIComponent(query.trim())}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 Search response:', searchResponse.data);

      if (searchResponse.data.success) {
        const packages = searchResponse.data.data || [];
        setSearchResults(packages);
        
        await saveRecentSearch(query.trim());
        
        Toast.show({
          type: 'success',
          text1: 'Search Complete',
          text2: `Found ${packages.length} package${packages.length !== 1 ? 's' : ''}`,
          position: 'top',
          visibilityTime: 2000,
        });
      } else {
        setSearchResults([]);
        Toast.show({
          type: 'info',
          text1: 'No Results',
          text2: searchResponse.data.message || 'No packages found matching your search',
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error: any) {
      console.error('❌ Search error:', error);
      setIsOnline(false);
      setSearchResults([]);
      
      let errorMessage = 'Search failed. Please try again.';
      if (error.message?.includes('Network Error') || error.message?.includes('timeout')) {
        errorMessage = 'Network error. Check your connection and try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Toast.show({
        type: 'error',
        text1: 'Search Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (hasSearched && searchQuery.trim()) {
      setRefreshing(true);
      await handleSearch(searchQuery);
      setRefreshing(false);
    }
  };

  const handleScanSuccess = async (result: any) => {
    const packageCode = result.package?.code || result.code || 'PKG-SCANNED-20240814';
    setSearchQuery(packageCode);
    setShowScanner(false);
    
    // Automatically search for the scanned package
    await handleSearch(packageCode);
  };

  const performPackageAction = async (packageObj: Package, action: string) => {
    try {
      // Show appropriate confirmation for different actions
      if (action === 'give_to_receiver') {
        Alert.alert(
          'Confirm Handover',
          `Are you sure you want to give package ${packageObj.code} to the receiver?\n\nReceiver: ${packageObj.receiver_name}\nPhone: ${packageObj.receiver_phone}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Confirm Handover', 
              style: 'default',
              onPress: () => executePackageAction(packageObj, action)
            }
          ]
        );
        return;
      }

      await executePackageAction(packageObj, action);
    } catch (error) {
      console.error('Action error:', error);
    }
  };

  const executePackageAction = async (packageObj: Package, action: string) => {
    try {
      Toast.show({
        type: 'info',
        text1: 'Processing Action',
        text2: `${getActionLabel(action)} for ${packageObj.code}...`,
        position: 'top',
        visibilityTime: 2000,
      });

      const response = await api.post('/api/v1/scanning/scan_action', {
        package_code: packageObj.code,
        action_type: action,
        metadata: {
          source: 'package_search',
          timestamp: new Date().toISOString()
        }
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: getActionSuccessTitle(action),
          text2: response.data.message || getActionSuccessMessage(action, packageObj.code),
          position: 'top',
          visibilityTime: 3000,
        });
        
        // Refresh the search results
        await handleSearch(searchQuery);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Action Failed',
          text2: response.data.message,
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error: any) {
      console.error('Action error:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to perform action. Please try again.';
      
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'collect_from_sender': return 'Collecting from sender';
      case 'collect': return 'Collecting from agent';
      case 'deliver': return 'Marking as delivered';
      case 'give_to_receiver': return 'Giving to receiver';
      case 'print': return 'Printing receipt';
      case 'process': return 'Processing';
      case 'confirm_receipt': return 'Confirming receipt';
      default: return action;
    }
  };

  const getActionSuccessTitle = (action: string): string => {
    switch (action) {
      case 'collect_from_sender': return 'Package Collected';
      case 'collect': return 'Package Collected';
      case 'deliver': return 'Delivery Confirmed';
      case 'give_to_receiver': return 'Handover Complete';
      case 'print': return 'Receipt Printed';
      case 'process': return 'Package Processed';
      case 'confirm_receipt': return 'Receipt Confirmed';
      default: return 'Action Complete';
    }
  };

  const getActionSuccessMessage = (action: string, packageCode: string): string => {
    switch (action) {
      case 'collect_from_sender': return `${packageCode} collected from sender successfully`;
      case 'collect': return `${packageCode} collected from agent successfully`;
      case 'deliver': return `${packageCode} marked as delivered successfully`;
      case 'give_to_receiver': return `${packageCode} handed over to receiver successfully`;
      case 'print': return `Receipt for ${packageCode} printed successfully`;
      case 'process': return `${packageCode} processed successfully`;
      case 'confirm_receipt': return `Receipt for ${packageCode} confirmed`;
      default: return `Action completed for ${packageCode}`;
    }
  };

  const handleEditPackage = async (packageObj: Package) => {
    try {
      console.log('✏️ Starting edit package process for:', packageObj.code);
      setLoadingPackageDetails(packageObj.code);
      
      console.log('📡 Fetching comprehensive package details...');
      const response = await api.get(`/api/v1/packages/${packageObj.code}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('📡 Package details response:', response.data);
      
      if (response.data.success) {
        const fullPackageData = response.data.data;
        
        console.log('🔍 Validating package data:', {
          hasPackage: !!fullPackageData,
          packageCode: fullPackageData?.code,
          hasBasicInfo: !!(fullPackageData?.sender_name && fullPackageData?.receiver_name),
          hasAreas: !!(fullPackageData?.origin_area && fullPackageData?.destination_area),
          state: fullPackageData?.state
        });
        
        if (!fullPackageData) {
          throw new Error('Package data is missing from server response');
        }
        
        const packageForEdit = {
          ...fullPackageData,
          id: fullPackageData.id || packageObj.id,
          code: fullPackageData.code || packageObj.code,
          state: fullPackageData.state || packageObj.state,
          state_display: fullPackageData.state_display || packageObj.state_display,
          sender_name: fullPackageData.sender_name || packageObj.sender_name || 'Unknown Sender',
          receiver_name: fullPackageData.receiver_name || packageObj.receiver_name || 'Unknown Receiver',
          receiver_phone: fullPackageData.receiver_phone || packageObj.receiver_phone || '',
          route_description: fullPackageData.route_description || packageObj.route_description || 'Unknown Route',
          cost: fullPackageData.cost || packageObj.cost || 0,
          delivery_type: fullPackageData.delivery_type || packageObj.delivery_type || 'agent',
          created_at: fullPackageData.created_at || packageObj.created_at,
          sender_phone: fullPackageData.sender_phone || packageObj.sender_phone || '',
          sender_email: fullPackageData.sender_email || packageObj.sender_email || '',
          receiver_email: fullPackageData.receiver_email || packageObj.receiver_email || '',
          business_name: fullPackageData.business_name || packageObj.business_name || '',
          origin_area: fullPackageData.origin_area || packageObj.origin_area,
          destination_area: fullPackageData.destination_area || packageObj.destination_area,
          origin_agent: fullPackageData.origin_agent || packageObj.origin_agent,
          destination_agent: fullPackageData.destination_agent || packageObj.destination_agent,
          delivery_location: fullPackageData.delivery_location || packageObj.delivery_location || ''
        };
        
        console.log('✅ Package data prepared for editing:', {
          code: packageForEdit.code,
          hasRequiredFields: !!(packageForEdit.sender_name && packageForEdit.receiver_name),
          hasAreas: !!(packageForEdit.origin_area && packageForEdit.destination_area)
        });
        
        setEditingPackage(packageForEdit);
        setShowEditModal(true);
      } else {
        throw new Error(response.data.message || 'Failed to load package details from server');
      }
    } catch (error: any) {
      console.error('❌ Failed to load package details:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      if (error.response?.status !== 404) {
        console.log('🔄 API call failed, attempting to edit with available data...');
        
        if (packageObj.code && packageObj.state) {
          const basicPackageForEdit = {
            ...packageObj,
            sender_name: packageObj.sender_name || 'Unknown Sender',
            receiver_name: packageObj.receiver_name || 'Unknown Receiver',
            receiver_phone: packageObj.receiver_phone || '',
            sender_phone: packageObj.sender_phone || '',
            delivery_location: packageObj.delivery_location || ''
          };
          
          console.log('⚠️ Using basic package data for editing');
          setEditingPackage(basicPackageForEdit);
          setShowEditModal(true);
          
          Toast.show({
            type: 'info',
            text1: 'Limited Edit Mode',
            text2: 'Some advanced features may not be available',
            position: 'top',
            visibilityTime: 4000,
          });
          
          return;
        }
      }
      
      let errorMessage = 'Could not load package details for editing';
      if (error.response?.status === 404) {
        errorMessage = 'Package not found on server';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to edit this package';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Toast.show({
        type: 'error',
        text1: 'Loading Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoadingPackageDetails(null);
    }
  };

  const handleEditSuccess = async () => {
    console.log('✅ Package edit successful, refreshing data...');
    
    setShowEditModal(false);
    setEditingPackage(null);
    
    if (searchQuery.trim()) {
      console.log('🔄 Refreshing search results...');
      await handleSearch(searchQuery);
    }
    
    Toast.show({
      type: 'success',
      text1: 'Package Updated',
      text2: 'Search results refreshed with latest data',
      position: 'top',
      visibilityTime: 2000,
    });
  };

  const canEditPackage = (packageObj: Package): boolean => {
    console.log('🔒 Checking edit permissions for:', {
      userRole: currentUserRole,
      packageState: packageObj.state,
      packageCode: packageObj.code
    });
    
    switch (currentUserRole) {
      case 'admin':
        return true;
      case 'client':
        const clientEditableStates = ['pending_unpaid', 'pending'];
        return clientEditableStates.includes(packageObj.state);
      case 'agent':
      case 'rider':
      case 'warehouse':
        return true;
      default:
        console.warn('⚠️ Unknown user role for edit permission:', currentUserRole);
        return false;
    }
  };

  const navigateToPackageDetails = (packageCode: string) => {
    console.log('🔍 Navigating to package details:', packageCode);
    router.push(`/admin/PackageDetailsScreen?code=${packageCode}`);
  };

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'pending_unpaid':
        return '#FF3B30';
      case 'pending':
        return '#FF9500';
      case 'submitted':
        return '#667eea';
      case 'in_transit':
        return '#764ba2';
      case 'delivered':
        return '#34C759';
      case 'collected':
        return '#34C759';
      default:
        return '#a0aec0';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'collect_from_sender':
      case 'collect':
        return '#667eea';
      case 'deliver':
        return '#34C759';
      case 'give_to_receiver':
        return '#FF6B35';
      case 'print':
        return '#FF9500';
      case 'confirm_receipt':
        return '#764ba2';
      case 'process':
        return '#9C27B0';
      default:
        return '#667eea';
    }
  };

  const getActionIcon = (action: string): keyof typeof MaterialIcons.glyphMap => {
    switch (action) {
      case 'collect_from_sender':
        return 'how-to-reg';
      case 'collect':
        return 'local-shipping';
      case 'deliver':
        return 'check-circle';
      case 'give_to_receiver':
        return 'person-pin';
      case 'print':
        return 'print';
      case 'confirm_receipt':
        return 'done-all';
      case 'process':
        return 'inventory';
      default:
        return 'check';
    }
  };

  const canPerformActions = (): boolean => {
    return ['agent', 'rider', 'warehouse', 'admin'].includes(currentUserRole);
  };

  const renderPackageItem = ({ item }: { item: Package }) => (
    <View style={styles.packageItem}>
      <TouchableOpacity
        style={styles.packageHeader}
        onPress={() => navigateToPackageDetails(item.code)}
      >
        <View style={styles.packageInfo}>
          <Text style={styles.packageCode}>{item.code}</Text>
          <LinearGradient
            colors={[getStateColor(item.state), getStateColor(item.state) + '80']}
            style={styles.stateBadge}
          >
            <Text style={styles.stateText}>{item.state_display}</Text>
          </LinearGradient>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />
      </TouchableOpacity>

      <View style={styles.packageDetails}>
        <Text style={styles.routeText}>{item.route_description}</Text>
        
        <View style={styles.contactSection}>
          <Text style={styles.sectionLabel}>Sender:</Text>
          <Text style={styles.detailText}>{item.sender_name || 'Unknown Sender'}</Text>
          {item.sender_phone && (
            <Text style={styles.phoneText}>📞 {item.sender_phone}</Text>
          )}
          {item.sender_email && (
            <Text style={styles.emailText}>✉️ {item.sender_email}</Text>
          )}
          {item.business_name && (
            <Text style={styles.businessText}>🏢 {item.business_name}</Text>
          )}
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.sectionLabel}>Receiver:</Text>
          <Text style={styles.detailText}>{item.receiver_name || 'Unknown Receiver'}</Text>
          {item.receiver_phone && (
            <Text style={styles.phoneText}>📞 {item.receiver_phone}</Text>
          )}
          {item.receiver_email && (
            <Text style={styles.emailText}>✉️ {item.receiver_email}</Text>
          )}
        </View>

        <View style={styles.packageInfoSection}>
          <Text style={styles.detailText}>💰 Cost: KES {item.cost || 'Unknown'}</Text>
          <Text style={styles.detailText}>📦 Type: {item.delivery_type || 'Unknown'}</Text>
          {item.delivery_location && (
            <Text style={styles.deliveryLocationText}>📍 {item.delivery_location}</Text>
          )}
          <Text style={styles.detailText}>
            📅 Created: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {canEditPackage(item) && (
        <View style={styles.editButtonContainer}>
          <TouchableOpacity
            style={[
              styles.editButton,
              loadingPackageDetails === item.code && styles.editButtonLoading
            ]}
            onPress={() => handleEditPackage(item)}
            disabled={loadingPackageDetails === item.code}
          >
            {loadingPackageDetails === item.code ? (
              <ActivityIndicator size="small" color="#667eea" />
            ) : (
              <MaterialIcons name="edit" size={16} color="#667eea" />
            )}
            <Text style={[
              styles.editButtonText,
              loadingPackageDetails === item.code && styles.editButtonTextLoading
            ]}>
              {loadingPackageDetails === item.code ? 'Loading...' : 'Edit Package'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {canPerformActions() && item.available_actions && item.available_actions.length > 0 && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Available Actions:</Text>
          <View style={styles.actionButtons}>
            {item.available_actions.map((action) => (
              <TouchableOpacity
                key={action.action}
                style={[
                  styles.actionButton,
                  { backgroundColor: getActionColor(action.action) },
                ]}
                onPress={() => performPackageAction(item, action.action)}
              >
                <MaterialIcons
                  name={getActionIcon(action.action)}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderRecentSearchItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.recentSearchItem}
      onPress={() => {
        setSearchQuery(item);
        handleSearch(item);
      }}
    >
      <MaterialIcons name="history" size={16} color="#a0aec0" />
      <Text style={styles.recentSearchText}>{item}</Text>
      <TouchableOpacity
        onPress={() => {
          const updated = recentSearches.filter(s => s !== item);
          setRecentSearches(updated);
          SecureStore.setItemAsync('recent_package_searches', JSON.stringify(updated));
        }}
        style={styles.removeRecentButton}
      >
        <MaterialIcons name="close" size={14} color="#718096" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.emptyIconContainer}
          >
            <MaterialIcons name="search" size={48} color="#fff" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Search for Packages</Text>
          <Text style={styles.emptySubtitle}>
            Enter a package code or scan a QR code to find packages
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={['#FF9500', '#FF8C00']}
          style={styles.emptyIconContainer}
        >
          <MaterialIcons name="inbox" size={48} color="#fff" />
        </LinearGradient>
        <Text style={styles.emptyTitle}>No Packages Found</Text>
        <Text style={styles.emptySubtitle}>
          No packages match your search query "{searchQuery}"
        </Text>
        {!isOnline && (
          <Text style={styles.offlineNote}>
            You are offline. Some packages may not appear in search results.
          </Text>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.headerGradient}
      >
        <SafeAreaView>
          <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Package Search</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowScanner(true)}
                style={styles.headerActionButton}
              >
                <MaterialIcons name="qr-code-scanner" size={24} color="#667eea" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );

  const renderContent = () => (
    <View style={styles.container}>
      {renderHeader()}
      
      {!isOnline && (
        <View style={styles.offlineBar}>
          <MaterialIcons name="cloud-off" size={16} color="#FFB000" />
          <Text style={styles.offlineText}>Offline - Limited functionality</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#a0aec0" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Enter package code (PKG-XXXX-YYYYMMDD)"
            placeholderTextColor="#718096"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch()}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setHasSearched(false);
              }}
              style={styles.clearButton}
            >
              <MaterialIcons name="close" size={20} color="#a0aec0" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearch()}
            disabled={loading}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.searchButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="search" size={20} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <MaterialIcons name="qr-code-scanner" size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
      </View>

      {!hasSearched && recentSearches.length > 0 && (
        <View style={styles.recentSearchesContainer}>
          <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
          <FlatList
            data={recentSearches}
            keyExtractor={(item) => item}
            renderItem={renderRecentSearchItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentSearchesList}
          />
        </View>
      )}

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Searching packages...</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderPackageItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={searchResults.length === 0 ? styles.emptyContainer : styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#667eea"
                colors={['#667eea']}
              />
            }
          />
        )}
      </View>

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        userRole={currentUserRole as any}
        onScanSuccess={handleScanSuccess}
      />

      <PackageEditModal
        visible={showEditModal}
        package={editingPackage}
        userRole={currentUserRole}
        onClose={() => {
          console.log('📝 Closing edit modal');
          setShowEditModal(false);
          setEditingPackage(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </View>
  );

  return renderContent();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  
  // FIXED: Header styles with proper status bar spacing
  headerContainer: {
    zIndex: 10,
  },
  headerGradient: {
    paddingBottom: 8,
    paddingTop: STATUS_BAR_HEIGHT, // FIXED: Added proper status bar spacing
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    height: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  
  offlineBar: {
    backgroundColor: '#2A1F3D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB000',
  },
  offlineText: {
    color: '#FFB000',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: '#fff',
    includeFontPadding: false,
  },
  clearButton: {
    padding: 4,
  },
  searchActions: {
    flexDirection: 'row',
    gap: 12,
  },
  searchButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSearchesContainer: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0aec0',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  recentSearchesList: {
    paddingHorizontal: 16,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  recentSearchText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  removeRecentButton: {
    padding: 2,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#a0aec0',
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 100,
  },
  packageItem: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  packageInfo: {
    flex: 1,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  packageDetails: {
    padding: 20,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 16,
  },
  
  contactSection: {
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
    fontWeight: '600',
  },
  phoneText: {
    fontSize: 13,
    color: '#34C759',
    marginBottom: 2,
    fontWeight: '500',
  },
  emailText: {
    fontSize: 13,
    color: '#007AFF',
    marginBottom: 2,
    fontWeight: '500',
  },
  businessText: {
    fontSize: 13,
    color: '#FF9500',
    marginBottom: 2,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  packageInfoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deliveryLocationText: {
    fontSize: 13,
    color: '#FFB000',
    marginBottom: 4,
    fontWeight: '500',
  },
  
  editButtonContainer: {
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 1,
    borderColor: '#667eea',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  editButtonLoading: {
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    borderColor: 'rgba(102, 126, 234, 0.5)',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  editButtonTextLoading: {
    color: 'rgba(102, 126, 234, 0.7)',
  },
  
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    padding: 20,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  offlineNote: {
    fontSize: 14,
    color: '#FFB000',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
});

export default PackageSearchScreen;
// app/(drawer)/cart.tsx - FIXED: Proper navigation integration
import CollectDeliverModal from '@/components/CollectDeliverModal';
import FragileDeliveryModal from '@/components/FragileDeliveryModal';
import GLTHeader from '@/components/GLTHeader';
import MpesaPaymentModal from '@/components/MpesaPaymentModal';
import PackageCreationModal from '@/components/PackageCreationModal';
import PackageTypeSelectionModal from '@/components/PackageTypeSelectionModal';
import api from '@/lib/api';
import colors from '@/theme/colors';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

// FIXED: Import simplified NavigationHelper
import { NavigationHelper } from '@/lib/helpers/navigation';

// Comprehensive Package interface
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
  updated_at?: string;
  
  // Area and agent IDs for proper auto-population
  origin_area_id?: string;
  destination_area_id?: string;
  origin_agent_id?: string;
  destination_agent_id?: string;
  
  // Area and agent relationship objects
  origin_area?: {
    id: string;
    name: string;
    initials?: string;
    location?: { id: string; name: string };
  };
  destination_area?: {
    id: string;
    name: string;
    initials?: string;
    location?: { id: string; name: string };
  };
  origin_agent?: {
    id: string;
    name: string;
    phone?: string;
    area_id?: string;
    area?: {
      id: string;
      name: string;
      location?: { id: string; name: string };
    };
  };
  destination_agent?: {
    id: string;
    name: string;
    phone?: string;
    area_id?: string;
    area?: {
      id: string;
      name: string;
      location?: { id: string; name: string };
    };
  };
  
  // Location and delivery details
  delivery_location?: string;
  pickup_location?: string;
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
  
  // Business information
  business_name?: string;
  business_phone?: string;
  business_id?: string;
  
  // Receiver name variations
  recipient_name?: string;
  receiver?: { name: string };
  recipient?: { name: string };
  to_name?: string;
  from_location?: string;
  to_location?: string;
  
  // Package details
  package_description?: string;
  package_size?: string;
  special_instructions?: string;
  
  // Collection service specific fields
  shop_name?: string;
  shop_contact?: string;
  collection_address?: string;
  items_to_collect?: string;
  item_value?: number;
  item_description?: string;
  
  // Fragile service specific fields  
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
}

// Modal management types
type ModalType = 'package' | 'fragile' | 'collection';
type ModalAction = 'create' | 'edit' | 'resubmit';

interface ModalState {
  type: ModalType | null;
  action: ModalAction;
  package?: Package;
  isVisible: boolean;
}

export default function CartPage() {
  const insets = useSafeAreaInsets();
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPackageTypeModal, setShowPackageTypeModal] = useState(false);

  const [modalState, setModalState] = useState<ModalState>({
    type: null,
    action: 'create',
    package: undefined,
    isVisible: false
  });

  // FIXED: Simplified back navigation handler
  const handleGoBack = useCallback(() => {
    console.log('🔙 Cart: Going back...');
    
    // Use simplified NavigationHelper.goBack with fallback
    NavigationHelper.goBack('/(drawer)/');
  }, []);

  // Calculate total cost
  const getTotalCost = useCallback(() => {
    return packages
      .filter(pkg => selectedPackages.has(pkg.id))
      .reduce((total, pkg) => total + pkg.cost, 0);
  }, [packages, selectedPackages]);

  // Intelligent modal routing
  const determineModalType = useCallback((packageItem: Package): ModalType => {
    console.log('🎯 Determining modal type for package:', {
      code: packageItem.code,
      delivery_type: packageItem.delivery_type,
      package_description: packageItem.package_description?.substring(0, 50),
      shop_name: packageItem.shop_name,
      items_to_collect: packageItem.items_to_collect,
      has_coordinates: !!(packageItem.pickup_latitude && packageItem.pickup_longitude)
    });

    // Priority 1: Explicit delivery type
    if (packageItem.delivery_type === 'fragile') {
      console.log('➡️ Fragile delivery type - routing to FragileDeliveryModal');
      return 'fragile';
    }
    
    if (packageItem.delivery_type === 'collection') {
      console.log('➡️ Collection delivery type - routing to CollectDeliverModal');
      return 'collection';
    }

    // Priority 2: Collection service field detection
    if (packageItem.shop_name || 
        packageItem.shop_contact || 
        packageItem.items_to_collect ||
        packageItem.collection_address ||
        packageItem.item_value ||
        packageItem.item_description) {
      console.log('➡️ Collection fields detected - routing to CollectDeliverModal');
      return 'collection';
    }
    
    // Priority 3: Fragile service field detection
    if ((packageItem.pickup_latitude && packageItem.pickup_longitude) ||
        packageItem.package_description?.toLowerCase().includes('fragile')) {
      console.log('➡️ Fragile indicators detected - routing to FragileDeliveryModal');
      return 'fragile';
    }

    // Priority 4: Package description analysis
    const description = packageItem.package_description?.toLowerCase() || '';
    if (description.includes('collection') || description.includes('collect')) {
      console.log('➡️ Collection keywords - routing to CollectDeliverModal');
      return 'collection';
    }

    if (description.includes('fragile') || description.includes('delicate') || description.includes('careful')) {
      console.log('➡️ Fragile keywords - routing to FragileDeliveryModal');
      return 'fragile';
    }
    
    // Priority 5: Standard delivery types
    if (['doorstep', 'agent', 'home', 'office'].includes(packageItem.delivery_type) ||
        !packageItem.delivery_type) {
      console.log('➡️ Standard delivery type - routing to PackageCreationModal');
      return 'package';
    }

    // Default fallback
    console.log('➡️ Defaulting to PackageCreationModal');
    return 'package';
  }, []);

  // Edit package handler
  const handleEditPackage = useCallback((packageItem: Package) => {
    console.log('🔧 ==================== EDIT PACKAGE ====================');
    console.log('📦 Package details:', {
      code: packageItem.code,
      delivery_type: packageItem.delivery_type,
      state: packageItem.state,
      has_origin_area_id: !!packageItem.origin_area_id,
      has_destination_area_id: !!packageItem.destination_area_id,
      has_origin_agent_id: !!packageItem.origin_agent_id,
      has_destination_agent_id: !!packageItem.destination_agent_id,
      collection_fields: {
        shop_name: packageItem.shop_name,
        items_to_collect: packageItem.items_to_collect
      },
      fragile_fields: {
        pickup_coords: !!(packageItem.pickup_latitude && packageItem.pickup_longitude),
        package_description: packageItem.package_description?.substring(0, 50)
      }
    });
    
    const modalType = determineModalType(packageItem);
    
    console.log('🎯 Modal routing decision:', {
      selectedModalType: modalType,
      reasoning: 'Based on package analysis above'
    });

    setModalState({
      type: modalType,
      action: 'edit',
      package: packageItem,
      isVisible: true
    });
    
    console.log('✅ Edit modal state configured successfully');
    console.log('🔧 ====================================================');
  }, [determineModalType]);

  // Modal management handlers
  const handleCloseModal = useCallback(() => {
    console.log('❌ Closing modal');
    setModalState({
      type: null,
      action: 'create',
      package: undefined,
      isVisible: false
    });
  }, []);

  // Package submission handler
  const handlePackageSubmitted = useCallback(async (packageData?: any) => {
    console.log('✅ ================ PACKAGE SUBMISSION SUCCESS ================');
    console.log('📦 Submission details:', {
      action: modalState.action,
      modalType: modalState.type,
      originalPackageCode: modalState.package?.code,
      dataProvided: !!packageData
    });
    
    // Close modal
    handleCloseModal();
    
    // Refresh packages list
    console.log('🔄 Refreshing packages list...');
    loadUnpaidPackages(true);
    
    // Show success message
    const actionText = modalState.action === 'edit' ? 'updated' : 
                      modalState.action === 'resubmit' ? 'resubmitted' : 'created';
    
    const modalTypeText = modalState.type === 'fragile' ? 'fragile package' :
                         modalState.type === 'collection' ? 'collection package' :
                         'package';
    
    Toast.show({
      type: 'success',
      text1: `${modalTypeText.charAt(0).toUpperCase() + modalTypeText.slice(1)} ${actionText} successfully!`,
      text2: modalState.action === 'resubmit' ? 'Your package has been resubmitted for review' : 
             modalState.action === 'edit' ? 'Changes have been saved and applied' : 
             'Your package has been created and is being processed',
      position: 'top',
      visibilityTime: 4000,
    });
    
    console.log('✅ Success notification displayed');
    console.log('✅ =======================================================');
  }, [modalState, handleCloseModal]);

  // Package data transformation
  const transformPackageData = useCallback((pkg: any): Package => {
    const extractAreaId = (area: any): string | undefined => {
      if (typeof area === 'string') return area;
      if (area && typeof area === 'object') return area.id || area.area_id;
      return undefined;
    };

    const extractAgentId = (agent: any): string | undefined => {
      if (typeof agent === 'string') return agent;
      if (agent && typeof agent === 'object') return agent.id || agent.agent_id;
      return undefined;
    };

    return {
      id: String(pkg.id || ''),
      code: pkg.code || '',
      state: pkg.state || 'pending_unpaid',
      state_display: pkg.state_display || 'Pending Payment',
      sender_name: pkg.sender_name || 'Unknown Sender',
      receiver_name: pkg.receiver_name || 'Unknown Receiver',
      receiver_phone: pkg.receiver_phone || '',
      route_description: pkg.route_description || 'Route information unavailable',
      cost: Number(pkg.cost) || 0,
      delivery_type: pkg.delivery_type || 'agent',
      created_at: pkg.created_at || new Date().toISOString(),
      updated_at: pkg.updated_at || pkg.created_at || new Date().toISOString(),
      
      origin_area_id: pkg.origin_area_id || extractAreaId(pkg.origin_area) || extractAreaId(pkg.origin_agent?.area),
      destination_area_id: pkg.destination_area_id || extractAreaId(pkg.destination_area) || extractAreaId(pkg.destination_agent?.area),
      origin_agent_id: pkg.origin_agent_id || extractAgentId(pkg.origin_agent),
      destination_agent_id: pkg.destination_agent_id || extractAgentId(pkg.destination_agent),
      
      origin_area: pkg.origin_area,
      destination_area: pkg.destination_area,
      origin_agent: pkg.origin_agent,
      destination_agent: pkg.destination_agent,
      
      delivery_location: pkg.delivery_location,
      pickup_location: pkg.pickup_location,
      sender_phone: pkg.sender_phone,
      sender_email: pkg.sender_email,
      receiver_email: pkg.receiver_email,
      
      business_name: pkg.business_name,
      business_phone: pkg.business_phone,
      business_id: pkg.business_id,
      
      recipient_name: pkg.recipient_name || pkg.receiver_name,
      receiver: pkg.receiver || { name: pkg.receiver_name },
      recipient: pkg.recipient || { name: pkg.receiver_name },
      to_name: pkg.to_name || pkg.receiver_name,
      from_location: pkg.from_location || pkg.origin_area?.name,
      to_location: pkg.to_location || pkg.destination_area?.name,
      
      package_description: pkg.package_description,
      package_size: pkg.package_size,
      special_instructions: pkg.special_instructions,
      
      shop_name: pkg.shop_name,
      shop_contact: pkg.shop_contact,
      collection_address: pkg.collection_address,
      items_to_collect: pkg.items_to_collect,
      item_value: pkg.item_value,
      item_description: pkg.item_description,
      
      pickup_latitude: pkg.pickup_latitude,
      pickup_longitude: pkg.pickup_longitude,
      delivery_latitude: pkg.delivery_latitude,
      delivery_longitude: pkg.delivery_longitude,
    };
  }, []);

  // Load unpaid packages
  const loadUnpaidPackages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await api.get('/api/v1/packages', {
        params: {
          state: 'pending_unpaid',
          per_page: 1000,
          page: 1
        }
      });
      
      if (response.data.success) {
        const unpaidPackages = response.data.data.map((pkg: any) => transformPackageData(pkg));
        
        setPackages(unpaidPackages);
        console.log(`✅ Loaded ${unpaidPackages.length} unpaid packages`);
        
        // Auto-select all packages
        const allPackageIds = new Set(unpaidPackages.map(pkg => pkg.id));
        setSelectedPackages(allPackageIds);
      }
    } catch (error: any) {
      console.error('❌ Failed to load unpaid packages:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Packages',
        text2: error.message,
        position: 'top',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [transformPackageData]);

  useEffect(() => {
    loadUnpaidPackages();
  }, [loadUnpaidPackages]);

  // Package selection handlers
  const togglePackageSelection = (packageId: string) => {
    const newSelected = new Set(selectedPackages);
    if (newSelected.has(packageId)) {
      newSelected.delete(packageId);
    } else {
      newSelected.add(packageId);
    }
    setSelectedPackages(newSelected);
  };

  const selectAllPackages = () => {
    const allPackageIds = new Set(packages.map(pkg => pkg.id));
    setSelectedPackages(allPackageIds);
  };

  const deselectAllPackages = () => {
    setSelectedPackages(new Set());
  };

  // Payment handlers
  const handlePayment = () => {
    if (selectedPackages.size === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Packages Selected',
        text2: 'Please select at least one package to pay for',
        position: 'top',
      });
      return;
    }
    setShowPaymentModal(true);
  };

  const getSelectedPackages = () => {
    return packages.filter(pkg => selectedPackages.has(pkg.id));
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    loadUnpaidPackages(true);
    Toast.show({
      type: 'success',
      text1: 'Payment Successful!',
      text2: 'Your packages have been paid for successfully',
      position: 'top',
    });
  };

  // Delivery type helpers
  const getDeliveryTypeDisplay = (deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return 'Home';
      case 'agent': return 'Office';
      case 'fragile': return 'Fragile';
      case 'collection': return 'Collection';
      default: return 'Office';
    }
  };

  const getDeliveryTypeColor = (deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return '#8b5cf6';
      case 'agent': return '#3b82f6';
      case 'fragile': return '#f97316';
      case 'collection': return '#10b981';
      default: return '#8b5cf6';
    }
  };

  // Render package item
  const renderPackageItem = (pkg: Package) => {
    const isSelected = selectedPackages.has(pkg.id);
    
    return (
      <TouchableOpacity
        key={pkg.id}
        style={[styles.packageCard, isSelected && styles.selectedPackageCard]}
        onPress={() => togglePackageSelection(pkg.id)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={
            isSelected 
              ? ['rgba(124, 58, 237, 0.2)', 'rgba(124, 58, 237, 0.1)']
              : ['rgba(26, 26, 46, 0.8)', 'rgba(22, 33, 62, 0.8)']
          }
          style={styles.packageCardGradient}
        >
          {/* Package Header */}
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageCode}>{pkg.code}</Text>
              <Text style={styles.routeDescription}>{pkg.route_description}</Text>
              <Text style={styles.receiverText}>To: {pkg.receiver_name}</Text>
            </View>
            
            <View style={styles.packageRightSection}>
              {/* Delivery Type Badge */}
              <View style={[
                styles.deliveryTypeBadge, 
                { borderColor: getDeliveryTypeColor(pkg.delivery_type) }
              ]}>
                <Text style={[
                  styles.badgeText, 
                  { color: getDeliveryTypeColor(pkg.delivery_type) }
                ]}>
                  {getDeliveryTypeDisplay(pkg.delivery_type)}
                </Text>
              </View>
              
              {/* Selection Checkbox */}
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected
              ]}>
                {isSelected && (
                  <Feather name="check" size={16} color="#fff" />
                )}
              </View>
            </View>
          </View>

          {/* Cost */}
          <View style={styles.costSection}>
            <Text style={styles.costValue}>KES {pkg.cost.toLocaleString()}</Text>
          </View>

          {/* Edit Button */}
          <View style={styles.actionButtonsSection}>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={(e) => {
                e.stopPropagation();
                handleEditPackage(pkg);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="edit-3" size={16} color="#8b5cf6" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <LinearGradient
        colors={['rgba(26, 26, 46, 0.6)', 'rgba(22, 33, 62, 0.6)']}
        style={styles.emptyStateCard}
      >
        <Feather name="shopping-cart" size={64} color="#666" />
        <Text style={styles.emptyStateTitle}>No Unpaid Packages</Text>
        <Text style={styles.emptyStateSubtitle}>
          All your packages have been paid for or you don't have any packages yet.
        </Text>
        
        <TouchableOpacity 
          style={styles.emptyStateButton} 
          onPress={() => setShowPackageTypeModal(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.emptyStateButtonText}>Create Package</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      {/* Header with Fixed Navigation */}
      <GLTHeader 
        title="Cart"
        showBackButton={true}
        onBack={handleGoBack}
      />

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      ) : packages.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {/* Selection Controls */}
          <View style={styles.selectionControls}>
            <LinearGradient
              colors={['rgba(22, 33, 62, 0.95)', 'rgba(26, 26, 46, 0.95)']}
              style={styles.selectionControlsContent}
            >
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionTitle}>
                  {selectedPackages.size} of {packages.length} selected
                </Text>
                <Text style={styles.selectionSubtitle}>
                  Total: KES {getTotalCost().toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.selectionButtons}>
                <TouchableOpacity 
                  style={styles.selectButton}
                  onPress={selectedPackages.size === packages.length ? deselectAllPackages : selectAllPackages}
                >
                  <Text style={styles.selectButtonText}>
                    {selectedPackages.size === packages.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Package List */}
          <ScrollView
            style={styles.packagesList}
            contentContainerStyle={styles.packagesListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadUnpaidPackages(true)}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {packages.map(renderPackageItem)}
            
            {/* Add Another Package Button */}
            <TouchableOpacity 
              style={styles.addPackageButton}
              onPress={() => setShowPackageTypeModal(true)}
            >
              <LinearGradient
                colors={['rgba(124, 58, 237, 0.2)', 'rgba(124, 58, 237, 0.1)']}
                style={styles.addPackageGradient}
              >
                <Feather name="plus" size={24} color={colors.primary} />
                <Text style={styles.addPackageText}>Add another package</Text>
                <Text style={styles.addPackageSubtext}>Send multiple packages</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>

          {/* Bottom Payment Bar */}
          <View style={styles.bottomBar}>
            <LinearGradient
              colors={['rgba(22, 33, 62, 0.98)', 'rgba(26, 26, 46, 0.98)']}
              style={styles.bottomBarContent}
            >
              <TouchableOpacity
                style={[
                  styles.payButton,
                  selectedPackages.size === 0 && styles.payButtonDisabled
                ]}
                onPress={handlePayment}
                disabled={selectedPackages.size === 0}
              >
                <Feather 
                  name="credit-card" 
                  size={20} 
                  color={selectedPackages.size === 0 ? "#666" : "#fff"} 
                />
                <Text style={[
                  styles.payButtonText,
                  selectedPackages.size === 0 && styles.payButtonTextDisabled
                ]}>
                  Pay {selectedPackages.size} Package{selectedPackages.size !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </>
      )}

      {/* M-Pesa Payment Modal */}
      <MpesaPaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        packageData={getSelectedPackages()}
      />

      {/* Package Type Selection Modal */}
      <PackageTypeSelectionModal
        visible={showPackageTypeModal}
        onClose={() => setShowPackageTypeModal(false)}
      />

      {/* Edit Modals */}
      <PackageCreationModal
        visible={modalState.isVisible && modalState.type === 'package'}
        onClose={handleCloseModal}
        onSubmit={handlePackageSubmitted}
        editPackage={modalState.action === 'edit' ? modalState.package : undefined}
        resubmitPackage={modalState.action === 'resubmit' ? modalState.package : undefined}
        mode={modalState.action}
      />

      <FragileDeliveryModal
        visible={modalState.isVisible && modalState.type === 'fragile'}
        onClose={handleCloseModal}
        onSubmit={handlePackageSubmitted}
        currentLocation={null}
        editPackage={modalState.action === 'edit' ? modalState.package : undefined}
        resubmitPackage={modalState.action === 'resubmit' ? modalState.package : undefined}
        mode={modalState.action}
      />

      <CollectDeliverModal
        visible={modalState.isVisible && modalState.type === 'collection'}
        onClose={handleCloseModal}
        onSubmit={handlePackageSubmitted}
        currentLocation={null}
        editPackage={modalState.action === 'edit' ? modalState.package : undefined}
        resubmitPackage={modalState.action === 'resubmit' ? modalState.package : undefined}
        mode={modalState.action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  
  selectionControls: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  selectionControlsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  selectionInfo: {
    flex: 1,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  selectionSubtitle: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  selectionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  
  packagesList: {
    flex: 1,
  },
  packagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  
  packageCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPackageCard: {
    borderColor: colors.primary,
  },
  packageCardGradient: {
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
    marginRight: 12,
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  routeDescription: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  receiverText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  packageRightSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deliveryTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  costSection: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  costValue: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  
  actionButtonsSection: {
    alignItems: 'flex-end',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#8b5cf6',
    gap: 6,
  },
  editButtonText: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  
  addPackageButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderStyle: 'dashed',
  },
  addPackageGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPackageText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  addPackageSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.2)',
  },
  bottomBarContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#444',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  payButtonTextDisabled: {
    color: '#666',
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
});
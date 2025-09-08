// app/(drawer)/cart.tsx - Cart page with package selection
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import api from '@/lib/api';
import colors from '@/theme/colors';
import GLTHeader from '@/components/GLTHeader';
import MpesaPaymentModal from '@/components/MpesaPaymentModal';
import PackageTypeSelectionModal from '@/components/PackageTypeSelectionModal';

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
}

export default function CartPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPackageTypeModal, setShowPackageTypeModal] = useState(false);

  // Calculate total cost for selected packages
  const getTotalCost = useCallback(() => {
    return packages
      .filter(pkg => selectedPackages.has(pkg.id))
      .reduce((total, pkg) => total + pkg.cost, 0);
  }, [packages, selectedPackages]);

  // Load unpaid packages
  const loadUnpaidPackages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await api.get('/api/v1/packages?state=pending_unpaid');
      
      if (response.data.success) {
        const unpaidPackages = response.data.data.map((pkg: any) => ({
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
        }));
        
        setPackages(unpaidPackages);
        
        // Auto-select all packages by default
        const allPackageIds = new Set(unpaidPackages.map(pkg => pkg.id));
        setSelectedPackages(allPackageIds);
      }
    } catch (error: any) {
      console.error('Failed to load unpaid packages:', error);
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
  }, []);

  useEffect(() => {
    loadUnpaidPackages();
  }, [loadUnpaidPackages]);

  // Handle package selection
  const togglePackageSelection = (packageId: string) => {
    const newSelected = new Set(selectedPackages);
    if (newSelected.has(packageId)) {
      newSelected.delete(packageId);
    } else {
      newSelected.add(packageId);
    }
    setSelectedPackages(newSelected);
  };

  // Select all packages
  const selectAllPackages = () => {
    const allPackageIds = new Set(packages.map(pkg => pkg.id));
    setSelectedPackages(allPackageIds);
  };

  // Deselect all packages
  const deselectAllPackages = () => {
    setSelectedPackages(new Set());
  };

  // Handle payment
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

  // Get selected packages for payment
  const getSelectedPackages = () => {
    return packages.filter(pkg => selectedPackages.has(pkg.id));
  };

  // Handle payment success
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

  // Get delivery type display
  const getDeliveryTypeDisplay = (deliveryType: string) => {
    switch (deliveryType) {
      case 'doorstep': return 'Home';
      case 'agent': return 'Office';
      case 'fragile': return 'Fragile';
      case 'collection': return 'Collection';
      default: return 'Office';
    }
  };

  // Get delivery type color
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
          {/* Selection Indicator */}
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
      
      {/* Header */}
      <GLTHeader 
        title="Cart"
        showBackButton={true}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Loading
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
  
  // Selection Controls
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
  
  // Package List
  packagesList: {
    flex: 1,
  },
  packagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  
  // Package Card
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
  },
  costValue: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  
  // Add Package Button
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
  
  // Bottom Payment Bar
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
  
  // Empty State
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
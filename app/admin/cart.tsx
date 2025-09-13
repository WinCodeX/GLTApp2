// app/admin/cart.tsx - Admin Cart Screen with Enhanced Navigation
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AdminLayout from '../../components/AdminLayout';
import api from '@/lib/api';
import { NavigationHelper } from '@/lib/helpers/navigation';

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
  user?: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
  };
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

export default function AdminCartPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'success' });

  // Enhanced back navigation using NavigationHelper
  const handleGoBack = useCallback(async () => {
    console.log('🔙 Admin Cart: Going back...');
    
    try {
      const success = await NavigationHelper.goBack({
        fallbackRoute: '/admin',
        replaceIfNoHistory: true
      });
      
      if (!success) {
        console.log('🔙 Admin Cart: Back navigation used fallback');
      }
    } catch (error) {
      console.error('🔙 Admin Cart: Back navigation failed:', error);
      router.push('/admin');
    }
  }, []);

  // Show toast message
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 3000);
  };

  // Calculate total cost for selected packages
  const getTotalCost = useCallback(() => {
    return packages
      .filter(pkg => selectedPackages.has(pkg.id))
      .reduce((total, pkg) => total + pkg.cost, 0);
  }, [packages, selectedPackages]);

  // Load ALL unpaid packages without limit
  const loadUnpaidPackages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Request all packages by setting a high per_page limit
      const response = await api.get('/api/v1/packages', {
        params: {
          state: 'pending_unpaid',
          per_page: 1000,
          page: 1
        }
      });
      
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
          user: pkg.user ? {
            id: pkg.user.id,
            name: pkg.user.name || 'Unknown User',
            email: pkg.user.email,
            phone: pkg.user.phone,
          } : undefined,
        }));
        
        setPackages(unpaidPackages);
        console.log(`Admin Cart: Loaded ${unpaidPackages.length} unpaid packages`);
        
        // Auto-select all packages by default
        const allPackageIds = new Set(unpaidPackages.map(pkg => pkg.id));
        setSelectedPackages(allPackageIds);
      }
    } catch (error: any) {
      console.error('Admin Cart: Failed to load unpaid packages:', error);
      showToast('Failed to load packages', 'error');
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

  // Handle payment (admin specific - could mark as paid)
  const handleAdminPayment = async () => {
    if (selectedPackages.size === 0) {
      showToast('No packages selected', 'error');
      return;
    }

    try {
      const selectedIds = Array.from(selectedPackages);
      
      // For admin, we might want to mark packages as paid directly
      // This would need an admin API endpoint
      console.log('Admin marking packages as paid:', selectedIds);
      
      // Placeholder for admin payment functionality
      showToast(`Admin payment processing for ${selectedIds.length} packages`, 'success');
      
      // Refresh the list
      loadUnpaidPackages(true);
      
    } catch (error) {
      console.error('Admin payment error:', error);
      showToast('Payment processing failed', 'error');
    }
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
              ? ['rgba(139, 92, 246, 0.3)', 'rgba(139, 92, 246, 0.15)']
              : ['rgba(26, 26, 46, 0.8)', 'rgba(45, 27, 78, 0.8)']
          }
          style={styles.packageCardGradient}
        >
          {/* Package Header */}
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageCode}>{pkg.code}</Text>
              <Text style={styles.routeDescription}>{pkg.route_description}</Text>
              <Text style={styles.receiverText}>To: {pkg.receiver_name}</Text>
              {pkg.user && (
                <Text style={styles.userText}>User: {pkg.user.name}</Text>
              )}
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
                  <Ionicons name="checkmark" size={16} color="#fff" />
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
        colors={['rgba(26, 26, 46, 0.6)', 'rgba(45, 27, 78, 0.6)']}
        style={styles.emptyStateCard}
      >
        <Ionicons name="cart-outline" size={64} color="#a78bfa" />
        <Text style={styles.emptyStateTitle}>No Unpaid Packages</Text>
        <Text style={styles.emptyStateSubtitle}>
          All packages have been paid for or no packages exist in the system.
        </Text>
      </LinearGradient>
    </View>
  );

  // Render toast
  const renderToast = () => {
    if (!toast.visible) return null;
    
    return (
      <View style={[
        styles.toast,
        { backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444' }
      ]}>
        <Ionicons 
          name={toast.type === 'success' ? 'checkmark-circle' : 'close-circle'} 
          size={16} 
          color="white" 
        />
        <Text style={styles.toastText}>{toast.message}</Text>
      </View>
    );
  };

  return (
    <AdminLayout activePanel="cart">
      <StatusBar barStyle="light-content" backgroundColor="#1a1b3d" />
      
      {/* Header */}
      <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Admin Cart</Text>
            <Text style={styles.headerSubtitle}>Manage unpaid packages</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      ) : packages.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {/* Selection Controls */}
          <View style={styles.selectionControls}>
            <LinearGradient
              colors={['rgba(45, 27, 78, 0.95)', 'rgba(26, 26, 46, 0.95)']}
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
                tintColor="#8b5cf6"
                colors={['#8b5cf6']}
              />
            }
          >
            {packages.map(renderPackageItem)}
          </ScrollView>

          {/* Bottom Payment Bar */}
          <View style={styles.bottomBar}>
            <LinearGradient
              colors={['rgba(45, 27, 78, 0.98)', 'rgba(26, 26, 46, 0.98)']}
              style={styles.bottomBarContent}
            >
              <TouchableOpacity
                style={[
                  styles.payButton,
                  selectedPackages.size === 0 && styles.payButtonDisabled
                ]}
                onPress={handleAdminPayment}
                disabled={selectedPackages.size === 0}
              >
                <Ionicons 
                  name="card-outline" 
                  size={20} 
                  color={selectedPackages.size === 0 ? "#666" : "#fff"} 
                />
                <Text style={[
                  styles.payButtonText,
                  selectedPackages.size === 0 && styles.payButtonTextDisabled
                ]}>
                  Admin Pay {selectedPackages.size} Package{selectedPackages.size !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </>
      )}

      {/* Toast */}
      {renderToast()}
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
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
    color: '#c4b5fd',
    marginTop: 16,
  },
  
  // Selection Controls
  selectionControls: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
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
    color: '#8b5cf6',
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
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  selectButtonText: {
    fontSize: 14,
    color: '#8b5cf6',
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
    borderColor: '#8b5cf6',
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
    color: '#c4b5fd',
    marginBottom: 4,
  },
  receiverText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 2,
  },
  userText: {
    fontSize: 12,
    color: '#a78bfa',
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
    borderColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  costSection: {
    alignItems: 'flex-start',
  },
  costValue: {
    fontSize: 18,
    color: '#8b5cf6',
    fontWeight: '700',
  },
  
  // Bottom Payment Bar
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
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
    backgroundColor: '#8b5cf6',
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
    borderColor: 'rgba(139, 92, 246, 0.3)',
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
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Toast
  toast: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
// components/CustomDrawerContent.tsx - Fixed with NavigationHelper integration
import {
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from '@expo/vector-icons';
import {
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useUser } from '../context/UserContext';
import { getFullAvatarUrl } from '../lib/api';
import { SafeLogo } from './SafeLogo';
import colors from '../theme/colors';

// CRITICAL: Import NavigationHelper for proper navigation tracking
import { NavigationHelper } from '../lib/helpers/navigation';

// Enhanced Safe Avatar Component with comprehensive synchronization
interface SafeAvatarProps {
  size: number;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
  updateTrigger?: number;
}

const SafeAvatar: React.FC<SafeAvatarProps> = ({ 
  size, 
  avatarUrl, 
  fallbackSource = require('../assets/images/avatar_placeholder.png'),
  style,
  updateTrigger = 0
}) => {
  const [hasError, setHasError] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  useEffect(() => {
    console.log('🎭 Drawer SafeAvatar: Update triggered', {
      avatarUrl,
      updateTrigger,
      timestamp: Date.now()
    });
    
    setHasError(false);
    setImageKey(Date.now());
  }, [avatarUrl, updateTrigger]);
  
  if (!fullAvatarUrl || hasError) {
    return (
      <TouchableOpacity style={style} disabled>
        <Image
          source={fallbackSource}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <Image
      source={{ 
        uri: `${fullAvatarUrl}?v=${imageKey}&t=${updateTrigger}`,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      onError={(error) => {
        console.warn('🎭 Drawer SafeAvatar failed to load:', {
          url: fullAvatarUrl,
          error: error
        });
        setHasError(true);
      }}
    />
  );
};

export default function CustomDrawerContent(props: any) {
  const { 
    user, 
    businesses,
    selectedBusiness,
    setSelectedBusiness,
    avatarUpdateTrigger,
    getDisplayName,
    getUserPhone,
  } = useUser();

  const [showTrackDropdown, setShowTrackDropdown] = useState(false);
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);

  // FIXED: Enhanced navigation with proper tracking
  const navigateToRoute = useCallback(async (route: string, params: any = {}) => {
    try {
      console.log(`🧭 Drawer: Navigating to ${route}`);
      
      // Close drawer first
      props.navigation.closeDrawer();
      
      // CRITICAL: Use NavigationHelper instead of direct navigation
      await NavigationHelper.navigateTo(route, {
        params,
        trackInHistory: true
      });
      
      console.log(`✅ Drawer: Successfully navigated to ${route}`);
    } catch (error) {
      console.error(`❌ Drawer: Navigation to ${route} failed:`, error);
      
      // Fallback with tracking
      try {
        await NavigationHelper.navigateTo('/(drawer)/', {
          params: {},
          trackInHistory: true
        });
        console.log('🔄 Drawer: Used fallback navigation to home');
      } catch (fallbackError) {
        console.error('❌ Drawer: Fallback navigation failed:', fallbackError);
      }
    }
  }, [props.navigation]);

  // Enhanced track navigation with proper route mapping
  const handleTrackNavigation = useCallback(async (item: any) => {
    try {
      console.log(`🧭 Drawer: Track navigation for ${item.key}`);
      
      let route = '/(drawer)/track';
      let params = {};

      // Map track items to proper routes and params
      switch (item.key) {
        case 'all':
          route = '/(drawer)/track';
          params = {};
          break;
        case 'in_transit':
          route = '/(drawer)/track';
          params = { initialFilter: 'in_transit' };
          break;
        case 'delivered':
          route = '/(drawer)/track';
          params = { initialFilter: 'delivered' };
          break;
        case 'pending_payment':
          route = '/(drawer)/track';
          params = { initialFilter: 'pending_payment' };
          break;
        case 'processing':
          route = '/(drawer)/track';
          params = { initialFilter: 'processing' };
          break;
        default:
          route = '/(drawer)/track';
          params = {};
      }

      await navigateToRoute(route, params);
      setShowTrackDropdown(false);
    } catch (error) {
      console.error(`❌ Drawer: Track navigation failed for ${item.key}:`, error);
    }
  }, [navigateToRoute]);

  // Business selection with proper state management
  const handleBusinessSelection = useCallback(async (business: any) => {
    try {
      console.log('🎭 Drawer: Selecting business:', business?.name || 'You');
      
      setSelectedBusiness(business);
      setShowBusinessDropdown(false);
      
      // Show toast feedback
      Toast.show({
        type: 'info',
        text1: 'Business Selected',
        text2: business?.name || 'Personal Account',
        position: 'bottom',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('❌ Drawer: Business selection failed:', error);
    }
  }, [setSelectedBusiness]);

  // Account navigation with business details check
  const handleAccountNavigation = useCallback(async () => {
    try {
      if (selectedBusiness) {
        console.log('🧭 Drawer: Navigating to business details');
        await navigateToRoute('/(drawer)/BusinessDetails');
      } else {
        console.log('🧭 Drawer: Navigating to personal account');
        await navigateToRoute('/(drawer)/account');
      }
    } catch (error) {
      console.error('❌ Drawer: Account navigation failed:', error);
    }
  }, [selectedBusiness, navigateToRoute]);

  // Tracking status items
  const trackingStatuses = [
    { key: 'all', label: 'All Packages', icon: 'package' },
    { key: 'in_transit', label: 'In Transit', icon: 'truck' },
    { key: 'delivered', label: 'Delivered', icon: 'check-circle' },
    { key: 'pending_payment', label: 'Pending Payment', icon: 'clock' },
    { key: 'processing', label: 'Processing', icon: 'refresh-cw' },
  ];

  // Get current avatar based on selected business or user
  const getCurrentAvatar = () => {
    if (selectedBusiness?.logo) {
      return getFullAvatarUrl(selectedBusiness.logo);
    }
    return user?.profile_picture ? getFullAvatarUrl(user.profile_picture) : null;
  };

  return (
    <View style={styles.drawerContainer}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Account Header */}
          <TouchableOpacity
            style={styles.accountHeader}
            onPress={handleAccountNavigation}
            activeOpacity={0.8}
          >
            <SafeAvatar
              size={48}
              avatarUrl={getCurrentAvatar()}
              updateTrigger={avatarUpdateTrigger}
              style={styles.avatar}
            />
            
            <View style={styles.accountInfo}>
              <Text style={styles.userName}>
                {selectedBusiness?.name || getDisplayName()}
              </Text>
              <Text style={styles.userPhone}>
                {selectedBusiness?.phone || getUserPhone()}
              </Text>
              {selectedBusiness && (
                <Text style={styles.modeIndicator}>Business Mode</Text>
              )}
              {!selectedBusiness && (
                <Text style={styles.modeIndicator}>Personal Account</Text>
              )}
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowBusinessDropdown(!showBusinessDropdown)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showBusinessDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="white"
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Business Dropdown */}
          {showBusinessDropdown && (
            <View style={styles.accountDropdown}>
              {/* Personal Account Option */}
              <TouchableOpacity
                style={styles.businessItem}
                onPress={() => handleBusinessSelection(null)}
                activeOpacity={0.7}
              >
                <View style={styles.businessIconContainer}>
                  <SafeAvatar
                    size={24}
                    avatarUrl={user?.profile_picture ? getFullAvatarUrl(user.profile_picture) : null}
                    updateTrigger={avatarUpdateTrigger}
                  />
                </View>
                <View style={styles.businessInfo}>
                  <Text style={[styles.businessName, !selectedBusiness && styles.selectedBusinessName]}>
                    You ({getDisplayName()})
                  </Text>
                  <Text style={styles.businessPhone}>Personal Account</Text>
                </View>
                {!selectedBusiness && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>

              {/* Owned Businesses */}
              {businesses.owned.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>YOUR BUSINESSES</Text>
                  {businesses.owned.map((business: any) => (
                    <TouchableOpacity
                      key={business.id}
                      style={styles.businessItem}
                      onPress={() => handleBusinessSelection(business)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.businessIconContainer}>
                        <SafeLogo
                          logo={business.logo}
                          name={business.name}
                          size={24}
                          style={styles.businessIcon}
                        />
                      </View>
                      <View style={styles.businessInfo}>
                        <Text style={[
                          styles.businessName,
                          selectedBusiness?.id === business.id && styles.selectedBusinessName
                        ]}>
                          {business.name}
                        </Text>
                        <Text style={styles.businessPhone}>{business.phone}</Text>
                      </View>
                      {selectedBusiness?.id === business.id && (
                        <Ionicons name="checkmark" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Joined Businesses */}
              {businesses.joined.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>JOINED BUSINESSES</Text>
                  {businesses.joined.map((business: any) => (
                    <TouchableOpacity
                      key={business.id}
                      style={styles.businessItem}
                      onPress={() => handleBusinessSelection(business)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.businessIconContainer}>
                        <SafeLogo
                          logo={business.logo}
                          name={business.name}
                          size={24}
                          style={styles.businessIcon}
                        />
                      </View>
                      <View style={styles.businessInfo}>
                        <Text style={[
                          styles.businessName,
                          selectedBusiness?.id === business.id && styles.selectedBusinessName
                        ]}>
                          {business.name}
                        </Text>
                        <Text style={styles.businessPhone}>{business.phone}</Text>
                      </View>
                      {selectedBusiness?.id === business.id && (
                        <Ionicons name="checkmark" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}

          {/* Navigation Items */}
          <View style={styles.navigationSection}>
            {/* Home */}
            <DrawerItem
              label="Home"
              labelStyle={styles.label}
              icon={() => <Feather name="home" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/')}
            />

            {/* Track Package with Dropdown */}
            <TouchableOpacity
              style={styles.customItem}
              onPress={() => setShowTrackDropdown(!showTrackDropdown)}
              activeOpacity={0.7}
            >
              <View style={styles.trackHeader}>
                <Feather name="map-pin" size={24} color={colors.primary} style={styles.trackIcon} />
                <Text style={styles.trackLabel}>Track Package</Text>
                <Ionicons
                  name={showTrackDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.primary}
                />
              </View>
            </TouchableOpacity>

            {showTrackDropdown &&
              trackingStatuses.map((item) => (
                <DrawerItem
                  key={item.key}
                  label={item.label}
                  labelStyle={styles.subLabel}
                  icon={() => (
                    <Feather name={item.icon as any} size={20} color={colors.primary} />
                  )}
                  style={styles.subItem}
                  onPress={() => handleTrackNavigation(item)}
                />
              ))}

            {/* Business */}
            <DrawerItem
              label="Business"
              labelStyle={styles.label}
              icon={() => <Feather name="briefcase" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/business')}
            />

            {/* Cart */}
            <DrawerItem
              label="Cart"
              labelStyle={styles.label}
              icon={() => <Feather name="shopping-cart" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/cart')}
            />

            {/* History */}
            <DrawerItem
              label="History"
              labelStyle={styles.label}
              icon={() => <MaterialIcons name="history" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/History')}
            />

            {/* General Navigation */}
            <DrawerItem
              label="Talk to a rep"
              labelStyle={styles.label}
              icon={() => <Feather name="message-circle" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/Support')}
            />

            <DrawerItem
              label="FAQs"
              labelStyle={styles.label}
              icon={() => <Feather name="help-circle" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/FAQs')}
            />

            <DrawerItem
              label="Find us"
              labelStyle={styles.label}
              icon={() => <MaterialIcons name="location-on" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/findus')}
            />

            {/* Contacts */}
            <DrawerItem
              label="Contacts"
              labelStyle={styles.label}
              icon={() => <Feather name="user" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/contacts')}
            />

            {/* Settings */}
            <DrawerItem
              label="Settings"
              labelStyle={styles.label}
              icon={() => <Ionicons name="settings-outline" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/(drawer)/Settings')}
            />

            {/* Invite Friends */}
            <DrawerItem
              label="Invite Friends"
              labelStyle={styles.label}
              icon={() => <Feather name="user-plus" size={24} color={colors.primary} />}
              onPress={() => navigateToRoute('/invite')}
            />
          </View>
        </View>
      </DrawerContentScrollView>

      {/* Become a Rider Button at bottom */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.becomeRiderButton}
          onPress={() => navigateToRoute('/rider/application')}
          activeOpacity={0.8}
        >
          <Feather name="truck" size={20} color="#fff" />
          <Text style={styles.becomeRiderButtonText}>Become a rider</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    paddingTop: 10,
  },
  accountHeader: {
    backgroundColor: '#601DA6',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  avatar: {
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  userPhone: {
    color: 'white',
    fontSize: 13,
  },
  modeIndicator: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountDropdown: {
    backgroundColor: '#4D2292',
    marginHorizontal: 12,
    marginTop: 6,
    paddingLeft: 10,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  navigationSection: {
    marginTop: 10,
  },
  label: {
    color: colors.text,
    fontSize: 17,
    marginLeft: -5,
  },
  subLabel: {
    color: colors.text,
    fontSize: 15,
    marginLeft: 10,
  },
  subItem: {
    paddingLeft: 30,
    paddingVertical: 0,
  },
  customItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackIcon: {
    marginRight: 10,
  },
  trackLabel: {
    flex: 1,
    fontSize: 17,
    color: colors.text,
  },
  businessesSection: {
    paddingVertical: 8,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
    letterSpacing: 0.5,
  },
  businessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  businessIconContainer: {
    marginRight: 12,
  },
  businessIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: '500',
  },
  selectedBusinessName: {
    color: '#fff',
    fontWeight: '600',
  },
  businessPhone: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  bottomButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  becomeRiderButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  becomeRiderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
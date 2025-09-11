// components/CustomDrawerContent.tsx - Updated with "All" button and enhanced navigation
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
      <Image
        source={fallbackSource}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      />
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
  const [showTrackDropdown, setShowTrackDropdown] = useState(false);
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  
  const { 
    user, 
    businesses, 
    currentAccount,
    selectedBusiness,
    setSelectedBusiness,
    getUserPhone,
    getDisplayName,
    refreshUser,
    clearUserCache,
    avatarUpdateTrigger,
    triggerAvatarRefresh,
  } = useUser();

  // Enhanced display logic - show business name if selected, otherwise user name
  const displayName = selectedBusiness?.name || getDisplayName();
  const userPhone = getUserPhone();
  
  // FIXED: Enhanced phone number logic - show business phone if available, fallback to user phone
  const getDisplayPhone = (): string => {
    if (selectedBusiness?.phone_number && selectedBusiness.phone_number.trim()) {
      console.log('🎭 Drawer: Using business phone number:', selectedBusiness.phone_number);
      return selectedBusiness.phone_number;
    }
    
    console.log('🎭 Drawer: Using user phone number (fallback):', userPhone);
    return userPhone;
  };
  
  const displayPhone = getDisplayPhone();
  
  // Determine display mode based on selected business
  const isBusinessMode = !!selectedBusiness;

  // Enhanced user data tracking with avatar sync trigger
  useEffect(() => {
    if (user) {
      console.log('🎭 Drawer user data updated:', {
        userId: user.id,
        email: user.email,
        avatarUrl: user.avatar_url,
        selectedBusiness: selectedBusiness?.name || 'None',
        businessPhone: selectedBusiness?.phone_number || 'None',
        userPhone: userPhone,
        displayPhone: displayPhone,
        isBusinessMode,
        updateTrigger: avatarUpdateTrigger,
        timestamp: Date.now()
      });
    }
  }, [user?.avatar_url, user?.id, selectedBusiness, isBusinessMode, avatarUpdateTrigger, userPhone, displayPhone]);

  // Enhanced refresh handler that triggers avatar sync
  const handleRefreshUser = useCallback(async () => {
    try {
      console.log('🎭 Drawer manually refreshing user data with avatar sync...');
      await clearUserCache();
      await refreshUser(true);
      triggerAvatarRefresh();
      console.log('🎭 Drawer user refresh with avatar sync completed');
    } catch (error) {
      console.error('🎭 Drawer user refresh error:', error);
    }
  }, [refreshUser, clearUserCache, triggerAvatarRefresh]);

  // Listen for drawer events and optionally refresh
  useEffect(() => {
    const unsubscribe = props.navigation.addListener('drawerOpen', () => {
      console.log('🎭 Drawer opened, checking for user updates...');
    });

    return unsubscribe;
  }, [props.navigation, handleRefreshUser]);

  // Listen for focus events to detect potential avatar updates
  useEffect(() => {
    const unsubscribeFocus = props.navigation.addListener('focus', () => {
      console.log('🎭 Drawer focused, avatar might have been updated');
      setTimeout(() => {
        triggerAvatarRefresh();
      }, 500);
    });

    return unsubscribeFocus;
  }, [props.navigation, triggerAvatarRefresh]);

  // Updated tracking statuses with "All" button at the top
  const trackingStatuses = [
    { label: 'All', key: 'all', icon: 'package' }, // NEW: All packages option
    { label: 'Pending', key: 'pending', icon: 'clock' },
    { label: 'Paid', key: 'paid', icon: 'check-circle' },
    { label: 'Submitted', key: 'submitted', icon: 'upload' },
    { label: 'In transit', key: 'in-transit', icon: 'truck' },
    { label: 'Delivered', key: 'delivered', icon: 'box' },
    { label: 'Collected', key: 'collected', icon: 'archive' },
    { label: 'Rejected', key: 'rejected', icon: 'x-circle' },
  ];

  // Enhanced business switching
  const handleBusinessSwitch = async (business: any) => {
    try {
      setShowBusinessDropdown(false);
      props.navigation.closeDrawer();
      
      console.log('🎭 Drawer switching to business:', business.name);
      setSelectedBusiness?.(business);
      
      Toast.show({
        type: 'success',
        text1: 'Business selected',
        text2: `Now using ${business.name}`,
      });
    } catch (error: any) {
      console.error('🎭 Drawer business switch error:', error);
      Alert.alert('Error', error.message || 'Failed to switch business');
    }
  };

  // Handle switching to "You" mode (personal mode)
  const handleSwitchToYou = async () => {
    try {
      setShowBusinessDropdown(false);
      props.navigation.closeDrawer();
      
      console.log('🎭 Drawer switching to You mode (personal)');
      setSelectedBusiness?.(null); // Clear selected business
      
      Toast.show({
        type: 'success',
        text1: 'Personal account',
        text2: 'Now using your personal account',
      });
    } catch (error: any) {
      console.error('🎭 Drawer You mode switch error:', error);
      Alert.alert('Error', error.message || 'Failed to switch to personal mode');
    }
  };

  // FIXED: Enhanced business management navigation with NavigationHelper
  const handleBusinessManagement = async () => {
    setShowBusinessDropdown(false);
    props.navigation.closeDrawer();
    
    console.log('🎭 Navigating to business management...');
    
    try {
      await NavigationHelper.navigateTo('/(drawer)/business', {
        params: {},
        trackInHistory: true
      });
    } catch (error) {
      console.error('🎭 Navigation error:', error);
      try {
        await NavigationHelper.navigateTo('/(drawer)/Business', {
          params: {},
          trackInHistory: true
        });
      } catch (fallbackError) {
        console.error('🎭 Fallback navigation also failed:', fallbackError);
        Alert.alert('Navigation Error', 'Could not open business screen');
      }
    }
  };

  // FIXED: Enhanced become rider navigation with NavigationHelper
  const handleBecomeRider = async () => {
    props.navigation.closeDrawer();
    console.log('🎭 Navigating to become a rider...');
    Alert.alert(
      'Become a Rider',
      'Contact us to learn more about becoming a rider!',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Contact Us', 
          onPress: async () => {
            try {
              await NavigationHelper.navigateTo('/(drawer)/Support', {
                params: {},
                trackInHistory: true
              });
            } catch (error) {
              console.error('Navigation to support failed:', error);
            }
          }
        }
      ]
    );
  };

  // FIXED: Enhanced track navigation with NavigationHelper
  const handleTrackNavigation = async (item: any) => {
    try {
      if (item.key === 'all') {
        // Navigate to track screen without status filter (shows all packages)
        await NavigationHelper.navigateTo('/(drawer)/track', {
          params: {},
          trackInHistory: true
        });
      } else {
        // Navigate with specific status filter
        await NavigationHelper.navigateTo('/(drawer)/track', {
          params: { status: item.key },
          trackInHistory: true
        });
      }
    } catch (error) {
      console.error('Track navigation failed:', error);
    }
  };

  const renderBusinessItem = (business: any, isOwned: boolean = true) => {
    const isSelectedBusiness = selectedBusiness?.id === business.id;

    return (
      <TouchableOpacity
        key={business.id}
        style={styles.businessItem}
        onPress={() => handleBusinessSwitch(business)}
        activeOpacity={0.7}
      >
        {/* Use business logo if available, fallback to business icon */}
        <View style={styles.businessIconContainer}>
          {business.logo_url ? (
            <SafeLogo
              size={24}
              logoUrl={business.logo_url}
              avatarUrl={user?.avatar_url}
              style={styles.businessLogo}
              updateTrigger={avatarUpdateTrigger}
            />
          ) : (
            <View style={styles.businessIcon}>
              <Feather name="briefcase" size={16} color="#fff" />
            </View>
          )}
        </View>
        
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>
            {business.name}
          </Text>
          <Text style={styles.businessType}>
            {isOwned ? 'Owned' : 'Joined'}
          </Text>
          {/* Show business phone if available */}
          {business.phone_number && (
            <Text style={styles.businessPhone}>
              {business.phone_number}
            </Text>
          )}
        </View>
        
        {isSelectedBusiness && (
          <View style={styles.checkmarkContainer}>
            <Feather name="check" size={14} color="#00ff00" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render "You" option - tappable like businesses
  const renderYouOption = () => {
    const isSelected = !selectedBusiness; // Selected when no business is selected

    return (
      <TouchableOpacity
        style={styles.businessItem}
        onPress={handleSwitchToYou}
        activeOpacity={0.7}
      >
        <View style={styles.businessIconContainer}>
          <SafeAvatar
            size={24}
            avatarUrl={user?.avatar_url}
            style={styles.businessLogo}
            updateTrigger={avatarUpdateTrigger}
          />
        </View>
        
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>
            {getDisplayName()}
          </Text>
          <Text style={styles.businessPhone}>
            {userPhone}
          </Text>
        </View>
        
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Feather name="check" size={14} color="#00ff00" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.drawerContainer}>
      <DrawerContentScrollView 
        {...props} 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* Fixed Personal Account Header - shows current user/business data */}    
          <TouchableOpacity    
            onPress={() => setShowBusinessDropdown(!showBusinessDropdown)}    
            style={styles.accountHeader}    
            activeOpacity={0.8}
          >    
            {/* Context-aware image display: Business logo when business selected, avatar when in "You" mode */}
            {isBusinessMode ? (
              <SafeLogo
                size={42}
                logoUrl={selectedBusiness.logo_url}
                avatarUrl={user?.avatar_url}
                style={styles.avatar}
                updateTrigger={avatarUpdateTrigger}
              />
            ) : (
              <SafeAvatar
                size={42}
                avatarUrl={user?.avatar_url}
                fallbackSource={require('../assets/images/avatar_placeholder.png')}
                style={styles.avatar}
                updateTrigger={avatarUpdateTrigger}
              />
            )}
            
            <View style={styles.accountInfo}>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userPhone}>{displayPhone}</Text>
            </View>    
            <Feather    
              name={showBusinessDropdown ? 'chevron-up' : 'chevron-down'}    
              size={20}    
              color="#fff"    
            />
          </TouchableOpacity>    

          {showBusinessDropdown && (    
            <View style={styles.accountDropdown}>
              
              {/* Personal section header */}
              <Text style={styles.sectionTitle}>Personal</Text>
              
              {/* You option - tappable like businesses */}
              {renderYouOption()}
              
              {/* Business Listings */}
              {(businesses.owned.length > 0 || businesses.joined.length > 0) && (
                <>
                  <Text style={styles.sectionTitle}>Your Businesses</Text>
                  
                  {/* Owned Businesses */}
                  {businesses.owned.map(business => renderBusinessItem(business, true))}
                  
                  {/* Joined Businesses */}
                  {businesses.joined.map(business => renderBusinessItem(business, false))}
                </>
              )}

              {/* Business Management Button */}
              <TouchableOpacity
                style={styles.businessButton}
                onPress={handleBusinessManagement}
              >
                <Feather name="briefcase" size={18} color="#fff" />
                <Text style={styles.businessButtonText}>Business</Text>
              </TouchableOpacity>
            </View>    
          )}    

          {/* Track a Package */}    
          <TouchableOpacity
            style={styles.customItem}
            onPress={() => setShowTrackDropdown((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={styles.trackHeader}>
              <Feather name="map-pin" size={20} color={colors.primary} style={styles.trackIcon} />
              <Text style={styles.trackLabel}>Track a package</Text>
              <Feather
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

          {/* FIXED: General Navigation with NavigationHelper */}    
          <DrawerItem    
            label="Talk to a rep"    
            labelStyle={styles.label}    
            icon={() => <Feather name="message-circle" size={24} color={colors.primary} />}    
            onPress={async () => {
              try {
                await NavigationHelper.navigateTo('/(drawer)/Support', {
                  params: {},
                  trackInHistory: true
                });
              } catch (error) {
                console.error('Navigation to support failed:', error);
              }
            }}    
          />    
          <DrawerItem    
            label="FAQs"    
            labelStyle={styles.label}    
            icon={() => <Feather name="help-circle" size={24} color={colors.primary} />}    
            onPress={async () => {
              try {
                await NavigationHelper.navigateTo('/(drawer)/FAQs', {
                  params: {},
                  trackInHistory: true
                });
              } catch (error) {
                console.error('Navigation to FAQs failed:', error);
              }
            }}    
          />    
          <DrawerItem    
            label="Find us"    
            labelStyle={styles.label}    
            icon={() => <MaterialIcons name="location-on" size={24} color={colors.primary} />}    
            onPress={async () => {
              try {
                await NavigationHelper.navigateTo('/(drawer)/findus', {
                  params: {},
                  trackInHistory: true
                });
              } catch (error) {
                console.error('Navigation to findus failed:', error);
              }
            }}    
          />    

          {/* Contacts */}    
          <DrawerItem    
            label="Contacts"    
            labelStyle={styles.label}    
            icon={() => <Feather name="user" size={24} color={colors.primary} />}    
            onPress={async () => {
              try {
                await NavigationHelper.navigateTo('/(drawer)/contacts', {
                  params: {},
                  trackInHistory: true
                });
              } catch (error) {
                console.error('Navigation to contacts failed:', error);
              }
            }}    
          />    

          {/* Settings */}    
          <DrawerItem    
            label="Settings"    
            labelStyle={styles.label}    
            icon={() => <Ionicons name="settings-outline" size={24} color={colors.primary} />}    
            onPress={async () => {
              try {
                await NavigationHelper.navigateTo('/(drawer)/Settings', {
                  params: {},
                  trackInHistory: true
                });
              } catch (error) {
                console.error('Navigation to settings failed:', error);
              }
            }}    
          />    

          {/* Invite Friends */}    
          <DrawerItem    
            label="Invite Friends"    
            labelStyle={styles.label}    
            icon={() => <Feather name="user-plus" size={24} color={colors.primary} />}    
            onPress={async () => {
              try {
                await NavigationHelper.navigateTo('/invite', {
                  params: {},
                  trackInHistory: true
                });
              } catch (error) {
                console.error('Navigation to invite failed:', error);
              }
            }}    
          />    

        </View>    
      </DrawerContentScrollView>

      {/* Become a Rider Button at bottom */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.becomeRiderButton}
          onPress={handleBecomeRider}
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
    backgroundColor: 'rgba(124, 58, 237, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  businessType: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  businessPhone: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 1,
    fontFamily: 'monospace',
  },
  checkmarkContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  businessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.5)',
  },
  businessButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
  bottomButtonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  becomeRiderButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  becomeRiderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
// components/CustomDrawerContent.tsx - Fixed with enhanced avatar synchronization
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
import colors from '../theme/colors';

// Enhanced Safe Avatar Component with comprehensive synchronization
interface SafeAvatarProps {
  size: number;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
  updateTrigger?: number; // New: Force refresh trigger
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
  
  // Reset error state and force reload when avatarUrl or updateTrigger changes
  useEffect(() => {
    console.log('🎭 Drawer SafeAvatar: Update triggered', {
      avatarUrl,
      updateTrigger,
      timestamp: Date.now()
    });
    
    setHasError(false);
    setImageKey(Date.now()); // Force reload with new timestamp
  }, [avatarUrl, updateTrigger]);
  
  // Use fallback if no URL or error occurred
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
        uri: `${fullAvatarUrl}?v=${imageKey}&t=${updateTrigger}`, // Enhanced cache busting
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
    avatarUpdateTrigger, // New: Avatar sync trigger
    triggerAvatarRefresh, // New: Force avatar refresh
  } = useUser();

  // Use selected business name or fallback to user display name
  const displayName = selectedBusiness?.name || getDisplayName();
  const userPhone = getUserPhone();

  // Enhanced user data tracking with avatar sync trigger
  useEffect(() => {
    if (user) {
      console.log('🎭 Drawer user data updated:', {
        userId: user.id,
        email: user.email,
        avatarUrl: user.avatar_url,
        updateTrigger: avatarUpdateTrigger,
        timestamp: Date.now()
      });
    }
  }, [user?.avatar_url, user?.id, avatarUpdateTrigger]); // Watch for avatar sync trigger

  // Enhanced refresh handler that triggers avatar sync
  const handleRefreshUser = useCallback(async () => {
    try {
      console.log('🎭 Drawer manually refreshing user data with avatar sync...');
      await clearUserCache();
      await refreshUser(true);
      triggerAvatarRefresh(); // Ensure avatar refresh across components
      console.log('🎭 Drawer user refresh with avatar sync completed');
    } catch (error) {
      console.error('🎭 Drawer user refresh error:', error);
    }
  }, [refreshUser, clearUserCache, triggerAvatarRefresh]);

  // Listen for drawer events and optionally refresh
  useEffect(() => {
    const unsubscribe = props.navigation.addListener('drawerOpen', () => {
      console.log('🎭 Drawer opened, checking for user updates...');
      // Optionally refresh user data when drawer opens
      // Uncomment the line below if you want automatic refresh on drawer open
      // handleRefreshUser();
    });

    return unsubscribe;
  }, [props.navigation, handleRefreshUser]);

  // Listen for focus events to detect potential avatar updates
  useEffect(() => {
    const unsubscribeFocus = props.navigation.addListener('focus', () => {
      console.log('🎭 Drawer focused, avatar might have been updated');
      // Trigger a small delay refresh to catch any avatar updates
      setTimeout(() => {
        triggerAvatarRefresh();
      }, 500);
    });

    return unsubscribeFocus;
  }, [props.navigation, triggerAvatarRefresh]);

  const trackingStatuses = [
    { label: 'Pending', key: 'pending', icon: 'clock' },
    { label: 'Paid', key: 'paid', icon: 'check-circle' },
    { label: 'Submitted', key: 'submitted', icon: 'upload' },
    { label: 'In transit', key: 'in-transit', icon: 'truck' },
    { label: 'Delivered', key: 'delivered', icon: 'box' },
    { label: 'Collected', key: 'collected', icon: 'archive' },
    { label: 'Rejected', key: 'rejected', icon: 'x-circle' },
  ];

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

  const handleBusinessManagement = () => {
    setShowBusinessDropdown(false);
    props.navigation.closeDrawer();
    
    console.log('🎭 Navigating to business management...');
    
    try {
      props.navigation.navigate('business');
    } catch (error) {
      console.error('🎭 Navigation error:', error);
      try {
        props.navigation.navigate('Business');
      } catch (fallbackError) {
        console.error('🎭 Fallback navigation also failed:', fallbackError);
        Alert.alert('Navigation Error', 'Could not open business screen');
      }
    }
  };

  const handleAccountNavigation = () => {
    setShowBusinessDropdown(false);
    props.navigation.closeDrawer();
    
    console.log('🎭 Navigating to account...');
    props.navigation.navigate('account');
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
        <View style={styles.businessIcon}>
          <Feather name="briefcase" size={16} color="#fff" />
        </View>
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>
            {business.name}
          </Text>
          <Text style={styles.businessType}>
            {isOwned ? 'Owned' : 'Joined'}
          </Text>
        </View>
        {isSelectedBusiness && (
          <View style={styles.checkmarkContainer}>
            <Feather name="check" size={14} color="#00ff00" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.container}>

        {/* Main Business/Account Section with synchronized avatar */}    
        <TouchableOpacity    
          onPress={() => setShowBusinessDropdown(!showBusinessDropdown)}    
          style={styles.accountHeader}    
          activeOpacity={0.8}
        >    
          {/* Enhanced SafeAvatar component with proper synchronization */}
          <SafeAvatar
            size={42}
            avatarUrl={user?.avatar_url}
            fallbackSource={require('../assets/images/avatar_placeholder.png')}
            style={styles.avatar}
            updateTrigger={avatarUpdateTrigger} // Pass sync trigger
          />
          <View style={styles.accountInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userPhone}>{userPhone}</Text>
          </View>    
          <Feather    
            name={showBusinessDropdown ? 'chevron-up' : 'chevron-down'}    
            size={20}    
            color="#fff"    
          />
        </TouchableOpacity>    

        {showBusinessDropdown && (    
          <View style={styles.accountDropdown}>
            {/* Account */}
            <DrawerItem    
              label="Account"    
              labelStyle={styles.label}    
              icon={() => <Feather name="user" size={22} color="#fff" />}    
              onPress={handleAccountNavigation}
            />
            
            {/* Business Listings */}
            {(businesses.owned.length > 0 || businesses.joined.length > 0) && (
              <View style={styles.businessesSection}>
                <Text style={styles.sectionTitle}>Your Businesses</Text>
                
                {/* Owned Businesses */}
                {businesses.owned.map(business => renderBusinessItem(business, true))}
                
                {/* Joined Businesses */}
                {businesses.joined.map(business => renderBusinessItem(business, false))}
              </View>
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
              onPress={() =>    
                props.navigation.navigate({    
                  name: 'track',    
                  params: { status: item.key },    
                  merge: true,    
                })    
              }    
            />    
          ))}    

        {/* General Navigation */}    
        <DrawerItem    
          label="Talk to a rep"    
          labelStyle={styles.label}    
          icon={() => <Feather name="message-circle" size={24} color={colors.primary} />}    
          onPress={() => props.navigation.navigate('support')}    
        />    
        <DrawerItem    
          label="FAQs"    
          labelStyle={styles.label}    
          icon={() => <Feather name="help-circle" size={24} color={colors.primary} />}    
          onPress={() => props.navigation.navigate('faqs')}    
        />    
        <DrawerItem    
          label="History"    
          labelStyle={styles.label}    
          icon={() => <MaterialIcons name="history" size={24} color={colors.primary} />}    
          onPress={() => props.navigation.navigate('history')}    
        />    

        {/* Contacts */}    
        <DrawerItem    
          label="Contacts"    
          labelStyle={styles.label}    
          icon={() => <Feather name="user" size={24} color={colors.primary} />}    
          onPress={() => props.navigation.navigate('contact')}    
        />    

        {/* Settings */}    
        <DrawerItem    
          label="Settings"    
          labelStyle={styles.label}    
          icon={() => <Ionicons name="settings-outline" size={24} color={colors.primary} />}    
          onPress={() => props.navigation.navigate('settings')}    
        />    

        {/* Invite Friends */}    
        <DrawerItem    
          label="Invite Friends"    
          labelStyle={styles.label}    
          icon={() => <Feather name="user-plus" size={24} color={colors.primary} />}    
          onPress={() => props.navigation.navigate('invite')}    
        />    

        {/* Footer Icon */}    
        <View style={styles.footerIcon}>    
          <FontAwesome5 name="exclamation-circle" size={22} color={colors.primary} />    
        </View>    

      </View>    
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  footerIcon: {
    marginTop: 'auto',
    alignSelf: 'center',
    marginBottom: 20,
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
  businessIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
});
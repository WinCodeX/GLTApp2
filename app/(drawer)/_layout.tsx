// components/CustomDrawerContent.tsx - Enhanced for better track integration
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
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useUser } from '../context/UserContext';
import colors from '../theme/colors';

export default function CustomDrawerContent(props: any) {
  const [showTrackDropdown, setShowTrackDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const { user } = useUser();

  const avatarSource = user?.avatar_url
    ? { uri: user.avatar_url }
    : require('../assets/images/avatar_placeholder.png');

  // Enhanced tracking statuses with better mapping
  const trackingStatuses = [
    { 
      label: 'Pending Payment', 
      key: 'pending', 
      icon: 'clock',
      color: '#f59e0b',
      description: 'Awaiting payment'
    },
    { 
      label: 'Paid', 
      key: 'paid', 
      icon: 'check-circle',
      color: '#10b981',
      description: 'Payment received'
    },
    { 
      label: 'Submitted', 
      key: 'submitted', 
      icon: 'upload',
      color: '#3b82f6',
      description: 'Ready for pickup'
    },
    { 
      label: 'In Transit', 
      key: 'in-transit', 
      icon: 'truck',
      color: '#8b5cf6',
      description: 'Being delivered'
    },
    { 
      label: 'Delivered', 
      key: 'delivered', 
      icon: 'box',
      color: '#059669',
      description: 'Successfully delivered'
    },
    { 
      label: 'Collected', 
      key: 'collected', 
      icon: 'archive',
      color: '#0d9488',
      description: 'Picked up by recipient'
    },
    { 
      label: 'Rejected', 
      key: 'rejected', 
      icon: 'x-circle',
      color: '#ef4444',
      description: 'Delivery failed'
    },
  ];

  // Navigate to track page with specific status
  const navigateToTrackWithStatus = (statusKey: string) => {
    console.log('🎯 Navigating to track with status:', statusKey);
    
    // Close the dropdown
    setShowTrackDropdown(false);
    
    // Navigate with parameters
    props.navigation.navigate('track', { status: statusKey });
  };

  // Navigate to track page without filters (show all)
  const navigateToTrackAll = () => {
    console.log('🎯 Navigating to track (all packages)');
    setShowTrackDropdown(!showTrackDropdown);
    
    if (!showTrackDropdown) {
      props.navigation.navigate('track');
    }
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.container}>

        {/* Account Section */}    
        <TouchableOpacity    
          onPress={() => setShowAccountDropdown(!showAccountDropdown)}    
          style={styles.accountHeader}    
        >    
          <Image
            source={avatarSource}
            style={styles.avatar}
          />  
          <View style={styles.accountInfo}>    
            <Text style={styles.userName}>Xs</Text>    
            <Text style={styles.userPhone}>+254 712 293 377</Text>    
          </View>    
          <Feather    
            name={showAccountDropdown ? 'chevron-up' : 'chevron-down'}    
            size={20}    
            color="#fff"    
          />    
        </TouchableOpacity>    

        {showAccountDropdown && (    
          <View style={styles.accountDropdown}>    
            <DrawerItem    
              label="Account"    
              labelStyle={styles.label}    
              icon={() => <Feather name="user" size={22} color="#fff" />}    
              onPress={() => props.navigation.navigate('account')}    
            />    
            <DrawerItem    
              label="Add Account"    
              labelStyle={styles.label}    
              icon={() => <Feather name="plus" size={22} color="#fff" />}    
              onPress={() => {}}    
            />    
          </View>    
        )}    

        {/* Enhanced Track a Package Section */}    
        <TouchableOpacity
          style={styles.customItem}
          onPress={navigateToTrackAll}
          activeOpacity={0.7}
        >
          <View style={styles.trackHeader}>
            <Feather name="map-pin" size={20} color={colors.primary} style={styles.trackIcon} />
            <Text style={styles.trackLabel}>Track Packages</Text>
            <Feather
              name={showTrackDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.primary}
            />
          </View>
        </TouchableOpacity>
        
        {showTrackDropdown && (
          <View style={styles.trackDropdown}>
            {/* All Packages Option */}
            <DrawerItem
              label="All Packages"
              labelStyle={styles.allPackagesLabel}
              icon={() => (
                <Feather name="package" size={18} color={colors.primary} />
              )}
              style={styles.allPackagesItem}
              onPress={() => {
                setShowTrackDropdown(false);
                props.navigation.navigate('track');
              }}
            />
            
            {/* Individual Status Options */}
            {trackingStatuses.map((item) => (
              <DrawerItem    
                key={item.key}    
                label={item.label}    
                labelStyle={[styles.subLabel, { color: item.color }]}    
                icon={() => (    
                  <Feather 
                    name={item.icon as any} 
                    size={18} 
                    color={item.color} 
                  />    
                )}    
                style={styles.subItem}    
                onPress={() => navigateToTrackWithStatus(item.key)}
              />    
            ))}
          </View>
        )}

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

        {/* Contacts ABOVE Settings */}    
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

        {/* Invite Friends BELOW Settings */}    
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
    width: 42,
    height: 42,
    borderRadius: 21,
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
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '500',
  },
  allPackagesLabel: {
    color: colors.primary,
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '600',
  },
  subItem: {
    paddingLeft: 30,
    paddingVertical: 4,
  },
  allPackagesItem: {
    paddingLeft: 30,
    paddingVertical: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    marginHorizontal: 8,
    borderRadius: 8,
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
    fontWeight: '500',
  },
  trackDropdown: {
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    marginHorizontal: 12,
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  footerIcon: {
    marginTop: 'auto',
    alignSelf: 'center',
    marginBottom: 20,
  },
});
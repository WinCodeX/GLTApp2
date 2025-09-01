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
  Alert,
} from 'react-native';
import { useUser } from '../context/UserContext';
import colors from '../theme/colors';
export default function CustomDrawerContent(props: any) {
  const [showTrackDropdown, setShowTrackDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  
  const { 
    user, 
    businesses, 
    savedAccounts,
    currentAccountIndex,
    getBusinessDisplayName, 
    getUserPhone,
    switchAccount,
    removeAccount
  } = useUser();

  // Use the helper function from context that handles business name fallback
  const displayName = getBusinessDisplayName();
  
  // Use the helper function for phone
  const userPhone = getUserPhone();

  const avatarSource = user?.avatar_url
    ? { uri: user.avatar_url }
    : require('../assets/images/avatar_placeholder.png');

  const trackingStatuses = [
    { label: 'Pending', key: 'pending', icon: 'clock' },
    { label: 'Paid', key: 'paid', icon: 'check-circle' },
    { label: 'Submitted', key: 'submitted', icon: 'upload' },
    { label: 'In transit', key: 'in-transit', icon: 'truck' },
    { label: 'Delivered', key: 'delivered', icon: 'box' },
    { label: 'Collected', key: 'collected', icon: 'archive' },
    { label: 'Rejected', key: 'rejected', icon: 'x-circle' },
  ];

  const handleAccountSwitch = async (accountIndex: number) => {
    if (accountIndex === currentAccountIndex) {
      setShowAccountDropdown(false);
      return;
    }

    try {
      await switchAccount(accountIndex);
      setShowAccountDropdown(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to switch accounts');
    }
  };

  const handleAccountRemove = async (accountIndex: number, accountEmail: string) => {
    Alert.alert(
      'Remove Account',
      `Are you sure you want to remove ${accountEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(accountIndex);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove account');
            }
          },
        },
      ]
    );
  };

  const renderSavedAccount = (account: any, index: number) => {
    const isCurrentAccount = index === currentAccountIndex;
    const accountAvatar = account.avatar_url
      ? { uri: account.avatar_url }
      : require('../assets/images/avatar_placeholder.png');

    return (
      <View key={account.id} style={styles.savedAccountContainer}>
        <TouchableOpacity
          style={[
            styles.savedAccountItem,
            isCurrentAccount && styles.currentAccountItem
          ]}
          onPress={() => handleAccountSwitch(index)}
        >
          <Image source={accountAvatar} style={styles.savedAccountAvatar} />
          <View style={styles.savedAccountInfo}>
            <Text style={[
              styles.savedAccountName,
              isCurrentAccount && styles.currentAccountText
            ]}>
              {account.display_name}
            </Text>
            <Text style={[
              styles.savedAccountEmail,
              isCurrentAccount && styles.currentAccountEmailText
            ]}>
              {account.email}
            </Text>
          </View>
          {isCurrentAccount && (
            <View style={styles.currentAccountBadge}>
              <Feather name="check-circle" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        
        {/* Remove button for non-current accounts */}
        {!isCurrentAccount && savedAccounts.length > 1 && (
          <TouchableOpacity
            style={styles.removeAccountButton}
            onPress={() => handleAccountRemove(index, account.email)}
          >
            <Feather name="x" size={16} color="#ff5555" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.container}>

          {/* Main Account Section */}    
          <TouchableOpacity    
            onPress={() => setShowAccountDropdown(!showAccountDropdown)}    
            style={styles.accountHeader}    
          >    
            <Image
              source={avatarSource}
              style={styles.avatar}
            />  
            <View style={styles.accountInfo}>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userPhone}>{userPhone}</Text>
            </View>    
            <Feather    
              name={showAccountDropdown ? 'chevron-up' : 'chevron-down'}    
              size={20}    
              color="#fff"    
            />    
          </TouchableOpacity>    

          {showAccountDropdown && (    
            <View style={styles.accountDropdown}>
              {/* Current Account Details */}
              <DrawerItem    
                label="Account"    
                labelStyle={styles.label}    
                icon={() => <Feather name="user" size={22} color="#fff" />}    
                onPress={() => {
                  setShowAccountDropdown(false);
                  props.navigation.navigate('account');
                }}    
              />
              
              {/* Saved Accounts */}
              {savedAccounts.length > 0 && (
                <View style={styles.savedAccountsSection}>
                  <Text style={styles.savedAccountsTitle}>Accounts ({savedAccounts.length}/3)</Text>
                  {savedAccounts.map((account, index) => renderSavedAccount(account, index))}
                </View>
              )}

              {/* Add Account Button (only if less than 3 accounts) */}
              {savedAccounts.length < 3 && (
                <DrawerItem    
                  label="Add Account"    
                  labelStyle={styles.label}    
                  icon={() => <Feather name="plus" size={22} color="#fff" />}    
                  onPress={() => {
                    setShowAccountDropdown(false);
                    // Use the callback from props instead of managing modal state here
                    props.onAddAccount?.();
                  }}    
                />
              )}
              
              {/* Switch Business (if multiple businesses) */}
              {businesses.owned.length > 1 && (
                <DrawerItem    
                  label="Switch Business"    
                  labelStyle={styles.label}    
                  icon={() => <Feather name="briefcase" size={22} color="#fff" />}    
                  onPress={() => {
                    setShowAccountDropdown(false);
                    props.navigation.navigate('businessSelection');
                  }}    
                />
              )}    
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

  // Saved Accounts Styles
  savedAccountsSection: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  savedAccountsTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedAccountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedAccountItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  currentAccountItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  savedAccountAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  savedAccountInfo: {
    flex: 1,
  },
  savedAccountName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  savedAccountEmail: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  currentAccountText: {
    color: '#bd93f9',
  },
  currentAccountEmailText: {
    color: 'rgba(189, 147, 249, 0.8)',
  },
  currentAccountBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#bd93f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeAccountButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 85, 85, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 85, 85, 0.2)',
  },
});
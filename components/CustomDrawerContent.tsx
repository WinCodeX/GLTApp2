// components/CustomDrawerContent.tsx - Updated to use AccountManager
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
import { router } from 'expo-router';
import React, { useState } from 'react';
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
import colors from '../theme/colors';

interface CustomDrawerContentProps {
  onAddAccount?: () => void;
}

export default function CustomDrawerContent(props: any & CustomDrawerContentProps) {
  const [showTrackDropdown, setShowTrackDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  
  const router = useRouter();
  
  const { 
    user, 
    businesses, 
    accounts,
    currentAccount,
    getBusinessDisplayName, 
    getUserPhone,
    switchAccount,
    removeAccount
  } = useUser();

  const displayName = getBusinessDisplayName();
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

  const handleAccountSwitch = async (accountId: string) => {
    if (!currentAccount || accountId === currentAccount.id) {
      setShowAccountDropdown(false);
      return;
    }

    try {
      setShowAccountDropdown(false);
      props.navigation.closeDrawer();
      
      console.log('Drawer switching to account:', accountId);
      await switchAccount(accountId);
      
      const switchedAccount = accounts.find(acc => acc.id === accountId);
      if (switchedAccount) {
        Toast.show({
          type: 'success',
          text1: 'Account switched',
          text2: `Now using ${switchedAccount.display_name}`,
        });
      }
    } catch (error: any) {
      console.error('Drawer account switch error:', error);
      Alert.alert('Error', error.message || 'Failed to switch accounts');
    }
  };

  const handleAddAccount = () => {
    setShowAccountDropdown(false);
    props.navigation.closeDrawer();
    
    if (props.onAddAccount) {
      props.onAddAccount();
    } else {
      // Try immediate navigation instead of setTimeout
      router.push('/(drawer)/Business');
    }
  };

  const renderSavedAccount = (account: any) => {
    const isCurrentAccount = currentAccount?.id === account.id;
    const accountAvatar = account.avatar_url
      ? { uri: account.avatar_url }
      : require('../assets/images/avatar_placeholder.png');

    return (
      <TouchableOpacity
        key={account.id}
        style={styles.savedAccountItem}
        onPress={() => handleAccountSwitch(account.id)}
        activeOpacity={0.7}
      >
        <Image source={accountAvatar} style={styles.savedAccountAvatar} />
        <Text style={styles.savedAccountName}>
          {account.display_name}
        </Text>
        {isCurrentAccount && (
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

          {/* Main Account Section */}    
          <TouchableOpacity    
            onPress={() => setShowAccountDropdown(!showAccountDropdown)}    
            style={styles.accountHeader}    
            activeOpacity={0.8}
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
              {/* Account */}
              <DrawerItem    
                label="Account"    
                labelStyle={styles.label}    
                icon={() => <Feather name="user" size={22} color="#fff" />}    
                onPress={() => {
                  setShowAccountDropdown(false);
                  props.navigation.navigate('account');
                }}    
              />
              
              {/* Saved Accounts - Simple Display */}
              {accounts.length > 0 && (
                <View style={styles.savedAccountsSection}>
                  {accounts.map(account => renderSavedAccount(account))}
                </View>
              )}

              {/* Add Account Button (only if less than 3 accounts) */}
              {accounts.length < 3 && (
                <TouchableOpacity
                  style={styles.addAccountButton}
                  onPress={handleAddAccount}
                >
                  <Feather name="plus" size={18} color="#fff" />
                  <Text style={styles.addAccountText}>Add Account</Text>
                </TouchableOpacity>
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
  savedAccountsSection: {
    paddingVertical: 8,
  },
  savedAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  savedAccountAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  savedAccountName: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  addAccountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
});
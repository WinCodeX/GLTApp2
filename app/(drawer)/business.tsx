// app/(drawer)/Business.tsx - Fixed undefined errors
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useUser } from '../../context/UserContext';
import colors from '../../theme/colors';
import LoginModal from '../../components/LoginModal';
import SignupModal from '../../components/SignupModal';

interface BusinessProps {
  navigation: any;
}

export default function Business({ navigation }: BusinessProps) {
  // ✅ Fixed: Use 'accounts' instead of 'savedAccounts' to match useUser hook
  const { 
    user, 
    accounts = [], // ✅ Default to empty array if undefined
    currentAccount,
    getBusinessDisplayName, 
    getUserPhone,
    getDisplayName,
    switchAccount,
    removeAccount,
  } = useUser();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // ✅ Safe access with fallback values
  const displayName = getBusinessDisplayName?.() || 'Unknown User';
  const userPhone = getUserPhone?.() || 'No phone';
  const username = getDisplayName?.() || 'User';

  const avatarSource = user?.avatar_url
    ? { uri: user.avatar_url }
    : require('../../assets/images/avatar_placeholder.png');

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleSignup = () => {
    setShowSignupModal(true);
  };

  const handleGoBack = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    } else if (navigation?.navigate) {
      navigation.navigate('index');
    }
  };

  const switchToSignup = () => {
    setShowLoginModal(false);
    setTimeout(() => setShowSignupModal(true), 300);
  };

  const switchToLogin = () => {
    setShowSignupModal(false);
    setTimeout(() => setShowLoginModal(true), 300);
  };

  const handleAccountSwitch = async (accountId: string) => {
    if (!currentAccount || accountId === currentAccount.id) {
      return;
    }

    try {
      await switchAccount?.(accountId);
      const switchedAccount = accounts.find(acc => acc.id === accountId);
      if (switchedAccount) {
        Toast.show({
          type: 'success',
          text1: 'Account switched!',
          text2: `Now using ${switchedAccount.display_name}`,
        });
      }
    } catch (error: any) {
      console.error('Switch account error:', error);
      Alert.alert('Error', error.message || 'Failed to switch accounts');
    }
  };

  const handleAccountRemove = async (accountId: string, accountEmail: string) => {
    if (currentAccount && accountId === currentAccount.id) {
      Alert.alert('Error', 'Cannot remove the currently active account');
      return;
    }

    Alert.alert(
      'Remove Account',
      `Remove ${accountEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount?.(accountId);
              Toast.show({
                type: 'success',
                text1: 'Account removed',
                text2: `${accountEmail} has been removed`,
              });
            } catch (error: any) {
              console.error('Remove account error:', error);
              Alert.alert('Error', error.message || 'Failed to remove account');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header - Fixed positioning with proper spacing */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.username}>{username}</Text>
          <Feather name="chevron-down" size={20} color="#fff" />
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="refresh-cw" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="plus-square" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="menu" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image source={avatarSource} style={styles.avatar} />
            <TouchableOpacity style={styles.addAvatarButton}>
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              {/* ✅ Fixed: Safe access to accounts.length */}
              <Text style={styles.statNumber}>{accounts.length}</Text>
              <Text style={styles.statLabel}>accounts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>6</Text>
              <Text style={styles.statLabel}>businesses</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>19</Text>
              <Text style={styles.statLabel}>active</Text>
            </View>
          </View>
        </View>

        {/* Current Account Info */}
        <View style={styles.currentAccountSection}>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.bio}>平凡を観察し、見えざるものを築く者。</Text>
          
          <View style={styles.contactInfo}>
            <Text style={styles.phoneNumber}>{userPhone}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreButton}>
            <Feather name="user-plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Account Management Section - Simple Display */}
        <View style={styles.accountsSection}>
          <View style={styles.sectionHeader}>
            {/* ✅ Fixed: Safe access to accounts.length */}
            <Text style={styles.sectionTitle}>SWITCH ACCOUNT ({accounts.length}/3)</Text>
          </View>

          {/* ✅ Fixed: Safe rendering of accounts */}
          {accounts.length > 0 && accounts.map((account) => {
            const isCurrentAccount = currentAccount?.id === account.id;
            const accountAvatar = account.avatar_url
              ? { uri: account.avatar_url }
              : require('../../assets/images/avatar_placeholder.png');

            return (
              <View key={account.id} style={styles.simpleAccountCard}>
                <TouchableOpacity
                  style={[
                    styles.simpleAccountContent,
                    isCurrentAccount && styles.currentAccountCard
                  ]}
                  onPress={() => handleAccountSwitch(account.id)}
                  activeOpacity={0.8}
                >
                  <Image source={accountAvatar} style={styles.simpleAccountAvatar} />
                  <View style={styles.simpleAccountInfo}>
                    <Text style={[
                      styles.simpleAccountName,
                      isCurrentAccount && styles.currentAccountName
                    ]}>
                      {account.display_name || 'Unknown Account'}
                    </Text>
                    <Text style={[
                      styles.simpleAccountEmail,
                      isCurrentAccount && styles.currentAccountEmail
                    ]}>
                      {account.email || 'No email'}
                    </Text>
                    {isCurrentAccount && (
                      <Text style={styles.currentLabel}>Current</Text>
                    )}
                  </View>
                  {isCurrentAccount && (
                    <View style={styles.checkmarkContainer}>
                      <Feather name="check-circle" size={20} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                
                {/* Remove button for non-current accounts */}
                {!isCurrentAccount && accounts.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleAccountRemove(account.id, account.email || 'Unknown')}
                  >
                    <Feather name="x" size={16} color="#ff5555" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Add Account Section */}
        {/* ✅ Fixed: Safe access to accounts.length */}
        {accounts.length < 3 && (
          <View style={styles.addAccountSection}>
            <Text style={styles.addAccountTitle}>Add account</Text>
            
            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>Log into existing account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleSignup}>
              <Text style={styles.secondaryButtonText}>Create new account</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Login Modal */}
      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToSignup={switchToSignup}
      />

      {/* Signup Modal */}
      <SignupModal
        visible={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSwitchToLogin={switchToLogin}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 24,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  addAvatarButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1a1a2e',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  currentAccountSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  displayName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  bio: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  contactInfo: {
    marginTop: 4,
  },
  phoneNumber: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  moreButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountsSection: {
    paddingBottom: 24,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  simpleAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  simpleAccountContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  currentAccountCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: 'rgba(124, 58, 237, 0.6)',
  },
  simpleAccountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  simpleAccountInfo: {
    flex: 1,
  },
  simpleAccountName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  currentAccountName: {
    color: '#bd93f9',
  },
  simpleAccountEmail: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  currentAccountEmail: {
    color: 'rgba(189, 147, 249, 0.8)',
  },
  currentLabel: {
    color: '#bd93f9',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  checkmarkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#bd93f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 85, 85, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 85, 85, 0.3)',
  },
  addAccountSection: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginHorizontal: 12,
    borderRadius: 16,
    marginBottom: 40,
  },
  addAccountTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
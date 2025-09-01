// screens/Business.tsx
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import colors from '../../theme/colors';
import LoginModal from '../../components/LoginModal';
import SignupModal from '../../components/SignupModal';

interface BusinessProps {
  navigation: any;
}

export default function Business({ navigation }: BusinessProps) {
  const { 
    user, 
    savedAccounts,
    currentAccountIndex,
    getBusinessDisplayName, 
    getUserPhone,
    getDisplayName,
  } = useUser();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const displayName = getBusinessDisplayName();
  const userPhone = getUserPhone();
  const username = getDisplayName(); // Use this instead of hardcoded "winx3s"

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
    navigation.goBack();
  };

  const switchToSignup = () => {
    setShowLoginModal(false);
    setTimeout(() => setShowSignupModal(true), 300);
  };

  const switchToLogin = () => {
    setShowSignupModal(false);
    setTimeout(() => setShowLoginModal(true), 300);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header - Fixed positioning */}
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
              <Text style={styles.statNumber}>{savedAccounts.length}</Text>
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

        {/* Account Management Section */}
        <View style={styles.accountsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Management</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {/* Current Accounts */}
          {savedAccounts.slice(0, 2).map((account, index) => (
            <View key={account.id} style={styles.accountCard}>
              <Image 
                source={account.avatar_url ? { uri: account.avatar_url } : avatarSource} 
                style={styles.accountAvatar} 
              />
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.display_name}</Text>
                <Text style={styles.accountType}>
                  {index === currentAccountIndex ? 'Current account' : 'Suggested for you'}
                </Text>
              </View>
              <TouchableOpacity style={styles.followButton}>
                <Text style={styles.followButtonText}>
                  {index === currentAccountIndex ? 'Active' : 'Switch'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Add Account Section */}
        <View style={styles.addAccountSection}>
          <Text style={styles.addAccountTitle}>Add account</Text>
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Log into existing account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleSignup}>
            <Text style={styles.secondaryButtonText}>Create new account</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 16, // Added padding to push header down from status bar
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
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  seeAll: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountType: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addAccountSection: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginHorizontal: 12,
    borderRadius: 16,
    marginBottom: 40, // Added bottom margin since we removed bottom nav
  },
  addAccountTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#1877f2',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1877f2',
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
// app/(drawer)/Business.tsx - Enhanced with business management features
import React, { useState, Suspense } from 'react';
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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import { useUser } from '../../context/UserContext';
import colors from '../../theme/colors';
import LoginModal from '../../components/LoginModal';
import SignupModal from '../../components/SignupModal';
import { createInvite } from '../../lib/helpers/business';

// Lazy load business modals
const BusinessModal = React.lazy(() => import('../../components/BusinessModal'));
const JoinBusinessModal = React.lazy(() => import('../../components/JoinBusinessModal'));

interface BusinessProps {
  navigation: any;
}

export default function Business({ navigation }: BusinessProps) {
  const { 
    user, 
    accounts = [],
    businesses,
    currentAccount,
    getBusinessDisplayName, 
    getUserPhone,
    getDisplayName,
    switchAccount,
    removeAccount,
    refreshBusinesses,
  } = useUser();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [currentBusinessIndex, setCurrentBusinessIndex] = useState(0);
  const [inviteLink, setInviteLink] = useState(null);
  const [showAddBusinessOptions, setShowAddBusinessOptions] = useState(false);

  const displayName = getBusinessDisplayName();
  const userPhone = getUserPhone();
  const username = getDisplayName();

  const avatarSource = user?.avatar_url
    ? { uri: user.avatar_url }
    : require('../../assets/images/avatar_placeholder.png');

  const currentBusiness = businesses.owned[currentBusinessIndex] || businesses.owned[0];

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

  // Business dropdown selection
  const handleBusinessSelect = (businessIndex: number) => {
    setCurrentBusinessIndex(businessIndex);
    setShowBusinessDropdown(false);
    Toast.show({
      type: 'info',
      text1: 'Business selected',
      text2: businesses.owned[businessIndex]?.name,
    });
  };

  // Share business functionality
  const handleShareBusiness = () => {
    if (currentBusiness) {
      setSelectedBusiness(currentBusiness);
    } else {
      Toast.show({
        type: 'warning',
        text1: 'No business selected',
        text2: 'Please select a business first',
      });
    }
  };

  // Generate invite link
  const generateInviteLink = async () => {
    if (!selectedBusiness) return;

    try {
      const result = await createInvite(selectedBusiness.id);
      setInviteLink(result?.code || 'No code generated');
      Toast.show({
        type: 'success',
        text1: 'Invite link generated',
        text2: 'Copy and share with your team',
      });
    } catch (error) {
      console.error('Error creating invite:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to create invite',
        text2: 'Please try again',
      });
    }
  };

  // Copy invite link
  const copyInviteLink = () => {
    if (inviteLink) {
      Clipboard.setStringAsync(inviteLink);
      Toast.show({
        type: 'success',
        text1: 'Copied to clipboard!',
        text2: 'Share this invite code',
      });
    }
  };

  // Handle creating new business
  const handleCreateBusiness = () => {
    setShowAddBusinessOptions(false);
    setShowBusinessModal(true);
  };

  // Handle joining business
  const handleJoinBusiness = () => {
    setShowAddBusinessOptions(false);
    setShowJoinModal(true);
  };

  // Handle business modal close with refresh
  const handleBusinessModalClose = async () => {
    setShowBusinessModal(false);
    try {
      await refreshBusinesses?.(true); // Force refresh after creating business
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };

  // Handle join modal close with refresh
  const handleJoinModalClose = async () => {
    setShowJoinModal(false);
    try {
      await refreshBusinesses?.(true); // Force refresh after joining business
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
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
              <Text style={styles.statNumber}>{accounts.length}</Text>
              <Text style={styles.statLabel}>accounts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{businesses.owned.length}</Text>
              <Text style={styles.statLabel}>businesses</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{businesses.joined.length}</Text>
              <Text style={styles.statLabel}>joined</Text>
            </View>
          </View>
        </View>

        {/* Current Business Info with Dropdown */}
        <View style={styles.currentBusinessSection}>
          {businesses.owned.length > 0 ? (
            <TouchableOpacity 
              style={styles.businessDropdownButton}
              onPress={() => setShowBusinessDropdown(true)}
            >
              <Text style={styles.businessName}>{currentBusiness?.name || 'Select Business'}</Text>
              <Feather name="chevron-down" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.businessName}>No businesses owned</Text>
          )}
          
          <Text style={styles.bio}>平凡を観察し、見えざるものを築く者。</Text>
          
          <View style={styles.contactInfo}>
            <Text style={styles.phoneNumber}>{userPhone}</Text>
          </View>
        </View>

        {/* Business Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.editButton}
            disabled={!currentBusiness}
            onPress={() => {
              // Navigate to edit business screen
              Toast.show({
                type: 'info',
                text1: 'Edit Business',
                text2: 'Feature coming soon',
              });
            }}
          >
            <Text style={styles.editButtonText}>Edit Business</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.shareButton}
            disabled={!currentBusiness}
            onPress={handleShareBusiness}
          >
            <Text style={styles.shareButtonText}>Share Business</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => setShowAddBusinessOptions(true)}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Add Business Button */}
        <View style={styles.addBusinessSection}>
          <TouchableOpacity 
            style={styles.addBusinessButton}
            onPress={() => setShowAddBusinessOptions(true)}
          >
            <Feather name="briefcase" size={20} color="#7c3aed" />
            <Text style={styles.addBusinessText}>Add Another Business</Text>
            <Feather name="chevron-right" size={20} color="#7c3aed" />
          </TouchableOpacity>
        </View>

        {/* Account Management Section */}
        <View style={styles.accountsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SWITCH ACCOUNT ({accounts.length}/3)</Text>
          </View>

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

      {/* Business Dropdown Modal */}
      {showBusinessDropdown && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowBusinessDropdown(false)}
          >
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownTitle}>Select Business</Text>
              {businesses.owned.map((business, index) => (
                <TouchableOpacity
                  key={business.id}
                  style={[
                    styles.dropdownItem,
                    index === currentBusinessIndex && styles.selectedDropdownItem
                  ]}
                  onPress={() => handleBusinessSelect(index)}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    index === currentBusinessIndex && styles.selectedDropdownItemText
                  ]}>
                    {business.name}
                  </Text>
                  {index === currentBusinessIndex && (
                    <Feather name="check" size={16} color="#7c3aed" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Add Business Options Modal */}
      {showAddBusinessOptions && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowAddBusinessOptions(false)}
          >
            <View style={styles.optionsModal}>
              <Text style={styles.optionsTitle}>Add Business</Text>
              <Text style={styles.optionsSubtitle}>Choose an option</Text>
              
              <TouchableOpacity style={styles.optionButton} onPress={handleCreateBusiness}>
                <Feather name="plus-circle" size={24} color="#7c3aed" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Create New Business</Text>
                  <Text style={styles.optionDescription}>Start a new business and invite team members</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionButton} onPress={handleJoinBusiness}>
                <Feather name="users" size={24} color="#7c3aed" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Join Existing Business</Text>
                  <Text style={styles.optionDescription}>Join a business using an invite code</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Share Business Modal */}
      {selectedBusiness && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => {
              setSelectedBusiness(null);
              setInviteLink(null);
            }}
          >
            <View style={styles.inviteModal}>
              <Text style={styles.modalText}>
                Share "{selectedBusiness.name}"
              </Text>

              {!inviteLink ? (
                <TouchableOpacity style={styles.generateButton} onPress={generateInviteLink}>
                  <Text style={styles.generateButtonText}>Generate Invite Link</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.inviteLinkContainer}>
                  <Text style={styles.inviteCode}>{inviteLink}</Text>
                  <TouchableOpacity style={styles.copyButton} onPress={copyInviteLink}>
                    <Feather name="copy" size={16} color="#fff" />
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setSelectedBusiness(null);
                  setInviteLink(null);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Lazy loaded modals */}
      <Suspense fallback={<View />}>
        {showBusinessModal && (
          <BusinessModal
            visible={showBusinessModal}
            onClose={handleBusinessModalClose}
            onCreate={handleBusinessModalClose}
          />
        )}

        {showJoinModal && (
          <JoinBusinessModal
            visible={showJoinModal}
            onClose={handleJoinModalClose}
            onJoin={handleJoinModalClose}
          />
        )}
      </Suspense>

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
  currentBusinessSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  businessDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    marginBottom: 8,
  },
  businessName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  addBusinessSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  addBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  addBusinessText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 32,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    maxWidth: 300,
    width: '80%',
  },
  dropdownTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedDropdownItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
  },
  selectedDropdownItemText: {
    color: '#bd93f9',
    fontWeight: '600',
  },
  optionsModal: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 32,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  optionsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  optionsSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    marginBottom: 16,
  },
  optionContent: {
    flex: 1,
    marginLeft: 16,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  inviteModal: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 32,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    alignItems: 'center',
  },
  modalText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  generateButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteLinkContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteCode: {
    color: '#bd93f9',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  closeButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});
// app/(support)/account.tsx - Updated Support Account Screen
import React, { useState, useCallback, useEffect, Suspense } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Avatar } from 'react-native-paper';

import { useUser } from '../../context/UserContext';
import { SupportBottomTabs } from '../../components/support/SupportBottomTabs';
import { accountManager, AccountData } from '../../lib/AccountManager';
import { getFullAvatarUrl } from '../../lib/api';
import { uploadAvatar } from '../../lib/helpers/uploadAvatar';
import AccountManagementModal from '../../components/AccountManagementModal';

// Lazy load components
const AvatarPreviewModal = React.lazy(() => import('../../components/AvatarPreviewModal'));
const LoaderOverlay = React.lazy(() => import('../../components/LoaderOverlay'));

// Safe Avatar Component
interface SafeAvatarProps {
  size: number;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
  onPress?: () => void;
  updateTrigger?: number;
}

const SafeAvatar: React.FC<SafeAvatarProps> = ({ 
  size, 
  avatarUrl, 
  fallbackSource = require('../../assets/images/avatar_placeholder.png'),
  style,
  onPress,
  updateTrigger = 0
}) => {
  const [hasError, setHasError] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  useEffect(() => {
    setHasError(false);
    setImageKey(Date.now());
  }, [avatarUrl, updateTrigger]);
  
  if (!fullAvatarUrl || hasError) {
    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Avatar.Image
          size={size}
          source={fallbackSource}
          style={style}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <Avatar.Image
        size={size}
        source={{ 
          uri: `${fullAvatarUrl}?v=${imageKey}&t=${updateTrigger}`,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }}
        style={style}
        onError={(error) => {
          console.warn('Support Avatar failed to load:', error);
          setHasError(true);
        }}
      />
    </TouchableOpacity>
  );
};

const showToast = {
  success: (text1: string, text2?: string) => {
    Toast.show({
      type: 'success',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 2500,
    });
  },
  
  error: (text1: string, text2?: string) => {
    Toast.show({
      type: 'error',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 4000,
    });
  },
  
  info: (text1: string, text2?: string) => {
    Toast.show({
      type: 'info',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 3000,
    });
  },
};

export default function SupportAccountScreen() {
  const { 
    user, 
    logout, 
    refreshUser, 
    clearUserCache,
    avatarUpdateTrigger,
    triggerAvatarRefresh 
  } = useUser();
  
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  
  // Account switching state
  const [allAccounts, setAllAccounts] = useState<AccountData[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  
  // Modal state
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const accounts = accountManager.getAllAccounts();
      const currentId = accountManager.getCurrentUserId();
      
      console.log('📱 Support: Loading accounts:', {
        count: accounts.length,
        currentId,
        accounts: accounts.map(a => ({ email: a.email, role: a.role }))
      });
      
      setAllAccounts(accounts);
      setCurrentAccountId(currentId);
    } catch (error) {
      console.error('📱 Support: Failed to load accounts:', error);
    }
  }, []);

  // Clear conversation storage on logout
  const clearConversationStorage = useCallback(async () => {
    try {
      console.log('🗑️ Support: Clearing conversation storage...');
      const keys = await AsyncStorage.getAllKeys();
      const conversationKeys = keys.filter(key => 
        key.startsWith('conversation_') || 
        key.startsWith('chat_') ||
        key.includes('message')
      );
      
      if (conversationKeys.length > 0) {
        await AsyncStorage.multiRemove(conversationKeys);
        console.log('🗑️ Support: Cleared conversation keys:', conversationKeys);
      }
    } catch (error) {
      console.error('🗑️ Support: Failed to clear conversation storage:', error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🎭 Support: Logging out...');
      
      await clearConversationStorage();
      await logout();
      
      showToast.info('Logged out successfully');
      setShowLogoutModal(false);
      
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Support Logout error:', error);
      showToast.error('Logout failed');
    } finally {
      setLoading(false);
    }
  }, [logout, clearConversationStorage]);

  // Avatar picker
  const pickAndPreviewAvatar = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast.error('Photo access denied');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;
      
      const asset = result.assets[0];
      console.log('🎭 Support: Selected image:', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize
      });
      
      setPreviewUri(asset.uri);
    } catch (error) {
      console.error('🎭 Support: Error picking avatar:', error);
      showToast.error('Failed to select image');
    }
  }, []);

  // Confirm avatar upload
  const confirmUploadAvatar = useCallback(async () => {
    try {
      if (!previewUri) return;

      setLoading(true);
      console.log('🎭 Support: Starting avatar upload...');
      
      const result = await uploadAvatar(previewUri);
      console.log('🎭 Support: Upload result:', result);
      
      if (result?.avatar_url || result?.success) {
        console.log('🎭 Support: Avatar uploaded successfully');
        
        await clearUserCache();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await refreshUser(true);
        triggerAvatarRefresh();
        await new Promise(resolve => setTimeout(resolve, 500));
        await refreshUser(true);
        
        showToast.success('Avatar updated!');
      } else {
        throw new Error('Upload successful but no avatar URL returned');
      }
      
    } catch (error: any) {
      console.error('🎭 Support: Error during avatar upload:', error);
      showToast.error('Upload failed', error.message || 'Please try again');
    } finally {
      setPreviewUri(null);
      setLoading(false);
    }
  }, [previewUri, refreshUser, clearUserCache, triggerAvatarRefresh]);

  // Switch account and restart app
  const switchAccount = useCallback(async (accountId: string) => {
    try {
      if (accountId === currentAccountId) {
        showToast.info('Already on this account');
        return;
      }

      setLoading(true);
      console.log('🔄 Support: Switching to account:', accountId);
      
      await accountManager.setCurrentAccount(accountId);
      
      showToast.success('Switching account...', 'App will restart');
      
      setTimeout(async () => {
        try {
          await Updates.reloadAsync();
        } catch (error) {
          console.error('Failed to reload app:', error);
          showToast.error('Please restart the app manually');
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to switch account:', error);
      showToast.error('Failed to switch account');
      setLoading(false);
    }
  }, [currentAccountId]);

  // Add new account - show modal instead of redirecting
  const addNewAccount = useCallback(() => {
    if (allAccounts.length >= 3) {
      showToast.error('Maximum 3 accounts allowed');
      return;
    }
    
    showToast.info('Opening account manager...');
    setShowAccountModal(true);
  }, [allAccounts]);

  const menuItems = [
    {
      id: 'profile',
      title: 'Profile Settings',
      subtitle: 'Update your information',
      icon: 'user',
      onPress: () => {
        // Navigate to profile edit
      },
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Manage notification preferences',
      icon: 'bell',
      onPress: () => {
        // Navigate to notifications settings
      },
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      subtitle: 'Password and privacy settings',
      icon: 'shield',
      onPress: () => {
        // Navigate to security settings
      },
    },
    {
      id: 'help',
      title: 'Help & Support',
      subtitle: 'Get help with GLT Support',
      icon: 'help-circle',
      onPress: () => {
        // Navigate to help
      },
    },
    {
      id: 'about',
      title: 'About',
      subtitle: 'App version and information',
      icon: 'info',
      onPress: () => {
        // Show about dialog
      },
    },
  ];

  const isSupport = user?.primary_role === 'support' || user?.roles?.includes('support');

  return (
    <SafeAreaView style={styles.container}>
      <Suspense fallback={<View />}>
        {loading && <LoaderOverlay visible={true} />}

        {previewUri && (
          <AvatarPreviewModal
            visible
            uri={previewUri}
            onCancel={() => setPreviewUri(null)}
            onConfirm={confirmUploadAvatar}
          />
        )}
      </Suspense>

      {/* Account Management Modal */}
      <AccountManagementModal
        visible={showAccountModal}
        onClose={async () => {
          setShowAccountModal(false);
          // Reload accounts after modal closes
          await loadAccounts();
          // Refresh user data
          await refreshUser(true);
        }}
      />

      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Account</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Feather name="more-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <SafeAvatar
            size={64}
            avatarUrl={user?.avatar_url}
            fallbackSource={require('../../assets/images/avatar_placeholder.png')}
            onPress={pickAndPreviewAvatar}
            updateTrigger={avatarUpdateTrigger}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.display_name || user?.first_name || 'Support Agent'}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profileRole}>GLT Support Agent</Text>
          </View>
          <TouchableOpacity style={styles.profileEditButton} onPress={pickAndPreviewAvatar}>
            <Feather name="edit-2" size={20} color="#7B3F98" />
          </TouchableOpacity>
        </View>

        {/* Accounts Section - Only for Support */}
        {isSupport && allAccounts.length > 0 && (
          <View style={styles.accountsSection}>
            <View style={styles.accountsHeader}>
              <Text style={styles.sectionTitle}>My Accounts ({allAccounts.length}/3)</Text>
              {allAccounts.length < 3 && (
                <TouchableOpacity onPress={addNewAccount}>
                  <MaterialCommunityIcons name="plus-circle" size={24} color="#7B3F98" />
                </TouchableOpacity>
              )}
            </View>
            
            {allAccounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={styles.accountItem}
                onPress={() => switchAccount(account.id)}
              >
                <SafeAvatar
                  size={40}
                  avatarUrl={account.avatar_url}
                  fallbackSource={require('../../assets/images/avatar_placeholder.png')}
                />
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.display_name}</Text>
                  <Text style={styles.accountEmail}>{account.email}</Text>
                  <Text style={styles.accountRole}>{account.role}</Text>
                </View>
                {account.id === currentAccountId && (
                  <View style={styles.activeIndicator}>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuIcon}>
                <Feather name={item.icon as any} size={20} color="#7B3F98" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#8E8E93" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={() => setShowLogoutModal(true)}
            disabled={loading}
          >
            <Feather name="log-out" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>
              {loading ? 'Logging out...' : 'Logout'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Version Info */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>GLT Support v1.0.0</Text>
          <Text style={styles.buildText}>Build 2024.09.27</Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="logout" size={32} color="#ef4444" />
              <Text style={styles.modalTitle}>Confirm Logout</Text>
            </View>
            
            <Text style={styles.modalText}>
              Are you sure you want to logout from GLT Support?
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleLogout}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>
                  {loading ? 'Logging out...' : 'Logout'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SupportBottomTabs currentTab="account" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#B8B8B8',
    fontSize: 14,
    marginBottom: 2,
  },
  profileRole: {
    color: '#7B3F98',
    fontSize: 12,
    fontWeight: '500',
  },
  profileEditButton: {
    padding: 8,
  },
  accountsSection: {
    backgroundColor: '#1F2C34',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  accountsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountEmail: {
    color: '#B8B8B8',
    fontSize: 14,
    marginTop: 2,
  },
  accountRole: {
    color: '#7B3F98',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  activeIndicator: {
    marginLeft: 8,
  },
  menuSection: {
    backgroundColor: '#1F2C34',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuSubtitle: {
    color: '#8E8E93',
    fontSize: 14,
  },
  logoutSection: {
    margin: 16,
    marginTop: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  buildText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1F2C34',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(123, 63, 152, 0.3)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  modalText: {
    color: '#B8B8B8',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
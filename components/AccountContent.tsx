// components/AccountContent.tsx - Updated with Account Switching
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import { Avatar, Button, Dialog, Portal } from 'react-native-paper';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import * as Updates from 'expo-updates';

const AvatarPreviewModal = React.lazy(() => import('./AvatarPreviewModal'));
const LoaderOverlay = React.lazy(() => import('./LoaderOverlay'));

import { useUser } from '../context/UserContext';
import api from '../lib/api';
import { 
  getFullAvatarUrl, 
  getCurrentApiBaseUrl,
  getBaseDomain
} from '../lib/api';
import { uploadAvatar } from '../lib/helpers/uploadAvatar';
import { CHANGELOG_VERSION } from './ChangelogModal';
import { useStackNavigation, useAppNavigation } from '../lib/hooks/useStackNavigation';
import { accountManager, AccountData } from '../lib/AccountManager';
import AccountManagementModal from './AccountManagementModal';

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
  fallbackSource = require('../assets/images/avatar_placeholder.png'),
  style,
  onPress,
  updateTrigger = 0
}) => {
  const [hasError, setHasError] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  useEffect(() => {
    console.log('🎭 AccountContent SafeAvatar: Update triggered', {
      avatarUrl,
      updateTrigger,
      timestamp: Date.now()
    });
    
    setHasError(false);
    setImageKey(Date.now());
  }, [avatarUrl, updateTrigger]);
  
  useEffect(() => {
    if (avatarUrl) {
      console.log('🎭 AccountContent Avatar Debug:', {
        raw: avatarUrl,
        full: fullAvatarUrl,
        hasError,
        imageKey,
        updateTrigger,
        apiBaseUrl: getCurrentApiBaseUrl(),
        baseDomain: getBaseDomain()
      });
    }
  }, [avatarUrl, fullAvatarUrl, hasError, imageKey, updateTrigger]);
  
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
          console.warn('🎭 AccountContent Avatar failed to load:', {
            url: fullAvatarUrl,
            error: error
          });
          setHasError(true);
        }}
      />
    </TouchableOpacity>
  );
};

interface AccountContentProps {
  source: 'admin' | 'drawer' | 'stack';
  onBack: () => void;
  title?: string;
}

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
  
  warning: (text1: string, text2?: string) => {
    Toast.show({
      type: 'warning',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 3500,
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

export default function AccountContent({ source, onBack, title = 'Account' }: AccountContentProps) {
  const { replace, push } = useStackNavigation();
  const navigation = useAppNavigation();

  const [isScreenReady, setIsScreenReady] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const { 
    user, 
    refreshUser, 
    clearUserCache,
    loading: userLoading, 
    error: userError,
    logout,
    getDisplayName,
    avatarUpdateTrigger,
    triggerAvatarRefresh,
  } = useUser();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Account switching state
  const [allAccounts, setAllAccounts] = useState<AccountData[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [showAccountSwitch, setShowAccountSwitch] = useState(false);
  
  // Modal state
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    if (user?.avatar_url) {
      const fullUrl = getFullAvatarUrl(user.avatar_url);
      console.log('🎭 AccountContent User Avatar Debug:', {
        userId: user.id,
        rawAvatarUrl: user.avatar_url,
        fullAvatarUrl: fullUrl,
        updateTrigger: avatarUpdateTrigger,
        apiBaseUrl: getCurrentApiBaseUrl(),
        baseDomain: getBaseDomain()
      });
    }
  }, [user?.avatar_url, user?.id, avatarUpdateTrigger]);

  useEffect(() => {
    let isMounted = true;
    
    async function initializeScreen() {
      try {
        console.log(`🎭 AccountContent (${source}): Initializing...`);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (isMounted) {
          console.log(`🎭 AccountContent (${source}): Ready`);
          setIsScreenReady(true);
          
          // Load all accounts
          await loadAccounts();
          
          if (source === 'admin') {
            setTimeout(async () => {
              try {
                await SplashScreen.hideAsync();
              } catch (e) {
                console.log('Splash screen already hidden or unavailable');
              }
            }, 100);
          }
        }
        
      } catch (error) {
        console.error(`🎭 AccountContent (${source}) initialization error:`, error);
        if (isMounted) {
          setScreenError(error.message || 'Initialization failed');
          setIsScreenReady(true);
        }
      }
    }

    initializeScreen();
    
    return () => {
      isMounted = false;
    };
  }, [source]);

  // Load all accounts from AccountManager
  const loadAccounts = useCallback(async () => {
    try {
      const accounts = accountManager.getAllAccounts();
      const currentId = accountManager.getCurrentUserId();
      
      console.log('📱 Loading accounts:', {
        count: accounts.length,
        currentId,
        accounts: accounts.map(a => ({ email: a.email, role: a.role }))
      });
      
      setAllAccounts(accounts);
      setCurrentAccountId(currentId);
    } catch (error) {
      console.error('📱 Failed to load accounts:', error);
    }
  }, []);

  const navigateToLogin = useCallback(async () => {
    try {
      console.log('📱 AccountContent: Navigating to login...');
      replace('/login');
    } catch (error) {
      console.error('📱 AccountContent: Failed to navigate to login:', error);
    }
  }, [replace]);

  const navigateToEditPage = useCallback(async (page: string) => {
    try {
      console.log(`📱 AccountContent: Navigating to ${page}...`);
      push(page);
    } catch (error) {
      console.error(`📱 AccountContent: Failed to navigate to ${page}:`, error);
    }
  }, [push]);

  useEffect(() => {
    let isMounted = true;
    
    async function validateUserData() {
      if (!isScreenReady || isRedirecting) return;

      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!isMounted) return;

        if (!userLoading && !user) {
          console.log('🎭 AccountContent: No user data in context, redirecting to login');
          setIsRedirecting(true);
          showToast.error('User session invalid', 'Please log in again');
          navigateToLogin();
          return;
        }

        if (user) {
          console.log(`🎭 AccountContent: User data validated for ${source} screen:`, {
            id: user.id,
            email: user.email,
            hasDisplayName: !!user.display_name,
            hasFirstName: !!user.first_name,
            avatarUrl: user.avatar_url
          });
        }

      } catch (error) {
        console.error('🎭 AccountContent: Error validating user data:', error);
        if (isMounted && !user) {
          setIsRedirecting(true);
          showToast.error('Authentication error', 'Please log in again');
          navigateToLogin();
        }
      }
    }

    validateUserData();
    
    return () => {
      isMounted = false;
    };
  }, [isScreenReady, user, userLoading, source, isRedirecting, navigateToLogin]);

  const onRefresh = useCallback(async () => {
    try {
      if (!user) {
        showToast.warning('Please log in first');
        return;
      }

      setRefreshing(true);
      console.log('🎭 AccountContent: Manual refresh triggered - clearing cache and fetching fresh data');
      
      await clearUserCache();
      await refreshUser(true);
      await loadAccounts(); // Reload accounts
      
      triggerAvatarRefresh();
      
      showToast.success('Data refreshed');
    } catch (error) {
      console.error('🎭 AccountContent: Refresh error:', error);
      showToast.error('Failed to refresh data', 'Please check your connection');
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, clearUserCache, triggerAvatarRefresh, user, loadAccounts]);

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
      console.log('🎭 AccountContent: Selected image:', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize
      });
      
      setPreviewUri(asset.uri);
    } catch (error) {
      console.error('🎭 AccountContent: Error picking avatar:', error);
      showToast.error('Failed to select image');
    }
  }, []);

  const confirmUploadAvatar = useCallback(async () => {
    try {
      if (!previewUri) return;

      setLoading(true);
      console.log('🎭 AccountContent: Starting comprehensive avatar upload and sync process...');
      
      const result = await uploadAvatar(previewUri);
      console.log('🎭 AccountContent: Upload result:', result);
      
      if (result?.avatar_url || result?.success) {
        console.log('🎭 AccountContent: Avatar uploaded successfully, starting comprehensive sync...');
        
        console.log('🎭 AccountContent: Clearing all caches...');
        await clearUserCache();
        
        console.log('🎭 AccountContent: Waiting for server processing...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🎭 AccountContent: Force refreshing user data...');
        await refreshUser(true);
        
        console.log('🎭 AccountContent: Triggering comprehensive avatar refresh...');
        triggerAvatarRefresh();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🎭 AccountContent: Final sync refresh...');
        await refreshUser(true);
        
        showToast.success('Avatar updated!');
        console.log('🎭 AccountContent: Avatar upload and comprehensive sync completed');
      } else {
        throw new Error('Upload successful but no avatar URL returned');
      }
      
    } catch (error: any) {
      console.error('🎭 AccountContent: Error during avatar upload:', error);
      showToast.error('Upload failed', error.message || 'Please try again');
    } finally {
      setPreviewUri(null);
      setLoading(false);
    }
  }, [previewUri, refreshUser, clearUserCache, triggerAvatarRefresh]);

  // Clear conversation storage on logout
  const clearConversationStorage = useCallback(async () => {
    try {
      console.log('🗑️ Clearing conversation storage...');
      const keys = await AsyncStorage.getAllKeys();
      const conversationKeys = keys.filter(key => 
        key.startsWith('conversation_') || 
        key.startsWith('chat_') ||
        key.includes('message')
      );
      
      if (conversationKeys.length > 0) {
        await AsyncStorage.multiRemove(conversationKeys);
        console.log('🗑️ Cleared conversation keys:', conversationKeys);
      }
    } catch (error) {
      console.error('🗑️ Failed to clear conversation storage:', error);
    }
  }, []);

  const confirmLogout = useCallback(async () => {
    try {
      console.log('🎭 AccountContent: Logging out through UserContext...');
      
      await clearConversationStorage();
      await logout();
      
      showToast.info('Logged out successfully');
      setShowLogoutConfirm(false);
      
      navigateToLogin();
      
    } catch (error) {
      console.error('🎭 AccountContent: Logout error:', error);
      showToast.error('Logout failed');
    }
  }, [logout, navigateToLogin, clearConversationStorage]);

  // Switch to different account and restart app
  const switchAccount = useCallback(async (accountId: string) => {
    try {
      if (accountId === currentAccountId) {
        showToast.info('Already on this account');
        setShowAccountSwitch(false);
        return;
      }

      setLoading(true);
      console.log('🔄 Switching to account:', accountId);
      
      await accountManager.setCurrentAccount(accountId);
      
      showToast.success('Switching account...', 'App will restart');
      setShowAccountSwitch(false);
      
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

  if (!isScreenReady || isRedirecting) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
            {isRedirecting ? 'Redirecting to login...' : `Loading ${title}...`}
          </Text>
          <Text style={styles.sourceText}>Context: {source}</Text>
        </LinearGradient>
      </View>
    );
  }

  if (screenError || userError) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </LinearGradient>
        
        <View style={styles.errorContainer}>
          <Text style={styles.error}>
            {screenError || userError || 'Failed to load account data'}
          </Text>
          <Button mode="outlined" onPress={() => {
            try {
              setScreenError(null);
              onRefresh();
            } catch (error) {
              console.error('Error retrying:', error);
            }
          }}>
            Retry
          </Button>
          <Button 
            mode="contained" 
            onPress={navigateToLogin}
            style={{ marginTop: 10, backgroundColor: '#764ba2' }}
          >
            Go to Login
          </Button>
        </View>
      </View>
    );
  }

  if (userLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading user data...</Text>
          <Text style={styles.sourceText}>Context: {source}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          
          console.log('📱 Account modal closed - checking for new accounts...');
          
          // Small delay to ensure account is saved
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Reload accounts
          await loadAccounts();
          
          // Check if we need to restart (new account was added)
          const updatedAccounts = accountManager.getAllAccounts();
          const newCurrentId = accountManager.getCurrentUserId();
          
          console.log('📱 Accounts after modal:', {
            count: updatedAccounts.length,
            previousCurrent: currentAccountId,
            newCurrent: newCurrentId,
            needsRestart: currentAccountId !== newCurrentId
          });
          
          // If current account changed, trigger restart
          if (currentAccountId !== newCurrentId && newCurrentId) {
            console.log('🔄 New account detected - triggering app restart...');
            showToast.success('Account added!', 'Restarting app...');
            
            // Trigger restart after short delay
            setTimeout(() => {
              Updates.reloadAsync().catch((error) => {
                console.error('Failed to reload app:', error);
                showToast.error('Please restart the app manually');
              });
            }, 1500);
          } else {
            // Just refresh if no new account
            await refreshUser(true);
          }
        }}
      />

      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={onBack}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#764ba2']}
            tintColor="#764ba2"
          />
        }
      >
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View>
              <Text style={styles.userName}>{getDisplayName()}</Text>
              <Text style={styles.accountType}>Glt Account</Text>
              <Text style={styles.version}>v{CHANGELOG_VERSION}</Text>
            </View>
            <SafeAvatar
              size={60}
              avatarUrl={user?.avatar_url}
              fallbackSource={require('../assets/images/avatar_placeholder.png')}
              onPress={pickAndPreviewAvatar}
              updateTrigger={avatarUpdateTrigger}
            />
          </View>
        </View>

        {/* Accounts Section - Available for ALL users */}
        {allAccounts.length > 0 && (
          <View style={styles.accountsCard}>
            <View style={styles.accountsHeader}>
              <Text style={styles.sectionTitle}>My Accounts ({allAccounts.length}/3)</Text>
              {allAccounts.length < 3 && (
                <TouchableOpacity onPress={addNewAccount}>
                  <MaterialCommunityIcons name="plus-circle" size={24} color="#764ba2" />
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
                  fallbackSource={require('../assets/images/avatar_placeholder.png')}
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

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <TouchableOpacity style={styles.infoRow} onPress={() => navigateToEditPage('/edit-username')}>
            <Text style={styles.infoLabel}>Username</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.username || '—'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => navigateToEditPage('/edit-display-name')}>
            <Text style={styles.infoLabel}>Display Name</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.display_name || user?.first_name || 'LVL0'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => navigateToEditPage('/edit-email')}>
            <Text style={styles.infoLabel}>Email</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.email || 'admin@example.com'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => navigateToEditPage('/edit-phone')}>
            <Text style={styles.infoLabel}>Phone</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.phone || '—'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.logoutCard}>
          <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>
            <MaterialCommunityIcons name="logout" size={22} color="#ff6b6b" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={showLogoutConfirm}
          onDismiss={() => setShowLogoutConfirm(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Confirm Logout</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>Are you sure you want to log out?</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowLogoutConfirm(false)} style={styles.dialogCancel}>
              No
            </Button>
            <Button mode="outlined" onPress={confirmLogout} style={styles.dialogConfirm}>
              Yes
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0f'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  sourceText: {
    color: '#a0aec0',
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#764ba2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'italic',
    textShadowColor: 'rgba(118, 75, 162, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  identityCard: { 
    backgroundColor: '#1a1a2e',
    margin: 16, 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(118, 75, 162, 0.6)',
    shadowColor: '#764ba2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  identityRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  userName: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  accountType: { 
    color: '#888', 
    fontSize: 14, 
    marginTop: 4 
  },
  version: { 
    color: '#999', 
    marginTop: 4 
  },
  accountsCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(118, 75, 162, 0.6)',
    shadowColor: '#764ba2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  accountsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(118, 75, 162, 0.1)',
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
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  accountRole: {
    color: '#764ba2',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  activeIndicator: {
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(118, 75, 162, 0.6)',
    shadowColor: '#764ba2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomColor: 'rgba(118, 75, 162, 0.2)',
    borderBottomWidth: 1,
  },
  infoLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValue: {
    color: '#ccc',
    fontSize: 15,
  },
  logoutCard: { 
    backgroundColor: '#1a1a2e', 
    margin: 16, 
    borderRadius: 16, 
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.6)',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  logoutButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  logoutText: { 
    color: '#ff6b6b', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  dialog: { 
    backgroundColor: '#1a1a2e', 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(118, 75, 162, 0.4)',
  },
  dialogTitle: { 
    color: '#fff', 
    fontWeight: 'bold' 
  },
  dialogText: { 
    color: '#ccc', 
    fontSize: 15 
  },
  dialogActions: { 
    justifyContent: 'space-between', 
    paddingHorizontal: 12 
  },
  dialogCancel: { 
    backgroundColor: '#764ba2', 
    borderRadius: 6, 
    marginRight: 8 
  },
  dialogConfirm: { 
    borderColor: '#ff5555', 
    borderWidth: 1, 
    borderRadius: 6 
  },
  error: { 
    color: '#ff5555', 
    padding: 20, 
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
});
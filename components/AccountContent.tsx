// components/AccountContent.tsx - Fixed avatar upload functionality
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
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

// Lazy load heavy components to prevent blocking
const AvatarPreviewModal = React.lazy(() => import('./AvatarPreviewModal'));
const LoaderOverlay = React.lazy(() => import('./LoaderOverlay'));

import { useUser } from '../context/UserContext';
import api from '../lib/api';

// Import from the updated api.ts file
import { 
  getFullAvatarUrl, 
  getCurrentApiBaseUrl,
  getBaseDomain
} from '../lib/api';

// Import the centralized upload avatar helper
import { uploadAvatar } from '../lib/helpers/uploadAvatar';

// Safe Avatar Component with error handling and updated API functions
interface SafeAvatarProps {
  size: number;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
  onPress?: () => void;
}

const SafeAvatar: React.FC<SafeAvatarProps> = ({ 
  size, 
  avatarUrl, 
  fallbackSource = require('../assets/images/avatar_placeholder.png'),
  style,
  onPress 
}) => {
  const [hasError, setHasError] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now()); // Force reload on avatar change
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  // Reset error state when avatarUrl changes
  useEffect(() => {
    setHasError(false);
    setImageKey(Date.now()); // Force reload
  }, [avatarUrl]);
  
  // Debug avatar URL
  useEffect(() => {
    if (avatarUrl) {
      console.log('Avatar Debug:', {
        raw: avatarUrl,
        full: fullAvatarUrl,
        hasError,
        imageKey,
        apiBaseUrl: getCurrentApiBaseUrl(),
        baseDomain: getBaseDomain()
      });
    }
  }, [avatarUrl, fullAvatarUrl, hasError, imageKey]);
  
  // Use fallback if no URL or error occurred
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
          uri: `${fullAvatarUrl}?v=${imageKey}`, // Add version parameter to force reload
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }}
        style={style}
        onError={(error) => {
          console.warn('Avatar failed to load:', {
            url: fullAvatarUrl,
            error: error
          });
          setHasError(true);
        }}
      />
    </TouchableOpacity>
  );
};

// Constants
const CHANGELOG_VERSION = '1.0.0';

interface AccountContentProps {
  source: 'admin' | 'drawer';
  onBack: () => void;
  title?: string;
}

// Centralized toast helper with consistent styling
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
  // Initialize component state
  const [isScreenReady, setIsScreenReady] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Use UserContext methods with enhanced cache management
  const { 
    user, 
    refreshUser, 
    clearUserCache, // New method for cache management
    loading: userLoading, 
    error: userError,
    logout,
    getDisplayName
  } = useUser();
  
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Debug avatar URL whenever user changes
  useEffect(() => {
    if (user?.avatar_url) {
      const fullUrl = getFullAvatarUrl(user.avatar_url);
      console.log('User Avatar Debug:', {
        userId: user.id,
        rawAvatarUrl: user.avatar_url,
        fullAvatarUrl: fullUrl,
        apiBaseUrl: getCurrentApiBaseUrl(),
        baseDomain: getBaseDomain()
      });
    }
  }, [user?.avatar_url]);

  // Component initialization with crash protection
  useEffect(() => {
    let isMounted = true;
    
    async function initializeScreen() {
      try {
        console.log(`AccountContent (${source}): Initializing...`);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (isMounted) {
          console.log(`AccountContent (${source}): Ready`);
          setIsScreenReady(true);
          
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
        console.error(`AccountContent (${source}) initialization error:`, error);
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

  // Check for user data and redirect if missing
  useEffect(() => {
    let isMounted = true;
    
    async function validateUserData() {
      if (!isScreenReady || isRedirecting) return;

      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!isMounted) return;

        // Check if UserContext has user data
        if (!userLoading && !user) {
          console.log('No user data in context, redirecting to login');
          setIsRedirecting(true);
          showToast.error('User session invalid', 'Please log in again');
          router.replace('/login');
          return;
        }

        // If we have user data, proceed normally
        if (user) {
          console.log(`User data validated for ${source} screen:`, {
            id: user.id,
            email: user.email,
            hasDisplayName: !!user.display_name,
            hasFirstName: !!user.first_name,
            avatarUrl: user.avatar_url
          });
        }

      } catch (error) {
        console.error('Error validating user data:', error);
        if (isMounted && !user) {
          setIsRedirecting(true);
          showToast.error('Authentication error', 'Please log in again');
          router.replace('/login');
        }
      }
    }

    validateUserData();
    
    return () => {
      isMounted = false;
    };
  }, [isScreenReady, user, userLoading, router, source, isRedirecting]);

  // Enhanced refresh handler - always fetches fresh data and clears cache
  const onRefresh = useCallback(async () => {
    try {
      if (!user) {
        showToast.warning('Please log in first');
        return;
      }

      setRefreshing(true);
      console.log('Manual refresh triggered - clearing cache and fetching fresh data');
      
      // Force clear cache and refresh user data
      await clearUserCache();
      await refreshUser(true); // Force refresh with cache clearing
      
      showToast.success('Data refreshed');
    } catch (error) {
      console.error('Refresh error:', error);
      showToast.error('Failed to refresh data', 'Please check your connection');
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, clearUserCache, user]);

  // Avatar picker with better validation
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
        quality: 0.8, // Slightly higher quality
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;
      
      const asset = result.assets[0];
      console.log('Selected image:', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize
      });
      
      setPreviewUri(asset.uri);
    } catch (error) {
      console.error('Error picking avatar:', error);
      showToast.error('Failed to select image');
    }
  }, []);

  // Updated avatar upload using centralized helper
  const confirmUploadAvatar = useCallback(async () => {
    try {
      if (!previewUri) return;

      setLoading(true);
      console.log('Starting avatar upload process using centralized helper...');
      
      // Use the centralized uploadAvatar helper
      const result = await uploadAvatar(previewUri);
      
      if (result?.success && result?.avatar_url) {
        console.log('Avatar uploaded successfully:', result.avatar_url);
        
        // Force clear all cache before refreshing
        console.log('Clearing avatar and user cache after upload...');
        await clearUserCache();
        
        // Force refresh user data to get the new avatar URL
        console.log('Force refreshing user data after avatar upload...');
        await refreshUser(true);
        
        showToast.success('Avatar updated!');
      } else {
        throw new Error(result?.error || 'Upload failed');
      }
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      showToast.error('Upload failed', error.message || 'Please try again');
    } finally {
      setPreviewUri(null);
      setLoading(false);
    }
  }, [previewUri, refreshUser, clearUserCache]);

  // Use AccountManager-backed logout from UserContext
  const confirmLogout = useCallback(async () => {
    try {
      console.log('Logging out through UserContext...');
      
      // Use the logout method from UserContext which handles AccountManager
      await logout();
      
      showToast.info('Logged out successfully');
      setShowLogoutConfirm(false);
      
      // Navigate to login
      router.replace('/login');
      
    } catch (error) {
      console.error('Logout error:', error);
      showToast.error('Logout failed');
    }
  }, [logout, router]);

  // Loading screen while initializing or redirecting
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

  // Error screen
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
            onPress={() => router.replace('/login')}
            style={{ marginTop: 10, backgroundColor: '#764ba2' }}
          >
            Go to Login
          </Button>
        </View>
      </View>
    );
  }

  // Show loading if user data is still loading
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

  // Main content - focused only on user account information
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

      {/* Header with matching gradient */}
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

      {/* Content */}
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
        {/* User Profile Card */}
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
            />
          </View>
        </View>

        {/* Account Information Card */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-username')}>
            <Text style={styles.infoLabel}>Username</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.username || '—'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-display-name')}>
            <Text style={styles.infoLabel}>Display Name</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.display_name || user?.first_name || 'LVL0'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-email')}>
            <Text style={styles.infoLabel}>Email</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.email || 'admin@example.com'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoRow} onPress={() => router.push('/edit-phone')}>
            <Text style={styles.infoLabel}>Phone</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoValue}>{user?.phone || '—'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#888" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout Card */}
        <View style={styles.logoutCard}>
          <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>
            <MaterialCommunityIcons name="logout" size={22} color="#ff6b6b" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
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
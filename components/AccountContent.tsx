// components/AccountContent.tsx - Enhanced version with proper toast integration
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import {
  Modal,
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

// ✅ Lazy load heavy components to prevent blocking
const AvatarPreviewModal = React.lazy(() => import('./AvatarPreviewModal'));
const BusinessModal = React.lazy(() => import('./BusinessModal'));
const ChangelogModal = React.lazy(() => import('./ChangelogModal'));
const JoinBusinessModal = React.lazy(() => import('./JoinBusinessModal'));
const LoaderOverlay = React.lazy(() => import('./LoaderOverlay'));

import { useUser } from '../context/UserContext';
import { createInvite, getBusinesses } from '../lib/helpers/business';
import { uploadAvatar } from '../lib/helpers/uploadAvatar';
import { registerStatusUpdater, checkServerStatus } from '../lib/netStatus';

// ✅ Constants
const CHANGELOG_KEY = 'changelog_seen';
const CHANGELOG_VERSION = '1.0.0';
const BUSINESS_CACHE_KEY = 'cached_business_data';
const CACHE_EXPIRY_KEY = 'business_cache_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

type NetworkStatus = 'online' | 'offline' | 'server_error';

interface BusinessData {
  owned: any[];
  joined: any[];
  timestamp: number;
}

interface AccountContentProps {
  source: 'admin' | 'drawer';
  onBack: () => void;
  title?: string;
}

// ✅ Centralized toast helper with consistent styling
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
  // ✅ Initialize component state
  const [isScreenReady, setIsScreenReady] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online');
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [lastServerCheck, setLastServerCheck] = useState<number>(0);
  
  const { user, refreshUser, loading: userLoading, error: userError } = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState([]);
  const [joinedBusinesses, setJoinedBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [previewUri, setPreviewUri] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // ✅ Network connectivity helpers with defensive programming
  const isConnected = useCallback(() => {
    try {
      return networkStatus === 'online';
    } catch (error) {
      console.error('❌ Error checking connection status:', error);
      return false; // Fail safely
    }
  }, [networkStatus]);

  const canMakeRequests = useCallback(() => {
    try {
      return networkStatus !== 'offline';
    } catch (error) {
      console.error('❌ Error checking request capability:', error);
      return false; // Fail safely
    }
  }, [networkStatus]);

  const shouldUseCachedData = useCallback(() => {
    try {
      return networkStatus !== 'online';
    } catch (error) {
      console.error('❌ Error checking cache preference:', error);
      return true; // Fail safely to cached data
    }
  }, [networkStatus]);

  // ✅ Advanced network status monitoring with crash protection
  useEffect(() => {
    let isMonitoring = true;

    const handleStatusUpdate = (status: NetworkStatus) => {
      try {
        if (!isMonitoring) return;

        console.log(`🌐 Network status changed: ${networkStatus} → ${status}`);
        const previousStatus = networkStatus;
        setNetworkStatus(status);
        setLastServerCheck(Date.now());

        // Provide intelligent user feedback based on status transitions
        if (previousStatus !== status) {
          switch (status) {
            case 'offline':
              if (previousStatus === 'online') {
                showToast.warning('Connection Lost', 'Working offline with cached data');
              }
              break;
            
            case 'server_error':
              if (previousStatus === 'online') {
                showToast.error('Server Unavailable', 'Using cached data while server reconnects');
              }
              break;
            
            case 'online':
              if (previousStatus !== 'online') {
                showToast.success('Connection Restored', 'Syncing latest data...');
                // Automatically refresh data when connection is restored
                if (user && isScreenReady) {
                  setTimeout(() => {
                    try {
                      loadBusinesses(true);
                    } catch (refreshError) {
                      console.error('❌ Error refreshing data on reconnect:', refreshError);
                    }
                  }, 500); // Small delay to avoid overwhelming the server
                }
              }
              break;
          }
        }
      } catch (error) {
        console.error('❌ Error in network status handler:', error);
        // Don't let network status errors crash the app
      }
    };

    try {
      // Register status updater with error handling
      registerStatusUpdater(handleStatusUpdate);

      // Perform initial status check with timeout
      const initialCheck = async () => {
        try {
          const status = await Promise.race([
            checkServerStatus(),
            new Promise<NetworkStatus>((_, reject) => 
              setTimeout(() => reject(new Error('Initial status check timeout')), 10000)
            )
          ]);
          handleStatusUpdate(status);
        } catch (error) {
          console.error('❌ Initial network status check failed:', error);
          // Default to offline to be safe
          handleStatusUpdate('offline');
        }
      };

      initialCheck();
    } catch (error) {
      console.error('❌ Error setting up network monitoring:', error);
      // Default to offline mode if monitoring setup fails
      setNetworkStatus('offline');
    }

    return () => {
      isMonitoring = false;
    };
  }, []); // Only run once on mount

  // ✅ Cache business data with enhanced error handling
  const cacheBusinessData = useCallback(async (data: { owned: any[]; joined: any[] }) => {
    try {
      const cacheData: BusinessData = {
        owned: data.owned || [],
        joined: data.joined || [],
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(BUSINESS_CACHE_KEY, JSON.stringify(cacheData));
      await AsyncStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
      
      console.log('💾 Business data cached successfully', {
        owned: cacheData.owned.length,
        joined: cacheData.joined.length,
        networkStatus
      });
    } catch (error) {
      console.error('❌ Failed to cache business data:', error);
      // Don't throw - caching failures shouldn't crash the app
    }
  }, [networkStatus]);

  // ✅ Load cached business data with intelligent expiry handling
  const loadCachedBusinessData = useCallback(async (): Promise<BusinessData | null> => {
    try {
      const [cachedData, expiryTime] = await Promise.all([
        AsyncStorage.getItem(BUSINESS_CACHE_KEY),
        AsyncStorage.getItem(CACHE_EXPIRY_KEY),
      ]);

      if (!cachedData) {
        console.log('💾 No cached business data found');
        return null;
      }

      const parsed: BusinessData = JSON.parse(cachedData);
      const expiry = expiryTime ? parseInt(expiryTime) : 0;
      const isExpired = Date.now() > expiry;

      // Use cached data if offline/server error OR if cache is still valid
      if (shouldUseCachedData() || !isExpired) {
        console.log('💾 Using cached business data', {
          owned: parsed.owned?.length || 0,
          joined: parsed.joined?.length || 0,
          age: Math.round((Date.now() - parsed.timestamp) / 1000 / 60) + ' minutes',
          expired: isExpired,
          reason: shouldUseCachedData() ? 'network_issue' : 'cache_valid',
          networkStatus
        });

        return parsed;
      }

      console.log('💾 Cached data expired and network available, will fetch fresh data');
      return null;
    } catch (error) {
      console.error('❌ Failed to load cached business data:', error);
      return null;
    }
  }, [shouldUseCachedData, networkStatus]);

  // ✅ Component initialization with crash protection
  useEffect(() => {
    let isMounted = true;
    
    async function initializeScreen() {
      try {
        console.log(`📱 AccountContent (${source}): Initializing...`);
        
        // ✅ Small delay to ensure everything is mounted
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (isMounted) {
          console.log(`✅ AccountContent (${source}): Ready`);
          setIsScreenReady(true);
          
          // ✅ Hide splash screen for admin version only (drawer manages its own)
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
        console.error(`❌ AccountContent (${source}) initialization error:`, error);
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

  // ✅ Check for user data and redirect if missing - with crash protection
  useEffect(() => {
    let isMounted = true;
    
    async function validateUserData() {
      if (!isScreenReady || isRedirecting) return;

      try {
        // Wait a bit for UserContext to load
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!isMounted) return;

        // Check if we have auth tokens first
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        
        if (!authToken || !userId) {
          console.log('❌ No auth tokens found, redirecting to login');
          setIsRedirecting(true);
          showToast.warning('Session expired', 'Please log in again');
          router.replace('/login');
          return;
        }

        // Check if UserContext has user data
        if (!userLoading && !user) {
          console.log('❌ No user data in context, checking storage...');
          
          // Try to get user data from AsyncStorage
          const storedUserData = await AsyncStorage.getItem('user_data');
          
          if (!storedUserData) {
            console.log('❌ No user data in storage either, redirecting to login');
            setIsRedirecting(true);
            showToast.error('User data missing', 'Please log in again to reload your profile');
            
            // Clear any stale auth tokens
            await SecureStore.deleteItemAsync('auth_token');
            await SecureStore.deleteItemAsync('user_id');
            await SecureStore.deleteItemAsync('user_role');
            
            router.replace('/login');
            return;
          } else {
            console.log('✅ Found user data in storage, refreshing user context...');
            // Try to refresh user data from server only if connected
            try {
              if (isConnected()) {
                await refreshUser();
              }
            } catch (refreshError) {
              console.log('⚠️ Failed to refresh user from server, using stored data');
            }
          }
        }

        // If we have user data, proceed normally
        if (user) {
          console.log(`✅ User data validated for ${source} screen:`, {
            id: user.id,
            email: user.email,
            hasDisplayName: !!user.display_name,
            hasFirstName: !!user.first_name,
            networkStatus
          });
        }

      } catch (error) {
        console.error('❌ Error validating user data:', error);
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
  }, [isScreenReady, user, userLoading, refreshUser, router, source, isRedirecting, isConnected]);

  // ✅ Clear all cached data helper with error handling
  const clearAllCachedData = useCallback(async () => {
    try {
      console.log('🧹 Clearing all cached data...');
      
      // Clear business data from state
      setOwnedBusinesses([]);
      setJoinedBusinesses([]);
      setSelectedBusiness(null);
      setInviteLink(null);
      setUsingCachedData(false);
      
      // Clear AsyncStorage (but keep essential items like changelog)
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(key => 
        !key.includes('changelog') && 
        !key.includes('onboarding') &&
        !key.includes('settings')
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log('✅ Cleared AsyncStorage keys:', keysToRemove);
      }
      
    } catch (error) {
      console.error('❌ Error clearing cached data:', error);
      // Don't throw - clearing cache failures shouldn't crash logout
    }
  }, []);

  // ✅ Enhanced business loading with intelligent network handling and crash protection
  const loadBusinesses = useCallback(async (forceRefresh = false) => {
    try {
      console.log('📊 Loading businesses...', { 
        networkStatus, 
        forceRefresh,
        canMakeRequests: canMakeRequests(),
        shouldUseCached: shouldUseCachedData()
      });
      
      // Check changelog first
      try {
        const seen = await AsyncStorage.getItem(CHANGELOG_KEY);
        if (!seen) setShowChangelog(true);
      } catch (error) {
        console.error('❌ Error checking changelog:', error);
        // Don't fail business loading for changelog issues
      }
      
      // Load cached data first for immediate UI feedback
      if (!forceRefresh || shouldUseCachedData()) {
        try {
          const cachedData = await loadCachedBusinessData();
          if (cachedData) {
            setOwnedBusinesses(cachedData.owned || []);
            setJoinedBusinesses(cachedData.joined || []);
            setUsingCachedData(true);
            
            // If we can't make requests, stop here
            if (!canMakeRequests()) {
              return;
            }
            
            // If not forcing refresh and cache is fresh, stop here
            if (!forceRefresh) {
              console.log('📊 Using fresh cached data, skipping network request');
              return;
            }
          }
        } catch (cacheError) {
          console.error('❌ Error loading cached data:', cacheError);
          // Continue to try network request
        }
      }

      // Attempt to fetch fresh data if we can make requests
      if (canMakeRequests()) {
        try {
          console.log('🌐 Fetching fresh business data...');
          const data = await getBusinesses();
          
          if (data && user) {
            setOwnedBusinesses(data?.owned || []);
            setJoinedBusinesses(data?.joined || []);
            setUsingCachedData(false);
            
            // Cache the fresh data
            await cacheBusinessData(data);
            
            console.log('✅ Fresh businesses loaded:', {
              owned: data?.owned?.length || 0,
              joined: data?.joined?.length || 0,
              networkStatus
            });
          }
        } catch (fetchError) {
          console.error('❌ Error fetching fresh business data:', fetchError);
          
          // Fallback to cached data if network request fails
          if (!usingCachedData) {
            try {
              const cachedData = await loadCachedBusinessData();
              if (cachedData) {
                setOwnedBusinesses(cachedData.owned || []);
                setJoinedBusinesses(cachedData.joined || []);
                setUsingCachedData(true);
                
                showToast.warning('Connection Failed', 'Showing cached business data');
              } else {
                // No cached data and fetch failed
                const errorMessage = networkStatus === 'server_error' 
                  ? 'Server temporarily unavailable' 
                  : 'Check your internet connection';
                showToast.error('Failed to load businesses', errorMessage);
                setOwnedBusinesses([]);
                setJoinedBusinesses([]);
              }
            } catch (fallbackError) {
              console.error('❌ Error loading fallback cached data:', fallbackError);
              setOwnedBusinesses([]);
              setJoinedBusinesses([]);
              showToast.error('Failed to load businesses');
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error in loadBusinesses:', error);
      
      // Try to fallback to cached data on any error
      try {
        const cachedData = await loadCachedBusinessData();
        if (cachedData) {
          setOwnedBusinesses(cachedData.owned || []);
          setJoinedBusinesses(cachedData.joined || []);
          setUsingCachedData(true);
          
          showToast.warning('Error Loading Data', 'Showing cached business data');
        } else {
          setOwnedBusinesses([]);
          setJoinedBusinesses([]);
          showToast.error('Failed to load businesses');
        }
      } catch (cacheError) {
        console.error('❌ Failed to load cached data as fallback:', cacheError);
        setOwnedBusinesses([]);
        setJoinedBusinesses([]);
        showToast.error('Failed to load businesses');
      }
    }
  }, [user, networkStatus, canMakeRequests, shouldUseCachedData, loadCachedBusinessData, cacheBusinessData, usingCachedData]);

  // ✅ Load data only after screen is ready and user is validated
  useEffect(() => {
    if (isScreenReady && !screenError && !userError && user && !isRedirecting) {
      console.log(`🔄 AccountContent (${source}) ready with user, loading data...`);
      try {
        loadBusinesses();
      } catch (error) {
        console.error('❌ Error initiating business load:', error);
      }
    } else if (isScreenReady && !user && !userLoading && !isRedirecting) {
      // User data is missing and not loading - validation effect will handle redirect
      console.log('🧹 No user found, clearing business data');
      setOwnedBusinesses([]);
      setJoinedBusinesses([]);
      setUsingCachedData(false);
    }
  }, [isScreenReady, screenError, userError, loadBusinesses, source, user, userLoading, isRedirecting]);

  // ✅ Enhanced refresh handler with intelligent network awareness
  const onRefresh = useCallback(async () => {
    try {
      if (!user) {
        showToast.warning('Please log in first');
        return;
      }

      if (!canMakeRequests()) {
        const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
        const message = networkStatus === 'offline' 
          ? 'Cannot refresh while offline' 
          : 'Server is temporarily unavailable';
        showToast.info(title, message);
        return;
      }

      setRefreshing(true);
      
      // First refresh user data, then businesses
      await refreshUser();
      // Small delay to ensure user context is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadBusinesses(true); // Force refresh
    } catch (error) {
      console.error('❌ Refresh error:', error);
      const errorMessage = networkStatus === 'server_error' 
        ? 'Server temporarily unavailable' 
        : 'Check your connection';
      showToast.error('Failed to refresh data', errorMessage);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, loadBusinesses, user, networkStatus, canMakeRequests]);

  // ✅ Avatar picker with network awareness and crash protection
  const pickAndPreviewAvatar = useCallback(async () => {
    try {
      if (!isConnected()) {
        const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
        showToast.info(title, 'Avatar upload requires server connection');
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast.error('Photo access denied');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) return;
      setPreviewUri(result.assets[0].uri);
    } catch (error) {
      console.error('❌ Error picking avatar:', error);
      showToast.error('Failed to select image');
    }
  }, [networkStatus, isConnected]);

  // ✅ Avatar upload with network status handling and crash protection
  const confirmUploadAvatar = useCallback(async () => {
    try {
      if (!previewUri) return;

      if (!isConnected()) {
        const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
        showToast.error(title, 'Cannot upload while server is unavailable');
        return;
      }

      setLoading(true);
      
      await uploadAvatar(previewUri);
      showToast.success('Avatar updated!');
      await refreshUser();
    } catch (error) {
      console.error('❌ Error uploading avatar:', error);
      const errorMessage = networkStatus === 'server_error' 
        ? 'Server temporarily unavailable' 
        : 'Check your connection';
      showToast.error('Upload failed', errorMessage);
    } finally {
      setPreviewUri(null);
      setLoading(false);
    }
  }, [previewUri, refreshUser, networkStatus, isConnected]);

  // ✅ Enhanced logout handler with proper cleanup and crash protection
  const confirmLogout = useCallback(async () => {
    try {
      console.log('🚪 Logging out...');
      
      // Clear all cached data first
      await clearAllCachedData();
      
      // Remove auth tokens
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_id');
      await SecureStore.deleteItemAsync('user_role');
      
      // Clear any other auth-related storage
      try {
        await AsyncStorage.removeItem('user_data');
        await AsyncStorage.removeItem('business_data');
      } catch (storageError) {
        console.log('Note: Some storage items may not exist:', storageError);
      }
      
      showToast.info('Logged out successfully');
      setShowLogoutConfirm(false);
      
      // Navigate to login
      router.replace('/login');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      showToast.error('Logout failed');
    }
  }, [router, clearAllCachedData]);

  // ✅ Get display name with fallback and crash protection
  const getDisplayName = useCallback(() => {
    try {
      // Priority: display_name -> first_name -> username -> fallback
      if (user?.display_name && user.display_name.trim()) {
        return user.display_name;
      }
      if (user?.first_name && user.first_name.trim()) {
        return user.first_name;
      }
      if (user?.username && user.username.trim()) {
        return user.username;
      }
      return 'User';
    } catch (error) {
      console.error('❌ Error getting display name:', error);
      return 'User';
    }
  }, [user]);

  // ✅ Get network status display info with crash protection
  const getNetworkStatusInfo = useCallback(() => {
    try {
      switch (networkStatus) {
        case 'offline':
          return {
            icon: 'wifi-off',
            color: '#ff6b6b',
            text: 'Offline Mode - Showing cached data',
            bgColor: 'rgba(255, 107, 107, 0.1)',
            borderColor: 'rgba(255, 107, 107, 0.5)'
          };
        case 'server_error':
          return {
            icon: 'server-network-off',
            color: '#ffa726',
            text: 'Server Unavailable - Using cached data',
            bgColor: 'rgba(255, 167, 38, 0.1)',
            borderColor: 'rgba(255, 167, 38, 0.5)'
          };
        default:
          return usingCachedData ? {
            icon: 'cached',
            color: '#4caf50',
            text: 'Showing cached data',
            bgColor: 'rgba(76, 175, 80, 0.1)',
            borderColor: 'rgba(76, 175, 80, 0.5)'
          } : null;
      }
    } catch (error) {
      console.error('❌ Error getting network status info:', error);
      return null;
    }
  }, [networkStatus, usingCachedData]);

  // ✅ Manual server status check with crash protection
  const handleRetryServerCheck = useCallback(async () => {
    try {
      const newStatus = await checkServerStatus();
      if (newStatus === 'online') {
        loadBusinesses(true);
      }
    } catch (error) {
      console.error('❌ Error checking server status:', error);
      showToast.error('Status check failed', 'Please try again later');
    }
  }, [loadBusinesses]);

  // ✅ Loading screen while initializing or redirecting
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

  // ✅ Error screen
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
              loadBusinesses();
            } catch (error) {
              console.error('❌ Error retrying:', error);
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

  // ✅ Show loading if user data is still loading
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

  const statusInfo = getNetworkStatusInfo();

  // ✅ Main content
  return (
    <View style={styles.container}>
      {/* ✅ Suspense wrapper for lazy-loaded components */}
      <Suspense fallback={<View />}>
        {loading && <LoaderOverlay visible={true} />}

        {showChangelog && (
          <ChangelogModal 
            visible 
            onClose={() => {
              try {
                AsyncStorage.setItem(CHANGELOG_KEY, 'true');
                setShowChangelog(false);
              } catch (error) {
                console.error('❌ Error closing changelog:', error);
                setShowChangelog(false);
              }
            }} 
          />
        )}

        {previewUri && (
          <AvatarPreviewModal
            visible
            uri={previewUri}
            onCancel={() => setPreviewUri(null)}
            onConfirm={confirmUploadAvatar}
          />
        )}

        {showBusinessModal && (
          <BusinessModal
            visible
            onClose={() => setShowBusinessModal(false)}
            onCreate={loadBusinesses}
          />
        )}

        {showJoinModal && (
          <JoinBusinessModal
            visible
            onClose={() => setShowJoinModal(false)}
            onJoin={loadBusinesses}
          />
        )}
      </Suspense>

      {/* Business invite modal */}
      {selectedBusiness && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.inviteModal}>
              <Text style={styles.modalText}>
                Generate invite link for "{selectedBusiness.name}"?
              </Text>

              {!inviteLink ? (
                <Button 
                  mode="contained" 
                  onPress={async () => {
                    try {
                      if (!isConnected()) {
                        const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
                        showToast.error(title, 'Cannot generate invite while server is unavailable');
                        return;
                      }

                      const res = await createInvite(selectedBusiness.id);
                      setInviteLink(res?.code || 'No code');
                    } catch (error) {
                      console.error('❌ Error creating invite:', error);
                      const errorMessage = networkStatus === 'server_error' 
                        ? 'Server temporarily unavailable' 
                        : 'Please try again';
                      showToast.error('Failed to create invite', errorMessage);
                    }
                  }}
                  disabled={!isConnected()}
                >
                  Generate Link
                </Button>
              ) : (
                <>
                  <Text selectable style={styles.code}>{inviteLink}</Text>
                  <Button onPress={() => {
                    try {
                      Clipboard.setStringAsync(inviteLink);
                      showToast.success('Copied to clipboard!');
                    } catch (error) {
                      console.error('❌ Error copying to clipboard:', error);
                      showToast.error('Failed to copy');
                    }
                  }}>
                    Copy
                  </Button>
                </>
              )}

              <Button onPress={() => {
                setSelectedBusiness(null);
                setInviteLink(null);
              }}>
                Close
              </Button>
            </View>
          </View>
        </Modal>
      )}

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
        {/* Enhanced Network Status Indicator */}
        {statusInfo && (
          <View style={[styles.statusCard, { backgroundColor: statusInfo.bgColor, borderColor: statusInfo.borderColor }]}>
            <MaterialCommunityIcons 
              name={statusInfo.icon} 
              size={20} 
              color={statusInfo.color} 
            />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
            {networkStatus === 'server_error' && (
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={handleRetryServerCheck}
              >
                <MaterialCommunityIcons name="refresh" size={16} color={statusInfo.color} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* User Profile Card */}
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View>
              <Text style={styles.userName}>{getDisplayName()}</Text>
              <Text style={styles.accountType}>Glt Account</Text>
              <Text style={styles.version}>v{CHANGELOG_VERSION}</Text>
            </View>
            <TouchableOpacity onPress={pickAndPreviewAvatar}>
              <Avatar.Image
                size={60}
                source={
                  user?.avatar_url
                    ? { uri: user.avatar_url }
                    : require('../assets/images/avatar_placeholder.png')
                }
              />
            </TouchableOpacity>
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

        {/* Business Actions Card */}
        <View style={styles.identityCard}>
          <Text style={styles.userName}>Business</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button 
              mode="outlined" 
              onPress={() => {
                try {
                  if (!isConnected()) {
                    const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
                    showToast.info(title, 'Cannot create business while server is unavailable');
                    return;
                  }
                  setShowBusinessModal(true);
                } catch (error) {
                  console.error('❌ Error opening business modal:', error);
                }
              }}
              buttonColor="rgba(118, 75, 162, 0.1)"
              textColor={isConnected() ? "#764ba2" : "#999"}
              disabled={!isConnected()}
            >
              Create
            </Button>
            <Button 
              mode="outlined" 
              onPress={() => {
                try {
                  if (!isConnected()) {
                    const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
                    showToast.info(title, 'Cannot join business while server is unavailable');
                    return;
                  }
                  setShowJoinModal(true);
                } catch (error) {
                  console.error('❌ Error opening join modal:', error);
                }
              }}
              buttonColor="rgba(118, 75, 162, 0.1)"
              textColor={isConnected() ? "#764ba2" : "#999"}
              disabled={!isConnected()}
            >
              Join
            </Button>
          </View>
        </View>

        {/* User Businesses Card */}
        <View style={styles.identityCard}>
          <Text style={styles.userName}>Your Businesses</Text>
          
          <Text style={styles.teamLabel}>Owned:</Text>
          {ownedBusinesses.length > 0 ? (
            ownedBusinesses.map((biz) => (
              <TouchableOpacity 
                key={biz.id} 
                onPress={() => {
                  try {
                    if (!isConnected()) {
                      const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
                      showToast.info(title, 'Cannot generate invite while server is unavailable');
                      return;
                    }
                    setSelectedBusiness(biz);
                  } catch (error) {
                    console.error('❌ Error selecting business:', error);
                  }
                }}
                disabled={!isConnected()}
              >
                <Text style={[styles.businessItem, !isConnected() && { opacity: 0.6 }]}>
                  • {biz.name}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.businessItem}>None</Text>
          )}

          <Text style={styles.teamLabel}>Joined:</Text>
          {joinedBusinesses.length > 0 ? (
            joinedBusinesses.map((biz) => (
              <Text key={biz.id} style={styles.businessItem}>• {biz.name}</Text>
            ))
          ) : (
            <Text style={styles.businessItem}>None</Text>
          )}
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    padding: 4,
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
  teamLabel: { 
    color: '#ccc', 
    marginTop: 8, 
    fontWeight: '600' 
  },
  businessItem: { 
    color: '#fff', 
    marginTop: 4, 
    fontSize: 15 
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
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  inviteModal: { 
    backgroundColor: '#1a1a2e', 
    margin: 32, 
    padding: 20, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(118, 75, 162, 0.4)',
  },
  modalText: { 
    color: '#fff', 
    fontSize: 16, 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  code: { 
    color: '#764ba2', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 12, 
    marginBottom: 12 
  },
});
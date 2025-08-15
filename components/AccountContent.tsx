// components/AccountContent.tsx - Enhanced version with offline support and caching
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
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

// ✅ Constants
const CHANGELOG_KEY = 'changelog_seen';
const CHANGELOG_VERSION = '1.0.0';
const BUSINESS_CACHE_KEY = 'cached_business_data';
const CACHE_EXPIRY_KEY = 'business_cache_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

export default function AccountContent({ source, onBack, title = 'Account' }: AccountContentProps) {
  // ✅ Initialize component state
  const [isScreenReady, setIsScreenReady] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  
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

  // ✅ Network state monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
      
      if (offline) {
        console.log('📴 Device is offline - using cached data');
      } else {
        console.log('📶 Device is online');
      }
    });

    return unsubscribe;
  }, []);

  // ✅ Cache business data
  const cacheBusinessData = useCallback(async (data: { owned: any[]; joined: any[] }) => {
    try {
      const cacheData: BusinessData = {
        owned: data.owned || [],
        joined: data.joined || [],
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(BUSINESS_CACHE_KEY, JSON.stringify(cacheData));
      await AsyncStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
      
      console.log('💾 Business data cached successfully');
    } catch (error) {
      console.error('❌ Failed to cache business data:', error);
    }
  }, []);

  // ✅ Load cached business data
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

      if (isExpired && !isOffline) {
        console.log('💾 Cached data expired, will fetch fresh data');
        return null;
      }

      console.log('💾 Using cached business data', {
        owned: parsed.owned?.length || 0,
        joined: parsed.joined?.length || 0,
        age: Math.round((Date.now() - parsed.timestamp) / 1000 / 60) + ' minutes',
        expired: isExpired,
      });

      return parsed;
    } catch (error) {
      console.error('❌ Failed to load cached business data:', error);
      return null;
    }
  }, [isOffline]);

  // ✅ Component initialization
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
                console.log('Splash screen already hidden');
              }
            }, 100);
          }
        }
        
      } catch (error) {
        console.error(`❌ AccountContent (${source}) initialization error:`, error);
        if (isMounted) {
          setScreenError(error.message);
          setIsScreenReady(true);
        }
      }
    }

    initializeScreen();
    
    return () => {
      isMounted = false;
    };
  }, [source]);

  // ✅ Check for user data and redirect if missing
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
          Toast.show({ 
            type: 'warning', 
            text1: 'Session expired', 
            text2: 'Please log in again' 
          });
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
            Toast.show({ 
              type: 'error', 
              text1: 'User data missing', 
              text2: 'Please log in again to reload your profile' 
            });
            
            // Clear any stale auth tokens
            await SecureStore.deleteItemAsync('auth_token');
            await SecureStore.deleteItemAsync('user_id');
            await SecureStore.deleteItemAsync('user_role');
            
            router.replace('/login');
            return;
          } else {
            console.log('✅ Found user data in storage, refreshing user context...');
            // Try to refresh user data from server
            try {
              if (!isOffline) {
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
          });
        }

      } catch (error) {
        console.error('❌ Error validating user data:', error);
        if (isMounted && !user) {
          setIsRedirecting(true);
          Toast.show({ 
            type: 'error', 
            text1: 'Authentication error', 
            text2: 'Please log in again' 
          });
          router.replace('/login');
        }
      }
    }

    validateUserData();
    
    return () => {
      isMounted = false;
    };
  }, [isScreenReady, user, userLoading, refreshUser, router, source, isRedirecting, isOffline]);

  // ✅ Clear all cached data helper
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
    }
  }, []);

  // ✅ Load businesses data with offline support and caching
  const loadBusinesses = useCallback(async (forceRefresh = false) => {
    try {
      console.log('📊 Loading businesses...', { isOffline, forceRefresh });
      
      // Check changelog first
      const seen = await AsyncStorage.getItem(CHANGELOG_KEY);
      if (!seen) setShowChangelog(true);
      
      // If offline or not forcing refresh, try cached data first
      if (isOffline || !forceRefresh) {
        const cachedData = await loadCachedBusinessData();
        if (cachedData) {
          setOwnedBusinesses(cachedData.owned || []);
          setJoinedBusinesses(cachedData.joined || []);
          setUsingCachedData(true);
          
          if (isOffline) {
            Toast.show({
              type: 'info',
              text1: 'Offline Mode',
              text2: 'Showing cached business data',
              position: 'bottom',
            });
            return; // Don't try to fetch if offline
          } else if (!forceRefresh) {
            // Show cached data immediately, but continue to fetch fresh data
            console.log('📊 Showing cached data while fetching fresh data...');
          }
        }
      }

      // Try to fetch fresh data if online
      if (!isOffline) {
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
              joined: data?.joined?.length || 0
            });
          }
        } catch (fetchError) {
          console.error('❌ Error fetching fresh business data:', fetchError);
          
          // If we don't have cached data and fetch failed, try one more time with cached data
          if (!usingCachedData) {
            const cachedData = await loadCachedBusinessData();
            if (cachedData) {
              setOwnedBusinesses(cachedData.owned || []);
              setJoinedBusinesses(cachedData.joined || []);
              setUsingCachedData(true);
              
              Toast.show({
                type: 'warning',
                text1: 'Connection Failed',
                text2: 'Showing cached business data',
                position: 'bottom',
              });
            } else {
              // No cached data and fetch failed
              Toast.show({ 
                type: 'error', 
                text1: 'Failed to load businesses',
                text2: 'Check your internet connection',
              });
              setOwnedBusinesses([]);
              setJoinedBusinesses([]);
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
          
          Toast.show({
            type: 'warning',
            text1: 'Error Loading Data',
            text2: 'Showing cached business data',
            position: 'bottom',
          });
        } else {
          setOwnedBusinesses([]);
          setJoinedBusinesses([]);
          Toast.show({ type: 'error', text1: 'Failed to load businesses.' });
        }
      } catch (cacheError) {
        console.error('❌ Failed to load cached data as fallback:', cacheError);
        setOwnedBusinesses([]);
        setJoinedBusinesses([]);
        Toast.show({ type: 'error', text1: 'Failed to load businesses.' });
      }
    }
  }, [user, isOffline, loadCachedBusinessData, cacheBusinessData, usingCachedData]);

  // ✅ Load data only after screen is ready and user is validated
  useEffect(() => {
    if (isScreenReady && !screenError && !userError && user && !isRedirecting) {
      console.log(`🔄 AccountContent (${source}) ready with user, loading data...`);
      loadBusinesses();
    } else if (isScreenReady && !user && !userLoading && !isRedirecting) {
      // User data is missing and not loading - validation effect will handle redirect
      console.log('🧹 No user found, clearing business data');
      setOwnedBusinesses([]);
      setJoinedBusinesses([]);
      setUsingCachedData(false);
    }
  }, [isScreenReady, screenError, userError, loadBusinesses, source, user, userLoading, isRedirecting]);

  // ✅ Refresh handler with offline support
  const onRefresh = useCallback(async () => {
    if (!user) {
      Toast.show({ type: 'warning', text1: 'Please log in first' });
      return;
    }

    if (isOffline) {
      Toast.show({ 
        type: 'info', 
        text1: 'Offline Mode', 
        text2: 'Cannot refresh while offline' 
      });
      return;
    }

    setRefreshing(true);
    try {
      // First refresh user data, then businesses
      await refreshUser();
      // Small delay to ensure user context is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadBusinesses(true); // Force refresh
    } catch (error) {
      console.error('❌ Refresh error:', error);
      Toast.show({ type: 'error', text1: 'Failed to refresh data' });
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, loadBusinesses, user, isOffline]);

  // ✅ Avatar picker
  const pickAndPreviewAvatar = useCallback(async () => {
    if (isOffline) {
      Toast.show({ 
        type: 'info', 
        text1: 'Offline Mode', 
        text2: 'Avatar upload requires internet connection' 
      });
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Toast.show({ type: 'error', text1: 'Photo access denied.' });
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return;
    setPreviewUri(result.assets[0].uri);
  }, [isOffline]);

  // ✅ Avatar upload
  const confirmUploadAvatar = useCallback(async () => {
    if (!previewUri) return;

    if (isOffline) {
      Toast.show({ 
        type: 'error', 
        text1: 'Offline Mode', 
        text2: 'Cannot upload while offline' 
      });
      return;
    }

    setLoading(true);
    try {
      await uploadAvatar(previewUri);
      Toast.show({ type: 'success', text1: 'Avatar updated!' });
      await refreshUser();
    } catch {
      Toast.show({ type: 'error', text1: 'Upload failed.' });
    } finally {
      setPreviewUri(null);
      setLoading(false);
    }
  }, [previewUri, refreshUser, isOffline]);

  // ✅ Enhanced logout handler with proper cleanup
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
      
      Toast.show({ type: 'info', text1: 'Logged out successfully' });
      setShowLogoutConfirm(false);
      
      // Navigate to login
      router.replace('/login');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      Toast.show({ type: 'error', text1: 'Logout failed' });
    }
  }, [router, clearAllCachedData]);

  // ✅ Get display name with fallback
  const getDisplayName = useCallback(() => {
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
  }, [user]);

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
            setScreenError(null);
            loadBusinesses();
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
              AsyncStorage.setItem(CHANGELOG_KEY, 'true');
              setShowChangelog(false);
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
                    if (isOffline) {
                      Toast.show({
                        type: 'error',
                        text1: 'Offline Mode',
                        text2: 'Cannot generate invite while offline',
                      });
                      return;
                    }

                    try {
                      const res = await createInvite(selectedBusiness.id);
                      setInviteLink(res?.code || 'No code');
                    } catch (error) {
                      console.log('Error creating invite:', error);
                      Toast.show({
                        type: 'error',
                        text1: 'Failed to create invite',
                        text2: networkStatus === 'server_error' ? 'Server temporarily unavailable' : 'Please try again',
                      });
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
                    Clipboard.setStringAsync(inviteLink);
                    Toast.show({ type: 'success', text1: 'Copied to clipboard!' });
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
                onPress={async () => {
                  const newStatus = await checkServerStatus();
                  if (newStatus === 'online') {
                    loadBusinesses(true);
                  }
                }}
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
                if (!isConnected()) {
                  Toast.show({
                    type: 'info',
                    text1: networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable',
                    text2: 'Cannot create business while server is unavailable',
                  });
                  return;
                }
                setShowBusinessModal(true);
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
                if (!isConnected()) {
                  Toast.show({
                    type: 'info',
                    text1: networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable',
                    text2: 'Cannot join business while server is unavailable',
                  });
                  return;
                }
                setShowJoinModal(true);
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
                  if (!isConnected()) {
                    Toast.show({
                      type: 'info',
                      text1: networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable',
                      text2: 'Cannot generate invite while server is unavailable',
                    });
                    return;
                  }
                  setSelectedBusiness(biz);
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
});Invite(selectedBusiness.id);
                      setInviteLink(res?.code || 'No code');
                    } catch (error) {
                      console.log('Error creating invite:', error);
                      Toast.show({
                        type: 'error',
                        text1: 'Failed to create invite',
                        text2: 'Please try again',
                      });
                    }
                  }}
                  disabled={isOffline}
                >
                  Generate Link
                </Button>
              ) : (
                <>
                  <Text selectable style={styles.code}>{inviteLink}</Text>
                  <Button onPress={() => {
                    Clipboard.setStringAsync(inviteLink);
                    Toast.show({ type: 'success', text1: 'Copied to clipboard!' });
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
        {/* Offline/Cached Data Indicator */}
        {(isOffline || usingCachedData) && (
          <View style={[styles.statusCard, isOffline ? styles.offlineCard : styles.cachedCard]}>
            <MaterialCommunityIcons 
              name={isOffline ? "wifi-off" : "cached"} 
              size={20} 
              color={isOffline ? "#ff6b6b" : "#ffa726"} 
            />
            <Text style={[styles.statusText, { color: isOffline ? "#ff6b6b" : "#ffa726" }]}>
              {isOffline ? 'Offline Mode - Showing cached data' : 'Showing cached data'}
            </Text>
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
                if (isOffline) {
                  Toast.show({
                    type: 'info',
                    text1: 'Offline Mode',
                    text2: 'Cannot create business while offline',
                  });
                  return;
                }
                setShowBusinessModal(true);
              }}
              buttonColor="rgba(118, 75, 162, 0.1)"
              textColor="#764ba2"
              disabled={isOffline}
            >
              Create
            </Button>
            <Button 
              mode="outlined" 
              onPress={() => {
                if (isOffline) {
                  Toast.show({
                    type: 'info',
                    text1: 'Offline Mode',
                    text2: 'Cannot join business while offline',
                  });
                  return;
                }
                setShowJoinModal(true);
              }}
              buttonColor="rgba(118, 75, 162, 0.1)"
              textColor="#764ba2"
              disabled={isOffline}
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
              <TouchableOpacity key={biz.id} onPress={() => setSelectedBusiness(biz)}>
                <Text style={styles.businessItem}>• {biz.name}</Text>
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
  offlineCard: {
    borderColor: 'rgba(255, 107, 107, 0.5)',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  cachedCard: {
    borderColor: 'rgba(255, 167, 38, 0.5)',
    backgroundColor: 'rgba(255, 167, 38, 0.1)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
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
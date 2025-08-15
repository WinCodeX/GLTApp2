// components/AccountContent.tsx - Fixed version with user data validation
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

// ✅ Constants
const CHANGELOG_KEY = 'changelog_seen';
const CHANGELOG_VERSION = '1.0.0';

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
              await refreshUser();
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
  }, [isScreenReady, user, userLoading, refreshUser, router, source, isRedirecting]);

  // ✅ Clear all cached data helper
  const clearAllCachedData = useCallback(async () => {
    try {
      console.log('🧹 Clearing all cached data...');
      
      // Clear business data from state
      setOwnedBusinesses([]);
      setJoinedBusinesses([]);
      setSelectedBusiness(null);
      setInviteLink(null);
      
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

  // ✅ Load businesses data with better error handling
  const loadBusinesses = useCallback(async () => {
    try {
      console.log('📊 Loading businesses...');
      
      // Check changelog first
      const seen = await AsyncStorage.getItem(CHANGELOG_KEY);
      if (!seen) setShowChangelog(true);
      
      // Clear previous data first
      setOwnedBusinesses([]);
      setJoinedBusinesses([]);
      
      // Fetch fresh business data
      const data = await getBusinesses();
      
      // Only set data if user is still logged in and request succeeded
      if (data && user) {
        setOwnedBusinesses(data?.owned || []);
        setJoinedBusinesses(data?.joined || []);
        console.log('✅ Businesses loaded:', {
          owned: data?.owned?.length || 0,
          joined: data?.joined?.length || 0
        });
      } else {
        console.log('⚠️ No business data or user not logged in');
        setOwnedBusinesses([]);
        setJoinedBusinesses([]);
      }
      
    } catch (error) {
      console.log('❌ Error loading businesses:', error);
      Toast.show({ type: 'error', text1: 'Failed to load businesses.' });
      // Clear stale data on error
      setOwnedBusinesses([]);
      setJoinedBusinesses([]);
    }
  }, [user]);

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
    }
  }, [isScreenReady, screenError, userError, loadBusinesses, source, user, userLoading, isRedirecting]);

  // ✅ Refresh handler with better error handling
  const onRefresh = useCallback(async () => {
    if (!user) {
      Toast.show({ type: 'warning', text1: 'Please log in first' });
      return;
    }

    setRefreshing(true);
    try {
      // First refresh user data, then businesses
      await refreshUser();
      // Small delay to ensure user context is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadBusinesses();
    } catch (error) {
      console.error('❌ Refresh error:', error);
      Toast.show({ type: 'error', text1: 'Failed to refresh data' });
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, loadBusinesses, user]);

  // ✅ Avatar picker
  const pickAndPreviewAvatar = useCallback(async () => {
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
  }, []);

  // ✅ Avatar upload
  const confirmUploadAvatar = useCallback(async () => {
    if (!previewUri) return;

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
  }, [previewUri, refreshUser]);

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
                <Button mode="contained" onPress={async () => {
                  try {
                    const res = await createInvite(selectedBusiness.id);
                    setInviteLink(res?.code || 'No code');
                  } catch (error) {
                    console.log('Error creating invite:', error);
                  }
                }}>
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
        {/* Debug info (dev only) */}
        {__DEV__ && (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>Debug Info:</Text>
            <Text style={styles.debugText}>Source: {source}</Text>
            <Text style={styles.debugText}>Title: {title}</Text>
            <Text style={styles.debugText}>User Loading: {userLoading.toString()}</Text>
            <Text style={styles.debugText}>Component Ready: {isScreenReady.toString()}</Text>
            <Text style={styles.debugText}>Is Redirecting: {isRedirecting.toString()}</Text>
            <Text style={styles.debugText}>User ID: {user?.id || 'N/A'}</Text>
            <Text style={styles.debugText}>User Role: {user?.role || 'Unknown'}</Text>
            <Text style={styles.debugText}>Display Name: {getDisplayName()}</Text>
            <Text style={styles.debugText}>First Name: {user?.first_name || 'N/A'}</Text>
            <Text style={styles.debugText}>Email: {user?.email || 'N/A'}</Text>
            <Text style={styles.debugText}>Owned Businesses: {ownedBusinesses.length}</Text>
            <Text style={styles.debugText}>Joined Businesses: {joinedBusinesses.length}</Text>
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
              onPress={() => setShowBusinessModal(true)}
              buttonColor="rgba(118, 75, 162, 0.1)"
              textColor="#764ba2"
            >
              Create
            </Button>
            <Button 
              mode="outlined" 
              onPress={() => setShowJoinModal(true)}
              buttonColor="rgba(118, 75, 162, 0.1)"
              textColor="#764ba2"
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
  debugCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 0, 0.3)',
  },
  debugTitle: {
    color: '#ffff00',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  debugText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
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
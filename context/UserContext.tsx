// context/UserContext.tsx - Fixed with smart auto-selection and proper persistence
import React, {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import { getUser } from '../lib/helpers/getUser';
import { getBusinesses } from '../lib/helpers/business';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountManager, AccountData } from '../lib/AccountManager';

type User = {
  // Core identity fields
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  full_name?: string;
  initials?: string;
  username?: string;
  phone?: string;
  phone_number?: string;
  
  // Avatar and profile
  avatar_url?: string | null;
  google_image_url?: string | null;
  profile_complete?: boolean;
  
  // Role and permissions
  roles?: string[];
  primary_role?: string;
  role_display?: string;
  role_description?: string;
  available_actions?: string[];
  
  // Authentication and security
  google_user?: boolean;
  needs_password?: boolean;
  provider?: string;
  confirmed?: boolean;
  is_active?: boolean;
  online?: boolean;
  account_status?: string;
  
  // Package delivery permissions
  can_scan_packages?: boolean;
  can_print_labels?: boolean;
  can_manage_packages?: boolean;
  can_view_all_packages?: boolean;
  
  // Package statistics
  pending_packages_count?: number;
  active_packages_count?: number;
  delivered_packages_count?: number;
  
  // Accessibility and areas
  accessible_areas?: any[];
  accessible_locations?: any[];
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
  last_seen_at?: string;
  confirmed_at?: string;
};

type Business = {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
};

type BusinessData = {
  owned: Business[];
  joined: Business[];
};

type UserContextType = {
  // Current user data
  user: User | null;
  businesses: BusinessData;
  selectedBusiness: Business | null;
  loading: boolean;
  error: string | null;
  
  // Account management
  accounts: AccountData[];
  currentAccount: AccountData | null;
  
  // Avatar synchronization
  avatarUpdateTrigger: number;
  
  // Core methods
  refreshUser: (forceClearCache?: boolean) => Promise<void>;
  refreshBusinesses: (forceClearCache?: boolean) => Promise<void>;
  clearUserCache: () => Promise<void>;
  addAccount: (userData: User, token: string) => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Avatar methods
  triggerAvatarRefresh: () => void;
  
  // Business selection
  setSelectedBusiness: (business: Business | null) => void;
  
  // Helper functions
  getDisplayName: () => string;
  getUserPhone: () => string;
  getBusinessDisplayName: () => string;
  
  // Auth helpers
  getCurrentToken: () => string | null;
  getCurrentUserId: () => string | null;
  getCurrentRole: () => string | null;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

// Cache keys
const CACHE_KEYS = {
  USER_DATA: 'cached_user_data',
  USER_EXPIRY: 'user_cache_expiry',
  BUSINESS_DATA: 'cached_business_data',
  BUSINESS_EXPIRY: 'business_cache_expiry',
  SELECTED_BUSINESS: 'selected_business',
  BUSINESS_SELECTION_STATE: 'business_selection_state', // NEW: Track selection state
  AVATAR_CACHE: 'avatar_cache',
};

// Cache duration (30 minutes)
const CACHE_DURATION = 30 * 60 * 1000;

// NEW: Selection state type
type BusinessSelectionState = {
  selectedBusinessId: number | null; // null means "You" mode
  isExplicitUserChoice: boolean; // Whether user made explicit selection
  timestamp: number;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<BusinessData>({ owned: [], joined: [] });
  const [selectedBusiness, setSelectedBusinessState] = useState<Business | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [currentAccount, setCurrentAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Avatar synchronization trigger
  const [avatarUpdateTrigger, setAvatarUpdateTrigger] = useState(Date.now());
  
  // NEW: Track initialization and user choice state
  const isInitialLoadRef = useRef(true);
  const hasRestoredFromCacheRef = useRef(false);
  const isUserExplicitChoiceRef = useRef(false);

  // NEW: Smart auto-selection logic that respects user choices
  useEffect(() => {
    const handleBusinessSelectionLogic = async () => {
      // Don't run auto-selection during initial load or if user made explicit choice
      if (isInitialLoadRef.current || loading) {
        return;
      }

      console.log('🤖 UserContext: Evaluating business selection logic', {
        hasBusinesses: businesses.owned.length > 0,
        selectedBusiness: selectedBusiness?.name || 'None',
        isUserChoice: isUserExplicitChoiceRef.current,
        hasRestored: hasRestoredFromCacheRef.current
      });

      // If user made an explicit choice, respect it
      if (isUserExplicitChoiceRef.current) {
        console.log('🤖 UserContext: Respecting user explicit choice, skipping auto-selection');
        return;
      }

      // If we haven't restored from cache yet, try to restore
      if (!hasRestoredFromCacheRef.current) {
        console.log('🤖 UserContext: Attempting to restore from cache');
        await restoreBusinessSelectionState();
        return;
      }

      // Validate current selection still exists
      if (selectedBusiness) {
        const stillExists = [...businesses.owned, ...businesses.joined].some(
          b => b.id === selectedBusiness.id
        );
        if (!stillExists) {
          console.log('🤖 UserContext: Selected business no longer exists, clearing selection');
          setSelectedBusinessInternal(null, false); // Don't mark as user choice
          return;
        }
      }

      // Only auto-select if: no businesses were available before, now there are some, and no current selection
      if (businesses.owned.length > 0 && !selectedBusiness) {
        console.log('🤖 UserContext: Auto-selecting first business (no previous selection)');
        setSelectedBusinessInternal(businesses.owned[0], false); // Don't mark as user choice
      }
    };

    handleBusinessSelectionLogic();
  }, [businesses.owned, businesses.joined, selectedBusiness, loading]);

  // Mark initial load as complete when loading finishes
  useEffect(() => {
    if (!loading && isInitialLoadRef.current) {
      console.log('🤖 UserContext: Initial load completed');
      isInitialLoadRef.current = false;
    }
  }, [loading]);

  // Enhanced cache management functions
  const saveUserToCache = async (userData: User) => {
    try {
      const cacheData = {
        data: userData,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEYS.USER_DATA, JSON.stringify(cacheData));
      await AsyncStorage.setItem(CACHE_KEYS.USER_EXPIRY, Date.now().toString());
      console.log('💾 UserContext: User data saved to cache:', userData.email);
    } catch (error) {
      console.error('❌ UserContext: Failed to save user to cache:', error);
    }
  };

  const loadUserFromCache = async (): Promise<User | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.USER_DATA);
      const expiryTime = await AsyncStorage.getItem(CACHE_KEYS.USER_EXPIRY);
      
      if (cachedData && expiryTime) {
        const expiry = parseInt(expiryTime);
        const now = Date.now();
        
        if (now - expiry < CACHE_DURATION) {
          const parsed = JSON.parse(cachedData);
          console.log('📱 UserContext: Loaded user from cache:', parsed.data?.email);
          return parsed.data;
        } else {
          console.log('⏰ UserContext: User cache expired, clearing');
          await AsyncStorage.removeItem(CACHE_KEYS.USER_DATA);
          await AsyncStorage.removeItem(CACHE_KEYS.USER_EXPIRY);
        }
      }
    } catch (error) {
      console.error('❌ UserContext: Failed to load user from cache:', error);
    }
    return null;
  };

  const saveBusinessesToCache = async (businessData: BusinessData) => {
    try {
      const cacheData = {
        data: businessData,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEYS.BUSINESS_DATA, JSON.stringify(cacheData));
      await AsyncStorage.setItem(CACHE_KEYS.BUSINESS_EXPIRY, Date.now().toString());
      console.log('💾 UserContext: Business data saved to cache');
    } catch (error) {
      console.error('❌ UserContext: Failed to save businesses to cache:', error);
    }
  };

  const loadBusinessesFromCache = async (): Promise<BusinessData | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.BUSINESS_DATA);
      const expiryTime = await AsyncStorage.getItem(CACHE_KEYS.BUSINESS_EXPIRY);
      
      if (cachedData && expiryTime) {
        const expiry = parseInt(expiryTime);
        const now = Date.now();
        
        if (now - expiry < CACHE_DURATION) {
          const parsed = JSON.parse(cachedData);
          console.log('📱 UserContext: Loaded businesses from cache');
          return parsed.data;
        } else {
          console.log('⏰ UserContext: Business cache expired, clearing');
          await AsyncStorage.removeItem(CACHE_KEYS.BUSINESS_DATA);
          await AsyncStorage.removeItem(CACHE_KEYS.BUSINESS_EXPIRY);
        }
      }
    } catch (error) {
      console.error('❌ UserContext: Failed to load businesses from cache:', error);
    }
    return null;
  };

  // NEW: Enhanced business selection state management
  const saveBusinessSelectionState = async (business: Business | null, isUserChoice: boolean) => {
    try {
      const selectionState: BusinessSelectionState = {
        selectedBusinessId: business?.id || null,
        isExplicitUserChoice: isUserChoice,
        timestamp: Date.now()
      };
      
      await AsyncStorage.multiSet([
        [CACHE_KEYS.SELECTED_BUSINESS, JSON.stringify(business)],
        [CACHE_KEYS.BUSINESS_SELECTION_STATE, JSON.stringify(selectionState)]
      ]);
      
      console.log('💾 UserContext: Saved business selection state:', {
        business: business?.name || 'You mode',
        isUserChoice,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ UserContext: Failed to save business selection state:', error);
    }
  };

  const restoreBusinessSelectionState = async () => {
    try {
      const [cachedBusiness, cachedState] = await AsyncStorage.multiGet([
        CACHE_KEYS.SELECTED_BUSINESS,
        CACHE_KEYS.BUSINESS_SELECTION_STATE
      ]);
      
      const businessData = cachedBusiness[1];
      const stateData = cachedState[1];
      
      if (businessData && stateData) {
        const business = JSON.parse(businessData);
        const selectionState: BusinessSelectionState = JSON.parse(stateData);
        
        console.log('🔄 UserContext: Restoring business selection state:', {
          business: business?.name || 'You mode',
          isUserChoice: selectionState.isExplicitUserChoice,
          timestamp: new Date(selectionState.timestamp).toISOString()
        });
        
        // Validate that the business still exists if it's not null
        if (business && businesses.owned.length > 0) {
          const stillExists = [...businesses.owned, ...businesses.joined].some(
            b => b.id === business.id
          );
          
          if (!stillExists) {
            console.log('🔄 UserContext: Cached business no longer exists, clearing selection');
            setSelectedBusinessInternal(null, false);
            hasRestoredFromCacheRef.current = true;
            return;
          }
        }
        
        // Restore the selection
        setSelectedBusinessState(business);
        isUserExplicitChoiceRef.current = selectionState.isExplicitUserChoice;
        hasRestoredFromCacheRef.current = true;
        
        console.log('✅ UserContext: Successfully restored business selection');
      } else {
        console.log('🔄 UserContext: No cached selection found');
        hasRestoredFromCacheRef.current = true;
      }
    } catch (error) {
      console.error('❌ UserContext: Failed to restore business selection state:', error);
      hasRestoredFromCacheRef.current = true;
    }
  };

  // NEW: Internal setter that tracks user choice
  const setSelectedBusinessInternal = (business: Business | null, isUserChoice: boolean) => {
    console.log('🔄 UserContext: Setting selected business (internal):', {
      business: business?.name || 'You mode',
      isUserChoice,
      timestamp: new Date().toISOString()
    });
    
    setSelectedBusinessState(business);
    isUserExplicitChoiceRef.current = isUserChoice;
    saveBusinessSelectionState(business, isUserChoice);
  };

  // Sync with AccountManager
  const syncWithAccountManager = () => {
    const allAccounts = accountManager.getAllAccounts();
    const current = accountManager.getCurrentAccount();
    
    setAccounts(allAccounts);
    setCurrentAccount(current);
    setUser(current?.userData || null);
    
    console.log('🔄 UserContext: Synced with AccountManager', {
      accounts: allAccounts.length,
      currentAccount: current?.email,
      hasAvatar: !!current?.userData?.avatar_url
    });
  };

  // Enhanced cache clearing with comprehensive cleanup
  const clearUserCache = async () => {
    try {
      console.log('🗑️ UserContext: Clearing all user cache including avatar...');
      
      const cacheKeys = [
        CACHE_KEYS.USER_DATA,
        CACHE_KEYS.USER_EXPIRY,
        CACHE_KEYS.BUSINESS_DATA,
        CACHE_KEYS.BUSINESS_EXPIRY,
        CACHE_KEYS.AVATAR_CACHE,
        'user_data', // Legacy keys
        'user_cache_expiry',
        'avatar_cache',
        'avatar_cache_expiry',
        'business_data',
        'cached_business_data',
        'business_cache_expiry',
        'cached_avatar_urls',
        'avatar_timestamps',
      ];
      
      await Promise.all(
        cacheKeys.map(key => AsyncStorage.removeItem(key).catch(() => {}))
      );
      
      console.log('✅ UserContext: Cache cleared successfully');
      
      // Trigger avatar refresh across all components
      setAvatarUpdateTrigger(Date.now());
      
    } catch (error) {
      console.error('❌ UserContext: Failed to clear cache:', error);
    }
  };

  // Force avatar refresh across all components
  const triggerAvatarRefresh = () => {
    console.log('🔄 UserContext: Triggering avatar refresh across all components');
    setAvatarUpdateTrigger(Date.now());
  };

  // Initialize AccountManager and sync data
  const initializeAccountManager = async () => {
    try {
      console.log('🚀 UserContext: Initializing AccountManager...');
      await accountManager.initialize();
      syncWithAccountManager();
      
      // If no current account but we have auth tokens, something is wrong
      const current = accountManager.getCurrentAccount();
      if (!current && accountManager.hasAccounts()) {
        console.log('⚠️ UserContext: No current account but accounts exist, clearing all');
        await accountManager.clearAllAccounts();
        await clearUserCache();
        await clearBusinessSelectionCache(); // NEW: Clear business selection
        syncWithAccountManager();
      }
      
    } catch (error) {
      console.error('❌ UserContext: Failed to initialize AccountManager:', error);
      setError('Failed to initialize account system');
    }
  };

  // NEW: Clear business selection cache
  const clearBusinessSelectionCache = async () => {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.SELECTED_BUSINESS,
        CACHE_KEYS.BUSINESS_SELECTION_STATE
      ]);
      console.log('🗑️ UserContext: Cleared business selection cache');
    } catch (error) {
      console.error('❌ UserContext: Failed to clear business selection cache:', error);
    }
  };

  // Enhanced setSelectedBusiness for external use (always treated as user choice)
  const setSelectedBusiness = (business: Business | null) => {
    console.log('🔄 UserContext: User selecting business:', business?.name || 'You mode');
    setSelectedBusinessInternal(business, true); // Mark as explicit user choice
  };

  // Enhanced refresh user data with proper caching
  const refreshUser = async (forceClearCache: boolean = false) => {
    try {
      const currentAcc = accountManager.getCurrentAccount();
      if (!currentAcc) {
        console.log('❌ UserContext: No current account for refresh');
        setUser(null);
        setError('No active account');
        return;
      }

      console.log('🔄 UserContext: Refreshing user data for:', currentAcc.email);
      
      // Clear cache if requested (important for avatar updates)
      if (forceClearCache) {
        console.log('🗑️ UserContext: Force clearing user cache before refresh');
        await clearUserCache();
      } else {
        // Try to load from cache first
        const cachedUser = await loadUserFromCache();
        if (cachedUser) {
          console.log('📱 UserContext: Using cached user data');
          setUser(cachedUser);
          
          // Update AccountManager with cached data
          await accountManager.updateAccount(currentAcc.id, cachedUser);
          syncWithAccountManager();
          setError(null);
          return;
        }
      }
      
      // Fetch fresh user data from API
      const fetchedUser = await getUser();
      
      if (fetchedUser) {
        console.log('✅ UserContext: User data refreshed from API:', {
          email: fetchedUser.email,
          avatarUrl: fetchedUser.avatar_url,
          timestamp: new Date().toISOString()
        });
        
        // Save to cache
        await saveUserToCache(fetchedUser);
        
        // Update AccountManager with fresh user data
        await accountManager.updateAccount(currentAcc.id, fetchedUser);
        
        // Set user state first
        setUser(fetchedUser);
        
        // Sync with updated data
        syncWithAccountManager();
        
        // Trigger avatar refresh if avatar changed
        const oldAvatarUrl = user?.avatar_url;
        const newAvatarUrl = fetchedUser.avatar_url;
        
        if (oldAvatarUrl !== newAvatarUrl) {
          console.log('🎭 UserContext: Avatar URL changed, triggering refresh', {
            old: oldAvatarUrl,
            new: newAvatarUrl
          });
          triggerAvatarRefresh();
        }
        
        setError(null);
        
      } else {
        console.log('❌ UserContext: No user data returned from API');
        setUser(null);
        setError('Failed to load user data');
      }
    } catch (err: any) {
      console.error('❌ UserContext: Failed to refresh user:', err);
      
      // Handle authentication errors
      if (err.response?.status === 401 || err.response?.status === 422) {
        console.log('🚪 UserContext: Authentication failed, logging out');
        setError('Session expired');
        await logout();
      } else {
        setError('Failed to load user data');
      }
    }
  };

  // Enhanced refresh businesses with proper caching
  const refreshBusinesses = async (forceClearCache: boolean = false) => {
    try {
      if (forceClearCache) {
        console.log('🗑️ UserContext: Force clearing business cache before refresh');
        await AsyncStorage.removeItem(CACHE_KEYS.BUSINESS_DATA);
        await AsyncStorage.removeItem(CACHE_KEYS.BUSINESS_EXPIRY);
      } else {
        // Try to load from cache first
        const cachedBusinesses = await loadBusinessesFromCache();
        if (cachedBusinesses) {
          console.log('📱 UserContext: Using cached business data');
          setBusinesses(cachedBusinesses);
          return;
        }
      }
      
      const businessData = await getBusinesses();
      setBusinesses(businessData);
      
      // Save to cache
      await saveBusinessesToCache(businessData);
      
      console.log('✅ UserContext: Businesses refreshed from API:', {
        owned: businessData.owned.length,
        joined: businessData.joined.length
      });
      
    } catch (err) {
      console.error('❌ UserContext: Failed to fetch businesses:', err);
      setBusinesses({ owned: [], joined: [] });
    }
  };

  // Add new account
  const addAccount = async (userData: User, token: string) => {
    try {
      console.log('➕ UserContext: Adding account:', userData.email);
      
      await accountManager.addAccount(userData, token);
      syncWithAccountManager();
      
      // Clear cache and refresh data for new account
      await clearUserCache();
      await clearBusinessSelectionCache(); // Clear business selection for new account
      await refreshUser(true);
      await refreshBusinesses(true);
      
      // Reset selection state for new account
      isUserExplicitChoiceRef.current = false;
      hasRestoredFromCacheRef.current = false;
      
      console.log('✅ UserContext: Account added successfully');
    } catch (error) {
      console.error('❌ UserContext: Failed to add account:', error);
      throw error;
    }
  };

  // Switch account
  const switchAccount = async (accountId: string) => {
    try {
      console.log('🔄 UserContext: Switching to account:', accountId);
      
      await accountManager.setCurrentAccount(accountId);
      syncWithAccountManager();
      
      // Clear cache and reset data for account switch
      await clearUserCache();
      await clearBusinessSelectionCache(); // Clear business selection for account switch
      setBusinesses({ owned: [], joined: [] });
      setSelectedBusinessState(null);
      
      // Reset selection state
      isUserExplicitChoiceRef.current = false;
      hasRestoredFromCacheRef.current = false;
      
      // Try to refresh data from API
      try {
        await refreshUser(true);
        await refreshBusinesses(true);
      } catch (apiError) {
        console.warn('⚠️ UserContext: Could not refresh from API, using cached data');
      }
      
      console.log('✅ UserContext: Account switched successfully');
    } catch (error) {
      console.error('❌ UserContext: Failed to switch account:', error);
      throw error;
    }
  };

  // Remove account
  const removeAccount = async (accountId: string) => {
    try {
      console.log('🗑️ UserContext: Removing account:', accountId);
      
      await accountManager.removeAccount(accountId);
      syncWithAccountManager();
      
      // If no accounts left, clear all data and cache
      if (!accountManager.hasAccounts()) {
        await clearUserCache();
        await clearBusinessSelectionCache();
        setBusinesses({ owned: [], joined: [] });
        setSelectedBusinessState(null);
        setError(null);
        
        // Reset selection state
        isUserExplicitChoiceRef.current = false;
        hasRestoredFromCacheRef.current = false;
      }
      
      console.log('✅ UserContext: Account removed successfully');
    } catch (error) {
      console.error('❌ UserContext: Failed to remove account:', error);
      throw error;
    }
  };

  // Complete logout
  const logout = async () => {
    try {
      console.log('🚪 UserContext: Logging out...');
      
      await accountManager.clearAllAccounts();
      await clearUserCache();
      await clearBusinessSelectionCache();
      
      // Reset all state
      setUser(null);
      setBusinesses({ owned: [], joined: [] });
      setSelectedBusinessState(null);
      setAccounts([]);
      setCurrentAccount(null);
      setError(null);
      
      // Reset avatar trigger and selection state
      setAvatarUpdateTrigger(Date.now());
      isUserExplicitChoiceRef.current = false;
      hasRestoredFromCacheRef.current = false;
      
      console.log('✅ UserContext: Logout completed');
    } catch (error) {
      console.error('❌ UserContext: Logout failed:', error);
      throw error;
    }
  };

  // Helper functions
  const getDisplayName = (): string => {
    if (!user) return 'User';
    
    if (user.display_name && user.display_name.trim()) {
      return user.display_name;
    }
    if (user.first_name && user.first_name.trim()) {
      return user.first_name;
    }
    if (user.username && user.username.trim()) {
      return user.username;
    }
    return 'User';
  };

  const getUserPhone = (): string => {
    if (!user) return '+254700000000';
    
    if (user.phone_number && user.phone_number.trim()) {
      return user.phone_number;
    }
    if (user.phone && user.phone.trim()) {
      return user.phone;
    }
    return '+254700000000';
  };

  // Updated to use selectedBusiness
  const getBusinessDisplayName = (): string => {
    if (selectedBusiness && selectedBusiness.name) {
      return selectedBusiness.name;
    }
    if (businesses.owned.length > 0 && businesses.owned[0].name) {
      return businesses.owned[0].name;
    }
    return getDisplayName();
  };

  // Auth helper functions that delegate to AccountManager
  const getCurrentToken = (): string | null => {
    return accountManager.getCurrentToken();
  };

  const getCurrentUserId = (): string | null => {
    return accountManager.getCurrentUserId();
  };

  const getCurrentRole = (): string | null => {
    return accountManager.getCurrentRole();
  };

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      console.log('🚀 UserContext: Starting initialization...');
      setLoading(true);
      
      try {
        await initializeAccountManager();
        
        // If we have a current account, try to refresh data
        const current = accountManager.getCurrentAccount();
        if (current) {
          console.log('🔑 UserContext: Found current account, refreshing data');
          try {
            await refreshUser(); // This will check cache first
            await refreshBusinesses(); // This will check cache first
          } catch (refreshError) {
            console.warn('⚠️ UserContext: Could not refresh data, using cached');
          }
        } else {
          console.log('❌ UserContext: No current account found');
          setError('Authentication required');
        }
        
      } catch (error) {
        console.error('❌ UserContext: Initialization failed:', error);
        setError('Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []); // Only run once on mount

  return (
    <UserContext.Provider
      value={{ 
        // Current user data
        user, 
        businesses,
        selectedBusiness,
        loading, 
        error, 
        
        // Account management
        accounts,
        currentAccount,
        
        // Avatar synchronization
        avatarUpdateTrigger,
        
        // Core methods
        refreshUser,
        refreshBusinesses,
        clearUserCache,
        addAccount,
        switchAccount,
        removeAccount,
        logout,
        
        // Avatar methods
        triggerAvatarRefresh,
        
        // Business selection
        setSelectedBusiness,
        
        // Helper functions
        getDisplayName,
        getUserPhone,
        getBusinessDisplayName,
        
        // Auth helpers
        getCurrentToken,
        getCurrentUserId,
        getCurrentRole,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
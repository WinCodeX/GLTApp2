// context/UserContext.tsx - Fixed with proper avatar synchronization
import React, {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
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
  avatarUpdateTrigger: number; // New: Force avatar refresh across components
  
  // Core methods
  refreshUser: (forceClearCache?: boolean) => Promise<void>;
  refreshBusinesses: (forceClearCache?: boolean) => Promise<void>;
  clearUserCache: () => Promise<void>;
  addAccount: (userData: User, token: string) => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Avatar methods
  triggerAvatarRefresh: () => void; // New: Force all components to refresh avatar
  
  // Business selection
  setSelectedBusiness: (business: Business | null) => void;
  
  // Helper functions
  getDisplayName: () => string;
  getUserPhone: () => string;
  getBusinessDisplayName: () => string;
  
  // Auth helpers - these now pull from AccountManager
  getCurrentToken: () => string | null;
  getCurrentUserId: () => string | null;
  getCurrentRole: () => string | null;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<BusinessData>({ owned: [], joined: [] });
  const [selectedBusiness, setSelectedBusinessState] = useState<Business | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [currentAccount, setCurrentAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New: Avatar synchronization trigger
  const [avatarUpdateTrigger, setAvatarUpdateTrigger] = useState(Date.now());

  // Auto-select first business when businesses change
  useEffect(() => {
    if (businesses.owned.length > 0 && !selectedBusiness) {
      console.log('🔄 UserContext: Auto-selecting first business:', businesses.owned[0].name);
      setSelectedBusinessState(businesses.owned[0]);
    } else if (businesses.owned.length === 0 && selectedBusiness) {
      console.log('🔄 UserContext: No businesses available, clearing selection');
      setSelectedBusinessState(null);
    }
  }, [businesses.owned, selectedBusiness]);

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

  // Enhanced cache clearing with avatar-specific cache
  const clearUserCache = async () => {
    try {
      console.log('🗑️ UserContext: Clearing all user cache including avatar...');
      
      const cacheKeys = [
        'user_data',
        'user_cache_expiry',
        'avatar_cache',
        'avatar_cache_expiry',
        'business_data',
        'cached_business_data',
        'business_cache_expiry',
        'selected_business',
        // Add more avatar-related cache keys
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

  // New: Force avatar refresh across all components
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
        syncWithAccountManager();
      }
      
      // Try to restore selected business from cache
      await restoreSelectedBusiness();
      
    } catch (error) {
      console.error('❌ UserContext: Failed to initialize AccountManager:', error);
      setError('Failed to initialize account system');
    }
  };

  // Restore selected business from cache
  const restoreSelectedBusiness = async () => {
    try {
      const cached = await AsyncStorage.getItem('selected_business');
      if (cached) {
        const business = JSON.parse(cached);
        console.log('🔄 UserContext: Restored selected business from cache:', business.name);
        setSelectedBusinessState(business);
      }
    } catch (error) {
      console.error('❌ UserContext: Failed to restore selected business:', error);
    }
  };

  // Save selected business to cache
  const saveSelectedBusiness = async (business: Business | null) => {
    try {
      if (business) {
        await AsyncStorage.setItem('selected_business', JSON.stringify(business));
        console.log('💾 UserContext: Saved selected business to cache:', business.name);
      } else {
        await AsyncStorage.removeItem('selected_business');
        console.log('🗑️ UserContext: Removed selected business from cache');
      }
    } catch (error) {
      console.error('❌ UserContext: Failed to save selected business:', error);
    }
  };

  // Enhanced setSelectedBusiness with caching
  const setSelectedBusiness = (business: Business | null) => {
    console.log('🔄 UserContext: Setting selected business:', business?.name || 'None');
    setSelectedBusinessState(business);
    saveSelectedBusiness(business);
  };

  // Enhanced refresh user data with better avatar synchronization
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
      }
      
      // Fetch fresh user data
      const fetchedUser = await getUser();
      
      if (fetchedUser) {
        console.log('✅ UserContext: User data refreshed:', {
          email: fetchedUser.email,
          avatarUrl: fetchedUser.avatar_url,
          timestamp: new Date().toISOString()
        });
        
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

  // Refresh businesses with optional cache clearing
  const refreshBusinesses = async (forceClearCache: boolean = false) => {
    try {
      if (forceClearCache) {
        console.log('🗑️ UserContext: Force clearing business cache before refresh');
        const businessCacheKeys = [
          'business_data',
          'cached_business_data', 
          'business_cache_expiry'
        ];
        await Promise.all(
          businessCacheKeys.map(key => AsyncStorage.removeItem(key).catch(() => {}))
        );
      }
      
      const businessData = await getBusinesses();
      setBusinesses(businessData);
      console.log('✅ UserContext: Businesses refreshed:', {
        owned: businessData.owned.length,
        joined: businessData.joined.length
      });

      // Validate current selected business still exists
      if (selectedBusiness) {
        const stillExists = [...businessData.owned, ...businessData.joined].some(
          b => b.id === selectedBusiness.id
        );
        if (!stillExists) {
          console.log('⚠️ UserContext: Selected business no longer exists, clearing selection');
          setSelectedBusiness(null);
        }
      }
      
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
      await refreshUser(true);
      await refreshBusinesses(true);
      
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
      setBusinesses({ owned: [], joined: [] });
      setSelectedBusiness(null);
      
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
        setBusinesses({ owned: [], joined: [] });
        setSelectedBusiness(null);
        setError(null);
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
      
      // Reset all state
      setUser(null);
      setBusinesses({ owned: [], joined: [] });
      setSelectedBusiness(null);
      setAccounts([]);
      setCurrentAccount(null);
      setError(null);
      
      // Reset avatar trigger
      setAvatarUpdateTrigger(Date.now());
      
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
            await refreshUser();
            await refreshBusinesses();
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
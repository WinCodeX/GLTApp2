// context/UserContext.tsx - Fixed with robust account management and AsyncStorage persistence
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
import * as SecureStore from 'expo-secure-store';

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

type SavedAccount = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  token: string;
  userData: User;
};

type UserContextType = {
  user: User | null;
  businesses: BusinessData;
  savedAccounts: SavedAccount[];
  currentAccountIndex: number;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  refreshBusinesses: () => Promise<void>;
  addAccount: (userData: User, token: string) => Promise<void>;
  switchAccount: (accountIndex: number) => Promise<void>;
  removeAccount: (accountIndex: number) => Promise<void>;
  // Helper functions
  getDisplayName: () => string;
  getUserPhone: () => string;
  getBusinessDisplayName: () => string;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<BusinessData>({ owned: [], joined: [] });
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ENHANCED: Load saved accounts with better error handling
  const loadSavedAccounts = async () => {
    try {
      const savedAccountsData = await AsyncStorage.getItem('saved_accounts');
      const currentAccountData = await AsyncStorage.getItem('current_account_index');
      
      if (savedAccountsData) {
        const accounts = JSON.parse(savedAccountsData);
        console.log('📱 Loaded saved accounts:', accounts.length);
        setSavedAccounts(accounts);
        
        if (currentAccountData) {
          const accountIndex = parseInt(currentAccountData);
          // Validate the index before setting it
          if (accountIndex >= 0 && accountIndex < accounts.length) {
            setCurrentAccountIndex(accountIndex);
            console.log('✅ Set current account index:', accountIndex);
          } else {
            console.log('⚠️ Invalid stored account index, resetting to 0');
            setCurrentAccountIndex(0);
            await AsyncStorage.setItem('current_account_index', '0');
          }
        }
      } else {
        console.log('📱 No saved accounts found');
        setSavedAccounts([]);
        setCurrentAccountIndex(0);
      }
    } catch (error) {
      console.error('❌ Failed to load saved accounts:', error);
      setSavedAccounts([]);
      setCurrentAccountIndex(0);
    }
  };

  // ENHANCED: Save accounts with validation
  const saveSavedAccounts = async (accounts: SavedAccount[], currentIndex?: number) => {
    try {
      // Validate accounts array
      if (!Array.isArray(accounts)) {
        console.error('❌ Invalid accounts array provided to saveSavedAccounts');
        return;
      }

      await AsyncStorage.setItem('saved_accounts', JSON.stringify(accounts));
      console.log('💾 Saved accounts to storage:', accounts.length);
      
      if (currentIndex !== undefined) {
        // Validate index before saving
        if (currentIndex >= 0 && currentIndex < accounts.length) {
          await AsyncStorage.setItem('current_account_index', currentIndex.toString());
          console.log('💾 Saved current account index:', currentIndex);
        } else {
          console.log('⚠️ Invalid current index provided, not saving');
        }
      }
    } catch (error) {
      console.error('❌ Failed to save accounts:', error);
      throw new Error('Failed to save account data');
    }
  };

  // ENHANCED: Robust user refresh with better error handling
  const refreshUser = async () => {
    try {
      console.log('🔄 Refreshing user data from API...');
      
      // Check if we have auth tokens
      const authToken = await SecureStore.getItemAsync('auth_token');
      const userId = await SecureStore.getItemAsync('user_id');
      
      if (!authToken || !userId) {
        console.log('❌ No auth tokens found');
        setUser(null);
        setError('Authentication required');
        return;
      }

      // Make API call to validate and refresh user data
      const fetchedUser = await getUser();
      
      if (fetchedUser) {
        console.log('✅ User data refreshed from API:', fetchedUser.email);
        setUser(fetchedUser);
        setError(null);
        
        // Save user data to AsyncStorage for persistence
        await AsyncStorage.setItem('user_data', JSON.stringify(fetchedUser));
        
        // Update saved account data if this user exists in saved accounts
        if (savedAccounts.length > 0 && currentAccountIndex < savedAccounts.length) {
          const updatedAccounts = [...savedAccounts];
          const currentAccountData = updatedAccounts[currentAccountIndex];
          
          if (currentAccountData && currentAccountData.id === fetchedUser.id) {
            updatedAccounts[currentAccountIndex] = {
              ...currentAccountData,
              userData: fetchedUser,
              display_name: fetchedUser.display_name || fetchedUser.first_name || fetchedUser.email,
              avatar_url: fetchedUser.avatar_url
            };
            setSavedAccounts(updatedAccounts);
            await saveSavedAccounts(updatedAccounts);
          }
        }
      } else {
        console.log('❌ No user data returned from API');
        setUser(null);
        setError('Failed to load user data');
      }
    } catch (err: any) {
      console.error('❌ Failed to refresh user:', err);
      setUser(null);
      
      // Handle 401 unauthorized
      if (err.response?.status === 401) {
        setError('Session expired');
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('user_id');
        await SecureStore.deleteItemAsync('user_role');
        await AsyncStorage.removeItem('user_data');
      } else {
        setError('Failed to load user data');
      }
    }
  };

  const refreshBusinesses = async () => {
    try {
      const businessData = await getBusinesses();
      setBusinesses(businessData);
    } catch (err) {
      console.error('Failed to fetch businesses:', err);
      setBusinesses({ owned: [], joined: [] });
    }
  };

  // ENHANCED: Robust addAccount with proper validation and persistence
  const addAccount = async (userData: User, token: string) => {
    try {
      console.log('➕ Adding account:', userData.email);
      
      // Validate inputs
      if (!userData || !userData.id || !userData.email || !token) {
        throw new Error('Invalid user data or token provided');
      }

      // Check if account already exists
      const existingAccountIndex = savedAccounts.findIndex(acc => acc.id === userData.id);
      if (existingAccountIndex !== -1) {
        console.log('🔄 Account already exists, updating and switching to it');
        await switchAccount(existingAccountIndex);
        return;
      }

      if (savedAccounts.length >= 3) {
        throw new Error('Maximum of 3 accounts allowed');
      }

      const newAccount: SavedAccount = {
        id: userData.id,
        email: userData.email,
        display_name: userData.display_name || userData.first_name || userData.email,
        avatar_url: userData.avatar_url,
        token: token,
        userData: userData
      };

      // Update state first, then persist
      const updatedAccounts = [...savedAccounts, newAccount];
      setSavedAccounts(updatedAccounts);
      
      // Save to AsyncStorage
      await saveSavedAccounts(updatedAccounts);

      // Switch to the new account - use the correct index
      const newAccountIndex = updatedAccounts.length - 1;
      console.log('🔄 Switching to new account at index:', newAccountIndex);
      
      // Update auth tokens
      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('user_id', userData.id);
      
      const roles = userData.roles || [];
      const role = roles.includes('admin') ? 'admin' : 'client';
      await SecureStore.setItemAsync('user_role', role);
      
      // Update current account index
      setCurrentAccountIndex(newAccountIndex);
      await AsyncStorage.setItem('current_account_index', newAccountIndex.toString());
      
      // Set user data
      setUser(userData);
      setError(null);
      
      console.log('✅ Account added and switched successfully:', newAccount.email);
    } catch (error) {
      console.error('❌ Failed to add account:', error);
      throw error;
    }
  };

  // ENHANCED: Robust switchAccount with proper validation
  const switchAccount = async (accountIndex: number) => {
    try {
      console.log('🔄 Switching to account index:', accountIndex);
      
      // Validate account index against current savedAccounts array
      if (accountIndex < 0 || accountIndex >= savedAccounts.length) {
        console.error('❌ Invalid account index:', { 
          requestedIndex: accountIndex, 
          availableAccounts: savedAccounts.length 
        });
        throw new Error(`Invalid account index: ${accountIndex}. Available accounts: ${savedAccounts.length}`);
      }

      const account = savedAccounts[accountIndex];
      
      if (!account) {
        throw new Error('Account not found at the specified index');
      }

      console.log('🔄 Switching to account:', account.email);
      
      // Update secure store with new account's token
      await SecureStore.setItemAsync('auth_token', account.token);
      await SecureStore.setItemAsync('user_id', account.id);
      
      // Determine and save role
      const roles = account.userData.roles || [];
      const role = roles.includes('admin') ? 'admin' : 'client';
      await SecureStore.setItemAsync('user_role', role);
      
      // Update current account index
      setCurrentAccountIndex(accountIndex);
      await AsyncStorage.setItem('current_account_index', accountIndex.toString());
      
      // Set user data from saved account
      setUser(account.userData);
      setError(null);
      
      // Try to refresh user data from API if possible
      try {
        setLoading(true);
        await refreshUser();
        await refreshBusinesses();
      } catch (apiError) {
        console.warn('⚠️ Could not refresh from API, using cached data');
      } finally {
        setLoading(false);
      }
      
      console.log('✅ Successfully switched to account:', account.email);
    } catch (error) {
      console.error('❌ Failed to switch account:', error);
      setLoading(false);
      throw error;
    }
  };

  // ENHANCED: Robust removeAccount with proper validation
  const removeAccount = async (accountIndex: number) => {
    try {
      console.log('🗑️ Removing account at index:', accountIndex);
      
      // Validate account index
      if (accountIndex < 0 || accountIndex >= savedAccounts.length) {
        console.error('❌ Invalid account index for removal:', { 
          requestedIndex: accountIndex, 
          availableAccounts: savedAccounts.length 
        });
        throw new Error(`Invalid account index: ${accountIndex}. Available accounts: ${savedAccounts.length}`);
      }

      const accountToRemove = savedAccounts[accountIndex];
      if (!accountToRemove) {
        throw new Error('Account not found at the specified index');
      }

      console.log('🗑️ Removing account:', accountToRemove.email);

      // Create updated accounts array
      const updatedAccounts = savedAccounts.filter((_, index) => index !== accountIndex);
      setSavedAccounts(updatedAccounts);

      if (updatedAccounts.length === 0) {
        // No accounts left, clear everything
        console.log('🧹 No accounts left, clearing all data');
        setUser(null);
        setCurrentAccountIndex(0);
        setBusinesses({ owned: [], joined: [] });
        
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('user_id');
        await SecureStore.deleteItemAsync('user_role');
        await AsyncStorage.removeItem('current_account_index');
        await AsyncStorage.removeItem('saved_accounts');
        await AsyncStorage.removeItem('user_data');
      } else {
        // Save updated accounts list
        await saveSavedAccounts(updatedAccounts);
        
        // If we removed the current account, switch to another one
        if (accountIndex === currentAccountIndex) {
          console.log('🔄 Removed current account, switching to first available');
          const newCurrentIndex = 0; // Always switch to first account
          await switchAccount(newCurrentIndex);
        } else if (accountIndex < currentAccountIndex) {
          // Adjust current index if we removed an account before it
          const newCurrentIndex = currentAccountIndex - 1;
          setCurrentAccountIndex(newCurrentIndex);
          await AsyncStorage.setItem('current_account_index', newCurrentIndex.toString());
        }
        // If accountIndex > currentAccountIndex, no adjustment needed
      }
      
      console.log('✅ Account removed successfully');
    } catch (error) {
      console.error('❌ Failed to remove account:', error);
      throw error;
    }
  };

  // Helper function to get display name with fallback logic
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
    return 'You';
  };

  // Helper function to get user phone with fallback
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

  // Helper function to get business display name
  const getBusinessDisplayName = (): string => {
    if (businesses.owned.length > 0 && businesses.owned[0].name) {
      return businesses.owned[0].name;
    }
    return getDisplayName();
  };

  // ENHANCED: Robust initialization with proper error handling
  useEffect(() => {
    const initializeData = async () => {
      console.log('🚀 UserContext: Initializing...');
      setLoading(true);
      
      try {
        // First, load saved accounts
        await loadSavedAccounts();
        
        // Then, validate current session
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        
        if (authToken && userId) {
          console.log('🔑 Found auth tokens, validating with server...');
          
          // Try to load user data from AsyncStorage first for immediate UI
          try {
            const storedUserData = await AsyncStorage.getItem('user_data');
            if (storedUserData) {
              const parsedUser = JSON.parse(storedUserData);
              console.log('📱 Loaded user from AsyncStorage:', parsedUser.email);
              setUser(parsedUser);
              setError(null);
            }
          } catch (storageError) {
            console.warn('⚠️ Could not load user from AsyncStorage:', storageError);
          }
          
          // Then validate with API call
          try {
            await refreshUser();
            await refreshBusinesses();
          } catch (apiError) {
            console.warn('⚠️ API validation failed, using cached data:', apiError);
          }
        } else {
          console.log('❌ No auth tokens found');
          setUser(null);
          setError('Authentication required');
        }
      } catch (error) {
        console.error('❌ Failed to initialize user data:', error);
        setError('Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []); // Only run once on mount

  // Load businesses when user changes (after successful validation)
  useEffect(() => {
    if (user && !loading) {
      console.log('👤 User validated, loading businesses...');
      refreshBusinesses();
    }
  }, [user, loading]);

  return (
    <UserContext.Provider
      value={{ 
        user, 
        businesses,
        savedAccounts,
        currentAccountIndex,
        loading, 
        error, 
        refreshUser,
        refreshBusinesses,
        addAccount,
        switchAccount,
        removeAccount,
        getDisplayName,
        getUserPhone,
        getBusinessDisplayName
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
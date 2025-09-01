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

  // Load saved accounts from AsyncStorage
  const loadSavedAccounts = async () => {
    try {
      const savedAccountsData = await AsyncStorage.getItem('saved_accounts');
      const currentAccountData = await AsyncStorage.getItem('current_account_index');
      
      if (savedAccountsData) {
        const accounts = JSON.parse(savedAccountsData);
        setSavedAccounts(accounts);
        
        if (currentAccountData) {
          const accountIndex = parseInt(currentAccountData);
          setCurrentAccountIndex(accountIndex);
        }
      }
    } catch (error) {
      console.error('Failed to load saved accounts:', error);
    }
  };

  // Save accounts to AsyncStorage
  const saveSavedAccounts = async (accounts: SavedAccount[], currentIndex?: number) => {
    try {
      await AsyncStorage.setItem('saved_accounts', JSON.stringify(accounts));
      if (currentIndex !== undefined) {
        await AsyncStorage.setItem('current_account_index', currentIndex.toString());
      }
    } catch (error) {
      console.error('Failed to save accounts:', error);
    }
  };

  // RESTORED: Original API validation flow
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
        
        // Update saved account data if this user exists in saved accounts
        const updatedAccounts = [...savedAccounts];
        const currentAccountData = updatedAccounts[currentAccountIndex];
        
        if (currentAccountData && currentAccountData.id === fetchedUser.id) {
          updatedAccounts[currentAccountIndex] = {
            ...currentAccountData,
            userData: fetchedUser
          };
          setSavedAccounts(updatedAccounts);
          await saveSavedAccounts(updatedAccounts);
        }
      } else {
        console.log('❌ No user data returned from API');
        setUser(null);
        setError('Failed to load user data');
      }
    } catch (err: any) {
      console.error('❌ Failed to refresh user:', err);
      setUser(null);
      
      // Handle 401 unauthorized - clear tokens and redirect will be handled by API interceptor
      if (err.response?.status === 401) {
        setError('Session expired');
        // Clear current user data
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

  const addAccount = async (userData: User, token: string) => {
    try {
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

      const updatedAccounts = [...savedAccounts, newAccount];
      setSavedAccounts(updatedAccounts);
      await saveSavedAccounts(updatedAccounts);

      // Switch to the new account
      const newAccountIndex = updatedAccounts.length - 1;
      await switchAccount(newAccountIndex);
      
      console.log('Account added successfully:', newAccount.email);
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  };

  const switchAccount = async (accountIndex: number) => {
    try {
      if (accountIndex < 0 || accountIndex >= savedAccounts.length) {
        throw new Error('Invalid account index');
      }

      const account = savedAccounts[accountIndex];
      
      // Update secure store with new account's token
      await SecureStore.setItemAsync('auth_token', account.token);
      await SecureStore.setItemAsync('user_id', account.id);
      
      // Update current account index
      setCurrentAccountIndex(accountIndex);
      await AsyncStorage.setItem('current_account_index', accountIndex.toString());
      
      // IMPORTANT: Refresh user data from API to validate the account
      setLoading(true);
      await refreshUser();
      await refreshBusinesses();
      setLoading(false);
      
      console.log('Switched to account:', account.email);
    } catch (error) {
      console.error('Failed to switch account:', error);
      setLoading(false);
      throw error;
    }
  };

  const removeAccount = async (accountIndex: number) => {
    try {
      if (accountIndex < 0 || accountIndex >= savedAccounts.length) {
        throw new Error('Invalid account index');
      }

      const updatedAccounts = savedAccounts.filter((_, index) => index !== accountIndex);
      setSavedAccounts(updatedAccounts);

      if (updatedAccounts.length === 0) {
        // No accounts left, clear everything
        setUser(null);
        setCurrentAccountIndex(0);
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('user_id');
        await SecureStore.deleteItemAsync('user_role');
        await AsyncStorage.removeItem('current_account_index');
        await AsyncStorage.removeItem('saved_accounts');
        await AsyncStorage.removeItem('user_data');
      } else {
        // If we removed the current account, switch to the first one
        const newCurrentIndex = accountIndex === currentAccountIndex 
          ? Math.min(currentAccountIndex, updatedAccounts.length - 1)
          : currentAccountIndex > accountIndex 
            ? currentAccountIndex - 1 
            : currentAccountIndex;
        
        await saveSavedAccounts(updatedAccounts, newCurrentIndex);
        await switchAccount(newCurrentIndex);
      }
    } catch (error) {
      console.error('Failed to remove account:', error);
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

  // RESTORED: Original initialization flow with API validation
  useEffect(() => {
    const initializeData = async () => {
      console.log('🚀 UserContext: Initializing...');
      setLoading(true);
      
      try {
        // First, load saved accounts
        await loadSavedAccounts();
        
        // Then, validate current session with API call (this is the key part that was missing)
        const authToken = await SecureStore.getItemAsync('auth_token');
        const userId = await SecureStore.getItemAsync('user_id');
        
        if (authToken && userId) {
          console.log('🔑 Found auth tokens, validating with server...');
          // This will make the API call to /api/v1/me
          await refreshUser();
          
          // Only load businesses if user validation succeeded
          if (user) {
            await refreshBusinesses();
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

  // Load businesses when user changes (after successful API validation)
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
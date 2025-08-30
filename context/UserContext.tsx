import React, {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
} from 'react';
import { getUser } from '../lib/helpers/getUser';

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

type UserContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  // Helper functions
  getDisplayName: () => string;
  getUserPhone: () => string;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshUser = async () => {
    // Prevent overlapping fetches
    if (refreshing) return;
    setRefreshing(true);
    setError(null);

    try {
      const fetchedUser = await getUser();
      setUser(fetchedUser || null);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setUser(null);
      setError('Failed to load user data.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Helper function to get display name with fallback logic
  const getDisplayName = (): string => {
    if (!user) return 'User';
    
    // Priority: display_name -> first_name -> username -> "You"
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
    
    // Try phone_number first, then phone, then fallback
    if (user.phone_number && user.phone_number.trim()) {
      return user.phone_number;
    }
    if (user.phone && user.phone.trim()) {
      return user.phone;
    }
    return '+254700000000'; // Default fallback
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider
      value={{ 
        user, 
        loading, 
        error, 
        refreshUser,
        getDisplayName,
        getUserPhone
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
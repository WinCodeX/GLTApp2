// lib/auth.ts - Authentication service integration
import * as SecureStore from 'expo-secure-store';
import jwtDecode from 'jwt-decode';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import api, { getCurrentApiBaseUrl, initializeApi } from '@/lib/api';


interface DecodedToken {
  exp: number;
  user_id?: string | number;
  [key: string]: any;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await SecureStore.getItemAsync('auth_token');
  if (!token) return false;

  try {
    const decoded: DecodedToken = jwtDecode(token);
    const currentTime = Math.floor(Date.now() / 1000);

    // Save user_id if it isn't already stored
    const storedUserId = await SecureStore.getItemAsync('user_id');
    if (!storedUserId && decoded.user_id) {
      await SecureStore.setItemAsync('user_id', String(decoded.user_id));
    }

    return decoded.exp > currentTime;
  } catch (e) {
    console.error('[auth.ts] JWT decode error:', e);
    return false;
  }
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  display_name: string;
  google_user: boolean;
  needs_password: boolean;
  profile_complete: boolean;
  primary_role: string;
  roles: string[];
  avatar_url?: string;
  google_image_url?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  message: string;
  user?: User;
  auth_method?: string;
  is_new_user?: boolean;
  code?: string;
  errors?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  password_confirmation: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

class AuthService {
  private currentUser: User | null = null;
  private isInitialized = false;

  // ==========================================
  // 🔧 INITIALIZATION
  // ==========================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔐 Initializing AuthService...');
      
      // Initialize API first
      await initializeApi();
      
      // Try to restore user session
      await this.restoreSession();
      
      this.isInitialized = true;
      console.log('✅ AuthService initialized');
    } catch (error) {
      console.error('❌ AuthService initialization failed:', error);
      this.isInitialized = true; // Set to true anyway to prevent retries
    }
  }

  // ==========================================
  // 🔐 GOOGLE AUTHENTICATION
  // ==========================================

  async authenticateWithGoogle(googleToken: string): Promise<{ success: boolean; user?: User; isNewUser?: boolean }> {
    try {
      console.log('🔐 Authenticating with Google via backend...');
      console.log('🌐 API Base URL:', getCurrentApiBaseUrl());
      
      const response = await api.post<AuthResponse>('/auth/google/login', {
        credential: googleToken,
        token: googleToken,
        id_token: googleToken,
        access_token: googleToken
      });
      
      if (response.data.status === 'success' && response.data.user) {
        const { user } = response.data;
        
        // ✅ Extract JWT token from response headers (devise-jwt)
        const jwtToken = response.headers['authorization']?.replace('Bearer ', '') ||
                        response.data.token ||
                        response.headers['x-auth-token'];
        
        if (jwtToken) {
          await this.storeAuthData(jwtToken, user);
        } else {
          console.warn('⚠️ No JWT token in response - checking if devise-jwt is working');
        }
        
        this.currentUser = user;
        
        console.log('✅ Google authentication successful:', user.email);
        
        return {
          success: true,
          user,
          isNewUser: response.data.is_new_user
        };
      } else {
        console.error('❌ Backend authentication failed:', response.data.message);
        return {
          success: false
        };
      }
    } catch (error: any) {
      console.error('❌ Google authentication error:', error);
      
      // Handle specific error cases
      if (error.response?.status === 400) {
        throw new Error('Invalid Google token');
      } else if (error.response?.status === 401) {
        throw new Error('Google token validation failed');
      } else if (error.response?.status === 409) {
        throw new Error('Email already registered with password. Please sign in with email and password.');
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        throw new Error('Network connection failed. Please check your internet connection.');
      } else {
        throw new Error(error.response?.data?.message || 'Authentication failed');
      }
    }
  }

  // ==========================================
  // 🔐 EMAIL/PASSWORD AUTHENTICATION
  // ==========================================

  async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User }> {
    try {
      console.log('🔐 Logging in with email/password...');
      
      const response = await api.post<AuthResponse>('/login', {
        user: credentials
      });
      
      if (response.data.status === 'success' && response.data.user) {
        const { user } = response.data;
        
        // Extract JWT token
        const jwtToken = response.headers['authorization']?.replace('Bearer ', '') ||
                        response.data.token ||
                        response.headers['x-auth-token'];
        
        if (jwtToken) {
          await this.storeAuthData(jwtToken, user);
        }
        
        this.currentUser = user;
        
        console.log('✅ Email login successful:', user.email);
        
        return {
          success: true,
          user
        };
      } else {
        return {
          success: false
        };
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  async register(credentials: RegisterCredentials): Promise<{ success: boolean; user?: User }> {
    try {
      console.log('📝 Registering new user...');
      
      const response = await api.post<AuthResponse>('/signup', {
        user: credentials
      });
      
      if (response.data.status === 'success' && response.data.user) {
        const { user } = response.data;
        
        // Extract JWT token
        const jwtToken = response.headers['authorization']?.replace('Bearer ', '') ||
                        response.data.token ||
                        response.headers['x-auth-token'];
        
        if (jwtToken) {
          await this.storeAuthData(jwtToken, user);
        }
        
        this.currentUser = user;
        
        console.log('✅ Registration successful:', user.email);
        
        return {
          success: true,
          user
        };
      } else {
        return {
          success: false
        };
      }
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  }

  // ==========================================
  // 🔐 SESSION MANAGEMENT
  // ==========================================

  async logout(): Promise<void> {
    try {
      console.log('🚪 Logging out...');
      
      // Call backend logout endpoint
      await api.delete('/logout');
      
      // Clear local storage
      await this.clearAuthData();
      
      this.currentUser = null;
      
      console.log('✅ Logout successful');
      
      // Navigate to login screen
      router.replace('/login');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // Clear local data even if backend call fails
      await this.clearAuthData();
      this.currentUser = null;
      router.replace('/login');
    }
  }

  async restoreSession(): Promise<User | null> {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const userData = await SecureStore.getItemAsync('user_data');
      
      if (token && userData) {
        const user = JSON.parse(userData) as User;
        this.currentUser = user;
        console.log('✅ Session restored for:', user.email);
        return user;
      } else {
        console.log('📱 No stored session found');
        return null;
      }
    } catch (error) {
      console.error('❌ Session restoration failed:', error);
      await this.clearAuthData();
      return null;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }
    
    return await this.restoreSession();
  }

  async refreshUserData(): Promise<User | null> {
    try {
      const response = await api.get<{ status: string; user: User }>('/users/me');
      
      if (response.data.status === 'success' && response.data.user) {
        const user = response.data.user;
        this.currentUser = user;
        
        // Update stored user data
        await SecureStore.setItemAsync('user_data', JSON.stringify(user));
        
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to refresh user data:', error);
      return null;
    }
  }

  // ==========================================
  // 🗃️ STORAGE HELPERS
  // ==========================================

  private async storeAuthData(token: string, user: User): Promise<void> {
    try {
      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('user_id', user.id.toString());
      await SecureStore.setItemAsync('user_role', user.primary_role);
      await SecureStore.setItemAsync('user_data', JSON.stringify(user));
      
      console.log('🔐 Auth data stored successfully');
    } catch (error) {
      console.error('❌ Failed to store auth data:', error);
      throw new Error('Failed to store authentication data');
    }
  }

  private async clearAuthData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_id');
      await SecureStore.deleteItemAsync('user_role');
      await SecureStore.deleteItemAsync('user_data');
      
      console.log('🗑️ Auth data cleared');
    } catch (error) {
      console.error('❌ Failed to clear auth data:', error);
    }
  }

  // ==========================================
  // 🔍 UTILITY METHODS
  // ==========================================

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  hasRole(role: string): boolean {
    return this.currentUser?.roles.includes(role) || false;
  }

  getPrimaryRole(): string | null {
    return this.currentUser?.primary_role || null;
  }

  isGoogleUser(): boolean {
    return this.currentUser?.google_user || false;
  }

  needsProfileCompletion(): boolean {
    if (!this.currentUser) return false;
    
    return this.currentUser.google_user && (
      !this.currentUser.first_name ||
      !this.currentUser.last_name ||
      !this.currentUser.profile_complete
    );
  }

  async checkEmailAvailability(email: string): Promise<{ available: boolean; authMethod?: string }> {
    try {
      const response = await api.get(`/registrations/check_email_availability?email=${encodeURIComponent(email)}`);
      
      return {
        available: response.data.status === 'available',
        authMethod: response.data.auth_method
      };
    } catch (error) {
      console.error('❌ Email availability check failed:', error);
      throw new Error('Failed to check email availability');
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();
export default authService;
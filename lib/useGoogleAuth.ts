// lib/useGoogleAuth.ts - Rewritten for Rails Web OAuth
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { getCurrentApiBaseUrl } from '@/lib/api';

WebBrowser.maybeCompleteAuthSession();

interface AuthSuccessUser {
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
}

export function useGoogleAuth(onAuthSuccess: (user: AuthSuccessUser, isNewUser?: boolean) => void) {
  const processingRef = useRef(false);

  // ==========================================
  // 🌐 WEB OAUTH WITH RAILS BACKEND
  // ==========================================

  const signInWithGoogle = useCallback(async () => {
    if (processingRef.current) {
      console.log('⏳ Authentication already in progress');
      return;
    }

    processingRef.current = true;

    try {
      console.log('🌐 Starting Rails Google OAuth flow...');
      
      // Get your Rails server base URL
      const baseUrl = getCurrentApiBaseUrl().replace('/api/v1', ''); // Remove API path
      console.log('🔗 Using base URL:', baseUrl);
      
      // Create a unique state parameter for security
      const state = generateSecureState();
      
      // Construct the OAuth URL to your Rails server
      const oauthUrl = `${baseUrl}/api/v1/auth/google_oauth2/init?state=${state}&mobile=true`;
      console.log('🚀 Opening OAuth URL:', oauthUrl);
      
      // Open the web browser to your Rails OAuth endpoint
      const result = await WebBrowser.openAuthSessionAsync(
        oauthUrl,
        `${baseUrl}/oauth/mobile/success`, // Your Rails success redirect URL
        {
          showInRecents: false,
          createTask: false,
        }
      );

      console.log('📋 WebBrowser result:', result.type);

      if (result.type === 'success') {
        // Extract data from the success URL
        const url = result.url;
        console.log('✅ OAuth success URL:', url);
        
        // Parse the success URL to extract token and user data
        await handleOAuthSuccess(url, onAuthSuccess);
        
      } else if (result.type === 'cancel') {
        console.log('❌ OAuth cancelled by user');
        Toast.show({
          type: 'info',
          text1: 'Cancelled',
          text2: 'Google sign-in was cancelled'
        });
      } else if (result.type === 'dismiss') {
        console.log('❌ OAuth dismissed');
        Toast.show({
          type: 'info',
          text1: 'Dismissed',
          text2: 'Google sign-in was dismissed'
        });
      }

    } catch (error: any) {
      console.error('❌ OAuth error:', error);
      Toast.show({
        type: 'error',
        text1: 'Sign-in Error',
        text2: error.message || 'Failed to open Google sign-in'
      });
    } finally {
      processingRef.current = false;
    }
  }, [onAuthSuccess]);

  // ==========================================
  // 🔧 HELPER FUNCTIONS
  // ==========================================

  const generateSecureState = (): string => {
    // Generate a secure random state parameter
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleOAuthSuccess = async (
    successUrl: string, 
    onAuthSuccess: (user: AuthSuccessUser, isNewUser?: boolean) => void
  ) => {
    try {
      console.log('🔍 Parsing OAuth success URL...');
      
      // Parse URL parameters
      const url = new URL(successUrl);
      const token = url.searchParams.get('token');
      const userParam = url.searchParams.get('user');
      const isNewUser = url.searchParams.get('is_new_user') === 'true';
      const error = url.searchParams.get('error');

      if (error) {
        console.error('❌ OAuth error from server:', error);
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: decodeURIComponent(error)
        });
        return;
      }

      if (!token || !userParam) {
        console.error('❌ Missing token or user data in success URL');
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Invalid response from server'
        });
        return;
      }

      // Parse user data
      const user: AuthSuccessUser = JSON.parse(decodeURIComponent(userParam));
      
      console.log('✅ OAuth success - User:', user.email);

      // Store authentication data
      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('user_id', user.id.toString());
      await SecureStore.setItemAsync('user_role', user.primary_role);
      await SecureStore.setItemAsync('user_data', JSON.stringify(user));

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Welcome!',
        text2: isNewUser 
          ? `Account created for ${user.display_name}` 
          : `Welcome back, ${user.display_name}!`
      });

      // Call success callback
      onAuthSuccess(user, isNewUser);

    } catch (error: any) {
      console.error('❌ Error handling OAuth success:', error);
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: 'Failed to process authentication response'
      });
    }
  };

  // ==========================================
  // 🔄 ALTERNATIVE: FALLBACK TO TOKEN-BASED
  // ==========================================

  const signInWithGoogleToken = useCallback(async () => {
    // This is a fallback method if the web OAuth doesn't work
    // You can implement this to still use the google-id-token approach
    console.log('🔄 Fallback: Token-based authentication not implemented');
    Toast.show({
      type: 'info',
      text1: 'Alternative Method',
      text2: 'Please use the web-based Google sign-in'
    });
  }, []);

  return {
    promptAsync: signInWithGoogle,
    signInWithGoogle,
    signInWithGoogleToken, // Fallback method
    request: { available: true }, // Mock request object for compatibility
    redirectUri: null, // Not using custom redirects
    isProcessing: processingRef.current,
  };
}
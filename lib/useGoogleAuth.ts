import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import api, { getCurrentApiBaseUrl } from '@/lib/api'; // Your API instance

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

interface BackendAuthResponse {
  status: 'success' | 'error';
  message: string;
  user?: AuthSuccessUser;
  auth_method?: string;
  is_new_user?: boolean;
  code?: string;
  errors?: string[];
}

export function useGoogleAuth(onAuthSuccess: (user: AuthSuccessUser, isNewUser?: boolean) => void) {
  const processingRef = useRef(false);

  // ✅ FIXED: Include androidClientId for Android platform
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: Constants.expoConfig?.extra?.expoClientId,
    webClientId: Constants.expoConfig?.extra?.webClientId,
    androidClientId: Constants.expoConfig?.extra?.androidClientId,
    iosClientId: Constants.expoConfig?.extra?.iosClientId, // Added iOS client ID
    scopes: ['profile', 'email', 'openid'],
    responseType: 'id_token', // ✅ Changed to id_token for better backend integration
  });

  // ✅ Debug logging to verify configuration
  useEffect(() => {
    if (request) {
      console.log('🔍 OAuth Configuration Check:');
      console.log('📱 Current Platform:', Constants.platform?.ios ? 'iOS' : 'Android');
      console.log('🆔 Android Client ID:', Constants.expoConfig?.extra?.androidClientId ? 'Present' : 'Missing');
      console.log('🆔 iOS Client ID:', Constants.expoConfig?.extra?.iosClientId ? 'Present' : 'Missing');
      console.log('🆔 Expo Client ID:', Constants.expoConfig?.extra?.expoClientId ? 'Present' : 'Missing');
      console.log('🆔 Web Client ID:', Constants.expoConfig?.extra?.webClientId ? 'Present' : 'Missing');
      console.log('🔗 Redirect URI:', request.redirectUri);
      console.log('🌐 Backend API URL:', getCurrentApiBaseUrl());
      
      if (request.redirectUri?.includes('auth.expo.io')) {
        console.log('✅ Using HTTPS proxy - Good!');
      }
    }
  }, [request]);

  useEffect(() => {
    if (!response || processingRef.current) return;

    console.log('📋 OAuth Response:', response.type);

    if (response.type === 'success') {
      processingRef.current = true;
      
      const { authentication } = response;
      
      // ✅ NEW: Support both ID token and access token
      const token = authentication?.idToken || authentication?.accessToken;
      
      if (token) {
        console.log('✅ Token received:', authentication?.idToken ? 'ID Token' : 'Access Token');
        authenticateWithBackend(token);
      } else {
        console.log('❌ No token in response');
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'No authentication token received'
        });
        processingRef.current = false;
      }
    } else if (response.type === 'error') {
      console.error('❌ OAuth Error:', response.error);
      Toast.show({
        type: 'error',
        text1: 'Google Sign-In Failed',
        text2: response.error?.message || 'Authentication cancelled'
      });
      processingRef.current = false;
    } else {
      console.log(`📱 OAuth ${response.type}`);
      processingRef.current = false;
    }
  }, [response]);

  // ✅ NEW: Authenticate with your backend instead of Google directly
  const authenticateWithBackend = async (googleToken: string) => {
    try {
      console.log('🔐 Authenticating with backend...');
      
      // Call your backend Google login endpoint
      const response = await api.post<BackendAuthResponse>('/auth/google/login', {
        credential: googleToken,     // Primary field name
        token: googleToken,          // Fallback field name
        id_token: googleToken,       // Alternative field name
        access_token: googleToken    // Another alternative field name
      });
      
      if (response.data.status === 'success' && response.data.user) {
        const { user } = response.data;
        console.log('✅ Backend authentication successful:', user.email);
        
        // ✅ IMPORTANT: Extract JWT token from response headers
        const jwtToken = response.headers['authorization']?.replace('Bearer ', '') ||
                        response.data.token ||
                        response.headers['x-auth-token'];
        
        if (jwtToken) {
          // Store JWT token for future API calls
          await SecureStore.setItemAsync('auth_token', jwtToken);
          await SecureStore.setItemAsync('user_id', user.id.toString());
          await SecureStore.setItemAsync('user_role', user.primary_role);
          
          console.log('🔐 JWT token stored successfully');
        } else {
          console.warn('⚠️ No JWT token in response - devise-jwt should handle this automatically');
        }
        
        // Store user data
        await SecureStore.setItemAsync('user_data', JSON.stringify(user));
        
        // Show success message
        Toast.show({
          type: 'success',
          text1: 'Welcome!',
          text2: response.data.is_new_user 
            ? `Account created for ${user.display_name}` 
            : `Welcome back, ${user.display_name}!`
        });
        
        // Call success callback
        await onAuthSuccess(user, response.data.is_new_user);
        
      } else {
        // Handle backend authentication failure
        console.error('❌ Backend authentication failed:', response.data.message);
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: response.data.message || 'Server authentication failed'
        });
      }
    } catch (error: any) {
      console.error('❌ Backend authentication error:', error);
      
      // Handle specific error cases
      if (error.response?.status === 400) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Token',
          text2: 'Google authentication token is invalid'
        });
      } else if (error.response?.status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Google token validation failed'
        });
      } else if (error.response?.status === 409) {
        // Email exists with different auth method
        Toast.show({
          type: 'error',
          text1: 'Account Exists',
          text2: 'Please sign in with your email and password'
        });
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        Toast.show({
          type: 'error',
          text1: 'Connection Error',
          text2: 'Please check your internet connection'
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Sign-In Failed',
          text2: error.response?.data?.message || 'An unexpected error occurred'
        });
      }
    } finally {
      processingRef.current = false;
    }
  };

  // ✅ NEW: Function to check if user needs to complete profile
  const checkProfileCompletion = (user: AuthSuccessUser): boolean => {
    return user.google_user && (
      !user.first_name ||
      !user.last_name ||
      !user.profile_complete
    );
  };

  // ✅ NEW: Function to manually trigger Google sign-in
  const signInWithGoogle = async () => {
    if (!request) {
      console.error('❌ Google Auth request not ready');
      Toast.show({
        type: 'error',
        text1: 'Google Sign-In Not Ready',
        text2: 'Please wait a moment and try again'
      });
      return;
    }

    if (processingRef.current) {
      console.log('⏳ Authentication already in progress');
      return;
    }

    try {
      console.log('🚀 Starting Google sign-in...');
      await promptAsync();
    } catch (error: any) {
      console.error('❌ Error starting Google sign-in:', error);
      Toast.show({
        type: 'error',
        text1: 'Sign-In Error',
        text2: 'Failed to start Google sign-in'
      });
    }
  };

  return { 
    promptAsync: signInWithGoogle, 
    request,
    isProcessing: processingRef.current,
    checkProfileCompletion
  };
}
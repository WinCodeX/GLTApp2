// lib/useGoogleAuth.ts - Fixed for expo-auth-session OAuth 2.0 flow
import { useEffect } from 'react';
import {
  makeRedirectUri,
  useAuthRequest,
  exchangeCodeAsync,
  AuthRequestConfig,
  DiscoveryDocument,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { getCurrentApiBaseUrl } from '@/lib/api';
import { Platform } from 'react-native';

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
  token?: string; // JWT token from your Rails backend
}

export function useGoogleAuth(onAuthSuccess: (user: AuthSuccessUser, isNewUser?: boolean) => void) {
  // Get your Rails server base URL (without /api/v1)
  const getBaseUrl = () => {
    const apiUrl = getCurrentApiBaseUrl();
    return apiUrl.replace('/api/v1', '');
  };

  // OAuth configuration for expo-auth-session
  const config: AuthRequestConfig = {
    clientId: "google", // This can be any string for expo-auth-session
    scopes: ['openid', 'profile', 'email'],
    additionalParameters: {},
    customParameters: {
      prompt: 'select_account',
    },
    redirectUri: makeRedirectUri({
      scheme: 'betoauthexample', // Your app scheme
      path: 'auth',
    }),
  };

  // Discovery document pointing to your Rails OAuth endpoints
  const discovery: DiscoveryDocument = {
    authorizationEndpoint: `${getBaseUrl()}/api/auth/authorize`,
    tokenEndpoint: `${getBaseUrl()}/api/auth/token`,
  };

  // Use expo-auth-session hook
  const [request, response, promptAsync] = useAuthRequest(config, discovery);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleAuthResponse(response);
    } else if (response?.type === 'error') {
      console.error('OAuth error:', response.error);
    } else if (response?.type === 'cancel') {
      console.log('OAuth cancelled by user');
    }
  }, [response]);

  const handleAuthResponse = async (authResponse: any) => {
    try {
      console.log('🔄 Exchanging authorization code for tokens...');
      
      // Exchange authorization code for tokens using your Rails backend
      const tokenResponse = await exchangeCodeAsync(
        {
          clientId: config.clientId!,
          code: authResponse.params.code,
          redirectUri: config.redirectUri!,
          extraParams: {
            platform: Platform.OS, // Tell backend if this is native or web
          },
          codeVerifier: request?.codeVerifier, // PKCE verification
        },
        discovery
      );

      console.log('✅ Token exchange successful');

      // The response from your Rails backend should include user data and tokens
      if (tokenResponse.accessToken) {
        // For web: tokens are set as HTTP-only cookies
        // For native: tokens are returned in the response
        
        // Check if user data is included in the token response
        const userData = (tokenResponse as any).user;
        const isNewUser = (tokenResponse as any).is_new_user;

        if (userData) {
          // Add the token to user data for AccountManager
          const userWithToken = {
            ...userData,
            token: tokenResponse.accessToken,
          };

          console.log('🎉 Authentication successful for:', userData.email);
          onAuthSuccess(userWithToken, isNewUser);
        } else {
          // If no user data in token response, fetch from session endpoint
          await fetchUserSession();
        }
      } else {
        throw new Error('No access token received');
      }
    } catch (error) {
      console.error('❌ Error handling auth response:', error);
      throw error;
    }
  };

  const fetchUserSession = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/auth/session`, {
        method: 'GET',
        credentials: 'include', // Include cookies for web
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('📋 Fetched user session:', userData.email);
        onAuthSuccess(userData, false);
      } else {
        throw new Error('Failed to fetch user session');
      }
    } catch (error) {
      console.error('❌ Error fetching user session:', error);
      throw error;
    }
  };

  // Return the promptAsync function and request object
  return {
    promptAsync,
    request,
  };
}
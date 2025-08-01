import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onAuthSuccess: (user: any) => void) {
  const processingRef = useRef(false); // Prevent duplicate processing
  const authAttemptRef = useRef(0); // Track auth attempts

  // Memoize the redirect URI so it doesn't change on every render
  const redirectUri = useMemo(() => {
    const uri = makeRedirectUri({ 
      scheme: 'gltapp2',
      useProxy: Platform.OS === 'web'
    });
    console.log('🔗 Redirect URI (memoized):', uri);
    return uri;
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: Constants.expoConfig?.extra?.expoClientId,
    iosClientId: Constants.expoConfig?.extra?.iosClientId,
    androidClientId: Constants.expoConfig?.extra?.androidClientId,
    webClientId: Constants.expoConfig?.extra?.webClientId,
    scopes: ['profile', 'email'],
    useProxy: Platform.OS === 'web',
    redirectUri,
  });

  useEffect(() => {
    if (!response) return;

    const currentAttempt = ++authAttemptRef.current;
    console.log(`🔄 Auth response #${currentAttempt}:`, response.type);

    // Prevent processing the same response multiple times
    if (processingRef.current) {
      console.log('⚠️ Already processing auth response, skipping...');
      return;
    }

    if (response.type === 'success') {
      processingRef.current = true;
      
      const { authentication } = response;
      if (authentication?.accessToken) {
        console.log('✅ Access token received, fetching user info...');
        fetchUserInfo(authentication.accessToken);
      } else {
        console.log('❌ No access token in successful response');
        processingRef.current = false;
      }
    } else if (response.type === 'error') {
      console.error('❌ Google Auth Error:', response.error);
      processingRef.current = false;
    } else if (response.type === 'cancel') {
      console.log('🚫 Google Auth Cancelled by user');
      processingRef.current = false;
    } else if (response.type === 'dismiss') {
      console.log('📱 Google Auth Dismissed');
      processingRef.current = false;
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    try {
      console.log('🌐 Fetching user info from Google...');
      
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const user = await res.json();
      console.log('👤 Google user info received:', user.email);
      
      await onAuthSuccess(user);
      
    } catch (err) {
      console.error('❌ Failed to fetch Google profile:', err);
    } finally {
      // Reset processing flag after a delay to prevent rapid re-attempts
      setTimeout(() => {
        processingRef.current = false;
      }, 2000);
    }
  };

  // Enhanced prompt function with better error handling
  const enhancedPromptAsync = async () => {
    try {
      console.log('🚀 Starting Google OAuth prompt...');
      console.log('🔗 Using redirect URI:', redirectUri);
      
      // Reset processing flag before new attempt
      processingRef.current = false;
      
      const result = await promptAsync();
      console.log('📋 Prompt result:', result?.type);
      
      return result;
    } catch (error) {
      console.error('❌ Prompt error:', error);
      processingRef.current = false;
      throw error;
    }
  };

  return { 
    promptAsync: enhancedPromptAsync, 
    request,
    redirectUri // Expose for debugging
  };
}
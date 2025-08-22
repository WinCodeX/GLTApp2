import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onAuthSuccess: (user: any) => void) {
  const processingRef = useRef(false);

  // ✅ FIXED: Include androidClientId for Android platform
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: Constants.expoConfig?.extra?.expoClientId,
    webClientId: Constants.expoConfig?.extra?.webClientId,
    androidClientId: Constants.expoConfig?.extra?.androidClientId, // ✅ Required for Android
    scopes: ['profile', 'email', 'openid'],
    responseType: 'token',
  });

  // ✅ Debug logging to verify configuration
  useEffect(() => {
    if (request) {
      console.log('🔍 OAuth Configuration Check:');
      console.log('📱 Platform: Android');
      console.log('🆔 Android Client ID:', Constants.expoConfig?.extra?.androidClientId ? 'Present' : 'Missing');
      console.log('🆔 Expo Client ID:', Constants.expoConfig?.extra?.expoClientId ? 'Present' : 'Missing');
      console.log('🆔 Web Client ID:', Constants.expoConfig?.extra?.webClientId ? 'Present' : 'Missing');
      console.log('🔗 Redirect URI:', request.redirectUri);
      
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
      if (authentication?.accessToken) {
        console.log('✅ Access token received');
        fetchUserInfo(authentication.accessToken);
      } else {
        console.log('❌ No access token in response');
        processingRef.current = false;
      }
    } else if (response.type === 'error') {
      console.error('❌ OAuth Error:', response.error);
      processingRef.current = false;
    } else {
      console.log(`📱 OAuth ${response.type}`);
      processingRef.current = false;
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    try {
      console.log('🌐 Fetching user info...');
      
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const user = await res.json();
      console.log('👤 User authenticated:', user.email);
      
      await onAuthSuccess(user);
    } catch (err) {
      console.error('❌ Failed to fetch user profile:', err);
    } finally {
      processingRef.current = false;
    }
  };

  return { promptAsync, request };
}
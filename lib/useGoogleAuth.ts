import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onAuthSuccess: (user: any) => void) {
  const processingRef = useRef(false);
  const authAttemptRef = useRef(0);

  // ✅ CORRECTED: Use Android client configuration properly
  const [request, response, promptAsync] = Google.useAuthRequest({
    // ✅ Use ONLY Android client ID for Android
    androidClientId: Constants.expoConfig?.extra?.androidClientId,
    
    // ✅ Include scopes with 'openid'
    scopes: ['profile', 'email', 'openid'],
    
    // ✅ Use authorization code flow (more secure)
    responseType: 'code',
    
    // ✅ Let Expo handle redirect URI automatically for Android
    // Don't specify redirectUri - Android uses package name + SHA-1
    
    // ✅ Additional security parameters
    additionalParameters: {
      prompt: 'select_account',
    },
  });

  // 🔍 Debug the Android OAuth configuration
  useEffect(() => {
    if (request) {
      console.log('🔍 === ANDROID OAUTH DEBUG ===');
      console.log('📱 Platform:', Platform.OS);
      console.log('🏗️ App ownership:', Constants.appOwnership);
      console.log('🆔 Android Client ID:', Constants.expoConfig?.extra?.androidClientId?.substring(0, 20) + '...');
      console.log('🔗 Generated Redirect URI:', request.redirectUri);
      console.log('🎯 Scopes:', request.scopes);
      console.log('🔄 Response type:', request.responseType);
      console.log('🌐 OAuth URL:', request.url?.substring(0, 100) + '...');
      
      // ✅ Validate Android OAuth setup
      const hasAndroidClient = !!Constants.expoConfig?.extra?.androidClientId;
      const hasCorrectScopes = request.scopes?.includes('openid');
      const usesCodeFlow = request.responseType === 'code';
      
      console.log('✅ Android Client ID present:', hasAndroidClient);
      console.log('✅ Correct scopes (includes openid):', hasCorrectScopes);
      console.log('✅ Uses code flow:', usesCodeFlow);
      
      if (hasAndroidClient && hasCorrectScopes && usesCodeFlow) {
        console.log('🎯 OAuth Configuration: CORRECT');
      } else {
        console.log('❌ OAuth Configuration: NEEDS FIXING');
      }
    }
  }, [request]);

  useEffect(() => {
    if (!response) return;

    const currentAttempt = ++authAttemptRef.current;
    console.log(`🔄 Auth response #${currentAttempt}:`, response.type);

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
      } else if (response.params?.code) {
        console.log('✅ Authorization code received');
        // For production, exchange this code on your backend
        console.log('🔑 Auth code:', response.params.code.substring(0, 20) + '...');
        // For now, we need the access token flow, so this might not work immediately
        console.log('⚠️ Code flow requires backend token exchange');
        processingRef.current = false;
      } else {
        console.log('❌ No access token or code in successful response');
        console.log('Response params:', response.params);
        processingRef.current = false;
      }
    } else if (response.type === 'error') {
      console.error('❌ Google Auth Error:', response.error);
      console.error('Error params:', response.params);
      
      // ✅ Enhanced error debugging
      if (response.params?.error_description) {
        console.error('Error description:', response.params.error_description);
      }
      
      processingRef.current = false;
    } else {
      console.log(`📱 Google Auth ${response.type}`);
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
      setTimeout(() => {
        processingRef.current = false;
      }, 2000);
    }
  };

  const enhancedPromptAsync = async () => {
    try {
      console.log('🚀 === STARTING ANDROID OAUTH FLOW ===');
      console.log('🔑 Using Android Client ID:', !!Constants.expoConfig?.extra?.androidClientId);
      console.log('📱 Platform check:', Platform.OS === 'android' ? 'CORRECT' : 'WRONG PLATFORM');
      
      // ⚠️ Platform validation
      if (Platform.OS !== 'android') {
        console.warn('⚠️ WARNING: This is Android OAuth but platform is', Platform.OS);
      }
      
      processingRef.current = false;
      
      const result = await promptAsync();
      console.log('📋 OAuth result:', result?.type);
      
      if (result?.type === 'error') {
        console.error('❌ OAuth error details:', result.error);
        console.error('❌ OAuth error params:', result.params);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Prompt error:', error);
      processingRef.current = false;
      throw error;
    }
  };

  return { 
    promptAsync: enhancedPromptAsync, 
    request
  };
}
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onAuthSuccess: (user: any) => void) {
  const processingRef = useRef(false);
  const authAttemptRef = useRef(0);

  // 🔧 SECURITY FIX: Platform-aware redirect URI strategy
  const redirectUri = useMemo(() => {
    console.log('🔍 === OAUTH SECURITY CONFIG ===');
    console.log('📱 Platform:', Platform.OS);
    console.log('🏗️ App ownership:', Constants.appOwnership);
    console.log('📦 Package:', Constants.expoConfig?.android?.package);
    
    // 🔒 SECURITY: Use development build native scheme when possible
    if (Constants.appOwnership === 'standalone' || Constants.appOwnership === 'expo') {
      // For development/standalone builds, use native scheme
      const nativeUri = makeRedirectUri({ 
        useProxy: false,
        scheme: 'com.lvl0_x.gltapp2'
      });
      console.log('🔗 Using native redirect URI:', nativeUri);
      return nativeUri;
    } else {
      // Fallback to proxy only if necessary
      const proxyUri = makeRedirectUri({ useProxy: true });
      console.log('🔗 Using proxy redirect URI:', proxyUri);
      return proxyUri;
    }
  }, []);

  // 🔧 SECURITY FIX: Platform-specific client ID selection
  const getClientConfig = () => {
    const config = {
      scopes: ['profile', 'email', 'openid'], // ✅ Added missing 'openid'
      responseType: 'code', // ✅ Use authorization code flow (more secure)
      redirectUri,
      useProxy: Constants.appOwnership === 'expo', // ✅ Only use proxy in Expo Go
      additionalParameters: {
        prompt: 'select_account', // Force account selection
        access_type: 'offline', // Allow token refresh
      },
    };

    // 🔒 Platform-specific client ID (more secure)
    if (Platform.OS === 'android') {
      return {
        ...config,
        androidClientId: Constants.expoConfig?.extra?.androidClientId,
        // Don't include other platform client IDs for security
      };
    } else if (Platform.OS === 'ios') {
      return {
        ...config,
        iosClientId: Constants.expoConfig?.extra?.iosClientId,
      };
    } else {
      return {
        ...config,
        webClientId: Constants.expoConfig?.extra?.webClientId,
        expoClientId: Constants.expoConfig?.extra?.expoClientId,
      };
    }
  };

  const [request, response, promptAsync] = Google.useAuthRequest(getClientConfig());

  // 🔍 Enhanced security logging
  useEffect(() => {
    if (request) {
      console.log('🔒 === OAUTH REQUEST SECURITY AUDIT ===');
      console.log('🆔 Client ID:', request.clientId?.substring(0, 20) + '...');
      console.log('🔗 Redirect URI:', request.redirectUri);
      console.log('🎯 Scopes:', request.scopes);
      console.log('🔄 Response type:', request.responseType);
      console.log('🌐 Request URL:', request.url?.substring(0, 100) + '...');
      
      // ✅ Security validation
      const isSecure = request.url?.startsWith('https://') && 
                      (request.redirectUri?.startsWith('https://') || 
                       request.redirectUri?.startsWith('com.lvl0_x.gltapp2://'));
      
      console.log(isSecure ? '✅ Security: PASSED' : '❌ Security: FAILED');
      
      if (!isSecure) {
        console.warn('⚠️ INSECURE OAUTH CONFIGURATION DETECTED');
        console.warn('   - URL should use HTTPS');
        console.warn('   - Redirect URI should use HTTPS or custom scheme');
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
      
      // 🔧 Handle both token and code flows
      if (authentication?.accessToken) {
        console.log('✅ Access token received (implicit flow)');
        fetchUserInfo(authentication.accessToken);
      } else if (response.params?.code) {
        console.log('✅ Authorization code received (code flow)');
        // For code flow, you'd typically exchange this on your backend
        exchangeCodeForToken(response.params.code);
      } else {
        console.log('❌ No access token or code in successful response');
        console.log('Response params:', response.params);
        processingRef.current = false;
      }
    } else if (response.type === 'error') {
      console.error('❌ Google Auth Error:', response.error);
      console.error('Error params:', response.params);
      console.error('Error details:', response);
      processingRef.current = false;
    } else {
      console.log(`📱 Google Auth ${response.type}`);
      processingRef.current = false;
    }
  }, [response]);

  // 🔧 Handle authorization code exchange (more secure)
  const exchangeCodeForToken = async (code: string) => {
    try {
      console.log('🔑 Exchanging authorization code for tokens...');
      
      // ⚠️ SECURITY NOTE: In production, this should be done on your backend
      // This is a simplified example for development
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: Constants.expoConfig?.extra?.androidClientId || '',
          client_secret: '', // ⚠️ Should be handled on backend
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }

      const tokens = await tokenResponse.json();
      
      if (tokens.access_token) {
        fetchUserInfo(tokens.access_token);
      } else {
        throw new Error('No access token in response');
      }
      
    } catch (error) {
      console.error('❌ Code exchange error:', error);
      processingRef.current = false;
    }
  };

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
      console.log('🚀 === STARTING SECURE OAUTH FLOW ===');
      console.log('🔗 Redirect URI:', redirectUri);
      console.log('🏗️ App type:', Constants.appOwnership);
      console.log('🔒 Using proxy:', Constants.appOwnership === 'expo');
      
      // ⚠️ Security warning for Expo Go
      if (Constants.appOwnership === 'expo') {
        console.warn('⚠️ WARNING: Using Expo Go - OAuth may be unreliable');
        console.warn('💡 Recommendation: Use development build (expo run:android)');
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
    request,
    redirectUri,
    isSecure: request?.url?.startsWith('https://') && 
              (request?.redirectUri?.startsWith('https://') || 
               request?.redirectUri?.startsWith('com.lvl0_x.gltapp2://'))
  };
}
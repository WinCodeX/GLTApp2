import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onAuthSuccess: (user: any) => void) {
  const processingRef = useRef(false);

  // 🔧 FORCE HTTPS PROXY - Don't let it use custom schemes
  const redirectUri = makeRedirectUri({ 
    useProxy: true,  // ✅ Force proxy usage
    preferLocalhost: false  // ✅ Don't use localhost
  });

  console.log('🔗 Forced redirect URI:', redirectUri);
  console.log('🎯 Should be: https://auth.expo.io/@lvl0_x/gltapp2');

  const [request, response, promptAsync] = Google.useAuthRequest({
    // 🔧 Use Web client ID explicitly  
    expoClientId: Constants.expoConfig?.extra?.expoClientId,
    webClientId: Constants.expoConfig?.extra?.webClientId,
    
    scopes: ['profile', 'email', 'openid'],
    responseType: 'token',
    
    // 🔧 FORCE the correct redirect URI
    redirectUri: 'https://auth.expo.io/@lvl0_x/gltapp2',
    
    // 🔧 FORCE proxy usage
    useProxy: true,
    
    additionalParameters: {
      prompt: 'select_account',
    },
  });

  // 🔍 Debug what's actually being sent
  useEffect(() => {
    if (request) {
      console.log('🚀 === OAUTH REQUEST DEBUG ===');
      console.log('🔗 Redirect URI in request:', request.redirectUri);
      console.log('🆔 Client ID:', request.clientId?.substring(0, 20) + '...');
      console.log('🌐 Full OAuth URL:', request.url);
      
      // ✅ Validate HTTPS usage
      if (request.redirectUri?.startsWith('https://auth.expo.io')) {
        console.log('✅ Using HTTPS proxy - CORRECT');
      } else {
        console.log('❌ NOT using HTTPS proxy - PROBLEM');
        console.log('❌ Actual redirect URI:', request.redirectUri);
      }
    }
  }, [request]);

  useEffect(() => {
    if (!response || processingRef.current) return;

    console.log('📋 OAuth response type:', response.type);

    if (response.type === 'success') {
      processingRef.current = true;
      
      const { authentication } = response;
      if (authentication?.accessToken) {
        console.log('✅ Access token received via HTTPS proxy');
        fetchUserInfo(authentication.accessToken);
      } else {
        console.log('❌ No access token in response');
        console.log('Response params:', response.params);
        processingRef.current = false;
      }
    } else if (response.type === 'error') {
      console.error('❌ OAuth Error:', response.error);
      console.error('❌ Error params:', response.params);
      
      // 🔍 Enhanced error debugging
      if (response.params?.error_description) {
        console.error('❌ Error description:', response.params.error_description);
      }
      
      processingRef.current = false;
    } else {
      console.log(`📱 OAuth ${response.type}`);
      processingRef.current = false;
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    try {
      console.log('🌐 Fetching user info securely...');
      
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

  const enhancedPromptAsync = async () => {
    try {
      console.log('🚀 === STARTING HTTPS OAUTH FLOW ===');
      console.log('🔗 Redirect URI check:', request?.redirectUri);
      
      // ⚠️ Pre-flight validation
      if (!request?.redirectUri?.startsWith('https://auth.expo.io')) {
        console.warn('⚠️ WARNING: Not using HTTPS proxy!');
        console.warn('   Expected: https://auth.expo.io/@lvl0_x/gltapp2');
        console.warn('   Actual:', request?.redirectUri);
      }
      
      processingRef.current = false;
      
      const result = await promptAsync();
      console.log('📋 OAuth result:', result?.type);
      
      return result;
    } catch (error) {
      console.error('❌ OAuth prompt error:', error);
      processingRef.current = false;
      throw error;
    }
  };

  return { 
    promptAsync: enhancedPromptAsync, 
    request,
    redirectUri: request?.redirectUri
  };
}
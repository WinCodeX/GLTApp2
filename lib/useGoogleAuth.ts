import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onAuthSuccess: (user: any) => void) {
  // Use custom scheme for native apps, proxy for web
  const redirectUri = makeRedirectUri({ 
    scheme: 'gltapp2',
    useProxy: Platform.OS === 'web'
  });

  console.log('Redirect URI:', redirectUri); // Log for debugging

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
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        fetchUserInfo(authentication.accessToken);
      }
    } else if (response?.type === 'error') {
      console.error('Google Auth Error:', response.error);
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const user = await res.json();
      onAuthSuccess(user);
    } catch (err) {
      console.error('Failed to fetch Google profile:', err);
    }
  };

  return { promptAsync, request };
}
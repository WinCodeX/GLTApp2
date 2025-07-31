import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onAuthSuccess: (user: any) => void) {
  const redirectUri = makeRedirectUri({ useProxy: true });

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: Constants.expoConfig?.extra?.expoClientId,
    iosClientId: Constants.expoConfig?.extra?.iosClientId,
    androidClientId: Constants.expoConfig?.extra?.androidClientId,
    webClientId: Constants.expoConfig?.extra?.webClientId,
    scopes: ['profile', 'email'],
    useProxy: true,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      fetchUserInfo(authentication?.accessToken);
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      onAuthSuccess(user);
    } catch (err) {
      console.error('Failed to fetch Google profile:', err);
    }
  };

  return { promptAsync, request };
}
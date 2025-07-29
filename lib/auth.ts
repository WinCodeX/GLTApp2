import * as SecureStore from 'expo-secure-store';
import jwtDecode from 'jwt-decode';

interface DecodedToken {
  exp: number;
  user_id?: string | number;
  [key: string]: any;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await SecureStore.getItemAsync('auth_token');
  if (!token) return false;

  try {
    const decoded: DecodedToken = jwtDecode(token);
    const currentTime = Math.floor(Date.now() / 1000);

    // Save user_id if it isn't already stored
    const storedUserId = await SecureStore.getItemAsync('user_id');
    if (!storedUserId && decoded.user_id) {
      await SecureStore.setItemAsync('user_id', String(decoded.user_id));
    }

    return decoded.exp > currentTime;
  } catch (e) {
    console.error('[auth.ts] JWT decode error:', e);
    return false;
  }
}
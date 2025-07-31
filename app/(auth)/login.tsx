import { AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import api from '../../lib/api';
import { useGoogleAuth } from '../../lib/useGoogleAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ready, setReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();

  const { promptAsync, request } = useGoogleAuth(async (googleUser) => {
    try {
      setIsGoogleLoading(true);

      const response = await api.post('/api/v1/google_login', {
        user: {
          email: googleUser.email,
          first_name: googleUser.given_name,
          last_name: googleUser.family_name,
          avatar_url: googleUser.picture,
          provider: 'google',
          uid: googleUser.id,
        },
      });

      const token = response?.data?.token;
      const user = response?.data?.user;
      const userId = user?.id;

      if (token && userId) {
        await SecureStore.setItemAsync('auth_token', token);
        await SecureStore.setItemAsync('user_id', String(userId));

        const roles = user?.roles || [];
        const role = roles.includes('admin') ? 'admin' : 'client';
        await SecureStore.setItemAsync('user_role', role);

        Toast.show({ type: 'success', text1: 'Logged in with Google!' });
        router.push(role === 'admin' ? '/admin' : '/');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Google login failed',
          text2: 'Missing token or user ID',
        });
      }
    } catch (err) {
      console.error('Google login error:', err);
      Toast.show({ type: 'error', text1: 'Google login failed' });
    } finally {
      setIsGoogleLoading(false);
    }
  });

  useEffect(() => {
    const checkServer = async () => {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_id');

      const endpoints = [
        '/api/v1/ping',
        '/ping',
        '/health',
        '/api/v1/health',
        '/',
      ];

      let reachable = false;

      for (const path of endpoints) {
        try {
          console.log(`🌐 Trying: ${api.defaults.baseURL}${path}`);
          await api.get(path);
          console.log(`✅ Success: ${path}`);
          reachable = true;
          break;
        } catch (err) {
          console.log(`❌ Failed: ${path} - ${err?.message}`);
        }
      }

      setReady(true);

      if (!reachable) {
        Toast.show({
          type: 'info',
          text1: 'Server unreachable',
          text2: 'Login might fail',
        });
      }
    };

    checkServer();
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;

    setErrorMsg('');
    setIsLoggingIn(true);

    try {
      const response = await api.post('/api/v1/login', {
        user: { email, password },
      });

      const token =
        response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;
      const userId = user?.id;

      if (token && userId) {
        await SecureStore.setItemAsync('auth_token', token);
        await SecureStore.setItemAsync('user_id', String(userId));

        const roles = user?.roles || [];
        const role = roles.includes('admin') ? 'admin' : 'client';
        await SecureStore.setItemAsync('user_role', role);

        Toast.show({ type: 'success', text1: 'Welcome back!' });
        router.push(role === 'admin' ? '/admin' : '/');
      } else {
        setErrorMsg('Login failed: Missing token or user ID');
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: 'Incomplete data',
        });
      }
    } catch (err) {
      console.error('Login error:', err?.response?.data || err?.message);
      if (err?.response?.status === 401) {
        setErrorMsg('Invalid email or password');
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: 'Invalid credentials',
        });
      } else {
        setErrorMsg('Server error - try again');
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: 'Unexpected error',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !request) return;

    setIsGoogleLoading(true);

    try {
      const result = await promptAsync();

      if (result?.type === 'success') return;

      Toast.show({ type: 'info', text1: 'Google login cancelled' });
    } catch (error) {
      console.error('Google login prompt error:', error);
      Toast.show({
        type: 'error',
        text1: 'Google login error',
        text2: 'Something went wrong',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0a0a0f', '#0a0a0f']} style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome Back</Text>

        {!ready ? (
          <>
            <ActivityIndicator size="large" color="#bd93f9" />
            <Text style={styles.loadingText}>Connecting to server...</Text>
          </>
        ) : (
          <>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              mode="outlined"
              style={styles.input}
              textColor="#f8f8f2"
              placeholderTextColor="#ccc"
              outlineColor="#44475a"
              activeOutlineColor="#bd93f9"
              disabled={isLoggingIn || isGoogleLoading}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              textColor="#f8f8f2"
              placeholderTextColor="#ccc"
              outlineColor="#44475a"
              activeOutlineColor="#bd93f9"
              disabled={isLoggingIn || isGoogleLoading}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword((v) => !v)}
                  forceTextInputFocus={false}
                  color="#aaa"
                />
              }
            />

            {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

            <TouchableOpacity
              style={[
                styles.googleBtn,
                (isGoogleLoading || !request) && styles.disabledBtn,
              ]}
              disabled={isGoogleLoading || !request || isLoggingIn}
              onPress={handleGoogleLogin}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <AntDesign name="google" size={20} color="white" />
              )}
              <Text style={styles.googleText}>
                {isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}
              </Text>
            </TouchableOpacity>

            <LinearGradient
              colors={['#7c3aed', '#3b82f6', '#10b981']}
              style={[
                styles.loginButtonGradient,
                isLoggingIn && styles.disabledBtn,
              ]}
            >
              <Button
                mode="contained"
                onPress={handleLogin}
                style={styles.button}
                labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                disabled={isLoggingIn || isGoogleLoading}
              >
                {isLoggingIn ? 'Logging In...' : 'Log In'}
              </Button>
            </LinearGradient>

            <Button
              onPress={() => router.push('/signup')}
              textColor="#bd93f9"
              style={styles.link}
              disabled={isLoggingIn || isGoogleLoading}
            >
              Don't have an account? Sign up
            </Button>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: {
    color: '#f8f8f2',
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#1e1e2f',
    borderRadius: 8,
  },
  button: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  loginButtonGradient: {
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 12,
  },
  link: {
    marginTop: 16,
  },
  error: {
    color: '#ff5555',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
  loadingText: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20202a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  googleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
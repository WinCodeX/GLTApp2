import { AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import api, { getCurrentBaseUrl, refreshBaseUrl } from '../../lib/api';
import { useGoogleAuth } from '../../lib/useGoogleAuth';
import { toastConfig } from '../../lib/toastConfig';
import MaskedView from '@react-native-masked-view/masked-view';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ready, setReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking', 'connected', 'unreachable'
  const router = useRouter();
  
  // Prevent duplicate Google login processing
  const googleLoginInProgress = useRef(false);

  // Memoize the Google auth success callback
  const handleGoogleAuthSuccess = useCallback(async (googleUser) => {
    // Prevent duplicate processing
    if (googleLoginInProgress.current) {
      console.log('⚠️ Google login already in progress, skipping...');
      return;
    }

    googleLoginInProgress.current = true;
    
    try {
      setIsGoogleLoading(true);
      console.log('🔐 Processing Google login for:', googleUser.email);

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

        Toast.show({ 
          type: 'success', 
          text1: 'Welcome!', 
          text2: 'Logged in with Google successfully'
        });
        
        console.log('✅ Google login successful, redirecting to:', role === 'admin' ? '/admin' : '/');
        router.push(role === 'admin' ? '/admin' : '/');
      } else {
        console.error('❌ Google login failed - missing token or user ID');
        Toast.show({
          type: 'error',
          text1: 'Google login failed',
          text2: 'Server response incomplete',
        });
      }
    } catch (err) {
      console.error('❌ Google login error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Network error';
      Toast.show({ 
        type: 'error', 
        text1: 'Google login failed',
        text2: errorMessage
      });
    } finally {
      setIsGoogleLoading(false);
      // Reset the flag after a delay to prevent rapid re-attempts
      setTimeout(() => {
        googleLoginInProgress.current = false;
      }, 3000);
    }
  }, [router]);

  const { promptAsync, request, redirectUri } = useGoogleAuth(handleGoogleAuthSuccess);

  useEffect(() => {
    console.log('🔗 Current redirect URI:', redirectUri);
  }, [redirectUri]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setServerStatus('checking');
        
        // OFFLINE-FIRST AUTH: Check existing tokens first
        const existingToken = await SecureStore.getItemAsync('auth_token');
        const existingUserId = await SecureStore.getItemAsync('user_id');
        
        if (existingToken && existingUserId) {
          console.log('🔑 Found existing auth tokens, redirecting immediately');
          
          const userRole = await SecureStore.getItemAsync('user_role');
          router.replace(userRole === 'admin' ? '/admin' : '/');
          return; // Exit early - don't need to check server
        }

        console.log('❌ No existing tokens found, proceeding with server check');

        // Test server connectivity (non-blocking for UI)
        await testServerConnectivity();
        
      } catch (error) {
        console.error('❌ App initialization error:', error);
        // Don't fail completely - allow user to try login anyway
        setServerStatus('unreachable');
        Toast.show({
          type: 'warning',
          text1: 'Connection Issue',
          text2: 'Limited functionality available',
        });
      } finally {
        setReady(true);
      }
    };

    const testServerConnectivity = async () => {
      try {
        console.log('🌐 Testing server connectivity...');
        const baseUrl = getCurrentBaseUrl();
        console.log('📍 Current base URL:', baseUrl);
        
        // Simple ping with timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 8000)
        );
        
        const pingPromise = api.get('/api/v1/ping');
        
        await Promise.race([pingPromise, timeoutPromise]);
        console.log('✅ Server is reachable');
        setServerStatus('connected');
        
      } catch (pingError) {
        console.log('❌ Server ping failed, trying to refresh base URL...');
        
        try {
          // Try to refresh and find a working server
          const newBaseUrl = await refreshBaseUrl();
          console.log('🔄 New base URL resolved:', newBaseUrl);
          
          // Test again with new URL (with timeout)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );
          
          const retryPromise = api.get('/api/v1/ping');
          await Promise.race([retryPromise, timeoutPromise]);
          
          console.log('✅ Server is reachable after refresh');
          setServerStatus('connected');
          
        } catch (refreshError) {
          console.log('❌ Server unreachable after refresh');
          setServerStatus('unreachable');
        }
      }
    };

    initializeApp();
  }, [router]);

  const handleLogin = async () => {
    if (isLoggingIn) return;

    setErrorMsg('');
    setIsLoggingIn(true);

    try {
      console.log('🔐 Attempting login for:', email);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timeout')), 15000)
      );
      
      const loginPromise = api.post('/api/v1/login', {
        user: { email, password },
      });
      
      const response = await Promise.race([loginPromise, timeoutPromise]);

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

        Toast.show({ 
          type: 'success', 
          text1: 'Welcome back!', 
          text2: 'Login successful' 
        });
        
        console.log('✅ Login successful, redirecting to:', role === 'admin' ? '/admin' : '/');
        router.push(role === 'admin' ? '/admin' : '/');
      } else {
        const message = 'Login failed: Server response incomplete';
        setErrorMsg(message);
        console.error('❌', message);
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: 'Server response incomplete',
        });
      }
    } catch (err) {
      console.error('❌ Login error:', err?.response?.data || err?.message);
      
      let errorMessage = 'Please try again';
      let toastMessage = 'Unexpected error';

      if (err?.message === 'Login timeout') {
        errorMessage = 'Request timed out - check your connection';
        toastMessage = 'Connection timeout';
      } else if (err?.response?.status === 401) {
        errorMessage = 'Invalid email or password';
        toastMessage = 'Invalid credentials';
      } else if (err?.response?.status === 422) {
        errorMessage = 'Please check your email and password';
        toastMessage = 'Invalid input format';
      } else if (err?.code === 'NETWORK_ERROR' || err?.message === 'Network Error') {
        errorMessage = 'Network error - check your connection';
        toastMessage = 'Connection failed';
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
        toastMessage = 'Server error';
      }

      setErrorMsg(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: toastMessage,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !request || googleLoginInProgress.current) {
      console.log('⚠️ Google login blocked - already in progress or no request');
      return;
    }

    setIsGoogleLoading(true);

    try {
      console.log('🚀 Initiating Google login...');
      const result = await promptAsync();
      
      console.log('📋 Google login result:', result?.type);

      if (result?.type === 'success') {
        // Success is handled by the useEffect in useGoogleAuth
        console.log('✅ Google OAuth successful');
        return;
      }

      if (result?.type === 'cancel') {
        Toast.show({ 
          type: 'info', 
          text1: 'Cancelled', 
          text2: 'Google login was cancelled' 
        });
      } else if (result?.type === 'dismiss') {
        Toast.show({ 
          type: 'info', 
          text1: 'Dismissed', 
          text2: 'Google login was dismissed' 
        });
      } else if (result?.type === 'error') {
        console.error('❌ Google OAuth error:', result.error);
        Toast.show({
          type: 'error',
          text1: 'Google login error',
          text2: result.error?.message || 'OAuth failed',
        });
      }
    } catch (error) {
      console.error('❌ Google login prompt error:', error);
      Toast.show({
        type: 'error',
        text1: 'Google login error',
        text2: 'Something went wrong',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRetryConnection = async () => {
    setReady(false);
    setServerStatus('checking');
    
    try {
      console.log('🔄 Retrying server connection...');
      const newBaseUrl = await refreshBaseUrl();
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 8000)
      );
      
      const pingPromise = api.get('/api/v1/ping');
      await Promise.race([pingPromise, timeoutPromise]);
      
      setServerStatus('connected');
      
      Toast.show({
        type: 'success',
        text1: 'Connected!',
        text2: `Server: ${newBaseUrl}`,
      });
    } catch (error) {
      setServerStatus('unreachable');
      Toast.show({
        type: 'error',
        text1: 'Still unreachable',
        text2: 'Please check your network',
      });
    } finally {
      setReady(true);
    }
  };

  const getServerStatusColor = () => {
    switch (serverStatus) {
      case 'connected': return '#10b981'; // green
      case 'unreachable': return '#ef4444'; // red
      case 'checking': return '#f59e0b'; // yellow
      default: return '#6b7280'; // gray
    }
  };

  const getServerStatusText = () => {
    switch (serverStatus) {
      case 'connected': return 'Server Connected';
      case 'unreachable': return 'Server Unreachable';
      case 'checking': return 'Checking Connection...';
      default: return 'Unknown Status';
    }
  };

  // Gradient Welcome Back Text Component
  const GradientText = ({ children, style }: { children: string; style?: any }) => (
    <MaskedView
      style={style}
      maskElement={
        <Text style={[styles.title, { backgroundColor: 'transparent' }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={['#7c3aed', '#a855f7', '#c084fc', '#ddd6fe']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.titleGradient}
      >
        <Text style={[styles.title, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );

  return (
    <>
      <LinearGradient colors={['#0a0a0f', '#0a0a0f']} style={styles.container}>
        <View style={styles.inner}>
          <GradientText>Welcome Back!</GradientText>

          {/* Server Status Indicator */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getServerStatusColor() }]} />
            <Text style={[styles.statusText, { color: getServerStatusColor() }]}>
              {getServerStatusText()}
            </Text>
            {serverStatus === 'unreachable' && (
              <TouchableOpacity onPress={handleRetryConnection} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>

          {!ready ? (
            <>
              <ActivityIndicator size="large" color="#bd93f9" />
              <Text style={styles.loadingText}>Initializing...</Text>
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
                  (isGoogleLoading || !request || googleLoginInProgress.current) && styles.disabledBtn,
                ]}
                disabled={isGoogleLoading || !request || isLoggingIn || googleLoginInProgress.current}
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
      
      {/* Toast with custom config */}
      <Toast config={toastConfig} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(124, 58, 237, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  titleGradient: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  retryText: {
    color: '#bd93f9',
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(30, 30, 47, 0.8)',
    borderRadius: 12,
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
    fontWeight: '500',
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
    backgroundColor: 'rgba(32, 32, 42, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
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
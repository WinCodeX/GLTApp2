import { AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import api, { getCurrentBaseUrl, refreshBaseUrl, initializeApi } from '../../lib/api';
import { useGoogleAuth } from '../../lib/useGoogleAuth';
import { toastConfig } from '../../lib/toastConfig';
import { checkServerStatus } from '../../lib/netStatus';
import LoadingSplashScreen from '../../components/LoadingSplashScreen'; // Import the splash screen

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

      if (token && userId && user) {
        // Save authentication data
        await SecureStore.setItemAsync('auth_token', token);
        await SecureStore.setItemAsync('user_id', String(userId));

        // Determine and save user role
        const roles = user?.roles || [];
        const role = roles.includes('admin') ? 'admin' : 'client';
        await SecureStore.setItemAsync('user_role', role);

        // ✅ Save complete user data for account screen
        const userData = {
          id: user.id,
          email: user.email,
          username: user.username || null,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          display_name: user.display_name || user.first_name || null,
          phone: user.phone || null,
          avatar_url: user.avatar_url || null,
          role: role,
          roles: roles,
          created_at: user.created_at,
          updated_at: user.updated_at,
          provider: 'google', // Track that this was a Google login
        };

        // Save user data to AsyncStorage for UserContext
        try {
          await AsyncStorage.setItem('user_data', JSON.stringify(userData));
          console.log('✅ Google user data saved:', userData);
        } catch (storageError) {
          console.warn('⚠️ Failed to save Google user data to storage:', storageError);
          // Non-critical error, continue with login
        }

        Toast.show({ 
          type: 'success', 
          text1: 'Welcome!', 
          text2: 'Logged in with Google successfully'
        });
        
        console.log('✅ Google login successful, redirecting to:', role === 'admin' ? '/admin' : '/');
        
        setTimeout(() => {
          router.push(role === 'admin' ? '/admin' : '/');
        }, 1500);
      } else {
        console.error('❌ Google login failed - missing token or user ID', { hasToken: !!token, hasUserId: !!userId, hasUser: !!user });
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

        console.log('❌ No existing tokens found, initializing API...');

        // Initialize API properly
        await initializeApi();
        
        // Test server connectivity
        await testServerConnectivity();
        
      } catch (error) {
        console.error('❌ App initialization error:', error);
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
        
        const status = await checkServerStatus();
        
        if (status === 'online') {
          console.log('✅ Server is reachable');
          setServerStatus('connected');
        } else {
          console.log('❌ Server unreachable, trying to refresh...');
          
          // Try to refresh and find a working server
          const newBaseUrl = await refreshBaseUrl();
          console.log('🔄 New base URL resolved:', newBaseUrl);
          
          // Test again
          const retryStatus = await checkServerStatus();
          
          if (retryStatus === 'online') {
            console.log('✅ Server is reachable after refresh');
            setServerStatus('connected');
          } else {
            console.log('❌ Server still unreachable after refresh');
            setServerStatus('unreachable');
          }
        }
        
      } catch (error) {
        console.log('❌ Server connectivity test failed:', error);
        setServerStatus('unreachable');
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
      
      const response = await api.post('/api/v1/login', {
        user: { email, password },
      });

      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;
      const userId = user?.id;

      if (token && userId && user) {
        // Save authentication data
        await SecureStore.setItemAsync('auth_token', token);
        await SecureStore.setItemAsync('user_id', String(userId));

        // Determine and save user role
        const roles = user?.roles || [];
        const role = roles.includes('admin') ? 'admin' : 'client';
        await SecureStore.setItemAsync('user_role', role);

        // ✅ Save complete user data for account screen
        const userData = {
          id: user.id,
          email: user.email,
          username: user.username || null,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          display_name: user.display_name || user.first_name || null,
          phone: user.phone || null,
          avatar_url: user.avatar_url || null,
          role: role,
          roles: roles,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };

        // Save user data to AsyncStorage for UserContext
        try {
          await AsyncStorage.setItem('user_data', JSON.stringify(userData));
          console.log('✅ User data saved:', userData);
        } catch (storageError) {
          console.warn('⚠️ Failed to save user data to storage:', storageError);
          // Non-critical error, continue with login
        }

        Toast.show({ 
          type: 'success', 
          text1: 'Welcome back!', 
          text2: 'Login successful' 
        });
        
        console.log('✅ Login successful, redirecting to:', role === 'admin' ? '/admin' : '/');
        
        setTimeout(() => {
          router.push(role === 'admin' ? '/admin' : '/');
        }, 1500);
      } else {
        const message = 'Login failed: Server response incomplete';
        setErrorMsg(message);
        console.error('❌', message, { hasToken: !!token, hasUserId: !!userId, hasUser: !!user });
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

      if (err?.response?.status === 401) {
        errorMessage = 'Invalid email or password';
        toastMessage = 'Invalid credentials';
      } else if (err?.response?.status === 422) {
        errorMessage = 'Please check your email and password';
        toastMessage = 'Invalid input format';
      } else if (err?.code === 'NETWORK_ERROR' || err?.message === 'Network Error') {
        errorMessage = 'Network error - check your connection';
        toastMessage = 'Connection failed';
      } else if (err?.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out - check your connection';
        toastMessage = 'Connection timeout';
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
      
      const status = await checkServerStatus();
      
      if (status === 'online') {
        setServerStatus('connected');
        Toast.show({
          type: 'success',
          text1: 'Connected!',
          text2: `Server: ${newBaseUrl}`,
        });
      } else {
        setServerStatus('unreachable');
        Toast.show({
          type: 'error',
          text1: 'Still unreachable',
          text2: 'Please check your network',
        });
      }
    } catch (error) {
      setServerStatus('unreachable');
      Toast.show({
        type: 'error',
        text1: 'Connection failed',
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

  // Gradient Welcome Back Text Component (Fixed - removed MaskedView)
  const GradientText = ({ children, style }: { children: string; style?: any }) => (
    <LinearGradient
      colors={['#7c3aed', '#a855f7', '#c084fc', '#ddd6fe']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.titleGradientContainer, style]}
    >
      <Text style={styles.title}>{children}</Text>
    </LinearGradient>
  );

  // Show custom splash screen instead of loading spinner
  if (!ready) {
    return <LoadingSplashScreen backgroundColor="#0a0a0f" />;
  }

  return (
    <>
      <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.formContainer}>
            {/* Welcome Back Title - Moved closer to form */}
            <View style={styles.titleContainer}>
              <GradientText>Welcome Back!</GradientText>
            </View>

            {/* Server Status Indicator - Moved closer to form */}
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
          </View>
        </View>
      </LinearGradient>
      
      <Toast config={toastConfig} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { 
    flex: 1, 
    paddingHorizontal: 24, 
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16, // Reduced spacing between title and server status
  },
  titleGradientContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff', // White text on gradient background
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleGradient: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32, // More space between status and first input
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
  formContainer: {
    justifyContent: 'center',
    alignItems: 'stretch', // Stretch to full width
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
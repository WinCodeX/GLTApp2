// app/(auth)/login.tsx - Fixed role detection logic
import { AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
import LoadingSplashScreen from '../../components/LoadingSplashScreen';
import { accountManager } from '../../lib/AccountManager';
import { useUser } from '../../context/UserContext';

// Helper function to determine effective role from user data - FIXED
const getEffectiveRole = (userData: any): string => {
  // First priority: use primary_role if it exists (removed the !== 'client' condition)
  if (userData.primary_role) {
    return userData.primary_role;
  }
  
  // Second priority: check roles array for non-client roles
  if (userData.roles && Array.isArray(userData.roles)) {
    // Priority order: admin > support > agent > rider > client
    if (userData.roles.includes('admin')) {
      return 'admin';
    }
    if (userData.roles.includes('support')) {
      return 'support';
    }
    if (userData.roles.includes('agent')) {
      return 'agent';
    }
    if (userData.roles.includes('rider')) {
      return 'rider';
    }
  }
  
  // Fallback: use role field or default to client
  return userData.role || 'client';
};

// Helper function to get redirect route based on role
const getRedirectRoute = (role: string): string => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'support':
      return '/(support)';
    case 'agent':
      return '/(agent)';
    case 'rider':
      return '/(rider)';
    default:
      return '/(drawer)';
  }
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ready, setReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const router = useRouter();
  const { addAccount } = useUser();
  
  const googleLoginInProgress = useRef(false);

  // Handle Rails OAuth success
  const handleGoogleAuthSuccess = useCallback(async (railsUser: any, isNewUser: boolean) => {
    if (googleLoginInProgress.current) {
      console.log('Google login already in progress, skipping...');
      return;
    }

    googleLoginInProgress.current = true;
    
    try {
      setIsGoogleLoading(true);
      console.log('Processing Rails OAuth login for:', railsUser.email);
      console.log('User roles:', railsUser.roles);
      console.log('User primary_role:', railsUser.primary_role);

      // Get effective role using the same logic as drawer layout
      const effectiveRole = getEffectiveRole(railsUser);
      console.log('Effective role determined:', effectiveRole);

      // Add account through UserContext (which uses AccountManager)
      await addAccount(railsUser, railsUser.token || 'temp_token');

      Toast.show({ 
        type: 'success', 
        text1: 'Welcome!', 
        text2: isNewUser 
          ? `Account created for ${railsUser.display_name}` 
          : `Welcome back, ${railsUser.display_name}!`
      });
      
      const redirectRoute = getRedirectRoute(effectiveRole);
      console.log('Google login successful, redirecting to:', redirectRoute);
      
      setTimeout(() => {
        router.push(redirectRoute);
      }, 1500);

    } catch (err: any) {
      console.error('Google login error:', err);
      const errorMessage = err?.message || 'OAuth processing error';
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
  }, [router, addAccount]);

  const { promptAsync, request } = useGoogleAuth(handleGoogleAuthSuccess);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setServerStatus('checking');
        
        // Initialize AccountManager first
        await accountManager.initialize();
        
        // Check if we have an active account
        const currentAccount = accountManager.getCurrentAccount();
        if (currentAccount) {
          console.log('Found existing account, checking role and redirecting...');
          console.log('Account role:', currentAccount.role);
          
          const redirectRoute = getRedirectRoute(currentAccount.role);
          console.log('Redirecting to:', redirectRoute);
          
          router.replace(redirectRoute);
          return;
        }

        console.log('No existing accounts found, initializing API...');
        
        try {
          await initializeApi();
        } catch (bootstrapError) {
          console.warn('Bootstrap warning (non-critical):', bootstrapError);
        }
        
        await testServerConnectivity();
        
        setReady(true);
        
      } catch (error) {
        console.error('Critical initialization error:', error);
        
        // Fallback check for any accounts
        const hasAccounts = accountManager.hasAccounts();
        if (hasAccounts) {
          console.log('Error during init but found accounts - staying authenticated');
        } else {
          console.log('Error during init and no accounts - ready for login');
        }
        
        setReady(true);
      }
    };

    const testServerConnectivity = async () => {
      try {
        console.log('Testing server connectivity...');
        const baseUrl = getCurrentBaseUrl();
        console.log('Current base URL:', baseUrl);
        
        const status = await checkServerStatus();
        
        if (status === 'online') {
          console.log('Server is reachable');
          setServerStatus('connected');
        } else {
          console.log('Server unreachable, trying to refresh...');
          const newBaseUrl = await refreshBaseUrl();
          console.log('New base URL resolved:', newBaseUrl);
          
          const retryStatus = await checkServerStatus();
          if (retryStatus === 'online') {
            console.log('Server is reachable after refresh');
            setServerStatus('connected');
          } else {
            console.log('Server still unreachable after refresh');
            setServerStatus('unreachable');
          }
        }
        
      } catch (error) {
        console.log('Server connectivity test failed:', error);
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
      console.log('Attempting login for:', email);
      
      const response = await api.post('/api/v1/login', {
        user: { email, password },
      });

      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;

      if (token && user) {
        console.log('Login response user roles:', user?.roles);
        console.log('Login response user primary_role:', user?.primary_role);

        // Get effective role using the same logic as drawer layout
        const effectiveRole = getEffectiveRole(user);
        console.log('Effective role determined:', effectiveRole);

        // Add account through UserContext (which uses AccountManager)
        await addAccount(user, token);

        Toast.show({ 
          type: 'success', 
          text1: 'Welcome back!', 
          text2: 'Login successful' 
        });
        
        const redirectRoute = getRedirectRoute(effectiveRole);
        console.log('Login successful, redirecting to:', redirectRoute);
        
        setTimeout(() => {
          router.push(redirectRoute);
        }, 1500);
      } else {
        const message = 'Login failed: Server response incomplete';
        setErrorMsg(message);
        console.error(message, { hasToken: !!token, hasUser: !!user });
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: 'Server response incomplete',
        });
      }
    } catch (err: any) {
      console.error('Login error:', err?.response?.data || err?.message);
      
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
      console.log('Google login blocked - already in progress or no request');
      return;
    }

    setIsGoogleLoading(true);

    try {
      console.log('Initiating Google login...');
      const result = await promptAsync();
      
      console.log('Google login result:', result?.type);

      if (result?.type === 'success') {
        console.log('Google OAuth successful');
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
        console.error('Google OAuth error:', result.error);
        Toast.show({
          type: 'error',
          text1: 'Google login error',
          text2: result.error?.message || 'OAuth failed',
        });
      }
    } catch (error: any) {
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

  const handleRetryConnection = async () => {
    setReady(false);
    setServerStatus('checking');
    
    try {
      console.log('Retrying server connection...');
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
      case 'connected': return '#10b981';
      case 'unreachable': return '#ef4444';
      case 'checking': return '#f59e0b';
      default: return '#6b7280';
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

  if (!ready) {
    return <LoadingSplashScreen backgroundColor="#0a0a0f" />;
  }

  return (
    <>
      <LinearGradient colors={['#0a0a0f', '#0a0a0f']} style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.formContainer}>
            <View style={styles.titleContainer}>
              <LinearGradient
                colors={['#7c3aed', '#a855f7', '#c084fc', '#ddd6fe']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.titleGradientContainer}
              >
                <Text style={styles.title}>Welcome Back!</Text>
              </LinearGradient>
            </View>

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
    marginBottom: 16,
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
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
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
    alignItems: 'stretch',
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
    fontWeight: '500',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20202a',
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
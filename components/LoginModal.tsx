// components/LoginModal.tsx - Fixed with proper AsyncStorage persistence
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';
import { useUser } from '../context/UserContext';
import { useGoogleAuth } from '../lib/useGoogleAuth';

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
}

export default function LoginModal({ visible, onClose, onSwitchToSignup }: LoginModalProps) {
  const { addAccount } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleAuthSuccess = async (railsUser: any, isNewUser: boolean) => {
    try {
      setIsGoogleLoading(true);
      console.log('🔐 Processing Google login for modal:', railsUser.email);

      const user = railsUser;
      const roles = user?.roles || [];
      const role = roles.includes('admin') ? 'admin' : 'client';

      // Save complete user data for account screen - same as login.tsx
      const userData = {
        id: user.id,
        email: user.email,
        username: user.username || null,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        display_name: user.display_name || user.first_name || null,
        phone: user.phone_number || null,
        avatar_url: user.avatar_url || user.google_image_url || null,
        role: role,
        roles: roles,
        created_at: user.created_at,
        updated_at: user.updated_at,
        provider: 'google',
      };

      // Save user data to AsyncStorage
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
      console.log('✅ Google user data saved to AsyncStorage');

      // Add account using UserContext
      await addAccount(userData, 'google_oauth_token');

      Toast.show({
        type: 'success',
        text1: 'Account Added!',
        text2: `Welcome back, ${user.display_name || user.first_name}!`,
      });
      
      handleClose();
    } catch (error: any) {
      console.error('❌ Google login error in modal:', error);
      setErrorMsg('Google authentication failed');
      Toast.show({
        type: 'error',
        text1: 'Failed to add account',
        text2: error.message || 'Google authentication failed',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const { promptAsync, request } = useGoogleAuth(handleGoogleAuthSuccess);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      console.log('🔐 Modal login attempt for:', email);
      
      const response = await api.post('/api/v1/login', {
        user: { email, password },
      });

      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;
      const userId = user?.id;

      if (token && userId && user) {
        console.log('✅ Modal login successful for:', user.email);

        // Determine user role
        const roles = user?.roles || [];
        const role = roles.includes('admin') ? 'admin' : 'client';

        // Save complete user data - same as login.tsx
        const userData = {
          id: user.id,
          email: user.email,
          username: user.username || null,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          display_name: user.display_name || user.first_name || null,
          phone: user.phone_number || null,
          avatar_url: user.avatar_url || null,
          role: role,
          roles: roles,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };

        // Save user data to AsyncStorage
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        console.log('✅ User data saved to AsyncStorage');

        // Add account using UserContext
        await addAccount(userData, token);

        Toast.show({
          type: 'success',
          text1: 'Account Added!',
          text2: `Welcome back, ${user.display_name || user.first_name || user.email}!`,
        });
        
        handleClose();
      } else {
        const message = 'Login failed: Server response incomplete';
        setErrorMsg(message);
        console.error('❌ Modal login failed:', { hasToken: !!token, hasUserId: !!userId, hasUser: !!user });
      }
    } catch (error: any) {
      console.error('❌ Modal login error:', error);
      
      let errorMessage = 'Please try again';
      
      if (error?.response?.status === 401) {
        errorMessage = 'Invalid email or password';
      } else if (error?.response?.status === 422) {
        errorMessage = 'Please check your email and password';
      } else if (error?.code === 'NETWORK_ERROR' || error?.message === 'Network Error') {
        errorMessage = 'Network error - check your connection';
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setErrorMsg(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !request) return;

    setErrorMsg('');
    setIsGoogleLoading(true);
    
    try {
      console.log('🚀 Modal Google login...');
      await promptAsync();
    } catch (error) {
      console.error('❌ Modal Google login error:', error);
      setErrorMsg('Google login failed');
      Toast.show({
        type: 'error',
        text1: 'Google login error',
        text2: 'Something went wrong',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setErrorMsg('');
    setIsLoading(false);
    setIsGoogleLoading(false);
    onClose();
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent 
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Log in</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username, email or mobile number"
              placeholderTextColor="#ccc"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading && !isGoogleLoading}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor="#ccc"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading && !isGoogleLoading}
              />
              <TouchableOpacity 
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color="#aaa" 
                />
              </TouchableOpacity>
            </View>

            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

            <TouchableOpacity 
              style={[styles.googleButton, (!request || isLoading || isGoogleLoading) && styles.disabledButton]}
              onPress={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading || !request}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <AntDesign name="google" size={20} color="white" />
              )}
              <Text style={styles.googleButtonText}>
                {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            <LinearGradient
              colors={['#7c3aed', '#3b82f6', '#10b981']}
              style={[styles.loginButtonGradient, (isLoading || isGoogleLoading) && styles.disabledButton]}
            >
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Log in</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>

            <TouchableOpacity 
              style={styles.forgotPassword}
              disabled={isLoading || isGoogleLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              onPress={onSwitchToSignup}
              disabled={isLoading || isGoogleLoading}
            >
              <Text style={styles.switchText}>Create new account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#0a0a0f',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#44475a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8f8f2',
  },
  form: {
    padding: 20,
  },
  input: {
    backgroundColor: '#1e1e2f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f8f8f2',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#44475a',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 17,
  },
  error: {
    color: '#ff5555',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20202a',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#44475a',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButtonGradient: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 8,
  },
  loginButton: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  forgotPasswordText: {
    color: '#bd93f9',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#44475a',
    backgroundColor: '#1a1a2e',
  },
  switchText: {
    color: '#bd93f9',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
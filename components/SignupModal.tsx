// components/SignupModal.tsx - Fixed with proper AsyncStorage persistence
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

interface SignupModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export default function SignupModal({ visible, onClose, onSwitchToLogin }: SignupModalProps) {
  const { addAccount } = useUser();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleAuthSuccess = async (railsUser: any, isNewUser: boolean) => {
    try {
      setIsGoogleLoading(true);
      console.log('🔐 Processing Google signup for modal:', railsUser.email);

      const user = railsUser;
      const roles = user?.roles || [];
      const role = roles.includes('admin') ? 'admin' : 'client';

      // Save complete user data - same as signup.tsx
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
        text1: 'Account Created!',
        text2: `Welcome, ${user.display_name || user.first_name}!`,
      });
      
      handleClose();
    } catch (error: any) {
      console.error('❌ Google signup error in modal:', error);
      setErrorMsg('Google authentication failed');
      Toast.show({
        type: 'error',
        text1: 'Failed to create account',
        text2: error.message || 'Google authentication failed',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const { promptAsync, request } = useGoogleAuth(handleGoogleAuthSuccess);

  const handleSignup = async () => {
    if (!email.trim() || !firstName.trim() || !password.trim()) {
      setErrorMsg('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      console.log('🔐 Modal signup attempt for:', email);
      
      const response = await api.post('/api/v1/signup', {
        user: {
          email,
          phone_number: phone,
          first_name: firstName,
          last_name: lastName,
          password,
          password_confirmation: confirmPassword,
        },
      });

      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;
      const userId = user?.id;

      if (token && userId && user) {
        console.log('✅ Modal signup successful for:', user.email);

        // Determine user role
        const roles = user?.roles || [];
        const role = roles.includes('admin') ? 'admin' : 'client';

        // Save complete user data - same as signup.tsx
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
          text1: 'Account Created!',
          text2: `Welcome, ${user.display_name || user.first_name || user.email}!`,
        });
        
        handleClose();
      } else {
        const message = 'Signup failed: Server response incomplete';
        setErrorMsg(message);
        console.error('❌ Modal signup failed:', { hasToken: !!token, hasUserId: !!userId, hasUser: !!user });
      }
    } catch (error: any) {
      console.error('❌ Modal signup error:', error);
      
      let errorMessage = 'Please try again';
      
      if (error?.response?.status === 422) {
        errorMessage = error?.response?.data?.error || 'Invalid input';
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

  const handleGoogleSignup = async () => {
    if (isGoogleLoading || !request) return;

    setErrorMsg('');
    setIsGoogleLoading(true);
    
    try {
      console.log('🚀 Modal Google signup...');
      await promptAsync();
    } catch (error) {
      console.error('❌ Modal Google signup error:', error);
      setErrorMsg('Google signup failed');
      Toast.show({
        type: 'error',
        text1: 'Google signup error',
        text2: 'Something went wrong',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
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
            <Text style={styles.title}>Create account</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#ccc"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading && !isGoogleLoading}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="First name"
                placeholderTextColor="#ccc"
                value={firstName}
                onChangeText={setFirstName}
                editable={!isLoading && !isGoogleLoading}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Last name"
                placeholderTextColor="#ccc"
                value={lastName}
                onChangeText={setLastName}
                editable={!isLoading && !isGoogleLoading}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Phone (optional)"
              placeholderTextColor="#ccc"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
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

            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Confirm password"
                placeholderTextColor="#ccc"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading && !isGoogleLoading}
              />
              <TouchableOpacity 
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Feather 
                  name={showConfirmPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color="#aaa" 
                />
              </TouchableOpacity>
            </View>

            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

            <TouchableOpacity 
              style={[styles.googleButton, (!request || isLoading || isGoogleLoading) && styles.disabledButton]}
              onPress={handleGoogleSignup}
              disabled={isLoading || isGoogleLoading || !request}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <AntDesign name="google" size={20} color="white" />
              )}
              <Text style={styles.googleButtonText}>
                {isGoogleLoading ? 'Creating account...' : 'Sign up with Google'}
              </Text>
            </TouchableOpacity>

            <LinearGradient
              colors={['#7c3aed', '#3b82f6', '#10b981']}
              style={[styles.signupButtonGradient, (isLoading || isGoogleLoading) && styles.disabledButton]}
            >
              <TouchableOpacity 
                style={styles.signupButton}
                onPress={handleSignup}
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.signupButtonText}>Create account</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              onPress={onSwitchToLogin}
              disabled={isLoading || isGoogleLoading}
            >
              <Text style={styles.switchText}>Already have an account? Log in</Text>
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
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
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
  halfInput: {
    flex: 1,
    marginBottom: 0,
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
  signupButtonGradient: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 8,
  },
  signupButton: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
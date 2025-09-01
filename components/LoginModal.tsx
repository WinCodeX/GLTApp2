// components/LoginModal.tsx
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
import Toast from 'react-native-toast-message';
import api from '../lib/api';
import { useUser } from '../context/UserContext';
import { useGoogleAuth } from '../lib/useGoogleAuth';
import colors from '../theme/colors';

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
}

export default function LoginModal({ visible, onClose, onSwitchToSignup }: LoginModalProps) {
  const { addAccount } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleAuthSuccess = async (googleUser: any) => {
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

      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;

      if (token && user) {
        await addAccount(user, token);
        Toast.show({
          type: 'success',
          text1: 'Account Added!',
          text2: `Welcome back, ${user.display_name || user.first_name}!`,
        });
        handleClose();
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to add account',
        text2: error.response?.data?.error || 'Google authentication failed',
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
      const response = await api.post('/api/v1/login', {
        user: { email, password },
      });

      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;

      if (token && user) {
        await addAccount(user, token);
        Toast.show({
          type: 'success',
          text1: 'Account Added!',
          text2: `Welcome back, ${user.display_name || user.first_name || user.email}!`,
        });
        handleClose();
      } else {
        setErrorMsg('Authentication failed');
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        setErrorMsg('Invalid email or password');
      } else {
        setErrorMsg('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !request) return;

    setIsGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error) {
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
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading && !isGoogleLoading}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading && !isGoogleLoading}
            />

            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

            <TouchableOpacity 
              style={[styles.loginButton, (isLoading || isGoogleLoading) && styles.disabledButton]} 
              onPress={handleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Log in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={[styles.googleButton, (isLoading || isGoogleLoading || !request) && styles.disabledButton]}
              onPress={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading || !request}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <AntDesign name="google" size={20} color="#4285F4" />
              )}
              <Text style={styles.googleButtonText}>
                {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onSwitchToSignup}>
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
    backgroundColor: colors.background,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  form: {
    padding: 20,
  },
  input: {
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  error: {
    color: '#ff5555',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  loginButton: {
    backgroundColor: '#1877f2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
    color: '#1877f2',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#444',
  },
  dividerText: {
    color: '#888',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchText: {
    color: '#1877f2',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
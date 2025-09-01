// components/SignupModal.tsx
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
          text1: 'Account Created!',
          text2: `Welcome, ${user.display_name || user.first_name}!`,
        });
        handleClose();
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to create account',
        text2: error.response?.data?.error || 'Google authentication failed',
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
      const response = await api.post('/api/v1/signup', {
        user: {
          email,
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          password,
          password_confirmation: confirmPassword,
        },
      });

      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;

      if (token && user) {
        await addAccount(user, token);
        Toast.show({
          type: 'success',
          text1: 'Account Created!',
          text2: `Welcome, ${user.display_name || user.first_name || user.email}!`,
        });
        handleClose();
      } else {
        setErrorMsg('Account creation failed');
      }
    } catch (error: any) {
      if (error?.response?.status === 422) {
        setErrorMsg(error?.response?.data?.error || 'Invalid input');
      } else {
        setErrorMsg('Signup failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (isGoogleLoading || !request) return;

    setIsGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error) {
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
              placeholderTextColor="#888"
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
                placeholderTextColor="#888"
                value={firstName}
                onChangeText={setFirstName}
                editable={!isLoading && !isGoogleLoading}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Last name"
                placeholderTextColor="#888"
                value={lastName}
                onChangeText={setLastName}
                editable={!isLoading && !isGoogleLoading}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Phone (optional)"
              placeholderTextColor="#888"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!isLoading && !isGoogleLoading}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor="#888"
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
                  color="#888" 
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Confirm password"
                placeholderTextColor="#888"
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
                  color="#888" 
                />
              </TouchableOpacity>
            </View>

            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

            <TouchableOpacity 
              style={styles.googleButton}
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
              style={styles.signupButtonGradient}
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
            <TouchableOpacity onPress={onSwitchToLogin}>
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
    color: '#fff',
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
});
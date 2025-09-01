// components/AccountManagementModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { AntDesign, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';
import { useGoogleAuth } from '../lib/useGoogleAuth';
import { useUser } from '../context/UserContext';
import colors from '../theme/colors';

interface AccountManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AccountManagementModal({ visible, onClose }: AccountManagementModalProps) {
  const { addAccount } = useUser();
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setConfirmPassword('');
    setErrorMsg('');
    setIsLogin(true);
    setIsLoading(false);
    setIsGoogleLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleGoogleAuthSuccess = async (googleUser: any, isNewUser: boolean) => {
    try {
      setIsGoogleLoading(true);
      
      // Call your API to handle Google auth
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
          text2: `${user.display_name || user.first_name} added successfully`,
        });
        
        handleClose();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Google auth error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to add account',
        text2: error.response?.data?.error || error.message || 'Google authentication failed',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const { promptAsync, request } = useGoogleAuth(handleGoogleAuthSuccess);

  const handleSubmit = async () => {
    if (isLoading) return;

    setErrorMsg('');
    setIsLoading(true);

    try {
      if (!isLogin && password !== confirmPassword) {
        setErrorMsg('Passwords do not match');
        return;
      }

      const endpoint = isLogin ? '/api/v1/login' : '/api/v1/signup';
      const payload = isLogin
        ? { user: { email, password } }
        : { 
            user: { 
              email, 
              password, 
              password_confirmation: confirmPassword,
              first_name: firstName,
              last_name: lastName,
              phone_number: phone,
            } 
          };

      const response = await api.post(endpoint, payload);
      
      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;

      if (token && user) {
        await addAccount(user, token);
        
        Toast.show({
          type: 'success',
          text1: isLogin ? 'Account Added!' : 'Account Created!',
          text2: `${user.display_name || user.first_name || user.email} added successfully`,
        });
        
        handleClose();
      } else {
        setErrorMsg('Authentication failed: Missing user data');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMessage = 'Please try again';
      
      if (error?.response?.status === 401) {
        errorMessage = 'Invalid email or password';
      } else if (error?.response?.status === 422) {
        errorMessage = error?.response?.data?.error || 'Invalid input';
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

    setIsGoogleLoading(true);
    try {
      const result = await promptAsync();
      
      if (result?.type === 'cancel') {
        Toast.show({
          type: 'info',
          text1: 'Cancelled',
          text2: 'Google login was cancelled',
        });
      } else if (result?.type === 'error') {
        Toast.show({
          type: 'error',
          text1: 'Google login error',
          text2: result.error?.message || 'Authentication failed',
        });
      }
    } catch (error: any) {
      console.error('Google login error:', error);
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Drag Handle */}
          <TouchableOpacity onPress={handleClose} style={styles.dragHandleContainer}>
            <MaterialCommunityIcons name="chevron-down" size={30} color="#bbb" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isLogin ? 'Add Account' : 'Create Account'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form */}
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.form}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                mode="outlined"
                style={styles.input}
                textColor="#f8f8f2"
                placeholderTextColor="#888"
                outlineColor="#44475a"
                activeOutlineColor={colors.primary}
                disabled={isLoading || isGoogleLoading}
              />

              {!isLogin && (
                <>
                  <View style={styles.row}>
                    <TextInput
                      label="First Name"
                      value={firstName}
                      onChangeText={setFirstName}
                      mode="outlined"
                      style={[styles.input, styles.halfInput]}
                      textColor="#f8f8f2"
                      placeholderTextColor="#888"
                      outlineColor="#44475a"
                      activeOutlineColor={colors.primary}
                      disabled={isLoading || isGoogleLoading}
                    />
                    <TextInput
                      label="Last Name"
                      value={lastName}
                      onChangeText={setLastName}
                      mode="outlined"
                      style={[styles.input, styles.halfInput]}
                      textColor="#f8f8f2"
                      placeholderTextColor="#888"
                      outlineColor="#44475a"
                      activeOutlineColor={colors.primary}
                      disabled={isLoading || isGoogleLoading}
                    />
                  </View>

                  <TextInput
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    mode="outlined"
                    style={styles.input}
                    textColor="#f8f8f2"
                    placeholderTextColor="#888"
                    outlineColor="#44475a"
                    activeOutlineColor={colors.primary}
                    disabled={isLoading || isGoogleLoading}
                  />
                </>
              )}

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                mode="outlined"
                style={styles.input}
                textColor="#f8f8f2"
                placeholderTextColor="#888"
                outlineColor="#44475a"
                activeOutlineColor={colors.primary}
                disabled={isLoading || isGoogleLoading}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                    forceTextInputFocus={false}
                    iconColor="#aaa"
                  />
                }
              />

              {!isLogin && (
                <TextInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  mode="outlined"
                  style={styles.input}
                  textColor="#f8f8f2"
                  placeholderTextColor="#888"
                  outlineColor="#44475a"
                  activeOutlineColor={colors.primary}
                  disabled={isLoading || isGoogleLoading}
                  right={
                    <TextInput.Icon
                      icon={showConfirm ? 'eye-off' : 'eye'}
                      onPress={() => setShowConfirm(!showConfirm)}
                      forceTextInputFocus={false}
                      iconColor="#aaa"
                    />
                  }
                />
              )}

              {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

              {/* Google Sign In */}
              <TouchableOpacity
                style={[styles.googleBtn, (isGoogleLoading || !request) && styles.disabledBtn]}
                disabled={isGoogleLoading || !request || isLoading}
                onPress={handleGoogleLogin}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <AntDesign name="google" size={20} color="white" />
                )}
                <Text style={styles.googleText}>
                  {isGoogleLoading 
                    ? 'Signing in...' 
                    : `${isLogin ? 'Sign in' : 'Sign up'} with Google`
                  }
                </Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={[styles.submitButton, isLoading && styles.disabledBtn]}
                labelStyle={styles.submitButtonText}
                disabled={isLoading || isGoogleLoading}
                loading={isLoading}
              >
                {isLogin ? 'Add Account' : 'Create Account'}
              </Button>

              {/* Toggle Mode */}
              <Button
                onPress={() => setIsLogin(!isLogin)}
                textColor={colors.primary}
                style={styles.toggleButton}
                disabled={isLoading || isGoogleLoading}
              >
                {isLogin 
                  ? "Don't have an account? Create one" 
                  : 'Already have an account? Sign in'
                }
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8f8f2',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingVertical: 16,
    gap: 16,
    paddingBottom: 40,
  },
  input: {
    backgroundColor: '#2a2a3d',
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  error: {
    color: '#ff5555',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  googleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
    marginTop: 8,
    paddingVertical: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  toggleButton: {
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
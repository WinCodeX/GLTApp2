// components/AccountManagementModal.tsx
import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, TextInput } from 'react-native-paper';
import { AntDesign, Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';
import { useGoogleAuth } from '../lib/useGoogleAuth';
import { useUser } from '../context/UserContext';

const { height: screenHeight } = Dimensions.get('window');

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

  // Animation states
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      resetForm();
      onClose();
    });
  };

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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <Animated.View 
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <TouchableOpacity 
            style={styles.overlayTouchable}
            onPress={handleClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
          {...panResponder.panHandlers}
        >
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f172a']}
            style={styles.modalContent}
          >
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {isLogin ? 'Add Account' : 'Create Account'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Form */}
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
                placeholderTextColor="#ccc"
                outlineColor="#44475a"
                activeOutlineColor="#bd93f9"
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
                      placeholderTextColor="#ccc"
                      outlineColor="#44475a"
                      activeOutlineColor="#bd93f9"
                      disabled={isLoading || isGoogleLoading}
                    />
                    <TextInput
                      label="Last Name"
                      value={lastName}
                      onChangeText={setLastName}
                      mode="outlined"
                      style={[styles.input, styles.halfInput]}
                      textColor="#f8f8f2"
                      placeholderTextColor="#ccc"
                      outlineColor="#44475a"
                      activeOutlineColor="#bd93f9"
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
                    placeholderTextColor="#ccc"
                    outlineColor="#44475a"
                    activeOutlineColor="#bd93f9"
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
                placeholderTextColor="#ccc"
                outlineColor="#44475a"
                activeOutlineColor="#bd93f9"
                disabled={isLoading || isGoogleLoading}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                    forceTextInputFocus={false}
                    color="#aaa"
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
                  placeholderTextColor="#ccc"
                  outlineColor="#44475a"
                  activeOutlineColor="#bd93f9"
                  disabled={isLoading || isGoogleLoading}
                  right={
                    <TextInput.Icon
                      icon={showConfirm ? 'eye-off' : 'eye'}
                      onPress={() => setShowConfirm(!showConfirm)}
                      forceTextInputFocus={false}
                      color="#aaa"
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
              <LinearGradient
                colors={['#7c3aed', '#3b82f6', '#10b981']}
                style={[styles.submitButtonGradient, isLoading && styles.disabledBtn]}
              >
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  style={styles.submitButton}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  disabled={isLoading || isGoogleLoading}
                >
                  {isLoading 
                    ? (isLogin ? 'Adding Account...' : 'Creating Account...') 
                    : (isLogin ? 'Add Account' : 'Create Account')
                  }
                </Button>
              </LinearGradient>

              {/* Toggle Mode */}
              <Button
                onPress={() => setIsLogin(!isLogin)}
                textColor="#bd93f9"
                style={styles.toggleButton}
                disabled={isLoading || isGoogleLoading}
              >
                {isLogin 
                  ? "Don't have an account? Create one" 
                  : 'Already have an account? Sign in'
                }
              </Button>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    maxHeight: screenHeight * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  modalContent: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 30,
    minHeight: 400,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: 'rgba(30, 30, 47, 0.8)',
    borderRadius: 12,
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
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(32, 32, 42, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  googleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonGradient: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  toggleButton: {
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
import React, { useState } from 'react';    
import {    
  StyleSheet,    
  Text,    
  View,    
  TouchableOpacity,    
  ScrollView,    
  KeyboardAvoidingView,    
  Platform,    
} from 'react-native';    
import { useRouter } from 'expo-router';    
import { LinearGradient } from 'expo-linear-gradient';    
import { Button, TextInput, Checkbox } from 'react-native-paper';    
import { AntDesign } from '@expo/vector-icons';    
import Toast from 'react-native-toast-message';    
import api from '../../lib/api';    
import { useGoogleAuth } from '../../lib/useGoogleAuth';    
import { useUser } from '../../context/UserContext';  // Add this import
import TermsModal from '../../components/TermsModal';    
    
export default function SignupScreen() {    
  const router = useRouter();
  const { addAccount } = useUser(); // Add this hook
    
  const [email, setEmail] = useState('');    
  const [phone, setPhone] = useState('');    
  const [firstName, setFirstName] = useState('');    
  const [lastName, setLastName] = useState('');    
  const [password, setPassword] = useState('');    
  const [confirmPassword, setConfirmPassword] = useState('');    
  const [showPassword, setShowPassword] = useState(false);    
  const [showConfirm, setShowConfirm] = useState(false);    
  const [acceptedTerms, setAcceptedTerms] = useState(false);    
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalType, setTermsModalType] = useState<'terms_of_service' | 'privacy_policy'>('terms_of_service');    
  const [isLoading, setIsLoading] = useState(false);    
    
  // Error states    
  const [errors, setErrors] = useState({    
    email: false,    
    phone: false,    
    firstName: false,    
    lastName: false,    
    password: false,    
    confirmPassword: false,    
    terms: false,    
  });    
    
  // Google Auth handler - updated to use addAccount
  const { promptAsync, request } = useGoogleAuth(async (googleUser, isNewUser) => {    
    try {    
      setIsLoading(true);
      
      // Add account through UserContext (which uses AccountManager)
      await addAccount(googleUser, googleUser.token || 'temp_token');
      
      Toast.show({    
        type: 'success',    
        text1: isNewUser ? 'Account Created!' : 'Welcome back!',    
        text2: isNewUser ? 'Signed up with Google successfully' : 'Signed in with Google'
      });    
    
      const role = googleUser.roles?.includes('admin') ? 'admin' : 'client';
      
      setTimeout(() => {
        router.replace(role === 'admin' ? '/admin' : '/');
      }, 1500);
      
    } catch (err: any) {    
      console.error('Google signup error:', err);
      const msg = err?.message || 'Google signup failed';    
      Toast.show({ type: 'error', text1: 'Google Signup Error', text2: msg });    
    } finally {    
      setIsLoading(false);    
    }    
  });    
    
  const validateFields = () => {    
    const newErrors = {    
      email: !email.trim(),    
      phone: !phone.trim(),    
      firstName: !firstName.trim(),    
      lastName: !lastName.trim(),    
      password: !password.trim(),    
      confirmPassword: !confirmPassword.trim(),    
      terms: !acceptedTerms,    
    };    
    
    setErrors(newErrors);    
    
    // Check if any field has error    
    return !Object.values(newErrors).includes(true);    
  };    
    
  const handleSignup = async () => {    
    // Clear previous errors    
    setErrors({    
      email: false,    
      phone: false,    
      firstName: false,    
      lastName: false,    
      password: false,    
      confirmPassword: false,    
      terms: false,    
    });    
    
    // Validate all fields    
    if (!validateFields()) {    
      Toast.show({    
        type: 'error',    
        text1: 'Validation Error',    
        text2: 'Please fill in all required fields and accept the terms',    
      });    
      return;    
    }    
    
    if (password !== confirmPassword) {    
      setErrors(prev => ({ ...prev, confirmPassword: true }));    
      Toast.show({    
        type: 'error',    
        text1: 'Password Mismatch',    
        text2: 'Please ensure both passwords match',    
      });    
      return;    
    }    
    
    try {    
      setIsLoading(true);    
      console.log('Attempting signup for:', email);
      
      const response = await api.post('/api/v1/signup', {    
        user: {    
          email: email.trim(),    
          phone_number: phone.trim(),    
          first_name: firstName.trim(),    
          last_name: lastName.trim(),    
          password,    
          password_confirmation: confirmPassword,    
        },    
      });    
    
      const token = response?.data?.token || response.headers?.authorization?.split(' ')[1];
      const user = response?.data?.user;    
    
      if (token && user) {    
        console.log('Signup successful, adding account...');
        
        // Add account through UserContext (which uses AccountManager)
        await addAccount(user, token);
        
        Toast.show({    
          type: 'success',    
          text1: 'Account Created!',    
          text2: 'Welcome to the platform!',    
        });    
    
        const role = user.roles?.includes('admin') ? 'admin' : 'client';
        
        console.log('Signup successful, redirecting to:', role === 'admin' ? '/admin' : '/');
        
        setTimeout(() => {
          router.replace(role === 'admin' ? '/admin' : '/');
        }, 1500);
      } else {    
        console.error('Signup failed: Missing token or user data', { hasToken: !!token, hasUser: !!user });
        Toast.show({    
          type: 'error',    
          text1: 'Signup failed',    
          text2: 'Server response incomplete',    
        });    
      }    
    } catch (err: any) {    
      console.error('Signup error:', err?.response?.data || err?.message);
      
      let errorMessage = 'Please try again';
      let toastMessage = 'Unexpected error';

      if (err?.response?.status === 422) {
        const errors = err.response.data?.errors || [];
        if (errors.length > 0) {
          errorMessage = errors[0];
          toastMessage = 'Validation error';
        } else {
          errorMessage = 'Please check your information';
          toastMessage = 'Invalid input';
        }
      } else if (err?.response?.status === 409) {
        errorMessage = err.response.data?.message || 'Email already exists';
        toastMessage = 'Account exists';
      } else if (err?.code === 'NETWORK_ERROR' || err?.message === 'Network Error') {
        errorMessage = 'Network error - check your connection';
        toastMessage = 'Connection failed';
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
        toastMessage = 'Server error';
      }

      Toast.show({ 
        type: 'error', 
        text1: 'Signup failed', 
        text2: toastMessage 
      });
    } finally {    
      setIsLoading(false);    
    }    
  };    
    
  const showTerms = (type: 'terms_of_service' | 'privacy_policy') => {
    setTermsModalType(type);
    setShowTermsModal(true);
  };

  const handleFieldChange = (field: keyof typeof errors, value: string) => {
    // Clear error when user starts typing
    if (errors[field] && value.trim()) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };    
    
  const handleTermsChange = () => {    
    const newValue = !acceptedTerms;    
    setAcceptedTerms(newValue);    
    // Clear error when user accepts terms    
    if (errors.terms && newValue) {    
      setErrors(prev => ({ ...prev, terms: false }));    
    }    
  };    
    
  return (    
    <LinearGradient colors={['#0a0a0f', '#0a0a0f']} style={styles.container}>    
      <KeyboardAvoidingView     
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}     
        style={styles.keyboardAvoid}    
      >    
        <ScrollView     
          contentContainerStyle={styles.scrollContent}    
          showsVerticalScrollIndicator={false}    
          keyboardShouldPersistTaps="handled"    
        >    
          <View style={styles.inner}>    
            <Text style={styles.title}>Create Account</Text>    
    
            <TextInput    
              label="Email"    
              value={email}    
              onChangeText={(value) => {    
                setEmail(value);    
                handleFieldChange('email', value);    
              }}    
              keyboardType="email-address"    
              autoCapitalize="none"    
              mode="outlined"    
              style={styles.input}    
              textColor="#f8f8f2"    
              placeholderTextColor="#ccc"    
              outlineColor={errors.email ? "#f87171" : "#44475a"}    
              activeOutlineColor={errors.email ? "#f87171" : "#bd93f9"}    
              error={errors.email}
              disabled={isLoading}
            />    
    
            <TextInput    
              label="Phone"    
              value={phone}    
              onChangeText={(value) => {    
                setPhone(value);    
                handleFieldChange('phone', value);    
              }}    
              keyboardType="phone-pad"    
              mode="outlined"    
              style={styles.input}    
              textColor="#f8f8f2"    
              placeholderTextColor="#ccc"    
              outlineColor={errors.phone ? "#f87171" : "#44475a"}    
              activeOutlineColor={errors.phone ? "#f87171" : "#bd93f9"}    
              error={errors.phone}
              disabled={isLoading}
            />    
    
            <TextInput    
              label="First Name"    
              value={firstName}    
              onChangeText={(value) => {    
                setFirstName(value);    
                handleFieldChange('firstName', value);    
              }}    
              mode="outlined"    
              style={styles.input}    
              textColor="#f8f8f2"    
              placeholderTextColor="#ccc"    
              outlineColor={errors.firstName ? "#f87171" : "#44475a"}    
              activeOutlineColor={errors.firstName ? "#f87171" : "#bd93f9"}    
              error={errors.firstName}
              disabled={isLoading}
            />    
    
            <TextInput    
              label="Last Name"    
              value={lastName}    
              onChangeText={(value) => {    
                setLastName(value);    
                handleFieldChange('lastName', value);    
              }}    
              mode="outlined"    
              style={styles.input}    
              textColor="#f8f8f2"    
              placeholderTextColor="#ccc"    
              outlineColor={errors.lastName ? "#f87171" : "#44475a"}    
              activeOutlineColor={errors.lastName ? "#f87171" : "#bd93f9"}    
              error={errors.lastName}
              disabled={isLoading}
            />    
    
            <TextInput    
              label="Password"    
              value={password}    
              onChangeText={(value) => {    
                setPassword(value);    
                handleFieldChange('password', value);    
              }}    
              secureTextEntry={!showPassword}    
              mode="outlined"    
              style={styles.input}    
              textColor="#f8f8f2"    
              placeholderTextColor="#ccc"    
              outlineColor={errors.password ? "#f87171" : "#44475a"}    
              activeOutlineColor={errors.password ? "#f87171" : "#bd93f9"}    
              error={errors.password}
              disabled={isLoading}
              right={    
                <TextInput.Icon    
                  icon={showPassword ? 'eye-off' : 'eye'}    
                  onPress={() => setShowPassword(!showPassword)}    
                  color="#aaa"    
                  forceTextInputFocus={false}    
                />    
              }    
            />    
    
            <TextInput    
              label="Confirm Password"    
              value={confirmPassword}    
              onChangeText={(value) => {    
                setConfirmPassword(value);    
                handleFieldChange('confirmPassword', value);    
              }}    
              secureTextEntry={!showConfirm}    
              mode="outlined"    
              style={styles.input}    
              textColor="#f8f8f2"    
              placeholderTextColor="#ccc"    
              outlineColor={errors.confirmPassword ? "#f87171" : "#44475a"}    
              activeOutlineColor={errors.confirmPassword ? "#f87171" : "#bd93f9"}    
              error={errors.confirmPassword}
              disabled={isLoading}
              right={    
                <TextInput.Icon    
                  icon={showConfirm ? 'eye-off' : 'eye'}    
                  onPress={() => setShowConfirm(!showConfirm)}    
                  color="#aaa"    
                  forceTextInputFocus={false}    
                />    
              }    
            />    
    
            {/* Terms and Conditions Checkbox */}    
            <View style={[    
              styles.termsContainer,     
              errors.terms && styles.termsContainerError    
            ]}>    
              <Checkbox    
                status={acceptedTerms ? 'checked' : 'unchecked'}    
                onPress={handleTermsChange}    
                color="#bd93f9"    
                uncheckedColor={errors.terms ? "#f87171" : "#666"}
                disabled={isLoading}
              />    
              <View style={styles.termsTextContainer}>    
                <View style={styles.termsTextRow}>    
                  <Text style={[styles.termsText, errors.terms && styles.termsTextError]}>    
                    I agree to GLT&apos;s{' '}    
                  </Text>    
                  <TouchableOpacity onPress={() => showTerms('terms_of_service')} disabled={isLoading}>    
                    <Text style={[styles.linkText, errors.terms && styles.linkTextError]}>    
                      Terms of Service    
                    </Text>    
                  </TouchableOpacity>    
                  <Text style={[styles.termsText, errors.terms && styles.termsTextError]}>    
                    {' '}and{' '}    
                  </Text>    
                  <TouchableOpacity onPress={() => showTerms('privacy_policy')} disabled={isLoading}>    
                    <Text style={[styles.linkText, errors.terms && styles.linkTextError]}>    
                      Privacy Policy    
                    </Text>    
                  </TouchableOpacity>    
                </View>    
              </View>    
            </View>    
    
            <TouchableOpacity    
              style={[styles.googleBtn, (isLoading || !request) && styles.disabledBtn]}    
              onPress={() => promptAsync()}    
              disabled={!request || isLoading}    
            >    
              <AntDesign name="google" size={20} color="white" />    
              <Text style={styles.googleText}>Sign up with Google</Text>    
            </TouchableOpacity>    
    
            <LinearGradient    
              colors={['#7c3aed', '#3b82f6', '#10b981']}    
              style={[styles.gradientBtn, isLoading && styles.disabledGradient]}    
            >    
              <Button    
                mode="contained"    
                onPress={handleSignup}    
                style={styles.button}    
                labelStyle={{ color: '#fff', fontWeight: 'bold' }}    
                loading={isLoading}    
                disabled={isLoading}    
              >    
                {isLoading ? 'Creating Account...' : 'Sign Up'}    
              </Button>    
            </LinearGradient>    
    
            <Button    
              onPress={() => router.replace('/login')}    
              textColor="#bd93f9"    
              style={styles.link}    
              disabled={isLoading}    
            >    
              Already have an account? Log in    
            </Button>    
          </View>    
        </ScrollView>    
      </KeyboardAvoidingView>    
    
      {/* Terms Modal */}    
      <TermsModal
        key={termsModalType}   
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        termType={termsModalType}
      />    
    </LinearGradient>    
  );    
}    
    
const styles = StyleSheet.create({    
  container: {     
    flex: 1     
  },    
  keyboardAvoid: {    
    flex: 1,    
  },    
  scrollContent: {    
    flexGrow: 1,    
    paddingVertical: 20,    
  },    
  inner: {    
    flex: 1,    
    paddingHorizontal: 24,    
    justifyContent: 'center',    
    minHeight: '100%',    
  },    
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
    marginBottom: 14,    
    backgroundColor: '#1e1e2f',    
    borderRadius: 8,    
  },    
  button: {    
    backgroundColor: 'transparent',    
    elevation: 0,    
    shadowOpacity: 0,    
  },    
  gradientBtn: {    
    borderRadius: 25,    
    overflow: 'hidden',    
    marginTop: 10,    
  },    
  disabledGradient: {    
    opacity: 0.6,    
  },    
  link: {    
    marginTop: 18,    
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
  disabledBtn: {    
    opacity: 0.6,    
  },    
  googleText: {    
    color: '#fff',    
    fontSize: 16,    
    fontWeight: '600',    
  },    
  termsContainer: {    
    flexDirection: 'row',    
    alignItems: 'center',    
    marginBottom: 20,    
    paddingHorizontal: 4,    
    paddingVertical: 8,    
    borderRadius: 8,    
  },    
  termsContainerError: {    
    backgroundColor: 'rgba(248, 113, 113, 0.1)',    
    borderWidth: 1,    
    borderColor: '#f87171',    
  },    
  termsTextContainer: {    
    marginLeft: 8,    
    justifyContent: 'center',    
  },    
  termsTextRow: {    
    flexDirection: 'row',    
    alignItems: 'center',    
    flexWrap: 'wrap',    
  },    
  termsText: {    
    color: '#ccc',    
    fontSize: 14,    
    lineHeight: 20,    
  },    
  termsTextError: {    
    color: '#f87171',    
  },    
  linkText: {    
    color: '#bd93f9',    
    textDecorationLine: 'underline',    
    fontSize: 14,    
    lineHeight: 20,    
  },    
  linkTextError: {    
    color: '#f87171',    
  },    
});
import React, { useState } from 'react'; import { StyleSheet, Text, View, TouchableOpacity, Alert, } from 'react-native'; import { useRouter } from 'expo-router'; import { LinearGradient } from 'expo-linear-gradient'; import { Button, TextInput } from 'react-native-paper'; import { AntDesign } from '@expo/vector-icons'; import Toast from 'react-native-toast-message'; import * as SecureStore from 'expo-secure-store'; import api from '../../lib/api'; import { useGoogleAuth } from '../../lib/useGoogleAuth'; // 👈 make sure this exists

export default function SignupScreen() { const router = useRouter();

const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [showPassword, setShowPassword] = useState(false);

const { promptAsync, request } = useGoogleAuth(async (googleUser) => { try { const response = await api.post('/api/v1/google_login', { user: { email: googleUser.email, first_name: googleUser.given_name, last_name: googleUser.family_name, avatar_url: googleUser.picture, provider: 'google', uid: googleUser.id, }, });

const token = response?.data?.token;
  const userId = response?.data?.user?.id;

  if (finalToken && userId) {
  const roles = response?.data?.user?.roles || [];
  const role = roles.includes('admin') ? 'admin' : 'client';

  await SecureStore.setItemAsync('auth_token', finalToken);
  await SecureStore.setItemAsync('user_id', String(userId));
  await SecureStore.setItemAsync('user_role', role);

  Toast.show({
    type: 'success',
    text1: 'Account Created',
    text2: 'Welcome aboard!',
  });

  router.replace(role === 'admin' ? '/admin' : '/');
} else {
    Toast.show({
      type: 'error',
      text1: 'Signup failed',
      text2: 'Missing token or user ID',
    });
  }
} catch (err) {
  const msg = err?.response?.data?.error || err?.message || 'Google signup failed';
  Toast.show({ type: 'error', text1: 'Google Signup Error', text2: msg });
}

});

const handleSignup = async () => { if (password !== confirmPassword) { Alert.alert('Password mismatch', 'Please confirm your password.'); return; }

try {
  const response = await api.post('/api/v1/signup', {
    user: {
      email,
      phone,
      first_name: firstName,
      last_name: lastName,
      password,
      password_confirmation: confirmPassword,
    },
  });

  const token = response?.data?.token;
  const userId = response?.data?.user?.id;
  const tokenFromHeader = response.headers?.authorization?.split(' ')[1];
  const finalToken = token || tokenFromHeader;

  if (finalToken && userId) {
    await SecureStore.setItemAsync('auth_token', finalToken);
    await SecureStore.setItemAsync('user_id', String(userId));

    Toast.show({
      type: 'success',
      text1: 'Account Created',
      text2: 'Welcome aboard!',
    });

    router.replace('/(drawer)');
  } else {
    Toast.show({
      type: 'error',
      text1: 'Signup failed',
      text2: 'Missing authentication data',
    });
  }
} catch (err) {
  const msg = err?.response?.data?.error || err?.message || 'Signup failed';
  Toast.show({
    type: 'error',
    text1: 'Signup error',
    text2: msg,
  });
  console.error('Signup error:', msg);
}

};

return ( <LinearGradient colors={['#0a0a0f', '#0a0a0f']} style={styles.container}> <View style={styles.inner}> <Text style={styles.title}>Create Account</Text>

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
    />

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
    />

    <TextInput
      label="First Name"
      value={firstName}
      onChangeText={setFirstName}
      mode="outlined"
      style={styles.input}
      textColor="#f8f8f2"
      placeholderTextColor="#ccc"
      outlineColor="#44475a"
      activeOutlineColor="#bd93f9"
    />

    <TextInput
      label="Last Name"
      value={lastName}
      onChangeText={setLastName}
      mode="outlined"
      style={styles.input}
      textColor="#f8f8f2"
      placeholderTextColor="#ccc"
      outlineColor="#44475a"
      activeOutlineColor="#bd93f9"
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
      right={
        <TextInput.Icon
          icon={showPassword ? 'eye-off' : 'eye'}
          onPress={() => setShowPassword((v) => !v)}
          forceTextInputFocus={false}
          color="#aaa"
        />
      }
    />

    <TextInput
  label="Confirm Password"
  value={confirmPassword}
  onChangeText={setConfirmPassword}
  secureTextEntry={!showPassword}
  mode="outlined"
  style={styles.input}
  textColor="#f8f8f2"
  placeholderTextColor="#ccc"
  outlineColor="#44475a"
  activeOutlineColor="#bd93f9"
  right={
    <TextInput.Icon
      icon={showPassword ? 'eye-off' : 'eye'}
      onPress={() => setShowPassword((v) => !v)}
      forceTextInputFocus={false}
      color="#aaa"
    />
  }
/>

    <TouchableOpacity
      style={styles.googleBtn}
      onPress={() => promptAsync()}
      disabled={!request}
    >
      <AntDesign name="google" size={20} color="white" />
      <Text style={styles.googleText}>Sign up with Google</Text>
    </TouchableOpacity>

    <LinearGradient
      colors={['#7c3aed', '#3b82f6', '#10b981']}
      style={styles.gradientBtn}
    >
      <Button
        mode="contained"
        onPress={handleSignup}
        style={styles.button}
        labelStyle={{ color: '#fff', fontWeight: 'bold' }}
      >
        Sign Up
      </Button>
    </LinearGradient>

    <Button
      onPress={() => router.replace('/login')}
      textColor="#bd93f9"
      style={styles.link}
    >
      Already have an account? Log in
    </Button>
  </View>
</LinearGradient>

); }

const styles = StyleSheet.create({ container: { flex: 1 }, inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', }, title: { color: '#f8f8f2', fontSize: 30, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', textShadowColor: 'rgba(124, 58, 237, 0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, }, input: { marginBottom: 14, backgroundColor: '#1e1e2f', borderRadius: 8, }, button: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0, }, gradientBtn: { borderRadius: 25, overflow: 'hidden', marginTop: 10, }, link: { marginTop: 18, }, googleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#20202a', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, justifyContent: 'center', gap: 8, marginTop: 10, }, googleText: { color: '#fff', fontSize: 16, fontWeight: '600', }, });


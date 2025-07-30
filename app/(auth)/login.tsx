import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { Button, TextInput } from 'react-native-paper';
import api from '../../lib/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ready, setReady] = useState(false); // 🚀 Ensure API baseURL is ready
  const router = useRouter();

  useEffect(() => {
    const initialize = async () => {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_id');

      try {
        await api.get('/api/v1/ping');
        console.log('✅ Backend reachable');
        setReady(true);
      } catch (err) {
        console.log('❌ Ping failed:', err?.message || err);
        Toast.show({
          type: 'errorToast',
          text1: 'Cannot reach server',
          text2: 'Please check your connection.',
        });
      }
    };

    initialize();
  }, []);

  const handleLogin = async () => {
    setErrorMsg('');

    try {
      const response = await api.post('/api/v1/login', {
        user: { email, password },
      });

      const token = response?.data?.token;
      const userId = response?.data?.user?.id;
      const tokenFromHeader = response.headers?.authorization?.split(' ')[1];
      const finalToken = token || tokenFromHeader;

      if (finalToken && userId) {
        await SecureStore.setItemAsync('auth_token', finalToken);
        await SecureStore.setItemAsync('user_id', String(userId));

        Toast.show({
          type: 'defaultToast',
          text1: 'Welcome back!',
        });

        router.replace('/');
      } else {
        setErrorMsg('Login failed: Missing token or user ID');
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: 'Missing authentication data',
        });
      }
    } catch (err: any) {
      console.error('Login error:', err?.response?.data || err.message);
      setErrorMsg('Invalid email or password');
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: 'Invalid credentials or server error',
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GltApp Login</Text>

      {!ready && (
        <>
          <ActivityIndicator size="large" color="#bd93f9" />
          <Text style={styles.loadingText}>Connecting to server...</Text>
        </>
      )}

      {ready && (
        <>
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

          {errorMsg.length > 0 && (
            <Text style={styles.error}>{errorMsg}</Text>
          )}

          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.button}
            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
          >
            Log In
          </Button>

          <Button
            onPress={() => router.push('/signup')}
            textColor="#bd93f9"
            style={styles.link}
          >
            Don't have an account? Sign up
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282a36',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#f8f8f2',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#1e1e2f',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#bd93f9',
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  link: {
    marginTop: 12,
  },
  error: {
    color: '#ff5555',
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 14,
  },
  loadingText: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
  },
});
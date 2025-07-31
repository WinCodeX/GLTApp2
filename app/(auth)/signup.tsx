import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, TextInput } from 'react-native-paper';
import { AntDesign } from '@expo/vector-icons';

export default function SignupScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = () => {
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Please confirm your password.');
      return;
    }

    // TODO: Submit to backend
    console.log({ email, phone, firstName, lastName, password });
  };

  const handleGoogleSignup = () => {
    console.log('Google Sign Up');
    // TODO: Integrate Google OAuth
  };

  return (
    <LinearGradient colors={['#0a0a0f', '#0a0a0f']} style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Create Account</Text>

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
        />

        {/* Google Sign Up Button */}
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignup}>
          <AntDesign name="google" size={20} color="white" />
          <Text style={styles.googleText}>Sign up with Google</Text>
        </TouchableOpacity>

        {/* Main Sign Up Button */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
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
  googleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
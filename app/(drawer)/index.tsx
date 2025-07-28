import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FAB } from 'react-native-paper';

import GLTHeader from '../../components/GLTHeader'; // ✅ your new header
import colors from '../../theme/colors'; // 🔁 dark theme colors

export default function HomeScreen() {
  const handleFabPress = () => {
    console.log('FAB pressed');
    // Add navigation or modal later
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ✅ Custom Header */}
      <GLTHeader />

      {/* Body */}
      <View style={styles.content}>
        <Text style={styles.welcome}>Welcome to GLT Logistics</Text>
      </View>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleFabPress}
        color="white"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    color: colors.primary,
    fontSize: 20,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    width: 56,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
});
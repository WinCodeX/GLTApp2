// components/LoaderOverlay.tsx

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export default function LoaderOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 30, 46, 0.6)', // translucent dark background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});
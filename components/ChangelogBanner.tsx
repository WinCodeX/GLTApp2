// components/ChangelogBanner.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function ChangelogBanner({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.banner}>
        <Text style={styles.title}>What’s New (v1.0.2)</Text>
        <Text style={styles.content}>• Added offline profile support{"\n"}• Redesigned UI{"\n"}• Bug fixes and optimizations</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  banner: {
    backgroundColor: '#44475a',
    padding: 16,
    borderRadius: 12,
    elevation: 10,
  },
  title: {
    color: '#bd93f9',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
  },
  content: {
    color: '#f8f8f2',
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    backgroundColor: '#6272a4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeText: {
    color: '#fff',
    fontWeight: '600',
  },
});
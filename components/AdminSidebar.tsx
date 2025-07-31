import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AdminSidebar({ onSelect, activePanel }) {
  const screens = [
    { icon: 'map-marker-outline', label: 'Create Location' },
    { icon: 'account-group-outline', label: 'User List' },
    // add more panels here
  ];

  return (
    <LinearGradient colors={['#0a0a0f', '#0a0a0f']} style={styles.sidebar}>
      {screens.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          onPress={() => onSelect(item.label)}
          style={[
            styles.iconWrapper,
            activePanel === item.label && styles.activeIconWrapper,
          ]}
        >
          <MaterialCommunityIcons
            name={item.icon}
            size={28}
            color={activePanel === item.label ? '#10b981' : '#bd93f9'}
          />
        </TouchableOpacity>
      ))}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 60,
    paddingTop: 30,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    borderRightColor: '#1f1f2e',
    borderRightWidth: 1,
  },
  iconWrapper: {
    paddingVertical: 20,
    alignItems: 'center',
    width: '100%',
  },
  activeIconWrapper: {
    backgroundColor: '#1f1f2e',
    borderRadius: 8,
  },
});
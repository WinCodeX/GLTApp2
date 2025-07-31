import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function AdminSidebar({ activePanel, onSelect }) {
  const isActive = (panel) => panel === activePanel;

  return (
    <View style={styles.sidebar}>
      <TouchableOpacity onPress={() => onSelect('Dashboard')} style={[styles.sideIcon, isActive('Dashboard') && styles.active]}>
        <Feather name="home" size={20} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onSelect('Create Location')} style={[styles.sideIcon, isActive('Create Location') && styles.active]}>
        <MaterialCommunityIcons name="map-marker-plus" size={20} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onSelect('User List')} style={[styles.sideIcon, isActive('User List') && styles.active]}>
        <Feather name="users" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Add more sidebar icons here */}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 60,
    backgroundColor: '#111',
    borderRightWidth: 1,
    borderRightColor: '#222',
    alignItems: 'center',
    paddingVertical: 10,
  },
  sideIcon: {
    marginVertical: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  active: {
    backgroundColor: '#7c3aed',
  },
});
import React from 'react';
import { View, StyleSheet } from 'react-native';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout({ children, onSelect, activePanel }) {
  return (
    <View style={styles.container}>
      <AdminSidebar onSelect={onSelect} activePanel={activePanel} />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0a0a0f',
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
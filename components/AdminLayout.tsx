import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout({ children, onSelect, activePanel }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topHeader}>
        <Feather name="search" size={20} color="#ccc" style={styles.icon} />
        <Text style={styles.searchPlaceholder}>Search</Text>
        <TouchableOpacity style={styles.profileIcon}>
          <Feather name="user" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <AdminSidebar onSelect={onSelect} activePanel={activePanel} />
        <ScrollView style={styles.mainContent}>
          {children}
        </ScrollView>
      </View>

      {/* Bottom Tabs */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity style={styles.tabIcon}>
          <Feather name="camera" size={20} color="white" />
          <Text style={styles.tabLabel}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabIcon}>
          <Feather name="file-text" size={20} color="white" />
          <Text style={styles.tabLabel}>Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabIcon}>
          <Feather name="settings" size={20} color="white" />
          <Text style={styles.tabLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e0e15' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#222',
    borderBottomWidth: 1,
    backgroundColor: '#111',
  },
  icon: { marginRight: 8 },
  searchPlaceholder: { color: '#888', flex: 1 },
  profileIcon: { padding: 6 },

  body: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1, padding: 16 },

  bottomTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopColor: '#222',
    borderTopWidth: 1,
    backgroundColor: '#111',
  },
  tabIcon: { alignItems: 'center' },
  tabLabel: { color: '#aaa', fontSize: 12, marginTop: 4 },
});
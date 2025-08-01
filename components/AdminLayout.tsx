import React, { useState, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AdminSidebar from './AdminSidebar';

const { width } = Dimensions.get('window');

interface BottomTab {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}

interface AdminLayoutProps {
  children: ReactNode;
  activePanel?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activePanel = 'home',
}) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const bottomTabs: BottomTab[] = [
    { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Home' },
    { id: 'scan', icon: 'qr-code-outline', activeIcon: 'qr-code', label: 'Scan' },
    { id: 'packages', icon: 'cube-outline', activeIcon: 'cube', label: 'Packages' },
    { id: 'settings', icon: 'settings-outline', activeIcon: 'settings', label: 'Settings' },
    { id: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'You' },
  ];

  const toggleSidebar = () => setSidebarVisible(!sidebarVisible);
  const closeSidebar = () => setSidebarVisible(false);
  const handleTabPress = (tabId: string) => setActiveTab(tabId);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6c5ce7" />

      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#6c5ce7', '#a29bfe', '#74b9ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          {/* Left - Menu & Logo */}
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={toggleSidebar} style={styles.menuButton}>
              <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>GL</Text>
              </View>
              <View>
                <Text style={styles.companyName}>GLT Logistics</Text>
                <Text style={styles.panelTitle}>Admin Panel</Text>
              </View>
            </View>
          </View>

          {/* Center - Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.8)" />
            <TextInput
              placeholder="Search..."
              placeholderTextColor="rgba(255,255,255,0.8)"
              style={styles.searchInput}
            />
          </View>

          {/* Right - Icons */}
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerAction}>
              <Ionicons name="notifications-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerAction}>
              <View style={styles.profileIcon}>
                <Ionicons name="person" size={16} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <View style={styles.mainContent}>
        <AdminSidebar visible={sidebarVisible} onClose={closeSidebar} activePanel={activePanel} />

        <View style={styles.contentArea}>
          <LinearGradient colors={['#1a1a2e', '#16213e', '#0f0f23']} style={styles.contentGradient}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {children}
            </ScrollView>
          </LinearGradient>
        </View>

        {sidebarVisible && <TouchableOpacity style={styles.overlay} onPress={closeSidebar} />}
      </View>

      {/* Bottom Tabs */}
      <View style={styles.bottomTabBar}>
        {bottomTabs.map((tab) => (
          <TouchableOpacity key={tab.id} onPress={() => handleTabPress(tab.id)} style={styles.tabButton}>
            <Ionicons
              name={activeTab === tab.id ? tab.activeIcon : tab.icon}
              size={22}
              color={activeTab === tab.id ? '#6c5ce7' : '#a0aec0'}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === tab.id ? '#6c5ce7' : '#a0aec0',
                  fontWeight: activeTab === tab.id ? '600' : '400',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FAB */}
      <TouchableOpacity style={styles.fab}>
        <LinearGradient colors={['#6c5ce7', '#a29bfe']} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  safeArea: {
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#6c5ce7',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { padding: 8, marginRight: 12 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d3748',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  logoText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  companyName: { color: 'white', fontWeight: '600', fontSize: 16 },
  panelTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  searchContainer: {
    flex: 1,
    maxWidth: 300,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: { flex: 1, marginLeft: 8, color: 'white', fontSize: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerAction: { padding: 8, marginRight: 8 },
  profileIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#2d3748',
    alignItems: 'center', justifyContent: 'center',
  },
  mainContent: { flex: 1, flexDirection: 'row' },
  contentArea: { flex: 1, backgroundColor: '#0f0f23' },
  contentGradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  tabLabel: { fontSize: 10, marginTop: 2 },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdminLayout;

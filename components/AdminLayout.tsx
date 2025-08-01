import React, { useState, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Dimensions,
  StyleSheet,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import AdminSidebar from './AdminSidebar';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

interface BottomTab {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
}

interface AdminLayoutProps {
  children: ReactNode;
  activePanel?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activePanel = 'home' }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const router = useRouter();
  const { user } = useUser();

  const bottomTabs: BottomTab[] = [
    { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Home', route: '/admin' },
    { id: 'scan', icon: 'qr-code-outline', activeIcon: 'qr-code', label: 'Scan', route: '/admin/scan' },
    { id: 'packages', icon: 'cube-outline', activeIcon: 'cube', label: 'Packages', route: '/admin/packages' },
    { id: 'settings', icon: 'settings-outline', activeIcon: 'settings', label: 'Settings', route: '/admin/settings' },
    { id: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'You', route: '/admin/account' },
  ];

  const toggleSidebar = () => setSidebarVisible(!sidebarVisible);
  const closeSidebar = () => setSidebarVisible(false);

  const handleTabPress = (tab: BottomTab) => {
    setActiveTab(tab.id);
    if (tab.route) router.push(tab.route);
  };

  const handleProfilePress = () => {
    router.push('/admin/account');
  };

  const getAvatarSource = () => {
    if (user?.avatar_url) return { uri: user.avatar_url };
    return require('../assets/images/avatar_placeholder.png');
  };

  const getUserDisplayName = (): string => {
    if (user?.first_name && user?.last_name) return `${user.first_name} ${user.last_name}`;
    if (user?.first_name) return user.first_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Admin User';
  };

  const getUserInitials = (): string => {
    if (user?.first_name && user?.last_name)
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    if (user?.first_name) return user.first_name.substring(0, 2).toUpperCase();
    if (user?.email) return user.email.substring(0, 2).toUpperCase();
    return 'AD';
  };

  return (
    <View style={{ flex: 1 }}>
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

          {/* Right - Icons & Profile */}
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerAction}>
              <Ionicons name="notifications-outline" size={22} color="white" />
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.profileSection} onPress={handleProfilePress}>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {getUserDisplayName()}
                </Text>
                <Text style={styles.userRole}>Admin</Text>
              </View>

              <View style={styles.profileImageContainer}>
                {user?.avatar_url ? (
                  <Image
                    source={getAvatarSource()}
                    style={styles.profileImage}
                    defaultSource={require('../assets/images/avatar_placeholder.png')}
                  />
                ) : (
                  <View style={styles.profileIconFallback}>
                    <Text style={styles.profileInitials}>{getUserInitials()}</Text>
                  </View>
                )}
                <View style={styles.onlineIndicator} />
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <AdminSidebar visible={sidebarVisible} onClose={closeSidebar} activePanel={activePanel} />

        <View style={styles.contentArea}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f0f23']}
            style={styles.contentGradient}
          >
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
          <TouchableOpacity
            key={tab.id}
            onPress={() => handleTabPress(tab)}
            style={styles.tabButton}
          >
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

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <LinearGradient colors={['#6c5ce7', '#a29bfe']} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

export default AdminLayout;
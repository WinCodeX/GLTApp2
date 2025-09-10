// components/AdminLayout.tsx - Fixed with proper positioning and no cutoffs
import React, { useState, ReactNode, useEffect } from 'react';
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
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, usePathname } from 'expo-router';
import AdminSidebar from './AdminSidebar';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

// Define proper TypeScript types for Ionicons
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface BottomTab {
  id: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
  label: string;
  route: string;
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
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const avatarSource = user?.avatar_url
    ? { uri: user.avatar_url }
    : require('../assets/images/avatar_placeholder.png');

  // Bottom tabs with correct scanning route
  const bottomTabs: BottomTab[] = [
    { 
      id: 'home', 
      icon: 'home-outline' as IoniconsName, 
      activeIcon: 'home' as IoniconsName, 
      label: 'Home', 
      route: '/admin' 
    },
    { 
      id: 'scan', 
      icon: 'qr-code-outline' as IoniconsName, 
      activeIcon: 'qr-code' as IoniconsName, 
      label: 'Scan', 
      route: '/admin/ScanningScreen'
    },
    { 
      id: 'packages', 
      icon: 'cube-outline' as IoniconsName, 
      activeIcon: 'cube' as IoniconsName, 
      label: 'Packages', 
      route: '/admin/packages' 
    },
    { 
      id: 'settings', 
      icon: 'settings-outline' as IoniconsName, 
      activeIcon: 'settings' as IoniconsName, 
      label: 'Settings', 
      route: '/admin/settings' 
    },
    { 
      id: 'profile', 
      icon: 'person-outline' as IoniconsName, 
      activeIcon: 'person' as IoniconsName, 
      label: 'You', 
      route: '/admin/account' 
    },
  ];

  // Enhanced pathname matching for scanning route
  const getActiveTab = (): string => {
    if (pathname === '/admin/account') {
      return 'profile';
    }
    
    if (pathname === '/admin/ScanningScreen') {
      return 'scan';
    }
    
    const currentTab = bottomTabs.find(tab => tab.route === pathname);
    return currentTab?.id || 'home';
  };

  const activeTab = getActiveTab();

  const toggleSidebar = (): void => setSidebarVisible(!sidebarVisible);
  const closeSidebar = (): void => setSidebarVisible(false);

  // Updated navigation handler with proper scanning navigation
  const handleTabPress = (tabId: string): void => {
    try {
      const tab = bottomTabs.find(t => t.id === tabId);
      if (!tab) {
        console.warn(`Tab with id ${tabId} not found`);
        return;
      }

      if (pathname === tab.route) {
        console.log(`Already on route: ${tab.route}`);
        return;
      }

      console.log(`Navigating from ${pathname} to ${tab.route}`);
      
      switch (tabId) {
        case 'profile':
          console.log('Navigating to admin account');
          router.push('/admin/account');
          break;
        case 'home':
          console.log('Navigating to admin home');
          router.push('/admin');
          break;
        case 'scan':
          console.log('Navigating to scanning screen');
          router.push('/admin/ScanningScreen');
          break;
        case 'packages':
          console.log('Navigating to packages');
          router.push('/admin/packages');
          break;
        case 'settings':
          console.log('Navigating to settings');
          router.push('/admin/settings');
          break;
        default:
          console.warn(`Unknown tab id: ${tabId}`);
          router.push('/admin');
          break;
      }
      
    } catch (error) {
      console.error('Navigation error:', error);
      router.push('/admin');
    }
  };

  const handleAvatarPress = (): void => {
    handleTabPress('profile');
  };

  const handleSearchSubmit = (text: string): void => {
    console.log('Search submitted:', text);
  };

  const shouldShowBottomTabs = (): boolean => {
    const adminRoutes = [
      '/admin',
      '/admin/ScanningScreen',
      '/admin/packages', 
      '/admin/settings',
      '/admin/account'
    ];
    return adminRoutes.includes(pathname || '') || pathname?.startsWith('/admin') || false;
  };

  const shouldShowFAB = (): boolean => {
    const fabRoutes = ['/admin', '/admin/ScanningScreen', '/admin/packages', '/admin/settings'];
    return fabRoutes.includes(pathname || '') || false;
  };

  const handleFABPress = (): void => {
    console.log('FAB pressed on route:', pathname);
    
    switch (pathname) {
      case '/admin/ScanningScreen':
        console.log('Opening quick scan from FAB');
        break;
      case '/admin/packages':
        console.log('Creating new package from FAB');
        router.push('/admin/packages/create');
        break;
      case '/admin':
      default:
        console.log('Opening quick actions from FAB - navigating to scan');
        router.push('/admin/ScanningScreen');
        break;
    }
  };

  const getScreenTitle = (): string => {
    switch (pathname) {
      case '/admin/ScanningScreen':
        return 'Package Scanning';
      case '/admin/packages':
        return 'Package Management';
      case '/admin/settings':
        return 'Settings';
      case '/admin/account':
        return 'Account';
      case '/admin':
        return '';
      default:
        return 'Admin';
    }
  };

  const shouldShowTitle = (): boolean => {
    const title = getScreenTitle();
    return title.trim().length > 0;
  };

  return (
    <View style={styles.container}>
      {/* Status bar with gradient color */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#667eea" 
        translucent={false}
      />
      
      {/* Main container with SafeAreaView */}
      <SafeAreaView style={styles.safeArea}>
        {/* Header with gradient */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Left - Menu & Logo */}
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={toggleSidebar} 
              style={styles.menuButton}
              accessibilityLabel="Open menu"
              accessibilityRole="button"
            >
              <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>GL</Text>
              </View>
              {shouldShowTitle() && (
                <Text style={styles.panelTitle}>
                  {getScreenTitle()}
                </Text>
              )}
            </View>
          </View>

          {/* Center - Search (hide on scanning screen) */}
          {pathname !== '/admin/ScanningScreen' && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.8)" />
              <TextInput
                placeholder="Search..."
                placeholderTextColor="rgba(255,255,255,0.8)"
                style={styles.searchInput}
                onSubmitEditing={(event) => handleSearchSubmit(event.nativeEvent.text)}
                returnKeyType="search"
                accessibilityLabel="Search input"
              />
            </View>
          )}

          {/* Right - Notifications & Avatar */}
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.headerAction}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <Ionicons name="notifications-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerAction}
              onPress={handleAvatarPress}
              accessibilityLabel="Open profile"
              accessibilityRole="button"
            >
              <Image 
                source={avatarSource} 
                style={styles.avatarImage}
                accessibilityLabel="User avatar"
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Main content area */}
        <View style={styles.mainContent}>
          <AdminSidebar 
            visible={sidebarVisible} 
            onClose={closeSidebar} 
            activePanel={activePanel} 
          />
          <View style={styles.contentArea}>
            <LinearGradient 
              colors={['#1a1a2e', '#16213e', '#0f0f23']} 
              style={styles.contentGradient}
            >
              <ScrollView 
                style={styles.scrollView} 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </LinearGradient>
          </View>
          {sidebarVisible && (
            <TouchableOpacity 
              style={styles.overlay} 
              onPress={closeSidebar}
              accessibilityLabel="Close sidebar"
              accessibilityRole="button"
            />
          )}
        </View>

        {/* Bottom Tabs */}
        {shouldShowBottomTabs() && (
          <View style={styles.bottomTabBar}>
            {bottomTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabPress(tab.id)}
                  style={styles.tabButton}
                  accessibilityLabel={`${tab.label} tab`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Ionicons
                    name={isActive ? tab.activeIcon : tab.icon}
                    size={22}
                    color={isActive ? '#667eea' : '#a0aec0'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isActive ? '#667eea' : '#a0aec0',
                        fontWeight: isActive ? '600' : '400',
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {tab.id === 'scan' && isActive && (
                    <View style={styles.scanningBadge}>
                      <View style={styles.scanningDot} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Floating Action Button */}
        {shouldShowFAB() && (
          <TouchableOpacity 
            style={styles.fab}
            onPress={handleFABPress}
            accessibilityLabel={
              pathname === '/admin/ScanningScreen' ? 'Quick scan' :
              pathname === '/admin/packages' ? 'Add new package' :
              'Quick scan'
            }
            accessibilityRole="button"
          >
            <LinearGradient 
              colors={['#667eea', '#764ba2']} 
              style={styles.fabGradient}
            >
              <Ionicons 
                name={
                  pathname === '/admin/ScanningScreen' ? 'qr-code' :
                  pathname === '/admin/packages' ? 'add' :
                  'qr-code'
                } 
                size={28} 
                color="white" 
              />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#667eea' // Match status bar color
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0, // Extra padding for Android
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 25, // Extra padding to clear status bar
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flex: 1,
  },
  menuButton: { 
    padding: 8, 
    marginRight: 12,
    borderRadius: 8,
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  logoIcon: {
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 8,
  },
  logoText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  panelTitle: { 
    color: 'white', 
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flex: 2,
    maxWidth: 300,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: { 
    flex: 1, 
    marginLeft: 8, 
    color: 'white', 
    fontSize: 14,
    includeFontPadding: false,
  },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  headerAction: { 
    padding: 8, 
    marginLeft: 8,
    borderRadius: 8,
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  mainContent: { 
    flex: 1, 
    flexDirection: 'row',
    backgroundColor: '#1a1a2e'
  },
  contentArea: { 
    flex: 1, 
    backgroundColor: '#0f0f23' 
  },
  contentGradient: { 
    flex: 1 
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    paddingBottom: 100,
    flexGrow: 1,
  },
  overlay: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', 
    zIndex: 998,
  },
  bottomTabBar: {
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
  },
  tabButton: { 
    alignItems: 'center', 
    paddingVertical: 4, 
    paddingHorizontal: 8,
    minWidth: width / 5 - 16,
    position: 'relative',
  },
  tabLabel: { 
    fontSize: 10, 
    marginTop: 2,
    textAlign: 'center',
  },
  scanningBadge: {
    position: 'absolute',
    top: -2,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
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
    shadowColor: '#667eea',
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
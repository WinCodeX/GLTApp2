// components/AdminLayout.tsx - Updated with Scanning route
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, usePathname } from 'expo-router';
import AdminSidebar from './AdminSidebar';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

// ✅ Define proper TypeScript types for Ionicons
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

  // ✅ Updated bottom tabs with scanning route
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
      route: '/admin/scanning' // Updated to point to ScanningScreen
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

  // ✅ Enhanced pathname matching for scanning route
  const getActiveTab = (): string => {
    // Special handling for account route
    if (pathname === '/admin/account') {
      return 'profile';
    }
    
    // Special handling for scanning route
    if (pathname === '/admin/scanning') {
      return 'scan';
    }
    
    const currentTab = bottomTabs.find(tab => tab.route === pathname);
    return currentTab?.id || 'home';
  };

  const activeTab = getActiveTab();

  const toggleSidebar = (): void => setSidebarVisible(!sidebarVisible);
  const closeSidebar = (): void => setSidebarVisible(false);

  // ✅ Updated navigation handler with scanning route
  const handleTabPress = (tabId: string): void => {
    try {
      const tab = bottomTabs.find(t => t.id === tabId);
      if (!tab) {
        console.warn(`Tab with id ${tabId} not found`);
        return;
      }

      // Check if we're already on this route
      if (pathname === tab.route) {
        console.log(`Already on route: ${tab.route}`);
        return;
      }

      console.log(`Navigating from ${pathname} to ${tab.route}`);
      
      // Updated navigation logic with scanning route
      switch (tabId) {
        case 'profile':
          console.log('🚀 Navigating to admin account');
          router.push('/admin/account');
          break;
        case 'home':
          router.replace('/admin');
          break;
        case 'scan':
          console.log('🚀 Navigating to scanning screen');
          router.replace('/admin/scanning');
          break;
        case 'packages':
          router.replace('/admin/packages');
          break;
        case 'settings':
          router.replace('/admin/settings');
          break;
        default:
          console.warn(`Unknown tab id: ${tabId}`);
          router.replace('/admin');
          break;
      }
      
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to admin home
      router.replace('/admin');
    }
  };

  // ✅ Navigation debug logging with scanning route
  useEffect(() => {
    console.log('AdminLayout mounted, current pathname:', pathname);
    console.log('Active tab:', activeTab);
    console.log('Available tabs:', bottomTabs.map(t => `${t.id}: ${t.route}`));
    
    // Special logging for scanning route
    if (pathname === '/admin/scanning') {
      console.log('📱 Currently on Scanning Screen');
    }
  }, [pathname, activeTab]);

  // ✅ Handle avatar press with proper navigation
  const handleAvatarPress = (): void => {
    handleTabPress('profile');
  };

  // ✅ Handle search input with proper typing
  const handleSearchSubmit = (text: string): void => {
    console.log('Search submitted:', text);
    // Add your search logic here
  };

  // ✅ Enhanced route checking including scanning
  const shouldShowBottomTabs = (): boolean => {
    const adminRoutes = [
      '/admin',
      '/admin/scanning',
      '/admin/packages', 
      '/admin/settings',
      '/admin/account'
    ];
    return adminRoutes.includes(pathname || '') || pathname?.startsWith('/admin') || false;
  };

  // ✅ Enhanced FAB visibility logic
  const shouldShowFAB = (): boolean => {
    const fabRoutes = ['/admin', '/admin/scanning', '/admin/packages', '/admin/settings'];
    return fabRoutes.includes(pathname || '') || false;
  };

  // ✅ Handle FAB press based on current screen
  const handleFABPress = (): void => {
    console.log('FAB pressed on route:', pathname);
    
    switch (pathname) {
      case '/admin/scanning':
        // On scanning screen, FAB could open quick scan or bulk scan
        console.log('🚀 Opening quick scan from FAB');
        // You can trigger a callback or navigate to a specific scan mode
        break;
      case '/admin/packages':
        // On packages screen, FAB could create new package
        console.log('🚀 Creating new package from FAB');
        router.push('/admin/packages/create');
        break;
      case '/admin':
      default:
        // Default behavior - could open a quick action menu
        console.log('🚀 Opening quick actions from FAB');
        break;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <SafeAreaView style={styles.safeArea}>
        {/* ✅ Header with dynamic title based on current screen */}
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
              {/* Dynamic title based on current screen */}
              <Text style={styles.panelTitle}>
                {pathname === '/admin/scanning' ? 'Package Scanning' :
                 pathname === '/admin/packages' ? 'Package Management' :
                 pathname === '/admin/settings' ? 'Settings' :
                 pathname === '/admin/account' ? 'Account' :
                 'Dashboard'}
              </Text>
            </View>
          </View>

          {/* Center - Search (hide on scanning screen to give more space) */}
          {pathname !== '/admin/scanning' && (
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
      </SafeAreaView>

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

      {/* Bottom Tabs - Show on admin routes including scanning */}
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
                {/* Add scanning indicator badge */}
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

      {/* Enhanced Floating Action Button with context-aware actions */}
      {shouldShowFAB() && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={handleFABPress}
          accessibilityLabel={
            pathname === '/admin/scanning' ? 'Quick scan' :
            pathname === '/admin/packages' ? 'Add new package' :
            'Quick actions'
          }
          accessibilityRole="button"
        >
          <LinearGradient 
            colors={['#667eea', '#764ba2']} 
            style={styles.fabGradient}
          >
            <Ionicons 
              name={
                pathname === '/admin/scanning' ? 'qr-code' :
                pathname === '/admin/packages' ? 'add' :
                'add'
              } 
              size={28} 
              color="white" 
            />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#1a1a2e' 
  },
  safeArea: {
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#667eea',
  },
  header: {
    paddingHorizontal: 16,
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
    flexDirection: 'row' 
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
    paddingBottom: 12, // Account for home indicator on iOS
  },
  tabButton: { 
    alignItems: 'center', 
    paddingVertical: 4, 
    paddingHorizontal: 8,
    minWidth: width / 5 - 16, // Ensure even spacing
    position: 'relative',
  },
  tabLabel: { 
    fontSize: 10, 
    marginTop: 2,
    textAlign: 'center',
  },
  // ✅ New styles for scanning indicator
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
// components/AdminLayout.tsx - Fixed with NavigationHelper integration
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  Image,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import colors from '../theme/colors';
import { useUser } from '../context/UserContext';

// CRITICAL: Import NavigationHelper for proper navigation tracking
import { NavigationHelper } from '../lib/helpers/navigation';

const { width, height } = Dimensions.get('window');

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
  showBottomTabs?: boolean;
  activeTab?: string;
}

interface Tab {
  id: string;
  label: string;
  icon: string;
  route: string;
  iconLib: any;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title = 'Admin Panel',
  showHeader = true,
  showBottomTabs = true,
  activeTab = 'home'
}) => {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  
  const [searchText, setSearchText] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width)).current;

  const adminTabs: Tab[] = [
    { id: 'home', label: 'Home', icon: 'home', route: '/admin', iconLib: Feather },
    { id: 'scan', label: 'Scan', icon: 'qr-code-scanner', route: '/admin/ScanningScreen', iconLib: MaterialIcons },
    { id: 'packages', label: 'Packages', icon: 'package', route: '/admin/packages', iconLib: Feather },
    { id: 'settings', label: 'Settings', icon: 'settings', route: '/admin/settings', iconLib: Feather },
    { id: 'profile', label: 'Profile', icon: 'user', route: '/admin/account', iconLib: Feather },
  ];

  // FIXED: Enhanced navigation with proper tracking
  const handleTabPress = useCallback(async (tabId: string): Promise<void> => {
    try {
      const tab = adminTabs.find(t => t.id === tabId);
      if (!tab) {
        console.warn(`Tab with id ${tabId} not found`);
        return;
      }

      if (pathname === tab.route) {
        console.log(`Already on route: ${tab.route}`);
        return;
      }

      console.log(`🧭 AdminLayout: Navigating from ${pathname} to ${tab.route}`);
      
      // CRITICAL: Use NavigationHelper instead of direct router.push
      await NavigationHelper.navigateTo(tab.route, {
        params: {},
        trackInHistory: true
      });
      
    } catch (error) {
      console.error('❌ AdminLayout: Navigation error:', error);
      // Fallback with tracking
      try {
        await NavigationHelper.navigateTo('/admin');
      } catch (fallbackError) {
        console.error('❌ AdminLayout: Fallback navigation failed:', fallbackError);
      }
    }
  }, [pathname, adminTabs]);

  const handleAvatarPress = useCallback(async (): Promise<void> => {
    await handleTabPress('profile');
  }, [handleTabPress]);

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

  const toggleSearch = useCallback((): void => {
    const toValue = isSearchVisible ? -width : 0;
    setIsSearchVisible(!isSearchVisible);
    
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [isSearchVisible, slideAnim]);

  const renderBottomTabs = (): JSX.Element | null => {
    if (!shouldShowBottomTabs()) return null;

    return (
      <View style={styles.bottomTabContainer}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 0.95)', 'rgba(26, 26, 46, 1)']}
          style={styles.bottomTabGradient}
        >
          <View style={styles.bottomTabs}>
            {adminTabs.map((tab) => {
              const IconComponent = tab.iconLib;
              const isActive = pathname === tab.route || 
                             (tab.id === 'home' && pathname === '/admin') ||
                             (pathname?.startsWith('/admin') && tab.id === activeTab);

              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabButton, isActive && styles.activeTabButton]}
                  onPress={() => handleTabPress(tab.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.tabIconContainer, isActive && styles.activeTabIconContainer]}>
                    <IconComponent
                      name={tab.icon}
                      size={22}
                      color={isActive ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <Text style={[
                    styles.tabLabel,
                    isActive && styles.activeTabLabel
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderFAB = (): JSX.Element | null => {
    if (!shouldShowFAB()) return null;

    return (
      <TouchableOpacity
        style={styles.fab}
        onPress={() => handleTabPress('scan')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          style={styles.fabGradient}
        >
          <MaterialIcons name="qr-code-scanner" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderHeader = (): JSX.Element | null => {
    if (!showHeader) return null;

    return (
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['rgba(26, 26, 46, 1)', 'rgba(26, 26, 46, 0.95)']}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>Admin Dashboard</Text>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={toggleSearch}
                activeOpacity={0.7}
              >
                <Feather name="search" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={handleAvatarPress}
                activeOpacity={0.7}
              >
                {user?.profile_picture ? (
                  <Image
                    source={{ uri: user.profile_picture }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Feather name="user" size={18} color={colors.textSecondary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
        
        {/* Search Overlay */}
        <Animated.View
          style={[
            styles.searchOverlay,
            { transform: [{ translateX: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.98)', 'rgba(26, 26, 46, 1)']}
            style={styles.searchGradient}
          >
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search packages, users, reports..."
                placeholderTextColor={colors.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={() => handleSearchSubmit(searchText)}
                autoFocus={isSearchVisible}
              />
              <TouchableOpacity
                style={styles.searchCloseButton}
                onPress={toggleSearch}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {children}
      </KeyboardAvoidingView>
      
      {renderFAB()}
      {renderBottomTabs()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  searchGradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
  },
  searchCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  bottomTabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bottomTabGradient: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 0,
  },
  bottomTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 60,
  },
  activeTabButton: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
  },
  tabIconContainer: {
    marginBottom: 4,
  },
  activeTabIconContainer: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    zIndex: 1001,
    elevation: 8,
    shadowColor: colors.primary,
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
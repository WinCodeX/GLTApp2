// components/AdminLayout.tsx - Updated with expo-notifications integration
import React, { useState, ReactNode, useEffect, useRef } from 'react';
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
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AdminSidebar from './AdminSidebar';
import { useUser } from '../context/UserContext';
import { NavigationHelper } from '../lib/helpers/navigation';
import api from '../lib/api';

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

interface IncomingNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: number;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activePanel = 'home',
}) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<IncomingNotification[]>([]);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<IncomingNotification | null>(null);
  
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Notification banner animation
  const bannerAnimationValue = useRef(new Animated.Value(-100)).current;
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Notification listeners refs
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

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

  // EXPO NOTIFICATIONS SETUP
  useEffect(() => {
    setupNotifications();
    
    return () => {
      // Cleanup notification listeners
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  const setupNotifications = async () => {
    try {
      console.log('🔔 Admin: Setting up expo-notifications...');
      
      // Configure notification behavior
      await Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          console.log('🔔 Admin: Notification received:', notification);
          
          // Always show notifications when app is in foreground
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          };
        },
      });

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('🔔 Admin: Notification permissions not granted');
        return;
      }

      // Setup notification listeners
      notificationListener.current = Notifications.addNotificationReceivedListener(handleNotificationReceived);
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
      
      console.log('✅ Admin: Expo notifications setup complete');
      
    } catch (error) {
      console.error('❌ Admin: Failed to setup notifications:', error);
    }
  };

  const handleNotificationReceived = (notification: Notifications.Notification) => {
    console.log('🔔 Admin: New notification received:', notification);
    
    const incomingNotification: IncomingNotification = {
      id: notification.request.identifier,
      title: notification.request.content.title || 'New Notification',
      body: notification.request.content.body || '',
      data: notification.request.content.data,
      timestamp: Date.now(),
    };
    
    // Add to recent notifications
    setRecentNotifications(prev => [incomingNotification, ...prev.slice(0, 4)]);
    
    // Show notification banner
    displayNotificationBanner(incomingNotification);
    
    // Increment notification count
    setNotificationCount(prev => prev + 1);
    
    // Store last notification for banner display
    setCurrentNotification(incomingNotification);
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    console.log('🔔 Admin: Notification response received:', response);
    
    const notificationData = response.notification.request.content.data;
    
    // Handle different notification types
    if (notificationData?.type === 'package_update') {
      // Navigate to admin package management
      navigateToPackages();
    } else if (notificationData?.type === 'admin_alert') {
      // Navigate to admin notifications
      handleNotifications();
    } else {
      // Default: navigate to admin notifications
      handleNotifications();
    }
  };

  const displayNotificationBanner = (notification: IncomingNotification) => {
    setCurrentNotification(notification);
    setShowNotificationBanner(true);
    
    // Animate banner in
    Animated.sequence([
      Animated.timing(bannerAnimationValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000), // Show for 3 seconds
      Animated.timing(bannerAnimationValue, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNotificationBanner(false);
      setCurrentNotification(null);
    });
  };

  const dismissNotificationBanner = () => {
    Animated.timing(bannerAnimationValue, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowNotificationBanner(false);
      setCurrentNotification(null);
    });
  };

  const handleBannerPress = () => {
    dismissNotificationBanner();
    
    if (currentNotification?.data?.type === 'package_update') {
      navigateToPackages();
    } else {
      handleNotifications();
    }
  };

  const navigateToPackages = async () => {
    try {
      await NavigationHelper.navigateTo('/admin/packages', {
        params: {},
        trackInHistory: true
      });
    } catch (error) {
      console.error('Navigation to admin packages failed:', error);
    }
  };

  // FIXED: Fetch notification count from regular user notifications API
  const fetchNotificationCount = async () => {
    try {
      console.log('🔔 Admin: Fetching notification count from user notifications API...');
      
      // Method 1: Try the dedicated unread_count endpoint
      try {
        const response = await api.get('/api/v1/notifications/unread_count', {
          timeout: 8000
        });
        console.log('🔔 Admin: Unread count endpoint response:', response.data);
        
        if (response.data && response.data.success) {
          const count = response.data.unread_count || response.data.count || 0;
          setNotificationCount(count);
          console.log('🔔 Admin: Notification count updated from unread_count endpoint:', count);
          return;
        }
      } catch (unreadCountError) {
        console.log('🔔 Admin: Unread count endpoint failed, trying fallback:', unreadCountError.response?.status);
      }
      
      // Method 2: Fallback to notifications index endpoint with minimal data
      try {
        const response = await api.get('/api/v1/notifications', {
          params: {
            per_page: 1,
            page: 1,
            unread_only: 'true'
          },
          timeout: 8000
        });
        
        console.log('🔔 Admin: Notifications index response:', response.data);
        
        if (response.data && response.data.success) {
          const count = response.data.unread_count || response.data.pagination?.total_count || 0;
          setNotificationCount(count);
          console.log('🔔 Admin: Notification count updated from index endpoint:', count);
          return;
        }
      } catch (indexError) {
        console.log('🔔 Admin: Index endpoint also failed:', indexError.response?.status);
      }
      
      // Method 3: Final fallback - just get all notifications and count unread manually
      try {
        const response = await api.get('/api/v1/notifications', {
          params: {
            per_page: 50, // Get enough to count unread
            page: 1
          },
          timeout: 10000
        });
        
        if (response.data && response.data.success && response.data.data) {
          const unreadCount = response.data.data.filter((notification: any) => !notification.read).length;
          setNotificationCount(unreadCount);
          console.log('🔔 Admin: Notification count updated from manual count:', unreadCount);
          return;
        }
      } catch (manualCountError) {
        console.log('🔔 Admin: Manual count also failed:', manualCountError.response?.status);
      }
      
      console.warn('🔔 Admin: All notification count methods failed, keeping previous count');
      
    } catch (error) {
      console.error('🔔 Admin: Unexpected error in fetchNotificationCount:', error);
    }
  };

  useEffect(() => {
    fetchNotificationCount();
    
    // Refresh counts every 30 seconds
    const interval = setInterval(() => {
      fetchNotificationCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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

  // Updated navigation handler with NavigationHelper
  const handleTabPress = async (tabId: string): Promise<void> => {
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
          await NavigationHelper.navigateTo('/admin/account', {
            params: {},
            trackInHistory: true
          });
          break;
        case 'home':
          console.log('Navigating to admin home');
          await NavigationHelper.navigateTo('/admin', {
            params: {},
            trackInHistory: true
          });
          break;
        case 'scan':
          console.log('Navigating to scanning screen');
          await NavigationHelper.navigateTo('/admin/ScanningScreen', {
            params: {},
            trackInHistory: true
          });
          break;
        case 'packages':
          console.log('Navigating to packages');
          await NavigationHelper.navigateTo('/admin/packages', {
            params: {},
            trackInHistory: true
          });
          break;
        case 'settings':
          console.log('Navigating to settings');
          await NavigationHelper.navigateTo('/admin/settings', {
            params: {},
            trackInHistory: true
          });
          break;
        default:
          console.warn(`Unknown tab id: ${tabId}`);
          await NavigationHelper.navigateTo('/admin', {
            params: {},
            trackInHistory: true
          });
          break;
      }
      
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback using router for critical navigation failure
      try {
        router.push('/admin');
      } catch (fallbackError) {
        console.error('Fallback navigation also failed:', fallbackError);
      }
    }
  };

  const handleAvatarPress = (): void => {
    handleTabPress('profile');
  };

  // FIXED: Navigate to admin notifications screen
  const handleNotifications = async (): void => {
    try {
      console.log('🔔 Admin: Navigating to admin notifications');
      await NavigationHelper.navigateTo('/admin/notifications', {
        params: {},
        trackInHistory: true
      });
    } catch (error) {
      console.error('🔔 Admin: Navigation to notifications failed:', error);
      // Fallback to router navigation
      router.push('/admin/notifications');
    }
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

  // Updated FAB handler with NavigationHelper
  const handleFABPress = async (): Promise<void> => {
    console.log('FAB pressed on route:', pathname);
    
    try {
      switch (pathname) {
        case '/admin/ScanningScreen':
          console.log('Opening quick scan from FAB');
          // No navigation needed, just log the action
          break;
        case '/admin/packages':
          console.log('Creating new package from FAB');
          await NavigationHelper.navigateTo('/admin/packages/create', {
            params: {},
            trackInHistory: true
          });
          break;
        case '/admin':
        default:
          console.log('Opening quick actions from FAB - navigating to scan');
          await NavigationHelper.navigateTo('/admin/ScanningScreen', {
            params: {},
            trackInHistory: true
          });
          break;
      }
    } catch (error) {
      console.error('FAB navigation error:', error);
      // Fallback using router for critical navigation failure
      try {
        router.push('/admin/ScanningScreen');
      } catch (fallbackError) {
        console.error('FAB fallback navigation also failed:', fallbackError);
      }
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

  const renderBadge = (count: number, color: string) => {
    if (count === 0) return null;
    
    return (
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>
          {count > 99 ? '99+' : count.toString()}
        </Text>
      </View>
    );
  };

  return (
    <>
      <View style={styles.container}>
        {/* Status bar configuration */}
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="#667eea" 
          translucent={false}
        />
        
        {/* Status bar spacer to ensure content doesn't overlap */}
        <View style={styles.statusBarSpacer} />
        
        {/* Header with gradient - positioned below status bar */}
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
              onPress={handleNotifications}
              accessibilityLabel="Admin notifications"
              accessibilityRole="button"
            >
              <View style={styles.iconContainer}>
                <Ionicons name="notifications-outline" size={22} color="white" />
                {renderBadge(notificationCount, '#8b5cf6')}
              </View>
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
          <SafeAreaView style={styles.bottomTabContainer}>
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
          </SafeAreaView>
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
      </View>

      {/* Notification Banner */}
      {showNotificationBanner && currentNotification && (
        <Animated.View
          style={[
            styles.notificationBanner,
            {
              transform: [{ translateY: bannerAnimationValue }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.notificationBannerContent}
            onPress={handleBannerPress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.notificationBannerGradient}
            >
              <View style={styles.notificationBannerIcon}>
                <Ionicons name="notifications" size={16} color="white" />
              </View>
              
              <View style={styles.notificationBannerText}>
                <Text style={styles.notificationBannerTitle} numberOfLines={1}>
                  {currentNotification.title}
                </Text>
                <Text style={styles.notificationBannerBody} numberOfLines={2}>
                  {currentNotification.body}
                </Text>
              </View>
              
              <TouchableOpacity
                onPress={dismissNotificationBanner}
                style={styles.notificationBannerClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#667eea' // Match status bar color
  },
  statusBarSpacer: {
    height: Constants.statusBarHeight,
    backgroundColor: '#667eea', // Match the gradient start color
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
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
  bottomTabContainer: {
    backgroundColor: '#16213e',
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
  // Notification Banner Styles
  notificationBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingTop: 50, // Account for status bar
  },
  notificationBannerContent: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  notificationBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  notificationBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBannerText: {
    flex: 1,
  },
  notificationBannerTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  notificationBannerBody: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    lineHeight: 16,
  },
  notificationBannerClose: {
    padding: 4,
  },
});

export default AdminLayout;
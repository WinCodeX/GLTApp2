// components/AdminSidebar.tsx - Fixed with NavigationHelper integration
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';

// CRITICAL: Import NavigationHelper for proper navigation tracking
import { NavigationHelper } from '../lib/helpers/navigation';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

interface SidebarFeature {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  id: string;
  route?: string;
}

interface ExpandedSections {
  hangout: boolean;
  admin: boolean;
  logistics: boolean;
}

interface AdminSidebarProps {
  visible: boolean;
  onClose: () => void;
  activePanel: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  visible,
  onClose,
  activePanel,
}) => {
  const { user } = useUser();
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    hangout: true,
    admin: true,
    logistics: true,
  });

  const toggleSection = (section: keyof ExpandedSections): void => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Admin features mapped to actual admin folder routes
  const adminFeatures: SidebarFeature[] = [
    { icon: 'cube-outline', title: 'App Manager', id: 'app-manager', route: '/admin/AppManagerScreen' },
    { icon: 'search-outline', title: 'Package Search', id: 'search', route: '/admin/PackageSearchScreen' },
    { icon: 'scan-outline', title: 'Scanning', id: 'scanning', route: '/admin/ScanningScreen' },
    { icon: 'person-outline', title: 'Account', id: 'account', route: '/admin/account' },
    { icon: 'home-outline', title: 'Admin Home', id: 'admin-home', route: '/admin' },
    { icon: 'settings-outline', title: 'Admin Settings', id: 'admin-settings', route: '/admin/settings' },
  ];

  // Support features using drawer routes
  const supportFeatures: SidebarFeature[] = [
    { icon: 'help-circle-outline', title: 'Support', id: 'support', route: '/(drawer)/support' },
    { icon: 'chatbubble-ellipses-outline', title: 'Contact', id: 'contact', route: '/(drawer)/contact' },
    { icon: 'business-outline', title: 'Business', id: 'business', route: '/(drawer)/business' },
    { icon: 'document-text-outline', title: 'FAQs', id: 'faqs', route: '/(drawer)/FAQs' },
    { icon: 'location-outline', title: 'Find Us', id: 'findus', route: '/(drawer)/findus' },
  ];

  // Logistics features using drawer routes
  const logisticsFeatures: SidebarFeature[] = [
    { icon: 'location-outline', title: 'Track Package', id: 'track', route: '/(drawer)/track' },
    { icon: 'home-outline', title: 'Home', id: 'home', route: '/(drawer)/' },
    { icon: 'cart-outline', title: 'Cart', id: 'cart', route: '/(drawer)/cart' },
    { icon: 'time-outline', title: 'History', id: 'history', route: '/(drawer)/History' },
    { icon: 'contacts-outline', title: 'Contacts', id: 'contacts', route: '/(drawer)/contacts' },
  ];

  // FIXED: Enhanced navigation with proper tracking
  const handleFeaturePress = async (feature: SidebarFeature): Promise<void> => {
    if (!feature.route) {
      console.log(`No route defined for feature: ${feature.title}`);
      return;
    }

    try {
      console.log(`🧭 AdminSidebar: Navigating to ${feature.route} (${feature.title})`);
      
      // Close sidebar first
      onClose();
      
      // CRITICAL: Use NavigationHelper instead of direct router.push
      await NavigationHelper.navigateTo(feature.route, {
        params: {},
        trackInHistory: true
      });
      
      console.log(`✅ AdminSidebar: Successfully navigated to ${feature.title}`);
      
    } catch (error) {
      console.error(`❌ AdminSidebar: Navigation error for ${feature.title}:`, error);
      
      // Fallback navigation with tracking
      try {
        if (feature.route.startsWith('/admin')) {
          await NavigationHelper.navigateTo('/admin');
        } else {
          await NavigationHelper.navigateTo('/(drawer)/');
        }
        console.log(`🔄 AdminSidebar: Used fallback navigation for ${feature.title}`);
      } catch (fallbackError) {
        console.error(`❌ AdminSidebar: Fallback navigation failed for ${feature.title}:`, fallbackError);
      }
    }
  };

  const renderFeature = (feature: SidebarFeature): JSX.Element => (
    <TouchableOpacity
      key={feature.id}
      style={styles.featureButton}
      onPress={() => handleFeaturePress(feature)}
      activeOpacity={0.7}
    >
      <View style={styles.featureContent}>
        <Ionicons
          name={feature.icon}
          size={20}
          color="#667eea"
          style={styles.featureIcon}
        />
        <Text style={styles.featureText}>{feature.title}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSection = (
    title: string,
    features: SidebarFeature[],
    sectionKey: keyof ExpandedSections
  ): JSX.Element => (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(sectionKey)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons
          name={expandedSections[sectionKey] ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#8B8B8B"
        />
      </TouchableOpacity>
      
      {expandedSections[sectionKey] && (
        <View style={styles.featuresContainer}>
          {features.map(renderFeature)}
        </View>
      )}
    </View>
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      
      <View style={styles.sidebar}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.sidebarGradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.avatarContainer}>
                {user?.profile_picture ? (
                  <Image
                    source={{ uri: user.profile_picture }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={24} color="#667eea" />
                  </View>
                )}
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {user?.name || user?.username || 'Admin User'}
                </Text>
                <Text style={styles.userRole}>
                  {user?.role || 'Administrator'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#8B8B8B" />
            </TouchableOpacity>
          </View>

          {/* Navigation Sections */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {renderSection('Admin Features', adminFeatures, 'admin')}
            {renderSection('Logistics', logisticsFeatures, 'logistics')}
            {renderSection('Support & Help', supportFeatures, 'hangout')}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>GLT Admin Dashboard</Text>
            <Text style={styles.versionText}>v2.0.0</Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
  },
  sidebarGradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 14,
    color: '#8B8B8B',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featuresContainer: {
    marginTop: 8,
  },
  featureButton: {
    marginVertical: 2,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  featureIcon: {
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#8B8B8B',
    fontWeight: '500',
  },
  versionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

export default AdminSidebar;
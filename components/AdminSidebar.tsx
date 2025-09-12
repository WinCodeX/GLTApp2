// AdminSidebar.tsx - Updated with Terms Management integration
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
import { useRouter } from 'expo-router';
import { useUser } from '../context/UserContext';
// FIXED: Import NavigationHelper
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
  const router = useRouter();
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
    { icon: 'document-text-outline', title: 'Terms Management', id: 'terms-management', route: '/admin/TermsManagementScreen' },
    { icon: 'home-outline', title: 'Admin Home', id: 'admin-home', route: '/admin' },
    { icon: 'settings-outline', title: 'Admin Settings', id: 'admin-settings', route: '/admin/settings' },
  ];

  // Support features using drawer routes
  const supportFeatures: SidebarFeature[] = [
    { icon: 'help-circle-outline', title: 'Support', id: 'support', route: '/support' },
    { icon: 'chatbubble-ellipses-outline', title: 'Contact', id: 'contact', route: '/contact' },
    { icon: 'business-outline', title: 'Business', id: 'business', route: '/business' },
    { icon: 'document-text-outline', title: 'FAQs', id: 'faqs', route: '/faqs' },
    { icon: 'location-outline', title: 'Find Us', id: 'findus', route: '/findus' },
  ];

  // Logistics features using drawer routes
  const logisticsFeatures: SidebarFeature[] = [
    { icon: 'location-outline', title: 'Track Package', id: 'track', route: '/track' },
    { icon: 'home-outline', title: 'Home', id: 'home', route: '/home' },
    { icon: 'cart-outline', title: 'Cart', id: 'cart', route: '/cart' },
    { icon: 'time-outline', title: 'History', id: 'history', route: '/history' },
    { icon: 'contacts-outline', title: 'Contacts', id: 'contacts', route: '/contact' },
  ];

  const quickActionLocations: string[] = ['Thika', 'Machakos', 'Kisii'];

  // FIXED: Updated feature press handler with NavigationHelper
  const handleFeaturePress = async (item: SidebarFeature) => {
    if (item.route) {
      try {
        console.log(`Navigating to: ${item.route}`);
        await NavigationHelper.navigateTo(item.route, {
          params: {},
          trackInHistory: true
        });
        onClose();
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback to admin home for admin features
        if (item.route.startsWith('/admin')) {
          try {
            await NavigationHelper.navigateTo('/admin', {
              params: {},
              trackInHistory: true
            });
            onClose();
          } catch (fallbackError) {
            console.error('Fallback navigation failed:', fallbackError);
            // Ultimate fallback using router
            try {
              router.push('/admin');
              onClose();
            } catch (routerError) {
              console.error('Router fallback also failed:', routerError);
            }
          }
        }
      }
    }
  };

  // FIXED: Updated quick action handler with NavigationHelper
  const handleQuickAction = async (location: string) => {
    console.log(`Quick action for ${location}`);
    try {
      // You can add specific logic for each location here
      await NavigationHelper.navigateTo('/track', {
        params: {},
        trackInHistory: true
      });
      onClose();
    } catch (error) {
      console.error('Quick action navigation error:', error);
      // Fallback using router
      try {
        router.push('/track');
        onClose();
      } catch (fallbackError) {
        console.error('Quick action fallback navigation failed:', fallbackError);
      }
    }
  };

  const renderFeatureItem = (item: SidebarFeature): JSX.Element => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.featureItem,
        {
          backgroundColor:
            activePanel === item.id ? 'rgba(108, 92, 231, 0.2)' : 'transparent',
        },
      ]}
      onPress={() => handleFeaturePress(item)}
      activeOpacity={0.7}
    >
      <Ionicons
        name={item.icon}
        size={18}
        color={activePanel === item.id ? '#6c5ce7' : '#a0aec0'}
      />
      <Text
        style={[
          styles.featureText,
          {
            color: activePanel === item.id ? '#6c5ce7' : '#cbd5e0',
            fontWeight: activePanel === item.id ? '600' : '400',
          },
        ]}
      >
        {item.title}
      </Text>
      {activePanel === item.id && (
        <View style={styles.activeIndicator} />
      )}
    </TouchableOpacity>
  );

  const renderSection = (
    title: string,
    sectionKey: keyof ExpandedSections,
    features: SidebarFeature[]
  ): JSX.Element => (
    <View style={styles.sectionContainer}>
      <TouchableOpacity
        onPress={() => toggleSection(sectionKey)}
        style={styles.sectionHeader}
        activeOpacity={0.7}
      >
        <Ionicons
          name={expandedSections[sectionKey] ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color="#a0aec0"
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </TouchableOpacity>
      {expandedSections[sectionKey] && (
        <View style={styles.sectionContent}>
          {features.map(renderFeatureItem)}
        </View>
      )}
    </View>
  );

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2d3748', '#1a202c', '#16213e']}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={styles.logoContainer}>
                  <Text style={styles.logoText}>GL</Text>
                </View>
                <View>
                  <Text style={styles.companyName}>GLT Logistics</Text>
                  <Text style={styles.panelLabel}>Admin Panel</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#a0aec0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <LinearGradient
              colors={['#6c5ce7', '#a29bfe']}
              style={styles.profileCard}
            >
              <View style={styles.profileAvatar}>
                {user?.avatar_url ? (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={24} color="white" />
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {user?.name || 'Admin User'}
                </Text>
                <Text style={styles.profilePhone}>
                  {user?.phone || '+254 000 000 000'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={async () => {
                  try {
                    await NavigationHelper.navigateTo('/admin/account', {
                      params: {},
                      trackInHistory: true
                    });
                    onClose();
                  } catch (error) {
                    console.error('Profile navigation error:', error);
                    // Fallback using router
                    try {
                      router.push('/admin/account');
                      onClose();
                    } catch (fallbackError) {
                      console.error('Profile fallback navigation failed:', fallbackError);
                    }
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-down" size={20} color="white" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.locationButtons}>
              {quickActionLocations.map((location) => (
                <TouchableOpacity 
                  key={location} 
                  style={styles.locationButton}
                  onPress={() => handleQuickAction(location)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.locationButtonText}>{location}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {renderSection('Admin Features', 'admin', adminFeatures)}
          {renderSection('Logistics', 'logistics', logisticsFeatures)}
          {renderSection('Support & More', 'hangout', supportFeatures)}
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  companyName: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  panelLabel: {
    color: '#a0aec0',
    fontSize: 12,
  },
  profileSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
  },
  profileCard: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  profilePhone: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  quickActions: {
    padding: 16,
  },
  sectionLabel: {
    color: '#a0aec0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  locationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  locationButton: {
    backgroundColor: '#2d3748',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4a5568',
  },
  locationButtonText: {
    color: '#a0aec0',
    fontSize: 12,
  },
  sectionContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#a0aec0',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionContent: {
    marginLeft: 24,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    position: 'relative',
  },
  featureText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  activeIndicator: {
    position: 'absolute',
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6c5ce7',
  },
});

export default AdminSidebar;
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/context/UserContext';
import { Image } from 'react-native';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

interface SidebarFeature {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  id: string;
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
  activePanel 
}) => {
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    hangout: true,
    admin: true,
    logistics: true,
  });

  const toggleSection = (section: keyof ExpandedSections): void => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const adminFeatures: SidebarFeature[] = [
    { icon: 'cube-outline', title: 'Warehouse', id: 'warehouse' },
    { icon: 'search-outline', title: 'Search', id: 'search' },
    { icon: 'chatbubble-outline', title: 'Communicate', id: 'communicate' },
    { icon: 'grid-outline', title: 'Switchboard', id: 'switchboard' },
    { icon: 'people-outline', title: 'Users', id: 'users' },
    { icon: 'lock-open-outline', title: 'Unlocking', id: 'unlocking' },
    { icon: 'card-outline', title: 'Withdrawals', id: 'withdrawals' },
    { icon: 'pricetag-outline', title: 'Pricing', id: 'pricing' },
  ];

  const supportFeatures: SidebarFeature[] = [
    { icon: 'help-circle-outline', title: 'Support', id: 'support' },
    { icon: 'ticket-outline', title: 'Tickets', id: 'tickets' },
    { icon: 'business-outline', title: 'Business', id: 'business' },
    { icon: 'chatbubble-ellipses-outline', title: 'Feedback', id: 'feedback' },
    { icon: 'diamond-outline', title: 'Enterprise', id: 'enterprise' },
    { icon: 'document-text-outline', title: 'Terms', id: 'terms' },
    { icon: 'phone-portrait-outline', title: 'App Manager', id: 'app-manager' },
  ];

  const logisticsFeatures: SidebarFeature[] = [
    { icon: 'location-outline', title: 'Track Package', id: 'track' },
    { icon: 'car-outline', title: 'Currently Reaching', id: 'reaching' },
    { icon: 'calculator-outline', title: 'Cost Calculator', id: 'calculator' },
    { icon: 'time-outline', title: 'History', id: 'history' },
    { icon: 'contacts-outline', title: 'Contacts', id: 'contacts' },
  ];

  const quickActionLocations: string[] = ['Thika', 'Machakos', 'Kisii'];

  const renderFeatureItem = (item: SidebarFeature): JSX.Element => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.featureItem,
        {
          backgroundColor: activePanel === item.id ? 'rgba(108, 92, 231, 0.2)' : 'transparent',
        }
      ]}
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
          }
        ]}
      >
        {item.title}
      </Text>
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
      >
        <Ionicons
          name={expandedSections[sectionKey] ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color="#a0aec0"
        />
        <Text style={styles.sectionTitle}>
          {title}
        </Text>
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
                  <Text style={styles.logoText}>
                    GL
                  </Text>
                </View>
                <View>
                  <Text style={styles.companyName}>
                    GLT Logistics
                  </Text>
                  <Text style={styles.panelLabel}>
                    Admin Panel
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#a0aec0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* User Profile Section */}
         const { user } = useUser();

<View style={styles.profileSection}>
  <LinearGradient
    colors={['#6c5ce7', '#a29bfe']}
    style={styles.profileCard}
  >
    <View style={styles.profileAvatar}>
      {user.avatarUrl ? (
        <Image
          source={{ uri: user.avatarUrl }}
          style={styles.avatarImage}
        />
      ) : (
        <Ionicons name="person" size={24} color="white" />
      )}
    </View>
    <View style={styles.profileInfo}>
      <Text style={styles.profileName}>
        {user.name || 'Admin User'}
      </Text>
      <Text style={styles.profilePhone}>
        {user.phone || '+254 000 000 000'}
      </Text>
    </View>
    <Ionicons name="chevron-down" size={20} color="white" />
  </LinearGradient>
</View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Text style={styles.sectionLabel}>
              Quick Actions
            </Text>
            <View style={styles.locationButtons}>
              {quickActionLocations.map((location: string) => (
                <TouchableOpacity
                  key={location}
                  style={styles.locationButton}
                >
                  <Text style={styles.locationButtonText}>{location}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Logistics Features */}
          {renderSection('Logistics', 'logistics', logisticsFeatures)}

          {/* Admin Features */}
          {renderSection('Admin Features', 'admin', adminFeatures)}

          {/* Support & More */}
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
  },
  featureText: {
    fontSize: 14,
    marginLeft: 12,
},
avatarImage: {
  width: 40,
  height: 40,
  borderRadius: 20,
  resizeMode: 'cover',
},
});

export default AdminSidebar;
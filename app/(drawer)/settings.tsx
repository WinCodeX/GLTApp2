// app/settings.tsx - Updated for Stack Navigation (moved from app/(drawer)/)
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, TextInput } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';

// Import Stack Navigation hooks instead of NavigationHelper
import { useStackNavigation, useHardwareBackButton, useAppNavigation } from '../lib/hooks/useStackNavigation';

const SETTINGS_SECTIONS = [
  {
    title: 'Account Settings',
    data: [
      { id: '1', label: 'Account', icon: 'account-circle', route: '/account' },
      { id: '2', label: 'Content & Social', icon: 'group', route: '/SettingsContentSocial' },
    ],
  },
  {
    title: 'App Settings',
    data: [
      { id: '3', label: 'Appearance', icon: 'color-lens', route: '/SettingsAppearance' },
      { id: '4', label: 'Accessibility', icon: 'accessibility', route: '/SettingsAccessibility' },
      { id: '5', label: 'Notifications', icon: 'notifications', route: '/SettingsNotifications' },
      { id: '6', label: 'Advanced', icon: 'settings', route: '/SettingsAdvanced' },
    ],
  },
  {
    title: 'Support',
    data: [
      { id: '9', label: 'Support', icon: 'help-circle', route: '/support' },
      { id: '10', label: 'Upload any Bugs you find to GLT Support', icon: 'file-upload', route: '/SettingsBugReport' },
      { id: '11', label: 'Acknowledgements', icon: 'info', route: '/SettingsAcknowledgements' },
    ],
  },
];

export default function SettingsScreen() {
  const [search, setSearch] = useState('');
  
  // Stack Navigation hooks
  const { goBack, push } = useStackNavigation();
  const navigation = useAppNavigation();
  
  // Handle hardware back button automatically
  useHardwareBackButton('/(drawer)/');

  // Simple back navigation using Stack Navigation
  const handleGoBack = useCallback(() => {
    console.log('🔙 Settings: Going back...');
    goBack('/(drawer)/');
  }, [goBack]);

  // Updated navigation handler using Stack Navigation
  const handleSettingNavigation = useCallback((item: any) => {
    console.log('🔧 Settings: Navigating to:', item.label);
    
    try {
      // Use Stack Navigation push method
      push(item.route);
      console.log('✅ Settings: Successfully navigated to:', item.route);
    } catch (error) {
      console.error('❌ Settings: Navigation failed for:', item.label, error);
    }
  }, [push]);

  // Function to filter the settings data
  const filterSettings = (sections: any) => {
    if (!search) return sections;

    return sections.map((section: any) => ({
      ...section,
      data: section.data.filter((item: any) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      ),
    }));
  };

  // Render section with edge lighting effect
  const renderSection = ({ section }) => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionHeader}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.data.map((item, index) => (
          <View key={item.id}>
            <View style={styles.settingItemContainer}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => handleSettingNavigation(item)}
                activeOpacity={0.7}
              >
                <MaterialIcons name={item.icon} size={24} color="#fff" />
                <Text style={styles.settingText}>{item.label}</Text>
                <Feather name="chevron-right" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            {index < section.data.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with gradient background and Stack Navigation back */}
      <LinearGradient
        colors={['#4c1d95', '#7c3aed', '#3730a3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchBar}
            placeholder="Search settings..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Settings List */}
      <SectionList
        sections={filterSettings(SETTINGS_SECTIONS)}
        keyExtractor={(item) => item.id}
        renderItem={() => null} // We handle rendering in renderSectionHeader
        renderSectionHeader={renderSection}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f', // Darker background to match account screen
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50, // Account for status bar
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'italic', // Cursive-like style to match account screen
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  placeholder: {
    width: 44, // Same width as back button for centering
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    paddingHorizontal: 16,
    minHeight: 44,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 32,
    marginBottom: 12,
    opacity: 0.9,
  },
  sectionContent: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.6)', // Purple edge lighting
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  settingItemContainer: {
    backgroundColor: 'transparent',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  settingText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginLeft: 16,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    marginLeft: 60, // Align with text, not icon
  },
});
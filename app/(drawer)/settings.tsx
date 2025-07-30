import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, TextInput } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import colors from '../../theme/colors'; // Ensure your colors are imported here

const SETTINGS_SECTIONS = [
  {
    title: 'Account Settings',
    data: [
      { id: '1', label: 'Account', icon: 'account-circle' },
      { id: '2', label: 'Content & Social', icon: 'group' },
    ],
  },
  {
    title: 'App Settings',
    data: [
      { id: '3', label: 'Appearance', icon: 'color-lens' },
      { id: '4', label: 'Accessibility', icon: 'accessibility' },
      { id: '5', label: 'Notifications', icon: 'notifications' },
      { id: '6', label: 'Advanced', icon: 'settings' },
    ],
  },
  {
    title: 'Support',
    data: [
      { id: '9', label: 'Support', icon: 'help-circle' },
      { id: '10', label: 'Upload debug logs to Discord Support', icon: 'file-upload' },
      { id: '11', label: 'Acknowledgements', icon: 'info' },
    ],
  },
];

export default function SettingsScreen({ navigation }: any) {
  const [search, setSearch] = useState('');

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

  // Render each item in the section list
  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={() => navigation.navigate(item.label.toLowerCase().replace(' ', '_'))} // Navigate to settings
    >
      <MaterialIcons name={item.icon} size={24} color={colors.primary} />
      <Text style={styles.settingText}>{item.label}</Text>
      <Feather name="chevron-right" size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Back and Settings Title */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Search Bar */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search"
        placeholderTextColor="#888"
        value={search}
        onChangeText={setSearch}
      />

      {/* Settings List */}
      <SectionList
        sections={filterSettings(SETTINGS_SECTIONS)} // Use filtered sections here
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e11', // Dark background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#601DA6', // Same background as account header
    elevation: 5,  // Shadow for iOS and Android
    shadowColor: '#000', // Shadow color for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#3e1d70', // Edge glow effect color
  },
  backButton: {
    marginRight: 12,
    padding: 4, // Adds some touchable area around the icon
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center', // Centering the title
  },
  searchBar: {
    backgroundColor: '#2a2a3d',
    color: '#fff',
    paddingVertical: 10,
    paddingLeft: 16,
    margin: 16,
    borderRadius: 8,
    fontSize: 16,
    shadowColor: '#000', // Shadow color for search bar
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 16,
    marginBottom: 8,
    paddingTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a3d',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    marginVertical: 6,
    borderRadius: 8,
    marginLeft: 16,
    marginRight: 16,
  },
  settingText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginLeft: 12,
  },
});
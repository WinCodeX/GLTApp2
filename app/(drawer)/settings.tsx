import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import colors from '../../theme/colors'; // Ensure your colors are imported here

const SETTINGS_SECTIONS = [
  {
    title: 'Account Settings',
    data: [
      { id: '1', label: 'Account', icon: 'account-circle' },
      { id: '2', label: 'Content & Social', icon: 'group' },
      { id: '3', label: 'Data & Privacy', icon: 'lock' },
      { id: '4', label: 'Family Center', icon: 'family-restroom' },
    ],
  },
  {
    title: 'App Settings',
    data: [
      { id: '5', label: 'Appearance', icon: 'color-lens' },
      { id: '6', label: 'Accessibility', icon: 'accessibility' },
      { id: '7', label: 'Notifications', icon: 'notifications' },
      { id: '8', label: 'Advanced', icon: 'settings' },
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
      <Text style={styles.title}>Settings</Text>
      <SectionList
        sections={SETTINGS_SECTIONS}
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
    backgroundColor: colors.background,
    paddingTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 16,
    marginBottom: 15,
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
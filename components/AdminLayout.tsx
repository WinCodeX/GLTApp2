// components/AdminLayout.tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const adminMenu = [
  {
    title: 'System',
    items: ['Create Location', 'Create Agent'],
  },
  {
    title: 'Users',
    items: ['User List', 'Assign Roles'],
  },
  {
    title: 'Analytics',
    items: ['Package Stats', 'Return Logs'],
  },
];

export default function AdminLayout({ children, onSelect }) {
  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <ScrollView>
          {adminMenu.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item) => (
                <TouchableOpacity key={item} onPress={() => onSelect(item)}>
                  <Text style={styles.menuItem}># {item.toLowerCase().replace(/\s+/g, '-')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#0a0a0f' },
  sidebar: { width: 200, backgroundColor: '#15151d', padding: 10 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#888', marginBottom: 6, fontWeight: 'bold' },
  menuItem: { color: '#f8f8f2', marginVertical: 4, paddingLeft: 10 },
  content: { flex: 1, padding: 20 },
});
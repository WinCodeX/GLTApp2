// app/(agent)/updates.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { AgentBottomTabs } from '../../components/agent/AgentBottomTabs';

export default function AgentUpdatesScreen() {
  const updates = [
    {
      id: 1,
      type: 'delivery',
      title: 'Package Delivered',
      message: 'Package #12345 delivered to Lekki Phase 1',
      time: '15 mins ago',
      icon: 'check-circle',
      color: '#4CAF50',
    },
    {
      id: 2,
      type: 'pickup',
      title: 'New Pickup Request',
      message: 'Pickup scheduled for Victoria Island',
      time: '1 hour ago',
      icon: 'package',
      color: '#2196F3',
    },
    {
      id: 3,
      type: 'system',
      title: 'Route Updated',
      message: 'Your delivery route has been optimized',
      time: '2 hours ago',
      icon: 'map',
      color: '#FF9800',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Updates</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Feather name="filter" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {updates.map((update) => (
          <TouchableOpacity key={update.id} style={styles.updateCard}>
            <View style={[styles.iconContainer, { backgroundColor: `${update.color}20` }]}>
              <Feather name={update.icon as any} size={24} color={update.color} />
            </View>
            <View style={styles.updateContent}>
              <Text style={styles.updateTitle}>{update.title}</Text>
              <Text style={styles.updateMessage}>{update.message}</Text>
              <Text style={styles.updateTime}>{update.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <AgentBottomTabs currentTab="updates" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  updateCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  updateContent: {
    flex: 1,
  },
  updateTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  updateMessage: {
    color: '#B8B8B8',
    fontSize: 14,
    marginBottom: 4,
  },
  updateTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
});
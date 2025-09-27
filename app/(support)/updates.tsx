// app/(support)/updates.tsx - Updates Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SupportBottomTabs } from '../../components/support/SupportBottomTabs';

const PLACEHOLDER_STATUSES = [
  {
    id: '1',
    user: 'System Admin',
    avatar: require('../../assets/images/avatar_placeholder.png'),
    time: '10:05',
    type: 'image',
    content: 'System maintenance scheduled for tonight',
  },
  {
    id: '2',
    user: 'Support Team',
    avatar: require('../../assets/images/avatar_placeholder.png'),
    time: '09:30',
    type: 'text',
    content: 'New support features available',
  },
];

const PLACEHOLDER_CHANNELS = [
  {
    id: '1',
    name: 'GLT Announcements',
    description: 'Official company announcements and updates',
    icon: '📢',
    unreadCount: 3,
    lastMessage: 'New feature rollout scheduled',
    time: '10:05',
  },
  {
    id: '2',
    name: 'Support Updates',
    description: 'Latest support system improvements',
    icon: '🛠️',
    unreadCount: 1,
    lastMessage: 'Chat system performance improved',
    time: '09:15',
  },
];

export default function UpdatesScreen() {
  const [searchQuery, setSearchQuery] = useState('');

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
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="search" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="more-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statusContainer}
          >
            {/* Add Status Button */}
            <TouchableOpacity style={styles.addStatusButton}>
              <LinearGradient
                colors={['#7B3F98', '#5A2D82']}
                style={styles.addStatusGradient}
              >
                <Feather name="plus" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.statusLabel}>Add status</Text>
            </TouchableOpacity>

            {/* Status Items */}
            {PLACEHOLDER_STATUSES.map((status) => (
              <TouchableOpacity key={status.id} style={styles.statusItem}>
                <View style={styles.statusImageContainer}>
                  <Image source={status.avatar} style={styles.statusImage} />
                  <LinearGradient
                    colors={['#7B3F98', '#5A2D82']}
                    style={styles.statusBorder}
                  />
                </View>
                <Text style={styles.statusLabel} numberOfLines={1}>
                  {status.user}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Channels Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Channels</Text>
            <TouchableOpacity style={styles.exploreButton}>
              <Text style={styles.exploreButtonText}>Explore</Text>
            </TouchableOpacity>
          </View>

          {PLACEHOLDER_CHANNELS.map((channel) => (
            <TouchableOpacity key={channel.id} style={styles.channelItem}>
              <View style={styles.channelIcon}>
                <Text style={styles.channelEmoji}>{channel.icon}</Text>
              </View>
              <View style={styles.channelInfo}>
                <View style={styles.channelHeader}>
                  <Text style={styles.channelName}>{channel.name}</Text>
                  <Text style={styles.channelTime}>{channel.time}</Text>
                </View>
                <Text style={styles.channelDescription} numberOfLines={1}>
                  {channel.lastMessage}
                </Text>
              </View>
              {channel.unreadCount > 0 && (
                <View style={styles.channelBadge}>
                  <Text style={styles.channelBadgeText}>{channel.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Find Channels Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Find channels to follow</Text>
          
          <View style={styles.findChannelItem}>
            <View style={styles.channelIcon}>
              <Text style={styles.channelEmoji}>📊</Text>
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>GLT Analytics</Text>
              <Text style={styles.followerCount}>125 followers</Text>
            </View>
            <TouchableOpacity style={styles.followButton}>
              <Text style={styles.followButtonText}>Follow</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.findChannelItem}>
            <View style={styles.channelIcon}>
              <Text style={styles.channelEmoji}>🔧</Text>
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>Technical Support</Text>
              <Text style={styles.followerCount}>89 followers</Text>
            </View>
            <TouchableOpacity style={styles.followButton}>
              <Text style={styles.followButtonText}>Follow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <SupportBottomTabs currentTab="updates" />
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exploreButton: {
    backgroundColor: '#7B3F98',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  statusContainer: {
    paddingVertical: 8,
  },
  addStatusButton: {
    alignItems: 'center',
    marginRight: 16,
    width: 60,
  },
  addStatusGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 60,
  },
  statusImageContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  statusImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  statusBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 30,
    padding: 2,
  },
  statusLabel: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    width: 60,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  channelIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1F2C34',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  channelEmoji: {
    fontSize: 24,
  },
  channelInfo: {
    flex: 1,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  channelName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  channelTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  channelDescription: {
    color: '#B8B8B8',
    fontSize: 14,
  },
  channelBadge: {
    backgroundColor: '#7B3F98',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  channelBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  findChannelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  followerCount: {
    color: '#8E8E93',
    fontSize: 12,
  },
  followButton: {
    backgroundColor: '#7B3F98',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
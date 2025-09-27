// app/(support)/calls.tsx - Calls Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SupportBottomTabs } from '../../components/support/SupportBottomTabs';

interface CallRecord {
  id: string;
  contactName: string;
  avatar?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  callType: 'voice' | 'video';
  timestamp: string;
  duration?: string;
}

const PLACEHOLDER_CALLS: CallRecord[] = [
  {
    id: '1',
    contactName: 'Customer #12345',
    type: 'incoming',
    callType: 'voice',
    timestamp: 'Yesterday, 20:58',
    duration: '5:23',
  },
  {
    id: '2',
    contactName: 'Support Manager',
    type: 'outgoing',
    callType: 'video',
    timestamp: 'September 25, 22:52',
    duration: '12:45',
  },
  {
    id: '3',
    contactName: 'Customer #98765',
    type: 'missed',
    callType: 'voice',
    timestamp: 'September 25, 17:26',
  },
  {
    id: '4',
    contactName: 'Technical Team',
    type: 'outgoing',
    callType: 'voice',
    timestamp: 'September 24, 22:41',
    duration: '8:15',
  },
  {
    id: '5',
    contactName: 'Customer #54321',
    type: 'incoming',
    callType: 'video',
    timestamp: 'September 23, 22:51',
    duration: '3:47',
  },
];

export default function CallsScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const getCallIcon = (type: string, callType: string) => {
    if (callType === 'video') {
      return 'video';
    }
    return type === 'incoming' ? 'phone-incoming' : 
           type === 'outgoing' ? 'phone-outgoing' : 'phone-missed';
  };

  const getCallIconColor = (type: string) => {
    switch (type) {
      case 'incoming': return '#10b981';
      case 'outgoing': return '#10b981';
      case 'missed': return '#ef4444';
      default: return '#8E8E93';
    }
  };

  const renderCallItem = ({ item }: { item: CallRecord }) => (
    <TouchableOpacity style={styles.callItem}>
      <Image
        source={require('../../assets/images/avatar_placeholder.png')}
        style={styles.callAvatar}
      />
      <View style={styles.callInfo}>
        <Text style={styles.callName}>{item.contactName}</Text>
        <View style={styles.callDetails}>
          <Feather
            name={getCallIcon(item.type, item.callType) as any}
            size={14}
            color={getCallIconColor(item.type)}
          />
          <Text style={[styles.callTimestamp, { color: getCallIconColor(item.type) }]}>
            {item.timestamp}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.callButton}>
        <Feather name="phone" size={20} color="#7B3F98" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const filteredCalls = PLACEHOLDER_CALLS.filter(call =>
    call.contactName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Calls</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="search" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Feather name="more-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search and Favorites */}
      <View style={styles.topSection}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={20} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search calls..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Favorites */}
        <TouchableOpacity style={styles.favoritesSection}>
          <LinearGradient
            colors={['#10b981', '#059669']}
            style={styles.favoriteIcon}
          >
            <MaterialIcons name="favorite" size={24} color="#fff" />
          </LinearGradient>
          <Text style={styles.favoritesText}>Add favorite</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Calls */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent</Text>
        <FlatList
          data={filteredCalls}
          keyExtractor={(item) => item.id}
          renderItem={renderCallItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="call" size={64} color="#444" />
              <Text style={styles.emptyText}>No calls yet</Text>
              <Text style={styles.emptySubtext}>Your call history will appear here</Text>
            </View>
          )}
        />
      </View>

      {/* Floating Call Button */}
      <TouchableOpacity style={styles.floatingButton}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          style={styles.floatingButtonGradient}
        >
          <Feather name="phone" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <SupportBottomTabs currentTab="calls" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  topSection: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  favoritesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  favoriteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  favoritesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  recentSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  callAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
  },
  callName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callTimestamp: {
    fontSize: 14,
    marginLeft: 6,
  },
  callButton: {
    padding: 8,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
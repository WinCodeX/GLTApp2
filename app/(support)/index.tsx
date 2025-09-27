
// app/(support)/index.tsx - Main Support Dashboard
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useUser } from '../../context/UserContext';
import api from '../../lib/api';
import { SupportBottomTabs } from '../../components/support/SupportBottomTabs';

interface SupportTicket {
  id: string;
  ticket_id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'solved' | 'closed';
  priority: 'low' | 'normal' | 'high';
  customer: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  last_message: {
    content: string;
    created_at: string;
    from_support: boolean;
  } | null;
  unread_count: number;
  last_activity_at: string;
  category: string;
}

const STATUS_FILTERS = [
  { key: 'pending', label: 'Pending', count: 0 },
  { key: 'all', label: 'All', count: 0 },
  { key: 'solved', label: 'Solved', count: 0 },
  { key: 'gltchats', label: 'GLT Chats', count: 0 },
];

export default function SupportDashboard() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('pending');
  const [currentChat, setCurrentChat] = useState<string | null>(null);

  // Load support tickets
  const loadTickets = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get('/api/v1/conversations', {
        params: {
          type: 'support',
          status: activeFilter === 'all' ? undefined : activeFilter
        }
      });

      if (response.data.success) {
        setTickets(response.data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to load support tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Filter tickets based on search
  const filteredTickets = tickets.filter(ticket =>
    ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.ticket_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get status counts
  const statusCounts = {
    pending: tickets.filter(t => t.status === 'pending').length,
    all: tickets.length,
    solved: tickets.filter(t => t.status === 'solved' || t.status === 'closed').length,
    gltchats: tickets.filter(t => t.category === 'glt_internal').length,
  };

  const renderTicketItem = ({ item }: { item: SupportTicket }) => (
    <TouchableOpacity
      style={styles.ticketItem}
      onPress={() => {
        setCurrentChat(item.id);
        router.push(`/(support)/chat/${item.id}`);
      }}
    >
      <View style={styles.ticketContent}>
        <View style={styles.ticketHeader}>
          <Image
            source={
              item.customer.avatar_url
                ? { uri: item.customer.avatar_url }
                : require('../../assets/images/avatar_placeholder.png')
            }
            style={styles.customerAvatar}
          />
          <View style={styles.ticketInfo}>
            <View style={styles.ticketTitleRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.customer.name}
              </Text>
              <Text style={styles.ticketTime}>
                {formatTime(item.last_activity_at)}
              </Text>
            </View>
            <View style={styles.ticketSubtitleRow}>
              <Text style={styles.ticketPreview} numberOfLines={1}>
                {item.last_message?.content || 'No messages yet'}
              </Text>
              {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
            <View style={styles.ticketMetaRow}>
              <Text style={styles.ticketId}>#{item.ticket_id}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>GLT Support</Text>
            <Text style={styles.headerSubtitle}>
              Welcome back, {user?.first_name || 'Agent'}
            </Text>
            <Text style={styles.headerDescription}>
              These are your conversations for today
            </Text>
          </View>
          <Image
            source={
              user?.avatar_url
                ? { uri: user.avatar_url }
                : require('../../assets/images/avatar_placeholder.png')
            }
            style={styles.headerAvatar}
          />
        </View>
      </LinearGradient>

      {/* Current Chat Indicator */}
      {currentChat && (
        <View style={styles.currentChatIndicator}>
          <Feather name="message-circle" size={16} color="#E1BEE7" />
          <Text style={styles.currentChatText}>
            Currently in chat #{currentChat.slice(-8)}
          </Text>
          <TouchableOpacity onPress={() => setCurrentChat(null)}>
            <Feather name="x" size={16} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === item.key && styles.filterPillActive
              ]}
              onPress={() => setActiveFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === item.key && styles.filterPillTextActive
                ]}
              >
                {item.label}
              </Text>
              {statusCounts[item.key] > 0 && (
                <View style={styles.filterPillBadge}>
                  <Text style={styles.filterPillBadgeText}>
                    {statusCounts[item.key]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Tickets List */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7B3F98" />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTickets}
            keyExtractor={(item) => item.id}
            renderItem={renderTicketItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadTickets(true)}
                colors={['#7B3F98']}
                tintColor="#7B3F98"
              />
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="chat-bubble-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>No conversations found</Text>
                <Text style={styles.emptySubtext}>
                  {activeFilter === 'pending' 
                    ? 'No pending support tickets'
                    : `No ${activeFilter} conversations`
                  }
                </Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Bottom Tabs */}
      <SupportBottomTabs currentTab="chats" />
    </SafeAreaView>
  );
}

// Utility functions
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#f97316';
    case 'in_progress': return '#8b5cf6';
    case 'solved': return '#10b981';
    case 'closed': return '#6b7280';
    default: return '#8b5cf6';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#E1BEE7',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  headerDescription: {
    color: '#C1A7C9',
    fontSize: 14,
    opacity: 0.9,
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: 16,
  },
  currentChatIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 63, 152, 0.2)',
  },
  currentChatText: {
    color: '#E1BEE7',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  searchContainer: {
    padding: 16,
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
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#7B3F98',
  },
  filterPillText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  filterPillBadge: {
    backgroundColor: '#E1BEE7',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  filterPillBadgeText: {
    color: '#7B3F98',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  ticketItem: {
    backgroundColor: '#1F2C34',
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
  },
  ticketContent: {
    padding: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  ticketTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  ticketSubtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketPreview: {
    color: '#B8B8B8',
    fontSize: 14,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#7B3F98',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketId: {
    color: '#8E8E93',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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
});
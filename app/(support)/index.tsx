// app/(support)/index.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  ScrollView,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useUser } from '../../context/UserContext';
import api from '../../lib/api';
import ActionCableService from '../../lib/services/ActionCableService';
import { accountManager } from '../../lib/AccountManager';
import { SupportBottomTabs } from '../../components/support/SupportBottomTabs';

interface SupportTicket {
  id: string;
  ticket_id: string;
  title: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  customer: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  assigned_agent?: {
    id: string;
    name: string;
    email: string;
  };
  last_message: {
    content: string;
    created_at: string;
    from_support: boolean;
  } | null;
  unread_count: number;
  message_count: number;
  last_activity_at: string;
  created_at: string;
  escalated: boolean;
}

interface DashboardStats {
  total_tickets: number;
  pending_tickets: number;
  in_progress_tickets: number;
  resolved_today: number;
  avg_response_time: string;
  satisfaction_score: number;
}

const STATUS_FILTERS = [
  { key: 'in_progress', label: 'Active', icon: 'activity' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'assigned', label: 'Assigned', icon: 'user' },
  { key: 'resolved', label: 'Resolved', icon: 'check-circle' },
  { key: 'closed', label: 'Closed', icon: 'x-circle' },
];

export default function SupportDashboard() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    total_tickets: 0,
    pending_tickets: 0,
    in_progress_tickets: 0,
    resolved_today: 0,
    avg_response_time: '0m',
    satisfaction_score: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('in_progress');
  const [showStats, setShowStats] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const actionCableRef = useRef<ActionCableService | null>(null);
  const subscriptionsSetup = useRef(false);

  const setupActionCable = useCallback(async () => {
    if (!user || subscriptionsSetup.current) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

      console.log('📡 Setting up ActionCable for support dashboard...');

      actionCableRef.current = ActionCableService.getInstance();
      
      const connected = await actionCableRef.current.connect({
        token: currentAccount.token,
        userId: currentAccount.id,
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        setupSubscriptions();
        subscriptionsSetup.current = true;
      }
    } catch (error) {
      console.error('❌ Failed to setup ActionCable:', error);
      setIsConnected(false);
    }
  }, [user]);

  const setupSubscriptions = () => {
    if (!actionCableRef.current) return;

    console.log('📡 Setting up subscriptions...');

    actionCableRef.current.subscribe('connection_established', () => {
      console.log('✅ Connection established');
      setIsConnected(true);
    });

    actionCableRef.current.subscribe('connection_lost', () => {
      console.log('❌ Connection lost');
      setIsConnected(false);
    });

    actionCableRef.current.subscribe('dashboard_stats_update', (data) => {
      console.log('📊 Stats update:', data);
      if (data.stats) {
        setDashboardStats(data.stats);
      }
    });

    actionCableRef.current.subscribe('new_support_ticket', (data) => {
      console.log('🎫 New ticket:', data);
      if (data.ticket) {
        setTickets(prev => [data.ticket, ...prev]);
        setDashboardStats(prev => ({
          ...prev,
          total_tickets: prev.total_tickets + 1,
          pending_tickets: prev.pending_tickets + 1,
        }));
      }
    });

    actionCableRef.current.subscribe('ticket_status_update', (data) => {
      console.log('🔄 Status update:', data);
      if (data.ticket_id && data.status) {
        setTickets(prev => prev.map(ticket => 
          ticket.id === data.ticket_id 
            ? { ...ticket, status: data.status, last_activity_at: new Date().toISOString() }
            : ticket
        ));
      }
    });

    actionCableRef.current.subscribe('new_message', (data) => {
      console.log('💬 New message:', data);
      if (data.conversation_id && data.message) {
        setTickets(prev => prev.map(ticket => {
          if (ticket.id === data.conversation_id) {
            return {
              ...ticket,
              last_message: {
                content: data.message.content,
                created_at: data.message.created_at,
                from_support: data.message.from_support
              },
              last_activity_at: data.message.created_at,
              unread_count: !data.message.from_support ? (ticket.unread_count || 0) + 1 : ticket.unread_count,
              message_count: (ticket.message_count || 0) + 1,
            };
          }
          return ticket;
        }));
      }
    });

    actionCableRef.current.subscribe('initial_state', (data) => {
      console.log('📊 Initial state:', data);
      if (data.dashboard_stats) {
        setDashboardStats(data.dashboard_stats);
      }
    });
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/support/dashboard');
      if (response.data.success && response.data.data) {
        const stats = response.data.data.stats || {};
        setDashboardStats({
          total_tickets: stats.total_tickets || 0,
          pending_tickets: stats.pending_tickets || 0,
          in_progress_tickets: stats.in_progress_tickets || 0,
          resolved_today: stats.resolved_today || 0,
          avg_response_time: stats.avg_response_time || '0m',
          satisfaction_score: stats.satisfaction_score || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }, []);

  const loadTickets = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const params: any = { limit: 50, page: 1 };

      if (activeFilter !== 'all') {
        params.status = activeFilter;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await api.get('/api/v1/support/tickets', { params });

      if (response.data.success) {
        setTickets(response.data.data.tickets || []);
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    setupActionCable();
    loadDashboardData();
    loadTickets();

    return () => {
      if (actionCableRef.current) {
        actionCableRef.current.disconnect();
      }
    };
  }, [setupActionCable, loadDashboardData, loadTickets]);

  const statusCounts = {
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    all: tickets.length,
    assigned: tickets.filter(t => t.status === 'assigned').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const renderStatsOverview = () => {
    if (!showStats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Live Dashboard</Text>
          {isConnected && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.total_tickets}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.pending_tickets}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.in_progress_tickets}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.resolved_today}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.avg_response_time}</Text>
            <Text style={styles.statLabel}>Avg Time</Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderTicketItem = ({ item }: { item: SupportTicket }) => (
    <TouchableOpacity
      style={styles.ticketItem}
      onPress={() => router.push(`/(support)/chat/${item.id}`)}
    >
      <Image
        source={
          item.customer.avatar_url
            ? { uri: item.customer.avatar_url }
            : require('../../assets/images/avatar_placeholder.png')
        }
        style={styles.customerAvatar}
      />
      <View style={styles.ticketInfo}>
        <View style={styles.ticketRow}>
          <Text style={styles.customerName}>{item.customer.name}</Text>
          <Text style={styles.ticketTime}>{formatTime(item.last_activity_at)}</Text>
        </View>
        <Text style={styles.ticketPreview} numberOfLines={1}>
          {item.last_message?.content || 'No messages'}
        </Text>
        <View style={styles.ticketMeta}>
          <Text style={styles.ticketId}>#{item.ticket_id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>GLT Support</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.headerSubtitle}>Welcome back, {user?.first_name}</Text>
              {isConnected && (
                <View style={styles.connectionStatus}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedText}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerDescription}>
              {dashboardStats.pending_tickets} pending • {dashboardStats.total_tickets} total
            </Text>
          </View>
          <TouchableOpacity
            style={styles.statsToggleButton}
            onPress={() => setShowStats(!showStats)}
          >
            <Feather name={showStats ? 'eye-off' : 'eye'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {renderStatsOverview()}

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === item.key && styles.filterPillActive]}
            onPress={() => setActiveFilter(item.key)}
          >
            <Text style={[styles.filterText, activeFilter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
            {statusCounts[item.key] > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{statusCounts[item.key]}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        style={styles.filtersList}
        showsHorizontalScrollIndicator={false}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicketItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTickets(true)} />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="support-agent" size={64} color="#444" />
              <Text style={styles.emptyText}>No tickets found</Text>
            </View>
          )}
        />
      )}

      <SupportBottomTabs currentTab="chats" />
    </SafeAreaView>
  );
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#f97316';
    case 'assigned': return '#3b82f6';
    case 'in_progress': return '#8b5cf6';
    case 'resolved': return '#10b981';
    case 'closed': return '#6b7280';
    default: return '#8b5cf6';
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111B21' },
  header: { paddingTop: 28, paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between' },
  headerLeft: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  headerSubtitle: { color: '#E1BEE7', fontSize: 16 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 4 },
  connectedText: { color: '#10b981', fontSize: 10, fontWeight: '600' },
  headerDescription: { color: '#C1A7C9', fontSize: 14, marginTop: 2 },
  statsToggleButton: { padding: 8 },
  statsContainer: { backgroundColor: 'rgba(123, 63, 152, 0.1)', paddingVertical: 12 },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  statsTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 4 },
  liveText: { color: '#10b981', fontSize: 10, fontWeight: '600' },
  statCard: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 12, alignItems: 'center', minWidth: 80 },
  statNumber: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#E1BEE7', fontSize: 12, marginTop: 4 },
  searchContainer: { padding: 16 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2C34', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 8 },
  filtersList: { paddingHorizontal: 16, marginBottom: 8 },
  filterPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  filterPillActive: { backgroundColor: '#7B3F98' },
  filterText: { color: '#8E8E93', fontSize: 14 },
  filterTextActive: { color: '#fff' },
  filterBadge: { backgroundColor: '#E1BEE7', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  filterBadgeText: { color: '#7B3F98', fontSize: 12, fontWeight: '600' },
  ticketItem: { flexDirection: 'row', backgroundColor: '#1F2C34', marginHorizontal: 8, marginVertical: 2, borderRadius: 8, padding: 12 },
  customerAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  ticketInfo: { flex: 1 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  customerName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  ticketTime: { color: '#8E8E93', fontSize: 12 },
  ticketPreview: { color: '#B8B8B8', fontSize: 14, marginBottom: 6 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center' },
  ticketId: { color: '#8E8E93', fontSize: 12, marginRight: 8 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  unreadBadge: { backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#8E8E93', fontSize: 16, marginTop: 16 },
});
// app/(support)/index.tsx - Fixed Support Dashboard with ActionCable integration
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
  package_id?: string;
}

interface DashboardStats {
  total_tickets: number;
  pending_tickets: number;
  in_progress_tickets: number;
  resolved_today: number;
  avg_response_time: string;
  satisfaction_score: number;
  tickets_by_priority: {
    high: number;
    normal: number;
    low: number;
  };
}

interface AgentStats {
  tickets_resolved_today: number;
  avg_resolution_time: string;
  active_tickets: number;
  satisfaction_rating: number;
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
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('in_progress');
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  
  // ActionCable state
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeStats, setRealtimeStats] = useState<DashboardStats | null>(null);

  // Setup ActionCable connection for real-time updates
  const setupActionCable = useCallback(async () => {
    if (!user) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

      const actionCable = ActionCableService.getInstance();
      
      // Connect to ActionCable
      const connected = await actionCable.connect({
        token: currentAccount.token,
        userId: user.id,
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        console.log('ActionCable connected for support dashboard');

        // Subscribe to dashboard updates
        actionCable.subscribe('dashboard_stats_update', (data) => {
          console.log('Dashboard stats update received:', data);
          if (data.stats) {
            setRealtimeStats(data.stats);
            setDashboardStats(data.stats);
          }
        });

        // Subscribe to new support tickets
        actionCable.subscribe('new_support_ticket', (data) => {
          console.log('New support ticket:', data);
          if (data.ticket) {
            setTickets(prev => [data.ticket, ...prev]);
            // Update stats
            loadDashboardData();
          }
        });

        // Subscribe to ticket status updates
        actionCable.subscribe('ticket_status_update', (data) => {
          console.log('Ticket status update:', data);
          if (data.ticket_id && data.status) {
            setTickets(prev => prev.map(ticket => 
              ticket.id === data.ticket_id 
                ? { ...ticket, status: data.status, last_activity_at: new Date().toISOString() }
                : ticket
            ));
            // Update stats
            loadDashboardData();
          }
        });

        // Subscribe to new messages in tickets
        actionCable.subscribe('new_message', (data) => {
          console.log('New message in support ticket:', data);
          if (data.conversation_id && data.message) {
            setTickets(prev => prev.map(ticket => {
              if (ticket.id === data.conversation_id) {
                const updatedTicket = { ...ticket };
                updatedTicket.last_message = {
                  content: data.message.content,
                  created_at: data.message.created_at,
                  from_support: data.message.from_support
                };
                updatedTicket.last_activity_at = data.message.created_at;
                if (!data.message.from_support) {
                  updatedTicket.unread_count = (updatedTicket.unread_count || 0) + 1;
                }
                updatedTicket.message_count = (updatedTicket.message_count || 0) + 1;
                return updatedTicket;
              }
              return ticket;
            }));
          }
        });

        // Subscribe to agent assignment updates
        actionCable.subscribe('agent_assignment_update', (data) => {
          console.log('Agent assignment update:', data);
          if (data.ticket_id && data.agent) {
            setTickets(prev => prev.map(ticket => 
              ticket.id === data.ticket_id 
                ? { ...ticket, assigned_agent: data.agent, status: 'assigned' }
                : ticket
            ));
          }
        });

        // Subscribe to ticket escalation
        actionCable.subscribe('ticket_escalated', (data) => {
          console.log('Ticket escalated:', data);
          if (data.ticket_id) {
            setTickets(prev => prev.map(ticket => 
              ticket.id === data.ticket_id 
                ? { ...ticket, escalated: true, priority: 'high' }
                : ticket
            ));
          }
        });

        // Subscribe to connection status updates
        actionCable.subscribe('connection_established', () => {
          setIsConnected(true);
          console.log('ActionCable connection established');
          // Request fresh dashboard data
          actionCable.requestInitialState();
        });

        actionCable.subscribe('connection_lost', () => {
          setIsConnected(false);
          console.log('ActionCable connection lost');
        });

        // Subscribe to initial state response
        actionCable.subscribe('initial_state', (data) => {
          console.log('Initial state received:', data);
          if (data.dashboard_stats) {
            setRealtimeStats(data.dashboard_stats);
            setDashboardStats(data.dashboard_stats);
          }
          if (data.agent_stats) {
            setAgentStats(data.agent_stats);
          }
        });

        // Request initial dashboard state
        await actionCable.requestInitialState();
        
        // Subscribe to business updates if user has businesses
        if (user.businesses && user.businesses.length > 0) {
          for (const business of user.businesses) {
            await actionCable.subscribeToBusinessUpdates(business.id);
          }
        }

      }
    } catch (error) {
      console.error('Failed to setup ActionCable for dashboard:', error);
      setIsConnected(false);
    }
  }, [user]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/support/dashboard');
      if (response.data.success) {
        const stats = response.data.data.stats;
        const agentPerformance = response.data.data.agent_performance;
        
        setDashboardStats(stats);
        setAgentStats(agentPerformance);
        
        // If we have real-time stats, prefer those
        if (!realtimeStats) {
          setRealtimeStats(stats);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  }, [realtimeStats]);

  // Load support tickets
  const loadTickets = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      // Use support-specific endpoint
      const endpoint = '/api/v1/support/tickets';
      const params: any = {
        limit: 50,
        page: 1,
      };

      if (activeFilter !== 'all') {
        params.status = activeFilter;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await api.get(endpoint, { params });

      if (response.data.success) {
        setTickets(response.data.data.tickets || []);
      }
    } catch (error) {
      console.error('Failed to load support tickets:', error);
      Alert.alert('Error', 'Failed to load support tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, searchQuery]);

  // Setup ActionCable on mount
  useEffect(() => {
    setupActionCable();

    return () => {
      // Cleanup ActionCable connection
      const actionCable = ActionCableService.getInstance();
      actionCable.disconnect();
    };
  }, [setupActionCable]);

  // Load data on mount and filter change
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Quick assign ticket to current user
  const handleQuickAssign = async (ticketId: string) => {
    try {
      const response = await api.post(`/api/v1/support/tickets/${ticketId}/assign`, {
        agent_id: user?.id
      });
      
      if (response.data.success) {
        // Optimistic update
        setTickets(prev => prev.map(ticket => 
          ticket.id === ticketId 
            ? { 
                ...ticket, 
                assigned_agent: { 
                  id: user?.id || '', 
                  name: user?.display_name || user?.first_name || 'Me',
                  email: user?.email || ''
                },
                status: 'assigned' as const
              }
            : ticket
        ));
        
        Alert.alert('Success', 'Ticket assigned to you');
      }
    } catch (error) {
      console.error('Failed to assign ticket:', error);
      Alert.alert('Error', 'Failed to assign ticket');
      // Refresh to get correct state
      loadTickets();
    }
  };

  // Handle real-time ticket read status
  const handleTicketRead = useCallback(async (ticketId: string) => {
    try {
      // Mark as read optimistically
      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId 
          ? { ...ticket, unread_count: 0 }
          : ticket
      ));

      // Send read status via ActionCable
      const actionCable = ActionCableService.getInstance();
      await actionCable.markMessageRead(ticketId);
      
    } catch (error) {
      console.error('Failed to mark ticket as read:', error);
    }
  }, []);

  // Update presence status
  const updatePresenceStatus = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    try {
      const actionCable = ActionCableService.getInstance();
      await actionCable.updatePresence(status);
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, []);

  // Handle app state changes for presence
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        updatePresenceStatus('online');
      } else if (nextAppState === 'background') {
        updatePresenceStatus('away');
      }
    };

    // Note: In React Native, you would use AppState.addEventListener
    // For this example, we'll assume presence is handled automatically by ActionCable

    return () => {
      updatePresenceStatus('offline');
    };
  }, [updatePresenceStatus]);

  // Get status counts from loaded tickets
  const statusCounts = {
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    all: tickets.length,
    assigned: tickets.filter(t => t.status === 'assigned').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  // Use real-time stats if available, otherwise fall back to loaded stats
  const currentStats = realtimeStats || dashboardStats;

  const renderStatsOverview = () => {
    if (!currentStats || !showStats) return null;

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
            <Text style={styles.statNumber}>{currentStats.total_tickets}</Text>
            <Text style={styles.statLabel}>Total Tickets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{currentStats.pending_tickets}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{currentStats.in_progress_tickets}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{currentStats.resolved_today}</Text>
            <Text style={styles.statLabel}>Resolved Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{currentStats.avg_response_time}</Text>
            <Text style={styles.statLabel}>Avg Response</Text>
          </View>
          {agentStats && (
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{agentStats.active_tickets}</Text>
              <Text style={styles.statLabel}>My Active</Text>
            </View>
          )}
          {currentStats.satisfaction_score && (
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{currentStats.satisfaction_score.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Satisfaction</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderTicketItem = ({ item }: { item: SupportTicket }) => (
    <TouchableOpacity
      style={styles.ticketItem}
      onPress={() => {
        console.log('Navigating to chat with ID:', item.id);
        setCurrentChat(item.id);
        handleTicketRead(item.id);
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
              <View style={styles.ticketMeta}>
                {item.escalated && (
                  <Feather name="alert-triangle" size={12} color="#f97316" style={{ marginRight: 4 }} />
                )}
                <Text style={styles.ticketTime}>
                  {formatTime(item.last_activity_at)}
                </Text>
                {isConnected && (
                  <View style={styles.realtimeIndicator}>
                    <View style={styles.realtimeDot} />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.ticketSubtitleRow}>
              <Text style={styles.ticketPreview} numberOfLines={1}>
                {item.last_message?.content || 'No messages yet'}
              </Text>
              {item.unread_count > 0 && (
                <View style={[styles.unreadBadge, isConnected && styles.unreadBadgeLive]}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
            <View style={styles.ticketMetaRow}>
              <View style={styles.ticketLeftMeta}>
                <Text style={styles.ticketId}>#{item.ticket_id}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
                  <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.ticketRightMeta}>
                {!item.assigned_agent && item.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.quickAssignButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleQuickAssign(item.id);
                    }}
                  >
                    <Feather name="user-plus" size={12} color="#7B3F98" />
                    <Text style={styles.quickAssignText}>Assign</Text>
                  </TouchableOpacity>
                )}
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
            </View>
            {item.assigned_agent && (
              <View style={styles.assignedAgentRow}>
                <Feather name="user" size={12} color="#8E8E93" />
                <Text style={styles.assignedAgentText}>
                  Assigned to {item.assigned_agent.name}
                </Text>
              </View>
            )}
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
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.headerSubtitle}>
                Welcome back, {user?.first_name || 'Agent'}
              </Text>
              {isConnected && (
                <View style={styles.connectionStatus}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedText}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerDescription}>
              {currentStats ? `${currentStats.pending_tickets} pending • ${currentStats.total_tickets} total tickets` : 'Loading dashboard...'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.statsToggleButton}
              onPress={() => setShowStats(!showStats)}
            >
              <Feather name={showStats ? 'eye-off' : 'eye'} size={20} color="#fff" />
            </TouchableOpacity>
            <Image
              source={
                user?.avatar_url
                  ? { uri: user.avatar_url }
                  : require('../../assets/images/avatar_placeholder.png')
              }
              style={styles.headerAvatar}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Stats Overview */}
      {renderStatsOverview()}

      {/* Current Chat Indicator - FIXED WITH PROPER STRING HANDLING */}
      {currentChat && typeof currentChat === 'string' && currentChat.length > 0 && (
        <View style={styles.currentChatIndicator}>
          <Feather name="message-circle" size={16} color="#E1BEE7" />
          <Text style={styles.currentChatText}>
            Currently in chat #{currentChat.length >= 8 ? currentChat.substring(currentChat.length - 8) : currentChat}
          </Text>
          <TouchableOpacity onPress={() => setCurrentChat(null)}>
            <Feather name="x" size={16} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}

      {/* Connection Status Banner */}
      {!isConnected && (
        <View style={styles.connectionBanner}>
          <MaterialIcons name="wifi-off" size={16} color="#f97316" />
          <Text style={styles.connectionBannerText}>
            Real-time updates unavailable. Reconnecting...
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets, customers, or ticket IDs..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => loadTickets()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
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
              <Feather 
                name={item.icon as any} 
                size={14} 
                color={activeFilter === item.key ? '#fff' : '#8E8E93'} 
              />
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === item.key && styles.filterPillTextActive
                ]}
              >
                {item.label}
              </Text>
              {statusCounts[item.key] > 0 && (
                <View style={[
                  styles.filterPillBadge,
                  isConnected && styles.filterPillBadgeLive
                ]}>
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
            <Text style={styles.loadingText}>Loading support tickets...</Text>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => item.id}
            renderItem={renderTicketItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  loadTickets(true);
                  loadDashboardData();
                }}
                colors={['#7B3F98']}
                tintColor="#7B3F98"
              />
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="support-agent" size={64} color="#444" />
                <Text style={styles.emptyText}>No tickets found</Text>
                <Text style={styles.emptySubtext}>
                  {activeFilter === 'in_progress' 
                    ? 'No active support tickets'
                    : activeFilter === 'pending'
                    ? 'No pending support tickets'
                    : searchQuery
                    ? `No tickets match "${searchQuery}"`
                    : `No ${activeFilter} tickets`
                  }
                </Text>
                {searchQuery && (
                  <TouchableOpacity
                    style={styles.clearSearchButton}
                    onPress={() => setSearchQuery('')}
                  >
                    <Text style={styles.clearSearchText}>Clear search</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            contentContainerStyle={tickets.length === 0 ? { flex: 1 } : undefined}
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
    case 'assigned': return '#3b82f6';
    case 'in_progress': return '#8b5cf6';
    case 'resolved': return '#10b981';
    case 'closed': return '#6b7280';
    default: return '#8b5cf6';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return '#dc2626';
    case 'high': return '#f97316';
    case 'normal': return '#6b7280';
    case 'low': return '#10b981';
    default: return '#6b7280';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    paddingTop: 28,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: '#E1BEE7',
    fontSize: 16,
    fontWeight: '500',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 4,
  },
  connectedText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
  },
  headerDescription: {
    color: '#C1A7C9',
    fontSize: 14,
    opacity: 0.9,
  },
  statsToggleButton: {
    padding: 8,
    marginRight: 8,
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  statsContainer: {
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    paddingVertical: 12,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 4,
  },
  liveText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#E1BEE7',
    fontSize: 12,
    marginTop: 4,
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
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(249, 115, 22, 0.2)',
  },
  connectionBannerText: {
    color: '#f97316',
    fontSize: 14,
    marginLeft: 8,
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
    marginLeft: 6,
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
  filterPillBadgeLive: {
    backgroundColor: '#10b981',
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
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  realtimeIndicator: {
    marginLeft: 6,
  },
  realtimeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
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
  unreadBadgeLive: {
    backgroundColor: '#10b981',
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
    marginBottom: 4,
  },
  ticketLeftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketRightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketId: {
    color: '#8E8E93',
    fontSize: 12,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  quickAssignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(123, 63, 152, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  quickAssignText: {
    color: '#7B3F98',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
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
  assignedAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  assignedAgentText: {
    color: '#8E8E93',
    fontSize: 12,
    marginLeft: 4,
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
  clearSearchButton: {
    backgroundColor: '#7B3F98',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 16,
  },
  clearSearchText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
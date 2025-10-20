// app/(support)/index.tsx - FIXED: All improvements implemented
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
  Platform,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useUser } from '../../context/UserContext';
import api from '../../lib/api';
import ActionCableService from '../../lib/services/ActionCableService';
import { accountManager } from '../../lib/AccountManager';
import { SupportBottomTabs } from '../../components/support/SupportBottomTabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from '../../config/firebase';

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
  typing_user?: {
    id: string;
    name: string;
  };
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

const BACKGROUND_SYNC_INTERVAL = 30000; // 30 seconds
const MIN_SYNC_INTERVAL = 30000; // Minimum 30 seconds between syncs

// ============= HELPER FUNCTION FOR ID NORMALIZATION =============
const normalizeId = (id: any): string => String(id);

export default function SupportDashboard() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('in_progress');
  const [showStats, setShowStats] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [fcmToken, setFcmToken] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Map<string, { id: string; name: string }>>(new Map());

  const unsubscribeOnMessage = useRef<(() => void) | null>(null);
  const unsubscribeOnNotificationOpenedApp = useRef<(() => void) | null>(null);
  const unsubscribeTokenRefresh = useRef<(() => void) | null>(null);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const appState = useRef(AppState.currentState);
  const backgroundSyncInterval = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTime = useRef<number>(Date.now());
  const isSyncing = useRef<boolean>(false);
  const processingTickets = useRef<Set<string>>(new Set());
  const syncFailureCount = useRef<number>(0);

  // ============= APP STATE MANAGEMENT =============
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [isConnected]);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App came to foreground - syncing dashboard');
      
      if (!isConnected) {
        await setupActionCableConnection();
      }
      
      // Sync data that might have changed while app was in background
      const timeSinceLastSync = Date.now() - lastSyncTime.current;
      if (timeSinceLastSync > MIN_SYNC_INTERVAL) {
        await Promise.all([
          loadTickets(true),
          loadDashboardData(),
        ]);
      }
      
      // Resume background sync
      if (backgroundSyncInterval.current) {
        clearInterval(backgroundSyncInterval.current);
      }
      backgroundSyncInterval.current = setInterval(backgroundSync, BACKGROUND_SYNC_INTERVAL);
      
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('📱 App went to background');
      
      // Clear background sync
      if (backgroundSyncInterval.current) {
        clearInterval(backgroundSyncInterval.current);
        backgroundSyncInterval.current = null;
      }
      
      if (isConnected) {
        const actionCable = ActionCableService.getInstance();
        await actionCable.updatePresence('away');
      }
    }
    
    appState.current = nextAppState;
  }, [isConnected]);

  const backgroundSync = useCallback(async () => {
    if (appState.current !== 'active') return;
    if (isSyncing.current) return; // Prevent concurrent syncs
    
    const timeSinceLastSync = Date.now() - lastSyncTime.current;
    if (timeSinceLastSync < MIN_SYNC_INTERVAL) return;
    
    try {
      isSyncing.current = true;
      console.log('🔄 Background sync triggered');
      
      const response = await api.get('/api/v1/support/my_tickets', {
        params: {
          limit: 50,
          page: 1,
          status: activeFilter !== 'all' ? activeFilter : undefined,
        },
        timeout: 10000,
      });

      if (response.data.success) {
        const newTickets = response.data.data.tickets || [];
        
        // Normalize all ticket IDs
        const normalizedTickets = newTickets.map((ticket: SupportTicket) => ({
          ...ticket,
          id: normalizeId(ticket.id),
        }));
        
        // Update tickets while preserving typing indicators
        setTickets(prev => {
          const updatedTickets = normalizedTickets.map((newTicket: SupportTicket) => {
            const existingTicket = prev.find(t => t.id === newTicket.id);
            return existingTicket?.typing_user 
              ? { ...newTicket, typing_user: existingTicket.typing_user }
              : newTicket;
          });
          return updatedTickets;
        });
        
        lastSyncTime.current = Date.now();
        syncFailureCount.current = 0; // Reset failure count on success
      }
    } catch (error) {
      console.error('Background sync failed:', error);
      syncFailureCount.current++;
      
      // Exponential backoff on repeated failures
      if (syncFailureCount.current > 3 && backgroundSyncInterval.current) {
        clearInterval(backgroundSyncInterval.current);
        const backoffDelay = Math.min(BACKGROUND_SYNC_INTERVAL * Math.pow(2, syncFailureCount.current - 3), 300000);
        backgroundSyncInterval.current = setInterval(backgroundSync, backoffDelay);
      }
    } finally {
      isSyncing.current = false;
    }
  }, [activeFilter]);

  // ============= FIREBASE MESSAGING =============
  
  useEffect(() => {
    setupFirebaseMessaging();
    
    return () => {
      if (unsubscribeOnMessage.current) unsubscribeOnMessage.current();
      if (unsubscribeOnNotificationOpenedApp.current) unsubscribeOnNotificationOpenedApp.current();
      if (unsubscribeTokenRefresh.current) unsubscribeTokenRefresh.current();
    };
  }, []);

  const setupFirebaseMessaging = async () => {
    try {
      console.log('🔥 SETTING UP FIREBASE MESSAGING FOR SUPPORT DASHBOARD...');
      
      if (!firebase.isNative || !firebase.messaging()) {
        console.log('🔥 Skipping Firebase messaging setup - not native or messaging unavailable');
        return;
      }

      const permissionGranted = await requestFirebasePermissions();
      if (!permissionGranted) return;

      await getFirebaseToken();
      setupFirebaseListeners();
      handleInitialNotification();
      
      console.log('✅ FIREBASE MESSAGING SETUP COMPLETE FOR SUPPORT');
      
    } catch (error) {
      console.error('❌ FAILED TO SETUP FIREBASE MESSAGING:', error);
    }
  };

  const requestFirebasePermissions = async (): Promise<boolean> => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return false;
      
      const authStatus = await messaging.requestPermission();
      const enabled = authStatus === 1 || authStatus === 2;

      if (enabled) {
        console.log('✅ FIREBASE AUTHORIZATION STATUS:', authStatus);
        return true;
      } else {
        console.log('❌ FIREBASE PERMISSIONS DENIED');
        Alert.alert(
          'Notifications Required',
          'GLT Support needs notification permissions to send you important updates about support tickets.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
    } catch (error) {
      console.error('❌ ERROR REQUESTING FIREBASE PERMISSIONS:', error);
      return false;
    }
  };

  const getFirebaseToken = async () => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return;
      
      const token = await messaging.getToken();
      console.log('🔥 FCM TOKEN RECEIVED:', token?.substring(0, 50) + '...');
      setFcmToken(token);

      await registerFCMTokenWithBackend(token);
      
      unsubscribeTokenRefresh.current = messaging.onTokenRefresh(async (newToken) => {
        console.log('🔥 FCM TOKEN REFRESHED:', newToken?.substring(0, 50) + '...');
        setFcmToken(newToken);
        await registerFCMTokenWithBackend(newToken);
      });
      
    } catch (error) {
      console.error('❌ DETAILED FCM TOKEN ERROR:', error);
    }
  };

  const registerFCMTokenWithBackend = async (token: string) => {
    try {
      console.log('🔥 REGISTERING FCM TOKEN WITH BACKEND...');
      
      const response = await api.post('/api/v1/push_tokens', {
        push_token: token,
        platform: 'fcm',
        device_info: {
          platform: Platform.OS,
          version: Platform.Version,
          isDevice: true,
          deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
        }
      });
      
      if (response.data?.success) {
        console.log('✅ FCM TOKEN REGISTERED SUCCESSFULLY');
        await AsyncStorage.setItem('fcm_token', token);
        await AsyncStorage.setItem('fcm_token_registered', 'true');
      }
      
    } catch (error: any) {
      console.error('❌ FCM TOKEN BACKEND REGISTRATION FAILED:', error.response?.data || error);
    }
  };

  const setupFirebaseListeners = () => {
    const messaging = firebase.messaging();
    if (!messaging) return;

    unsubscribeOnMessage.current = messaging.onMessage(async (remoteMessage) => {
      console.log('🔥 FOREGROUND MESSAGE RECEIVED IN SUPPORT:', remoteMessage);
      
      // Silently refresh data without showing alert
      loadTickets(true);
      loadDashboardData();
    });

    unsubscribeOnNotificationOpenedApp.current = messaging.onNotificationOpenedApp((remoteMessage) => {
      console.log('🔥 NOTIFICATION OPENED APP FROM BACKGROUND:', remoteMessage);
      handleNotificationData(remoteMessage.data);
    });
  };

  const handleInitialNotification = async () => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return;

      const initialNotification = await messaging.getInitialNotification();
      
      if (initialNotification) {
        console.log('🔥 APP OPENED BY NOTIFICATION (FROM KILLED STATE):', initialNotification);
        setTimeout(() => {
          handleNotificationData(initialNotification.data);
        }, 2000);
      }
    } catch (error) {
      console.error('🔥 ERROR HANDLING INITIAL NOTIFICATION:', error);
    }
  };

  const handleNotificationData = async (data: any) => {
    console.log('🔥 HANDLING NOTIFICATION DATA IN SUPPORT:', data);
    
    try {
      if (data?.conversation_id) {
        router.push(`/(support)/chat/${normalizeId(data.conversation_id)}`);
      } else if (data?.ticket_id) {
        const ticket = tickets.find(t => t.ticket_id === data.ticket_id);
        if (ticket) {
          router.push(`/(support)/chat/${normalizeId(ticket.id)}`);
        }
      }
    } catch (error) {
      console.error('🔥 ERROR HANDLING NOTIFICATION DATA:', error);
    }
  };

  // ============= ACTIONCABLE SETUP =============
  
  const setupActionCableConnection = useCallback(async () => {
    try {
      if (!user) {
        console.log('📡 No user available for ActionCable connection');
        return;
      }

      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) {
        console.log('📡 No account available for ActionCable connection');
        return;
      }

      console.log('📡 Setting up ActionCable connection for support dashboard...');

      const actionCable = ActionCableService.getInstance();
      
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];
      
      const connected = await actionCable.connect({
        token: currentAccount.token,
        userId: normalizeId(currentAccount.id),
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        setupActionCableSubscriptions();
        
        // Start background sync
        if (backgroundSyncInterval.current) {
          clearInterval(backgroundSyncInterval.current);
        }
        backgroundSyncInterval.current = setInterval(backgroundSync, BACKGROUND_SYNC_INTERVAL);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('❌ Failed to setup ActionCable connection:', error);
      setIsConnected(false);
    }
  }, [user, backgroundSync]);

  const setupActionCableSubscriptions = () => {
    console.log('📡 Setting up ActionCable subscriptions for support dashboard...');

    const actionCable = ActionCableService.getInstance();

    // Connection status
    const unsubConnected = actionCable.subscribe('connection_established', () => {
      console.log('📡 ActionCable connected');
      setIsConnected(true);
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      console.log('📡 ActionCable disconnected');
      setIsConnected(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    // Dashboard stats updates
    const unsubInitialState = actionCable.subscribe('initial_state', (data) => {
      console.log('📊 Received initial state via ActionCable:', data);
      if (data.dashboard_stats) {
        setDashboardStats(data.dashboard_stats);
      }
      if (data.agent_stats) {
        setAgentStats(data.agent_stats);
      }
    });
    actionCableSubscriptions.current.push(unsubInitialState);

    const unsubDashboardStats = actionCable.subscribe('dashboard_stats_update', (data) => {
      console.log('📊 Dashboard stats update received:', data);
      if (data.stats) {
        setDashboardStats(prev => ({
          ...(prev || {
            total_tickets: 0,
            pending_tickets: 0,
            in_progress_tickets: 0,
            resolved_today: 0,
            avg_response_time: '0m',
            satisfaction_score: 0,
            tickets_by_priority: { high: 0, normal: 0, low: 0 }
          }),
          ...data.stats
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubDashboardStats);

    // Ticket updates
    const unsubNewTicket = actionCable.subscribe('new_support_ticket', (data) => {
      console.log('🎫 New support ticket:', data);
      if (data.ticket) {
        const normalizedTicket = {
          ...data.ticket,
          id: normalizeId(data.ticket.id),
        };
        setTickets(prev => [normalizedTicket, ...prev]);
        loadDashboardData();
      }
    });
    actionCableSubscriptions.current.push(unsubNewTicket);

    const unsubTicketStatus = actionCable.subscribe('ticket_status_update', (data) => {
      console.log('🎫 Ticket status update:', data);
      if (data.ticket_id && data.status) {
        const normalizedTicketId = normalizeId(data.ticket_id);
        setTickets(prev => prev.map(ticket => 
          ticket.id === normalizedTicketId 
            ? { ...ticket, status: data.status, last_activity_at: new Date().toISOString() }
            : ticket
        ));
        loadDashboardData();
      }
    });
    actionCableSubscriptions.current.push(unsubTicketStatus);

    // New message with enhanced deduplication
    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      console.log('📨 New message received:', data);
      if (data.conversation_id && data.message) {
        const normalizedConversationId = normalizeId(data.conversation_id);
        
        // Check if we're already processing this update
        if (processingTickets.current.has(normalizedConversationId)) {
          console.log('Skipping message update - already processing:', normalizedConversationId);
          return;
        }
        
        processingTickets.current.add(normalizedConversationId);
        
        setTickets(prev => {
          const updatedTickets = prev.map(ticket => {
            if (ticket.id === normalizedConversationId) {
              const updatedTicket = { ...ticket };
              updatedTicket.last_message = {
                content: data.message.content,
                created_at: data.message.created_at,
                from_support: data.message.from_support
              };
              updatedTicket.last_activity_at = data.message.created_at;
              
              // Only increment unread if it's a customer message
              if (!data.message.from_support) {
                updatedTicket.unread_count = (updatedTicket.unread_count || 0) + 1;
              }
              
              updatedTicket.message_count = (updatedTicket.message_count || 0) + 1;
              
              // Clear typing indicator when message is sent
              if (updatedTicket.typing_user && updatedTicket.typing_user.id === data.message.user?.id) {
                delete updatedTicket.typing_user;
              }
              
              return updatedTicket;
            }
            return ticket;
          });
          
          // Move updated ticket to top
          const ticket = updatedTickets.find(t => t.id === normalizedConversationId);
          if (ticket) {
            const others = updatedTickets.filter(t => t.id !== normalizedConversationId);
            
            // Clear processing flag after a delay
            setTimeout(() => {
              processingTickets.current.delete(normalizedConversationId);
            }, 1000);
            
            return [ticket, ...others];
          }
          
          // Clear processing flag
          setTimeout(() => {
            processingTickets.current.delete(normalizedConversationId);
          }, 1000);
          
          return updatedTickets;
        });
      }
    });
    actionCableSubscriptions.current.push(unsubNewMessage);

    // Typing indicator
    const unsubTyping = actionCable.subscribe('typing_indicator', (data) => {
      console.log('⌨️ Typing indicator:', data);
      if (data.conversation_id && data.user_id !== user?.id) {
        const normalizedConversationId = normalizeId(data.conversation_id);
        setTickets(prev => prev.map(ticket => {
          if (ticket.id === normalizedConversationId) {
            if (data.typing) {
              return {
                ...ticket,
                typing_user: {
                  id: normalizeId(data.user_id),
                  name: data.user_name
                }
              };
            } else {
              const { typing_user, ...rest } = ticket;
              return rest;
            }
          }
          return ticket;
        }));
        
        // Also update local typing users map
        if (data.typing) {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.set(normalizedConversationId, { 
              id: normalizeId(data.user_id), 
              name: data.user_name 
            });
            return newMap;
          });
        } else {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(normalizedConversationId);
            return newMap;
          });
        }
      }
    });
    actionCableSubscriptions.current.push(unsubTyping);

    // Message read
    const unsubRead = actionCable.subscribe('conversation_read', (data) => {
      console.log('📖 Conversation read:', data);
      if (data.conversation_id && data.reader_id === normalizeId(user?.id)) {
        const normalizedConversationId = normalizeId(data.conversation_id);
        setTickets(prev => prev.map(ticket => 
          ticket.id === normalizedConversationId 
            ? { ...ticket, unread_count: 0 }
            : ticket
        ));
      }
    });
    actionCableSubscriptions.current.push(unsubRead);

    const unsubAgentAssignment = actionCable.subscribe('agent_assignment_update', (data) => {
      console.log('👤 Agent assignment update:', data);
      if (data.ticket_id && data.agent) {
        const normalizedTicketId = normalizeId(data.ticket_id);
        setTickets(prev => prev.map(ticket => 
          ticket.id === normalizedTicketId 
            ? { ...ticket, assigned_agent: data.agent, status: 'assigned' }
            : ticket
        ));
      }
    });
    actionCableSubscriptions.current.push(unsubAgentAssignment);

    const unsubTicketEscalated = actionCable.subscribe('ticket_escalated', (data) => {
      console.log('🚨 Ticket escalated:', data);
      if (data.ticket_id) {
        const normalizedTicketId = normalizeId(data.ticket_id);
        setTickets(prev => prev.map(ticket => 
          ticket.id === normalizedTicketId 
            ? { ...ticket, escalated: true, priority: 'high' }
            : ticket
        ));
      }
    });
    actionCableSubscriptions.current.push(unsubTicketEscalated);

    console.log('✅ ActionCable subscriptions configured for support dashboard');
  };

  // ============= DATA LOADING =============
  
  const loadDashboardData = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/support/dashboard');
      if (response.data.success) {
        const stats = response.data.data.stats;
        const agentPerformance = response.data.data.agent_performance;
        
        setDashboardStats(prev => ({
          ...(prev || {
            total_tickets: 0,
            pending_tickets: 0,
            in_progress_tickets: 0,
            resolved_today: 0,
            avg_response_time: '0m',
            satisfaction_score: 0,
            tickets_by_priority: { high: 0, normal: 0, low: 0 }
          }),
          ...stats
        }));
        
        setAgentStats(agentPerformance);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  }, []);

  const loadTickets = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

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
        const newTickets = response.data.data.tickets || [];
        
        // Normalize all ticket IDs
        const normalizedTickets = newTickets.map((ticket: SupportTicket) => ({
          ...ticket,
          id: normalizeId(ticket.id),
        }));
        
        // Preserve typing indicators from current state
        setTickets(prevTickets => {
          return normalizedTickets.map((newTicket: SupportTicket) => {
            const existingTicket = prevTickets.find(t => t.id === newTicket.id);
            return existingTicket?.typing_user 
              ? { ...newTicket, typing_user: existingTicket.typing_user }
              : newTicket;
          });
        });
        
        lastSyncTime.current = Date.now();
      }
    } catch (error) {
      console.error('Failed to load support tickets:', error);
      Alert.alert('Error', 'Failed to load support tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    setupActionCableConnection();
    
    return () => {
      actionCableSubscriptions.current.forEach(unsub => {
        if (unsub) unsub();
      });
      actionCableSubscriptions.current = [];
      
      if (backgroundSyncInterval.current) {
        clearInterval(backgroundSyncInterval.current);
        backgroundSyncInterval.current = null;
      }
    };
  }, [setupActionCableConnection]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // ============= ACTIONS =============
  
  const handleQuickAssign = async (ticketId: string) => {
    try {
      const normalizedTicketId = normalizeId(ticketId);
      const response = await api.post(`/api/v1/support/tickets/${normalizedTicketId}/assign`, {
        agent_id: normalizeId(user?.id)
      });
      
      if (response.data.success) {
        setTickets(prev => prev.map(ticket => 
          ticket.id === normalizedTicketId 
            ? { 
                ...ticket, 
                assigned_agent: { 
                  id: normalizeId(user?.id) || '', 
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
      loadTickets();
    }
  };

  const handleTicketRead = useCallback(async (ticketId: string) => {
    try {
      const normalizedTicketId = normalizeId(ticketId);
      
      // Optimistically clear unread count
      setTickets(prev => prev.map(ticket => 
        ticket.id === normalizedTicketId 
          ? { ...ticket, unread_count: 0 }
          : ticket
      ));

      const actionCable = ActionCableService.getInstance();
      await actionCable.markMessageRead(normalizedTicketId);
      
    } catch (error) {
      console.error('Failed to mark ticket as read:', error);
    }
  }, []);

  // ============= COMPUTED VALUES =============
  
  const statusCounts = {
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    all: tickets.length,
    assigned: tickets.filter(t => t.status === 'assigned').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  // ============= RENDER FUNCTIONS =============
  
  const renderStatsOverview = () => {
    if (!dashboardStats || !showStats) return null;

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
            <Text style={styles.statNumber}>{dashboardStats.total_tickets || 0}</Text>
            <Text style={styles.statLabel}>Total Tickets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.pending_tickets || 0}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.in_progress_tickets || 0}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.resolved_today || 0}</Text>
            <Text style={styles.statLabel}>Resolved Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboardStats.avg_response_time || '0m'}</Text>
            <Text style={styles.statLabel}>Avg Response</Text>
          </View>
          {agentStats && (
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{agentStats.active_tickets || 0}</Text>
              <Text style={styles.statLabel}>My Active</Text>
            </View>
          )}
          {dashboardStats.satisfaction_score !== undefined && (
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{(dashboardStats.satisfaction_score || 0).toFixed(1)}</Text>
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
        handleTicketRead(item.id);
        router.push(`/(support)/chat/${normalizeId(item.id)}`);
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
              {item.typing_user ? (
                <Text style={styles.typingIndicator} numberOfLines={1}>
                  {item.typing_user.name} is typing...
                </Text>
              ) : (
                <Text style={styles.ticketPreview} numberOfLines={1}>
                  {item.last_message?.content || 'No messages yet'}
                </Text>
              )}
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
              {dashboardStats ? `${dashboardStats.pending_tickets || 0} pending • ${dashboardStats.total_tickets || 0} total tickets` : 'Loading dashboard...'}
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

      {renderStatsOverview()}

      {!isConnected && (
        <View style={styles.connectionBanner}>
          <MaterialIcons name="wifi-off" size={16} color="#f97316" />
          <Text style={styles.connectionBannerText}>
            Real-time updates unavailable. Reconnecting...
          </Text>
        </View>
      )}

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
              {statusCounts[item.key as keyof typeof statusCounts] > 0 && (
                <View style={[
                  styles.filterPillBadge,
                  isConnected && styles.filterPillBadgeLive
                ]}>
                  <Text style={styles.filterPillBadgeText}>
                    {statusCounts[item.key as keyof typeof statusCounts]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7B3F98" />
            <Text style={styles.loadingText}>Loading support tickets...</Text>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item, index) => `${item.id}-${index}`}
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

      <SupportBottomTabs currentTab="chats" />
    </SafeAreaView>
  );
}

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
  container: { flex: 1, backgroundColor: '#111B21' },
  header: { paddingTop: 28, paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  headerSubtitle: { color: '#E1BEE7', fontSize: 16, fontWeight: '500' },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 4 },
  connectedText: { color: '#10b981', fontSize: 10, fontWeight: '600' },
  headerDescription: { color: '#C1A7C9', fontSize: 14, opacity: 0.9 },
  statsToggleButton: { padding: 8, marginRight: 8 },
  headerAvatar: { width: 50, height: 50, borderRadius: 25 },
  statsContainer: { backgroundColor: 'rgba(123, 63, 152, 0.1)', paddingVertical: 12 },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  statsTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 4 },
  liveText: { color: '#10b981', fontSize: 10, fontWeight: '600' },
  statCard: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 12, alignItems: 'center', minWidth: 80 },
  statNumber: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#E1BEE7', fontSize: 12, marginTop: 4 },
  connectionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249, 115, 22, 0.1)', paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(249, 115, 22, 0.2)' },
  connectionBannerText: { color: '#f97316', fontSize: 14, marginLeft: 8 },
  searchContainer: { padding: 16 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2C34', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 8 },
  filtersContainer: { paddingHorizontal: 16, marginBottom: 8 },
  filterPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  filterPillActive: { backgroundColor: '#7B3F98' },
  filterPillText: { color: '#8E8E93', fontSize: 14, fontWeight: '500', marginLeft: 6 },
  filterPillTextActive: { color: '#fff' },
  filterPillBadge: { backgroundColor: '#E1BEE7', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  filterPillBadgeLive: { backgroundColor: '#10b981' },
  filterPillBadgeText: { color: '#7B3F98', fontSize: 12, fontWeight: '600' },
  listContainer: { flex: 1 },
  ticketItem: { backgroundColor: '#1F2C34', marginHorizontal: 8, marginVertical: 2, borderRadius: 8 },
  ticketContent: { padding: 12 },
  ticketHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  customerAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  ticketInfo: { flex: 1 },
  ticketTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  customerName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center' },
  ticketTime: { color: '#8E8E93', fontSize: 12 },
  realtimeIndicator: { marginLeft: 6 },
  realtimeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  ticketSubtitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ticketPreview: { color: '#B8B8B8', fontSize: 14, flex: 1 },
  typingIndicator: { color: '#4FC3F7', fontSize: 14, flex: 1, fontStyle: 'italic' },
  unreadBadge: { backgroundColor: '#7B3F98', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  unreadBadgeLive: { backgroundColor: '#10b981' },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  ticketMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticketLeftMeta: { flexDirection: 'row', alignItems: 'center' },
  ticketRightMeta: { flexDirection: 'row', alignItems: 'center' },
  ticketId: { color: '#8E8E93', fontSize: 12, marginRight: 8 },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  priorityText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  quickAssignButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(123, 63, 152, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  quickAssignText: { color: '#7B3F98', fontSize: 10, fontWeight: '600', marginLeft: 4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  assignedAgentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  assignedAgentText: { color: '#8E8E93', fontSize: 12, marginLeft: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  loadingText: { color: '#8E8E93', fontSize: 16, marginTop: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#8E8E93', fontSize: 14, marginTop: 8, textAlign: 'center' },
  clearSearchButton: { backgroundColor: '#7B3F98', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginTop: 16 },
  clearSearchText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
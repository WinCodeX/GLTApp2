// app/(drawer)/support.tsx - FULLY FIXED with all improvements
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
  Modal,
  Animated,
  Dimensions,
  BackHandler,
  ActivityIndicator,
  RefreshControl,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  Feather,
  MaterialIcons,
} from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import api from '../../lib/api';
import ActionCableService from '../../lib/services/ActionCableService';
import { useUser } from '../../context/UserContext';
import { accountManager } from '../../lib/AccountManager';
import { NavigationHelper } from '../../lib/helpers/navigation';
import ChatCacheManager, { CachedMessage } from '../../lib/cache/ChatCacheManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INITIAL_MESSAGE_LIMIT = 20;
const PAGINATION_LIMIT = 15;
const REQUEST_TIMEOUT = 20000;
const SCROLL_THRESHOLD = 0.1;
const CACHE_STALE_TIME = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [5000, 15000, 30000];
const SCROLL_BUTTON_THRESHOLD = 200;

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isSupport: boolean;
  type?: 'text' | 'voice' | 'system';
  duration?: string;
  packageCode?: string;
  isTagged?: boolean;
  optimistic?: boolean;
  tempId?: string;
  delivered_at?: string | null;
  read_at?: string | null;
  sendStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  retryCount?: number;
  created_at?: string;
}

interface Package {
  id: string;
  code: string;
  state: string;
  state_display: string;
  receiver_name: string;
  route_description: string;
  cost: number;
  delivery_type: string;
  created_at: string;
}

interface AgentPresence {
  status: 'online' | 'offline' | 'away';
  last_seen?: string;
  is_typing?: boolean;
}

type InquiryType = 'basic' | 'package';

export default function SupportScreen() {
  const params = useLocalSearchParams();
  const { user } = useUser();
  
  const autoSelectPackage = params.autoSelectPackage === 'true';
  const preFilledPackageCode = params.packageCode as string;
  const preFilledPackageId = params.packageId as string;

  const handleGoBack = useCallback(() => {
    NavigationHelper.goBack({
      fallbackRoute: '/(tabs)',
      replaceIfNoHistory: true
    });
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<'none' | 'pending' | 'active' | 'closed'>('none');
  const [hasActiveTicket, setHasActiveTicket] = useState(false);
  
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [agentPresence, setAgentPresence] = useState<AgentPresence>({
    status: 'offline',
  });
  
  // Scroll management
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [packageInquiry, setPackageInquiry] = useState('');
  
  const [inquiryType, setInquiryType] = useState<InquiryType>(autoSelectPackage ? 'package' : 'basic');
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPackageSearch, setShowPackageSearch] = useState(false);
  const [userPackages, setUserPackages] = useState<Package[]>([]);
  const [packageSearchQuery, setPackageSearchQuery] = useState('');
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const cacheManager = useRef(ChatCacheManager.getInstance());
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const conversationLoadedRef = useRef(false);
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const appState = useRef(AppState.currentState);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const presenceCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const inputFieldEnabled = useRef(true);

  // Storage keys
  const STORAGE_KEYS = {
    conversationId: 'support_conversation_id',
    conversationData: 'support_conversation_data',
    conversationTimestamp: 'support_conversation_timestamp',
    messages: 'support_messages',
  };

  // ============= PERSISTENT STORAGE =============
  
  const saveConversationToStorage = useCallback(async (convId: string, messagesData: Message[]) => {
    try {
      const storageData = {
        conversationId: convId,
        messages: messagesData,
        timestamp: Date.now(),
        hasMoreMessages,
      };
      
      await AsyncStorage.setItem(STORAGE_KEYS.conversationData, JSON.stringify(storageData));
      await AsyncStorage.setItem(STORAGE_KEYS.conversationId, convId);
      console.log('✅ Conversation saved to persistent storage');
    } catch (error) {
      console.error('Failed to save conversation to storage:', error);
    }
  }, [hasMoreMessages]);

  const loadConversationFromStorage = useCallback(async (): Promise<boolean> => {
    try {
      const [storedId, storedData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.conversationId),
        AsyncStorage.getItem(STORAGE_KEYS.conversationData),
      ]);

      if (!storedId || !storedData) return false;

      const parsedData = JSON.parse(storedData);
      const dataAge = Date.now() - parsedData.timestamp;

      // Use stored data if it's less than 24 hours old
      if (dataAge < CACHE_STALE_TIME) {
        console.log('📦 Loading conversation from persistent storage');
        setConversationId(storedId);
        setMessages(parsedData.messages || []);
        setHasMoreMessages(parsedData.hasMoreMessages ?? true);
        setHasActiveTicket(true);
        conversationLoadedRef.current = true;
        
        // Rebuild message IDs set
        messageIdsRef.current.clear();
        (parsedData.messages || []).forEach((msg: Message) => {
          messageIdsRef.current.add(msg.id);
        });
        
        return true;
      } else {
        // Clear stale data
        await clearStoredConversation();
        return false;
      }
    } catch (error) {
      console.error('Failed to load conversation from storage:', error);
      return false;
    }
  }, []);

  const clearStoredConversation = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.conversationId,
        STORAGE_KEYS.conversationData,
        STORAGE_KEYS.conversationTimestamp,
        STORAGE_KEYS.messages,
      ]);
      conversationLoadedRef.current = false;
      console.log('✅ Cleared stored conversation');
    } catch (error) {
      console.error('Failed to clear stored conversation:', error);
    }
  }, []);

  // ============= APP STATE MANAGEMENT =============
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [conversationId, isConnected]);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App came to foreground');
      
      // Re-enable input field
      inputFieldEnabled.current = true;
      
      // Reconnect if needed
      if (!isConnected && conversationId) {
        await reconnectActionCable();
      }
      
      // Request fresh agent presence
      if (conversationId) {
        await requestAgentPresence();
      }
      
      // Mark messages as read
      if (conversationId) {
        await markMessagesAsReadIfVisible();
      }
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('📱 App went to background');
      
      // Save current state to storage
      if (conversationId && messages.length > 0) {
        await saveConversationToStorage(conversationId, messages);
      }
      
      // Update presence to away
      if (isConnected) {
        const actionCable = ActionCableService.getInstance();
        await actionCable.updatePresence('away');
      }
    }
    
    appState.current = nextAppState;
  }, [conversationId, isConnected, messages, saveConversationToStorage]);

  const reconnectActionCable = useCallback(async () => {
    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount || !user) return;

      const actionCable = ActionCableService.getInstance();
      const connected = await actionCable.connect({
        token: currentAccount.token,
        userId: user.id,
        autoReconnect: true,
      });

      if (connected && conversationId) {
        await actionCable.joinConversation(conversationId);
        setupActionCableSubscriptions();
      }
    } catch (error) {
      console.error('Failed to reconnect ActionCable:', error);
    }
  }, [conversationId, user]);

  // ============= AGENT PRESENCE TRACKING =============
  
  const requestAgentPresence = useCallback(async () => {
    if (!conversationId || !isConnected) return;

    try {
      const actionCable = ActionCableService.getInstance();
      await actionCable.perform('get_user_presence', {
        conversation_id: conversationId,
      });
    } catch (error) {
      console.error('Failed to request agent presence:', error);
    }
  }, [conversationId, isConnected]);

  const startPresencePolling = useCallback(() => {
    if (presenceCheckInterval.current) {
      clearInterval(presenceCheckInterval.current);
    }

    presenceCheckInterval.current = setInterval(() => {
      if (conversationId && isConnected) {
        requestAgentPresence();
      }
    }, 30000); // Check every 30 seconds
  }, [conversationId, isConnected, requestAgentPresence]);

  useEffect(() => {
    if (isConnected && conversationId) {
      startPresencePolling();
    }

    return () => {
      if (presenceCheckInterval.current) {
        clearInterval(presenceCheckInterval.current);
      }
    };
  }, [isConnected, conversationId, startPresencePolling]);

  // ============= INITIALIZATION =============
  
  useEffect(() => {
    const initialize = async () => {
      // Try to load from storage first
      const loaded = await loadConversationFromStorage();
      
      if (loaded) {
        setLoadingMessages(false);
        setIsInitialLoad(false);
        
        // Connect ActionCable for real-time updates
        if (conversationId) {
          await setupActionCableConnection();
        }
      } else {
        // No stored data, check for active ticket
        await checkActiveTicket();
      }
    };

    initialize();
  }, []);

  // ============= ACTIONCABLE SETUP =============
  
  const setupActionCableConnection = useCallback(async () => {
    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount || !user) return;

      const actionCable = ActionCableService.getInstance();
      
      const connected = await actionCable.connect({
        token: currentAccount.token,
        userId: user.id,
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        console.log('✅ ActionCable connected');

        if (conversationId) {
          await actionCable.joinConversation(conversationId);
          setupActionCableSubscriptions();
          await requestAgentPresence();
        }
      }
    } catch (error) {
      console.error('Failed to setup ActionCable:', error);
      setIsConnected(false);
    }
  }, [conversationId, user]);

  const setupActionCableSubscriptions = useCallback(() => {
    if (!conversationId) return;

    const actionCable = ActionCableService.getInstance();
    
    // Clear existing subscriptions
    actionCableSubscriptions.current.forEach(unsub => unsub());
    actionCableSubscriptions.current = [];

    // New message
    const unsubNewMessage = actionCable.subscribe('new_message', async (data) => {
      if (data.conversation_id !== conversationId || !data.message) return;
      
      const messageData = data.message;
      const messageId = String(messageData.id);
      
      // Skip if we already have this message
      if (messageIdsRef.current.has(messageId)) {
        console.log('Skipping duplicate message:', messageId);
        return;
      }
      
      // If this is the confirmation of our optimistic message
      if (messageData.temp_id) {
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.tempId !== messageData.temp_id);
          const newMessage: Message = {
            id: messageId,
            text: messageData.content || '',
            timestamp: new Date(messageData.created_at).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            }),
            isSupport: messageData.from_support || false,
            type: messageData.message_type || 'text',
            delivered_at: messageData.delivered_at,
            read_at: messageData.read_at,
            sendStatus: 'sent',
            created_at: messageData.created_at,
          };
          
          messageIdsRef.current.add(messageId);
          const updated = [...filtered, newMessage];
          
          // Save to storage
          saveConversationToStorage(conversationId, updated);
          
          return updated;
        });
      } else {
        // New message from agent
        const newMessage: Message = {
          id: messageId,
          text: messageData.content || '',
          timestamp: new Date(messageData.created_at).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          }),
          isSupport: messageData.from_support || false,
          type: messageData.message_type || 'text',
          delivered_at: messageData.delivered_at,
          read_at: messageData.read_at,
          sendStatus: 'sent',
          created_at: messageData.created_at,
        };
        
        messageIdsRef.current.add(messageId);
        
        setMessages(prev => {
          const updated = [...prev, newMessage];
          saveConversationToStorage(conversationId, updated);
          return updated;
        });
        
        // Auto-scroll if near bottom
        if (isNearBottom) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } else {
          setUnreadCount(prev => prev + 1);
        }
        
        // Auto-mark as read if visible
        if (appState.current === 'active') {
          setTimeout(() => markMessagesAsReadIfVisible(), 500);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubNewMessage);

    // Typing indicator
    const unsubTyping = actionCable.subscribe('typing_indicator', (data) => {
      if (data.conversation_id === conversationId && data.user_id !== user?.id) {
        setAgentPresence(prev => ({
          ...prev,
          is_typing: data.typing,
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubTyping);

    // User presence
    const unsubPresence = actionCable.subscribe('user_presence_changed', (data) => {
      if (data.conversation_id === conversationId && data.user_id !== user?.id) {
        console.log('👤 Agent presence update:', data);
        setAgentPresence({
          status: data.status as 'online' | 'offline' | 'away',
          last_seen: data.last_seen || data.last_seen_at,
          is_typing: false,
        });
      }
    });
    actionCableSubscriptions.current.push(unsubPresence);

    // Get user presence response
    const unsubPresenceData = actionCable.subscribe('users_presence_data', (data) => {
      if (data.presence_data && Array.isArray(data.presence_data)) {
        const agentData = data.presence_data.find((p: any) => p.user_id !== user?.id);
        if (agentData) {
          console.log('👤 Agent presence data received:', agentData);
          setAgentPresence({
            status: agentData.status || 'offline',
            last_seen: agentData.last_seen_at,
            is_typing: false,
          });
        }
      }
    });
    actionCableSubscriptions.current.push(unsubPresenceData);

    // Connection events
    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
      inputFieldEnabled.current = true;
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    console.log('✅ ActionCable subscriptions configured');
  }, [conversationId, user, isNearBottom, saveConversationToStorage]);

  useEffect(() => {
    if (conversationId && user) {
      setupActionCableConnection();
    }

    return () => {
      if (conversationId && isConnected) {
        const actionCable = ActionCableService.getInstance();
        actionCable.leaveConversation(conversationId);
      }
      
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];
    };
  }, [conversationId, user]);

  // ============= AUTO MARK AS READ =============
  
  const markMessagesAsReadIfVisible = useCallback(async () => {
    if (!conversationId || !isConnected || appState.current !== 'active') return;

    try {
      const lastUnreadAgentMessage = messages
        .filter(msg => msg.isSupport && !msg.read_at && msg.id !== lastReadMessageIdRef.current)
        .pop();

      if (lastUnreadAgentMessage) {
        console.log('📖 Auto-marking messages as read');
        
        const actionCable = ActionCableService.getInstance();
        await actionCable.perform('mark_message_read', {
          conversation_id: conversationId,
        });
        
        lastReadMessageIdRef.current = lastUnreadAgentMessage.id;
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [conversationId, isConnected, messages]);

  // ============= MESSAGE LOADING =============
  
  const loadConversationMessages = useCallback(async (conversationId: string, isRefresh = false, loadOlder = false) => {
    try {
      // Skip loading if we've already loaded from storage
      if (!isRefresh && !loadOlder && conversationLoadedRef.current) {
        console.log('📦 Conversation already loaded, skipping API call');
        setLoadingMessages(false);
        setIsInitialLoad(false);
        return;
      }

      console.log(`🌐 Loading conversation from API: ${conversationId}`, { isRefresh, loadOlder });

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, REQUEST_TIMEOUT);

      if (isRefresh) {
        setRefreshing(true);
      } else if (loadOlder) {
        setLoadingOlder(true);
      } else {
        setLoadingMessages(true);
      }

      setConnectionError(false);

      const params: any = {
        limit: loadOlder ? PAGINATION_LIMIT : INITIAL_MESSAGE_LIMIT,
      };

      if (loadOlder && messages.length > 0) {
        const oldestMessage = messages[0];
        params.older_than = oldestMessage.id;
      }

      const response = await api.get(`/api/v1/conversations/${conversationId}`, {
        params,
        signal: abortControllerRef.current.signal,
        timeout: REQUEST_TIMEOUT,
      });

      clearTimeout(timeoutId);
      
      if (response.data.success && response.data.messages) {
        const apiMessages = response.data.messages;
        const pagination = response.data.pagination || {};

        const newMessages: Message[] = apiMessages.map((msg: any) => ({
          id: String(msg.id),
          text: msg.content,
          timestamp: new Date(msg.created_at).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          }),
          isSupport: msg.from_support,
          type: msg.message_type || 'text',
          packageCode: msg.metadata?.package_code,
          isTagged: !!msg.metadata?.package_code,
          delivered_at: msg.delivered_at,
          read_at: msg.read_at,
          sendStatus: msg.read_at ? 'read' : msg.delivered_at ? 'delivered' : 'sent',
          created_at: msg.created_at,
        }));

        if (isRefresh || !loadOlder) {
          setMessages(newMessages);
          messageIdsRef.current.clear();
          newMessages.forEach((msg: Message) => messageIdsRef.current.add(msg.id));
          
          // Save to storage
          await saveConversationToStorage(conversationId, newMessages);
        } else if (loadOlder) {
          setMessages(prev => {
            const combined = [...newMessages, ...prev];
            const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
            
            messageIdsRef.current.clear();
            unique.forEach(msg => messageIdsRef.current.add(msg.id));
            
            return unique;
          });
        }

        setHasMoreMessages(pagination.has_more || false);
        
        const conversationData = response.data.conversation;
        if (conversationData?.assigned_agent) {
          setTicketStatus('active');
          
          // Set initial agent presence
          if (conversationData.assigned_agent.presence) {
            setAgentPresence({
              status: conversationData.assigned_agent.presence.status || 'offline',
              last_seen: conversationData.assigned_agent.presence.last_seen,
            });
          }
        } else {
          setTicketStatus('pending');
        }

        if (conversationData?.package) {
          const conversationPackage = conversationData.package;
          setSelectedPackage({
            id: String(conversationPackage.id),
            code: conversationPackage.code,
            state: conversationPackage.state,
            state_display: conversationPackage.state_display,
            receiver_name: conversationPackage.receiver_name,
            route_description: conversationPackage.route_description,
            cost: conversationPackage.cost,
            delivery_type: conversationPackage.delivery_type || 'agent',
            created_at: conversationPackage.created_at || new Date().toISOString(),
          });
          setInquiryType('package');
        }

        conversationLoadedRef.current = true;
        setIsInitialLoad(false);
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Failed to load conversation:', error);
      setConnectionError(true);

      // If no messages loaded yet, show welcome message
      if (messages.length === 0) {
        const defaultMessage: Message = {
          id: '1',
          text: 'Hello! Welcome to our customer support. How can I help you today?',
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          }),
          isSupport: true,
          type: 'text',
        };
        setMessages([defaultMessage]);
        messageIdsRef.current.add('1');
      }
    } finally {
      setLoadingMessages(false);
      setLoadingOlder(false);
      setRefreshing(false);
    }
  }, [messages, saveConversationToStorage]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !conversationId || !hasMoreMessages) {
      return;
    }
    
    await loadConversationMessages(conversationId, false, true);
  }, [loadConversationMessages, conversationId, loadingOlder, hasMoreMessages]);

  const handleRefresh = useCallback(async () => {
    if (!conversationId) return;
    
    messageIdsRef.current.clear();
    conversationLoadedRef.current = false;
    await clearStoredConversation();
    await loadConversationMessages(conversationId, true);
  }, [loadConversationMessages, conversationId, clearStoredConversation]);

  const checkActiveTicket = useCallback(async () => {
    try {
      setLoadingMessages(true);
      
      const response = await api.get('/api/v1/conversations/active_support');
      
      if (response.data.success && response.data.conversation_id) {
        const activeConvId = response.data.conversation_id;
        setConversationId(activeConvId);
        setHasActiveTicket(true);
        setTicketStatus('active');
        
        await AsyncStorage.setItem(STORAGE_KEYS.conversationId, activeConvId);
        await loadConversationMessages(activeConvId);
        
        return;
      }
      
      // No active ticket
      setHasActiveTicket(false);
      await clearStoredConversation();
      
      const welcomeMessage: Message = {
        id: '1',
        text: 'Hello! Welcome to our customer support. How can I help you today?',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: true,
        type: 'text',
      };
      
      setMessages([welcomeMessage]);
      messageIdsRef.current.add('1');
      
      setLoadingMessages(false);
      setIsInitialLoad(false);
      
      if (autoSelectPackage) {
        setShowPackageModal(true);
      } else {
        setShowTicketModal(true);
      }
      
    } catch (error) {
      console.error('Error checking active ticket:', error);
      
      const welcomeMessage: Message = {
        id: '1',
        text: 'Hello! Welcome to our customer support. How can I help you today?',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: true,
        type: 'text',
      };
      
      setMessages([welcomeMessage]);
      messageIdsRef.current.add('1');
      
      setLoadingMessages(false);
      setIsInitialLoad(false);
      
      if (autoSelectPackage) {
        setShowPackageModal(true);
      } else {
        setShowTicketModal(true);
      }
    }
  }, [autoSelectPackage, loadConversationMessages, clearStoredConversation]);

  // ============= TYPING INDICATOR =============
  
  const sendTypingIndicator = useCallback(async (typing: boolean) => {
    if (!isConnected || !conversationId) return;

    try {
      const actionCable = ActionCableService.getInstance();
      if (typing) {
        await actionCable.startTyping({ conversationId });
      } else {
        await actionCable.stopTyping(conversationId);
      }
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  }, [isConnected, conversationId]);

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 2000);
  }, [isTyping, sendTypingIndicator]);

  // ============= SCROLL MANAGEMENT =============
  
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentOffset = contentOffset.y;
    const maxOffset = contentSize.height - layoutMeasurement.height;
    const distanceFromBottom = maxOffset - currentOffset;
    
    setIsNearBottom(distanceFromBottom < 100);
    setShowScrollButton(distanceFromBottom > SCROLL_BUTTON_THRESHOLD);
    
    if (distanceFromBottom < 50) {
      setUnreadCount(0);
    }
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
    setUnreadCount(0);
  }, []);

  // ============= MESSAGE SENDING =============
  
  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;

    try {
      const payload: any = {
        category: inquiryType === 'package' ? 'package_inquiry' : 'basic_inquiry'
      };
      
      if (selectedPackage?.code) {
        payload.package_code = selectedPackage.code;
      }
      
      const response = await api.post('/api/v1/conversations/support_ticket', payload);
      
      if (response.data.success && response.data.conversation_id) {
        const newConversationId = response.data.conversation_id;
        setConversationId(newConversationId);
        setTicketStatus('pending');
        
        await AsyncStorage.setItem(STORAGE_KEYS.conversationId, newConversationId);
        
        // Setup ActionCable for new conversation
        await setupActionCableConnection();
        
        return newConversationId;
      }
      
      throw new Error(response.data.message || 'Failed to create support ticket');
    } catch (error: any) {
      console.error('Failed to create support ticket:', error);
      throw error;
    }
  }, [conversationId, inquiryType, selectedPackage?.code, setupActionCableConnection]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !inputFieldEnabled.current) return;

    const messageContent = inputText.trim();
    setInputText('');
    
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
    }
    
    try {
      const convId = await ensureConversation();
      
      const tempId = `temp-${Date.now()}`;
      
      // Add optimistic message
      const optimisticMessage: Message = {
        id: tempId,
        tempId: tempId,
        text: messageContent,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: false,
        type: 'text',
        optimistic: true,
        sendStatus: 'pending',
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, optimisticMessage]);
      
      setTimeout(() => scrollToBottom(), 100);

      const metadata = selectedPackage ? { package_code: selectedPackage.code } : undefined;
      const response = await api.post(`/api/v1/conversations/${convId}/send_message`, {
        content: messageContent,
        message_type: 'text',
        metadata,
        temp_id: tempId,
      });
      
      if (response.data.success) {
        setTicketStatus('pending');
        setHasActiveTicket(true);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.optimistic));
      setInputText(messageContent); // Restore input
    }
  }, [inputText, ensureConversation, selectedPackage, isTyping, sendTypingIndicator]);

  const handleInputTextChange = useCallback((text: string) => {
    setInputText(text);
    
    if (text.trim() && conversationId) {
      handleTyping();
    }
  }, [conversationId, handleTyping]);

  // ============= UI HELPERS =============
  
  const getTicketStatusText = () => {
    if (agentPresence.is_typing) {
      return 'typing...';
    }

    if (agentPresence.status === 'online') {
      return 'Online';
    } else if (agentPresence.status === 'away') {
      return 'Away';
    } else if (agentPresence.last_seen) {
      const lastSeen = new Date(agentPresence.last_seen);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
      
      if (diffMinutes < 1) return 'Last seen just now';
      if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Last seen ${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `Last seen ${diffDays}d ago`;
    }
    
    switch (ticketStatus) {
      case 'pending': return 'Ticket Pending';
      case 'active': return isConnected ? 'Connected' : 'Connecting...';
      case 'closed': return 'Chat closed';
      default: return isConnected ? 'Connected' : 'Connecting...';
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageWrapper} key={item.id}>
      <View style={[
        styles.messageContainer,
        item.isSupport ? styles.supportMessage : styles.userMessage,
        item.optimistic && styles.optimisticMessage,
      ]}>
        <Text style={[
          styles.messageText,
          item.optimistic && styles.optimisticMessageText
        ]}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      </View>
    </View>
  );

  // ============= CLEANUP =============
  
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (presenceCheckInterval.current) {
        clearInterval(presenceCheckInterval.current);
      }
      
      retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      retryTimeoutsRef.current.clear();
    };
  }, []);

  // ============= MAIN RENDER =============
  
  if (loadingMessages && isInitialLoad) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#5A2D82" />
        
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              onPress={handleGoBack}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Image
              source={require('../../assets/images/avatar_placeholder.png')}
              style={styles.avatar}
            />
            
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Customer Support</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton}>
                <Feather name="more-vertical" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#5A2D82" />
      
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={handleGoBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Image
            source={require('../../assets/images/avatar_placeholder.png')}
            style={styles.avatar}
          />
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Customer Support</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={[
                styles.headerSubtitle,
                agentPresence.is_typing && styles.typingText
              ]}>
                {getTicketStatusText()}
              </Text>
              {isConnected && agentPresence.status === 'online' && !agentPresence.is_typing && (
                <View style={styles.connectionIndicator}>
                  <View style={styles.onlineIndicator} />
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Feather name="more-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={SCROLL_THRESHOLD}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#7B3F98"
                colors={['#7B3F98']}
              />
            }
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                {loadingOlder && (
                  <View style={styles.loadingOlderContainer}>
                    <ActivityIndicator size="small" color="#7B3F98" />
                    <Text style={styles.loadingOlderText}>Loading older messages...</Text>
                  </View>
                )}
                {!hasMoreMessages && messages.length > 1 && (
                  <View style={styles.startOfConversationContainer}>
                    <Text style={styles.startOfConversationText}>Start of conversation</Text>
                  </View>
                )}
              </View>
            )}
          />
          
          {showScrollButton && (
            <TouchableOpacity
              style={styles.scrollToBottomButton}
              onPress={() => scrollToBottom(true)}
              activeOpacity={0.8}
            >
              <View style={styles.scrollToBottomContent}>
                <Feather name="arrow-down" size={20} color="#fff" />
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.inputContainerFixed}>
          <View style={styles.inputRow}>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Message"
                placeholderTextColor="#8E8E93"
                value={inputText}
                onChangeText={handleInputTextChange}
                multiline
                maxLength={1000}
                editable={inputFieldEnabled.current}
              />
            </View>
            
            <TouchableOpacity 
              style={[
                styles.sendButtonMain,
                inputText.trim() ? styles.sendButtonActive : styles.voiceButton
              ]}
              onPress={inputText.trim() ? sendMessage : undefined}
              disabled={!inputText.trim() || !inputFieldEnabled.current}
            >
              {inputText.trim() ? (
                <Feather name="send" size={18} color="#fff" />
              ) : (
                <Feather name="mic" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B141B',
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    paddingBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 20,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  headerSubtitle: {
    color: '#E1BEE7',
    fontSize: 12,
    lineHeight: 14,
  },
  typingText: {
    fontStyle: 'italic',
    color: '#4FC3F7',
  },
  connectionIndicator: {
    marginLeft: 6,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 6,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  listHeader: {
    paddingVertical: 8,
  },
  loadingOlderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingOlderText: {
    color: '#8E8E93',
    fontSize: 14,
    marginLeft: 8,
  },
  startOfConversationContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  startOfConversationText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageWrapper: {
    marginVertical: 3,
  },
  messageContainer: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  supportMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2C34',
    borderBottomLeftRadius: 4,
    marginLeft: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6B46C1',
    borderBottomRightRadius: 4,
    marginRight: 4,
  },
  optimisticMessage: {
    opacity: 0.7,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
    paddingTop: 4,
  },
  optimisticMessageText: {
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  timestamp: {
    color: '#8E8E93',
    fontSize: 11,
    marginRight: 4,
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#7B3F98',
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  scrollToBottomContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#0B141B',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  inputContainerFixed: {
    backgroundColor: 'rgba(11, 20, 27, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#1F2C34',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    minHeight: 45,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8,
    textAlignVertical: 'center',
    maxHeight: 80,
  },
  sendButtonMain: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#7B3F98',
  },
  voiceButton: {
    backgroundColor: '#7B3F98',
  },
});
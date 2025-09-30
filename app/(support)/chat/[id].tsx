// app/(support)/chat/[id].tsx - FULLY FIXED: All improvements implemented
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  AppState,
  AppStateStatus,
  Dimensions,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '../../../context/UserContext';
import api from '../../../lib/api';
import ActionCableService from '../../../lib/services/ActionCableService';
import { accountManager } from '../../../lib/AccountManager';
import ChatCacheManager, { CachedMessage, CachedConversation } from '../../../lib/cache/ChatCacheManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INITIAL_MESSAGE_LIMIT = 20;
const PAGINATION_LIMIT = 15;
const REQUEST_TIMEOUT = 20000;
const SCROLL_THRESHOLD = 0.1;
const CACHE_STALE_TIME = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [5000, 15000, 30000];
const SCROLL_BUTTON_THRESHOLD = 200;

interface ChatMessage extends CachedMessage {
  sendStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  retryCount?: number;
}

interface ChatConversation {
  id: string;
  ticket_id: string;
  title: string;
  status: string;
  priority: string;
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
  escalated: boolean;
  package_id?: string;
  created_at: string;
  last_activity_at: string;
}

interface CustomerPresence {
  status: 'online' | 'offline' | 'away';
  last_seen?: string;
  is_typing?: boolean;
}

export default function SupportChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const [conversation, setConversation] = useState<CachedConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const [customerPresence, setCustomerPresence] = useState<CustomerPresence>({
    status: 'offline',
  });
  
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheManager = useRef(ChatCacheManager.getInstance());
  const cacheUnsubscribeRef = useRef<(() => void) | null>(null);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const conversationLoadedRef = useRef(false);
  const conversationLoadedStorageKey = `conversation_loaded_support_${id}`;
  const cacheTimestampKey = `cache_timestamp_support_${id}`;
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const appState = useRef(AppState.currentState);
  const lastReadMessageIdRef = useRef<string | null>(null);

  // ============= STORAGE PERSISTENCE =============
  
  const saveConversationLoadedState = useCallback(async () => {
    try {
      await AsyncStorage.setItem(conversationLoadedStorageKey, 'true');
      await AsyncStorage.setItem(cacheTimestampKey, Date.now().toString());
    } catch (error) {
      console.error('Failed to save conversation loaded state:', error);
    }
  }, [conversationLoadedStorageKey, cacheTimestampKey]);

  const loadConversationLoadedState = useCallback(async () => {
    try {
      const [loaded, timestamp] = await Promise.all([
        AsyncStorage.getItem(conversationLoadedStorageKey),
        AsyncStorage.getItem(cacheTimestampKey),
      ]);
      
      if (loaded === 'true' && timestamp) {
        const cacheAge = Date.now() - parseInt(timestamp, 10);
        if (cacheAge < CACHE_STALE_TIME) {
          conversationLoadedRef.current = true;
          return true;
        } else {
          await clearConversationLoadedState();
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to load conversation state:', error);
      return false;
    }
  }, [conversationLoadedStorageKey, cacheTimestampKey]);

  const clearConversationLoadedState = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(conversationLoadedStorageKey),
        AsyncStorage.removeItem(cacheTimestampKey),
      ]);
      conversationLoadedRef.current = false;
    } catch (error) {
      console.error('Failed to clear conversation state:', error);
    }
  }, [conversationLoadedStorageKey, cacheTimestampKey]);

  // ============= APP STATE MANAGEMENT =============
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [id, isConnected]);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App came to foreground');
      
      if (!isConnected && id) {
        await reconnectActionCable();
      }
      
      if (id) {
        await markCustomerMessagesAsReadIfVisible();
      }
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('📱 App went to background');
      
      if (isConnected && actionCableRef.current) {
        await actionCableRef.current.updatePresence('away');
      }
    }
    
    appState.current = nextAppState;
  }, [id, isConnected]);

  const reconnectActionCable = useCallback(async () => {
    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount || !user) return;

      actionCableRef.current = ActionCableService.getInstance();
      const connected = await actionCableRef.current.connect({
        token: currentAccount.token,
        userId: user.id.toString(),
        autoReconnect: true,
      });

      if (connected && id) {
        await actionCableRef.current.joinConversation(id);
        setupActionCableSubscriptions();
      }
    } catch (error) {
      console.error('Failed to reconnect ActionCable:', error);
    }
  }, [id, user]);

  // ============= AUTO MARK AS READ =============
  
  const markCustomerMessagesAsReadIfVisible = useCallback(async () => {
    if (!id || !isConnected || appState.current !== 'active') return;

    try {
      const lastUnreadCustomerMessage = messages
        .filter(msg => !msg.from_support && !msg.read_at && msg.id !== lastReadMessageIdRef.current)
        .pop();

      if (lastUnreadCustomerMessage && actionCableRef.current) {
        console.log('📖 Auto-marking customer messages as read');
        
        await actionCableRef.current.perform('mark_message_read', {
          conversation_id: id,
        });
        
        lastReadMessageIdRef.current = lastUnreadCustomerMessage.id;
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [id, isConnected, messages]);

  useEffect(() => {
    if (appState.current === 'active' && messages.length > 0) {
      markCustomerMessagesAsReadIfVisible();
    }
  }, [messages, markCustomerMessagesAsReadIfVisible]);

  // ============= CACHE SUBSCRIPTION =============
  
  useEffect(() => {
    if (!id) return;

    cacheUnsubscribeRef.current = cacheManager.current.subscribe(id, (conversationId, cachedData) => {
      console.log(`📦 Cache updated for conversation ${conversationId}`);
      
      const uiMessages: ChatMessage[] = cachedData.messages.map(msg => ({
        ...msg,
        sendStatus: msg.optimistic ? 'pending' : (msg.read_at ? 'read' : msg.delivered_at ? 'delivered' : 'sent'),
      }));
      
      setConversation(cachedData.conversation);
      setMessages(uiMessages);
      setHasMoreMessages(cachedData.hasMoreMessages);
    });

    return () => {
      if (cacheUnsubscribeRef.current) {
        cacheUnsubscribeRef.current();
      }
    };
  }, [id]);

  // ============= ACTIONCABLE SETUP =============
  
  useEffect(() => {
    if (!id || !user) return;

    const initActionCable = async () => {
      try {
        const currentAccount = accountManager.getCurrentAccount();
        if (!currentAccount) return;

        actionCableRef.current = ActionCableService.getInstance();
        
        const connected = await actionCableRef.current.connect({
          token: currentAccount.token,
          userId: user.id.toString(),
          autoReconnect: true,
        });

        if (connected) {
          setIsConnected(true);
          console.log('✅ ActionCable connected for support chat');
          
          await actionCableRef.current.joinConversation(id);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          setSubscriptionReady(true);
          setupActionCableSubscriptions();
          await requestCustomerPresence();
        }
      } catch (error) {
        console.error('Failed to initialize ActionCable:', error);
        setIsConnected(false);
        setSubscriptionReady(false);
      }
    };

    initActionCable();

    return () => {
      if (actionCableRef.current && id) {
        actionCableRef.current.leaveConversation(id);
      }
      
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      setSubscriptionReady(false);
    };
  }, [user, id]);

  const requestCustomerPresence = useCallback(async () => {
    if (!id) return;

    try {
      const actionCable = actionCableRef.current;
      if (actionCable) {
        await actionCable.perform('get_user_presence', {
          conversation_id: id,
        });
      }
    } catch (error) {
      console.error('Failed to request customer presence:', error);
    }
  }, [id]);

  // ============= ACTIONCABLE SUBSCRIPTIONS =============
  
  const setupActionCableSubscriptions = () => {
    if (!actionCableRef.current || !id) return;

    const actionCable = actionCableRef.current;

    actionCableSubscriptions.current.forEach(unsub => unsub());
    actionCableSubscriptions.current = [];

    // New message
    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      console.log('📨 Message received:', data);
      
      if (data.conversation_id !== id || !data.message) return;
      
      const messageData = data.message;
      const messageId = String(messageData.id);
      
      if (messageData.temp_id) {
        cacheManager.current.removeOptimisticMessages(id);
      }
      
      const newMessage: CachedMessage = {
        id: messageId,
        content: messageData.content || '',
        created_at: messageData.created_at || new Date().toISOString(),
        timestamp: messageData.timestamp || new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        is_system: messageData.is_system || false,
        from_support: messageData.from_support || false,
        message_type: messageData.message_type || 'text',
        user: messageData.user || {
          id: messageData.user?.id || '',
          name: messageData.user?.name || 'Unknown',
          role: messageData.user?.role || 'unknown'
        },
        metadata: messageData.metadata || {},
        optimistic: false,
        delivered_at: messageData.delivered_at,
        read_at: messageData.read_at,
      };

      cacheManager.current.addMessageToCache(id, newMessage);
      
      if (messageData.user?.id !== user?.id) {
        if (isNearBottom) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          setUnreadCount(prev => prev + 1);
        }
        
        if (appState.current === 'active') {
          setTimeout(() => markCustomerMessagesAsReadIfVisible(), 500);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubNewMessage);

    // Message acknowledgment
    const unsubAcknowledged = actionCable.subscribe('message_acknowledged', (data) => {
      if (data.message_id) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            if (data.status === 'delivered') {
              return { ...msg, delivered_at: data.timestamp, sendStatus: 'delivered' };
            } else if (data.status === 'read') {
              return { 
                ...msg, 
                delivered_at: msg.delivered_at || data.timestamp, 
                read_at: data.timestamp,
                sendStatus: 'read'
              };
            }
          }
          return msg;
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubAcknowledged);

    // Message read
    const unsubRead = actionCable.subscribe('conversation_read', (data) => {
      if (data.conversation_id === id) {
        console.log(`📖 ${data.reader_name || 'Customer'} read the conversation`);
        setMessages(prev => prev.map(msg => ({
          ...msg,
          read_at: msg.read_at || data.timestamp,
          sendStatus: msg.sendStatus === 'delivered' || msg.sendStatus === 'sent' ? 'read' : msg.sendStatus,
        })));
      }
    });
    actionCableSubscriptions.current.push(unsubRead);

    // Typing indicator
    const unsubTyping = actionCable.subscribe('typing_indicator', (data) => {
      if (data.conversation_id === id && data.user_id !== user?.id) {
        setCustomerPresence(prev => ({
          ...prev,
          is_typing: data.typing,
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubTyping);

    // Ticket status
    const unsubStatus = actionCable.subscribe('ticket_status_changed', (data) => {
      if (data.conversation_id === id) {
        console.log('🎫 Ticket status changed:', data.new_status);
        
        cacheManager.current.updateConversationMetadata(id, { status: data.new_status });
        
        if (data.system_message) {
          const systemMessage: CachedMessage = {
            id: data.system_message.id,
            content: data.system_message.content,
            created_at: data.system_message.created_at,
            timestamp: data.system_message.timestamp,
            is_system: true,
            from_support: true,
            message_type: 'system',
            user: data.system_message.user,
            metadata: data.system_message.metadata || {},
            optimistic: false,
          };
          cacheManager.current.addMessageToCache(id, systemMessage);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubStatus);

    // Conversation update
    const unsubUpdate = actionCable.subscribe('conversation_updated', (data) => {
      if (data.conversation_id === id) {
        console.log('🔄 Conversation updated:', data);
        
        const updates: any = {};
        if (data.status) updates.status = data.status;
        if (data.priority) updates.priority = data.priority;
        if (data.assigned_agent) updates.assigned_agent = data.assigned_agent;
        if (data.escalated !== undefined) updates.escalated = data.escalated;
        
        cacheManager.current.updateConversationMetadata(id, updates);
      }
    });
    actionCableSubscriptions.current.push(unsubUpdate);

    // Presence updates
    const unsubPresence = actionCable.subscribe('user_presence_changed', (data) => {
      if (data.conversation_id === id && data.user_id !== user?.id) {
        setCustomerPresence({
          status: data.status as 'online' | 'offline' | 'away',
          last_seen: data.last_seen || data.last_seen_at,
          is_typing: false,
        });
      }
    });
    actionCableSubscriptions.current.push(unsubPresence);

    // Connection status
    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
      setSubscriptionReady(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    console.log('✅ ActionCable subscriptions configured');
  };

  // ============= MESSAGE RETRY LOGIC =============
  
  const scheduleMessageRetry = useCallback((tempId: string, message: CachedMessage, retryCount: number) => {
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      console.error('Max retry attempts reached for message:', tempId);
      
      setMessages(prev => prev.map(msg => 
        (msg as any).tempId === tempId ? { ...msg, sendStatus: 'failed', retryCount } : msg
      ));
      return;
    }

    const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    
    console.log(`⏳ Scheduling retry ${retryCount + 1} for message in ${delay}ms`);
    
    const timeout = setTimeout(() => {
      retryFailedMessage(tempId, message, retryCount + 1);
    }, delay);

    retryTimeoutsRef.current.set(tempId, timeout);
  }, []);

  const retryFailedMessage = useCallback(async (tempId: string, message: CachedMessage, retryCount: number) => {
    if (!id || !isConnected) {
      scheduleMessageRetry(tempId, message, retryCount);
      return;
    }

    try {
      console.log(`🔄 Retrying message (attempt ${retryCount}):`, tempId);
      
      const actionCable = actionCableRef.current;
      if (actionCable) {
        const success = await actionCable.perform('send_message', {
          conversation_id: id,
          content: message.content,
          message_type: message.message_type,
          metadata: message.metadata,
          temp_id: tempId,
        });

        if (success) {
          console.log('✅ Message retry successful');
          retryTimeoutsRef.current.delete(tempId);
        } else {
          scheduleMessageRetry(tempId, message, retryCount);
        }
      }
    } catch (error) {
      console.error('Message retry failed:', error);
      scheduleMessageRetry(tempId, message, retryCount);
    }
  }, [id, isConnected, scheduleMessageRetry]);

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

  useEffect(() => {
    if (messages.length === 0) return;

    if (isNearBottom) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length, isNearBottom]);

  // ============= DAY SEPARATORS =============
  
  const groupedMessages = useMemo(() => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach(msg => {
      const date = new Date(msg.created_at || msg.timestamp);
      const dateKey = date.toDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    
    return groups;
  }, [messages]);

  const formatDateHeader = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }, []);

  const renderDateSeparator = useCallback((dateStr: string) => (
    <View style={styles.dateSeparator} key={`date-${dateStr}`}>
      <View style={styles.dateSeparatorLine} />
      <Text style={styles.dateSeparatorText}>{formatDateHeader(dateStr)}</Text>
      <View style={styles.dateSeparatorLine} />
    </View>
  ), [formatDateHeader]);

  // ============= MESSAGE LOADING =============
  
  const loadConversation = useCallback(async (isRefresh = false, loadOlder = false) => {
    if (!id) {
      setLoading(false);
      return;
    }

    if (!isRefresh && !loadOlder && conversationLoadedRef.current) {
      const cachedData = cacheManager.current.getCachedConversation(id);
      if (cachedData) {
        console.log(`📦 Loading conversation from cache: ${id}`);
        
        const uiMessages: ChatMessage[] = cachedData.messages.map(msg => ({
          ...msg,
          sendStatus: msg.optimistic ? 'pending' : (msg.read_at ? 'read' : msg.delivered_at ? 'delivered' : 'sent'),
        }));
        
        setConversation(cachedData.conversation);
        setMessages(uiMessages);
        setHasMoreMessages(cachedData.hasMoreMessages);
        setLoading(false);
        setIsInitialLoad(false);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
        
        setTimeout(() => backgroundSyncMessages(id), 2000);
        return;
      }
    }

    console.log(`🌐 Loading conversation from API: ${id}`, { isRefresh, loadOlder });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, REQUEST_TIMEOUT);

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (loadOlder) {
        setLoadingOlder(true);
      } else {
        setLoading(true);
      }

      setConnectionError(false);

      const params: any = {
        limit: loadOlder ? PAGINATION_LIMIT : INITIAL_MESSAGE_LIMIT,
      };

      if (loadOlder) {
        const oldestMessageId = cacheManager.current.getOldestMessageId(id);
        if (oldestMessageId) {
          params.older_than = oldestMessageId;
        }
      }

      const response = await api.get(`/api/v1/conversations/${id}`, {
        params,
        signal: abortControllerRef.current.signal,
        timeout: REQUEST_TIMEOUT,
      });

      clearTimeout(timeoutId);

      if (response.data.success) {
        const conversationData = response.data.conversation;
        const messagesData = response.data.messages || [];
        const pagination = response.data.pagination || {};

        if (isRefresh || (!loadOlder && !conversationLoadedRef.current)) {
          cacheManager.current.setCachedConversation(
            id,
            conversationData,
            messagesData,
            pagination.has_more || false,
            messagesData.length > 0 ? messagesData[0]?.id : null
          );
          setIsInitialLoad(false);
          conversationLoadedRef.current = true;
          await saveConversationLoadedState();

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
        } else if (loadOlder) {
          cacheManager.current.prependOlderMessages(
            id,
            messagesData,
            pagination.has_more || false
          );
        }

        if (conversationData?.customer?.presence) {
          setCustomerPresence({
            status: conversationData.customer.presence.status || 'offline',
            last_seen: conversationData.customer.presence.last_seen,
          });
        }

        console.log(`Loaded ${messagesData.length} messages, has_more: ${pagination.has_more}`);
      }
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Failed to load conversation:', error);
      setConnectionError(true);

      Alert.alert(
        'Error', 
        'Failed to load conversation. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: () => loadConversation(isRefresh, loadOlder) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
      setLoadingOlder(false);
      setRefreshing(false);
    }
  }, [id]);

  const backgroundSyncMessages = useCallback(async (conversationId: string) => {
    try {
      console.log('🔄 Background syncing messages...');
      
      const response = await api.get(`/api/v1/conversations/${conversationId}`, {
        params: { limit: 10 },
        timeout: 10000,
      });

      if (response.data.success && response.data.messages) {
        const newMessages = response.data.messages;
        
        newMessages.forEach((msg: any) => {
          const messageId = String(msg.id);
          const existingMessage = messages.find(m => m.id === messageId);
          if (!existingMessage) {
            cacheManager.current.addMessageToCache(conversationId, msg);
          }
        });
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }, [messages]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !cacheManager.current.shouldLoadOlderMessages(id)) {
      return;
    }
    
    console.log('Loading older messages for conversation:', id);
    await loadConversation(false, true);
  }, [loadConversation, id, loadingOlder]);

  const handleRefresh = useCallback(async () => {
    cacheManager.current.clearConversationCache(id);
    await clearConversationLoadedState();
    await loadConversation(true);
  }, [loadConversation, id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // ============= TYPING INDICATOR =============
  
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    
    if (!isTyping && text.trim() && actionCableRef.current && id) {
      setIsTyping(true);
      actionCableRef.current.startTyping({ conversationId: id });
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && actionCableRef.current && id) {
        setIsTyping(false);
        actionCableRef.current.stopTyping(id);
      }
    }, 2000);
  }, [isTyping, id]);

  // ============= MESSAGE SENDING =============
  
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !subscriptionReady || !id) return;

    const messageText = inputText.trim();
    setInputText('');
    
    if (isTyping && actionCableRef.current) {
      setIsTyping(false);
      actionCableRef.current.stopTyping(id);
    }

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage: CachedMessage = {
      id: tempId,
      content: messageText,
      created_at: new Date().toISOString(),
      is_system: false,
      from_support: true,
      message_type: 'text',
      user: {
        id: user?.id || '',
        name: user?.display_name || user?.first_name || 'Support',
        role: 'support',
        avatar_url: user?.avatar_url,
      },
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      optimistic: true,
    };

    cacheManager.current.addOptimisticMessage(id, optimisticMessage);
    
    setTimeout(() => scrollToBottom(), 100);

    try {
      const response = await api.post(`/api/v1/conversations/${id}/send_message`, {
        content: messageText,
        message_type: 'text',
        temp_id: tempId,
      }, {
        timeout: REQUEST_TIMEOUT,
      });

      if (response.data.success) {
        cacheManager.current.removeOptimisticMessages(id);
        cacheManager.current.addMessageToCache(id, response.data.message);
        
        if (response.data.conversation) {
          cacheManager.current.updateConversationMetadata(id, {
            last_activity_at: response.data.conversation.last_activity_at,
            status: response.data.conversation.status
          });
        }
        
        console.log('✅ Message sent successfully');
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      const optimisticMsg = cacheManager.current.getCachedConversation(id)
        ?.messages.find(m => m.optimistic);
      if (optimisticMsg) {
        scheduleMessageRetry(optimisticMsg.id, optimisticMsg, 0);
      }
    }
  }, [inputText, subscriptionReady, id, user, isTyping, scheduleMessageRetry]);

  // ============= QUICK ACTIONS =============
  
  const handleQuickAction = async (action: string) => {
    if (!id || !conversation) return;

    try {
      switch (action) {
        case 'assign_to_me':
          await api.post(`/api/v1/support/tickets/${id}/assign`, {
            agent_id: user?.id
          });
          Alert.alert('Success', 'Ticket assigned to you');
          loadConversation(true);
          break;
        
        case 'escalate':
          Alert.alert('Escalate Ticket', 'Escalation feature coming soon');
          break;
        
        case 'close':
          await api.patch(`/api/v1/conversations/${id}/close`);
          Alert.alert('Success', 'Ticket closed');
          loadConversation(true);
          break;
        
        case 'priority_high':
          await api.patch(`/api/v1/support/tickets/${id}/priority`, {
            priority: 'high'
          });
          Alert.alert('Success', 'Priority set to high');
          loadConversation(true);
          break;
      }
    } catch (error) {
      console.error('Quick action failed:', error);
      Alert.alert('Error', 'Action failed');
    }
    setShowActions(false);
  };

  // ============= HELPER FUNCTIONS =============
  
  const getConnectionStatusText = () => {
    if (customerPresence.is_typing) {
      return 'typing...';
    }

    if (!conversation) return 'Loading...';
    if (!isConnected) return 'Connecting...';
    if (customerPresence.status === 'online') return 'Online';
    if (customerPresence.last_seen) {
      const lastSeen = new Date(customerPresence.last_seen);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
      
      if (diffMinutes < 1) return 'Last seen just now';
      if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Last seen ${diffHours}h ago`;
      return 'Last seen recently';
    }
    return 'Offline';
  };

  // ============= RENDER FUNCTIONS =============
  
  const renderMessageStatus = (message: ChatMessage) => {
    if (!message.from_support || message.user.id !== user?.id) {
      return null;
    }

    if (message.sendStatus === 'failed') {
      return (
        <TouchableOpacity
          style={styles.messageStatusContainer}
          onPress={() => {
            const cachedMsg = cacheManager.current.getCachedConversation(id)
              ?.messages.find(m => m.id === (message as any).tempId);
            if (cachedMsg) {
              retryFailedMessage((message as any).tempId!, cachedMsg, message.retryCount || 0);
            }
          }}
        >
          <MaterialIcons name="error-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      );
    }

    if (message.optimistic || message.sendStatus === 'pending') {
      return (
        <View style={styles.messageStatusContainer}>
          <MaterialIcons name="schedule" size={16} color="rgba(255, 255, 255, 0.5)" />
        </View>
      );
    }

    if (message.read_at || message.sendStatus === 'read') {
      return (
        <View style={styles.messageStatusContainer}>
          <MaterialIcons name="done-all" size={16} color="#4FC3F7" />
        </View>
      );
    }

    if (message.delivered_at || message.sendStatus === 'delivered') {
      return (
        <View style={styles.messageStatusContainer}>
          <MaterialIcons name="done-all" size={16} color="rgba(255, 255, 255, 0.5)" />
        </View>
      );
    }

    return (
      <View style={styles.messageStatusContainer}>
        <MaterialIcons name="done" size={16} color="rgba(255, 255, 255, 0.5)" />
      </View>
    );
  };

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      <View
        style={[
          styles.messageBubble,
          item.from_support ? styles.supportMessage : styles.customerMessage,
          item.is_system && styles.systemMessage,
          item.optimistic && styles.optimisticMessage,
          item.sendStatus === 'failed' && styles.failedMessage,
        ]}
      >
        {item.is_system && (
          <View style={styles.systemIndicator}>
            <MaterialIcons name="info" size={14} color="#8E8E93" />
          </View>
        )}
        <Text
          style={[
            styles.messageText,
            item.from_support ? styles.supportMessageText : styles.customerMessageText,
            item.is_system && styles.systemMessageText,
            item.optimistic && styles.optimisticMessageText,
          ]}
        >
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text
            style={[
              styles.messageTime,
              item.from_support ? styles.supportMessageTime : styles.customerMessageTime,
              item.is_system && styles.systemMessageTime,
            ]}
          >
            {item.timestamp}
          </Text>
          {renderMessageStatus(item)}
        </View>
      </View>
    </View>
  ), [user?.id, retryFailedMessage]);

  const renderFlatListData = useMemo(() => {
    const data: any[] = [];
    const dateKeys = Object.keys(groupedMessages).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    dateKeys.forEach((dateKey) => {
      data.push({ type: 'date', dateKey, id: `date-${dateKey}` });
      groupedMessages[dateKey].forEach(msg => {
        data.push({ type: 'message', message: msg, id: msg.id });
      });
    });

    return data;
  }, [groupedMessages]);

  const renderItem = useCallback(({ item }: any) => {
    if (item.type === 'date') {
      return renderDateSeparator(item.dateKey);
    }
    return renderMessage({ item: item.message });
  }, [renderDateSeparator, renderMessage]);

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {loadingOlder && (
        <View style={styles.loadingOlderContainer}>
          <ActivityIndicator size="small" color="#7B3F98" />
          <Text style={styles.loadingOlderText}>Loading older messages...</Text>
        </View>
      )}
      {!hasMoreMessages && messages.length > 0 && (
        <View style={styles.startOfConversationContainer}>
          <Text style={styles.startOfConversationText}>Start of conversation</Text>
        </View>
      )}
    </View>
  );

  const renderQuickActionsModal = () => (
    <Modal
      visible={showActions}
      transparent
      animationType="slide"
      onRequestClose={() => setShowActions(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.actionsModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Quick Actions</Text>
            <TouchableOpacity onPress={() => setShowActions(false)}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('assign_to_me')}
          >
            <Feather name="user" size={20} color="#7B3F98" />
            <Text style={styles.actionButtonText}>Assign to Me</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('priority_high')}
          >
            <Feather name="alert-triangle" size={20} color="#f97316" />
            <Text style={styles.actionButtonText}>Set High Priority</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('escalate')}
          >
            <Feather name="arrow-up" size={20} color="#ef4444" />
            <Text style={styles.actionButtonText}>Escalate Ticket</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { borderTopWidth: 1, borderTopColor: '#333' }]}
            onPress={() => handleQuickAction('close')}
          >
            <Feather name="x-circle" size={20} color="#6b7280" />
            <Text style={styles.actionButtonText}>Close Ticket</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ============= MAIN RENDER =============
  
  if (loading && isInitialLoad) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
          {connectionError && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadConversation()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Conversation not found</Text>
          <Text style={styles.errorSubtext}>
            This conversation may have been deleted or you don't have access to it.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Image
            source={
              conversation?.customer?.avatar_url
                ? { uri: conversation.customer.avatar_url }
                : require('../../../assets/images/avatar_placeholder.png')
            }
            style={styles.headerAvatar}
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{conversation?.customer?.name || 'Unknown Customer'}</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.headerSubtitle}>
                #{conversation?.ticket_id || 'Unknown'} • {conversation?.status?.replace('_', ' ') || 'Unknown Status'}
              </Text>
              {conversation?.escalated && (
                <View style={styles.escalatedBadge}>
                  <Feather name="alert-triangle" size={10} color="#f97316" />
                  <Text style={styles.escalatedText}>Escalated</Text>
                </View>
              )}
              {isConnected && !customerPresence.is_typing && customerPresence.status === 'online' && (
                <View style={styles.connectionIndicator}>
                  <View style={styles.onlineIndicator} />
                </View>
              )}
            </View>
            <Text style={[
              styles.headerStatusText,
              customerPresence.is_typing && styles.typingText
            ]}>
              {getConnectionStatusText()}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="phone" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="video" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => setShowActions(true)}
          >
            <Feather name="more-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {conversation && (
        <View style={styles.ticketInfoBar}>
          <View style={styles.ticketInfoItem}>
            <Text style={styles.ticketInfoLabel}>Priority:</Text>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(conversation.priority || 'normal') }]}>
              <Text style={styles.priorityText}>{(conversation.priority || 'normal').toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.ticketInfoItem}>
            <Text style={styles.ticketInfoLabel}>Category:</Text>
            <Text style={styles.ticketInfoValue}>{conversation.category || 'General'}</Text>
          </View>
          {conversation.assigned_agent && (
            <View style={styles.ticketInfoItem}>
              <Text style={styles.ticketInfoLabel}>Agent:</Text>
              <Text style={styles.ticketInfoValue}>{conversation.assigned_agent.name}</Text>
            </View>
          )}
          {!isConnected && (
            <View style={styles.ticketInfoItem}>
              <Feather name="wifi-off" size={12} color="#f97316" />
              <Text style={styles.connectionWarning}>Offline</Text>
            </View>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={renderFlatListData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.messagesList}
          contentContainerStyle={{ paddingVertical: 8 }}
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
          ListHeaderComponent={renderHeader}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyMessagesContainer}>
              <MaterialIcons name="chat-bubble-outline" size={48} color="#444" />
              <Text style={styles.emptyMessagesText}>No messages yet</Text>
              <Text style={styles.emptyMessagesSubtext}>Start the conversation!</Text>
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

        <View style={[
          styles.inputContainer,
          { 
            paddingBottom: Platform.OS === 'ios' ? 34 : 8 
          }
        ]}>
          <View style={styles.inputRow}>
            <View style={styles.textInputContainer}>
              <TouchableOpacity style={styles.inputButton}>
                <Feather name="smile" size={20} color="#8E8E93" />
              </TouchableOpacity>
              
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor="#8E8E93"
                value={inputText}
                onChangeText={handleTextChange}
                multiline
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
                onFocus={() => setTimeout(() => scrollToBottom(), 100)}
              />
              
              <TouchableOpacity style={styles.attachButton}>
                <Feather name="paperclip" size={18} color="#8E8E93" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraButton}>
                <Feather name="camera" size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim() && subscriptionReady ? styles.sendButtonActive : styles.voiceButton,
              ]}
              onPress={inputText.trim() && subscriptionReady ? sendMessage : undefined}
              disabled={!inputText.trim() || !subscriptionReady}
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

      {renderQuickActionsModal()}
    </SafeAreaView>
  );
}

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
  container: { flex: 1, backgroundColor: '#0B141B' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 28, paddingBottom: 12, paddingHorizontal: 12 },
  headerBackButton: { padding: 8, marginRight: 8 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  headerText: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerSubtitle: { color: '#E1BEE7', fontSize: 12 },
  headerStatusText: { color: '#10b981', fontSize: 11, marginTop: 1 },
  typingText: { fontStyle: 'italic', color: '#4FC3F7' },
  escalatedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249, 115, 22, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
  escalatedText: { color: '#f97316', fontSize: 10, fontWeight: '600', marginLeft: 2 },
  connectionIndicator: { marginLeft: 6 },
  onlineIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionButton: { padding: 8, marginLeft: 4 },
  ticketInfoBar: { flexDirection: 'row', backgroundColor: '#1F2C34', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  ticketInfoItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  ticketInfoLabel: { color: '#8E8E93', fontSize: 12, marginRight: 4 },
  ticketInfoValue: { color: '#fff', fontSize: 12, fontWeight: '500' },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priorityText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  connectionWarning: { color: '#f97316', fontSize: 12, marginLeft: 4 },
  messagesContainer: { flex: 1 },
  messagesList: { flex: 1, paddingHorizontal: 8 },
  listHeader: { paddingVertical: 8 },
  loadingOlderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  loadingOlderText: { color: '#8E8E93', fontSize: 14, marginLeft: 8 },
  startOfConversationContainer: { alignItems: 'center', paddingVertical: 12 },
  startOfConversationText: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 12 },
  dateSeparatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  dateSeparatorText: { color: '#8E8E93', fontSize: 12, fontWeight: '500', marginHorizontal: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  messageContainer: { marginVertical: 2 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, position: 'relative' },
  supportMessage: { alignSelf: 'flex-end', backgroundColor: '#7B3F98', borderBottomRightRadius: 4 },
  customerMessage: { alignSelf: 'flex-start', backgroundColor: '#1F2C34', borderBottomLeftRadius: 4 },
  systemMessage: { alignSelf: 'center', backgroundColor: 'rgba(142, 142, 147, 0.1)', borderRadius: 12, maxWidth: '90%', flexDirection: 'row', alignItems: 'center' },
  optimisticMessage: { opacity: 0.7 },
  failedMessage: { backgroundColor: '#5A2D3D' },
  systemIndicator: { marginRight: 8 },
  messageText: { fontSize: 16, lineHeight: 20 },
  supportMessageText: { color: '#fff' },
  customerMessageText: { color: '#fff' },
  systemMessageText: { color: '#8E8E93', fontSize: 14, fontStyle: 'italic' },
  optimisticMessageText: { fontStyle: 'italic' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  messageTime: { fontSize: 11 },
  supportMessageTime: { color: 'rgba(255, 255, 255, 0.7)' },
  customerMessageTime: { color: 'rgba(255, 255, 255, 0.7)' },
  systemMessageTime: { color: '#8E8E93' },
  messageStatusContainer: { marginLeft: 8 },
  scrollToBottomButton: { position: 'absolute', bottom: 80, right: 16, backgroundColor: '#7B3F98', borderRadius: 28, width: 56, height: 56, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
  scrollToBottomContent: { justifyContent: 'center', alignItems: 'center' },
  unreadBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, borderWidth: 2, borderColor: '#0B141B' },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyMessagesContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyMessagesText: { color: '#8E8E93', fontSize: 16, fontWeight: '500', marginTop: 12 },
  emptyMessagesSubtext: { color: '#666', fontSize: 14, marginTop: 4 },
  inputContainer: { backgroundColor: 'rgba(11, 20, 27, 0.95)', paddingHorizontal: 8, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  textInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2C34', borderRadius: 25, paddingHorizontal: 4, paddingVertical: 6, marginRight: 8, maxHeight: 100, minHeight: 45, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2.22 },
  inputButton: { padding: 8, marginLeft: 4 },
  textInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 8, paddingHorizontal: 8, textAlignVertical: 'center', maxHeight: 80 },
  attachButton: { padding: 8 },
  cameraButton: { padding: 8, marginRight: 4 },
  sendButton: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  sendButtonActive: { backgroundColor: '#7B3F98' },
  voiceButton: { backgroundColor: '#7B3F98' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  actionsModal: { backgroundColor: '#1F2C34', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  actionButton: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  actionButtonText: { color: '#fff', fontSize: 16, marginLeft: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8E8E93', fontSize: 16, marginTop: 16 },
  retryButton: { backgroundColor: '#7B3F98', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 16 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  errorText: { color: '#ef4444', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  errorSubtext: { color: '#8E8E93', fontSize: 14, marginTop: 8, textAlign: 'center' },
  backButton: { backgroundColor: '#7B3F98', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
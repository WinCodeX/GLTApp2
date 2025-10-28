// app/(support)/chat/[id].tsx - FIXED: Duplicate prevention, storage-first, ActionCable-only, proper loading

import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useUser } from '../../../context/UserContext';
import { accountManager } from '../../../lib/AccountManager';
import api from '../../../lib/api';
import ActionCableService from '../../../lib/services/ActionCableService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INITIAL_MESSAGE_LIMIT = 50;
const PAGINATION_LIMIT = 30;
const REQUEST_TIMEOUT = 20000; // FIXED: Increased to 20 seconds
const SCROLL_BUTTON_THRESHOLD = 200;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [5000, 15000, 30000];
const STORAGE_KEY_PREFIX = 'agent_chat_';
const SCROLL_POSITION_KEY_SUFFIX = '_scroll_pos';

const normalizeId = (id: any): string => String(id);

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  timestamp: string;
  is_system: boolean;
  from_support: boolean;
  message_type: string;
  user: {
    id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
  metadata?: any;
  delivered_at?: string | null;
  read_at?: string | null;
  sendStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  retryCount?: number;
  tempId?: string;
  retryData?: {
    content: string;
    messageType: string;
    metadata?: any;
  };
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

interface PendingMessage {
  tempId: string;
  message: ChatMessage;
  retryCount: number;
  lastAttempt: number;
}

export default function SupportChatScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = normalizeId(rawId);
  const { user } = useUser();
  
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
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
  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const messageIdsRef = useRef<Set<string>>(new Set()); // FIXED: Track message IDs to prevent duplicates
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map()); // FIXED: Retry queue
  const retryQueueRef = useRef<PendingMessage[]>([]);
  const isProcessingRetryRef = useRef(false);
  const appState = useRef(AppState.currentState);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const isLoadingOlderRef = useRef(false);
  const hasFetchedInitialMessages = useRef(false);
  const isChatVisible = useRef(true);
  const isChatFocused = useRef(true);
  const currentScrollY = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============= STORAGE HELPERS =============
  
  const getStorageKey = (suffix: string) => `${STORAGE_KEY_PREFIX}${id}${suffix}`;

  const saveMessagesToStorage = useCallback(async (msgs: ChatMessage[]) => {
    if (!id) return;
    try {
      const key = getStorageKey('_messages');
      const data = {
        messages: msgs.slice(-100), // Keep last 100 messages
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(data));
      console.log(`💾 Saved ${msgs.length} messages`);
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, [id]);

  const loadMessagesFromStorage = useCallback(async (): Promise<ChatMessage[]> => {
    if (!id) return [];
    try {
      const key = getStorageKey('_messages');
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        const msgs = data.messages || [];
        console.log(`📦 Loaded ${msgs.length} messages from storage`);
        return msgs;
      }
    } catch (error) {
      console.error('Load from storage failed:', error);
    }
    return [];
  }, [id]);

  const saveConversationToStorage = useCallback(async (conv: ChatConversation) => {
    if (!id) return;
    try {
      const key = getStorageKey('_conversation');
      await AsyncStorage.setItem(key, JSON.stringify(conv));
      console.log('💾 Saved conversation metadata');
    } catch (error) {
      console.error('Save conversation failed:', error);
    }
  }, [id]);

  const loadConversationFromStorage = useCallback(async (): Promise<ChatConversation | null> => {
    if (!id) return null;
    try {
      const key = getStorageKey('_conversation');
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const conv = JSON.parse(stored);
        console.log('📦 Loaded conversation from storage');
        return conv;
      }
    } catch (error) {
      console.error('Load conversation from storage failed:', error);
    }
    return null;
  }, [id]);

  const saveScrollPosition = useCallback(async (position: number) => {
    if (!id) return;
    try {
      const key = getStorageKey(SCROLL_POSITION_KEY_SUFFIX);
      await AsyncStorage.setItem(key, String(position));
    } catch (error) {
      console.error('Save scroll position failed:', error);
    }
  }, [id]);

  const loadScrollPosition = useCallback(async (): Promise<number | null> => {
    if (!id) return null;
    try {
      const key = getStorageKey(SCROLL_POSITION_KEY_SUFFIX);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        return parseFloat(stored);
      }
    } catch (error) {
      console.error('Load scroll position failed:', error);
    }
    return null;
  }, [id]);

  const clearChatStorage = useCallback(async () => {
    if (!id) return;
    try {
      const keys = [
        getStorageKey('_messages'),
        getStorageKey('_conversation'),
        getStorageKey(SCROLL_POSITION_KEY_SUFFIX),
      ];
      await AsyncStorage.multiRemove(keys);
      console.log('🧹 Storage cleared');
    } catch (error) {
      console.error('Clear storage failed:', error);
    }
  }, [id]);

  // ============= APP STATE MANAGEMENT =============
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [id, isConnected, messages]);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App foreground');
      isChatVisible.current = true;
      isChatFocused.current = true;
      
      if (!isConnected && id) {
        await reconnectActionCable();
      }
      
      if (id && isChatVisible.current) {
        await markCustomerMessagesAsReadIfVisible();
      }

      // FIXED: Process retry queue
      await processRetryQueue();
      
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('📱 App background');
      isChatVisible.current = false;
      isChatFocused.current = false;
      
      // Save state
      if (id && messages.length > 0) {
        await saveMessagesToStorage(messages);
        await saveScrollPosition(currentScrollY.current);
      }

      if (conversation) {
        await saveConversationToStorage(conversation);
      }
      
      if (isConnected && actionCableRef.current) {
        await actionCableRef.current.updatePresence('away');
      }
    }
    
    appState.current = nextAppState;
  }, [id, isConnected, messages, conversation, saveMessagesToStorage, saveScrollPosition, saveConversationToStorage]);

  const reconnectActionCable = useCallback(async () => {
    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount || !user) return;

      actionCableRef.current = ActionCableService.getInstance();
      const connected = await actionCableRef.current.connect({
        token: currentAccount.token,
        userId: normalizeId(user.id),
        autoReconnect: true,
      });

      if (connected && id) {
        await actionCableRef.current.joinConversation(id);
        setupActionCableSubscriptions();
        setIsConnected(true);
        setSubscriptionReady(true);

        // FIXED: Process retry queue
        await processRetryQueue();
      }
    } catch (error) {
      console.error('Reconnect failed:', error);
    }
  }, [id, user]);

  // ============= MESSAGE RETRY LOGIC =============
  
  const addToPendingQueue = useCallback((tempId: string, message: ChatMessage) => {
    const pendingMessage: PendingMessage = {
      tempId,
      message,
      retryCount: 0,
      lastAttempt: Date.now(),
    };
    
    pendingMessagesRef.current.set(tempId, pendingMessage);
    retryQueueRef.current.push(pendingMessage);
    
    console.log(`📝 Added message ${tempId} to pending queue`);
  }, []);

  const processRetryQueue = useCallback(async () => {
    if (!isConnected || !id || isProcessingRetryRef.current) return;
    if (retryQueueRef.current.length === 0) return;
    
    isProcessingRetryRef.current = true;
    console.log(`🔄 Processing ${retryQueueRef.current.length} pending messages`);
    
    const queue = [...retryQueueRef.current];
    retryQueueRef.current = [];
    
    for (const pendingMessage of queue) {
      if (pendingMessage.retryCount >= MAX_RETRY_ATTEMPTS) {
        // Mark as failed
        setMessages(prev => prev.map(msg => 
          msg.tempId === pendingMessage.tempId 
            ? { ...msg, sendStatus: 'failed' }
            : msg
        ));
        pendingMessagesRef.current.delete(pendingMessage.tempId);
        continue;
      }
      
      const timeSinceLastAttempt = Date.now() - pendingMessage.lastAttempt;
      const requiredDelay = RETRY_DELAYS[pendingMessage.retryCount] || RETRY_DELAYS[0];
      
      if (timeSinceLastAttempt < requiredDelay) {
        // Re-add to queue for later
        retryQueueRef.current.push(pendingMessage);
        continue;
      }
      
      try {
        console.log(`🔄 Retrying message ${pendingMessage.tempId} (attempt ${pendingMessage.retryCount + 1})`);
        
        const actionCable = actionCableRef.current;
        if (!actionCable) throw new Error('ActionCable not ready');
        
        await actionCable.perform('send_message', {
          conversation_id: id,
          content: pendingMessage.message.retryData?.content || pendingMessage.message.content,
          message_type: pendingMessage.message.retryData?.messageType || 'text',
          metadata: pendingMessage.message.retryData?.metadata,
          temp_id: pendingMessage.tempId,
        });
        
        // Successfully sent
        pendingMessagesRef.current.delete(pendingMessage.tempId);
        
      } catch (error) {
        console.error(`Failed to retry message ${pendingMessage.tempId}:`, error);
        
        pendingMessage.retryCount++;
        pendingMessage.lastAttempt = Date.now();
        
        if (pendingMessage.retryCount < MAX_RETRY_ATTEMPTS) {
          retryQueueRef.current.push(pendingMessage);
        } else {
          // Mark as failed
          setMessages(prev => prev.map(msg => 
            msg.tempId === pendingMessage.tempId 
              ? { ...msg, sendStatus: 'failed' }
              : msg
          ));
          pendingMessagesRef.current.delete(pendingMessage.tempId);
        }
      }
    }
    
    isProcessingRetryRef.current = false;
    
    // Schedule next retry if queue is not empty
    if (retryQueueRef.current.length > 0) {
      setTimeout(() => processRetryQueue(), 5000);
    }
  }, [isConnected, id]);

  const retryFailedMessage = useCallback(async (tempId: string) => {
    const pendingMessage = pendingMessagesRef.current.get(tempId);
    if (!pendingMessage) return;
    
    pendingMessage.retryCount = 0;
    pendingMessage.lastAttempt = 0;
    retryQueueRef.current.push(pendingMessage);
    
    // Update UI to show pending
    setMessages(prev => prev.map(msg => 
      msg.tempId === tempId 
        ? { ...msg, sendStatus: 'pending' }
        : msg
    ));
    
    await processRetryQueue();
  }, [processRetryQueue]);

  // ============= AUTO MARK AS READ =============
  
  const markCustomerMessagesAsReadIfVisible = useCallback(async () => {
    if (!id || !isConnected || !isChatVisible.current || !isChatFocused.current) {
      return;
    }
    
    if (appState.current !== 'active') return;

    try {
      const lastUnreadCustomerMessage = messages
        .filter(msg => !msg.from_support && !msg.read_at && msg.id !== lastReadMessageIdRef.current)
        .pop();

      if (lastUnreadCustomerMessage && actionCableRef.current) {
        console.log('📖 Auto-marking as read');
        
        await actionCableRef.current.perform('mark_message_read', {
          conversation_id: id,
        });
        
        lastReadMessageIdRef.current = lastUnreadCustomerMessage.id;
      }
    } catch (error) {
      console.error('Mark read failed:', error);
    }
  }, [id, isConnected, messages]);

  useEffect(() => {
    if (isChatVisible.current && isChatFocused.current && appState.current === 'active' && messages.length > 0) {
      markCustomerMessagesAsReadIfVisible();
    }
  }, [messages, markCustomerMessagesAsReadIfVisible]);

  // Save messages whenever they change
  useEffect(() => {
    if (id && messages.length > 0 && !loadingMessages) {
      saveMessagesToStorage(messages);
    }
  }, [id, messages, loadingMessages, saveMessagesToStorage]);

  // Save conversation whenever it changes
  useEffect(() => {
    if (conversation) {
      saveConversationToStorage(conversation);
    }
  }, [conversation, saveConversationToStorage]);

  // ============= INITIALIZATION =============
  
  useEffect(() => {
    const initializeChat = async () => {
      // FIXED: Load conversation and messages from storage first
      const storedConversation = await loadConversationFromStorage();
      const storedMessages = await loadMessagesFromStorage();
      const storedScrollPos = await loadScrollPosition();
      
      if (storedConversation) {
        console.log('✅ Loaded conversation from storage');
        setConversation(storedConversation);
        setLoadingConversation(false);
      }

      if (storedMessages.length > 0) {
        console.log('✅ Loaded messages from storage');
        setMessages(storedMessages);
        storedMessages.forEach(msg => messageIdsRef.current.add(msg.id));
        setSavedScrollPosition(storedScrollPos);
        setIsInitialLoad(false);
        hasFetchedInitialMessages.current = true;
        
        // Setup ActionCable and sync in background
        setTimeout(() => {
          if (id) {
            setupActionCableConnection();
            // FIXED: Background sync after loading from storage
            backgroundSyncConversation();
            backgroundSyncMessages();
          }
        }, 500);

        // Restore scroll position or scroll to bottom
        setTimeout(() => {
          if (storedScrollPos !== null) {
            flatListRef.current?.scrollToOffset({ offset: storedScrollPos, animated: false });
          } else {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }, 200);
      } else {
        // No storage, load from API
        loadConversationMetadata();
      }
    };

    initializeChat();
  }, []);

  // FIXED: Separate conversation metadata loading
  const loadConversationMetadata = useCallback(async () => {
    if (!id) return;

    console.log('🌐 Loading conversation metadata');
    setLoadingConversation(true);

    try {
      const response = await api.get(`/api/v1/conversations/${id}`, {
        params: { limit: 0 }, // Just metadata, no messages
        timeout: REQUEST_TIMEOUT,
      });

      if (response.data.success && response.data.conversation) {
        const conversationData = response.data.conversation;
        setConversation(conversationData);
        
        if (conversationData?.customer?.presence) {
          setCustomerPresence({
            status: conversationData.customer.presence.status || 'offline',
            last_seen: conversationData.customer.presence.last_seen,
          });
        }

        console.log('✅ Conversation metadata loaded');
        
        // Now load messages
        await loadMessages();
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setConnectionError(true);
    } finally {
      setLoadingConversation(false);
    }
  }, [id]);

  // FIXED: Background sync conversation metadata
  const backgroundSyncConversation = useCallback(async () => {
    if (!id) return;
    try {
      console.log('🔄 Background sync conversation');
      const response = await api.get(`/api/v1/conversations/${id}`, {
        params: { limit: 0 },
        timeout: 10000,
      });

      if (response.data.success && response.data.conversation) {
        setConversation(response.data.conversation);
        
        if (response.data.conversation?.customer?.presence) {
          setCustomerPresence({
            status: response.data.conversation.customer.presence.status || 'offline',
            last_seen: response.data.conversation.customer.presence.last_seen,
          });
        }
      }
    } catch (error) {
      console.error('Background sync conversation failed:', error);
    }
  }, [id]);

  // FIXED: Background sync messages
  const backgroundSyncMessages = useCallback(async () => {
    if (!id) return;
    try {
      console.log('🔄 Background sync messages');
      const response = await api.get(`/api/v1/conversations/${id}`, {
        params: { limit: 20 },
        timeout: 10000,
      });

      if (response.data.success && response.data.messages) {
        const apiMessages = response.data.messages;
        const newMessages: ChatMessage[] = [];

        apiMessages.forEach((msg: any) => {
          const msgId = normalizeId(msg.id);
          // FIXED: Check for duplicates
          if (!messageIdsRef.current.has(msgId)) {
            newMessages.push({
              id: msgId,
              content: msg.content,
              created_at: msg.created_at,
              timestamp: msg.timestamp || new Date(msg.created_at).toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
              }),
              is_system: msg.is_system || false,
              from_support: msg.from_support,
              message_type: msg.message_type || 'text',
              user: msg.user,
              metadata: msg.metadata || {},
              delivered_at: msg.delivered_at,
              read_at: msg.read_at,
              sendStatus: msg.read_at ? 'read' : msg.delivered_at ? 'delivered' : 'sent',
            });
            messageIdsRef.current.add(msgId);
          }
        });

        if (newMessages.length > 0) {
          setMessages(prev => [...prev, ...newMessages]);
        }
      }
    } catch (error) {
      console.error('Background sync messages failed:', error);
    }
  }, [id]);

  // ============= ACTIONCABLE SETUP =============
  
  const setupActionCableConnection = useCallback(async () => {
    if (!id || !user) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

      actionCableRef.current = ActionCableService.getInstance();
      
      const connected = await actionCableRef.current.connect({
        token: currentAccount.token,
        userId: normalizeId(user.id),
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        console.log('✅ ActionCable connected');
        
        await actionCableRef.current.joinConversation(id);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setSubscriptionReady(true);
        setupActionCableSubscriptions();
        await requestCustomerPresence();

        // FIXED: Process retry queue
        await processRetryQueue();
      }
    } catch (error) {
      console.error('ActionCable setup failed:', error);
      setIsConnected(false);
      setSubscriptionReady(false);
    }
  }, [id, user, processRetryQueue]);

  useEffect(() => {
    if (!id || !user) return;

    if (!isConnected && conversation) {
      setupActionCableConnection();
    }

    return () => {
      if (actionCableRef.current && id) {
        actionCableRef.current.leaveConversation(id);
      }
      
      actionCableSubscriptions.current.forEach(unsub => {
        if (unsub) unsub();
      });
      actionCableSubscriptions.current = [];
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      setSubscriptionReady(false);
    };
  }, [user, id, isConnected, conversation, setupActionCableConnection]);

  const requestCustomerPresence = useCallback(async () => {
    if (!id || !actionCableRef.current) return;

    try {
      await actionCableRef.current.perform('get_user_presence', {
        conversation_id: id,
      });
    } catch (error) {
      console.error('Presence request failed:', error);
    }
  }, [id]);

  // ============= ACTIONCABLE SUBSCRIPTIONS =============
  
  const setupActionCableSubscriptions = () => {
    if (!actionCableRef.current || !id) return;

    const actionCable = actionCableRef.current;

    actionCableSubscriptions.current.forEach(unsub => {
      if (unsub) unsub();
    });
    actionCableSubscriptions.current = [];

    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      console.log('📨 Message received');
      
      if (data.conversation_id !== id || !data.message) return;
      
      const messageData = data.message;
      const messageId = normalizeId(messageData.id);
      const tempId = messageData.temp_id || messageData.metadata?.temp_id;
      
      // FIXED: Check for duplicates
      if (messageIdsRef.current.has(messageId)) {
        console.log('⏭️ Duplicate - skipping');
        return;
      }
      
      messageIdsRef.current.add(messageId);
      
      // Remove optimistic message if exists
      if (tempId) {
        setMessages(prev => prev.filter(m => m.tempId !== tempId));
        pendingMessagesRef.current.delete(tempId);
      }
      
      const newMessage: ChatMessage = {
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
          id: normalizeId(messageData.user?.id) || '',
          name: messageData.user?.name || 'Unknown',
          role: messageData.user?.role || 'unknown'
        },
        metadata: messageData.metadata || {},
        delivered_at: messageData.delivered_at,
        read_at: messageData.read_at,
        sendStatus: messageData.read_at ? 'read' : messageData.delivered_at ? 'delivered' : 'sent',
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      if (messageData.user?.id !== normalizeId(user?.id)) {
        if (isNearBottom) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          setUnreadCount(prev => prev + 1);
        }
        
        if (isChatVisible.current && isChatFocused.current && appState.current === 'active') {
          setTimeout(() => markCustomerMessagesAsReadIfVisible(), 500);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubNewMessage);

    const unsubAcknowledged = actionCable.subscribe('message_acknowledged', (data) => {
      if (data.message_id) {
        const normalizedMessageId = normalizeId(data.message_id);
        setMessages(prev => prev.map(msg => {
          if (msg.id === normalizedMessageId || msg.tempId === normalizedMessageId) {
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

    const unsubRead = actionCable.subscribe('conversation_read', (data) => {
      if (data.conversation_id === id) {
        console.log('📖 Customer read messages');
        setMessages(prev => prev.map(msg => ({
          ...msg,
          read_at: msg.read_at || data.timestamp,
          sendStatus: msg.sendStatus === 'delivered' || msg.sendStatus === 'sent' ? 'read' : msg.sendStatus,
        })));
      }
    });
    actionCableSubscriptions.current.push(unsubRead);

    const unsubTyping = actionCable.subscribe('typing_indicator', (data) => {
      if (data.conversation_id === id && normalizeId(data.user_id) !== normalizeId(user?.id)) {
        setCustomerPresence(prev => ({
          ...prev,
          is_typing: data.typing,
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubTyping);

    const unsubPresence = actionCable.subscribe('user_presence_changed', (data) => {
      if (data.conversation_id === id && normalizeId(data.user_id) !== normalizeId(user?.id)) {
        setCustomerPresence({
          status: data.status as 'online' | 'offline' | 'away',
          last_seen: data.last_seen || data.last_seen_at,
          is_typing: false,
        });
      }
    });
    actionCableSubscriptions.current.push(unsubPresence);

    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
      setSubscriptionReady(true);
      processRetryQueue();
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
      setSubscriptionReady(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    console.log('✅ Subscriptions configured');
  };

  // ============= MESSAGE LOADING =============
  
  const loadMessages = useCallback(async (isRefresh = false, loadOlder = false) => {
    if (!id) return;

    // Skip if already have messages and not refresh/loadOlder
    if (!isRefresh && !loadOlder && hasFetchedInitialMessages.current && messages.length > 0) {
      console.log('Skipping - already have messages');
      return;
    }

    console.log('🌐 Loading messages:', { isRefresh, loadOlder });

    try {
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
        isLoadingOlderRef.current = true;
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

      const response = await api.get(`/api/v1/conversations/${id}`, {
        params,
        signal: abortControllerRef.current.signal,
        timeout: REQUEST_TIMEOUT,
      });

      clearTimeout(timeoutId);

      if (response.data.success) {
        const messagesData = response.data.messages || [];
        const pagination = response.data.pagination || {};

        const normalizedMessages: ChatMessage[] = messagesData.map((msg: any) => ({
          id: normalizeId(msg.id),
          content: msg.content,
          created_at: msg.created_at,
          timestamp: msg.timestamp || new Date(msg.created_at).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          }),
          is_system: msg.is_system || false,
          from_support: msg.from_support,
          message_type: msg.message_type || 'text',
          user: msg.user,
          metadata: msg.metadata || {},
          delivered_at: msg.delivered_at,
          read_at: msg.read_at,
          sendStatus: msg.read_at ? 'read' : msg.delivered_at ? 'delivered' : 'sent',
        }));

        // FIXED: Track message IDs
        normalizedMessages.forEach((msg: any) => messageIdsRef.current.add(msg.id));

        if (isRefresh || (!loadOlder && !hasFetchedInitialMessages.current)) {
          setMessages(normalizedMessages);
          setHasMoreMessages(pagination.has_more || false);
          
          hasFetchedInitialMessages.current = true;
          await saveMessagesToStorage(normalizedMessages);
          setIsInitialLoad(false);

          // Restore scroll position or scroll to bottom
          if (savedScrollPosition !== null) {
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({ offset: savedScrollPosition, animated: false });
              setSavedScrollPosition(null);
            }, 100);
          } else {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
          }
          
        } else if (loadOlder) {
          setMessages(prev => {
            const combined = [...normalizedMessages, ...prev];
            // FIXED: Remove duplicates
            const uniqueMessages = Array.from(
              new Map(combined.map(m => [m.id, m])).values()
            );
            return uniqueMessages;
          });
          setHasMoreMessages(pagination.has_more || false);
        }

        // Update conversation with latest data
        if (response.data.conversation) {
          setConversation(response.data.conversation);
          
          if (response.data.conversation?.customer?.presence) {
            setCustomerPresence({
              status: response.data.conversation.customer.presence.status || 'offline',
              last_seen: response.data.conversation.customer.presence.last_seen,
            });
          }
        }

        console.log(`✅ Loaded ${normalizedMessages.length} messages`);
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Load messages failed:', error);
      setConnectionError(true);
    } finally {
      setLoadingMessages(false);
      setLoadingOlder(false);
      setRefreshing(false);
      isLoadingOlderRef.current = false;
    }
  }, [id, messages, savedScrollPosition, saveMessagesToStorage]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlderRef.current || !hasMoreMessages || loadingOlder) {
      return;
    }
    
    console.log('Loading older messages');
    await loadMessages(false, true);
  }, [loadMessages, loadingOlder, hasMoreMessages]);

  const handleRefresh = useCallback(async () => {
    await clearChatStorage();
    messageIdsRef.current.clear();
    pendingMessagesRef.current.clear();
    retryQueueRef.current = [];
    hasFetchedInitialMessages.current = false;
    await loadMessages(true);
  }, [loadMessages, clearChatStorage]);

  // ============= SCROLL MANAGEMENT =============
  
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    currentScrollY.current = contentOffset.y;
    
    const maxOffset = contentSize.height - layoutMeasurement.height;
    const distanceFromBottom = maxOffset - contentOffset.y;
    const distanceFromTop = contentOffset.y;
    
    setIsNearBottom(distanceFromBottom < 100);
    setShowScrollButton(distanceFromBottom > SCROLL_BUTTON_THRESHOLD);
    
    if (distanceFromBottom < 50) {
      setUnreadCount(0);
    }

    // Load older messages when near top
    if (distanceFromTop < 300 && hasMoreMessages && !isLoadingOlderRef.current) {
      loadOlderMessages();
    }
  }, [hasMoreMessages, loadOlderMessages]);

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
    setUnreadCount(0);
  }, []);

  // Auto-scroll for new messages only if near bottom
  useEffect(() => {
    if (messages.length === 0) return;
    if (isNearBottom && savedScrollPosition === null) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length, isNearBottom, savedScrollPosition]);

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

  // ============= MESSAGE SENDING (ActionCable Only) =============
  
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !subscriptionReady || !id) return;

    const messageText = inputText.trim();
    setInputText('');
    
    if (isTyping && actionCableRef.current) {
      setIsTyping(false);
      actionCableRef.current.stopTyping(id);
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic message
    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId: tempId,
      content: messageText,
      created_at: new Date().toISOString(),
      is_system: false,
      from_support: true,
      message_type: 'text',
      user: {
        id: normalizeId(user?.id) || '',
        name: user?.display_name || user?.first_name || 'Support',
        role: 'support',
        avatar_url: user?.avatar_url,
      },
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      metadata: { temp_id: tempId },
      sendStatus: 'pending',
      retryData: {
        content: messageText,
        messageType: 'text',
      },
    };

    // Add to state immediately
    setMessages(prev => [...prev, optimisticMessage]);
    
    setTimeout(() => scrollToBottom(), 100);

    try {
      // FIXED: ActionCable-only sending
      const actionCable = actionCableRef.current;
      if (!actionCable || !isConnected) {
        // Add to retry queue
        console.log('📝 Connection not ready, adding to retry queue');
        addToPendingQueue(tempId, optimisticMessage);
        return;
      }
      
      await actionCable.perform('send_message', {
        conversation_id: id,
        content: messageText,
        message_type: 'text',
        metadata: { temp_id: tempId },
        temp_id: tempId,
      });

      console.log('✅ Message sent via ActionCable');
      
    } catch (error) {
      console.error('Send failed:', error);
      // Add to retry queue
      addToPendingQueue(tempId, optimisticMessage);
    }
  }, [inputText, subscriptionReady, id, user, isTyping, isConnected, scrollToBottom, addToPendingQueue]);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#f97316';
      case 'normal': return '#6b7280';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  // ============= RENDER FUNCTIONS =============
  
  const renderMessageStatus = (message: ChatMessage) => {
    if (!message.from_support || normalizeId(message.user.id) !== normalizeId(user?.id)) {
      return null;
    }

    if (message.sendStatus === 'failed') {
      return (
        <TouchableOpacity
          style={styles.messageStatusContainer}
          onPress={() => {
            if (message.tempId) {
              retryFailedMessage(message.tempId);
            }
          }}
        >
          <MaterialIcons name="error-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      );
    }

    if (message.sendStatus === 'pending') {
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
          item.sendStatus === 'pending' && styles.optimisticMessage,
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

  // ============= MAIN RENDER =============
  
  // FIXED: Show loading only for initial load, not "conversation not found"
  if (loadingConversation && !conversation && isInitialLoad) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
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
            <Text style={styles.headerTitle}>{conversation?.customer?.name || 'Customer'}</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.headerSubtitle}>
                {conversation ? `#${conversation.ticket_id} • ${conversation.status?.replace('_', ' ')}` : 'Loading...'}
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
          <TouchableOpacity
            style={styles.headerActionButton}
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
        {loadingMessages && isInitialLoad ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7B3F98" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={renderMessage}
              style={styles.messagesList}
              contentContainerStyle={{ paddingVertical: 8 }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
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
                      <Text style={styles.loadingOlderText}>Loading...</Text>
                    </View>
                  )}
                  {!hasMoreMessages && messages.length > 0 && (
                    <View style={styles.startOfConversationContainer}>
                      <Text style={styles.startOfConversationText}>Start of conversation</Text>
                    </View>
                  )}
                </View>
              )}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10,
              }}
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
              { paddingBottom: Platform.OS === 'ios' ? 34 : 8 }
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
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  messageContainer: { marginVertical: 2 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, position: 'relative' },
  supportMessage: { alignSelf: 'flex-end', backgroundColor: '#7B3F98', borderBottomRightRadius: 4 },
  customerMessage: { alignSelf: 'flex-start', backgroundColor: '#1F2C34', borderBottomLeftRadius: 4 },
  systemMessage: { alignSelf: 'center', backgroundColor: 'rgba(142, 142, 147, 0.15)', borderRadius: 12, maxWidth: '85%' },
  optimisticMessage: { opacity: 0.7 },
  failedMessage: { backgroundColor: '#5A2D3D' },
  systemIndicator: { marginRight: 8, alignSelf: 'center' },
  messageText: { fontSize: 16, lineHeight: 20, flexWrap: 'wrap' },
  supportMessageText: { color: '#fff' },
  customerMessageText: { color: '#fff' },
  systemMessageText: { color: '#8E8E93', fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  messageTime: { fontSize: 11 },
  supportMessageTime: { color: 'rgba(255, 255, 255, 0.7)' },
  customerMessageTime: { color: 'rgba(255, 255, 255, 0.7)' },
  systemMessageTime: { color: '#8E8E93' },
  messageStatusContainer: { marginLeft: 8 },
  scrollToBottomButton: { position: 'absolute', bottom: 80, right: 16, backgroundColor: '#7B3F98', borderRadius: 28, width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  scrollToBottomContent: { justifyContent: 'center', alignItems: 'center' },
  unreadBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inputContainer: { backgroundColor: 'rgba(11, 20, 27, 0.95)', paddingHorizontal: 8, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  textInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2C34', borderRadius: 25, paddingHorizontal: 4, paddingVertical: 6, marginRight: 8, maxHeight: 100, minHeight: 45 },
  inputButton: { padding: 8, marginLeft: 4 },
  textInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 8, paddingHorizontal: 8, textAlignVertical: 'center', maxHeight: 80 },
  attachButton: { padding: 8 },
  cameraButton: { padding: 8, marginRight: 4 },
  sendButton: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: '#7B3F98' },
  voiceButton: { backgroundColor: '#7B3F98' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8E8E93', fontSize: 16, marginTop: 16 },
});

// app/(support)/chat/[id].tsx - FIXED: ActionCable messaging, fast loading, WhatsApp-like scrolling

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
  Modal,
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

const INITIAL_MESSAGE_LIMIT = 20;
const PAGINATION_LIMIT = 15;
const REQUEST_TIMEOUT = 20000;
const SCROLL_BUTTON_THRESHOLD = 200;
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [5000, 15000, 30000];
const MESSAGES_CACHE_KEY = 'support_agent_messages_';
const CONVERSATION_CACHE_KEY = 'support_agent_conversation_';
const SCROLL_POSITION_KEY = 'support_agent_scroll_';

const normalizeId = (id: any): string => String(id);

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  timestamp: string;
  is_system: boolean;
  from_support: boolean;
  message_type: 'text' | 'system' | 'voice';
  user: {
    id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
  metadata?: any;
  optimistic?: boolean;
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
  conversation_id: string;
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

interface ScrollPosition {
  offset: number;
  timestamp: number;
  lastMessageId?: string;
}

export default function SupportChatScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const conversationId = normalizeId(rawId);
  const { user } = useUser();
  
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
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
  const [currentScrollOffset, setCurrentScrollOffset] = useState(0);
  const [savedScrollPosition, setSavedScrollPosition] = useState<ScrollPosition | null>(null);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const appState = useRef(AppState.currentState);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  const hasScrolledToBottomRef = useRef(false);
  const isChatVisible = useRef(true);
  const isChatFocused = useRef(true);
  
  // Pending messages queue for retry logic
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const retryQueueRef = useRef<PendingMessage[]>([]);
  const isProcessingRetryRef = useRef(false);

  // ============= STORAGE MANAGEMENT =============
  
  const saveMessagesToStorage = useCallback(async () => {
    if (!conversationId || messages.length === 0) return;
    
    try {
      const messagesData = {
        messages: messages.slice(-100), // Keep last 100 messages
        hasMoreMessages,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(
        `${MESSAGES_CACHE_KEY}${conversationId}`,
        JSON.stringify(messagesData)
      );
      
      console.log(`💾 Saved ${messagesData.messages.length} messages to storage`);
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }, [conversationId, messages, hasMoreMessages]);

  const loadMessagesFromStorage = useCallback(async (): Promise<boolean> => {
    if (!conversationId) return false;
    
    try {
      const messagesData = await AsyncStorage.getItem(`${MESSAGES_CACHE_KEY}${conversationId}`);
      
      if (!messagesData) return false;
      
      const parsed = JSON.parse(messagesData);
      const cacheAge = Date.now() - parsed.timestamp;
      
      if (cacheAge > CACHE_EXPIRY) {
        await AsyncStorage.removeItem(`${MESSAGES_CACHE_KEY}${conversationId}`);
        return false;
      }
      
      setMessages(parsed.messages);
      setHasMoreMessages(parsed.hasMoreMessages);
      
      parsed.messages.forEach((msg: ChatMessage) => {
        messageIdsRef.current.add(msg.id);
      });
      
      console.log(`✅ Loaded ${parsed.messages.length} messages from storage`);
      return true;
    } catch (error) {
      console.error('Failed to load messages from storage:', error);
      return false;
    }
  }, [conversationId]);

  const saveConversationToStorage = useCallback(async () => {
    if (!conversation) return;
    
    try {
      await AsyncStorage.setItem(
        `${CONVERSATION_CACHE_KEY}${conversationId}`,
        JSON.stringify({
          conversation,
          timestamp: Date.now(),
        })
      );
      
      console.log('💾 Saved conversation metadata to storage');
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }, [conversationId, conversation]);

  const loadConversationFromStorage = useCallback(async (): Promise<boolean> => {
    if (!conversationId) return false;
    
    try {
      const data = await AsyncStorage.getItem(`${CONVERSATION_CACHE_KEY}${conversationId}`);
      
      if (!data) return false;
      
      const parsed = JSON.parse(data);
      const cacheAge = Date.now() - parsed.timestamp;
      
      if (cacheAge > CACHE_EXPIRY) {
        await AsyncStorage.removeItem(`${CONVERSATION_CACHE_KEY}${conversationId}`);
        return false;
      }
      
      setConversation(parsed.conversation);
      console.log('✅ Loaded conversation metadata from storage');
      return true;
    } catch (error) {
      console.error('Failed to load conversation from storage:', error);
      return false;
    }
  }, [conversationId]);

  const saveScrollPosition = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const lastMessage = messages[messages.length - 1];
      const scrollData: ScrollPosition = {
        offset: currentScrollOffset,
        timestamp: Date.now(),
        lastMessageId: lastMessage?.id,
      };
      
      await AsyncStorage.setItem(
        `${SCROLL_POSITION_KEY}${conversationId}`,
        JSON.stringify(scrollData)
      );
      
      console.log('💾 Saved scroll position:', scrollData.offset);
    } catch (error) {
      console.error('Failed to save scroll position:', error);
    }
  }, [conversationId, currentScrollOffset, messages]);

  const loadScrollPosition = useCallback(async (): Promise<ScrollPosition | null> => {
    if (!conversationId) return null;
    
    try {
      const data = await AsyncStorage.getItem(`${SCROLL_POSITION_KEY}${conversationId}`);
      
      if (!data) return null;
      
      const parsed = JSON.parse(data) as ScrollPosition;
      const age = Date.now() - parsed.timestamp;
      
      // Only restore position if less than 1 hour old
      if (age < 60 * 60 * 1000) {
        console.log('✅ Loaded scroll position:', parsed.offset);
        return parsed;
      } else {
        await AsyncStorage.removeItem(`${SCROLL_POSITION_KEY}${conversationId}`);
        return null;
      }
    } catch (error) {
      console.error('Failed to load scroll position:', error);
      return null;
    }
  }, [conversationId]);

  // ============= APP STATE MANAGEMENT =============
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [conversationId, isConnected, messages]);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App came to foreground');
      isChatVisible.current = true;
      isChatFocused.current = true;
      
      if (!isConnected && conversationId) {
        await reconnectActionCable();
      }
      
      if (conversationId && isChatVisible.current) {
        await markCustomerMessagesAsReadIfVisible();
      }
      
      // Process retry queue
      await processRetryQueue();
      
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('📱 App went to background');
      isChatVisible.current = false;
      isChatFocused.current = false;
      
      await saveMessagesToStorage();
      await saveScrollPosition();
      
      if (isConnected && actionCableRef.current) {
        await actionCableRef.current.updatePresence('away');
      }
    }
    
    appState.current = nextAppState;
  }, [conversationId, isConnected, messages]);

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

      if (connected && conversationId) {
        await actionCableRef.current.joinConversation(conversationId);
        setupActionCableSubscriptions();
        
        // Process any pending messages
        await processRetryQueue();
      }
    } catch (error) {
      console.error('Failed to reconnect ActionCable:', error);
    }
  }, [conversationId, user]);

  // ============= AUTO MARK AS READ =============
  
  const markCustomerMessagesAsReadIfVisible = useCallback(async () => {
    if (!conversationId || !isConnected || !isChatVisible.current || !isChatFocused.current) {
      return;
    }
    
    if (appState.current !== 'active') {
      return;
    }

    try {
      const lastUnreadCustomerMessage = messages
        .filter(msg => !msg.from_support && !msg.read_at && msg.id !== lastReadMessageIdRef.current)
        .pop();

      if (lastUnreadCustomerMessage && actionCableRef.current) {
        console.log('📖 Auto-marking customer messages as read');
        
        await actionCableRef.current.perform('mark_message_read', {
          conversation_id: conversationId,
        });
        
        lastReadMessageIdRef.current = lastUnreadCustomerMessage.id;
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [conversationId, isConnected, messages]);

  useEffect(() => {
    if (isChatVisible.current && isChatFocused.current && appState.current === 'active' && messages.length > 0) {
      markCustomerMessagesAsReadIfVisible();
    }
  }, [messages, markCustomerMessagesAsReadIfVisible]);

  // Save messages whenever they change
  useEffect(() => {
    if (conversationId && messages.length > 0 && !loading) {
      saveMessagesToStorage();
    }
  }, [conversationId, messages, loading, saveMessagesToStorage]);

  // Save conversation metadata when it changes
  useEffect(() => {
    if (conversation) {
      saveConversationToStorage();
    }
  }, [conversation, saveConversationToStorage]);

  // ============= INITIALIZATION =============
  
  useEffect(() => {
    const initializeChat = async () => {
      // Try to load from storage first
      const [hasMessages, hasConversation, scrollPos] = await Promise.all([
        loadMessagesFromStorage(),
        loadConversationFromStorage(),
        loadScrollPosition(),
      ]);
      
      if (hasMessages && hasConversation) {
        setLoading(false);
        setIsInitialLoad(false);
        
        if (scrollPos) {
          setSavedScrollPosition(scrollPos);
          setShouldRestoreScroll(true);
        }
        
        // Setup ActionCable
        setTimeout(() => setupActionCableConnection(), 100);
        
        // Restore scroll or go to bottom
        setTimeout(() => {
          if (scrollPos && shouldRestoreScroll) {
            // Check if we should restore position or go to bottom
            const lastMessage = messages[messages.length - 1];
            if (scrollPos.lastMessageId === lastMessage?.id) {
              // Same last message, restore position
              flatListRef.current?.scrollToOffset({ 
                offset: scrollPos.offset, 
                animated: false 
              });
            } else {
              // New messages since last visit, go to bottom
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          } else {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
          hasScrolledToBottomRef.current = true;
        }, 200);
        
        // Background refresh
        setTimeout(() => loadConversation(false, false, true), 2000);
      } else {
        // Load from API
        loadConversation();
      }
    };

    initializeChat();
  }, [conversationId]);

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
    if (!isConnected || !conversationId || isProcessingRetryRef.current) return;
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
        
        const actionCable = ActionCableService.getInstance();
        await actionCable.perform('send_message', {
          conversation_id: conversationId,
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
  }, [isConnected, conversationId]);

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

  // ============= ACTIONCABLE SETUP =============
  
  const setupActionCableConnection = useCallback(async () => {
    if (!conversationId || !user) return;

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
        console.log('✅ ActionCable connected for support chat');
        
        await actionCableRef.current.joinConversation(conversationId);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setSubscriptionReady(true);
        setupActionCableSubscriptions();
        await requestCustomerPresence();
        
        // Process any pending messages
        await processRetryQueue();
      }
    } catch (error) {
      console.error('Failed to initialize ActionCable:', error);
      setIsConnected(false);
      setSubscriptionReady(false);
    }
  }, [conversationId, user, processRetryQueue]);

  useEffect(() => {
    if (!conversationId || !user) return;

    setupActionCableConnection();

    return () => {
      if (actionCableRef.current && conversationId) {
        actionCableRef.current.leaveConversation(conversationId);
      }
      
      actionCableSubscriptions.current.forEach(unsub => {
        if (unsub) unsub();
      });
      actionCableSubscriptions.current = [];
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      retryTimeoutsRef.current.clear();
      
      setSubscriptionReady(false);
    };
  }, [conversationId, user, setupActionCableConnection]);

  const requestCustomerPresence = useCallback(async () => {
    if (!conversationId) return;

    try {
      const actionCable = actionCableRef.current;
      if (actionCable) {
        await actionCable.perform('get_user_presence', {
          conversation_id: conversationId,
        });
      }
    } catch (error) {
      console.error('Failed to request customer presence:', error);
    }
  }, [conversationId]);

  // ============= ACTIONCABLE SUBSCRIPTIONS =============
  
  const setupActionCableSubscriptions = () => {
    if (!actionCableRef.current || !conversationId) return;

    const actionCable = actionCableRef.current;

    actionCableSubscriptions.current.forEach(unsub => {
      if (unsub) unsub();
    });
    actionCableSubscriptions.current = [];

    // New message subscription
    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      console.log('📨 ActionCable message received:', data);
      
      if (data.conversation_id !== conversationId || !data.message) return;
      
      const messageData = data.message;
      const messageId = normalizeId(messageData.id);
      const tempId = messageData.temp_id || messageData.metadata?.temp_id;
      
      // Check for duplicates
      if (messageIdsRef.current.has(messageId)) {
        console.log('⏭️ Skipping duplicate message:', messageId);
        return;
      }
      
      messageIdsRef.current.add(messageId);
      
      setMessages(prev => {
        let updatedMessages = prev;
        
        // Remove optimistic message if temp_id matches
        if (tempId) {
          updatedMessages = prev.filter(msg => msg.tempId !== tempId);
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
          optimistic: false,
          delivered_at: messageData.delivered_at,
          read_at: messageData.read_at,
          sendStatus: messageData.read_at ? 'read' : messageData.delivered_at ? 'delivered' : 'sent',
        };

        return [...updatedMessages, newMessage];
      });
      
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

    // Message acknowledged
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

    // Conversation read
    const unsubRead = actionCable.subscribe('conversation_read', (data) => {
      if (data.conversation_id === conversationId) {
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
      if (data.conversation_id === conversationId && normalizeId(data.user_id) !== normalizeId(user?.id)) {
        setCustomerPresence(prev => ({
          ...prev,
          is_typing: data.typing,
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubTyping);

    // Ticket status changed
    const unsubStatus = actionCable.subscribe('ticket_status_changed', (data) => {
      if (data.conversation_id === conversationId) {
        console.log('🎫 Ticket status changed:', data.new_status);
        
        setConversation(prev => prev ? {
          ...prev,
          status: data.new_status
        } : prev);
        
        if (data.system_message) {
          const systemMessage: ChatMessage = {
            id: normalizeId(data.system_message.id),
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
          
          if (!messageIdsRef.current.has(systemMessage.id)) {
            messageIdsRef.current.add(systemMessage.id);
            setMessages(prev => [...prev, systemMessage]);
          }
        }
      }
    });
    actionCableSubscriptions.current.push(unsubStatus);

    // Customer presence
    const unsubPresence = actionCable.subscribe('user_presence_changed', (data) => {
      if (data.conversation_id === conversationId && normalizeId(data.user_id) !== normalizeId(user?.id)) {
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
      processRetryQueue();
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
      setSubscriptionReady(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    console.log('✅ ActionCable subscriptions configured');
  };

  // ============= MESSAGE LOADING =============
  
  const loadConversation = useCallback(async (isRefresh = false, loadOlder = false, backgroundSync = false) => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    console.log(`🌐 Loading conversation: ${conversationId}`, { isRefresh, loadOlder, backgroundSync });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, REQUEST_TIMEOUT);

    try {
      if (!backgroundSync) {
        if (isRefresh) {
          setRefreshing(true);
        } else if (loadOlder) {
          setLoadingOlder(true);
          isLoadingMoreRef.current = true;
        } else {
          setLoading(true);
        }
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

      if (response.data.success) {
        const conversationData = response.data.conversation;
        const messagesData = response.data.messages || [];
        const pagination = response.data.pagination || {};

        const normalizedMessages = messagesData.map((msg: any) => ({
          ...msg,
          id: normalizeId(msg.id),
        }));

        // Track all message IDs
        normalizedMessages.forEach((msg: any) => {
          messageIdsRef.current.add(msg.id);
        });

        if (isRefresh || (!loadOlder && !backgroundSync && messages.length === 0)) {
          setMessages(normalizedMessages);
          setHasMoreMessages(pagination.has_more || false);
          setIsInitialLoad(false);

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
            hasScrolledToBottomRef.current = true;
          }, 100);
          
        } else if (loadOlder) {
          setMessages(prev => {
            const combined = [...normalizedMessages, ...prev];
            const uniqueMessages = Array.from(
              new Map(combined.map(m => [m.id, m])).values()
            );
            return uniqueMessages;
          });
          setHasMoreMessages(pagination.has_more || false);
          
        } else if (backgroundSync) {
          // Merge new messages
          setMessages(prev => {
            const prevIds = new Set(prev.map(m => m.id));
            const newMessages = normalizedMessages.filter((m: any) => !prevIds.has(m.id));
            if (newMessages.length > 0) {
              return [...prev, ...newMessages];
            }
            return prev;
          });
        }

        if (conversationData) {
          setConversation(conversationData);
          
          if (conversationData.customer?.presence) {
            setCustomerPresence({
              status: conversationData.customer.presence.status || 'offline',
              last_seen: conversationData.customer.presence.last_seen,
            });
          }
        }

        console.log(`✅ Loaded ${normalizedMessages.length} messages`);
      }
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Failed to load conversation:', error);
      if (!backgroundSync) {
        setConnectionError(true);
      }
    } finally {
      if (!backgroundSync) {
        setLoading(false);
        setLoadingOlder(false);
        setRefreshing(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [conversationId, messages]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreMessages || loadingOlder) {
      return;
    }
    
    console.log('Loading older messages for conversation:', conversationId);
    await loadConversation(false, true);
  }, [loadConversation, conversationId, loadingOlder, hasMoreMessages]);

  const handleRefresh = useCallback(async () => {
    messageIdsRef.current.clear();
    pendingMessagesRef.current.clear();
    retryQueueRef.current = [];
    hasScrolledToBottomRef.current = false;
    
    await AsyncStorage.multiRemove([
      `${MESSAGES_CACHE_KEY}${conversationId}`,
      `${CONVERSATION_CACHE_KEY}${conversationId}`,
      `${SCROLL_POSITION_KEY}${conversationId}`,
    ]);
    
    await loadConversation(true);
  }, [loadConversation, conversationId]);

  // ============= SCROLL MANAGEMENT =============
  
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentOffset = contentOffset.y;
    const maxOffset = contentSize.height - layoutMeasurement.height;
    const distanceFromBottom = maxOffset - currentOffset;
    const distanceFromTop = currentOffset;
    
    setCurrentScrollOffset(currentOffset);
    setIsNearBottom(distanceFromBottom < 100);
    setShowScrollButton(distanceFromBottom > SCROLL_BUTTON_THRESHOLD);
    
    if (distanceFromBottom < 50) {
      setUnreadCount(0);
    }

    if (distanceFromTop < 300 && hasMoreMessages && !isLoadingMoreRef.current) {
      loadOlderMessages();
    }
  }, [hasMoreMessages, loadOlderMessages]);

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

  // ============= TYPING INDICATOR =============
  
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    
    if (!isTyping && text.trim() && actionCableRef.current && conversationId) {
      setIsTyping(true);
      actionCableRef.current.startTyping({ conversationId });
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && actionCableRef.current && conversationId) {
        setIsTyping(false);
        actionCableRef.current.stopTyping(conversationId);
      }
    }, 2000);
  }, [isTyping, conversationId]);

  // ============= MESSAGE SENDING (ACTIONCABLE ONLY) =============
  
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !conversationId) return;

    const messageText = inputText.trim();
    setInputText('');
    
    if (isTyping && actionCableRef.current) {
      setIsTyping(false);
      actionCableRef.current.stopTyping(conversationId);
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId,
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
      metadata: {},
      optimistic: true,
      sendStatus: 'pending',
      retryData: {
        content: messageText,
        messageType: 'text',
      },
    };

    setMessages(prev => [...prev, optimisticMessage]);
    
    setTimeout(() => scrollToBottom(), 100);

    if (isConnected && subscriptionReady) {
      try {
        const actionCable = ActionCableService.getInstance();
        await actionCable.perform('send_message', {
          conversation_id: conversationId,
          content: messageText,
          message_type: 'text',
          temp_id: tempId,
        });
        
        console.log('✅ Message sent via ActionCable');
      } catch (error) {
        console.error('Failed to send message:', error);
        addToPendingQueue(tempId, optimisticMessage);
      }
    } else {
      // Add to retry queue
      console.log('📝 Connection not ready, adding to retry queue');
      addToPendingQueue(tempId, optimisticMessage);
    }
  }, [inputText, conversationId, user, isConnected, subscriptionReady, isTyping, scrollToBottom, addToPendingQueue]);

  // ============= QUICK ACTIONS =============
  
  const handleQuickAction = async (action: string) => {
    if (!conversationId || !conversation) return;

    try {
      switch (action) {
        case 'assign_to_me':
          await api.post(`/api/v1/support/tickets/${conversationId}/assign`, {
            agent_id: normalizeId(user?.id)
          });
          console.log('Ticket assigned successfully');
          loadConversation(true);
          break;
        
        case 'escalate':
          console.log('Escalation feature coming soon');
          break;
        
        case 'close':
          await api.patch(`/api/v1/conversations/${conversationId}/close`);
          console.log('Ticket closed successfully');
          loadConversation(true);
          break;
        
        case 'priority_high':
          await api.patch(`/api/v1/support/tickets/${conversationId}/priority`, {
            priority: 'high'
          });
          console.log('Priority updated successfully');
          loadConversation(true);
          break;
      }
    } catch (error) {
      console.error('Quick action failed:', error);
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
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  }, []);

  const renderDateSeparator = useCallback((dateStr: string) => (
    <View style={styles.dateSeparator} key={`date-${dateStr}`}>
      <View style={styles.dateSeparatorLine} />
      <View style={styles.dateSeparatorBadge}>
        <Text style={styles.dateSeparatorText}>{formatDateHeader(dateStr)}</Text>
      </View>
      <View style={styles.dateSeparatorLine} />
    </View>
  ), [formatDateHeader]);

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
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        />
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
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
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
                inputText.trim() ? styles.sendButtonActive : styles.voiceButton,
              ]}
              onPress={inputText.trim() ? sendMessage : undefined}
              disabled={!inputText.trim()}
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
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, paddingHorizontal: 16 },
  dateSeparatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  dateSeparatorBadge: { backgroundColor: 'rgba(31, 44, 52, 0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  dateSeparatorText: { color: '#8E8E93', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  messageContainer: { marginVertical: 2 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, position: 'relative' },
  supportMessage: { alignSelf: 'flex-end', backgroundColor: '#7B3F98', borderBottomRightRadius: 4 },
  customerMessage: { alignSelf: 'flex-start', backgroundColor: '#1F2C34', borderBottomLeftRadius: 4 },
  systemMessage: { alignSelf: 'center', backgroundColor: 'rgba(142, 142, 147, 0.15)', borderRadius: 12, maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginVertical: 6, borderWidth: 1, borderColor: 'rgba(142, 142, 147, 0.2)' },
  optimisticMessage: { opacity: 0.7 },
  failedMessage: { backgroundColor: '#5A2D3D' },
  systemIndicator: { marginRight: 8, alignSelf: 'center' },
  messageText: { fontSize: 16, lineHeight: 20, flexWrap: 'wrap' },
  supportMessageText: { color: '#fff' },
  customerMessageText: { color: '#fff' },
  systemMessageText: { color: '#8E8E93', fontSize: 14, fontStyle: 'italic', textAlign: 'center', flexShrink: 1 },
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
  modalBackdrop: { flex: 1 },
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
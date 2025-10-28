// app/(drawer)/support.tsx - FIXED: ActionCable-only message sending with retry logic

import {
  Feather,
  MaterialIcons,
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useUser } from '../../context/UserContext';
import { accountManager } from '../../lib/AccountManager';
import api from '../../lib/api';
import { NavigationHelper } from '../../lib/helpers/navigation';
import ActionCableService from '../../lib/services/ActionCableService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INITIAL_MESSAGE_LIMIT = 20;
const PAGINATION_LIMIT = 15;
const REQUEST_TIMEOUT = 20000;
const SCROLL_THRESHOLD = 0.1;
const CACHE_STALE_TIME = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [5000, 15000, 30000];
const SCROLL_BUTTON_THRESHOLD = 200;
const MESSAGES_CACHE_KEY = 'support_customer_messages_';
const CONVERSATION_CACHE_KEY = 'support_customer_conversation_';
const SCROLL_POSITION_KEY = 'support_scroll_position_';

const normalizeId = (id: any): string => String(id);

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
  retryData?: {
    content: string;
    messageType: string;
    metadata?: any;
  };
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

interface PendingMessage {
  tempId: string;
  message: Message;
  retryCount: number;
  lastAttempt: number;
}

type InquiryType = 'basic' | 'package';

export default function SupportScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
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
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [agentPresence, setAgentPresence] = useState<AgentPresence>({
    status: 'offline',
  });
  
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [currentScrollOffset, setCurrentScrollOffset] = useState(0);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(true);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);
  
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
  const cacheUnsubscribeRef = useRef<(() => void) | null>(null);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const conversationLoadedRef = useRef(false);
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const appState = useRef(AppState.currentState);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedInitialMessages = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const hasScrolledToBottomRef = useRef(false);
  const isChatVisible = useRef(true);
  const isChatFocused = useRef(true);
  
  // FIXED: Pending messages queue for retry logic
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const retryQueueRef = useRef<PendingMessage[]>([]);
  const isProcessingRetryRef = useRef(false);

  // ============= STORAGE MANAGEMENT =============
  
  const saveConversationToStorage = useCallback(async () => {
    if (!conversationId || messages.length === 0) return;
    
    try {
      const cacheData = {
        conversationId,
        hasActiveTicket,
        ticketStatus,
        selectedPackage,
        inquiryType,
        timestamp: Date.now(),
      };
      
      const messagesData = {
        messages: messages.slice(-100), // Keep last 100 messages
        hasMoreMessages,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.multiSet([
        [`${CONVERSATION_CACHE_KEY}${user?.id}`, JSON.stringify(cacheData)],
        [`${MESSAGES_CACHE_KEY}${conversationId}`, JSON.stringify(messagesData)],
      ]);
      
      console.log('💾 Saved conversation to storage');
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }, [conversationId, messages, hasActiveTicket, ticketStatus, selectedPackage, inquiryType, hasMoreMessages, user?.id]);

  const loadConversationFromStorage = useCallback(async (): Promise<boolean> => {
    try {
      const keys = await AsyncStorage.multiGet([
        `${CONVERSATION_CACHE_KEY}${user?.id}`,
      ]);
      
      const conversationData = keys[0][1] ? JSON.parse(keys[0][1]) : null;
      
      if (!conversationData) return false;
      
      const cacheAge = Date.now() - conversationData.timestamp;
      if (cacheAge > CACHE_STALE_TIME) {
        await clearStoredConversation();
        return false;
      }
      
      setConversationId(conversationData.conversationId);
      setHasActiveTicket(conversationData.hasActiveTicket);
      setTicketStatus(conversationData.ticketStatus);
      setSelectedPackage(conversationData.selectedPackage);
      setInquiryType(conversationData.inquiryType);
      
      // Load messages
      const messagesData = await AsyncStorage.getItem(`${MESSAGES_CACHE_KEY}${conversationData.conversationId}`);
      if (messagesData) {
        const parsed = JSON.parse(messagesData);
        setMessages(parsed.messages);
        setHasMoreMessages(parsed.hasMoreMessages);
        
        parsed.messages.forEach((msg: Message) => {
          messageIdsRef.current.add(normalizeId(msg.id));
        });
        
        conversationLoadedRef.current = true;
        hasFetchedInitialMessages.current = true;
      }
      
      console.log('✅ Loaded conversation from storage');
      return true;
    } catch (error) {
      console.error('Failed to load conversation from storage:', error);
      return false;
    }
  }, [user?.id]);

  const clearStoredConversation = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const supportKeys = keys.filter(key => 
        key.startsWith(CONVERSATION_CACHE_KEY) ||
        key.startsWith(MESSAGES_CACHE_KEY) ||
        key.startsWith(SCROLL_POSITION_KEY)
      );
      
      if (supportKeys.length > 0) {
        await AsyncStorage.multiRemove(supportKeys);
      }
      
      console.log('🧹 Cleared stored conversation');
    } catch (error) {
      console.error('Failed to clear stored conversation:', error);
    }
  };

  const saveScrollPosition = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      await AsyncStorage.setItem(
        `${SCROLL_POSITION_KEY}${conversationId}`,
        JSON.stringify({
          offset: currentScrollOffset,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Failed to save scroll position:', error);
    }
  }, [conversationId, currentScrollOffset]);

  const loadScrollPosition = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const data = await AsyncStorage.getItem(`${SCROLL_POSITION_KEY}${conversationId}`);
      if (data) {
        const parsed = JSON.parse(data);
        const age = Date.now() - parsed.timestamp;
        
        // Only restore position if less than 1 hour old
        if (age < 60 * 60 * 1000) {
          setSavedScrollPosition(parsed.offset);
          setShouldScrollToEnd(false);
        } else {
          setShouldScrollToEnd(true);
        }
      }
    } catch (error) {
      console.error('Failed to load scroll position:', error);
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
        await markMessagesAsReadIfVisible();
      }
      
      // Process retry queue
      await processRetryQueue();
      
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('📱 App went to background');
      isChatVisible.current = false;
      isChatFocused.current = false;
      
      await saveConversationToStorage();
      await saveScrollPosition();
      
      if (isConnected) {
        const actionCable = ActionCableService.getInstance();
        await actionCable.updatePresence('away');
      }
    }
    
    appState.current = nextAppState;
  }, [conversationId, isConnected, messages]);

  const reconnectActionCable = useCallback(async () => {
    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount || !user) return;

      const actionCable = ActionCableService.getInstance();
      const connected = await actionCable.connect({
        token: currentAccount.token,
        userId: normalizeId(user.id),
        autoReconnect: true,
      });

      if (connected && conversationId) {
        await actionCable.joinConversation(conversationId);
        setupActionCableSubscriptions();
        setIsConnected(true);
        setSubscriptionReady(true);
        
        // Process any pending messages
        await processRetryQueue();
      }
    } catch (error) {
      console.error('Failed to reconnect ActionCable:', error);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => reconnectActionCable(), 5000);
    }
  }, [conversationId, user]);

  // ============= MESSAGE RETRY LOGIC =============
  
  const addToPendingQueue = useCallback((tempId: string, message: Message) => {
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
          content: pendingMessage.message.retryData?.content || pendingMessage.message.text,
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

  // ============= INITIALIZATION =============
  
  useEffect(() => {
    const initializeConversation = async () => {
      const hasSavedState = await loadConversationFromStorage();
      
      if (hasSavedState) {
        setLoadingMessages(false);
        setIsInitialLoad(false);
        
        await loadScrollPosition();
        
        setTimeout(() => {
          if (conversationId) {
            setupActionCableConnection();
          }
        }, 100);
        
        // Restore scroll position or scroll to bottom
        setTimeout(() => {
          if (savedScrollPosition !== null && !shouldScrollToEnd) {
            flatListRef.current?.scrollToOffset({ 
              offset: savedScrollPosition, 
              animated: false 
            });
          } else {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
          hasScrolledToBottomRef.current = true;
        }, 200);
      } else {
        checkActiveTicket();
      }
    };

    initializeConversation();
  }, []);

  // ============= AUTO MARK AS READ =============
  
  const markMessagesAsReadIfVisible = useCallback(async () => {
    if (!conversationId || !isConnected || !isChatVisible.current || !isChatFocused.current) {
      return;
    }
    
    if (appState.current !== 'active') {
      return;
    }

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

  useEffect(() => {
    if (isChatVisible.current && isChatFocused.current && appState.current === 'active' && messages.length > 0) {
      markMessagesAsReadIfVisible();
    }
  }, [messages, markMessagesAsReadIfVisible]);

  // Save messages whenever they change
  useEffect(() => {
    if (conversationId && messages.length > 0 && !loadingMessages) {
      saveConversationToStorage();
    }
  }, [conversationId, messages, loadingMessages, saveConversationToStorage]);

  // ============= ACTIONCABLE SETUP =============
  
  const setupActionCableConnection = useCallback(async () => {
    if (!conversationId || !user) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

      const actionCable = ActionCableService.getInstance();
      
      const connected = await actionCable.connect({
        token: currentAccount.token,
        userId: normalizeId(user.id),
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        console.log('✅ ActionCable connected');

        await actionCable.joinConversation(conversationId);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setSubscriptionReady(true);
        setupActionCableSubscriptions();
        await requestAgentPresence();
        
        if (presenceCheckInterval.current) {
          clearInterval(presenceCheckInterval.current);
        }
        presenceCheckInterval.current = setInterval(() => {
          requestAgentPresence();
        }, 30000);
        
        // Process any pending messages
        await processRetryQueue();
      }
    } catch (error) {
      console.error('Failed to setup ActionCable:', error);
      setIsConnected(false);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => setupActionCableConnection(), 5000);
    }
  }, [conversationId, user, processRetryQueue]);

  useEffect(() => {
    if (conversationId && user && !isConnected) {
      setupActionCableConnection();
    }

    return () => {
      if (conversationId && isConnected) {
        const actionCable = ActionCableService.getInstance();
        actionCable.leaveConversation(conversationId);
      }
      
      actionCableSubscriptions.current.forEach(unsub => {
        if (unsub) unsub();
      });
      actionCableSubscriptions.current = [];
      
      if (presenceCheckInterval.current) {
        clearInterval(presenceCheckInterval.current);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      setSubscriptionReady(false);
    };
  }, [conversationId, user, isConnected, setupActionCableConnection]);

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

  // ============= ACTIONCABLE SUBSCRIPTIONS =============
  
  const setupActionCableSubscriptions = () => {
    if (!conversationId) return;

    const actionCable = ActionCableService.getInstance();

    actionCableSubscriptions.current.forEach(unsub => {
      if (unsub) unsub();
    });
    actionCableSubscriptions.current = [];

    // New message subscription
    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      console.log('📨 Message received:', data);
      
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
        
        const newMessage: Message = {
          id: messageId,
          text: messageData.content || '',
          timestamp: messageData.timestamp || new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          }),
          isSupport: messageData.from_support || false,
          type: messageData.message_type || 'text',
          packageCode: messageData.metadata?.package_code,
          isTagged: !!messageData.metadata?.package_code,
          delivered_at: messageData.delivered_at,
          read_at: messageData.read_at,
          sendStatus: messageData.read_at ? 'read' : messageData.delivered_at ? 'delivered' : 'sent',
          created_at: messageData.created_at || new Date().toISOString(),
        };
        
        return [...updatedMessages, newMessage];
      });
      
      if (messageData.from_support) {
        if (isNearBottom) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          setUnreadCount(prev => prev + 1);
        }
        
        if (isChatVisible.current && isChatFocused.current && appState.current === 'active') {
          setTimeout(() => markMessagesAsReadIfVisible(), 500);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubNewMessage);

    // Message acknowledged subscription
    const unsubAcknowledged = actionCable.subscribe('message_acknowledged', (data) => {
      if (data.message_id) {
        const normalizedId = normalizeId(data.message_id);
        setMessages(prev => prev.map(msg => {
          if (msg.id === normalizedId || msg.tempId === normalizedId) {
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

    // Other subscriptions (typing, presence, etc.)
    const unsubTyping = actionCable.subscribe('typing_indicator', (data) => {
      if (data.conversation_id === conversationId && normalizeId(data.user_id) !== normalizeId(user?.id)) {
        setAgentPresence(prev => ({
          ...prev,
          is_typing: data.typing,
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubTyping);

    const unsubPresence = actionCable.subscribe('user_presence_changed', (data) => {
      if (data.conversation_id === conversationId && normalizeId(data.user_id) !== normalizeId(user?.id)) {
        console.log('👤 Agent presence update:', data);
        setAgentPresence({
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
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => reconnectActionCable(), 5000);
    });
    actionCableSubscriptions.current.push(unsubLost);

    console.log('✅ ActionCable subscriptions configured');
  };

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

  // ============= MESSAGE LOADING =============
  
  const loadConversationMessages = useCallback(async (conversationId: string, isRefresh = false, loadOlder = false) => {
    try {
      if (!isRefresh && !loadOlder && hasFetchedInitialMessages.current && messages.length > 0) {
        console.log('Skipping message load - already have messages');
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
        isLoadingMoreRef.current = true;
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
          id: normalizeId(msg.id),
          text: msg.content,
          timestamp: msg.timestamp || new Date(msg.created_at).toLocaleTimeString('en-US', {
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

        // Track all message IDs
        newMessages.forEach(msg => {
          messageIdsRef.current.add(msg.id);
        });

        if (isRefresh || (!loadOlder && !hasFetchedInitialMessages.current)) {
          setMessages(newMessages);
          setHasMoreMessages(pagination.has_more || false);
          
          hasFetchedInitialMessages.current = true;
          await saveConversationToStorage();
          
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
            hasScrolledToBottomRef.current = true;
          }, 100);
          
        } else if (loadOlder) {
          setMessages(prev => {
            const combined = [...newMessages, ...prev];
            const uniqueMessages = Array.from(
              new Map(combined.map(m => [m.id, m])).values()
            );
            return uniqueMessages;
          });
          setHasMoreMessages(pagination.has_more || false);
        }

        const conversationData = response.data.conversation;
        if (conversationData?.assigned_agent) {
          setTicketStatus('active');
          
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
            id: normalizeId(conversationPackage.id),
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

        setIsInitialLoad(false);
        console.log(`✅ Loaded ${newMessages.length} messages`);
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Failed to load conversation:', error);
      setConnectionError(true);

      if (!isRefresh && !loadOlder && messages.length === 0) {
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
      setIsInitialLoad(false);
      isLoadingMoreRef.current = false;
    }
  }, [messages, saveConversationToStorage]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingMoreRef.current || !conversationId || !hasMoreMessages || loadingOlder) {
      return;
    }
    
    await loadConversationMessages(conversationId, false, true);
  }, [loadConversationMessages, conversationId, loadingOlder, hasMoreMessages]);

  const handleRefresh = useCallback(async () => {
    if (!conversationId) return;
    
    messageIdsRef.current.clear();
    pendingMessagesRef.current.clear();
    retryQueueRef.current = [];
    hasFetchedInitialMessages.current = false;
    hasScrolledToBottomRef.current = false;
    await clearStoredConversation();
    await loadConversationMessages(conversationId, true);
  }, [loadConversationMessages, conversationId]);

  const checkActiveTicket = useCallback(async () => {
    try {
      setLoadingMessages(true);
      
      const response = await api.get('/api/v1/conversations/active_support');
      
      if (response.data.success && response.data.conversation_id) {
        const activeConvId = normalizeId(response.data.conversation_id);
        setConversationId(activeConvId);
        setHasActiveTicket(true);
        setTicketStatus('active');
        
        await loadConversationMessages(activeConvId);
        
        return;
      }
      
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
  }, [autoSelectPackage, loadConversationMessages]);

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

  // Package loading methods
  const loadUserPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      
      const response = await api.get('/api/v1/packages', {
        params: {
          per_page: 100,
          page: 1
        }
      });

      if (response.data && response.data.success) {
        const packages = response.data.data.map((pkg: any) => ({
          id: normalizeId(pkg.id || ''),
          code: pkg.code || '',
          state: pkg.state || 'unknown',
          state_display: pkg.state_display || 'Unknown',
          receiver_name: pkg.receiver_name || 'Unknown Receiver',
          route_description: pkg.route_description || 'Route information unavailable',
          cost: Number(pkg.cost) || 0,
          delivery_type: pkg.delivery_type || 'agent',
          created_at: pkg.created_at || new Date().toISOString(),
        }));

        setUserPackages(packages);
        setFilteredPackages(packages);

        if (preFilledPackageCode) {
          const preSelectedPackage = packages.find((pkg: Package) => 
            pkg.code === preFilledPackageCode || pkg.id === preFilledPackageId
          );
          
          if (preSelectedPackage) {
            setSelectedPackage(preSelectedPackage);
            setInquiryType('package');
          }
        }
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  }, [preFilledPackageCode, preFilledPackageId]);

  const filterPackages = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredPackages(userPackages);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const filtered = userPackages.filter(pkg => 
      pkg.code.toLowerCase().includes(lowercaseQuery) ||
      pkg.receiver_name.toLowerCase().includes(lowercaseQuery) ||
      pkg.route_description.toLowerCase().includes(lowercaseQuery) ||
      pkg.state_display.toLowerCase().includes(lowercaseQuery)
    );

    setFilteredPackages(filtered);
  }, [userPackages]);

  const handlePackageSearchChange = useCallback((text: string) => {
    setPackageSearchQuery(text);
    filterPackages(text);
  }, [filterPackages]);

  const handlePackageSelect = useCallback((pkg: Package) => {
    setSelectedPackage(pkg);
    setShowPackageSearch(false);
    setPackageSearchQuery('');
  }, []);

  const handleInquiryTypeChange = useCallback((type: InquiryType) => {
    setInquiryType(type);
    if (type === 'basic') {
      setSelectedPackage(null);
      setShowPackageSearch(false);
    } else {
      if (userPackages.length === 0) {
        loadUserPackages();
      }
    }
  }, [userPackages.length, loadUserPackages]);

  const handleShowPackageSearch = useCallback(() => {
    setShowPackageSearch(true);
    if (userPackages.length === 0) {
      loadUserPackages();
    }
  }, [userPackages.length, loadUserPackages]);

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
        const newConversationId = normalizeId(response.data.conversation_id);
        setConversationId(newConversationId);
        setTicketStatus('pending');
        setHasActiveTicket(true);
        
        await saveConversationToStorage();
        await setupActionCableConnection();
        
        let retries = 0;
        while (!subscriptionReady && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        }
        
        return newConversationId;
      }
      
      throw new Error(response.data.message || 'Failed to create support ticket');
    } catch (error: any) {
      console.error('Failed to create support ticket:', error);
      throw error;
    }
  }, [conversationId, inquiryType, selectedPackage?.code, subscriptionReady, saveConversationToStorage, setupActionCableConnection]);

  // FIXED: ActionCable-only message sending
  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    const messageContent = inputText.trim();
    setInputText('');
    
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
    }
    
    try {
      const convId = await ensureConversation();
      
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
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
        packageCode: selectedPackage?.code,
        isTagged: !!selectedPackage,
        optimistic: true,
        sendStatus: 'pending',
        created_at: new Date().toISOString(),
        retryData: {
          content: messageContent,
          messageType: 'text',
          metadata: selectedPackage ? { package_code: selectedPackage.code } : undefined,
        },
      };

      setMessages(prev => [...prev, optimisticMessage]);
      
      setTimeout(() => scrollToBottom(), 100);

      if (isConnected && subscriptionReady) {
        const actionCable = ActionCableService.getInstance();
        await actionCable.perform('send_message', {
          conversation_id: convId,
          content: messageContent,
          message_type: 'text',
          metadata: selectedPackage ? { package_code: selectedPackage.code } : undefined,
          temp_id: tempId,
        });
        
        console.log('✅ Message sent via ActionCable');
      } else {
        // Add to retry queue
        console.log('📝 Connection not ready, adding to retry queue');
        addToPendingQueue(tempId, optimisticMessage);
      }
      
      setTicketStatus('pending');
      setHasActiveTicket(true);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Message is already in optimistic state, retry logic will handle it
    }
  }, [inputText, ensureConversation, selectedPackage, isConnected, subscriptionReady, isTyping, sendTypingIndicator, scrollToBottom, addToPendingQueue]);

  const handleInputTextChange = useCallback((text: string) => {
    setInputText(text);
    
    if (text.trim() && conversationId) {
      handleTyping();
    }
  }, [conversationId, handleTyping]);

  // Modal handlers
  const createBasicInquiryTicket = async () => {
    if (!inquiryText.trim()) return;

    setIsLoading(true);
    
    try {
      setInquiryType('basic');
      setSelectedPackage(null);
      
      const convId = await ensureConversation();
      
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const optimisticMessage: Message = {
        id: tempId,
        tempId: tempId,
        text: inquiryText.trim(),
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
        retryData: {
          content: inquiryText.trim(),
          messageType: 'text',
        },
      };

      setMessages(prev => [...prev, optimisticMessage]);
      closeAllModals();
      
      setTimeout(() => scrollToBottom(), 100);

      if (isConnected && subscriptionReady) {
        const actionCable = ActionCableService.getInstance();
        await actionCable.perform('send_message', {
          conversation_id: convId,
          content: inquiryText.trim(),
          message_type: 'text',
          temp_id: tempId,
        });
      } else {
        addToPendingQueue(tempId, optimisticMessage);
      }
      
      setTicketStatus('pending');
      
    } catch (error) {
      console.error('Failed to create basic inquiry:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createPackageInquiryTicket = async () => {
    if (!selectedPackage || !packageInquiry.trim()) return;

    setIsLoading(true);
    
    try {
      setInquiryType('package');
      
      const convId = await ensureConversation();
      
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const optimisticMessage: Message = {
        id: tempId,
        tempId: tempId,
        text: packageInquiry.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: false,
        type: 'text',
        packageCode: selectedPackage.code,
        isTagged: true,
        optimistic: true,
        sendStatus: 'pending',
        created_at: new Date().toISOString(),
        retryData: {
          content: packageInquiry.trim(),
          messageType: 'text',
          metadata: { package_code: selectedPackage.code },
        },
      };

      setMessages(prev => [...prev, optimisticMessage]);
      closeAllModals();
      
      setTimeout(() => scrollToBottom(), 100);

      if (isConnected && subscriptionReady) {
        const actionCable = ActionCableService.getInstance();
        await actionCable.perform('send_message', {
          conversation_id: convId,
          content: packageInquiry.trim(),
          message_type: 'text',
          metadata: { package_code: selectedPackage.code },
          temp_id: tempId,
        });
      } else {
        addToPendingQueue(tempId, optimisticMessage);
      }
      
      setTicketStatus('pending');
      
    } catch (error) {
      console.error('Failed to create package inquiry:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Other utility functions
  const closeAllModals = () => {
    setShowTicketModal(false);
    setShowInquiryModal(false);
    setShowPackageModal(false);
    setShowPackageSearch(false);
    setInquiryText('');
    setPackageInquiry('');
    setPackageSearchQuery('');
  };

  const handleBasicInquiry = () => {
    setShowTicketModal(false);
    setShowInquiryModal(true);
  };

  const handlePackageInquiry = () => {
    setShowTicketModal(false);
    setShowPackageModal(true);
  };

  const getStateBadgeColor = (state: string) => {
    switch (state) {
      case 'pending_unpaid': return '#ef4444';
      case 'pending': return '#f97316';
      case 'submitted': return '#eab308';
      case 'in_transit': return '#8b5cf6';
      case 'delivered': return '#10b981';
      case 'collected': return '#2563eb';
      case 'rejected': return '#ef4444';
      default: return '#8b5cf6';
    }
  };

  const getTicketStatusText = () => {
    if (agentPresence.is_typing) {
      return 'typing...';
    }

    switch (ticketStatus) {
      case 'pending': return 'Ticket Pending';
      case 'active': 
        if (agentPresence.status === 'online') return 'Online';
        if (agentPresence.status === 'away') return 'Away';
        if (agentPresence.last_seen) {
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
        return 'Offline';
      case 'closed': return 'Chat closed';
      default: return isConnected ? 'Connected' : 'Connecting...';
    }
  };

  const renderMessageStatus = (message: Message) => {
    if (message.isSupport || message.type === 'system') {
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

  // Render methods
  const groupedMessages = useMemo(() => {
    const groups: { [key: string]: Message[] } = {};
    
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

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageWrapper} key={item.id}>
      <View style={[
        styles.messageContainer,
        item.isSupport ? styles.supportMessage : styles.userMessage,
        item.type === 'system' && styles.systemMessage,
        item.optimistic && styles.optimisticMessage,
        item.sendStatus === 'failed' && styles.failedMessage,
      ]}>
        {item.isTagged && item.packageCode && (
          <View style={styles.taggedHeader}>
            <View style={styles.taggedQuote} />
            <View style={styles.taggedContent}>
              <View style={styles.taggedInfo}>
                <Feather name="package" size={12} color="#E1BEE7" />
                <Text style={styles.taggedText}>Package: {item.packageCode}</Text>
              </View>
              <Text style={styles.taggedMessage} numberOfLines={2}>
                Package inquiry for {item.packageCode}
              </Text>
            </View>
          </View>
        )}
        
        {item.type === 'system' && (
          <View style={styles.systemIndicator}>
            <MaterialIcons name="info" size={14} color="#8E8E93" />
          </View>
        )}
        
        <Text style={[
          styles.messageText,
          item.type === 'system' && styles.systemMessageText,
          item.optimistic && styles.optimisticMessageText
        ]}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {!item.isSupport && renderMessageStatus(item)}
        </View>
      </View>
    </View>
  );

  const renderPackageSearchItem = ({ item }: { item: Package }) => (
    <TouchableOpacity
      style={styles.packageSearchItem}
      onPress={() => handlePackageSelect(item)}
    >
      <View style={styles.packageSearchContent}>
        <View style={styles.packageSearchHeader}>
          <Text style={styles.packageSearchCode}>{item.code}</Text>
          <View style={[styles.packageSearchStateBadge, { backgroundColor: getStateBadgeColor(item.state) }]}>
            <Text style={styles.packageSearchStateText}>{item.state_display}</Text>
          </View>
        </View>
        <Text style={styles.packageSearchReceiver} numberOfLines={1}>
          To: {item.receiver_name}
        </Text>
        <Text style={styles.packageSearchRoute} numberOfLines={1}>
          {item.route_description}
        </Text>
        <Text style={styles.packageSearchCost}>KES {item.cost.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFlatListData = useMemo(() => {
    const data: any[] = [];
    const dateKeys = Object.keys(groupedMessages).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    dateKeys.forEach((dateKey) => {
      data.push({ type: 'date', dateKey, id: `date-${dateKey}` });
      groupedMessages[dateKey].forEach((msg, index) => {
        data.push({ type: 'message', message: msg, id: `${msg.id}-${index}` });
      });
    });

    return data;
  }, [groupedMessages]);

  const renderItem = useCallback(({ item }: any) => {
    if (item.type === 'date') {
      return renderDateSeparator(item.dateKey);
    }
    return renderMessage({ item: item.message });
  }, [renderDateSeparator]);

  const renderTicketModal = () => (
    <Modal
      visible={showTicketModal || showInquiryModal || showPackageModal}
      transparent
      animationType="none"
      onRequestClose={closeAllModals}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={closeAllModals}
        />
        
        <Animated.View 
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#1F2C34', '#0B141B']}
            style={styles.modalContent}
          >
            <View style={styles.modalHandle} />

            {showTicketModal && (
              <>
                <Text style={styles.modalTitle}>How can we help you?</Text>
                <Text style={styles.modalSubtitle}>Please select the type of assistance you need</Text>

                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleBasicInquiry}
                >
                  <LinearGradient
                    colors={['#B794F6', '#9F7AEA', '#5B21B6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.optionButtonGradient}
                  >
                    <View style={styles.optionIcon}>
                      <Feather name="help-circle" size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>Basic Inquiry</Text>
                      <Text style={styles.optionDescription}>General questions about our services</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handlePackageInquiry}
                >
                  <LinearGradient
                    colors={['#B794F6', '#9F7AEA', '#5B21B6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.optionButtonGradient}
                  >
                    <View style={styles.optionIcon}>
                      <Feather name="package" size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>About My Package</Text>
                      <Text style={styles.optionDescription}>Track or inquire about your package</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {showInquiryModal && (
              <>
                <Text style={styles.modalTitle}>Basic Inquiry</Text>
                <Text style={styles.modalSubtitle}>Please describe your question or concern</Text>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Type your inquiry here..."
                    placeholderTextColor="#8E8E93"
                    value={inquiryText}
                    onChangeText={setInquiryText}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={closeAllModals}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !inquiryText.trim() && styles.sendButtonDisabled
                    ]}
                    onPress={createBasicInquiryTicket}
                    disabled={!inquiryText.trim() || isLoading}
                  >
                    {isLoading ? (
                      <Text style={styles.sendButtonText}>Sending...</Text>
                    ) : (
                      <Text style={styles.sendButtonText}>Send</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {showPackageModal && (
              <>
                <Text style={styles.modalTitle}>Package Inquiry</Text>
                <Text style={styles.modalSubtitle}>Select your package and describe your inquiry</Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Select Package</Text>
                  {selectedPackage ? (
                    <View style={styles.selectedPackageContainer}>
                      <View style={styles.selectedPackageHeader}>
                        <Feather name="package" size={16} color="#8b5cf6" />
                        <Text style={styles.selectedPackageCode}>{selectedPackage.code}</Text>
                        <TouchableOpacity 
                          onPress={() => setSelectedPackage(null)}
                          style={styles.removePackageButton}
                        >
                          <Feather name="x" size={16} color="#8E8E93" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.selectedPackageDetails}>
                        {selectedPackage.route_description} • KES {selectedPackage.cost.toLocaleString()}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.selectPackageButton}
                      onPress={handleShowPackageSearch}
                    >
                      <Feather name="search" size={16} color="#8b5cf6" />
                      <Text style={styles.selectPackageText}>Select Package</Text>
                    </TouchableOpacity>
                  )}

                  {showPackageSearch && (
                    <View style={styles.packageSearchDropdown}>
                      <View style={styles.packageSearchInputContainer}>
                        <Feather name="search" size={16} color="#8E8E93" />
                        <TextInput
                          style={styles.packageSearchInput}
                          placeholder="Search your packages..."
                          placeholderTextColor="#8E8E93"
                          value={packageSearchQuery}
                          onChangeText={handlePackageSearchChange}
                          autoFocus
                        />
                        <TouchableOpacity 
                          onPress={() => setShowPackageSearch(false)}
                          style={styles.closeSearchButton}
                        >
                          <Feather name="x" size={16} color="#8E8E93" />
                        </TouchableOpacity>
                      </View>

                      {loadingPackages ? (
                        <View style={styles.packageSearchLoading}>
                          <ActivityIndicator size="small" color="#8b5cf6" />
                          <Text style={styles.packageSearchLoadingText}>Loading packages...</Text>
                        </View>
                      ) : (
                        <FlatList
                          data={filteredPackages}
                          renderItem={renderPackageSearchItem}
                          keyExtractor={(item) => item.id}
                          style={styles.packageSearchList}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                          ListEmptyComponent={() => (
                            <View style={styles.packageSearchEmpty}>
                              <Text style={styles.packageSearchEmptyText}>
                                {packageSearchQuery ? 'No packages found matching your search' : 'No packages available'}
                              </Text>
                            </View>
                          )}
                        />
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Your Inquiry</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Describe your package inquiry..."
                    placeholderTextColor="#8E8E93"
                    value={packageInquiry}
                    onChangeText={setPackageInquiry}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={closeAllModals}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!selectedPackage || !packageInquiry.trim()) && styles.sendButtonDisabled
                    ]}
                    onPress={createPackageInquiryTicket}
                    disabled={!selectedPackage || !packageInquiry.trim() || isLoading}
                  >
                    {isLoading ? (
                      <Text style={styles.sendButtonText}>Sending...</Text>
                    ) : (
                      <Text style={styles.sendButtonText}>Send</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    const backAction = () => {
      if (showTicketModal || showInquiryModal || showPackageModal) {
        closeAllModals();
        return true;
      }
      handleGoBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
      backHandler.remove();
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      retryTimeoutsRef.current.clear();
    };
  }, [showTicketModal, showInquiryModal, showPackageModal, handleGoBack]);

  useEffect(() => {
    if (showTicketModal || showInquiryModal || showPackageModal) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showTicketModal, showInquiryModal, showPackageModal]);

  useEffect(() => {
    if (showPackageModal && userPackages.length === 0) {
      loadUserPackages();
    }
  }, [showPackageModal, userPackages.length, loadUserPackages]);

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
            source={require('../../assets/images/support.png')}
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
              {isConnected && !agentPresence.is_typing && ticketStatus === 'active' && agentPresence.status === 'online' && (
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
        <View style={[styles.messagesContainer, { marginBottom: keyboardHeight > 0 ? 0 : 0 }]}>
          <FlatList
            ref={flatListRef}
            data={renderFlatListData}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
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
        </View>

        {!showTicketModal && !showInquiryModal && !showPackageModal && (
          <View style={styles.inquirySection}>
            <View style={styles.inquiryTabs}>
              <TouchableOpacity
                style={[
                  styles.inquiryTab,
                  inquiryType === 'basic' && styles.inquiryTabActive
                ]}
                onPress={() => handleInquiryTypeChange('basic')}
              >
                <Text style={[
                  styles.inquiryTabText,
                  inquiryType === 'basic' && styles.inquiryTabTextActive
                ]}>
                  Basic Inquiry
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.inquiryTab,
                  inquiryType === 'package' && styles.inquiryTabActive
                ]}
                onPress={() => handleInquiryTypeChange('package')}
              >
                <Feather 
                  name="plus" 
                  size={14} 
                  color={inquiryType === 'package' ? '#fff' : '#8E8E93'} 
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.inquiryTabText,
                  inquiryType === 'package' && styles.inquiryTabTextActive
                ]}>
                  Package Inquiry
                </Text>
              </TouchableOpacity>
            </View>

            {inquiryType === 'package' && (
              <View style={styles.packageSection}>
                {selectedPackage ? (
                  <View style={styles.selectedPackageContainer}>
                    <View style={styles.selectedPackageHeader}>
                      <Feather name="package" size={16} color="#8b5cf6" />
                      <Text style={styles.selectedPackageCode}>{selectedPackage.code}</Text>
                      <TouchableOpacity 
                        onPress={() => setSelectedPackage(null)}
                        style={styles.removePackageButton}
                      >
                        <Feather name="x" size={16} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.selectedPackageDetails}>
                      {selectedPackage.route_description} • KES {selectedPackage.cost.toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.selectPackageButton}
                    onPress={handleShowPackageSearch}
                  >
                    <Feather name="search" size={16} color="#8b5cf6" />
                    <Text style={styles.selectPackageText}>Select Package</Text>
                  </TouchableOpacity>
                )}

                {showPackageSearch && (
                  <View style={styles.packageSearchDropdown}>
                    <View style={styles.packageSearchInputContainer}>
                      <Feather name="search" size={16} color="#8E8E93" />
                      <TextInput
                        style={styles.packageSearchInput}
                        placeholder="Search your packages..."
                        placeholderTextColor="#8E8E93"
                        value={packageSearchQuery}
                        onChangeText={handlePackageSearchChange}
                        autoFocus
                      />
                      <TouchableOpacity 
                        onPress={() => setShowPackageSearch(false)}
                        style={styles.closeSearchButton}
                      >
                        <Feather name="x" size={16} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>

                    {loadingPackages ? (
                      <View style={styles.packageSearchLoading}>
                        <ActivityIndicator size="small" color="#8b5cf6" />
                        <Text style={styles.packageSearchLoadingText}>Loading packages...</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={filteredPackages}
                        renderItem={renderPackageSearchItem}
                        keyExtractor={(item) => item.id}
                        style={styles.packageSearchList}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                          <View style={styles.packageSearchEmpty}>
                            <Text style={styles.packageSearchEmptyText}>
                              {packageSearchQuery ? 'No packages found matching your search' : 'No packages available'}
                            </Text>
                          </View>
                        )}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={[
          styles.inputContainerFixed,
          { 
            paddingBottom: Platform.OS === 'ios' 
              ? (keyboardHeight > 0 ? 8 : 34) 
              : 8 
          }
        ]}>
          <View style={styles.inputRow}>
            <View style={styles.textInputContainer}>
              <TouchableOpacity style={styles.inputButton}>
                <Feather name="smile" size={20} color="#8E8E93" />
              </TouchableOpacity>
              
              <TextInput
                style={styles.textInput}
                placeholder={
                  inquiryType === 'package' && selectedPackage
                    ? `Ask about package ${selectedPackage.code}...`
                    : 'Message'
                }
                placeholderTextColor="#8E8E93"
                value={inputText}
                onChangeText={handleInputTextChange}
                multiline
                maxLength={1000}
                onFocus={() => {
                  setTimeout(() => scrollToBottom(), 100);
                }}
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
                styles.sendButtonMain,
                inputText.trim() ? styles.sendButtonActive : styles.voiceButton
              ]}
              onPress={inputText.trim() ? sendMessage : undefined}
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

      {renderTicketModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B141B' },
  flex: { flex: 1 },
  header: { paddingBottom: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  backButton: { marginRight: 12, padding: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerInfo: { flex: 1, justifyContent: 'center', marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '500', lineHeight: 20, flexShrink: 0 },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  headerSubtitle: { color: '#E1BEE7', fontSize: 12, lineHeight: 14 },
  typingText: { fontStyle: 'italic', color: '#4FC3F7' },
  connectionIndicator: { marginLeft: 6 },
  onlineIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  headerActions: { flexDirection: 'row', alignItems: 'center', minWidth: 40 },
  headerButton: { marginLeft: 16, padding: 6 },
  messagesContainer: { flex: 1, backgroundColor: '#0B141B' },
  messagesList: { paddingVertical: 8, paddingHorizontal: 8, flexGrow: 1 },
  listHeader: { paddingVertical: 8 },
  loadingOlderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  loadingOlderText: { color: '#8E8E93', fontSize: 14, marginLeft: 8 },
  startOfConversationContainer: { alignItems: 'center', paddingVertical: 12 },
  startOfConversationText: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, paddingHorizontal: 16 },
  dateSeparatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  dateSeparatorBadge: { backgroundColor: 'rgba(31, 44, 52, 0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  dateSeparatorText: { color: '#8E8E93', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  messageWrapper: { marginVertical: 3 },
  messageContainer: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2.22 },
  supportMessage: { alignSelf: 'flex-start', backgroundColor: '#1F2C34', borderBottomLeftRadius: 4, marginLeft: 4 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#6B46C1', borderBottomRightRadius: 4, marginRight: 4 },
  systemMessage: { alignSelf: 'center', backgroundColor: 'rgba(142, 142, 147, 0.15)', borderRadius: 12, maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginVertical: 6, borderWidth: 1, borderColor: 'rgba(142, 142, 147, 0.2)' },
  optimisticMessage: { opacity: 0.7 },
  failedMessage: { backgroundColor: '#5A2D3D' },
  taggedHeader: { backgroundColor: 'rgba(225, 190, 231, 0.1)', borderRadius: 8, padding: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#E1BEE7' },
  taggedQuote: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#E1BEE7', borderRadius: 2 },
  taggedContent: { marginLeft: 8 },
  taggedInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  taggedText: { color: '#E1BEE7', fontSize: 12, marginLeft: 6, fontWeight: '600' },
  taggedMessage: { color: '#B8B8B8', fontSize: 13, fontStyle: 'italic' },
  systemIndicator: { marginRight: 8, alignSelf: 'center' },
  messageText: { color: '#fff', fontSize: 16, lineHeight: 20, paddingTop: 4, flexWrap: 'wrap' },
  systemMessageText: { color: '#8E8E93', fontSize: 14, fontStyle: 'italic', textAlign: 'center', flexShrink: 1 },
  optimisticMessageText: { fontStyle: 'italic' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  timestamp: { color: '#8E8E93', fontSize: 11, marginRight: 4 },
  messageStatusContainer: { marginLeft: 4 },
  scrollToBottomButton: { position: 'absolute', bottom: 16, right: 16, backgroundColor: '#7B3F98', borderRadius: 28, width: 56, height: 56, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
  scrollToBottomContent: { justifyContent: 'center', alignItems: 'center' },
  unreadBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, borderWidth: 2, borderColor: '#0B141B' },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inquirySection: { backgroundColor: 'rgba(11, 20, 27, 0.95)', borderTopWidth: 0.5, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
  inquiryTabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  inquiryTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginRight: 8 },
  inquiryTabActive: { backgroundColor: '#6B46C1' },
  inquiryTabText: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  inquiryTabTextActive: { color: '#fff' },
  packageSection: { paddingHorizontal: 16, paddingBottom: 8 },
  selectedPackageContainer: { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' },
  selectedPackageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  selectedPackageCode: { color: '#8b5cf6', fontSize: 14, fontWeight: '600', flex: 1, marginLeft: 8 },
  removePackageButton: { padding: 4 },
  selectedPackageDetails: { color: '#E5E7EB', fontSize: 12, lineHeight: 16 },
  selectPackageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)', borderStyle: 'dashed' },
  selectPackageText: { color: '#8b5cf6', fontSize: 14, fontWeight: '500', marginLeft: 8 },
  packageSearchDropdown: { backgroundColor: '#1F2C34', borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(123, 63, 152, 0.3)', maxHeight: 300 },
  packageSearchInputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(123, 63, 152, 0.2)' },
  packageSearchInput: { flex: 1, color: '#fff', fontSize: 14, paddingHorizontal: 8 },
  closeSearchButton: { padding: 4 },
  packageSearchLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  packageSearchLoadingText: { color: '#8E8E93', fontSize: 14, marginLeft: 8 },
  packageSearchList: { maxHeight: 200 },
  packageSearchItem: { borderBottomWidth: 1, borderBottomColor: 'rgba(123, 63, 152, 0.2)' },
  packageSearchContent: { padding: 12 },
  packageSearchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  packageSearchCode: { color: '#fff', fontSize: 14, fontWeight: '600' },
  packageSearchStateBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  packageSearchStateText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  packageSearchReceiver: { color: '#E5E7EB', fontSize: 12, marginBottom: 2 },
  packageSearchRoute: { color: '#8E8E93', fontSize: 11, marginBottom: 4 },
  packageSearchCost: { color: '#8b5cf6', fontSize: 12, fontWeight: '600' },
  packageSearchEmpty: { padding: 20, alignItems: 'center' },
  packageSearchEmptyText: { color: '#8E8E93', fontSize: 14, textAlign: 'center' },
  inputContainerFixed: { backgroundColor: 'rgba(11, 20, 27, 0.95)', paddingHorizontal: 8, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  textInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2C34', borderRadius: 25, paddingHorizontal: 4, paddingVertical: 6, marginRight: 8, maxHeight: 100, minHeight: 45, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2.22 },
  inputButton: { padding: 8, marginLeft: 4 },
  textInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 8, paddingHorizontal: 8, textAlignVertical: 'center', maxHeight: 80 },
  attachButton: { padding: 8 },
  cameraButton: { padding: 8, marginRight: 4 },
  sendButtonMain: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  sendButtonActive: { backgroundColor: '#7B3F98' },
  voiceButton: { backgroundColor: '#7B3F98' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalBackdrop: { flex: 1 },
  modalContainer: { height: SCREEN_HEIGHT * 0.7, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#8E8E93', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { color: '#8E8E93', fontSize: 16, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  optionButton: { borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 8, shadowColor: '#7B3F98', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  optionButtonGradient: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16 },
  optionIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  optionContent: { flex: 1 },
  optionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  optionDescription: { color: '#E5E7EB', fontSize: 14, lineHeight: 18 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { color: '#fff', fontSize: 16, fontWeight: '500', marginBottom: 8 },
  modalTextInput: { backgroundColor: '#1F2C34', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, minHeight: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(123, 63, 152, 0.3)' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancelButton: { flex: 1, backgroundColor: 'rgba(142, 142, 147, 0.2)', borderRadius: 12, paddingVertical: 16, marginRight: 8, alignItems: 'center' },
  cancelButtonText: { color: '#8E8E93', fontSize: 16, fontWeight: '600' },
  sendButton: { flex: 1, backgroundColor: '#7B3F98', borderRadius: 12, paddingVertical: 16, marginLeft: 8, alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: 'rgba(123, 63, 152, 0.4)' },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
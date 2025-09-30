// app/(drawer)/support.tsx - FIXED: Message duplication issue
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [agentOnline, setAgentOnline] = useState(false);
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(null);
  
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
  const cacheManager = useRef(ChatCacheManager.getInstance());
  const cacheUnsubscribeRef = useRef<(() => void) | null>(null);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const conversationLoadedRef = useRef(false);
  const conversationIdStorageKey = 'active_support_conversation_id';
  const pendingMessageRef = useRef<string | null>(null);

  useEffect(() => {
    const loadSavedConversationId = async () => {
      try {
        const savedId = await AsyncStorage.getItem(conversationIdStorageKey);
        if (savedId) {
          console.log('📦 Found saved conversation ID:', savedId);
          setConversationId(savedId);
          setHasActiveTicket(true);
        }
      } catch (error) {
        console.error('Error loading saved conversation ID:', error);
      }
    };

    loadSavedConversationId();
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    cacheUnsubscribeRef.current = cacheManager.current.subscribe(conversationId, (convId, cachedData) => {
      console.log(`📦 Cache updated for conversation ${convId}`);
      
      const uiMessages: Message[] = cachedData.messages.map(msg => ({
        id: msg.id,
        text: msg.content,
        timestamp: msg.timestamp,
        isSupport: msg.from_support,
        type: msg.message_type as 'text' | 'voice' | 'system',
        packageCode: msg.metadata?.package_code,
        isTagged: !!msg.metadata?.package_code,
        optimistic: msg.optimistic,
        delivered_at: msg.delivered_at,
        read_at: msg.read_at,
      }));

      setMessages(uiMessages);
      setHasMoreMessages(cachedData.hasMoreMessages);
    });

    const setupActionCable = async () => {
      if (!user) return;

      try {
        const currentAccount = accountManager.getCurrentAccount();
        if (!currentAccount) return;

        const actionCable = ActionCableService.getInstance();
        
        const connected = await actionCable.connect({
          token: currentAccount.token,
          userId: user.id,
          autoReconnect: true,
        });

        if (connected) {
          setIsConnected(true);
          console.log('✅ ActionCable connected');

          await actionCable.joinConversation(conversationId);

          setupActionCableSubscriptions();
        }
      } catch (error) {
        console.error('Failed to setup ActionCable:', error);
        setIsConnected(false);
      }
    };

    setupActionCable();

    return () => {
      if (conversationId && isConnected) {
        const actionCable = ActionCableService.getInstance();
        actionCable.leaveConversation(conversationId);
      }
      
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];

      if (cacheUnsubscribeRef.current) {
        cacheUnsubscribeRef.current();
      }
    };
  }, [conversationId, user, isConnected]);

  const setupActionCableSubscriptions = () => {
    if (!conversationId) return;

    const actionCable = ActionCableService.getInstance();

    actionCableSubscriptions.current.forEach(unsub => unsub());
    actionCableSubscriptions.current = [];

    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      console.log('📨 Message received:', data);
      
      if (data.conversation_id !== conversationId || !data.message) return;
      
      const messageData = data.message;
      const messageId = String(messageData.id);
      
      // Skip if this is the message we just sent (check by pending message ref)
      if (pendingMessageRef.current && messageData.content === pendingMessageRef.current) {
        console.log('Skipping own message echo:', messageId);
        pendingMessageRef.current = null;
        return;
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

      cacheManager.current.addMessageToCache(conversationId, newMessage);
      
      if (messageData.user?.id !== user?.id) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });
    actionCableSubscriptions.current.push(unsubNewMessage);

    const unsubAcknowledged = actionCable.subscribe('message_acknowledged', (data) => {
      if (data.message_id) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            if (data.status === 'delivered') {
              return { ...msg, delivered_at: data.timestamp };
            } else if (data.status === 'read') {
              return { ...msg, delivered_at: msg.delivered_at || data.timestamp, read_at: data.timestamp };
            }
          }
          return msg;
        }));
      }
    });
    actionCableSubscriptions.current.push(unsubAcknowledged);

    const unsubRead = actionCable.subscribe('conversation_read', (data) => {
      if (data.conversation_id === conversationId) {
        console.log(`📖 ${data.reader_name || 'Agent'} read the conversation`);
        setMessages(prev => prev.map(msg => ({
          ...msg,
          read_at: msg.read_at || data.timestamp
        })));
      }
    });
    actionCableSubscriptions.current.push(unsubRead);

    const unsubTyping = actionCable.subscribe('typing_indicator', (data) => {
      if (data.conversation_id === conversationId && data.user_id !== user?.id) {
        if (data.typing) {
          setTypingUsers(prev => {
            if (!prev.includes(data.user_name)) {
              return [...prev, data.user_name];
            }
            return prev;
          });
        } else {
          setTypingUsers(prev => prev.filter(name => name !== data.user_name));
        }
      }
    });
    actionCableSubscriptions.current.push(unsubTyping);

    const unsubUpdated = actionCable.subscribe('conversation_updated', (data) => {
      if (data.conversation_id === conversationId && data.status) {
        setTicketStatus(data.status);
      }
    });
    actionCableSubscriptions.current.push(unsubUpdated);

    const unsubStatus = actionCable.subscribe('ticket_status_changed', (data) => {
      if (data.conversation_id === conversationId) {
        setTicketStatus(data.new_status);
        
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
          
          cacheManager.current.addMessageToCache(conversationId, systemMessage);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubStatus);

    const unsubPresence = actionCable.subscribe('user_presence_changed', (data) => {
      if (data.conversation_id === conversationId && data.user_id !== user?.id) {
        setAgentOnline(data.status === 'online');
        if (data.status !== 'online' && data.last_seen) {
          setLastSeenTime(data.last_seen);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubPresence);

    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
    });
    actionCableSubscriptions.current.push(unsubLost);

    console.log('✅ ActionCable subscriptions configured');
  };

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

  const loadConversationMessages = useCallback(async (conversationId: string, isRefresh = false, loadOlder = false) => {
    try {
      if (!isRefresh && !loadOlder && !conversationLoadedRef.current) {
        const cachedData = cacheManager.current.getCachedConversation(conversationId);
        if (cachedData) {
          console.log(`📦 Loading conversation from cache: ${conversationId}`);
          
          const uiMessages: Message[] = cachedData.messages.map(msg => ({
            id: msg.id,
            text: msg.content,
            timestamp: msg.timestamp,
            isSupport: msg.from_support,
            type: msg.message_type as 'text' | 'voice' | 'system',
            packageCode: msg.metadata?.package_code,
            isTagged: !!msg.metadata?.package_code,
            optimistic: msg.optimistic,
            delivered_at: msg.delivered_at,
            read_at: msg.read_at,
          }));

          setMessages(uiMessages);
          setHasMoreMessages(cachedData.hasMoreMessages);
          setLoadingMessages(false);
          setIsInitialLoad(false);
          conversationLoadedRef.current = true;
          
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
          return;
        }
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

        if (isRefresh || (!loadOlder && !conversationLoadedRef.current)) {
          cacheManager.current.setCachedConversation(
            conversationId,
            response.data.conversation,
            apiMessages,
            pagination.has_more || false,
            apiMessages.length > 0 ? apiMessages[0]?.id : null
          );
          setIsInitialLoad(false);
          conversationLoadedRef.current = true;

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
        } else if (loadOlder) {
          cacheManager.current.prependOlderMessages(
            conversationId,
            apiMessages,
            pagination.has_more || false
          );
        }

        const conversationData = response.data.conversation;
        if (conversationData?.assigned_agent) {
          setTicketStatus('active');
          setAgentOnline(true);
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

        console.log(`Loaded ${apiMessages.length} messages, has_more: ${pagination.has_more}`);
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Failed to load conversation:', error);
      setConnectionError(true);

      if (!isRefresh && !loadOlder && !conversationLoadedRef.current) {
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
      }
    } finally {
      setLoadingMessages(false);
      setLoadingOlder(false);
      setRefreshing(false);
    }
  }, [messages]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !conversationId || !hasMoreMessages) {
      return;
    }
    
    await loadConversationMessages(conversationId, false, true);
  }, [loadConversationMessages, conversationId, loadingOlder, hasMoreMessages]);

  const handleRefresh = useCallback(async () => {
    if (!conversationId) return;
    
    conversationLoadedRef.current = false;
    cacheManager.current.clearConversationCache(conversationId);
    await loadConversationMessages(conversationId, true);
  }, [loadConversationMessages, conversationId]);

  const checkActiveTicket = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/conversations/active_support');
      
      if (response.data.success && response.data.conversation_id) {
        const activeConvId = response.data.conversation_id;
        setConversationId(activeConvId);
        setHasActiveTicket(true);
        setTicketStatus('active');
        
        await AsyncStorage.setItem(conversationIdStorageKey, activeConvId);
        
        await loadConversationMessages(activeConvId);
        
        return;
      }
      
      setHasActiveTicket(false);
      await AsyncStorage.removeItem(conversationIdStorageKey);
      
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
      
      setLoadingMessages(false);
      setIsInitialLoad(false);
      
      if (autoSelectPackage) {
        setShowPackageModal(true);
      } else {
        setShowTicketModal(true);
      }
    }
  }, [autoSelectPackage, loadConversationMessages]);

  useEffect(() => {
    if (!conversationId) {
      checkActiveTicket();
    } else {
      loadConversationMessages(conversationId);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId]);

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
          id: String(pkg.id || ''),
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
        const newConversationId = response.data.conversation_id;
        setConversationId(newConversationId);
        setTicketStatus('pending');
        
        await AsyncStorage.setItem(conversationIdStorageKey, newConversationId);
        
        await loadConversationMessages(newConversationId);
        
        return newConversationId;
      }
      
      throw new Error(response.data.message || 'Failed to create support ticket');
    } catch (error: any) {
      console.error('Failed to create support ticket:', error);
      throw error;
    }
  }, [conversationId, inquiryType, selectedPackage?.code, loadConversationMessages]);

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

  const createBasicInquiryTicket = async () => {
    if (!inquiryText.trim()) return;

    setIsLoading(true);
    
    try {
      setInquiryType('basic');
      setSelectedPackage(null);
      
      const convId = await ensureConversation();
      
      const tempId = `temp-${Date.now()}`;
      
      // Store the message content to filter out echo
      pendingMessageRef.current = inquiryText.trim();
      
      const optimisticMessage: CachedMessage = {
        id: tempId,
        content: inquiryText.trim(),
        created_at: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        is_system: false,
        from_support: false,
        message_type: 'text',
        user: {
          id: user?.id || '',
          name: user?.display_name || user?.first_name || 'You',
          role: 'customer'
        },
        metadata: {},
        optimistic: true,
      };

      cacheManager.current.addOptimisticMessage(convId, optimisticMessage);
      closeAllModals();
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const response = await api.post(`/api/v1/conversations/${convId}/send_message`, {
        content: inquiryText.trim(),
        message_type: 'text'
      });
      
      if (response.data.success && response.data.message) {
        // Remove all optimistic messages
        cacheManager.current.removeOptimisticMessages(convId);
        
        // Add the real message from server
        cacheManager.current.addMessageToCache(convId, response.data.message);
        
        // Clear pending message ref after a delay
        setTimeout(() => {
          pendingMessageRef.current = null;
        }, 1000);
        
        setTicketStatus('pending');
        setHasActiveTicket(true);
        
        setTimeout(() => {
          const systemMessage: CachedMessage = {
            id: `system-${Date.now()}`,
            content: 'Thank you for contacting us. Your inquiry has been received and a support agent will respond shortly.',
            created_at: new Date().toISOString(),
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            }),
            is_system: true,
            from_support: true,
            message_type: 'system',
            user: {
              id: 'system',
              name: 'System',
              role: 'system'
            },
            metadata: {},
            optimistic: false,
          };
          
          cacheManager.current.addMessageToCache(convId, systemMessage);
          
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }, 1500);
      }
      
    } catch (error) {
      console.error('Failed to create basic inquiry:', error);
      if (conversationId) {
        cacheManager.current.removeOptimisticMessages(conversationId);
      }
      pendingMessageRef.current = null;
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
      
      const tempId = `temp-${Date.now()}`;
      
      pendingMessageRef.current = packageInquiry.trim();
      
      const optimisticMessage: CachedMessage = {
        id: tempId,
        content: packageInquiry.trim(),
        created_at: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        is_system: false,
        from_support: false,
        message_type: 'text',
        user: {
          id: user?.id || '',
          name: user?.display_name || user?.first_name || 'You',
          role: 'customer'
        },
        metadata: { package_code: selectedPackage.code },
        optimistic: true,
      };

      cacheManager.current.addOptimisticMessage(convId, optimisticMessage);
      closeAllModals();
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const response = await api.post(`/api/v1/conversations/${convId}/send_message`, {
        content: packageInquiry.trim(),
        message_type: 'text',
        metadata: { package_code: selectedPackage.code }
      });
      
      if (response.data.success && response.data.message) {
        cacheManager.current.removeOptimisticMessages(convId);
        cacheManager.current.addMessageToCache(convId, response.data.message);
        
        setTimeout(() => {
          pendingMessageRef.current = null;
        }, 1000);
        
        setTicketStatus('pending');
        setHasActiveTicket(true);
        
        setTimeout(() => {
          const systemMessage: CachedMessage = {
            id: `system-${Date.now()}`,
            content: `Thank you for your inquiry about package ${selectedPackage.code}. A support agent will review your ticket and respond shortly.`,
            created_at: new Date().toISOString(),
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            }),
            is_system: true,
            from_support: true,
            message_type: 'system',
            user: {
              id: 'system',
              name: 'System',
              role: 'system'
            },
            metadata: {},
            optimistic: false,
          };
          
          cacheManager.current.addMessageToCache(convId, systemMessage);
          
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }, 1500);
      }
      
    } catch (error) {
      console.error('Failed to create package inquiry:', error);
      if (conversationId) {
        cacheManager.current.removeOptimisticMessages(conversationId);
      }
      pendingMessageRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    
    try {
      const convId = await ensureConversation();
      
      const tempId = `temp-${Date.now()}`;
      
      pendingMessageRef.current = inputText.trim();
      
      const optimisticMessage: CachedMessage = {
        id: tempId,
        content: inputText.trim(),
        created_at: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        is_system: false,
        from_support: false,
        message_type: 'text',
        user: {
          id: user?.id || '',
          name: user?.display_name || user?.first_name || 'You',
          role: 'customer'
        },
        metadata: selectedPackage ? { package_code: selectedPackage.code } : {},
        optimistic: true,
      };

      cacheManager.current.addOptimisticMessage(convId, optimisticMessage);
      
      const messageText = inputText.trim();
      setInputText('');
      
      if (isTyping) {
        setIsTyping(false);
        sendTypingIndicator(false);
      }
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const metadata = selectedPackage ? { package_code: selectedPackage.code } : undefined;
      const response = await api.post(`/api/v1/conversations/${convId}/send_message`, {
        content: messageText,
        message_type: 'text',
        metadata
      });
      
      if (response.data.success && response.data.message) {
        cacheManager.current.removeOptimisticMessages(convId);
        cacheManager.current.addMessageToCache(convId, response.data.message);
        
        setTimeout(() => {
          pendingMessageRef.current = null;
        }, 1000);
        
        setTicketStatus('pending');
        setHasActiveTicket(true);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      if (conversationId) {
        cacheManager.current.removeOptimisticMessages(conversationId);
      }
      setInputText(inputText.trim());
      pendingMessageRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [inputText, ensureConversation, selectedPackage, isTyping, sendTypingIndicator, conversationId, user]);

  const handleInputTextChange = useCallback((text: string) => {
    setInputText(text);
    
    if (text.trim() && conversationId) {
      handleTyping();
    }
  }, [conversationId, handleTyping]);

  const renderMessageStatus = (message: Message) => {
    if (message.isSupport || message.type === 'system' || message.optimistic) {
      return null;
    }

    if (message.read_at) {
      return (
        <View style={styles.messageStatusContainer}>
          <MaterialIcons name="done-all" size={16} color="#4FC3F7" />
        </View>
      );
    }

    if (message.delivered_at) {
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

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageWrapper}>
      <View style={[
        styles.messageContainer,
        item.isSupport ? styles.supportMessage : styles.userMessage,
        item.optimistic && styles.optimisticMessage
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
        
        <Text style={[
          styles.messageText,
          item.optimistic && styles.optimisticMessageText
        ]}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {!item.isSupport && (
            item.optimistic ? (
              <View style={styles.messageStatusContainer}>
                <ActivityIndicator size={12} color="rgba(255, 255, 255, 0.7)" />
              </View>
            ) : (
              renderMessageStatus(item)
            )
          )}
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
    switch (ticketStatus) {
      case 'pending': return 'Ticket Pending';
      case 'active': 
        if (agentOnline) return 'Online';
        if (lastSeenTime) {
          const lastSeen = new Date(lastSeenTime);
          const now = new Date();
          const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
          
          if (diffMinutes < 1) return 'Last seen just now';
          if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
          const diffHours = Math.floor(diffMinutes / 60);
          if (diffHours < 24) return `Last seen ${diffHours}h ago`;
          return 'Last seen recently';
        }
        return isConnected ? 'Online' : 'Connecting...';
      case 'closed': return 'Last seen recently';
      default: return isConnected ? 'Online' : 'Connecting...';
    }
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <View style={styles.typingIndicator}>
        <Text style={styles.typingText}>
          {typingUsers.length === 1 
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.join(', ')} are typing...`
          }
        </Text>
      </View>
    );
  };

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
                <Feather name="video" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Feather name="phone" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Feather name="more-vertical" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
          {connectionError && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => checkActiveTicket()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
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
              <Text style={styles.headerSubtitle}>{getTicketStatusText()}</Text>
              {isConnected && (ticketStatus === 'active' && agentOnline) && (
                <View style={styles.connectionIndicator}>
                  <View style={styles.onlineIndicator} />
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Feather name="video" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Feather name="phone" size={22} color="#fff" />
            </TouchableOpacity>
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
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
          
          {renderTypingIndicator()}
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
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
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
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size={18} color="#fff" />
              ) : inputText.trim() ? (
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

// Styles remain exactly the same
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B141B' },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B141B' },
  loadingText: { color: '#8E8E93', fontSize: 16, marginTop: 16 },
  retryButton: { backgroundColor: '#7B3F98', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 16 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  header: { paddingBottom: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  backButton: { marginRight: 12, padding: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerInfo: { flex: 1, justifyContent: 'center', marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '500', lineHeight: 20, flexShrink: 0 },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  headerSubtitle: { color: '#E1BEE7', fontSize: 12, lineHeight: 14 },
  connectionIndicator: { marginLeft: 6 },
  onlineIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  headerActions: { flexDirection: 'row', alignItems: 'center', minWidth: 120 },
  headerButton: { marginLeft: 16, padding: 6 },
  messagesContainer: { flex: 1, backgroundColor: '#0B141B' },
  messagesList: { paddingVertical: 8, paddingHorizontal: 8, flexGrow: 1 },
  listHeader: { paddingVertical: 8 },
  loadingOlderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  loadingOlderText: { color: '#8E8E93', fontSize: 14, marginLeft: 8 },
  startOfConversationContainer: { alignItems: 'center', paddingVertical: 12 },
  startOfConversationText: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  messageWrapper: { marginVertical: 3 },
  messageContainer: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2.22 },
  supportMessage: { alignSelf: 'flex-start', backgroundColor: '#1F2C34', borderBottomLeftRadius: 4, marginLeft: 4 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#6B46C1', borderBottomRightRadius: 4, marginRight: 4 },
  optimisticMessage: { opacity: 0.7 },
  taggedHeader: { backgroundColor: 'rgba(225, 190, 231, 0.1)', borderRadius: 8, padding: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#E1BEE7' },
  taggedQuote: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#E1BEE7', borderRadius: 2 },
  taggedContent: { marginLeft: 8 },
  taggedInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  taggedText: { color: '#E1BEE7', fontSize: 12, marginLeft: 6, fontWeight: '600' },
  taggedMessage: { color: '#B8B8B8', fontSize: 13, fontStyle: 'italic' },
  messageText: { color: '#fff', fontSize: 16, lineHeight: 20, paddingTop: 4 },
  optimisticMessageText: { fontStyle: 'italic' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  timestamp: { color: '#8E8E93', fontSize: 11, marginRight: 4 },
  messageStatusContainer: { marginLeft: 4 },
  typingIndicator: { paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
  typingText: { color: '#8E8E93', fontSize: 14, fontStyle: 'italic' },
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
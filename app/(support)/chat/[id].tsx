// app/(support)/chat/[id].tsx - Fixed Support Chat Screen with proper message broadcasting
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
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '../../../context/UserContext';
import api from '../../../lib/api';
import ActionCableService from '../../../lib/services/ActionCableService';
import { accountManager } from '../../../lib/AccountManager';
import ChatCacheManager, { CachedMessage, CachedConversation } from '../../../lib/cache/ChatCacheManager';

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  is_system: boolean;
  from_support: boolean;
  message_type: string;
  user: {
    id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
  timestamp: string;
  metadata?: any;
  optimistic?: boolean;
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

interface TypingUser {
  id: string;
  name: string;
}

// Configuration constants
const INITIAL_MESSAGE_LIMIT = 20; // Load only 20 messages initially
const PAGINATION_LIMIT = 15; // Load 15 more when paginating
const REQUEST_TIMEOUT = 20000; // 20 second timeout
const SCROLL_THRESHOLD = 0.1;

export default function SupportChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const [conversation, setConversation] = useState<CachedConversation | null>(null);
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // Enhanced pagination states
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  // ActionCable connection state
  const [isConnected, setIsConnected] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheManager = useRef(ChatCacheManager.getInstance());
  const cacheUnsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize ActionCable connection and cache subscription
  useEffect(() => {
    if (!id) return;

    // Subscribe to cache updates
    cacheUnsubscribeRef.current = cacheManager.current.subscribe(id, (conversationId, cachedData) => {
      console.log(`📦 Cache updated for conversation ${conversationId}`);
      setConversation(cachedData.conversation);
      setMessages(cachedData.messages);
      setHasMoreMessages(cachedData.hasMoreMessages);
    });

    const initActionCable = async () => {
      try {
        const currentAccount = accountManager.getCurrentAccount();
        if (!currentAccount || !user) return;

        actionCableRef.current = ActionCableService.getInstance();
        
        const connected = await actionCableRef.current.connect({
          token: currentAccount.token,
          userId: user.id.toString(),
        });

        if (connected && id) {
          setIsConnected(true);
          console.log('✅ ActionCable connected for support chat');
          
          await actionCableRef.current.joinConversation(id);
          
          // FIXED: Enhanced message subscription with proper structure handling
          actionCableRef.current.subscribe('new_message', handleNewMessage);
          actionCableRef.current.subscribe('conversation_read', handleMessageRead);
          actionCableRef.current.subscribe('typing_indicator', handleTypingIndicator);
          actionCableRef.current.subscribe('ticket_status_changed', handleTicketStatusChange);
          actionCableRef.current.subscribe('conversation_updated', handleConversationUpdate);
          
          // FIXED: Connection status handlers
          actionCableRef.current.subscribe('connection_established', handleConnectionEstablished);
          actionCableRef.current.subscribe('connection_lost', handleConnectionLost);
          actionCableRef.current.subscribe('connection_error', handleConnectionError);
        }
      } catch (error) {
        console.error('Failed to initialize ActionCable:', error);
        setIsConnected(false);
      }
    };

    initActionCable();

    return () => {
      if (actionCableRef.current && id) {
        actionCableRef.current.leaveConversation(id);
        actionCableRef.current.unsubscribe('new_message');
        actionCableRef.current.unsubscribe('conversation_read');
        actionCableRef.current.unsubscribe('typing_indicator');
        actionCableRef.current.unsubscribe('ticket_status_changed');
        actionCableRef.current.unsubscribe('conversation_updated');
        actionCableRef.current.unsubscribe('connection_established');
        actionCableRef.current.unsubscribe('connection_lost');
        actionCableRef.current.unsubscribe('connection_error');
      }
      
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Unsubscribe from cache updates
      if (cacheUnsubscribeRef.current) {
        cacheUnsubscribeRef.current();
      }
    };
  }, [user, id]);

  // FIXED: Enhanced ActionCable event handlers with proper error handling
  const handleNewMessage = useCallback((data: any) => {
    console.log('📨 New message received:', data);
    
    if (data.conversation_id === id && data.message) {
      try {
        // FIXED: Proper message structure handling
        const messageData = data.message;
        
        const newMessage: CachedMessage = {
          id: messageData.id || `msg-${Date.now()}`,
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
        };

        // Update cache with new message
        cacheManager.current.addMessageToCache(id, newMessage);
        
        // FIXED: Auto-scroll for new messages (but not for own messages to avoid jarring)
        if (messageData.user?.id !== user?.id) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
        
        console.log('✅ New message processed and cached');
      } catch (error) {
        console.error('❌ Error processing new message:', error);
      }
    }
  }, [id, user?.id]);

  const handleMessageRead = useCallback((data: any) => {
    if (data.conversation_id === id) {
      console.log(`📖 ${data.reader_name || 'Someone'} read the conversation`);
    }
  }, [id]);

  const handleTypingIndicator = useCallback((data: any) => {
    if (data.conversation_id === id && data.user_id !== user?.id) {
      setTypingUsers(prev => {
        if (data.typing) {
          const exists = prev.find(u => u.id === data.user_id);
          if (!exists) {
            return [...prev, { id: data.user_id, name: data.user_name }];
          }
          return prev;
        } else {
          return prev.filter(u => u.id !== data.user_id);
        }
      });
    }
  }, [id, user?.id]);

  const handleTicketStatusChange = useCallback((data: any) => {
    if (data.conversation_id === id) {
      console.log('🎫 Ticket status changed:', data.new_status);
      
      // Update cache with conversation status change
      cacheManager.current.updateConversationMetadata(id, { status: data.new_status });
      
      // FIXED: Add system message if provided
      if (data.system_message) {
        try {
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
        } catch (error) {
          console.error('❌ Error processing system message:', error);
        }
      }
    }
  }, [id]);

  const handleConversationUpdate = useCallback((data: any) => {
    if (data.conversation_id === id) {
      console.log('🔄 Conversation updated:', data);
      
      // Update cache with conversation changes
      const updates: any = {};
      if (data.status) updates.status = data.status;
      if (data.priority) updates.priority = data.priority;
      if (data.assigned_agent) updates.assigned_agent = data.assigned_agent;
      if (data.escalated !== undefined) updates.escalated = data.escalated;
      
      cacheManager.current.updateConversationMetadata(id, updates);
    }
  }, [id]);

  // FIXED: Connection status handlers
  const handleConnectionEstablished = useCallback(() => {
    setIsConnected(true);
    console.log('✅ ActionCable connection established');
  }, []);

  const handleConnectionLost = useCallback(() => {
    setIsConnected(false);
    console.log('❌ ActionCable connection lost');
  }, []);

  const handleConnectionError = useCallback(() => {
    setIsConnected(false);
    console.log('❌ ActionCable connection error');
  }, []);

  // Enhanced conversation loading with cache integration
  const loadConversation = useCallback(async (isRefresh = false, loadOlder = false) => {
    if (!id) {
      setLoading(false);
      return;
    }

    // Check cache first (unless it's a refresh or we need to load older messages)
    if (!isRefresh && !loadOlder) {
      const cachedData = cacheManager.current.getCachedConversation(id);
      if (cachedData) {
        console.log(`📦 Loading conversation from cache: ${id}`);
        setConversation(cachedData.conversation);
        setMessages(cachedData.messages);
        setHasMoreMessages(cachedData.hasMoreMessages);
        setLoading(false);
        setIsInitialLoad(false);
        
        // Scroll to bottom for cached data
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
        return;
      }
    }

    // If no cache or refresh requested, proceed with API call
    console.log(`🌐 Loading conversation from API: ${id}`, { isRefresh, loadOlder });

    // Cancel previous request
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

      // For pagination, get the oldest message ID from cache
      if (loadOlder) {
        const oldestMessageId = cacheManager.current.getOldestMessageId(id);
        if (oldestMessageId) {
          params.older_than = oldestMessageId;
        }
      }

      console.log('API request params:', params);

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

        if (isRefresh || (!loadOlder && !cacheManager.current.isCached(id))) {
          // Initial load or refresh - replace cache completely
          cacheManager.current.setCachedConversation(
            id,
            conversationData,
            messagesData,
            pagination.has_more || false,
            messagesData.length > 0 ? messagesData[0]?.id : null
          );
          setIsInitialLoad(false);

          // Scroll to bottom for initial load
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
        } else if (loadOlder) {
          // Loading older messages - prepend to cache
          cacheManager.current.prependOlderMessages(
            id,
            messagesData,
            pagination.has_more || false
          );
        }

        console.log(`Loaded ${messagesData.length} messages, has_more: ${pagination.has_more}`);
      } else {
        throw new Error(response.data.message || 'Failed to load conversation');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }

      console.error('Failed to load conversation:', error);
      setConnectionError(true);

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        Alert.alert(
          'Connection Timeout', 
          'The request took too long. Please check your connection and try again.',
          [
            { text: 'Retry', onPress: () => loadConversation(isRefresh, loadOlder) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert(
          'Error', 
          'Failed to load conversation. Please check your connection and try again.',
          [
            { text: 'Retry', onPress: () => loadConversation(isRefresh, loadOlder) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } finally {
      setLoading(false);
      setLoadingOlder(false);
      setRefreshing(false);
    }
  }, [id]);

  // Load older messages when scrolling to top
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !cacheManager.current.shouldLoadOlderMessages(id)) {
      return;
    }
    
    console.log('Loading older messages for conversation:', id);
    await loadConversation(false, true);
  }, [loadConversation, id, loadingOlder]);

  // Refresh conversation
  const handleRefresh = useCallback(async () => {
    // Clear cache and reload from API
    cacheManager.current.clearConversationCache(id);
    await loadConversation(true);
  }, [loadConversation, id]);

  // Initial load
  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Typing indicator functionality
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

  // Enhanced send message with cache-based optimistic updates
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || sending || !id) return;

    setSending(true);
    const messageText = inputText.trim();
    setInputText('');
    
    if (isTyping && actionCableRef.current) {
      setIsTyping(false);
      actionCableRef.current.stopTyping(id);
    }

    // Add optimistic message to cache
    const optimisticMessage: CachedMessage = {
      id: `optimistic-${Date.now()}`,
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
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Create abort controller for send request
    const sendAbortController = new AbortController();
    const sendTimeoutId = setTimeout(() => {
      sendAbortController.abort();
    }, REQUEST_TIMEOUT);

    try {
      const response = await api.post(`/api/v1/conversations/${id}/send_message`, {
        content: messageText,
        message_type: 'text',
      }, {
        signal: sendAbortController.signal,
        timeout: REQUEST_TIMEOUT,
      });

      clearTimeout(sendTimeoutId);

      if (response.data.success) {
        // Remove optimistic message and add real message
        cacheManager.current.removeOptimisticMessages(id);
        cacheManager.current.addMessageToCache(id, response.data.message);
        
        // Update conversation metadata if provided
        if (response.data.conversation) {
          cacheManager.current.updateConversationMetadata(id, {
            last_activity_at: response.data.conversation.last_activity_at,
            status: response.data.conversation.status
          });
        }
        
        console.log('✅ Message sent successfully');
      } else {
        throw new Error(response.data.message || 'Failed to send message');
      }
    } catch (error: any) {
      clearTimeout(sendTimeoutId);
      
      if (error.name === 'AbortError') {
        Alert.alert('Request Timeout', 'Message sending timed out. Please try again.');
      } else {
        console.error('Failed to send message:', error);
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
      
      // Remove optimistic message on error and restore input text
      cacheManager.current.removeOptimisticMessages(id);
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, id, user, isTyping]);

  // Quick actions for support agents
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

  // Memoized components for performance
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      <View
        style={[
          styles.messageBubble,
          item.from_support ? styles.supportMessage : styles.customerMessage,
          item.is_system && styles.systemMessage,
          item.optimistic && styles.optimisticMessage,
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
          {item.optimistic && (
            <View style={styles.optimisticIndicator}>
              <ActivityIndicator size={12} color="rgba(255, 255, 255, 0.7)" />
            </View>
          )}
        </View>
      </View>
    </View>
  ), []);

  const renderTypingIndicator = useMemo(() => {
    if (typingUsers.length === 0) return null;
    
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>
            {typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </Text>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, { animationDelay: '0ms' }]} />
            <View style={[styles.typingDot, { animationDelay: '200ms' }]} />
            <View style={[styles.typingDot, { animationDelay: '400ms' }]} />
          </View>
        </View>
      </View>
    );
  }, [typingUsers]);

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

  // Show connection status in header subtitle
  const getConnectionStatusText = () => {
    if (!conversation) return 'Loading...';
    if (!isConnected) return 'Connecting...';
    return 'Online';
  };

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
      {/* Header */}
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
              {isConnected && (
                <View style={styles.connectionIndicator}>
                  <View style={styles.onlineIndicator} />
                </View>
              )}
            </View>
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

      {/* Ticket Info Bar */}
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

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={{ paddingVertical: 8 }}
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
          ListFooterComponent={renderTypingIndicator}
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

        {/* Input Area */}
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
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
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

      {/* Quick Actions Modal */}
      {renderQuickActionsModal()}
    </SafeAreaView>
  );
}

// Utility function
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
    backgroundColor: '#0B141B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerBackButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    color: '#E1BEE7',
    fontSize: 12,
  },
  escalatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  escalatedText: {
    color: '#f97316',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  connectionIndicator: {
    marginLeft: 6,
  },
  onlineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 4,
  },
  ticketInfoBar: {
    flexDirection: 'row',
    backgroundColor: '#1F2C34',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  ticketInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  ticketInfoLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginRight: 4,
  },
  ticketInfoValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  connectionWarning: {
    color: '#f97316',
    fontSize: 12,
    marginLeft: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 8,
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
  messageContainer: {
    marginVertical: 2,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    position: 'relative',
  },
  supportMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7B3F98',
    borderBottomRightRadius: 4,
  },
  customerMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2C34',
    borderBottomLeftRadius: 4,
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    borderRadius: 12,
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  optimisticMessage: {
    opacity: 0.7,
  },
  systemIndicator: {
    marginRight: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  supportMessageText: {
    color: '#fff',
  },
  customerMessageText: {
    color: '#fff',
  },
  systemMessageText: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
  },
  optimisticMessageText: {
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  supportMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  customerMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  systemMessageTime: {
    color: '#8E8E93',
  },
  optimisticIndicator: {
    marginLeft: 8,
  },
  typingContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2C34',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
    marginRight: 8,
  },
  typingDots: {
    flexDirection: 'row',
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8E8E93',
    marginHorizontal: 1,
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyMessagesText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptyMessagesSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  inputContainer: {
    backgroundColor: '#1F2C34',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputButton: {
    padding: 8,
    marginRight: 8,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#0B141B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
  },
  textInput: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: '#7B3F98',
  },
  sendButtonInactive: {
    backgroundColor: '#444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionsModal: {
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 16,
  },
  retryButton: {
    backgroundColor: '#7B3F98',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#7B3F98',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
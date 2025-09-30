// app/(support)/chat/[id].tsx - FIXED: Proper online status + auto mark as read
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
  delivered_at?: string | null;
  read_at?: string | null;
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

const INITIAL_MESSAGE_LIMIT = 20;
const PAGINATION_LIMIT = 15;
const REQUEST_TIMEOUT = 20000;
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
  
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [customerOnline, setCustomerOnline] = useState(false);
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(null);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheManager = useRef(ChatCacheManager.getInstance());
  const cacheUnsubscribeRef = useRef<(() => void) | null>(null);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);
  const conversationLoadedRef = useRef(false);

  useEffect(() => {
    if (!id) return;

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
          
          setupActionCableSubscriptions();
          
          // FIXED: Mark messages as read when conversation loads
          if (!hasMarkedAsRead) {
            await markConversationAsRead();
          }
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
      }
      
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (cacheUnsubscribeRef.current) {
        cacheUnsubscribeRef.current();
      }
    };
  }, [user, id]);

  // FIXED: Mark conversation as read
  const markConversationAsRead = useCallback(async () => {
    if (!id || !actionCableRef.current || hasMarkedAsRead) return;

    try {
      const success = await actionCableRef.current.markMessageRead(id);
      if (success) {
        setHasMarkedAsRead(true);
        console.log('✅ Marked conversation as read');
      }
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  }, [id, hasMarkedAsRead]);

  const setupActionCableSubscriptions = () => {
    if (!actionCableRef.current || !id) return;

    const actionCable = actionCableRef.current;

    actionCableSubscriptions.current.forEach(unsub => unsub());
    actionCableSubscriptions.current = [];

    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      console.log('📨 INSTANT message received:', data);
      
      if (data.conversation_id !== id || !data.message) return;
      
      const messageData = data.message;
      const messageId = String(messageData.id);
      
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
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        
        // FIXED: Auto mark as read when receiving new messages
        markConversationAsRead();
      }
      
      console.log('✅ New message processed and cached');
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
      if (data.conversation_id === id) {
        console.log(`📖 ${data.reader_name || 'Someone'} read the conversation`);
        setMessages(prev => prev.map(msg => ({
          ...msg,
          read_at: msg.read_at || data.timestamp
        })));
      }
    });
    actionCableSubscriptions.current.push(unsubRead);

    const unsubTyping = actionCable.subscribe('typing_indicator', (data) => {
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
    });
    actionCableSubscriptions.current.push(unsubTyping);

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

    // FIXED: Proper presence tracking
    const unsubPresence = actionCable.subscribe('user_presence_changed', (data) => {
      if (data.conversation_id === id && data.user_id !== user?.id) {
        console.log('👤 Customer presence changed:', data.status);
        
        const isOnline = data.status === 'online';
        setCustomerOnline(isOnline);
        
        if (!isOnline && data.last_seen) {
          setLastSeenTime(data.last_seen);
        } else if (isOnline) {
          setLastSeenTime(null);
        }
      }
    });
    actionCableSubscriptions.current.push(unsubPresence);

    // FIXED: Track user joined events for initial presence
    const unsubJoined = actionCable.subscribe('user_joined_conversation', (data) => {
      if (data.conversation_id === id && data.user_id !== user?.id) {
        console.log('👤 Customer joined conversation');
        if (data.user_presence) {
          setCustomerOnline(data.user_presence.is_online);
          if (!data.user_presence.is_online && data.user_presence.last_seen_at) {
            setLastSeenTime(data.user_presence.last_seen_at);
          }
        }
      }
    });
    actionCableSubscriptions.current.push(unsubJoined);

    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
      console.log('✅ ActionCable connection established');
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
      console.log('❌ ActionCable connection lost');
    });
    actionCableSubscriptions.current.push(unsubLost);

    const unsubError = actionCable.subscribe('connection_error', () => {
      setIsConnected(false);
      console.log('❌ ActionCable connection error');
    });
    actionCableSubscriptions.current.push(unsubError);

    console.log('✅ ActionCable subscriptions configured');
  };

  const loadConversation = useCallback(async (isRefresh = false, loadOlder = false) => {
    if (!id) {
      setLoading(false);
      return;
    }

    if (!isRefresh && !loadOlder && !conversationLoadedRef.current) {
      const cachedData = cacheManager.current.getCachedConversation(id);
      if (cachedData) {
        console.log(`📦 Loading conversation from cache: ${id}`);
        setConversation(cachedData.conversation);
        setMessages(cachedData.messages);
        setHasMoreMessages(cachedData.hasMoreMessages);
        setLoading(false);
        setIsInitialLoad(false);
        conversationLoadedRef.current = true;
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
        
        // FIXED: Mark as read after loading from cache
        if (!hasMarkedAsRead && actionCableRef.current) {
          markConversationAsRead();
        }
        
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

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
          
          // FIXED: Mark as read after loading from API
          if (!hasMarkedAsRead && actionCableRef.current) {
            markConversationAsRead();
          }
        } else if (loadOlder) {
          cacheManager.current.prependOlderMessages(
            id,
            messagesData,
            pagination.has_more || false
          );
        }

        // FIXED: Get initial customer presence from conversation data
        if (conversationData.customer_presence) {
          setCustomerOnline(conversationData.customer_presence.is_online);
          if (!conversationData.customer_presence.is_online && conversationData.customer_presence.last_seen_at) {
            setLastSeenTime(conversationData.customer_presence.last_seen_at);
          }
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
  }, [id, hasMarkedAsRead, markConversationAsRead]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !cacheManager.current.shouldLoadOlderMessages(id)) {
      return;
    }
    
    console.log('Loading older messages for conversation:', id);
    await loadConversation(false, true);
  }, [loadConversation, id, loadingOlder]);

  const handleRefresh = useCallback(async () => {
    cacheManager.current.clearConversationCache(id);
    conversationLoadedRef.current = false;
    setHasMarkedAsRead(false);
    await loadConversation(true);
  }, [loadConversation, id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

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

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || sending || !id) return;

    setSending(true);
    const messageText = inputText.trim();
    setInputText('');
    
    if (isTyping && actionCableRef.current) {
      setIsTyping(false);
      actionCableRef.current.stopTyping(id);
    }

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
      clearTimeout(sendTimeoutId);
      
      if (error.name === 'AbortError') {
        Alert.alert('Request Timeout', 'Message sending timed out. Please try again.');
      } else {
        console.error('Failed to send message:', error);
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
      
      cacheManager.current.removeOptimisticMessages(id);
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, id, user, isTyping]);

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

  const renderMessageStatus = (message: ChatMessage) => {
    if (message.from_support && message.user.id === user?.id) {
      if (message.optimistic) {
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
    }

    return null;
  };

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
          {item.optimistic ? (
            <View style={styles.messageStatusContainer}>
              <ActivityIndicator size={12} color="rgba(255, 255, 255, 0.7)" />
            </View>
          ) : (
            renderMessageStatus(item)
          )}
        </View>
      </View>
    </View>
  ), [user?.id]);

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

  // FIXED: Proper status display with last seen time
  const getConnectionStatusText = () => {
    if (!conversation) return 'Loading...';
    if (!isConnected) return 'Connecting...';
    
    if (customerOnline) {
      return 'Online';
    }
    
    if (lastSeenTime) {
      const lastSeen = new Date(lastSeenTime);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
      
      if (diffMinutes < 1) return 'Last seen just now';
      if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Last seen ${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Last seen yesterday';
      if (diffDays < 7) return `Last seen ${diffDays} days ago`;
      
      return 'Last seen recently';
    }
    
    return 'Offline';
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
              {isConnected && customerOnline && (
                <View style={styles.connectionIndicator}>
                  <View style={styles.onlineIndicator} />
                </View>
              )}
            </View>
            <Text style={styles.headerStatusText}>{getConnectionStatusText()}</Text>
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
  headerStatusText: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 1,
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
  messageStatusContainer: {
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
    backgroundColor: 'rgba(11, 20, 27, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 25,
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginRight: 8,
    maxHeight: 100,
    minHeight: 45,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  inputButton: {
    padding: 8,
    marginLeft: 4,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    textAlignVertical: 'center',
    maxHeight: 80,
  },
  attachButton: {
    padding: 8,
  },
  cameraButton: {
    padding: 8,
    marginRight: 4,
  },
  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sendButtonActive: {
    backgroundColor: '#7B3F98',
  },
  voiceButton: {
    backgroundColor: '#7B3F98',
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
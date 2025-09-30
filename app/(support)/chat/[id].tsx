// app/(support)/chat/[id].tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '../../../context/UserContext';
import api from '../../../lib/api';
import ActionCableService from '../../../lib/services/ActionCableService';
import { accountManager } from '../../../lib/AccountManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

export default function SupportChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const conversationLoaded = useRef(false);
  const messageIds = useRef(new Set<string>());

  const STORAGE_KEY = `conversation_${id}`;
  const MESSAGES_KEY = `messages_${id}`;

  // Load from cache first
  const loadFromCache = useCallback(async () => {
    try {
      const [cachedConv, cachedMsgs] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(MESSAGES_KEY),
      ]);

      if (cachedConv) {
        const convData = JSON.parse(cachedConv);
        setConversation(convData);
        console.log('📦 Loaded conversation from cache');
      }

      if (cachedMsgs) {
        const msgsData = JSON.parse(cachedMsgs);
        setMessages(msgsData);
        msgsData.forEach((msg: ChatMessage) => messageIds.current.add(msg.id));
        console.log('📦 Loaded messages from cache');
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }

      return { hasConversation: !!cachedConv, hasMessages: !!cachedMsgs };
    } catch (error) {
      console.error('Failed to load from cache:', error);
      return { hasConversation: false, hasMessages: false };
    }
  }, [id]);

  // Save to cache
  const saveToCache = useCallback(async (conv: ChatConversation | null, msgs: ChatMessage[]) => {
    try {
      if (conv) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conv));
      }
      if (msgs.length > 0) {
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
      }
    } catch (error) {
      console.error('Failed to save to cache:', error);
    }
  }, [STORAGE_KEY, MESSAGES_KEY]);

  // Load conversation from API (only once)
  const loadConversation = useCallback(async () => {
    if (conversationLoaded.current) {
      console.log('⏭️ Conversation already loaded, skipping API call');
      return;
    }

    try {
      setLoading(true);
      console.log('🌐 Loading conversation from API...');

      const response = await api.get(`/api/v1/conversations/${id}`);

      if (response.data.success) {
        const convData = response.data.conversation;
        const msgsData = response.data.messages || [];

        setConversation(convData);
        
        const formattedMessages = msgsData.map((msg: any) => ({
          id: String(msg.id),
          content: msg.content || '',
          created_at: msg.created_at,
          timestamp: new Date(msg.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          is_system: msg.is_system || false,
          from_support: msg.from_support || false,
          message_type: msg.message_type || 'text',
          user: msg.user || { id: '', name: 'Unknown', role: 'unknown' },
          optimistic: false,
          delivered_at: msg.delivered_at,
          read_at: msg.read_at,
        }));

        setMessages(formattedMessages);
        formattedMessages.forEach((msg: ChatMessage) => messageIds.current.add(msg.id));

        // Save to cache
        await saveToCache(convData, formattedMessages);

        conversationLoaded.current = true;
        console.log('✅ Conversation loaded from API');

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      Alert.alert('Error', 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [id, saveToCache]);

  // Setup ActionCable
  const setupActionCable = useCallback(async () => {
    if (!user || !id) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

      console.log('📡 Setting up ActionCable...');

      actionCableRef.current = ActionCableService.getInstance();
      
      const connected = await actionCableRef.current.connect({
        token: currentAccount.token,
        userId: currentAccount.id,
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        setIsOnline(true);
        
        await actionCableRef.current.joinConversation(id);
        
        // Connection status
        actionCableRef.current.subscribe('connection_established', () => {
          setIsConnected(true);
          setIsOnline(true);
        });

        actionCableRef.current.subscribe('connection_lost', () => {
          setIsConnected(false);
          setIsOnline(false);
        });

        // New message
        actionCableRef.current.subscribe('new_message', (data) => {
          if (data.conversation_id === id && data.message) {
            const messageId = String(data.message.id);
            
            if (messageIds.current.has(messageId)) {
              console.log('Skipping duplicate message:', messageId);
              return;
            }

            const newMessage: ChatMessage = {
              id: messageId,
              content: data.message.content || '',
              created_at: data.message.created_at,
              timestamp: new Date(data.message.created_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
              is_system: data.message.is_system || false,
              from_support: data.message.from_support || false,
              message_type: data.message.message_type || 'text',
              user: data.message.user || { id: '', name: 'Unknown', role: 'unknown' },
              optimistic: false,
              delivered_at: data.message.delivered_at,
              read_at: data.message.read_at,
            };

            messageIds.current.add(messageId);
            setMessages(prev => {
              const updated = [...prev, newMessage];
              saveToCache(conversation, updated);
              return updated;
            });

            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        });

        // Message acknowledgment
        actionCableRef.current.subscribe('message_acknowledged', (data) => {
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

        // Typing indicator
        actionCableRef.current.subscribe('typing_indicator', (data) => {
          if (data.conversation_id === id && data.user_id !== user.id) {
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

        // Status changes
        actionCableRef.current.subscribe('ticket_status_changed', (data) => {
          if (data.conversation_id === id) {
            setConversation(prev => prev ? { ...prev, status: data.new_status } : null);
          }
        });

        console.log('✅ ActionCable setup complete');
      }
    } catch (error) {
      console.error('Failed to setup ActionCable:', error);
      setIsConnected(false);
      setIsOnline(false);
    }
  }, [user, id, conversation, saveToCache]);

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      const cached = await loadFromCache();
      
      if (!cached.hasConversation || !cached.hasMessages) {
        await loadConversation();
      } else {
        setLoading(false);
      }
      
      await setupActionCable();
    };

    initialize();

    return () => {
      if (actionCableRef.current && id) {
        actionCableRef.current.leaveConversation(id);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [id, loadFromCache, loadConversation, setupActionCable]);

  // Handle typing
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

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || sending || !id) return;

    setSending(true);
    const messageText = inputText.trim();
    setInputText('');
    
    if (isTyping && actionCableRef.current) {
      setIsTyping(false);
      actionCableRef.current.stopTyping(id);
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      content: messageText,
      created_at: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      is_system: false,
      from_support: true,
      message_type: 'text',
      user: {
        id: user?.id || '',
        name: user?.display_name || user?.first_name || 'Support',
        role: 'support',
        avatar_url: user?.avatar_url,
      },
      optimistic: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const response = await api.post(`/api/v1/conversations/${id}/send_message`, {
        content: messageText,
        message_type: 'text',
      });

      if (response.data.success) {
        // Remove optimistic, real message will come via ActionCable
        setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, id, user, isTyping]);

  // Render message status
  const renderMessageStatus = (message: ChatMessage) => {
    if (!message.from_support || message.user.id !== user?.id || message.optimistic) {
      return null;
    }

    if (message.read_at) {
      return <MaterialIcons name="done-all" size={16} color="#4FC3F7" />;
    }

    if (message.delivered_at) {
      return <MaterialIcons name="done-all" size={16} color="rgba(255, 255, 255, 0.5)" />;
    }

    return <MaterialIcons name="done" size={16} color="rgba(255, 255, 255, 0.5)" />;
  };

  // Render message
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
          <Text style={styles.messageTime}>{item.timestamp}</Text>
          {item.optimistic ? (
            <ActivityIndicator size={12} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 4 }} />
          ) : (
            <View style={styles.messageStatusContainer}>
              {renderMessageStatus(item)}
            </View>
          )}
        </View>
      </View>
    </View>
  ), [user?.id]);

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
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
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
                {isOnline ? 'online' : 'offline'}
              </Text>
              {isOnline && (
                <View style={styles.onlineIndicator} />
              )}
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="phone" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="more-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

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
          ListFooterComponent={renderTypingIndicator}
        />

        <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'ios' ? 34 : 8 }]}>
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
              />
              
              <TouchableOpacity style={styles.attachButton}>
                <Feather name="paperclip" size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.sendButton, inputText.trim() ? styles.sendButtonActive : styles.voiceButton]}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B141B' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8E8E93', fontSize: 16, marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 28, paddingBottom: 12, paddingHorizontal: 12 },
  backButton: { padding: 8, marginRight: 8 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  headerText: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerSubtitle: { color: '#E1BEE7', fontSize: 12 },
  onlineIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginLeft: 6 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionButton: { padding: 8, marginLeft: 4 },
  messagesContainer: { flex: 1 },
  messagesList: { flex: 1, paddingHorizontal: 8 },
  messageContainer: { marginVertical: 2 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  supportMessage: { alignSelf: 'flex-end', backgroundColor: '#7B3F98', borderBottomRightRadius: 4 },
  customerMessage: { alignSelf: 'flex-start', backgroundColor: '#1F2C34', borderBottomLeftRadius: 4 },
  systemMessage: { alignSelf: 'center', backgroundColor: 'rgba(142, 142, 147, 0.1)', borderRadius: 12 },
  optimisticMessage: { opacity: 0.7 },
  messageText: { fontSize: 16, lineHeight: 20 },
  supportMessageText: { color: '#fff' },
  customerMessageText: { color: '#fff' },
  systemMessageText: { color: '#8E8E93', fontSize: 14, fontStyle: 'italic' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  messageTime: { fontSize: 11, color: 'rgba(255, 255, 255, 0.7)' },
  messageStatusContainer: { marginLeft: 4 },
  typingContainer: { paddingHorizontal: 8, paddingVertical: 4 },
  typingBubble: { alignSelf: 'flex-start', backgroundColor: '#1F2C34', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  typingText: { color: '#8E8E93', fontSize: 14, fontStyle: 'italic' },
  inputContainer: { backgroundColor: 'rgba(11, 20, 27, 0.95)', paddingHorizontal: 8, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  textInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2C34', borderRadius: 25, paddingHorizontal: 4, paddingVertical: 6, marginRight: 8, maxHeight: 100, minHeight: 45 },
  inputButton: { padding: 8, marginLeft: 4 },
  textInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 8, paddingHorizontal: 8, maxHeight: 80 },
  attachButton: { padding: 8 },
  sendButton: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: '#7B3F98' },
  voiceButton: { backgroundColor: '#7B3F98' },
});
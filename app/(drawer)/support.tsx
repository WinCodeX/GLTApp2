// app/(drawer)/support.tsx
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
  Alert,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import api from '../../lib/api';
import ActionCableService from '../../lib/services/ActionCableService';
import { useUser } from '../../context/UserContext';
import { accountManager } from '../../lib/AccountManager';
import { NavigationHelper } from '../../lib/helpers/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isSupport: boolean;
  type?: 'text' | 'voice' | 'system';
  packageCode?: string;
  isTagged?: boolean;
  optimistic?: boolean;
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

const CONVERSATION_STORAGE_KEY = 'support_conversation';
const MESSAGES_STORAGE_KEY = 'support_messages';
const CONVERSATION_ID_KEY = 'support_conversation_id';

export default function SupportScreen() {
  const params = useLocalSearchParams();
  const { user } = useUser();
  
  const autoSelectPackage = params.autoSelectPackage === 'true';
  const preFilledPackageCode = params.packageCode as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasActiveTicket, setHasActiveTicket] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  
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
  const actionCableRef = useRef<ActionCableService | null>(null);
  const messageIds = useRef(new Set<string>());
  const conversationLoaded = useRef(false);

  const handleGoBack = useCallback(() => {
    NavigationHelper.goBack({
      fallbackRoute: '/(tabs)',
      replaceIfNoHistory: true
    });
  }, []);

  // Load from cache
  const loadFromCache = useCallback(async () => {
    try {
      const [cachedConvId, cachedMsgs] = await Promise.all([
        AsyncStorage.getItem(CONVERSATION_ID_KEY),
        AsyncStorage.getItem(MESSAGES_STORAGE_KEY),
      ]);

      if (cachedConvId) {
        setConversationId(cachedConvId);
        setHasActiveTicket(true);
        console.log('📦 Loaded conversation ID from cache:', cachedConvId);
      }

      if (cachedMsgs) {
        const msgsData = JSON.parse(cachedMsgs);
        setMessages(msgsData);
        msgsData.forEach((msg: Message) => messageIds.current.add(msg.id));
        console.log('📦 Loaded messages from cache');
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }

      return { hasConversation: !!cachedConvId, hasMessages: !!cachedMsgs };
    } catch (error) {
      console.error('Failed to load from cache:', error);
      return { hasConversation: false, hasMessages: false };
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback(async (convId: string | null, msgs: Message[]) => {
    try {
      if (convId) {
        await AsyncStorage.setItem(CONVERSATION_ID_KEY, convId);
      }
      if (msgs.length > 0) {
        await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(msgs));
      }
    } catch (error) {
      console.error('Failed to save to cache:', error);
    }
  }, []);

  // Setup ActionCable
  const setupActionCable = useCallback(async () => {
    if (!user) return;

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

        // Connection status
        actionCableRef.current.subscribe('connection_established', () => {
          setIsConnected(true);
          setIsOnline(true);
        });

        actionCableRef.current.subscribe('connection_lost', () => {
          setIsConnected(false);
          setIsOnline(false);
        });

        // Join conversation if exists
        if (conversationId) {
          await actionCableRef.current.joinConversation(conversationId);
        }

        // New message
        actionCableRef.current.subscribe('new_message', (data) => {
          if (data.conversation_id === conversationId && data.message) {
            const messageId = String(data.message.id);
            
            if (messageIds.current.has(messageId)) {
              console.log('Skipping duplicate message:', messageId);
              return;
            }

            const newMessage: Message = {
              id: messageId,
              text: data.message.content || '',
              timestamp: new Date(data.message.created_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
              isSupport: data.message.from_support || data.message.is_system || false,
              type: data.message.message_type || 'text',
              packageCode: data.message.metadata?.package_code,
              isTagged: !!data.message.metadata?.package_code,
              optimistic: false,
              delivered_at: data.message.delivered_at,
              read_at: data.message.read_at,
            };

            messageIds.current.add(messageId);
            setMessages(prev => {
              const updated = [...prev, newMessage];
              saveToCache(conversationId, updated);
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
          if (data.conversation_id === conversationId && data.user_id !== user.id) {
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

        console.log('✅ ActionCable setup complete');
      }
    } catch (error) {
      console.error('Failed to setup ActionCable:', error);
      setIsConnected(false);
      setIsOnline(false);
    }
  }, [user, conversationId, saveToCache]);

  // Check active ticket
  const checkActiveTicket = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/conversations/active_support');
      
      if (response.data.success && response.data.conversation_id) {
        const convId = response.data.conversation_id;
        setConversationId(convId);
        setHasActiveTicket(true);
        
        if (!conversationLoaded.current) {
          await loadConversationMessages(convId);
          conversationLoaded.current = true;
        }
        
        return;
      }
      
      setHasActiveTicket(false);
      
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
      messageIds.current.add('1');
      
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
      messageIds.current.add('1');
      
      if (autoSelectPackage) {
        setShowPackageModal(true);
      } else {
        setShowTicketModal(true);
      }
    }
  }, [autoSelectPackage]);

  // Load conversation messages
  const loadConversationMessages = useCallback(async (convId: string) => {
    try {
      const response = await api.get(`/api/v1/conversations/${convId}`);
      
      if (response.data.success && response.data.messages) {
        const apiMessages: Message[] = response.data.messages.map((msg: any) => {
          const messageId = String(msg.id);
          messageIds.current.add(messageId);
          
          return {
            id: messageId,
            text: msg.content || '',
            timestamp: new Date(msg.created_at).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            }),
            isSupport: msg.from_support || msg.is_system || false,
            type: msg.message_type || 'text',
            packageCode: msg.metadata?.package_code,
            isTagged: !!msg.metadata?.package_code,
            optimistic: false,
            delivered_at: msg.delivered_at,
            read_at: msg.read_at,
          };
        });

        setMessages(apiMessages);
        await saveToCache(convId, apiMessages);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);

        const conversationData = response.data.conversation;
        if (conversationData?.package) {
          const pkg = conversationData.package;
          setSelectedPackage({
            id: String(pkg.id),
            code: pkg.code,
            state: pkg.state,
            state_display: pkg.state_display,
            receiver_name: pkg.receiver_name,
            route_description: pkg.route_description,
            cost: pkg.cost,
            delivery_type: pkg.delivery_type || 'agent',
            created_at: pkg.created_at || new Date().toISOString(),
          });
          setInquiryType('package');
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, [saveToCache]);

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      const cached = await loadFromCache();
      
      if (!cached.hasConversation) {
        await checkActiveTicket();
      } else {
        conversationLoaded.current = true;
      }
      
      await setupActionCable();
    };

    initialize();

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
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      backHandler.remove();
      
      if (actionCableRef.current && conversationId) {
        actionCableRef.current.leaveConversation(conversationId);
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [loadFromCache, checkActiveTicket, setupActionCable, handleGoBack, showTicketModal, showInquiryModal, showPackageModal, conversationId]);

  // Load packages
  const loadUserPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      
      const response = await api.get('/api/v1/packages', {
        params: { per_page: 100, page: 1 }
      });

      if (response.data && response.data.success) {
        const packages = response.data.data.map((pkg: any) => ({
          id: String(pkg.id || ''),
          code: pkg.code || '',
          state: pkg.state || 'unknown',
          state_display: pkg.state_display || 'Unknown',
          receiver_name: pkg.receiver_name || 'Unknown',
          route_description: pkg.route_description || 'Unknown',
          cost: Number(pkg.cost) || 0,
          delivery_type: pkg.delivery_type || 'agent',
          created_at: pkg.created_at || new Date().toISOString(),
        }));

        setUserPackages(packages);
        setFilteredPackages(packages);

        if (preFilledPackageCode) {
          const preSelected = packages.find((pkg: Package) => pkg.code === preFilledPackageCode);
          if (preSelected) {
            setSelectedPackage(preSelected);
            setInquiryType('package');
          }
        }
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  }, [preFilledPackageCode]);

  // Handle typing
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

  // Ensure conversation
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
        const newConvId = response.data.conversation_id;
        setConversationId(newConvId);
        setHasActiveTicket(true);
        
        await saveToCache(newConvId, messages);
        
        if (actionCableRef.current) {
          await actionCableRef.current.joinConversation(newConvId);
        }
        
        return newConvId;
      }
      
      throw new Error('Failed to create conversation');
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }, [conversationId, inquiryType, selectedPackage, messages, saveToCache]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    const messageText = inputText.trim();
    setInputText('');
    
    if (isTyping && actionCableRef.current && conversationId) {
      setIsTyping(false);
      actionCableRef.current.stopTyping(conversationId);
    }

    try {
      const convId = await ensureConversation();
      
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        text: messageText,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        isSupport: false,
        type: 'text',
        packageCode: selectedPackage?.code,
        isTagged: inquiryType === 'package' && !!selectedPackage,
        optimistic: true,
      };

      setMessages(prev => [...prev, optimisticMessage]);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const metadata = selectedPackage ? { package_code: selectedPackage.code } : undefined;
      const response = await api.post(`/api/v1/conversations/${convId}/send_message`, {
        content: messageText,
        message_type: 'text',
        metadata
      });
      
      if (response.data.success) {
        setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
        setHasActiveTicket(true);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
      setMessages(prev => prev.filter(msg => !msg.optimistic));
      setInputText(messageText);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, isTyping, conversationId, ensureConversation, selectedPackage, inquiryType]);

  // Create ticket functions
  const createBasicInquiryTicket = async () => {
    if (!inquiryText.trim()) return;

    setIsLoading(true);
    
    try {
      setInquiryType('basic');
      setSelectedPackage(null);
      
      const convId = await ensureConversation();
      
      const optimisticId = `temp-${Date.now()}`;
      const newMessage: Message = {
        id: optimisticId,
        text: inquiryText.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        isSupport: false,
        type: 'text',
        optimistic: true,
      };

      setMessages(prev => [...prev, newMessage]);
      closeAllModals();
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const response = await api.post(`/api/v1/conversations/${convId}/send_message`, {
        content: inquiryText.trim(),
        message_type: 'text'
      });
      
      if (response.data.success) {
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        setHasActiveTicket(true);
        
        setTimeout(() => {
          const systemMsg: Message = {
            id: `system-${Date.now()}`,
            text: 'Thank you for contacting us. Your inquiry has been received and a support agent will respond shortly.',
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
            isSupport: true,
            type: 'system',
          };
          
          if (!messageIds.current.has(systemMsg.id)) {
            messageIds.current.add(systemMsg.id);
            setMessages(prev => [...prev, systemMsg]);
          }
        }, 1500);
      }
      
    } catch (error) {
      console.error('Failed to create inquiry:', error);
      setMessages(prev => prev.filter(m => !m.optimistic));
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
      
      const optimisticId = `temp-${Date.now()}`;
      const newMessage: Message = {
        id: optimisticId,
        text: packageInquiry.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        isSupport: false,
        type: 'text',
        packageCode: selectedPackage.code,
        isTagged: true,
        optimistic: true,
      };

      setMessages(prev => [...prev, newMessage]);
      closeAllModals();
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const response = await api.post(`/api/v1/conversations/${convId}/send_message`, {
        content: packageInquiry.trim(),
        message_type: 'text',
        metadata: { package_code: selectedPackage.code }
      });
      
      if (response.data.success) {
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        setHasActiveTicket(true);
        
        setTimeout(() => {
          const systemMsg: Message = {
            id: `system-${Date.now()}`,
            text: `Thank you for your inquiry about package ${selectedPackage.code}. A support agent will review your ticket and respond shortly.`,
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
            isSupport: true,
            type: 'system',
          };
          
          if (!messageIds.current.has(systemMsg.id)) {
            messageIds.current.add(systemMsg.id);
            setMessages(prev => [...prev, systemMsg]);
          }
        }, 1500);
      }
      
    } catch (error) {
      console.error('Failed to create inquiry:', error);
      setMessages(prev => prev.filter(m => !m.optimistic));
    } finally {
      setIsLoading(false);
    }
  };

  // Modal management
  const closeAllModals = () => {
    setShowTicketModal(false);
    setShowInquiryModal(false);
    setShowPackageModal(false);
    setShowPackageSearch(false);
    setInquiryText('');
    setPackageInquiry('');
    setPackageSearchQuery('');
  };

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

  // Render functions
  const renderMessageStatus = (message: Message) => {
    if (message.isSupport || message.type === 'system' || message.optimistic) {
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
        
        <Text style={[styles.messageText, item.optimistic && styles.optimisticMessageText]}>
          {item.text}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {!item.isSupport && (
            item.optimistic ? (
              <ActivityIndicator size={12} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 4 }} />
            ) : (
              <View style={styles.messageStatusContainer}>
                {renderMessageStatus(item)}
              </View>
            )
          )}
        </View>
      </View>
    </View>
  );

  const renderPackageSearchItem = ({ item }: { item: Package }) => (
    <TouchableOpacity
      style={styles.packageSearchItem}
      onPress={() => {
        setSelectedPackage(item);
        setShowPackageSearch(false);
        setPackageSearchQuery('');
      }}
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

  const getConnectionStatusText = () => {
    if (!hasActiveTicket) return 'Start a conversation';
    if (!isOnline) return 'Connecting...';
    return 'online';
  };

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
              <Text style={styles.headerSubtitle}>{getConnectionStatusText()}</Text>
              {isOnline && hasActiveTicket && (
                <View style={styles.onlineIndicator} />
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
            ListFooterComponent={renderTypingIndicator}
          />
        </View>

        {hasActiveTicket && (
          <>
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
                    onPress={() => {
                      setShowPackageSearch(true);
                      if (userPackages.length === 0) loadUserPackages();
                    }}
                  >
                    <Feather name="search" size={16} color="#8b5cf6" />
                    <Text style={styles.selectPackageText}>Select Package</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={[
              styles.inputContainerFixed,
              { paddingBottom: Platform.OS === 'ios' ? (keyboardHeight > 0 ? 8 : 34) : 8 }
            ]}>
              <View style={styles.inputRow}>
                <View style={styles.textInputContainer}>
                  <TouchableOpacity style={styles.inputButton}>
                    <Feather name="smile" size={20} color="#8E8E93" />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={styles.textInput}
                    placeholder="Message"
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
          </>
        )}
      </KeyboardAvoidingView>

      {/* Modals */}
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
                    onPress={() => {
                      setShowTicketModal(false);
                      setShowInquiryModal(true);
                    }}
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
                    onPress={() => {
                      setShowTicketModal(false);
                      setShowPackageModal(true);
                    }}
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
                      <Text style={styles.sendButtonText}>
                        {isLoading ? 'Sending...' : 'Send'}
                      </Text>
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
                        onPress={() => {
                          setShowPackageSearch(true);
                          if (userPackages.length === 0) loadUserPackages();
                        }}
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
                            onChangeText={(text) => {
                              setPackageSearchQuery(text);
                              const filtered = userPackages.filter(pkg => 
                                pkg.code.toLowerCase().includes(text.toLowerCase()) ||
                                pkg.receiver_name.toLowerCase().includes(text.toLowerCase())
                              );
                              setFilteredPackages(filtered);
                            }}
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
                                  {packageSearchQuery ? 'No packages found' : 'No packages available'}
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
                      <Text style={styles.sendButtonText}>
                        {isLoading ? 'Sending...' : 'Send'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B141B' },
  flex: { flex: 1 },
  header: { paddingBottom: 12, paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  backButton: { marginRight: 12, padding: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerInfo: { flex: 1, justifyContent: 'center', marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '500', lineHeight: 20 },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  headerSubtitle: { color: '#E1BEE7', fontSize: 12, lineHeight: 14 },
  onlineIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginLeft: 6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', minWidth: 120 },
  headerButton: { marginLeft: 16, padding: 6 },
  messagesContainer: { flex: 1, backgroundColor: '#0B141B' },
  messagesList: { paddingVertical: 8, paddingHorizontal: 8, flexGrow: 1 },
  messageWrapper: { marginVertical: 3 },
  messageContainer: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18 },
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
  packageSection: { backgroundColor: 'rgba(11, 20, 27, 0.95)', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
  selectedPackageContainer: { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' },
  selectedPackageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  selectedPackageCode: { color: '#8b5cf6', fontSize: 14, fontWeight: '600', flex: 1, marginLeft: 8 },
  removePackageButton: { padding: 4 },
  selectedPackageDetails: { color: '#E5E7EB', fontSize: 12, lineHeight: 16 },
  selectPackageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)', borderStyle: 'dashed' },
  selectPackageText: { color: '#8b5cf6', fontSize: 14, fontWeight: '500', marginLeft: 8 },
  inputContainerFixed: { backgroundColor: 'rgba(11, 20, 27, 0.95)', paddingHorizontal: 8, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  textInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2C34', borderRadius: 25, paddingHorizontal: 4, paddingVertical: 6, marginRight: 8, maxHeight: 100, minHeight: 45 },
  inputButton: { padding: 8, marginLeft: 4 },
  textInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 8, paddingHorizontal: 8, maxHeight: 80 },
  attachButton: { padding: 8 },
  sendButtonMain: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: '#7B3F98' },
  voiceButton: { backgroundColor: '#7B3F98' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalBackdrop: { flex: 1 },
  modalContainer: { height: SCREEN_HEIGHT * 0.7, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#8E8E93', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { color: '#8E8E93', fontSize: 16, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  optionButton: { borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
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
});
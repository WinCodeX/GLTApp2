// app/(support)/chat/[id].tsx - Fixed Support Chat Screen
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
  Modal,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '../../../context/UserContext';
import api from '../../../lib/api';

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
  };
  timestamp: string;
  metadata?: any;
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

export default function SupportChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showActions, setShowActions] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load conversation and messages
  const loadConversation = useCallback(async () => {
    if (!id) {
      console.log('No conversation ID provided');
      setLoading(false);
      return;
    }

    try {
      console.log('Loading conversation with ID:', id);
      setLoading(true);
      
      const response = await api.get(`/api/v1/conversations/${id}`);
      console.log('Conversation response:', response.data);
      
      if (response.data.success) {
        setConversation(response.data.conversation);
        setMessages(response.data.messages || []);
        console.log('Conversation loaded successfully:', response.data.conversation.ticket_id);
      } else {
        console.error('API returned error:', response.data.message);
        Alert.alert('Error', response.data.message || 'Failed to load conversation');
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      Alert.alert('Error', 'Failed to load conversation. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || sending || !id) return;

    setSending(true);
    const messageText = inputText.trim();
    setInputText('');

    try {
      const response = await api.post(`/api/v1/conversations/${id}/send_message`, {
        content: messageText,
        message_type: 'text',
      });

      if (response.data.success) {
        // Add message to local state immediately for better UX
        const newMessage: ChatMessage = {
          id: response.data.message.id || `temp-${Date.now()}`,
          content: messageText,
          created_at: new Date().toISOString(),
          is_system: false,
          from_support: true,
          message_type: 'text',
          user: {
            id: user?.id || '',
            name: user?.display_name || user?.first_name || 'Support',
            role: 'support',
          },
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
        };

        setMessages((prev) => [...prev, newMessage]);
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        // Update conversation object with latest activity
        if (conversation) {
          setConversation({
            ...conversation,
            last_activity_at: new Date().toISOString(),
          });
        }
      } else {
        throw new Error(response.data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setInputText(messageText); // Restore text on error
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [inputText, sending, id, user, conversation]);

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
          loadConversation(); // Refresh to show assignment
          break;
        
        case 'escalate':
          // This could open a modal for escalation details
          Alert.alert('Escalate Ticket', 'Escalation feature coming soon');
          break;
        
        case 'close':
          await api.patch(`/api/v1/conversations/${id}/close`);
          Alert.alert('Success', 'Ticket closed');
          loadConversation();
          break;
        
        case 'priority_high':
          await api.patch(`/api/v1/support/tickets/${id}/priority`, {
            priority: 'high'
          });
          Alert.alert('Success', 'Priority set to high');
          loadConversation();
          break;
      }
    } catch (error) {
      console.error('Quick action failed:', error);
      Alert.alert('Error', 'Action failed');
    }
    setShowActions(false);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      <View
        style={[
          styles.messageBubble,
          item.from_support ? styles.supportMessage : styles.customerMessage,
          item.is_system && styles.systemMessage,
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
        <Text
          style={[
            styles.messageTime,
            item.from_support ? styles.supportMessageTime : styles.customerMessageTime,
            item.is_system && styles.systemMessageTime,
          ]}
        >
          {item.timestamp}
        </Text>
      </View>
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

  if (!conversation) {
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
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyMessagesContainer}>
              <MaterialIcons name="chat-bubble-outline" size={48} color="#444" />
              <Text style={styles.emptyMessagesText}>No messages yet</Text>
              <Text style={styles.emptyMessagesSubtext}>Start the conversation!</Text>
            </View>
          )}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.inputButton}>
              <Feather name="paperclip" size={20} color="#8E8E93" />
            </TouchableOpacity>
            
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor="#8E8E93"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size={16} color="#fff" />
              ) : (
                <Feather name="send" size={16} color="#fff" />
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
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 8,
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
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  supportMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  customerMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  systemMessageTime: {
    color: '#8E8E93',
    textAlign: 'center',
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
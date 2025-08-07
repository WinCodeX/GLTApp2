import {
  Feather,
  MaterialIcons
} from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { supportApi, type Conversation, type Message } from '../../services/supportApi';

interface SupportScreenProps {
  navigation: any;
  route: {
    params?: {
      conversationId?: string;
    };
  };
}

type TicketStep = 'category' | 'package-input' | 'creating' | 'complete';

export default function SupportScreen({ navigation, route }: SupportScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Modal states
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketStep, setTicketStep] = useState<TicketStep>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [packageCode, setPackageCode] = useState('');
  const [validatingPackage, setValidatingPackage] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  
  // Get conversation ID from route params
  const conversationId = route.params?.conversationId;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    initializeSupport();
  }, [conversationId]);

  // Retry pending operations when screen loads
  useEffect(() => {
    const retryTimer = setTimeout(() => {
      supportApi.retryPendingOperations();
    }, 2000);

    return () => clearTimeout(retryTimer);
  }, []);

  const initializeSupport = async () => {
    try {
      setLoading(true);

      if (conversationId) {
        // Load existing conversation
        await loadConversation(conversationId);
      } else {
        // Check for active support conversation
        const activeResponse = await supportApi.getActiveSupport();
        
        if (activeResponse.success && activeResponse.data?.conversation) {
          setConversation(activeResponse.data.conversation);
          await loadMessages(activeResponse.data.conversation_id!);
        } else {
          // Show ticket creation modal
          setShowTicketModal(true);
          animateModalIn();
        }
      }
    } catch (error) {
      console.error('Error initializing support:', error);
      setShowTicketModal(true);
      animateModalIn();
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (convId: string) => {
    try {
      const response = await supportApi.getConversation(convId);
      
      if (response.success && response.data) {
        setConversation(response.data.conversation);
        setMessages(response.data.messages || []);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Connection Issue',
          text2: response.message || 'Failed to load conversation',
        });
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const response = await supportApi.getConversation(convId);
      
      if (response.success && response.data) {
        setMessages(response.data.messages || []);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const animateModalIn = () => {
    Animated.spring(slideAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const animateModalOut = (callback?: () => void) => {
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      callback?.();
    });
  };

  const handleCategorySelection = (category: 'basic' | 'package') => {
    setSelectedCategory(category);
    
    if (category === 'basic') {
      setTicketStep('creating');
      createTicket('inquiry');
    } else {
      setTicketStep('package-input');
    }
  };

  const validateAndCreatePackageTicket = async () => {
    if (!packageCode.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Package Code Required',
        text2: 'Please enter your package tracking code',
      });
      return;
    }

    setValidatingPackage(true);
    
    try {
      // Validate package exists
      const validateResponse = await supportApi.validatePackage(packageCode.trim());
      
      if (validateResponse.success && validateResponse.data?.valid) {
        setTicketStep('creating');
        createTicket('follow_up', validateResponse.data.package?.id);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Package Not Found',
          text2: 'Please check your tracking code and try again',
        });
      }
    } catch (error) {
      console.error('Error validating package:', error);
      
      // Allow creation anyway if validation fails (might be network issue)
      Toast.show({
        type: 'info',
        text1: 'Creating Ticket',
        text2: 'Unable to validate package, but creating ticket anyway',
      });
      
      setTicketStep('creating');
      createTicket('follow_up', packageCode.trim());
    } finally {
      setValidatingPackage(false);
    }
  };

  const createTicket = async (category: string, packageId?: string) => {
    try {
      const response = await supportApi.createSupportTicket(category, packageId);
      
      if (response.success && response.data) {
        setConversation(response.data.conversation);
        await loadMessages(response.data.conversation_id);
        
        setTicketStep('complete');
        
        // Close modal after short delay
        setTimeout(() => {
          animateModalOut(() => {
            setShowTicketModal(false);
            setTicketStep('category');
            setSelectedCategory('');
            setPackageCode('');
          });
        }, 1500);
        
        Toast.show({
          type: 'success',
          text1: 'Support Ticket Created',
          text2: `Ticket ${response.data.ticket_id} is ready!`,
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Ticket Saved',
          text2: response.message || 'Ticket will be created when connection is restored',
        });
        
        // Close modal even if cached
        setTimeout(() => {
          animateModalOut(() => {
            setShowTicketModal(false);
            setTicketStep('category');
            setSelectedCategory('');
            setPackageCode('');
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Connection Issue',
        text2: 'Ticket saved and will be created when online',
      });
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !conversation || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic UI update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageText,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      from_support: false,
      message_type: 'text',
      user: {
        id: 'current-user',
        name: 'You',
        role: 'customer'
      }
    };

    setMessages(prev => [...prev, tempMessage]);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const response = await supportApi.sendMessage(conversation.id, messageText);
      
      if (response.success && response.data) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id ? response.data!.message : msg
          )
        );
      } else {
        // Keep temp message but show it as cached
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id 
              ? { ...msg, user: { ...msg.user, name: 'You (sending...)' } }
              : msg
          )
        );
        
        Toast.show({
          type: 'info',
          text1: 'Message Cached',
          text2: 'Will send when connection is restored',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageWrapper}>
      <View style={[
        styles.messageContainer,
        item.from_support ? styles.supportMessage : styles.userMessage
      ]}>
        {item.message_type === 'voice' ? (
          <View style={styles.voiceMessage}>
            <TouchableOpacity style={styles.playButton}>
              <Feather name="play" size={12} color="#fff" />
            </TouchableOpacity>
            <View style={styles.voiceWaveform}>
              {[...Array(25)].map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.waveformBar,
                    { 
                      height: Math.random() * 16 + 4,
                      backgroundColor: item.from_support ? '#B8B8B8' : '#E1BEE7'
                    }
                  ]} 
                />
              ))}
            </View>
            <Text style={styles.voiceDuration}>0:15</Text>
          </View>
        ) : (
          <Text style={[
            styles.messageText,
            item.is_system && styles.systemMessageText
          ]}>
            {item.content}
          </Text>
        )}
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {!item.from_support && !item.is_system && (
            <MaterialIcons name="done-all" size={16} color="#4FC3F7" />
          )}
        </View>
      </View>
    </View>
  );

  const renderTicketModal = () => (
    <Modal
      visible={showTicketModal}
      transparent
      animationType="none"
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{
                translateY: slideAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0],
                }),
              }],
            },
          ]}
        >
          {/* Modal Content */}
          {ticketStep === 'category' && (
            <>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>How can we help you?</Text>
                <Text style={styles.modalSubtitle}>
                  Please select the type of assistance you need
                </Text>
              </View>

              <View style={styles.modalContent}>
                <TouchableOpacity
                  style={styles.categoryButton}
                  onPress={() => handleCategorySelection('basic')}
                >
                  <LinearGradient
                    colors={['#7B3F98', '#6B46C1']}
                    style={styles.categoryGradient}
                  >
                    <Feather name="help-circle" size={24} color="#fff" />
                    <View style={styles.categoryTextContainer}>
                      <Text style={styles.categoryTitle}>Basic Inquiry</Text>
                      <Text style={styles.categorySubtitle}>
                        General questions about GLT services
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryButton}
                  onPress={() => handleCategorySelection('package')}
                >
                  <LinearGradient
                    colors={['#7B3F98', '#6B46C1']}
                    style={styles.categoryGradient}
                  >
                    <Feather name="package" size={24} color="#fff" />
                    <View style={styles.categoryTextContainer}>
                      <Text style={styles.categoryTitle}>About My Package</Text>
                      <Text style={styles.categorySubtitle}>
                        Track or inquire about your shipment
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}

          {ticketStep === 'package-input' && (
            <>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setTicketStep('category')}
                >
                  <Feather name="arrow-left" size={20} color="#7B3F98" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Package Information</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your package tracking code
                </Text>
              </View>

              <View style={styles.modalContent}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.packageInput}
                    placeholder="Enter package tracking code"
                    placeholderTextColor="#8E8E93"
                    value={packageCode}
                    onChangeText={setPackageCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    (!packageCode.trim() || validatingPackage) && styles.continueButtonDisabled
                  ]}
                  onPress={validateAndCreatePackageTicket}
                  disabled={!packageCode.trim() || validatingPackage}
                >
                  {validatingPackage ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.continueButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {ticketStep === 'creating' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7B3F98" />
              <Text style={styles.loadingText}>Creating your support ticket...</Text>
            </View>
          )}

          {ticketStep === 'complete' && (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Feather name="check" size={32} color="#fff" />
              </View>
              <Text style={styles.successTitle}>Support Ticket Created!</Text>
              <Text style={styles.successSubtitle}>
                You'll be connected with an agent shortly
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );

  if (loading && !showTicketModal) {
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
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Loading...</Text>
          </View>
        </LinearGradient>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Setting up your support chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#5A2D82" />
      
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.headerBackButton}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Image
            source={require('../../assets/images/support.png')}
            style={styles.avatar}
          />
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {conversation?.assigned_agent?.name || 'Customer Support'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {conversation?.status === 'assigned' 
                ? `Ticket ${conversation.ticket_id} • Assigned`
                : conversation?.status === 'pending'
                ? `Ticket ${conversation.ticket_id} • Connecting...`
                : conversation?.ticket_id
                ? `Ticket ${conversation.ticket_id}`
                : 'Getting ready...'
              }
            </Text>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Feather name="info" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Feather name="more-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Messages Container */}
      <KeyboardAvoidingView 
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.messagesContainer}>
          {messages.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          ) : (
            <View style={styles.emptyMessagesContainer}>
              <View style={styles.emptyIcon}>
                <Feather name="message-circle" size={48} color="#7B3F98" />
              </View>
              <Text style={styles.emptyTitle}>Support Chat Ready</Text>
              <Text style={styles.emptySubtitle}>
                {conversation ? 'Start the conversation below' : 'Create a ticket to get started'}
              </Text>
            </View>
          )}
        </View>

        {/* Input Area */}
        {conversation && (
          <View style={[
            styles.inputContainer,
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
                  placeholder="Message"
                  placeholderTextColor="#8E8E93"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={1000}
                  editable={!sending}
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
                  styles.sendButton,
                  inputText.trim() ? styles.sendButtonActive : styles.voiceButton,
                  sending && styles.sendButtonDisabled
                ]}
                onPress={inputText.trim() ? sendMessage : undefined}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : inputText.trim() ? (
                  <Feather name="send" size={18} color="#fff" />
                ) : (
                  <Feather name="mic" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Ticket Creation Modal */}
      {renderTicketModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerBackButton: {
    marginRight: 12,
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 20,
    flexShrink: 0,
  },
  headerSubtitle: {
    color: '#E1BEE7',
    fontSize: 12,
    marginTop: 1,
    lineHeight: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  headerButton: {
    marginLeft: 16,
    padding: 6,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B141B',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageWrapper: {
    marginVertical: 3,
  },
  messageContainer: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  supportMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2C34',
    borderBottomLeftRadius: 4,
    marginLeft: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6B46C1',
    borderBottomRightRadius: 4,
    marginRight: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
    paddingTop: 4,
  },
  systemMessageText: {
    fontStyle: 'italic',
    opacity: 0.8,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 160,
    paddingVertical: 4,
  },
  playButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  voiceWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 20,
    marginHorizontal: 4,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 0.5,
  },
  voiceDuration: {
    color: '#B8B8B8',
    fontSize: 12,
    marginLeft: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  timestamp: {
    color: '#8E8E93',
    fontSize: 11,
    marginRight: 4,
  },
  inputContainer: {
    backgroundColor: 'rgba(11, 20, 27, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
  sendButtonDisabled: {
    opacity: 0.6,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 24,
    top: 0,
    zIndex: 1,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalContent: {
    paddingHorizontal: 24,
  },
  categoryButton: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  categoryTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  categorySubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  packageInput: {
    backgroundColor: '#2A3942',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 24,
  },
  continueButton: {
    backgroundColor: '#7B3F98',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  successContainer: {
    padding: 48,
    alignItems: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  successSubtitle: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
  },
});
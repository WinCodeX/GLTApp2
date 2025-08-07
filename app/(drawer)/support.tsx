import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import {
  Feather,
  MaterialIcons,
  Ionicons,
} from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supportApi } from '../../services/supportApi';
import colors from '../../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isSupport: boolean;
  type?: 'text' | 'voice';
  duration?: string;
  emojis?: string;
  packageCode?: string;
  isTagged?: boolean;
}

export default function SupportScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! Welcome to our customer support. How can I help you today?',
      timestamp: '09:05',
      isSupport: true,
      type: 'text',
    },
    {
      id: '2',
      text: 'Hi, I have an issue with my recent order. The tracking shows it was delivered but I never received it.',
      timestamp: '09:07',
      isSupport: false,
      type: 'text',
    },
    {
      id: '3',
      text: 'I\'m sorry to hear about this issue. Let me help you track down your package. Could you please provide me with your order number?',
      timestamp: '09:08',
      isSupport: true,
      type: 'text',
    },
    {
      id: '4',
      text: '',
      timestamp: '09:09',
      isSupport: false,
      type: 'voice',
      duration: '0:15',
    },
    {
      id: '5',
      text: 'Thank you for the voice message. I can see your order #12345. Let me check the delivery details for you.',
      timestamp: '09:10',
      isSupport: true,
      type: 'text',
    },
    {
      id: '6',
      text: 'I can see that the package was marked as delivered to your front door yesterday at 2:30 PM. Did you check with neighbors or any safe delivery locations?',
      timestamp: '09:11',
      isSupport: true,
      type: 'text',
    },
    {
      id: '7',
      text: 'Yes, I checked everywhere. No one has seen it. This is really frustrating 😤',
      timestamp: '09:12',
      isSupport: false,
      type: 'text',
    },
    {
      id: '8',
      text: '',
      timestamp: '09:13',
      isSupport: true,
      type: 'voice',
      duration: '0:32',
    },
    {
      id: '9',
      text: 'I completely understand your frustration. I\'m going to initiate a delivery investigation and process a replacement order for you right away.',
      timestamp: '09:14',
      isSupport: true,
      type: 'text',
    },
    {
      id: '10',
      text: 'Thank you so much! That would be great. How long will the replacement take?',
      timestamp: '09:15',
      isSupport: false,
      type: 'text',
    },
    {
      id: '11',
      text: 'Your replacement order will be shipped within 24 hours with priority delivery. You should receive it by Friday. I\'ll also email you the new tracking number.',
      timestamp: '09:16',
      isSupport: true,
      type: 'text',
    },
    {
      id: '12',
      text: 'Perfect! Thank you for the excellent customer service 👍',
      timestamp: '09:17',
      isSupport: false,
      type: 'text',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showTicketModal, setShowTicketModal] = useState(true);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [packageCode, setPackageCode] = useState('');
  const [packageInquiry, setPackageInquiry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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

  const closeAllModals = () => {
    setShowTicketModal(false);
    setShowInquiryModal(false);
    setShowPackageModal(false);
    setInquiryText('');
    setPackageCode('');
    setPackageInquiry('');
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
    
    // Add message to local state immediately for seamless experience
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inquiryText.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      isSupport: false,
      type: 'text',
    };

    setMessages(prev => [...prev, newMessage]);
    closeAllModals();
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Simulate support response immediately
    setTimeout(() => {
      const supportResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Thank you for contacting us. I\'ve received your inquiry and will help you with your question.',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: true,
        type: 'text',
      };
      setMessages(prev => [...prev, supportResponse]);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 1500);

    setIsLoading(false);

    // Handle API calls in background without blocking UI
    try {
      const result = await supportApi.createSupportTicket('basic_inquiry');
      
      if (result.success && result.data) {
        setConversationId(result.data.conversation_id);
        
        // Send the inquiry message in background
        await supportApi.sendMessage(
          result.data.conversation_id,
          inquiryText.trim(),
          'text'
        );
      }
    } catch (error) {
      console.log('Ticket cached for later retry');
      // Error is handled silently by supportApi caching
    }
  };

  const createPackageInquiryTicket = async () => {
    if (!packageCode.trim() || !packageInquiry.trim()) return;

    setIsLoading(true);
    
    // Add tagged message to local state immediately for seamless experience
    const newMessage: Message = {
      id: Date.now().toString(),
      text: packageInquiry.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      isSupport: false,
      type: 'text',
      packageCode: packageCode.trim(),
      isTagged: true,
    };

    setMessages(prev => [...prev, newMessage]);
    closeAllModals();
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Simulate support response immediately
    setTimeout(() => {
      const supportResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `Thank you for your inquiry about package ${packageCode.trim()}. Let me check the status for you.`,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: true,
        type: 'text',
      };
      setMessages(prev => [...prev, supportResponse]);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 1500);

    setIsLoading(false);

    // Handle API calls in background without blocking UI
    try {
      const result = await supportApi.createSupportTicket('package_inquiry', packageCode.trim());
      
      if (result.success && result.data) {
        setConversationId(result.data.conversation_id);
        
        // Send the package inquiry message in background
        await supportApi.sendMessage(
          result.data.conversation_id,
          packageInquiry.trim(),
          'text',
          { package_code: packageCode.trim() }
        );
      }
    } catch (error) {
      console.log('Package inquiry cached for later retry');
      // Error is handled silently by supportApi caching
    }
  };

  const sendMessage = async () => {
    if (inputText.trim() && conversationId) {
      const result = await supportApi.sendMessage(conversationId, inputText.trim(), 'text');
      
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: false,
        type: 'text',
      };

      setMessages(prev => [...prev, newMessage]);
      setInputText('');
      
      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Simulate support response after 2 seconds
      setTimeout(() => {
        const supportResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Thank you for providing that information. Let me check the status for you...',
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          }),
          isSupport: true,
          type: 'text',
        };
        setMessages(prev => [...prev, supportResponse]);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, 2000);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageWrapper}>
      <View style={[
        styles.messageContainer,
        item.isSupport ? styles.supportMessage : styles.userMessage
      ]}>
        {/* Tagged message header for package inquiries */}
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
        
        {item.type === 'voice' ? (
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
                      backgroundColor: item.isSupport ? '#B8B8B8' : '#E1BEE7'
                    }
                  ]} 
                />
              ))}
            </View>
            <Text style={styles.voiceDuration}>{item.duration}</Text>
          </View>
        ) : (
          <Text style={styles.messageText}>{item.text}</Text>
        )}
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {!item.isSupport && (
            <MaterialIcons name="done-all" size={16} color="#4FC3F7" />
          )}
        </View>
      </View>
    </View>
  );

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
            {/* Header Handle */}
            <View style={styles.modalHandle} />

            {/* Ticket Selection Modal */}
            {showTicketModal && (
              <>
                <Text style={styles.modalTitle}>How can we help you?</Text>
                <Text style={styles.modalSubtitle}>Please select the type of assistance you need</Text>

                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleBasicInquiry}
                >
                  <LinearGradient
                    colors={['#B794F6', '#9F7AEA', '#805AD5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
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
                    colors={['#B794F6', '#9F7AEA', '#805AD5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
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

            {/* Basic Inquiry Modal */}
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

            {/* Package Inquiry Modal */}
            {showPackageModal && (
              <>
                <Text style={styles.modalTitle}>Package Inquiry</Text>
                <Text style={styles.modalSubtitle}>Please provide your package code and inquiry</Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Package Code</Text>
                  <TextInput
                    style={styles.modalTextInputSmall}
                    placeholder="Enter package code..."
                    placeholderTextColor="#8E8E93"
                    value={packageCode}
                    onChangeText={setPackageCode}
                    autoCapitalize="characters"
                    maxLength={20}
                  />
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
                      (!packageCode.trim() || !packageInquiry.trim()) && styles.sendButtonDisabled
                    ]}
                    onPress={createPackageInquiryTicket}
                    disabled={!packageCode.trim() || !packageInquiry.trim() || isLoading}
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
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Image
            source={require('../../assets/images/avatar_placeholder.png')}
            style={styles.avatar}
          />
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Customer Support</Text>
            <Text style={styles.headerSubtitle}>Getting ready...</Text>
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

      {/* Messages Container with Keyboard Avoidance */}
      <KeyboardAvoidingView 
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
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
          />
        </View>

        {/* Input Area - Fixed at bottom */}
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
                placeholder="Message"
                placeholderTextColor="#8E8E93"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                onFocus={() => {
                  // Auto-scroll to bottom when input is focused
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
  backButton: {
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
    minWidth: 120,
  },
  headerButton: {
    marginLeft: 16,
    padding: 6,
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
  taggedHeader: {
    backgroundColor: 'rgba(225, 190, 231, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E1BEE7',
  },
  taggedQuote: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#E1BEE7',
    borderRadius: 2,
  },
  taggedContent: {
    marginLeft: 8,
  },
  taggedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  taggedText: {
    color: '#E1BEE7',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  taggedMessage: {
    color: '#B8B8B8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
    paddingTop: 4,
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
  inputContainerFixed: {
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
  sendButtonMain: {
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
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContainer: {
    height: SCREEN_HEIGHT * 0.6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#8E8E93',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  optionButton: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#7B3F98',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  optionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  modalTextInput: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(123, 63, 152, 0.3)',
  },
  modalTextInputSmall: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(123, 63, 152, 0.3)',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#7B3F98',
    borderRadius: 12,
    paddingVertical: 16,
    marginLeft: 8,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(123, 63, 152, 0.4)',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
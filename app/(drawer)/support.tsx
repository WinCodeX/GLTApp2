// app/(drawer)/support.tsx - Enhanced Support Screen with integrated ticket creation and package tagging
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
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Feather,
  MaterialIcons,
  Ionicons,
} from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { supportApi } from '../../services/supportApi';
import colors from '../../theme/colors';
import api from '../../lib/api';

// Import NavigationHelper
import { NavigationHelper } from '../../lib/helpers/navigation';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isSupport: boolean;
  type?: 'text' | 'voice' | 'system';
  duration?: string;
  packageCode?: string;
  isTagged?: boolean;
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
  
  // Check if we should auto-select package inquiry (from report button)
  const autoSelectPackage = params.autoSelectPackage === 'true';
  const preFilledPackageCode = params.packageCode as string;
  const preFilledPackageId = params.packageId as string;

  const handleGoBack = useCallback(() => {
    console.log('🔙 Support screen: navigating back');
    
    NavigationHelper.goBack({
      fallbackRoute: '/(tabs)',
      replaceIfNoHistory: true
    });
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! Welcome to our customer support. How can I help you today?',
      timestamp: '09:05',
      isSupport: true,
      type: 'text',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<'none' | 'pending' | 'active' | 'closed'>('none');
  
  // NEW: Inquiry type management
  const [inquiryType, setInquiryType] = useState<InquiryType>(autoSelectPackage ? 'package' : 'basic');
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPackageSearch, setShowPackageSearch] = useState(false);
  const [userPackages, setUserPackages] = useState<Package[]>([]);
  const [packageSearchQuery, setPackageSearchQuery] = useState('');
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Load user packages for search
  const loadUserPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      
      console.log('📦 Loading user packages for search...');
      
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
        
        console.log('✅ Loaded packages for search:', packages.length);

        // If we have a pre-filled package code, try to find and select it
        if (preFilledPackageCode) {
          const preSelectedPackage = packages.find((pkg: Package) => 
            pkg.code === preFilledPackageCode || pkg.id === preFilledPackageId
          );
          
          if (preSelectedPackage) {
            setSelectedPackage(preSelectedPackage);
            setInquiryType('package');
            console.log('✅ Pre-selected package:', preSelectedPackage.code);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to load user packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  }, [preFilledPackageCode, preFilledPackageId]);

  // Filter packages based on search query
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

  // Handle package search input change
  const handlePackageSearchChange = useCallback((text: string) => {
    setPackageSearchQuery(text);
    filterPackages(text);
  }, [filterPackages]);

  // Handle package selection
  const handlePackageSelect = useCallback((pkg: Package) => {
    setSelectedPackage(pkg);
    setShowPackageSearch(false);
    setPackageSearchQuery('');
  }, []);

  // Handle inquiry type change
  const handleInquiryTypeChange = useCallback((type: InquiryType) => {
    setInquiryType(type);
    if (type === 'basic') {
      setSelectedPackage(null);
      setShowPackageSearch(false);
    } else {
      // Load packages when switching to package inquiry
      if (userPackages.length === 0) {
        loadUserPackages();
      }
    }
  }, [userPackages.length, loadUserPackages]);

  // Handle showing package search
  const handleShowPackageSearch = useCallback(() => {
    setShowPackageSearch(true);
    if (userPackages.length === 0) {
      loadUserPackages();
    }
  }, [userPackages.length, loadUserPackages]);

  // Create or get conversation
  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;

    try {
      console.log('🎫 Creating support ticket...');
      
      const result = await supportApi.createSupportTicket(
        inquiryType === 'package' ? 'package_inquiry' : 'basic_inquiry',
        selectedPackage?.code
      );
      
      if (result.success && result.data) {
        setConversationId(result.data.conversation_id);
        setTicketStatus('pending');
        console.log('✅ Support ticket created:', result.data.conversation_id);
        return result.data.conversation_id;
      }
      
      throw new Error('Failed to create support ticket');
    } catch (error) {
      console.error('❌ Failed to create support ticket:', error);
      throw error;
    }
  }, [conversationId, inquiryType, selectedPackage?.code]);

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

  // Load packages on component mount if auto-select is enabled
  useEffect(() => {
    if (autoSelectPackage && userPackages.length === 0) {
      loadUserPackages();
    }
  }, [autoSelectPackage, userPackages.length, loadUserPackages]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    
    try {
      // Ensure conversation exists
      const convId = await ensureConversation();
      
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
        packageCode: selectedPackage?.code,
        isTagged: inquiryType === 'package' && !!selectedPackage,
      };

      setMessages(prev => [...prev, newMessage]);
      setInputText('');
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Send message to backend
      const metadata = selectedPackage ? { package_code: selectedPackage.code } : undefined;
      const result = await supportApi.sendMessage(
        convId,
        inputText.trim(),
        'text',
        metadata
      );
      
      if (result.success) {
        // Update ticket status
        setTicketStatus('pending');
        
        // Add automated response
        setTimeout(() => {
          const responseText = selectedPackage 
            ? `Thank you for your inquiry about package ${selectedPackage.code}. A support agent will review your ticket and respond shortly.`
            : 'Thank you for contacting us. Your inquiry has been received and a support agent will respond shortly.';
            
          const supportResponse: Message = {
            id: (Date.now() + 1).toString(),
            text: responseText,
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            }),
            isSupport: true,
            type: 'system',
          };
          setMessages(prev => [...prev, supportResponse]);
          
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }, 1500);
      }
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      
      // Remove the message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== Date.now().toString()));
      setInputText(inputText.trim()); // Restore input text
      
      // Show error message
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: 'Sorry, there was an error sending your message. Please try again.',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSupport: true,
        type: 'system',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, ensureConversation, selectedPackage, inquiryType]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageWrapper}>
      <View style={[
        styles.messageContainer,
        item.isSupport ? styles.supportMessage : styles.userMessage
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
        
        <Text style={styles.messageText}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {!item.isSupport && (
            <MaterialIcons name="done-all" size={16} color="#4FC3F7" />
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
      case 'active': return 'Online';
      case 'closed': return 'Last seen recently';
      default: return 'Online';
    }
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
            <Text style={styles.headerSubtitle}>{getTicketStatusText()}</Text>
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
          />
        </View>

        <View style={styles.inquirySection}>
          {/* Inquiry Type Tabs */}
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

          {/* Package Selection Section */}
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

              {/* Package Search Dropdown */}
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
                    <ScrollView 
                      style={styles.packageSearchList}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {filteredPackages.length > 0 ? (
                        filteredPackages.map((pkg) => (
                          <View key={pkg.id}>
                            {renderPackageSearchItem({ item: pkg })}
                          </View>
                        ))
                      ) : (
                        <View style={styles.packageSearchEmpty}>
                          <Text style={styles.packageSearchEmptyText}>
                            {packageSearchQuery ? 'No packages found matching your search' : 'No packages available'}
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

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
                onChangeText={setInputText}
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
                inputText.trim() || isLoading ? styles.sendButtonActive : styles.voiceButton
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
  
  // NEW: Inquiry section styles
  inquirySection: {
    backgroundColor: 'rgba(11, 20, 27, 0.95)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inquiryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inquiryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  inquiryTabActive: {
    backgroundColor: '#6B46C1',
  },
  inquiryTabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  inquiryTabTextActive: {
    color: '#fff',
  },
  
  // Package section styles
  packageSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  selectedPackageContainer: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  selectedPackageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  selectedPackageCode: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  removePackageButton: {
    padding: 4,
  },
  selectedPackageDetails: {
    color: '#E5E7EB',
    fontSize: 12,
    lineHeight: 16,
  },
  selectPackageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderStyle: 'dashed',
  },
  selectPackageText: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  
  // Package search dropdown styles
  packageSearchDropdown: {
    backgroundColor: '#1F2C34',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(123, 63, 152, 0.3)',
    maxHeight: 300,
  },
  packageSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 63, 152, 0.2)',
  },
  packageSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  closeSearchButton: {
    padding: 4,
  },
  packageSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  packageSearchLoadingText: {
    color: '#8E8E93',
    fontSize: 14,
    marginLeft: 8,
  },
  packageSearchList: {
    maxHeight: 200,
  },
  packageSearchItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 63, 152, 0.2)',
  },
  packageSearchContent: {
    padding: 12,
  },
  packageSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  packageSearchCode: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  packageSearchStateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packageSearchStateText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  packageSearchReceiver: {
    color: '#E5E7EB',
    fontSize: 12,
    marginBottom: 2,
  },
  packageSearchRoute: {
    color: '#8E8E93',
    fontSize: 11,
    marginBottom: 4,
  },
  packageSearchCost: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: '600',
  },
  packageSearchEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  packageSearchEmptyText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  
  inputContainerFixed: {
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
});
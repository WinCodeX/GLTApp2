import React, { useState, useRef } from 'react';
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
} from 'react-native';
import {
  Feather,
  MaterialIcons,
  Ionicons,
} from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isSupport: boolean;
  type?: 'text' | 'voice';
  duration?: string;
  emojis?: string;
}

export default function SupportScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '',
      timestamp: '23:30',
      isSupport: true,
      type: 'voice',
      duration: '5:08',
    },
    {
      id: '2',
      text: 'Aty vitu tamu tamu',
      timestamp: '23:30',
      isSupport: true,
      type: 'text',
      emojis: '🤣💀',
    },
    {
      id: '3',
      text: '',
      timestamp: '23:30',
      isSupport: true,
      type: 'voice',
      duration: '5:08',
    },
    {
      id: '4',
      text: 'wueh',
      timestamp: '23:30',
      isSupport: true,
      type: 'text',
      emojis: '🤣🤣🤣🤣',
    },
    {
      id: '5',
      text: 'Jigi jigi',
      timestamp: '23:31',
      isSupport: true,
      type: 'text',
      emojis: '🤣',
    },
    {
      id: '6',
      text: 'Una pitia kwa club?',
      timestamp: '23:31',
      isSupport: true,
      type: 'text',
    },
    {
      id: '7',
      text: '',
      timestamp: '23:32',
      isSupport: true,
      type: 'voice',
      duration: '5:08',
    },
    {
      id: '8',
      text: 'Brains?',
      timestamp: '23:32',
      isSupport: true,
      type: 'text',
      emojis: '🤣',
    },
    {
      id: '9',
      text: '',
      timestamp: '23:47',
      isSupport: true,
      type: 'voice',
      duration: '5:08',
    },
    {
      id: '10',
      text: 'aty anatumia nini mingi',
      timestamp: '23:47',
      isSupport: true,
      type: 'text',
      emojis: '🤣🤣🤣',
    },
    {
      id: '11',
      text: '',
      timestamp: '23:48',
      isSupport: true,
      type: 'voice',
      duration: '5:08',
    },
    {
      id: '12',
      text: 'Missing you so much',
      timestamp: '23:48',
      isSupport: true,
      type: 'text',
      emojis: '💖',
    },
    {
      id: '13',
      text: 'I love you my darling wife. Goodnight and sweet dreams',
      timestamp: '23:49',
      isSupport: false,
      type: 'text',
      emojis: '😍🥰',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (inputText.trim()) {
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
    <View style={[
      styles.messageContainer,
      item.isSupport ? styles.supportMessage : styles.userMessage
    ]}>
      {item.type === 'voice' ? (
        <View style={styles.voiceMessage}>
          <View style={styles.voiceIndicator}>
            <Feather name="mic" size={14} color="#B8B8B8" />
            <Text style={styles.voiceLabel}>Voice message ({item.duration})</Text>
          </View>
          <View style={styles.voiceWaveform}>
            {[...Array(20)].map((_, i) => (
              <View 
                key={i} 
                style={[
                  styles.waveformBar,
                  { height: Math.random() * 20 + 8 }
                ]} 
              />
            ))}
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.messageText}>
            {item.text}
            {item.emojis && (
              <Text style={styles.emojis}> {item.emojis}</Text>
            )}
          </Text>
        </View>
      )}
      <View style={styles.messageFooter}>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
        {!item.isSupport && (
          <MaterialIcons name="done-all" size={16} color="#4FC3F7" />
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
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
            <Text style={styles.headerSubtitle}>last seen yesterday at 23:36</Text>
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

      {/* Call Notification */}
      <View style={styles.callNotification}>
        <View style={styles.callIcon}>
          <Feather name="phone" size={16} color="#fff" />
        </View>
        <Text style={styles.callText}>Voice call</Text>
        <Text style={styles.callDuration}>1 min</Text>
        <Text style={styles.callTime}>23:32</Text>
      </View>

      {/* Messages */}
      <View style={styles.messagesContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Input Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputButton}>
            <Feather name="smile" size={24} color="#8E8E93" />
          </TouchableOpacity>
          
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Message"
              placeholderTextColor="#8E8E93"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity style={styles.attachButton}>
              <Feather name="paperclip" size={20} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraButton}>
              <Feather name="camera" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.voiceButton
            ]}
            onPress={inputText.trim() ? sendMessage : undefined}
          >
            {inputText.trim() ? (
              <Feather name="send" size={20} color="#fff" />
            ) : (
              <Feather name="mic" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B141B',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
  },
  header: {
    paddingBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    marginRight: 16,
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
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#E1BEE7',
    fontSize: 13,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 20,
    padding: 4,
  },
  callNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  callIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  callText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  callDuration: {
    color: '#8E8E93',
    fontSize: 12,
    marginRight: 8,
  },
  callTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  messagesList: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  messageContainer: {
    maxWidth: '85%',
    marginVertical: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  supportMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#6B46C1',
    borderBottomLeftRadius: 4,
    marginRight: '15%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#5B21B6',
    borderBottomRightRadius: 4,
    marginLeft: '15%',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
  },
  emojis: {
    fontSize: 18,
  },
  voiceMessage: {
    minWidth: 200,
  },
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  voiceLabel: {
    color: '#B8B8B8',
    fontSize: 14,
    marginLeft: 6,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    marginBottom: 4,
  },
  waveformBar: {
    width: 2,
    backgroundColor: '#E1BEE7',
    borderRadius: 1,
    marginHorizontal: 1,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    color: '#E1BEE7',
    fontSize: 12,
    marginRight: 4,
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#2A3942',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 4,
    paddingHorizontal: 4,
    textAlignVertical: 'top',
  },
  attachButton: {
    padding: 4,
    marginLeft: 8,
  },
  cameraButton: {
    padding: 4,
    marginLeft: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#7B3F98',
  },
  voiceButton: {
    backgroundColor: '#7B3F98',
  },
});
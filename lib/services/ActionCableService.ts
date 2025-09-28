// lib/services/ActionCableService.ts - React Native compatible WebSocket service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentApiBaseUrl } from '../api';
import { accountManager } from '../AccountManager';

interface ActionCableMessage {
  type: string;
  // Count updates
  notification_count?: number;
  cart_count?: number;
  unread_messages_count?: number;
  // Entity updates
  notification?: any;
  message?: any;
  conversation?: any;
  package?: any;
  business?: any;
  user?: any;
  // State information
  counts?: {
    notifications: number;
    cart: number;
    unread_messages: number;
  };
  user_data?: any;
  recent_conversations?: any[];
  businesses?: any[];
  // Metadata
  timestamp: string;
  user_id?: string;
  conversation_id?: string;
  business_id?: string;
  [key: string]: any;
}

interface ActionCableCallbacks {
  [key: string]: ((data: ActionCableMessage) => void)[];
}

interface ConnectionConfig {
  token: string;
  userId: string;
  baseUrl?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
}

interface TypingIndicatorConfig {
  conversationId: string;
  timeout?: number;
}

interface ActionCableCommand {
  command: string;
  identifier: string;
  data?: any;
}

class ActionCableService {
  private static instance: ActionCableService;
  private websocket: WebSocket | null = null;
  private callbacks: ActionCableCallbacks = {};
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private connectionConfig: ConnectionConfig | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private subscribedConversations: Set<string> = new Set();
  private subscribedBusinesses: Set<string> = new Set();
  private subscriptionIdentifier: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  static getInstance(): ActionCableService {
    if (!ActionCableService.instance) {
      ActionCableService.instance = new ActionCableService();
    }
    return ActionCableService.instance;
  }

  // Enhanced connection with native WebSocket
  async connect(config: ConnectionConfig): Promise<boolean> {
    try {
      console.log('🔌 Connecting to ActionCable...', { 
        userId: config.userId, 
        baseUrl: config.baseUrl || 'auto-detect'
      });
      
      this.connectionConfig = {
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectInterval: 3000,
        ...config
      };

      // Get the current API base URL and convert to WebSocket URL
      const apiBaseUrl = config.baseUrl || getCurrentApiBaseUrl();
      const wsUrl = this.convertToWebSocketUrl(apiBaseUrl);
      
      console.log('🔗 WebSocket URL:', wsUrl);

      // Create WebSocket connection with authentication
      const connectionUrl = `${wsUrl}/cable?token=${config.token}&user_id=${config.userId}`;
      this.websocket = new WebSocket(connectionUrl);

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        const cleanup = () => {
          clearTimeout(timeout);
        };

        this.websocket!.onopen = () => {
          cleanup();
          console.log('✅ Connected to ActionCable');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Subscribe to user notifications channel
          this.subscribeToChannel();
          
          // Request initial state
          this.requestInitialState();
          
          // Start heartbeat
          this.startHeartbeat();
          this.startPing();
          
          // Trigger connection callbacks
          this.triggerCallbacks('connection_established', { connected: true });
          
          resolve(true);
        };

        this.websocket!.onerror = (error) => {
          cleanup();
          console.error('❌ WebSocket connection error:', error);
          this.triggerCallbacks('connection_error', { error: 'WebSocket connection failed' });
          reject(error);
        };
      });

    } catch (error) {
      console.error('❌ Failed to connect to ActionCable:', error);
      this.triggerCallbacks('connection_error', { error: error.message });
      
      if (this.connectionConfig?.autoReconnect) {
        this.handleDisconnection();
      }
      
      return false;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'ping') {
          // Respond to ping with pong
          this.sendMessage({ type: 'pong' });
          return;
        }

        if (data.type === 'welcome') {
          console.log('📡 ActionCable welcome received');
          return;
        }

        if (data.type === 'confirm_subscription') {
          console.log('📡 ActionCable subscription confirmed');
          return;
        }

        if (data.message) {
          console.log('📡 ActionCable message received:', data.message.type, data.message);
          this.handleMessage(data.message);
        }
      } catch (error) {
        console.error('❌ Error parsing ActionCable message:', error);
      }
    };

    this.websocket.onclose = (event) => {
      console.log('❌ WebSocket connection closed:', event.code, event.reason);
      this.isConnected = false;
      this.stopHeartbeat();
      this.stopPing();
      
      // Trigger disconnection callbacks
      this.triggerCallbacks('connection_lost', { connected: false });
      
      // Handle reconnection
      if (this.connectionConfig?.autoReconnect) {
        this.handleDisconnection();
      }
    };

    this.websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.triggerCallbacks('connection_error', { error: 'WebSocket error' });
    };
  }

  private subscribeToChannel(): void {
    if (!this.connectionConfig) return;

    this.subscriptionIdentifier = JSON.stringify({
      channel: 'UserNotificationsChannel',
      user_id: this.connectionConfig.userId
    });

    const subscribeCommand: ActionCableCommand = {
      command: 'subscribe',
      identifier: this.subscriptionIdentifier
    };

    this.sendMessage(subscribeCommand);
  }

  private sendMessage(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  // Enhanced disconnect with cleanup
  disconnect(): void {
    try {
      console.log('🔌 Disconnecting from ActionCable...');
      
      // Clear all timeouts
      this.stopHeartbeat();
      this.stopPing();
      this.clearAllTypingTimeouts();
      
      // Close WebSocket connection
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      // Clear state
      this.isConnected = false;
      this.subscribedConversations.clear();
      this.subscribedBusinesses.clear();
      this.connectionConfig = null;
      this.subscriptionIdentifier = null;
      
      console.log('✅ Disconnected from ActionCable');
    } catch (error) {
      console.error('❌ Error disconnecting from ActionCable:', error);
    }
  }

  // Subscribe to specific message types with enhanced error handling
  subscribe(type: string, callback: (data: ActionCableMessage) => void): () => void {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
    
    console.log(`📡 Subscribed to ActionCable messages of type: ${type}`);
    
    // Return unsubscribe function
    return () => this.unsubscribe(type, callback);
  }

  // Enhanced unsubscribe
  unsubscribe(type: string, callback?: (data: ActionCableMessage) => void): void {
    if (!this.callbacks[type]) return;
    
    if (callback) {
      const index = this.callbacks[type].indexOf(callback);
      if (index > -1) {
        this.callbacks[type].splice(index, 1);
      }
    } else {
      delete this.callbacks[type];
    }
    
    console.log(`📡 Unsubscribed from ActionCable messages of type: ${type}`);
  }

  // Enhanced perform with error handling and retry logic
  perform(action: string, data: any = {}): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.subscriptionIdentifier || !this.isConnected) {
        console.warn('⚠️ ActionCable not connected, cannot perform action:', action);
        resolve(false);
        return;
      }
      
      try {
        const command: ActionCableCommand = {
          command: 'message',
          identifier: this.subscriptionIdentifier,
          data: JSON.stringify({
            action: action,
            ...data
          })
        };

        this.sendMessage(command);
        console.log(`📡 ActionCable action performed: ${action}`, data);
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to perform ActionCable action:', error);
        resolve(false);
      }
    });
  }

  // ENHANCED: Request comprehensive initial state
  async requestInitialState(): Promise<boolean> {
    return this.perform('request_initial_state', {});
  }

  // ENHANCED: Request just counts (backward compatibility)
  async requestInitialCounts(): Promise<boolean> {
    return this.perform('request_counts', {});
  }

  // ENHANCED: Mark notification as read with optimistic updates
  async markNotificationRead(notificationId: number): Promise<boolean> {
    // Trigger optimistic update immediately
    this.triggerCallbacks('notification_read_optimistic', { 
      notification_id: notificationId 
    });
    
    return this.perform('mark_notification_read', { notification_id: notificationId });
  }

  // ENHANCED: Mark message as read with optimistic updates
  async markMessageRead(conversationId: string): Promise<boolean> {
    // Trigger optimistic update immediately
    this.triggerCallbacks('message_read_optimistic', { 
      conversation_id: conversationId 
    });
    
    return this.perform('mark_message_read', { conversation_id: conversationId });
  }

  // ENHANCED: Typing indicators with automatic timeout
  async startTyping(config: TypingIndicatorConfig): Promise<boolean> {
    const { conversationId, timeout = 3000 } = config;
    
    // Clear existing timeout for this conversation
    this.clearTypingTimeout(conversationId);
    
    // Send typing indicator
    const success = await this.perform('typing_indicator', {
      conversation_id: conversationId,
      typing: true
    });
    
    if (success) {
      // Set automatic stop timeout
      const timeoutId = setTimeout(() => {
        this.stopTyping(conversationId);
      }, timeout);
      
      this.typingTimeouts.set(conversationId, timeoutId);
    }
    
    return success;
  }

  async stopTyping(conversationId: string): Promise<boolean> {
    this.clearTypingTimeout(conversationId);
    
    return this.perform('typing_indicator', {
      conversation_id: conversationId,
      typing: false
    });
  }

  // ENHANCED: Conversation management
  async joinConversation(conversationId: string): Promise<boolean> {
    const success = await this.perform('join_conversation', {
      conversation_id: conversationId
    });
    
    if (success) {
      this.subscribedConversations.add(conversationId);
    }
    
    return success;
  }

  async leaveConversation(conversationId: string): Promise<boolean> {
    const success = await this.perform('leave_conversation', {
      conversation_id: conversationId
    });
    
    this.subscribedConversations.delete(conversationId);
    this.clearTypingTimeout(conversationId);
    
    return success;
  }

  // ENHANCED: Business channel management
  async subscribeToBusinessUpdates(businessId: string): Promise<boolean> {
    const success = await this.perform('subscribe_to_business', {
      business_id: businessId
    });
    
    if (success) {
      this.subscribedBusinesses.add(businessId);
    }
    
    return success;
  }

  // ENHANCED: Presence management
  async updatePresence(status: 'online' | 'away' | 'busy' | 'offline' = 'online'): Promise<boolean> {
    return this.perform('update_presence', { status });
  }

  // ENHANCED: Connection status with detailed information
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      hasSubscription: !!this.subscriptionIdentifier,
      subscribedConversations: Array.from(this.subscribedConversations),
      subscribedBusinesses: Array.from(this.subscribedBusinesses),
      config: this.connectionConfig,
      websocketState: this.websocket?.readyState
    };
  }

  // ENHANCED: Check if connected
  isConnectedToActionCable(): boolean {
    return this.isConnected && !!this.websocket && this.websocket.readyState === WebSocket.OPEN;
  }

  // ENHANCED: Get subscribed channels info
  getSubscriptionInfo() {
    return {
      conversations: Array.from(this.subscribedConversations),
      businesses: Array.from(this.subscribedBusinesses),
      isConnected: this.isConnected
    };
  }

  private convertToWebSocketUrl(apiUrl: string): string {
    try {
      // Remove /api/v1 from the end if present
      const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
      
      // Convert HTTP to WebSocket
      if (baseUrl.startsWith('https://')) {
        return baseUrl.replace('https://', 'wss://');
      } else if (baseUrl.startsWith('http://')) {
        return baseUrl.replace('http://', 'ws://');
      }
      
      // Assume HTTPS if no protocol
      if (!baseUrl.includes('://')) {
        return `wss://${baseUrl}`;
      }
      
      return baseUrl;
    } catch (error) {
      console.error('❌ Error converting to WebSocket URL:', error);
      return 'wss://glt-53x8.onrender.com';
    }
  }

  private handleMessage(data: ActionCableMessage): void {
    try {
      // Execute type-specific callbacks
      const callbacks = this.callbacks[data.type] || [];
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in ActionCable callback for ${data.type}:`, error);
        }
      });

      // Execute global callbacks
      const globalCallbacks = this.callbacks['*'] || [];
      globalCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in global ActionCable callback:`, error);
        }
      });

      // Log important message types
      this.logImportantMessages(data);
    } catch (error) {
      console.error('❌ Error handling ActionCable message:', error);
    }
  }

  private logImportantMessages(data: ActionCableMessage): void {
    switch (data.type) {
      case 'initial_state':
        console.log('📊 Initial state received:', {
          counts: data.counts,
          conversations: data.recent_conversations?.length,
          businesses: data.businesses?.length
        });
        break;
        
      case 'initial_counts':
        console.log('📊 Initial counts received:', {
          notifications: data.notification_count,
          cart: data.cart_count,
          messages: data.unread_messages_count
        });
        break;
        
      case 'new_notification':
        console.log('🔔 New notification received:', data.notification?.title);
        break;
        
      case 'new_message':
        console.log('💬 New message received in conversation:', data.conversation_id);
        break;
        
      case 'cart_count_update':
        console.log('🛒 Cart count updated:', data.cart_count);
        break;

      case 'avatar_changed':
        console.log('👤 Avatar changed for user:', data.user_id);
        break;

      case 'business_updated':
        console.log('🏢 Business updated:', data.business?.id);
        break;
    }
  }

  private triggerCallbacks(type: string, data: any): void {
    const callbacks = this.callbacks[type] || [];
    callbacks.forEach(callback => {
      try {
        callback(data as ActionCableMessage);
      } catch (error) {
        console.error(`❌ Error in callback for ${type}:`, error);
      }
    });
  }

  private async handleDisconnection(): Promise<void> {
    if (!this.connectionConfig?.autoReconnect) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      // Exponential backoff
      const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(async () => {
        await this.reconnect();
      }, Math.min(delay, 30000)); // Max 30 seconds delay
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.triggerCallbacks('max_reconnect_attempts_reached', { 
        attempts: this.reconnectAttempts 
      });
    }
  }

  private async reconnect(): Promise<void> {
    if (!this.connectionConfig) {
      console.error('❌ No connection config available for reconnection');
      return;
    }

    try {
      console.log('🔄 Attempting to reconnect to ActionCable...');
      
      // Get fresh token if available
      const currentAccount = accountManager.getCurrentAccount();
      if (currentAccount) {
        this.connectionConfig.token = currentAccount.token;
      }
      
      // Attempt reconnection
      const success = await this.connect(this.connectionConfig);
      
      if (success) {
        console.log('✅ Successfully reconnected to ActionCable');
        
        // Resubscribe to conversations and businesses
        await this.resubscribeToChannels();
      }
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      
      // Continue reconnection attempts
      if (this.connectionConfig.autoReconnect) {
        this.handleDisconnection();
      }
    }
  }

  private async resubscribeToChannels(): Promise<void> {
    try {
      console.log('🔄 Resubscribing to channels...');
      
      // Resubscribe to conversations
      const conversationPromises = Array.from(this.subscribedConversations).map(
        conversationId => this.joinConversation(conversationId)
      );
      
      // Resubscribe to businesses
      const businessPromises = Array.from(this.subscribedBusinesses).map(
        businessId => this.subscribeToBusinessUpdates(businessId)
      );
      
      await Promise.all([...conversationPromises, ...businessPromises]);
      
      console.log('✅ Successfully resubscribed to all channels');
    } catch (error) {
      console.error('❌ Failed to resubscribe to channels:', error);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.updatePresence('online').catch(error => {
          console.warn('⚠️ Heartbeat presence update failed:', error);
        });
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startPing(): void {
    this.stopPing();
    
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.websocket?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, 25000); // Every 25 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearTypingTimeout(conversationId: string): void {
    const timeoutId = this.typingTimeouts.get(conversationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.typingTimeouts.delete(conversationId);
    }
  }

  private clearAllTypingTimeouts(): void {
    this.typingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.typingTimeouts.clear();
  }
}

export default ActionCableService;

// Export types for use in other files
export type { ActionCableMessage, ConnectionConfig, TypingIndicatorConfig };
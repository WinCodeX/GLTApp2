// lib/services/ActionCableService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentApiBaseUrl } from '../api';
import { accountManager } from '../AccountManager';

interface ActionCableMessage {
  type: string;
  notification_count?: number;
  cart_count?: number;
  unread_messages_count?: number;
  notification?: any;
  message?: any;
  conversation?: any;
  package?: any;
  business?: any;
  user?: any;
  counts?: {
    notifications: number;
    cart: number;
    unread_messages: number;
  };
  user_data?: any;
  recent_conversations?: any[];
  businesses?: any[];
  conversation_id?: string;
  message_id?: string;
  ticket_id?: string;
  stats?: any;
  dashboard_stats?: any;
  agent_stats?: any;
  ticket?: any;
  timestamp: string;
  user_id?: string;
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
  private readonly MIN_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionalDisconnect = false;
  private connectionConfig: ConnectionConfig | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private subscribedConversations: Set<string> = new Set();
  private subscribedBusinesses: Set<string> = new Set();
  private subscriptionIdentifier: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private supportDashboardSubscribed = false;

  static getInstance(): ActionCableService {
    if (!ActionCableService.instance) {
      ActionCableService.instance = new ActionCableService();
    }
    return ActionCableService.instance;
  }

  async connect(config: ConnectionConfig): Promise<boolean> {
    try {
      console.log('🔌 Connecting to ActionCable...', { 
        userId: config.userId, 
        baseUrl: config.baseUrl || 'auto-detect'
      });
      
      this.connectionConfig = {
        autoReconnect: true,
        ...config
      };

      this.isIntentionalDisconnect = false;

      const apiBaseUrl = config.baseUrl || getCurrentApiBaseUrl();
      const wsUrl = this.convertToWebSocketUrl(apiBaseUrl);
      
      console.log('🔗 WebSocket URL:', wsUrl);

      const connectionUrl = `${wsUrl}/cable?token=${config.token}&user_id=${config.userId}`;
      this.websocket = new WebSocket(connectionUrl);

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
          
          this.subscribeToChannel();
          this.subscribeToSupportDashboard();
          this.requestInitialState();
          this.startHeartbeat();
          this.startPing();
          
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
      
      if (this.connectionConfig?.autoReconnect && !this.isIntentionalDisconnect) {
        this.scheduleReconnection();
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
          this.sendMessage({ type: 'pong' });
          return;
        }

        if (data.type === 'welcome') {
          console.log('📡 ActionCable welcome received');
          return;
        }

        if (data.type === 'confirm_subscription') {
          console.log('📡 ActionCable subscription confirmed:', data.identifier);
          
          // Check if this is the support dashboard subscription
          try {
            const identifier = JSON.parse(data.identifier);
            if (identifier.channel === 'SupportDashboardChannel') {
              this.supportDashboardSubscribed = true;
              console.log('✅ Support dashboard subscription confirmed');
            }
          } catch (e) {
            // Ignore parsing errors
          }
          return;
        }

        if (data.message) {
          console.log('📡 ActionCable message received:', data.message.type);
          this.handleMessage(data.message);
        }
      } catch (error) {
        console.error('❌ Error parsing ActionCable message:', error);
      }
    };

    this.websocket.onclose = (event) => {
      console.log('❌ WebSocket connection closed:', event.code, event.reason);
      this.isConnected = false;
      this.supportDashboardSubscribed = false;
      this.stopHeartbeat();
      this.stopPing();
      
      this.triggerCallbacks('connection_lost', { connected: false });
      
      if (this.connectionConfig?.autoReconnect && !this.isIntentionalDisconnect) {
        this.scheduleReconnection();
      }
    };

    this.websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.triggerCallbacks('connection_error', { error: 'WebSocket error' });
      
      if (this.connectionConfig?.autoReconnect && !this.isIntentionalDisconnect) {
        this.scheduleReconnection();
      }
    };
  }

  disconnect(): void {
    try {
      console.log('🔌 Disconnecting from ActionCable...');
      
      this.isIntentionalDisconnect = true;
      this.stopReconnecting();
      
      this.stopHeartbeat();
      this.stopPing();
      this.clearAllTypingTimeouts();
      
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      this.isConnected = false;
      this.supportDashboardSubscribed = false;
      this.subscribedConversations.clear();
      this.subscribedBusinesses.clear();
      this.connectionConfig = null;
      this.subscriptionIdentifier = null;
      
      console.log('✅ Disconnected from ActionCable');
    } catch (error) {
      console.error('❌ Error disconnecting from ActionCable:', error);
    }
  }

  private scheduleReconnection(): void {
    this.stopReconnecting();

    const exponentialDelay = this.MIN_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    const delay = Math.min(exponentialDelay, this.MAX_RECONNECT_DELAY);
    
    this.reconnectAttempts++;
    
    console.log(`🔄 Scheduling reconnection attempt #${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }

  private async attemptReconnection(): Promise<void> {
    if (this.isIntentionalDisconnect) {
      console.log('⏸️ Skipping reconnection - user disconnected intentionally');
      return;
    }

    if (!this.connectionConfig) {
      console.error('❌ Cannot reconnect - no connection config');
      return;
    }

    console.log(`🔄 Attempting to reconnect (attempt #${this.reconnectAttempts})...`);
    
    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (currentAccount) {
        this.connectionConfig.token = currentAccount.token;
      }

      const connected = await this.connect(this.connectionConfig);
      
      if (connected) {
        console.log('✅ Reconnection successful!');
        this.reconnectAttempts = 0;
        
        await this.resubscribeToChannels();
      } else {
        console.warn('⚠️ Reconnection failed, will retry...');
        this.scheduleReconnection();
      }
    } catch (error) {
      console.error('❌ Reconnection error:', error);
      this.scheduleReconnection();
    }
  }

  private stopReconnecting(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  public forceReconnect(): void {
    console.log('🔄 Force reconnect requested');
    this.reconnectAttempts = 0;
    this.stopReconnecting();
    
    if (this.connectionConfig && !this.isIntentionalDisconnect) {
      this.attemptReconnection();
    }
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

  private subscribeToSupportDashboard(): void {
    if (!this.connectionConfig) return;

    const supportDashboardIdentifier = JSON.stringify({
      channel: 'SupportDashboardChannel'
    });

    const subscribeCommand: ActionCableCommand = {
      command: 'subscribe',
      identifier: supportDashboardIdentifier
    };

    console.log('📡 Subscribing to SupportDashboardChannel...');
    this.sendMessage(subscribeCommand);
  }

  private sendMessage(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  subscribe(type: string, callback: (data: ActionCableMessage) => void): () => void {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
    
    console.log(`📡 Subscribed to ActionCable messages of type: ${type}`);
    
    return () => this.unsubscribe(type, callback);
  }

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

  async requestInitialState(): Promise<boolean> {
    return this.perform('request_initial_state', {});
  }

  async requestInitialCounts(): Promise<boolean> {
    return this.perform('request_counts', {});
  }

  async markNotificationRead(notificationId: number): Promise<boolean> {
    this.triggerCallbacks('notification_read_optimistic', { 
      notification_id: notificationId 
    });
    
    return this.perform('mark_notification_read', { notification_id: notificationId });
  }

  async markMessageRead(conversationId: string): Promise<boolean> {
    this.triggerCallbacks('message_read_optimistic', { 
      conversation_id: conversationId 
    });
    
    return this.perform('mark_message_read', { conversation_id: conversationId });
  }

  async startTyping(config: TypingIndicatorConfig): Promise<boolean> {
    const { conversationId, timeout = 3000 } = config;
    
    this.clearTypingTimeout(conversationId);
    
    const success = await this.perform('typing_indicator', {
      conversation_id: conversationId,
      typing: true
    });
    
    if (success) {
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

  async subscribeToBusinessUpdates(businessId: string): Promise<boolean> {
    const success = await this.perform('subscribe_to_business', {
      business_id: businessId
    });
    
    if (success) {
      this.subscribedBusinesses.add(businessId);
    }
    
    return success;
  }

  async updatePresence(status: 'online' | 'away' | 'busy' | 'offline' = 'online'): Promise<boolean> {
    return this.perform('update_presence', { status });
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      willReconnect: !this.isIntentionalDisconnect && this.connectionConfig?.autoReconnect,
      hasSubscription: !!this.subscriptionIdentifier,
      supportDashboardSubscribed: this.supportDashboardSubscribed,
      subscribedConversations: Array.from(this.subscribedConversations),
      subscribedBusinesses: Array.from(this.subscribedBusinesses),
      config: this.connectionConfig,
      websocketState: this.websocket?.readyState
    };
  }

  isConnectedToActionCable(): boolean {
    return this.isConnected && !!this.websocket && this.websocket.readyState === WebSocket.OPEN;
  }

  getSubscriptionInfo() {
    return {
      conversations: Array.from(this.subscribedConversations),
      businesses: Array.from(this.subscribedBusinesses),
      isConnected: this.isConnected,
      supportDashboardSubscribed: this.supportDashboardSubscribed
    };
  }

  private convertToWebSocketUrl(apiUrl: string): string {
    try {
      const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
      
      if (baseUrl.startsWith('https://')) {
        return baseUrl.replace('https://', 'wss://');
      } else if (baseUrl.startsWith('http://')) {
        return baseUrl.replace('http://', 'ws://');
      }
      
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
      console.log('📡 Processing ActionCable message:', data.type);
      
      const callbacks = this.callbacks[data.type] || [];
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in ActionCable callback for ${data.type}:`, error);
        }
      });

      const globalCallbacks = this.callbacks['*'] || [];
      globalCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in global ActionCable callback:`, error);
        }
      });

      if (data.type === 'new_message' && data.conversation_id) {
        const conversationCallbacks = this.callbacks[`conversation_${data.conversation_id}`] || [];
        conversationCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`❌ Error in conversation-specific callback:`, error);
          }
        });
      }

      this.processSpecialMessageTypes(data);
      this.logImportantMessages(data);
    } catch (error) {
      console.error('❌ Error handling ActionCable message:', error);
    }
  }

  private processSpecialMessageTypes(data: ActionCableMessage): void {
    try {
      switch (data.type) {
        case 'new_message':
          if (data.conversation_id && data.message) {
            console.log(`💬 New message in conversation ${data.conversation_id}`);
            
            this.triggerCallbacks('message_received', {
              ...data,
              timestamp: new Date().toISOString()
            });
          }
          break;
          
        case 'conversation_updated':
          if (data.conversation_id) {
            console.log(`🔄 Conversation ${data.conversation_id} updated`);
            this.triggerCallbacks('conversation_status_changed', data);
          }
          break;
          
        case 'typing_indicator':
          if (data.conversation_id) {
            console.log(`⌨️ Typing indicator in conversation ${data.conversation_id}: ${data.typing}`);
          }
          break;
          
        case 'ticket_status_changed':
          if (data.conversation_id) {
            console.log(`🎫 Ticket status changed for conversation ${data.conversation_id}`);
          }
          break;

        case 'dashboard_stats_update':
        case 'initial_state':
          console.log('📊 Dashboard stats received');
          break;
      }
    } catch (error) {
      console.error('❌ Error processing special message type:', error);
    }
  }

  private logImportantMessages(data: ActionCableMessage): void {
    switch (data.type) {
      case 'initial_state':
        console.log('📊 Initial state received:', {
          counts: data.counts,
          conversations: data.recent_conversations?.length,
          businesses: data.businesses?.length,
          dashboard_stats: data.dashboard_stats,
          agent_stats: data.agent_stats
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

      case 'dashboard_stats_update':
        console.log('📊 Dashboard stats updated:', data.stats);
        break;

      case 'new_support_ticket':
        console.log('🎫 New support ticket:', data.ticket?.id);
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

  private async resubscribeToChannels(): Promise<void> {
    try {
      console.log('🔄 Resubscribing to channels...');
      
      // Resubscribe to support dashboard
      if (this.supportDashboardSubscribed) {
        this.subscribeToSupportDashboard();
      }
      
      const conversationPromises = Array.from(this.subscribedConversations).map(
        conversationId => this.joinConversation(conversationId)
      );
      
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
    }, 30000);
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
    }, 25000);
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

export type { ActionCableMessage, ConnectionConfig, TypingIndicatorConfig };
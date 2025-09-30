// lib/services/ActionCableService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentApiBaseUrl } from '../api';
import { accountManager } from '../AccountManager';

interface ActionCableMessage {
  type: string;
  conversation_id?: string;
  ticket_id?: string;
  message?: any;
  stats?: any;
  ticket?: any;
  status?: string;
  user_id?: string;
  user_name?: string;
  typing?: boolean;
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

class ActionCableService {
  private static instance: ActionCableService;
  private websocket: WebSocket | null = null;
  private callbacks: ActionCableCallbacks = {};
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 999999;
  private readonly MIN_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionalDisconnect = false;
  private connectionConfig: ConnectionConfig | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptionIdentifier: string | null = null;
  private subscribedChannels: Set<string> = new Set();

  static getInstance(): ActionCableService {
    if (!ActionCableService.instance) {
      ActionCableService.instance = new ActionCableService();
    }
    return ActionCableService.instance;
  }

  async connect(config: ConnectionConfig): Promise<boolean> {
    try {
      console.log('🔌 Connecting to ActionCable...');
      
      this.connectionConfig = { autoReconnect: true, ...config };
      this.isIntentionalDisconnect = false;

      const apiBaseUrl = config.baseUrl || getCurrentApiBaseUrl();
      const wsUrl = this.convertToWebSocketUrl(apiBaseUrl);
      
      const connectionUrl = `${wsUrl}/cable?token=${config.token}&user_id=${config.userId}`;
      this.websocket = new WebSocket(connectionUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.websocket!.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ Connected to ActionCable');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          this.subscribeToUserChannel();
          this.startHeartbeat();
          this.startPing();
          
          this.triggerCallbacks('connection_established', { connected: true });
          resolve(true);
        };

        this.websocket!.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.websocket!.onclose = (event) => {
          clearTimeout(timeout);
          console.log('❌ WebSocket closed:', event.code);
          this.handleDisconnection();
        };

        this.websocket!.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ WebSocket error:', error);
          reject(error);
        };
      });

    } catch (error) {
      console.error('❌ Failed to connect:', error);
      this.handleDisconnection();
      return false;
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'ping') {
        this.sendMessage({ type: 'pong' });
        return;
      }

      if (data.type === 'welcome') {
        console.log('📡 ActionCable welcome');
        return;
      }

      if (data.type === 'confirm_subscription') {
        console.log('📡 Subscription confirmed:', data.identifier);
        return;
      }

      if (data.message) {
        console.log('📨 Message received:', data.message.type);
        this.processMessage(data.message);
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  }

  private processMessage(message: ActionCableMessage): void {
    // Trigger type-specific callbacks
    const callbacks = this.callbacks[message.type] || [];
    callbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error(`❌ Error in callback for ${message.type}:`, error);
      }
    });

    // Trigger global callbacks
    const globalCallbacks = this.callbacks['*'] || [];
    globalCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('❌ Error in global callback:', error);
      }
    });
  }

  private handleDisconnection(): void {
    this.isConnected = false;
    this.stopHeartbeat();
    this.stopPing();
    
    this.triggerCallbacks('connection_lost', { connected: false });
    
    if (this.connectionConfig?.autoReconnect && !this.isIntentionalDisconnect) {
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('⏸️ Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(
      this.MIN_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );
    
    this.reconnectAttempts++;
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }

  private async attemptReconnection(): Promise<void> {
    if (this.isIntentionalDisconnect || !this.connectionConfig) {
      return;
    }

    console.log(`🔄 Reconnecting (attempt ${this.reconnectAttempts})...`);
    
    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (currentAccount) {
        this.connectionConfig.token = currentAccount.token;
      }

      const connected = await this.connect(this.connectionConfig);
      
      if (connected) {
        console.log('✅ Reconnected successfully');
        await this.resubscribeToChannels();
      }
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
    }
  }

  private async resubscribeToChannels(): Promise<void> {
    const channels = Array.from(this.subscribedChannels);
    for (const channel of channels) {
      await this.joinConversation(channel);
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting...');
    
    this.isIntentionalDisconnect = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopHeartbeat();
    this.stopPing();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.isConnected = false;
    this.subscribedChannels.clear();
    this.connectionConfig = null;
    
    console.log('✅ Disconnected');
  }

  private subscribeToUserChannel(): void {
    if (!this.connectionConfig) return;

    this.subscriptionIdentifier = JSON.stringify({
      channel: 'UserNotificationsChannel',
      user_id: this.connectionConfig.userId
    });

    this.sendMessage({
      command: 'subscribe',
      identifier: this.subscriptionIdentifier
    });
  }

  subscribe(type: string, callback: (data: ActionCableMessage) => void): () => void {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
    
    console.log(`📡 Subscribed to: ${type}`);
    
    return () => this.unsubscribe(type, callback);
  }

  unsubscribe(type: string, callback?: (data: ActionCableMessage) => void): void {
    if (!this.callbacks[type]) return;
    
    if (callback) {
      this.callbacks[type] = this.callbacks[type].filter(cb => cb !== callback);
    } else {
      delete this.callbacks[type];
    }
  }

  perform(action: string, data: any = {}): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.subscriptionIdentifier || !this.isConnected) {
        console.warn('⚠️ Not connected, cannot perform:', action);
        resolve(false);
        return;
      }
      
      try {
        this.sendMessage({
          command: 'message',
          identifier: this.subscriptionIdentifier,
          data: JSON.stringify({ action, ...data })
        });
        
        console.log(`📡 Action performed: ${action}`);
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to perform action:', error);
        resolve(false);
      }
    });
  }

  async joinConversation(conversationId: string): Promise<boolean> {
    const success = await this.perform('join_conversation', {
      conversation_id: conversationId
    });
    
    if (success) {
      this.subscribedChannels.add(conversationId);
    }
    
    return success;
  }

  async leaveConversation(conversationId: string): Promise<boolean> {
    const success = await this.perform('leave_conversation', {
      conversation_id: conversationId
    });
    
    this.subscribedChannels.delete(conversationId);
    return success;
  }

  async startTyping(config: { conversationId: string }): Promise<boolean> {
    return this.perform('typing_indicator', {
      conversation_id: config.conversationId,
      typing: true
    });
  }

  async stopTyping(conversationId: string): Promise<boolean> {
    return this.perform('typing_indicator', {
      conversation_id: conversationId,
      typing: false
    });
  }

  async markMessageRead(conversationId: string): Promise<boolean> {
    return this.perform('mark_message_read', {
      conversation_id: conversationId
    });
  }

  isConnectedToActionCable(): boolean {
    return this.isConnected && !!this.websocket && this.websocket.readyState === WebSocket.OPEN;
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      willReconnect: !this.isIntentionalDisconnect && !!this.connectionConfig?.autoReconnect
    };
  }

  private sendMessage(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.perform('heartbeat', {});
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

  private convertToWebSocketUrl(apiUrl: string): string {
    const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
    
    if (baseUrl.startsWith('https://')) {
      return baseUrl.replace('https://', 'wss://');
    } else if (baseUrl.startsWith('http://')) {
      return baseUrl.replace('http://', 'ws://');
    }
    
    return `wss://${baseUrl}`;
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
}

export default ActionCableService;
export type { ActionCableMessage, ConnectionConfig };
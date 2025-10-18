// lib/services/ActionCableService.ts - ENHANCED with Retry Queue

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentApiBaseUrl } from '../api';
import { accountManager } from '../AccountManager';

interface PendingOperation {
  id: string;
  action: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

interface ActionCableMessage {
  type: string;
  [key: string]: any;
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
  private callbacks: { [key: string]: ((data: ActionCableMessage) => void)[] } = {};
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MIN_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private readonly MAX_RETRY_COUNT = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionalDisconnect = false;
  private connectionConfig: ConnectionConfig | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscriptionIdentifier: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  
  // Retry queue management
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private readonly PENDING_OPS_KEY = '@actioncable_pending_ops';
  private isProcessingQueue = false;

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

      this.setupWebSocketHandlers();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

        this.websocket!.onopen = async () => {
          clearTimeout(timeout);
          console.log('✅ Connected to ActionCable');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          this.subscribeToChannel();
          this.requestInitialState();
          this.startHeartbeat();
          this.startPing();
          
          await this.updatePresence('online');
          this.triggerCallbacks('connection_established', { connected: true });
          
          // Process pending operations after connection
          await this.loadAndProcessPendingOperations();
          
          resolve(true);
        };

        this.websocket!.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ WebSocket error:', error);
          reject(error);
        };
      });

    } catch (error) {
      console.error('❌ Failed to connect:', error);
      
      if (this.connectionConfig?.autoReconnect && !this.isIntentionalDisconnect) {
        this.scheduleReconnection();
      }
      
      return false;
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting...');
    
    this.isIntentionalDisconnect = true;
    this.stopReconnecting();
    
    if (this.isConnected) {
      this.updatePresence('offline').catch(() => {});
    }
    
    this.stopHeartbeat();
    this.stopPing();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.isConnected = false;
    console.log('✅ Disconnected');
  }

  // ============================================
  // MARK NOTIFICATIONS VIA ACTIONCABLE
  // ============================================
  
  async markVisibleNotificationsRead(notificationIds: number[]): Promise<boolean> {
    const operationId = `mark_visible_${Date.now()}_${Math.random()}`;
    
    try {
      if (!this.isConnected) {
        console.log('⏳ Not connected, queuing mark operation...');
        await this.queueOperation(operationId, 'mark_visible_as_read', {
          notification_ids: notificationIds
        });
        return false;
      }

      const success = await this.perform('mark_visible_as_read', {
        notification_ids: notificationIds
      });

      if (success) {
        console.log(`✅ Marked ${notificationIds.length} notifications as read via ActionCable`);
        return true;
      } else {
        console.log('⚠️ Failed to mark, queuing for retry...');
        await this.queueOperation(operationId, 'mark_visible_as_read', {
          notification_ids: notificationIds
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Error marking notifications:', error);
      await this.queueOperation(operationId, 'mark_visible_as_read', {
        notification_ids: notificationIds
      });
      return false;
    }
  }

  async markNotificationRead(notificationId: number): Promise<boolean> {
    const operationId = `mark_single_${notificationId}_${Date.now()}`;
    
    try {
      if (!this.isConnected) {
        await this.queueOperation(operationId, 'mark_notification_read', {
          notification_id: notificationId
        });
        return false;
      }

      const success = await this.perform('mark_notification_read', {
        notification_id: notificationId
      });

      if (success) {
        return true;
      } else {
        await this.queueOperation(operationId, 'mark_notification_read', {
          notification_id: notificationId
        });
        return false;
      }
    } catch (error) {
      await this.queueOperation(operationId, 'mark_notification_read', {
        notification_id: notificationId
      });
      return false;
    }
  }

  // ============================================
  // RETRY QUEUE MANAGEMENT
  // ============================================
  
  private async queueOperation(id: string, action: string, data: any): Promise<void> {
    const operation: PendingOperation = {
      id,
      action,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.pendingOperations.set(id, operation);
    await this.savePendingOperations();
    
    console.log(`📝 Queued operation: ${action} (ID: ${id})`);
  }

  private async savePendingOperations(): Promise<void> {
    try {
      const operations = Array.from(this.pendingOperations.values());
      await AsyncStorage.setItem(this.PENDING_OPS_KEY, JSON.stringify(operations));
    } catch (error) {
      console.error('❌ Failed to save pending operations:', error);
    }
  }

  private async loadPendingOperations(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.PENDING_OPS_KEY);
      if (stored) {
        const operations: PendingOperation[] = JSON.parse(stored);
        operations.forEach(op => this.pendingOperations.set(op.id, op));
        console.log(`📥 Loaded ${operations.length} pending operations`);
      }
    } catch (error) {
      console.error('❌ Failed to load pending operations:', error);
    }
  }

  private async loadAndProcessPendingOperations(): Promise<void> {
    await this.loadPendingOperations();
    await this.processPendingOperations();
  }

  private async processPendingOperations(): Promise<void> {
    if (this.isProcessingQueue || !this.isConnected) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`🔄 Processing ${this.pendingOperations.size} pending operations...`);

    const operations = Array.from(this.pendingOperations.values());
    
    for (const operation of operations) {
      if (!this.isConnected) {
        console.log('⏸️ Connection lost, pausing queue processing');
        break;
      }

      try {
        console.log(`⚙️ Retrying operation: ${operation.action} (attempt ${operation.retryCount + 1})`);
        
        const success = await this.perform(operation.action, operation.data);

        if (success) {
          console.log(`✅ Operation successful: ${operation.id}`);
          this.pendingOperations.delete(operation.id);
        } else if (operation.retryCount >= this.MAX_RETRY_COUNT) {
          console.log(`❌ Max retries reached for: ${operation.id}`);
          this.pendingOperations.delete(operation.id);
        } else {
          operation.retryCount++;
          this.pendingOperations.set(operation.id, operation);
        }
      } catch (error) {
        console.error(`❌ Error processing operation ${operation.id}:`, error);
        
        if (operation.retryCount >= this.MAX_RETRY_COUNT) {
          this.pendingOperations.delete(operation.id);
        } else {
          operation.retryCount++;
          this.pendingOperations.set(operation.id, operation);
        }
      }

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await this.savePendingOperations();
    this.isProcessingQueue = false;
    
    console.log(`✅ Queue processing complete. ${this.pendingOperations.size} operations remaining`);
  }

  // ============================================
  // CORE ACTIONCABLE METHODS
  // ============================================

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
          console.log('📡 Subscription confirmed');
          return;
        }

        if (data.message) {
          this.handleMessage(data.message);
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    };

    this.websocket.onclose = (event) => {
      console.log('❌ Connection closed:', event.code);
      this.isConnected = false;
      this.stopHeartbeat();
      this.stopPing();
      
      this.triggerCallbacks('connection_lost', { connected: false });
      
      if (this.connectionConfig?.autoReconnect && !this.isIntentionalDisconnect) {
        this.scheduleReconnection();
      }
    };

    this.websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
  }

  private scheduleReconnection(): void {
    this.stopReconnecting();

    const exponentialDelay = this.MIN_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    const delay = Math.min(exponentialDelay, this.MAX_RECONNECT_DELAY);
    
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
        console.log('✅ Reconnection successful!');
        this.reconnectAttempts = 0;
        await this.updatePresence('online');
      } else {
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

  private subscribeToChannel(): void {
    if (!this.connectionConfig) return;

    this.subscriptionIdentifier = JSON.stringify({
      channel: 'UserNotificationsChannel',
      user_id: this.connectionConfig.userId
    });

    this.sendMessage({
      command: 'subscribe',
      identifier: this.subscriptionIdentifier
    });

    console.log('📡 Subscribed to UserNotificationsChannel');
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
  }

  perform(action: string, data: any = {}): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.subscriptionIdentifier || !this.isConnected) {
        console.warn('⚠️ Not connected, cannot perform action:', action);
        resolve(false);
        return;
      }
      
      try {
        this.sendMessage({
          command: 'message',
          identifier: this.subscriptionIdentifier,
          data: JSON.stringify({
            action: action,
            ...data
          })
        });

        console.log(`📡 Performed action: ${action}`);
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to perform action:', error);
        resolve(false);
      }
    });
  }

  async requestInitialState(): Promise<boolean> {
    return this.perform('request_initial_state', {});
  }

  async updatePresence(status: 'online' | 'away' | 'busy' | 'offline' = 'online'): Promise<boolean> {
    return this.perform('update_presence', { status });
  }

  isConnectedToActionCable(): boolean {
    return this.isConnected && !!this.websocket && this.websocket.readyState === WebSocket.OPEN;
  }

  getPendingOperationsCount(): number {
    return this.pendingOperations.size;
  }

  async clearPendingOperations(): Promise<void> {
    this.pendingOperations.clear();
    await AsyncStorage.removeItem(this.PENDING_OPS_KEY);
    console.log('🗑️ Cleared all pending operations');
  }

  private handleMessage(data: ActionCableMessage): void {
    const callbacks = this.callbacks[data.type] || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Error in callback for ${data.type}:`, error);
      }
    });
  }

  private triggerCallbacks(type: string, data: any): void {
    const callbacks = this.callbacks[type] || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Error in callback for ${type}:`, error);
      }
    });
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

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.updatePresence('online').catch(() => {});
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
}

export default ActionCableService;
export type { ActionCableMessage, ConnectionConfig, PendingOperation };
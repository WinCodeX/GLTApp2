// services/supportApi.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api'; // Fixed: Removed double slash

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

interface Conversation {
  id: string;
  conversation_type: string;
  ticket_id?: string;
  status?: string;
  assigned_agent?: {
    id: string;
    name: string;
    online: boolean;
  };
  last_activity_at: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  from_support: boolean;
  message_type: 'text' | 'voice' | 'image' | 'file' | 'system';
  is_system?: boolean;
  user: {
    id: string;
    name: string;
    role: string;
  };
  metadata?: any;
}

interface PendingTicket {
  id: string;
  category: string;
  package_id?: string;
  timestamp: number;
  retryCount: number;
}

interface PendingMessage {
  id: string;
  conversationId: string;
  content: string;
  message_type: string;
  timestamp: number;
  retryCount: number;
}

class SupportApiService {
  private readonly PENDING_TICKETS_KEY = 'pending_support_tickets';
  private readonly PENDING_MESSAGES_KEY = 'pending_support_messages';
  private readonly ACTIVE_CONVERSATION_KEY = 'active_support_conversation';
  private readonly MAX_RETRY_COUNT = 5;

  // Support Conversation Methods
  async createSupportTicket(category: string, packageId?: string): Promise<ApiResponse<{
    conversation: Conversation;
    conversation_id: string;
    ticket_id: string;
  }>> {
    try {
      console.log(`🎫 Creating support ticket: ${category}${packageId ? ` for package ${packageId}` : ''}`);
      
      // Prepare request payload
      const payload: any = {
        category,
      };
      
      // Only add package_id if it exists and is not empty
      if (packageId && packageId.trim()) {
        payload.package_id = packageId.trim();
      }

      console.log('📤 Support ticket payload:', payload);
      
      const response = await api.post('/api/v1/conversations/support_ticket', payload);

      console.log('📥 Support ticket response:', response.data);

      if (response.data.success) {
        // Cache the active conversation
        await this.cacheActiveConversation(response.data);
        
        // Remove from pending tickets if it was cached
        await this.removePendingTicket();
        
        return {
          success: true,
          data: response.data,
        };
      } else {
        throw new Error(response.data.message || 'Failed to create ticket');
      }
    } catch (error: any) {
      console.error('❌ Error creating support ticket:', error);
      
      // Check if it's a network error vs server error
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        // Cache the ticket creation for retry
        await this.cachePendingTicket(category, packageId);
        
        return {
          success: false,
          message: 'Ticket creation cached for retry. We\'ll connect you when network is available.',
        };
      }
      
      // For server errors, return the actual error message
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to create support ticket',
        errors: error.response?.data?.errors,
      };
    }
  }

  async getActiveSupport(): Promise<ApiResponse<{
    conversation: Conversation | null;
    conversation_id: string | null;
  }>> {
    try {
      console.log('🔍 Getting active support conversation...');
      
      // First check cache
      const cachedConversation = await this.getCachedActiveConversation();
      if (cachedConversation) {
        console.log('📋 Using cached active conversation');
        return {
          success: true,
          data: {
            conversation: cachedConversation.conversation,
            conversation_id: cachedConversation.conversation_id,
          },
        };
      }

      const response = await api.get('/api/v1/conversations/active_support');
      
      console.log('📥 Active support response:', response.data);
      
      if (response.data.success && response.data.conversation) {
        // Cache the active conversation
        await this.cacheActiveConversation(response.data);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('❌ Error getting active support:', error);
      
      // Return cached conversation if available
      const cachedConversation = await this.getCachedActiveConversation();
      if (cachedConversation) {
        return {
          success: true,
          data: {
            conversation: cachedConversation.conversation,
            conversation_id: cachedConversation.conversation_id,
          },
        };
      }

      return {
        success: false,
        message: error.response?.data?.message || 'Unable to load support conversation',
      };
    }
  }

  async getConversation(conversationId: string): Promise<ApiResponse<{
    conversation: Conversation;
    messages: Message[];
  }>> {
    try {
      console.log(`🔍 Loading conversation: ${conversationId}`);
      
      const response = await api.get(`/api/v1/conversations/${conversationId}`);
      
      console.log('📥 Conversation response:', response.data);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('❌ Error loading conversation:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load conversation',
      };
    }
  }

  async sendMessage(
    conversationId: string, 
    content: string, 
    messageType: string = 'text',
    metadata?: any
  ): Promise<ApiResponse<{
    message: Message;
  }>> {
    try {
      console.log(`💬 Sending message to conversation: ${conversationId}`);
      
      const payload = {
        message: {
          content: content.trim(),
          message_type: messageType,
          metadata: metadata || {},
        },
      };

      console.log('📤 Message payload:', payload);

      const response = await api.post(`/api/v1/conversations/${conversationId}/messages`, payload);

      console.log('📥 Message response:', response.data);

      if (response.data.success) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        throw new Error(response.data.message || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      
      // Check if it's a network error
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        // Cache the message for retry
        await this.cachePendingMessage(conversationId, content, messageType);
        
        return {
          success: false,
          message: 'Message cached for retry',
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to send message',
      };
    }
  }

  // Package validation (Updated to match your routes)
  async validatePackage(packageCode: string): Promise<ApiResponse<{
    package: any;
    valid: boolean;
  }>> {
    try {
      console.log(`📦 Validating package: ${packageCode}`);
      
      // Use the packages show endpoint instead of a validate endpoint
      const response = await api.get(`/api/v1/packages/${packageCode}`);
      
      return {
        success: true,
        data: {
          package: response.data,
          valid: true,
        },
      };
    } catch (error: any) {
      console.error('❌ Error validating package:', error);
      
      // If package not found, return valid: false instead of error
      if (error.response?.status === 404) {
        return {
          success: true,
          data: {
            package: null,
            valid: false,
          },
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to validate package code',
      };
    }
  }

  // Close support ticket
  async closeTicket(conversationId: string): Promise<ApiResponse<any>> {
    try {
      console.log(`🔒 Closing support ticket: ${conversationId}`);
      
      const response = await api.patch(`/api/v1/conversations/${conversationId}/close`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('❌ Error closing ticket:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to close ticket',
      };
    }
  }

  // Reopen support ticket
  async reopenTicket(conversationId: string): Promise<ApiResponse<any>> {
    try {
      console.log(`🔓 Reopening support ticket: ${conversationId}`);
      
      const response = await api.patch(`/api/v1/conversations/${conversationId}/reopen`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('❌ Error reopening ticket:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reopen ticket',
      };
    }
  }

  // Mark conversation as read
  async markAsRead(conversationId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.patch(`/api/v1/conversations/${conversationId}/messages/mark_read`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('❌ Error marking as read:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to mark as read',
      };
    }
  }

  // Caching methods
  private async cachePendingTicket(category: string, packageId?: string): Promise<void> {
    try {
      const pendingTicket: PendingTicket = {
        id: `pending_${Date.now()}`,
        category,
        package_id: packageId,
        timestamp: Date.now(),
        retryCount: 0,
      };

      await AsyncStorage.setItem(this.PENDING_TICKETS_KEY, JSON.stringify(pendingTicket));
      console.log('💾 Cached pending ticket for retry');
    } catch (error) {
      console.error('❌ Error caching pending ticket:', error);
    }
  }

  private async cachePendingMessage(
    conversationId: string,
    content: string,
    messageType: string
  ): Promise<void> {
    try {
      const pendingMessages = await this.getPendingMessages();
      const newMessage: PendingMessage = {
        id: `pending_${Date.now()}`,
        conversationId,
        content,
        message_type: messageType,
        timestamp: Date.now(),
        retryCount: 0,
      };

      pendingMessages.push(newMessage);
      await AsyncStorage.setItem(this.PENDING_MESSAGES_KEY, JSON.stringify(pendingMessages));
      console.log('💾 Cached pending message for retry');
    } catch (error) {
      console.error('❌ Error caching pending message:', error);
    }
  }

  private async cacheActiveConversation(conversationData: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.ACTIVE_CONVERSATION_KEY, JSON.stringify(conversationData));
      console.log('💾 Cached active conversation');
    } catch (error) {
      console.error('❌ Error caching active conversation:', error);
    }
  }

  private async getCachedActiveConversation(): Promise<any> {
    try {
      const cached = await AsyncStorage.getItem(this.ACTIVE_CONVERSATION_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('❌ Error getting cached conversation:', error);
      return null;
    }
  }

  private async removePendingTicket(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.PENDING_TICKETS_KEY);
      console.log('🗑️ Removed pending ticket from cache');
    } catch (error) {
      console.error('❌ Error removing pending ticket:', error);
    }
  }

  private async getPendingMessages(): Promise<PendingMessage[]> {
    try {
      const cached = await AsyncStorage.getItem(this.PENDING_MESSAGES_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('❌ Error getting pending messages:', error);
      return [];
    }
  }

  // Clear all cached data (useful for logout)
  async clearCache(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.PENDING_TICKETS_KEY),
        AsyncStorage.removeItem(this.PENDING_MESSAGES_KEY),
        AsyncStorage.removeItem(this.ACTIVE_CONVERSATION_KEY),
      ]);
      console.log('🧹 Cleared all support cache');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  // Retry failed operations
  async retryPendingOperations(): Promise<void> {
    try {
      console.log('🔄 Retrying pending operations...');
      
      // Retry pending ticket creation
      await this.retryPendingTicket();
      
      // Retry pending messages
      await this.retryPendingMessages();
    } catch (error) {
      console.error('❌ Error retrying operations:', error);
    }
  }

  private async retryPendingTicket(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.PENDING_TICKETS_KEY);
      if (!cached) return;

      const pendingTicket: PendingTicket = JSON.parse(cached);
      
      if (pendingTicket.retryCount >= this.MAX_RETRY_COUNT) {
        console.log('⚠️ Max retry count reached for pending ticket');
        await this.removePendingTicket();
        return;
      }

      console.log(`🔄 Retrying ticket creation (attempt ${pendingTicket.retryCount + 1})`);
      
      const result = await this.createSupportTicket(pendingTicket.category, pendingTicket.package_id);
      
      if (!result.success) {
        // Increment retry count
        pendingTicket.retryCount++;
        await AsyncStorage.setItem(this.PENDING_TICKETS_KEY, JSON.stringify(pendingTicket));
      }
    } catch (error) {
      console.error('❌ Error retrying pending ticket:', error);
    }
  }

  private async retryPendingMessages(): Promise<void> {
    try {
      const pendingMessages = await this.getPendingMessages();
      const updatedMessages: PendingMessage[] = [];

      for (const message of pendingMessages) {
        if (message.retryCount >= this.MAX_RETRY_COUNT) {
          console.log(`⚠️ Max retry count reached for message ${message.id}`);
          continue;
        }

        console.log(`🔄 Retrying message send (attempt ${message.retryCount + 1})`);
        
        const result = await this.sendMessage(
          message.conversationId,
          message.content,
          message.message_type
        );

        if (!result.success) {
          message.retryCount++;
          updatedMessages.push(message);
        }
      }

      await AsyncStorage.setItem(this.PENDING_MESSAGES_KEY, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('❌ Error retrying pending messages:', error);
    }
  }

  // Check network connectivity and retry operations
  async handleNetworkReconnection(): Promise<void> {
    console.log('🌐 Network reconnected, retrying pending operations...');
    await this.retryPendingOperations();
  }
}

export const supportApi = new SupportApiService();
export type { ApiResponse, Conversation, Message };
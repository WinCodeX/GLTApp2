// services/supportApi.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib//api'; // Your existing axios setup

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
      
      const response = await api.post('/api/v1/conversations/support_ticket', {
        category,
        package_id: packageId,
      });

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
    } catch (error) {
      console.error('❌ Error creating support ticket:', error);
      
      // Cache the ticket creation for retry
      await this.cachePendingTicket(category, packageId);
      
      return {
        success: false,
        message: 'Ticket creation cached for retry. We\'ll connect you when network is available.',
      };
    }
  }

  async getActiveSupport(): Promise<ApiResponse<{
    conversation: Conversation | null;
    conversation_id: string | null;
  }>> {
    try {
      // First check cache
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

      const response = await api.get('/api/v1/conversations/active_support');
      
      if (response.data.success && response.data.conversation) {
        // Cache the active conversation
        await this.cacheActiveConversation(response.data);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
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
        message: 'Unable to load support conversation',
      };
    }
  }

  async getConversation(conversationId: string): Promise<ApiResponse<{
    conversation: Conversation;
    messages: Message[];
  }>> {
    try {
      const response = await api.get(`/api/v1/conversations/${conversationId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('❌ Error loading conversation:', error);
      return {
        success: false,
        message: 'Failed to load conversation',
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
      const response = await api.post(`/api/v1/conversations/${conversationId}/messages`, {
        message: {
          content,
          message_type: messageType,
          metadata: metadata || {},
        },
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        throw new Error(response.data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Cache the message for retry
      await this.cachePendingMessage(conversationId, content, messageType);
      
      return {
        success: false,
        message: 'Message cached for retry',
      };
    }
  }

  // Package validation
  async validatePackage(packageCode: string): Promise<ApiResponse<{
    package: any;
    valid: boolean;
  }>> {
    try {
      console.log(`📦 Validating package: ${packageCode}`);
      
      // This endpoint should validate the package exists
      const response = await api.get(`/api/v1/packages/${packageCode}/validate`);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('❌ Error validating package:', error);
      return {
        success: false,
        message: 'Unable to validate package code',
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
}

export const supportApi = new SupportApiService();
export type { ApiResponse, Conversation, Message };

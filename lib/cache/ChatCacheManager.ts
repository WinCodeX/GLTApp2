// lib/cache/ChatCacheManager.ts - In-memory chat storage with ActionCable integration

interface CachedMessage {
  id: string;
  content: string;
  created_at: string;
  is_system: boolean;
  from_support: boolean;
  message_type: string;
  user: {
    id: string;
    name: string;
    role: string;
    avatar_url?: string;
  };
  timestamp: string;
  metadata?: any;
  optimistic?: boolean;
}

interface CachedConversation {
  id: string;
  ticket_id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  customer: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  assigned_agent?: {
    id: string;
    name: string;
    email: string;
  };
  escalated: boolean;
  package_id?: string;
  created_at: string;
  last_activity_at: string;
}

interface CachedConversationData {
  conversation: CachedConversation;
  messages: CachedMessage[];
  lastUpdated: number;
  hasMoreMessages: boolean;
  oldestMessageId: string | null;
  totalMessages: number;
}

interface CacheSubscriber {
  (conversationId: string, data: CachedConversationData): void;
}

class ChatCacheManager {
  private static instance: ChatCacheManager;
  private cache: Map<string, CachedConversationData> = new Map();
  private subscribers: Map<string, Set<CacheSubscriber>> = new Map();
  private readonly CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 50; // Maximum conversations to cache
  private readonly MAX_MESSAGES_PER_CONVERSATION = 200; // Prevent memory bloat

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): ChatCacheManager {
    if (!ChatCacheManager.instance) {
      ChatCacheManager.instance = new ChatCacheManager();
    }
    return ChatCacheManager.instance;
  }

  // Subscribe to cache updates for a specific conversation
  subscribe(conversationId: string, callback: CacheSubscriber): () => void {
    if (!this.subscribers.has(conversationId)) {
      this.subscribers.set(conversationId, new Set());
    }
    
    this.subscribers.get(conversationId)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(conversationId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(conversationId);
        }
      }
    };
  }

  // Check if conversation is cached and not expired
  isCached(conversationId: string): boolean {
    const cached = this.cache.get(conversationId);
    if (!cached) return false;
    
    const isExpired = Date.now() - cached.lastUpdated > this.CACHE_EXPIRY_TIME;
    if (isExpired) {
      this.cache.delete(conversationId);
      return false;
    }
    
    return true;
  }

  // Get cached conversation data
  getCachedConversation(conversationId: string): CachedConversationData | null {
    if (!this.isCached(conversationId)) {
      return null;
    }
    return this.cache.get(conversationId) || null;
  }

  // Store conversation and messages in cache
  setCachedConversation(
    conversationId: string,
    conversation: CachedConversation,
    messages: CachedMessage[],
    hasMoreMessages: boolean = false,
    oldestMessageId: string | null = null
  ): void {
    // Enforce cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldestCache();
    }

    // Limit messages per conversation to prevent memory issues
    const limitedMessages = messages.slice(-this.MAX_MESSAGES_PER_CONVERSATION);
    
    const cacheData: CachedConversationData = {
      conversation,
      messages: limitedMessages,
      lastUpdated: Date.now(),
      hasMoreMessages,
      oldestMessageId: oldestMessageId || (limitedMessages.length > 0 ? limitedMessages[0].id : null),
      totalMessages: limitedMessages.length
    };

    this.cache.set(conversationId, cacheData);
    this.notifySubscribers(conversationId, cacheData);
    
    console.log(`💾 Cached conversation ${conversationId} with ${messages.length} messages`);
  }

  // Add new message to existing cache
  addMessageToCache(conversationId: string, message: CachedMessage): void {
    const cached = this.cache.get(conversationId);
    if (!cached) return;

    // Remove any existing optimistic message with same content
    const filteredMessages = cached.messages.filter(
      msg => !(msg.optimistic && msg.content === message.content)
    );

    // Add new message
    const updatedMessages = [...filteredMessages, message];
    
    // Maintain message limit
    const limitedMessages = updatedMessages.slice(-this.MAX_MESSAGES_PER_CONVERSATION);

    const updatedCache: CachedConversationData = {
      ...cached,
      messages: limitedMessages,
      lastUpdated: Date.now(),
      totalMessages: limitedMessages.length
    };

    this.cache.set(conversationId, updatedCache);
    this.notifySubscribers(conversationId, updatedCache);
    
    console.log(`📨 Added message to cache for conversation ${conversationId}`);
  }

  // Add optimistic message (temporary until confirmed)
  addOptimisticMessage(conversationId: string, message: CachedMessage): void {
    const cached = this.cache.get(conversationId);
    if (!cached) return;

    const optimisticMessage = { ...message, optimistic: true };
    const updatedMessages = [...cached.messages, optimisticMessage];

    const updatedCache: CachedConversationData = {
      ...cached,
      messages: updatedMessages,
      lastUpdated: Date.now()
    };

    this.cache.set(conversationId, updatedCache);
    this.notifySubscribers(conversationId, updatedCache);
    
    console.log(`⏳ Added optimistic message to cache for conversation ${conversationId}`);
  }

  // Remove optimistic messages (on error or success)
  removeOptimisticMessages(conversationId: string): void {
    const cached = this.cache.get(conversationId);
    if (!cached) return;

    const filteredMessages = cached.messages.filter(msg => !msg.optimistic);

    const updatedCache: CachedConversationData = {
      ...cached,
      messages: filteredMessages,
      lastUpdated: Date.now()
    };

    this.cache.set(conversationId, updatedCache);
    this.notifySubscribers(conversationId, updatedCache);
    
    console.log(`🗑️ Removed optimistic messages from cache for conversation ${conversationId}`);
  }

  // Prepend older messages to cache (for pagination)
  prependOlderMessages(
    conversationId: string,
    olderMessages: CachedMessage[],
    hasMoreMessages: boolean
  ): void {
    const cached = this.cache.get(conversationId);
    if (!cached) return;

    const allMessages = [...olderMessages, ...cached.messages];
    const limitedMessages = allMessages.slice(-this.MAX_MESSAGES_PER_CONVERSATION);

    const updatedCache: CachedConversationData = {
      ...cached,
      messages: limitedMessages,
      hasMoreMessages,
      oldestMessageId: limitedMessages.length > 0 ? limitedMessages[0].id : null,
      lastUpdated: Date.now(),
      totalMessages: limitedMessages.length
    };

    this.cache.set(conversationId, updatedCache);
    this.notifySubscribers(conversationId, updatedCache);
    
    console.log(`📚 Prepended ${olderMessages.length} older messages to cache for conversation ${conversationId}`);
  }

  // Update conversation metadata (status, priority, etc.)
  updateConversationMetadata(conversationId: string, updates: Partial<CachedConversation>): void {
    const cached = this.cache.get(conversationId);
    if (!cached) return;

    const updatedConversation = { ...cached.conversation, ...updates };
    const updatedCache: CachedConversationData = {
      ...cached,
      conversation: updatedConversation,
      lastUpdated: Date.now()
    };

    this.cache.set(conversationId, updatedCache);
    this.notifySubscribers(conversationId, updatedCache);
    
    console.log(`🔄 Updated conversation metadata for ${conversationId}`);
  }

  // Clear cache for specific conversation
  clearConversationCache(conversationId: string): void {
    this.cache.delete(conversationId);
    this.subscribers.delete(conversationId);
    console.log(`🗑️ Cleared cache for conversation ${conversationId}`);
  }

  // Clear all cache
  clearAllCache(): void {
    this.cache.clear();
    this.subscribers.clear();
    console.log(`🗑️ Cleared all chat cache`);
  }

  // Get cache statistics
  getCacheStats(): {
    totalConversations: number;
    totalMessages: number;
    cacheSize: string;
    oldestCacheTime: number | null;
  } {
    let totalMessages = 0;
    let oldestCacheTime: number | null = null;

    this.cache.forEach((data) => {
      totalMessages += data.messages.length;
      if (oldestCacheTime === null || data.lastUpdated < oldestCacheTime) {
        oldestCacheTime = data.lastUpdated;
      }
    });

    return {
      totalConversations: this.cache.size,
      totalMessages,
      cacheSize: `${Math.round((JSON.stringify([...this.cache.values()]).length / 1024))} KB`,
      oldestCacheTime
    };
  }

  // Check if we need to load older messages
  shouldLoadOlderMessages(conversationId: string): boolean {
    const cached = this.cache.get(conversationId);
    return cached?.hasMoreMessages ?? true;
  }

  // Get oldest message ID for pagination
  getOldestMessageId(conversationId: string): string | null {
    const cached = this.cache.get(conversationId);
    return cached?.oldestMessageId ?? null;
  }

  // Private methods
  private notifySubscribers(conversationId: string, data: CachedConversationData): void {
    const subs = this.subscribers.get(conversationId);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(conversationId, data);
        } catch (error) {
          console.error('Error in cache subscriber callback:', error);
        }
      });
    }
  }

  private evictOldestCache(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.cache.forEach((data, key) => {
      if (data.lastUpdated < oldestTime) {
        oldestTime = data.lastUpdated;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.subscribers.delete(oldestKey);
      console.log(`🗑️ Evicted oldest cache entry: ${oldestKey}`);
    }
  }

  private startCleanupTimer(): void {
    // Clean up expired cache every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.cache.forEach((data, key) => {
        if (now - data.lastUpdated > this.CACHE_EXPIRY_TIME) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.subscribers.delete(key);
      });

      if (keysToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}

export default ChatCacheManager;
export type { CachedMessage, CachedConversation, CachedConversationData };
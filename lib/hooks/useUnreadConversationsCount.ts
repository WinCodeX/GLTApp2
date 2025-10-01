// lib/hooks/useUnreadConversationsCount.ts
import { useState, useEffect, useRef } from 'react';
import ActionCableService from '../services/ActionCableService';
import api from '../api';

export const useUnreadConversationsCount = () => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const subscriptionsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    actionCableRef.current = ActionCableService.getInstance();
    
    // Fetch initial count
    fetchUnreadCount();

    // Subscribe to ActionCable events
    setupSubscriptions();

    return () => {
      // Cleanup subscriptions
      subscriptionsRef.current.forEach(unsub => {
        if (unsub) unsub();
      });
      subscriptionsRef.current = [];
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/api/v1/support/tickets', {
        params: {
          limit: 100,
          page: 1,
        },
      });

      if (response.data.success) {
        const tickets = response.data.data.tickets || [];
        const count = tickets.filter((ticket: any) => ticket.unread_count > 0).length;
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const setupSubscriptions = () => {
    const actionCable = actionCableRef.current;
    if (!actionCable) return;

    // New message - increment count
    const unsubNewMessage = actionCable.subscribe('new_message', (data) => {
      if (data.conversation_id && data.message && !data.message.from_support) {
        setUnreadCount(prev => prev + 1);
      }
    });
    subscriptionsRef.current.push(unsubNewMessage);

    // Message read - decrement count
    const unsubRead = actionCable.subscribe('conversation_read', (data) => {
      if (data.conversation_id) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    });
    subscriptionsRef.current.push(unsubRead);

    // Initial state - set accurate count
    const unsubInitialState = actionCable.subscribe('initial_state', (data) => {
      if (data.recent_conversations) {
        const count = data.recent_conversations.filter(
          (conv: any) => conv.unread_count > 0
        ).length;
        setUnreadCount(count);
      }
    });
    subscriptionsRef.current.push(unsubInitialState);

    // Dashboard stats update - use accurate count
    const unsubDashboardStats = actionCable.subscribe('dashboard_stats_update', () => {
      fetchUnreadCount();
    });
    subscriptionsRef.current.push(unsubDashboardStats);
  };

  return unreadCount;
};
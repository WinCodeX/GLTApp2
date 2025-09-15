// lib/services/FirebaseFCMService.ts - Complete FCM Implementation with TypeScript
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

// ========================================
// 🔧 TYPE DEFINITIONS
// ========================================

interface FCMTokenRegistrationData {
  push_token: string;
  platform: 'fcm';
  device_info: {
    platform: string;
    version: string | number;
    model: string;
  };
}

interface NotificationChannelConfig {
  id: string;
  name: string;
  sound: string;
  importance: number;
  visibility: number;
  vibration: boolean;
  vibrationPattern: number[];
  lights: boolean;
  lightColor: string;
  badge: boolean;
  bypassDnd?: boolean;
}

interface PendingNotification {
  id: string;
  title?: string;
  body?: string;
  data?: { [key: string]: string };
  receivedAt: number;
}

type NotificationPriority = 'normal' | 'high' | 'urgent' | 'low' | 'critical' | 'emergency' | 'important';
type ChannelId = 'default' | 'high' | 'urgent';
type SoundFile = 'notification_sound' | 'notification_high' | 'notification_urgent';

interface ApiResponse {
  data?: {
    success?: boolean;
    count?: number;
  };
}

class FirebaseFCMService {
  private token: string | null = null;
  private isInitialized: boolean = false;
  private foregroundListener: (() => void) | null = null;

  // ========================================
  // 🔧 INITIALIZATION
  // ========================================

  async initialize(): Promise<boolean> {
    try {
      console.log('🔥 Initializing Firebase FCM Service...');
      
      // Request permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('🔥 FCM permissions denied');
        return false;
      }

      // Setup notification channels with custom sounds (Android)
      if (Platform.OS === 'android') {
        await this.setupNotificationChannels();
      }

      // Get FCM token
      await this.getAndRegisterToken();

      // Setup listeners
      this.setupTokenRefreshListener();
      this.setupMessageListeners();
      this.setupBackgroundHandler();

      this.isInitialized = true;
      console.log('✅ Firebase FCM Service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ FCM initialization failed:', error);
      return false;
    }
  }

  // ========================================
  // 🔔 NOTIFICATION CHANNELS SETUP
  // ========================================

  private async setupNotificationChannels(): Promise<void> {
    try {
      console.log('🔊 Setting up notification channels with custom sounds...');
      
      if (Platform.OS !== 'android') {
        console.log('📱 iOS detected - notification channels not needed');
        return;
      }

      // Import notifee for advanced notification handling
      const notifee = require('@notifee/react-native');
      const { AndroidImportance, AndroidVisibility } = notifee;

      // Default notification channel
      await notifee.createChannel({
        id: 'default',
        name: 'Default GLT Notifications',
        sound: 'notification_sound',
        importance: AndroidImportance.DEFAULT,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        vibrationPattern: [300, 500],
        lights: true,
        lightColor: '#7c3aed',
        badge: true,
      } as NotificationChannelConfig);

      // High priority notification channel  
      await notifee.createChannel({
        id: 'high',
        name: 'High Priority GLT Notifications',
        sound: 'notification_high',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
        lights: true,
        lightColor: '#f59e0b',
        badge: true,
      } as NotificationChannelConfig);

      // Urgent notification channel
      await notifee.createChannel({
        id: 'urgent',
        name: 'Urgent GLT Notifications',
        sound: 'notification_urgent',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        vibrationPattern: [500, 300, 500, 300, 500],
        lights: true,
        lightColor: '#ef4444',
        badge: true,
        bypassDnd: true, // Bypass do not disturb for urgent notifications
      } as NotificationChannelConfig);

      console.log('✅ Notification channels created successfully');

    } catch (error) {
      console.error('❌ Failed to setup notification channels:', error);
      
      // Fallback: Use basic notification setup without custom sounds
      console.log('⚠️ Falling back to basic notifications');
    }
  }

  // ========================================
  // 🔐 PERMISSIONS
  // ========================================

  private async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              'Notifications Required',
              'GLT needs notification permissions to send you important package updates.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Settings', onPress: () => {/* Open settings */} }
              ]
            );
            return false;
          }
        }
      }

      // Request Firebase messaging permissions
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('🔥 Firebase messaging permissions denied');
        return false;
      }

      console.log('✅ FCM permissions granted');
      return true;

    } catch (error) {
      console.error('❌ Permission request failed:', error);
      return false;
    }
  }

  // ========================================
  // 🔑 TOKEN MANAGEMENT
  // ========================================

  private async getAndRegisterToken(): Promise<string> {
    try {
      // Get FCM token
      const token = await messaging().getToken();
      
      if (!token) {
        throw new Error('Failed to get FCM token');
      }

      this.token = token;
      console.log('🔥 FCM Token received:', token.substring(0, 50) + '...');

      // Register with backend
      await this.registerTokenWithBackend(token);

      // Store locally
      await AsyncStorage.setItem('fcm_token', token);
      
      return token;

    } catch (error) {
      console.error('❌ Token registration failed:', error);
      throw error;
    }
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      console.log('🔥 Registering FCM token with backend...');
      
      const tokenData: FCMTokenRegistrationData = {
        push_token: token,
        platform: 'fcm',
        device_info: {
          platform: Platform.OS,
          version: Platform.Version,
          model: 'Unknown', // Can be enhanced with device info
        }
      };

      const response = await api.post('/api/v1/push_tokens', tokenData);

      if (response.data?.success) {
        console.log('✅ FCM token registered successfully');
      } else {
        console.error('❌ Backend rejected FCM token registration');
      }

    } catch (error) {
      console.error('❌ Backend token registration failed:', error);
      // Don't throw - token can still work for direct Firebase sends
    }
  }

  // ========================================
  // 🔄 TOKEN REFRESH
  // ========================================

  private setupTokenRefreshListener(): () => void {
    return messaging().onTokenRefresh(async (token: string) => {
      try {
        console.log('🔄 FCM token refreshed');
        this.token = token;
        
        // Update backend with new token
        await this.registerTokenWithBackend(token);
        
        // Update local storage
        await AsyncStorage.setItem('fcm_token', token);
        
      } catch (error) {
        console.error('❌ Token refresh handling failed:', error);
      }
    });
  }

  // ========================================
  // 📨 MESSAGE HANDLING
  // ========================================

  private setupMessageListeners(): void {
    // Foreground message listener
    this.foregroundListener = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('🔥 Foreground FCM message received:', remoteMessage);
      
      // Handle foreground notification
      this.handleForegroundMessage(remoteMessage);
    });

    // Notification opened app listener
    messaging().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('🔥 Notification opened app:', remoteMessage);
      
      // Handle notification tap
      this.handleNotificationTap(remoteMessage);
    });

    // Check if app was opened from notification (killed state)
    messaging()
      .getInitialNotification()
      .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
        if (remoteMessage) {
          console.log('🔥 App opened from notification (killed state):', remoteMessage);
          this.handleNotificationTap(remoteMessage);
        }
      });
  }

  private setupBackgroundHandler(): void {
    messaging().setBackgroundMessageHandler(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('🔥 Background message handled by FCM:', remoteMessage);
      
      // Process background notification
      // Update badge count, store notification, etc.
      try {
        // Store notification for later display
        const notifications = await AsyncStorage.getItem('pending_notifications') || '[]';
        const notificationsList: PendingNotification[] = JSON.parse(notifications);
        
        const pendingNotification: PendingNotification = {
          id: remoteMessage.messageId || Date.now().toString(),
          title: remoteMessage.notification?.title,
          body: remoteMessage.notification?.body,
          data: remoteMessage.data,
          receivedAt: Date.now()
        };
        
        notificationsList.push(pendingNotification);
        
        await AsyncStorage.setItem('pending_notifications', JSON.stringify(notificationsList));
        
      } catch (error) {
        console.error('❌ Background message processing failed:', error);
      }
    });
  }

  // ========================================
  // 🎯 MESSAGE HANDLERS
  // ========================================

  private handleForegroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    // Show in-app notification or update UI
    const { notification, data } = remoteMessage;
    
    // Determine sound based on priority/type
    const soundType = this.getSoundType(data?.priority || data?.type);
    
    // You can integrate with your existing notification display system
    // For example, show a toast or update notification count
    if (notification) {
      console.log('📱 Showing foreground notification:', notification.title);
      console.log('🔊 Using sound type:', soundType);
      
      // Example: Show alert (replace with your notification system)
      Alert.alert(
        notification.title || 'GLT Notification',
        notification.body || 'You have a new update',
        [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'View', onPress: () => this.handleNotificationTap(remoteMessage) }
        ]
      );
    }
  }

  private handleNotificationTap(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    // Navigate based on notification data
    const { data } = remoteMessage;
    
    try {
      if (data?.type === 'package_update' && data?.package_id) {
        // Navigate to package details
        // NavigationHelper.navigateTo('/(drawer)/track', { params: { id: data.package_id }});
        console.log('🔥 Navigate to package:', data.package_id);
        
      } else if (data?.type === 'general') {
        // Navigate to notifications screen
        // NavigationHelper.navigateTo('/(drawer)/notifications');
        console.log('🔥 Navigate to notifications');
        
      } else {
        // Default navigation
        console.log('🔥 Default notification navigation');
      }
      
    } catch (error) {
      console.error('❌ Notification navigation failed:', error);
    }
  }

  // ========================================
  // 🔊 SOUND MANAGEMENT
  // ========================================

  private getSoundType(priority?: string): SoundFile {
    // Map notification priority/type to sound files
    if (typeof priority === 'string') {
      switch (priority.toLowerCase()) {
        case 'urgent':
        case 'critical':
        case 'emergency':
          return 'notification_urgent';
        case 'high':
        case 'important':
          return 'notification_high';
        case 'normal':
        case 'low':
        default:
          return 'notification_sound';
      }
    }
    
    return 'notification_sound'; // Default
  }

  private getChannelIdForPriority(priority?: string): ChannelId {
    // Map priority to notification channels
    if (typeof priority === 'string') {
      switch (priority.toLowerCase()) {
        case 'urgent':
        case 'critical':
        case 'emergency':
          return 'urgent';
        case 'high':
        case 'important':
          return 'high';
        case 'normal':
        case 'low':
        default:
          return 'default';
      }
    }
    
    return 'default';
  }

  // ========================================
  // 🛠️ UTILITY METHODS
  // ========================================

  async getToken(): Promise<string | null> {
    if (this.token) {
      return this.token;
    }
    
    try {
      const token = await messaging().getToken();
      this.token = token;
      return token;
    } catch (error) {
      console.error('❌ Failed to get FCM token:', error);
      return null;
    }
  }

  async getBadgeCount(): Promise<number> {
    try {
      // Get unread notification count from your API
      const response = await api.get('/api/v1/notifications/unread_count');
      return (response as ApiResponse).data?.count || 0;
    } catch (error) {
      console.error('❌ Failed to get badge count:', error);
      return 0;
    }
  }

  async clearBadge(): Promise<void> {
    try {
      // Clear app badge
      if (Platform.OS === 'ios') {
        // iOS badge clearing would go here
        // PushNotificationIOS.setApplicationIconBadgeNumber(0);
      }
    } catch (error) {
      console.error('❌ Failed to clear badge:', error);
    }
  }

  // ========================================
  // 🧹 CLEANUP
  // ========================================

  cleanup(): void {
    if (this.foregroundListener) {
      this.foregroundListener();
    }
    
    console.log('🔥 FCM Service cleaned up');
  }

  // ========================================
  // 🔍 GETTERS
  // ========================================

  get initialized(): boolean {
    return this.isInitialized;
  }

  get currentToken(): string | null {
    return this.token;
  }
}

// Export singleton instance
export const firebaseFCMService = new FirebaseFCMService();
export default firebaseFCMService;

// Export types for use in other files
export type { NotificationPriority, ChannelId, SoundFile, PendingNotification };
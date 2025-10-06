// app/(rider)/index.tsx - Fixed version
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Image,
  Switch,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RiderBottomTabs } from '../../components/rider/RiderBottomTabs';
import { useUser } from '../../context/UserContext';
import QRScanner from '../../components/QRScanner';
import api from '../../lib/api';
import firebase from '../../config/firebase';
import ActionCableService from '../../lib/services/ActionCableService';
import { accountManager } from '../../lib/AccountManager';
import { NavigationHelper } from '../../lib/helpers/navigation';

const HEADER_MAX_HEIGHT = 400;
const HEADER_MIN_HEIGHT = 90;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

type ReportIssue = 'mechanical' | 'weather' | 'fuel' | 'accident' | 'other';

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  onClose?: () => void;
}

const CustomModal: React.FC<CustomModalProps> = ({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK', style: 'default' }],
  onClose,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'x-circle';
      case 'warning': return 'alert-triangle';
      default: return 'info';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#8b5cf6';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <LinearGradient
            colors={['#2d1b4e', '#1a1b3d']}
            style={modalStyles.gradient}
          >
            <View style={modalStyles.iconContainer}>
              <View style={[modalStyles.iconCircle, { backgroundColor: getIconColor() + '20' }]}>
                <Feather name={getIcon()} size={32} color={getIconColor()} />
              </View>
            </View>

            <Text style={modalStyles.title}>{title}</Text>
            <Text style={modalStyles.message}>{message}</Text>

            <View style={modalStyles.buttonContainer}>
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    modalStyles.button,
                    button.style === 'cancel' && modalStyles.cancelButton,
                    button.style === 'destructive' && modalStyles.destructiveButton,
                  ]}
                  onPress={() => {
                    button.onPress?.();
                    onClose?.();
                  }}
                >
                  <Text
                    style={[
                      modalStyles.buttonText,
                      button.style === 'cancel' && modalStyles.cancelButtonText,
                      button.style === 'destructive' && modalStyles.destructiveButtonText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

export default function RiderHomeScreen() {
  const { user } = useUser();
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<ReportIssue | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerAction, setScannerAction] = useState<string>('');
  
  const [isOnline, setIsOnline] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const locationInterval = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const actionCableRef = useRef<ActionCableService | null>(null);
  const subscriptionsSetup = useRef(false);
  const actionCableSubscriptions = useRef<Array<() => void>>([]);

  const [fcmToken, setFcmToken] = useState<string>('');
  const unsubscribeOnMessage = useRef<(() => void) | null>(null);
  const unsubscribeOnNotificationOpenedApp = useRef<(() => void) | null>(null);
  const unsubscribeTokenRefresh = useRef<(() => void) | null>(null);

  const [customModal, setCustomModal] = useState<CustomModalProps>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: 'clamp',
  });

  const companyNameOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const avatarSize = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [120, 50],
    extrapolate: 'clamp',
  });

  const avatarTranslateX = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 120],
    extrapolate: 'clamp',
  });

  const nameTranslateX = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -80],
    extrapolate: 'clamp',
  });

  const contentOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });

  const recentOrders = [
    { id: 1, status: 'In Transit', location: 'Lekki Phase 1', tracking: 'GLT-12345' },
    { id: 2, status: 'Delivered', location: 'Victoria Island', tracking: 'GLT-12344' },
  ];

  const issueOptions = [
    { key: 'mechanical' as ReportIssue, label: 'Mechanical Problems', icon: 'tool' },
    { key: 'weather' as ReportIssue, label: 'Bad Weather', icon: 'cloud-rain' },
    { key: 'fuel' as ReportIssue, label: 'Low Fuel', icon: 'droplet' },
    { key: 'accident' as ReportIssue, label: 'Accident', icon: 'alert-triangle' },
  ];

  const showCustomModal = (config: Omit<CustomModalProps, 'visible'>) => {
    setCustomModal({
      ...config,
      visible: true,
      onClose: () => setCustomModal(prev => ({ ...prev, visible: false })),
    });
  };

  useEffect(() => {
    checkLocationPermission();
    setupActionCable();
    setupFirebaseMessaging();
    
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
      
      subscriptionsSetup.current = false;
      actionCableSubscriptions.current.forEach(unsub => unsub());
      actionCableSubscriptions.current = [];
      
      if (unsubscribeOnMessage.current) unsubscribeOnMessage.current();
      if (unsubscribeOnNotificationOpenedApp.current) unsubscribeOnNotificationOpenedApp.current();
      if (unsubscribeTokenRefresh.current) unsubscribeTokenRefresh.current();
    };
  }, []);

  const setupActionCable = useCallback(async () => {
    if (!user || subscriptionsSetup.current) return;

    try {
      const currentAccount = accountManager.getCurrentAccount();
      if (!currentAccount) return;

      actionCableRef.current = ActionCableService.getInstance();
      
      const connected = await actionCableRef.current.connect({
        token: currentAccount.token,
        userId: currentAccount.id,
        autoReconnect: true,
      });

      if (connected) {
        setIsConnected(true);
        setupSubscriptions();
        subscriptionsSetup.current = true;
      }
    } catch (error) {
      console.error('Failed to setup ActionCable:', error);
      setIsConnected(false);
    }
  }, [user]);

  const setupSubscriptions = () => {
    if (!actionCableRef.current) return;

    actionCableSubscriptions.current.forEach(unsub => unsub());
    actionCableSubscriptions.current = [];

    const actionCable = actionCableRef.current;

    const unsubConnected = actionCable.subscribe('connection_established', () => {
      setIsConnected(true);
    });
    actionCableSubscriptions.current.push(unsubConnected);

    const unsubLost = actionCable.subscribe('connection_lost', () => {
      setIsConnected(false);
    });
    actionCableSubscriptions.current.push(unsubLost);
  };

  const setupFirebaseMessaging = async () => {
    try {
      if (!firebase.isNative || !firebase.messaging()) {
        return;
      }

      const permissionGranted = await requestFirebasePermissions();
      if (!permissionGranted) return;

      await getFirebaseToken();
      setupFirebaseListeners();
      handleInitialNotification();
    } catch (error) {
      console.error('Firebase setup failed:', error);
    }
  };

  const requestFirebasePermissions = async (): Promise<boolean> => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return false;
      
      const authStatus = await messaging.requestPermission();
      const enabled = authStatus === 1 || authStatus === 2;

      if (enabled) {
        return true;
      } else {
        showCustomModal({
          title: 'Notifications Required',
          message: 'GLT needs notification permissions to send you important delivery updates.',
          type: 'warning',
          buttons: [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ],
        });
        return false;
      }
    } catch (error) {
      console.error('Firebase permissions error:', error);
      return false;
    }
  };

  const getFirebaseToken = async () => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return;
      
      const token = await messaging.getToken();
      setFcmToken(token);

      await registerFCMTokenWithBackend(token);
      
      unsubscribeTokenRefresh.current = messaging.onTokenRefresh(async (newToken) => {
        setFcmToken(newToken);
        await registerFCMTokenWithBackend(newToken);
      });
    } catch (error) {
      console.error('FCM token error:', error);
    }
  };

  const registerFCMTokenWithBackend = async (token: string) => {
    try {
      const response = await api.post('/api/v1/push_tokens', {
        push_token: token,
        platform: 'fcm',
        device_info: {
          platform: Platform.OS,
          version: Platform.Version,
          isDevice: true,
          deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
        }
      });
      
      if (response.data?.success) {
        await AsyncStorage.setItem('fcm_token', token);
        await AsyncStorage.setItem('fcm_token_registered', 'true');
      }
    } catch (error) {
      console.error('FCM token registration failed:', error);
    }
  };

  const setupFirebaseListeners = () => {
    const messaging = firebase.messaging();
    if (!messaging) return;

    unsubscribeOnMessage.current = messaging.onMessage(async (remoteMessage) => {
      if (remoteMessage.notification?.title && remoteMessage.notification?.body) {
        showCustomModal({
          title: remoteMessage.notification.title,
          message: remoteMessage.notification.body,
          type: 'info',
          buttons: [
            { text: 'Dismiss', style: 'cancel' },
            { text: 'View', onPress: () => handleNotificationData(remoteMessage.data) },
          ],
        });
      }
    });

    unsubscribeOnNotificationOpenedApp.current = messaging.onNotificationOpenedApp((remoteMessage) => {
      handleNotificationData(remoteMessage.data);
    });
  };

  const handleInitialNotification = async () => {
    try {
      const messaging = firebase.messaging();
      if (!messaging) return;

      const initialNotification = await messaging.getInitialNotification();
      
      if (initialNotification) {
        setTimeout(() => {
          handleNotificationData(initialNotification.data);
        }, 2000);
      }
    } catch (error) {
      console.error('Initial notification error:', error);
    }
  };

  const handleNotificationData = async (data: any) => {
    try {
      if (data?.type === 'package_update' && data?.package_id) {
        await NavigationHelper.navigateTo('/(drawer)/track', {
          params: { packageId: data.package_id },
          trackInHistory: true
        });
      } else if (data?.package_code) {
        await NavigationHelper.navigateTo('/(drawer)/track', {
          params: { code: data.package_code },
          trackInHistory: true
        });
      }
    } catch (error) {
      console.error('Notification handling error:', error);
    }
  };

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationPermission(true);
      return true;
    } else {
      showCustomModal({
        title: 'Location Required',
        message: 'Location permission is needed to go online and receive delivery assignments.',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
        ],
      });
      return false;
    }
  };

  const startLocationBroadcast = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);

      await api.post('/api/v1/riders/location', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      });

      locationInterval.current = setInterval(async () => {
        try {
          const newLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentLocation(newLocation);

          await api.post('/api/v1/riders/location', {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy,
            heading: newLocation.coords.heading,
            speed: newLocation.coords.speed,
            timestamp: newLocation.timestamp,
          });
        } catch (error) {
          console.error('Failed to update location:', error);
        }
      }, 30000);

    } catch (error) {
      console.error('Failed to start location broadcast:', error);
      showCustomModal({
        title: 'Error',
        message: 'Failed to start location tracking',
        type: 'error',
      });
      setIsOnline(false);
    }
  };

  const stopLocationBroadcast = async () => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }

    try {
      await api.post('/api/v1/riders/offline');
    } catch (error) {
      console.error('Failed to update offline status:', error);
    }

    setCurrentLocation(null);
  };

  const handleOnlineToggle = async (value: boolean) => {
    if (value) {
      if (!locationPermission) {
        const granted = await requestLocationPermission();
        if (!granted) return;
      }

      try {
        await startLocationBroadcast();
        
        if (actionCableRef.current && isConnected) {
          await actionCableRef.current.updatePresence('online');
        }
        
        setIsOnline(true);
        showCustomModal({
          title: 'Online',
          message: 'You are now online and ready to receive deliveries',
          type: 'success',
        });
      } catch (error) {
        showCustomModal({
          title: 'Error',
          message: 'Failed to go online',
          type: 'error',
        });
        setIsOnline(false);
      }
    } else {
      await stopLocationBroadcast();
      
      if (actionCableRef.current && isConnected) {
        await actionCableRef.current.updatePresence('offline');
      }
      
      setIsOnline(false);
      showCustomModal({
        title: 'Offline',
        message: 'You are now offline and will not receive new deliveries',
        type: 'info',
      });
    }
  };

  const handleScanAction = (action: string) => {
    setScannerAction(action);
    setShowScanner(true);
  };

  const handleScanSuccess = (result: any) => {
    setShowScanner(false);
    setScannerAction('');
  };

  const handleSubmitReport = async () => {
    if (!selectedIssue) {
      showCustomModal({
        title: 'Error',
        message: 'Please select an issue type',
        type: 'error',
      });
      return;
    }

    if (selectedIssue === 'mechanical' && !issueDescription.trim()) {
      showCustomModal({
        title: 'Error',
        message: 'Please describe the issue',
        type: 'error',
      });
      return;
    }

    setSubmittingReport(true);

    try {
      await api.post('/api/v1/riders/reports', {
        issue_type: selectedIssue,
        description: issueDescription.trim() || selectedIssue,
        location: currentLocation ? {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        } : null,
      });

      showCustomModal({
        title: 'Success',
        message: 'Issue reported successfully. Support will contact you shortly.',
        type: 'success',
      });
      setShowReportModal(false);
      setSelectedIssue(null);
      setIssueDescription('');
    } catch (error) {
      console.error('Failed to submit report:', error);
      showCustomModal({
        title: 'Error',
        message: 'Failed to submit report. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.headerContainer, { height: headerHeight }]}>
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <Animated.Text style={[styles.companyName, { opacity: companyNameOpacity }]}>
            GLT Logistics
          </Animated.Text>

          <View style={styles.headerContent}>
            <Animated.View style={[styles.avatarContainer, { 
              transform: [{ translateX: avatarTranslateX }]
            }]}>
              <Animated.Image
                source={
                  user?.avatar_url
                    ? { uri: user.avatar_url }
                    : require('../../assets/images/avatar_placeholder.png')
                }
                style={[styles.headerAvatar, {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: scrollY.interpolate({
                    inputRange: [0, HEADER_SCROLL_DISTANCE],
                    outputRange: [60, 25],
                    extrapolate: 'clamp',
                  }),
                }]}
              />
            </Animated.View>

            <Animated.View style={[styles.nameContainer, {
              transform: [{ translateX: nameTranslateX }],
              opacity: contentOpacity,
            }]}>
              <Text style={styles.welcomeText}>Welcome,</Text>
              <Text style={styles.userName}>
                {user?.display_name || user?.first_name || 'Kanana Joy'}
              </Text>
              <Text style={styles.userSubtext}>Here are your packages today.</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.onlineToggleContainer, { opacity: contentOpacity }]}>
            <View style={styles.onlineToggle}>
              <View style={styles.onlineToggleContent}>
                <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#8E8E93' }]} />
                <Text style={styles.onlineToggleLabel}>
                  {isOnline ? 'online' : 'offline'}
                </Text>
              </View>
              <Switch
                value={isOnline}
                onValueChange={handleOnlineToggle}
                trackColor={{ false: '#3E3E3E', true: '#4CAF50' }}
                thumbColor={isOnline ? '#fff' : '#f4f3f4'}
                ios_backgroundColor="#3E3E3E"
                style={styles.switch}
              />
            </View>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => handleScanAction('collect')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#7B3F9820' }]}>
                <Feather name="camera" size={24} color="#7B3F98" />
              </View>
              <Text style={styles.actionText}>Scan Package</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#FF980020' }]}>
                <Feather name="clock" size={24} color="#FF9800" />
              </View>
              <Text style={styles.actionText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Deliveries</Text>
          {recentOrders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderCard}>
              <View style={styles.orderIcon}>
                <Feather name="package" size={20} color="#7B3F98" />
              </View>
              <View style={styles.orderContent}>
                <Text style={styles.orderTracking}>{order.tracking}</Text>
                <Text style={styles.orderLocation}>{order.location}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: order.status === 'Delivered' ? '#4CAF50' : '#FF9800' }
              ]}>
                <Text style={styles.statusText}>{order.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.reportCard}
          onPress={() => setShowReportModal(true)}
        >
          <LinearGradient
            colors={['#7B3F98', '#5A2D82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.reportGradient}
          >
            <Feather name="alert-circle" size={32} color="#fff" />
            <View style={styles.reportContent}>
              <Text style={styles.reportTitle}>Need Help?</Text>
              <Text style={styles.reportText}>Report delivery issues or problems</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.ScrollView>

      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report</Text>
              <Text style={styles.modalSubtitle}>Latest update</Text>
              <TouchableOpacity 
                style={styles.modalClose}
                onPress={() => setShowReportModal(false)}
              >
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {issueOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.issueOption,
                    selectedIssue === option.key && styles.issueOptionSelected
                  ]}
                  onPress={() => setSelectedIssue(option.key)}
                >
                  <View style={styles.radioOuter}>
                    {selectedIssue === option.key && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.issueOptionText,
                    selectedIssue === option.key && styles.issueOptionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TextInput
                style={styles.issueInput}
                placeholder={selectedIssue ? selectedIssue.charAt(0).toUpperCase() + selectedIssue.slice(1) : "Describe the issue"}
                placeholderTextColor="#8E8E93"
                multiline
                numberOfLines={4}
                value={issueDescription}
                onChangeText={setIssueDescription}
              />

              <TouchableOpacity
                style={[styles.submitButton, submittingReport && styles.submitButtonDisabled]}
                onPress={handleSubmitReport}
                disabled={submittingReport}
              >
                <Text style={styles.submitButtonText}>
                  {submittingReport ? 'SUBMITTING...' : 'REPORT'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <QRScanner
        visible={showScanner}
        onClose={() => {
          setShowScanner(false);
          setScannerAction('');
        }}
        userRole="rider"
        defaultAction={scannerAction || undefined}
        onScanSuccess={handleScanSuccess}
      />

      <CustomModal {...customModal} />

      <RiderBottomTabs currentTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 58 : 28,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companyName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerAvatar: {
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  userName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '400',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  headerGreeting: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  headerName: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 4,
  },
  headerTagline: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '400',
  },
  headerRight: {
    marginLeft: 12,
  },
  onlineToggleContainer: {
    width: '100%',
    alignItems: 'center',
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 150,
  },
  onlineToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  onlineToggleLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: HEADER_MAX_HEIGHT + 16,
    paddingBottom: 100,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  orderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderContent: {
    flex: 1,
  },
  orderTracking: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderLocation: {
    color: '#8E8E93',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  reportCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  reportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reportText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#4A5568',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },
  modalClose: {
    position: 'absolute',
    right: 24,
    top: 0,
  },
  modalBody: {
    padding: 24,
  },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D3748',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  issueOptionSelected: {
    backgroundColor: 'rgba(123, 63, 152, 0.2)',
    borderColor: '#7B3F98',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8E8E93',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7B3F98',
  },
  issueOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  issueOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  issueInput: {
    backgroundColor: '#2D3748',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginTop: 12,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#FFB000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  destructiveButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#c4b5fd',
  },
  destructiveButtonText: {
    color: '#fff',
  },
});
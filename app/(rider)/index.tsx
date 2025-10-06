// app/(rider)/index.tsx - Updated with collapsing header and online toggle
import React, { useState, useRef, useEffect } from 'react';
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
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { RiderBottomTabs } from '../../components/rider/RiderBottomTabs';
import { useUser } from '../../context/UserContext';
import QRScanner from '../../components/QRScanner';
import api from '../../lib/api';

const HEADER_MAX_HEIGHT = 180;
const HEADER_MIN_HEIGHT = 90;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

type ReportIssue = 'mechanical' | 'weather' | 'fuel' | 'accident' | 'other';

export default function RiderHomeScreen() {
  const { user } = useUser();
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<ReportIssue | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerAction, setScannerAction] = useState<string>('');
  
  // Online toggle state
  const [isOnline, setIsOnline] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const locationInterval = useRef<NodeJS.Timeout | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.8],
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

  useEffect(() => {
    checkLocationPermission();
    
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
    };
  }, []);

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
      Alert.alert(
        'Location Required',
        'Location permission is needed to go online and receive delivery assignments.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
        ]
      );
      return false;
    }
  };

  const startLocationBroadcast = async () => {
    try {
      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);

      // Broadcast to server
      await api.post('/api/v1/riders/location', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      });

      // Start periodic updates (every 30 seconds)
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
      Alert.alert('Error', 'Failed to start location tracking');
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
      // Going online
      if (!locationPermission) {
        const granted = await requestLocationPermission();
        if (!granted) return;
      }

      try {
        await startLocationBroadcast();
        setIsOnline(true);
        Alert.alert('Online', 'You are now online and ready to receive deliveries');
      } catch (error) {
        Alert.alert('Error', 'Failed to go online');
        setIsOnline(false);
      }
    } else {
      // Going offline
      await stopLocationBroadcast();
      setIsOnline(false);
      Alert.alert('Offline', 'You are now offline and will not receive new deliveries');
    }
  };

  const handleScanAction = (action: string) => {
    setScannerAction(action);
    setShowScanner(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedIssue) {
      Alert.alert('Error', 'Please select an issue type');
      return;
    }

    if (selectedIssue === 'mechanical' && !issueDescription.trim()) {
      Alert.alert('Error', 'Please describe the issue');
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

      Alert.alert('Success', 'Issue reported successfully. Support will contact you shortly.');
      setShowReportModal(false);
      setSelectedIssue(null);
      setIssueDescription('');
    } catch (error) {
      console.error('Failed to submit report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.headerContainer, { height: headerHeight }]}>
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <Animated.View style={[styles.headerLeft, { opacity: headerOpacity, transform: [{ scale: titleScale }] }]}>
              <Text style={styles.headerGreeting}>Welcome back,</Text>
              <Text style={styles.headerName}>
                {user?.display_name || user?.first_name || 'Rider'}
              </Text>
              <Text style={styles.headerTagline}>
                Ready to deliver excellence today
              </Text>
            </Animated.View>

            <View style={styles.headerRight}>
              <Image
                source={
                  user?.avatar_url
                    ? { uri: user.avatar_url }
                    : require('../../assets/images/avatar_placeholder.png')
                }
                style={styles.headerAvatar}
              />
            </View>
          </View>

          {/* Online Toggle */}
          <Animated.View style={[styles.onlineToggleContainer, { opacity: headerOpacity }]}>
            <View style={styles.onlineToggle}>
              <View style={styles.onlineToggleLeft}>
                <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#8E8E93' }]} />
                <Text style={styles.onlineToggleLabel}>
                  {isOnline ? 'Online - Accepting Orders' : 'Offline'}
                </Text>
              </View>
              <Switch
                value={isOnline}
                onValueChange={handleOnlineToggle}
                trackColor={{ false: '#3E3E3E', true: '#4CAF50' }}
                thumbColor={isOnline ? '#fff' : '#f4f3f4'}
                ios_backgroundColor="#3E3E3E"
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
        {/* Quick Actions */}
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

        {/* Recent Orders */}
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

        {/* Report Issues Card */}
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

      {/* Report Issues Modal */}
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

      {/* QR Scanner */}
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        userRole="rider"
        defaultAction={scannerAction}
        onScanSuccess={(result) => {
          console.log('Scan result:', result);
          setShowScanner(false);
        }}
      />

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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
    fontSize: 28,
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
  headerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  onlineToggleContainer: {
    marginTop: 8,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  onlineToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  onlineToggleLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
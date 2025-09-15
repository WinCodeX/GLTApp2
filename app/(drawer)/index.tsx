// app/(drawer)/index.tsx - Fixed HomeScreen with proper navigation system integration
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Animated,
  ScrollView,
  Dimensions,
  Easing,
  Alert,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import GLTHeader from '../../components/GLTHeader';
import PackageCreationModal from '../../components/PackageCreationModal';
import FragileDeliveryModal from '../../components/FragileDeliveryModal';
import CollectDeliverModal from '../../components/CollectDeliverModal';
import ChangelogModal, { CHANGELOG_VERSION, CHANGELOG_KEY } from '../../components/ChangelogModal';
import UpdateModal from '../../components/UpdateModal';
import { createPackage, type PackageData, getPackageFormData, calculatePackagePricing, getAreas, getAgents } from '../../lib/helpers/packageHelpers';
import { useUser } from '../../context/UserContext';
import UpdateService from '../../lib/services/updateService';
// FIXED: Import navigation system
import { NavigationHelper, useNavigation } from '../../lib/helpers/navigation';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Default locations that show immediately (no loading delay)
const DEFAULT_LOCATIONS = [
  { id: 'nairobi', name: 'Nairobi' },
  { id: 'mombasa', name: 'Mombasa' },
  { id: 'kisumu', name: 'Kisumu' },
  { id: 'nakuru', name: 'Nakuru' },
  { id: 'eldoret', name: 'Eldoret' },
  { id: 'thika', name: 'Thika' },
  { id: 'machakos', name: 'Machakos' },
  { id: 'kisii', name: 'Kisii' },
];

interface Location {
  id: string;
  name: string;
  initials?: string;
}

interface Area {
  id: string;
  name: string;
  location_id?: string;
  location?: Location;
  initials?: string;
}

interface Agent {
  id: string;
  name: string;
  phone: string;
  area_id: string;
  area?: Area;
}

interface PackageSize {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface PricingResult {
  fragile: number;
  home: number;
  office: number;
  collection: number;
}

interface FABOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  backgroundColor: string;
  glowColor: string;
  action: () => void;
  infoAction: () => void;
}

interface DeliveryInfo {
  title: string;
  description: string;
}

interface PackageSizeInfo {
  title: string;
  description: string;
  deliveryOptions: string[];
}

interface SuccessModalData {
  title: string;
  message: string;
  trackingNumber: string;
  status: string;
  color: string;
  icon: string;
}

interface SelectedLocation {
  id: string;
  name: string;
  type: 'area' | 'office';
  locationName?: string;
  agentName?: string;
  phone?: string;
}

interface UpdateMetadata {
  available: boolean;
  version?: string;
  changelog?: string[];
  release_date?: string;
  force_update?: boolean;
  download_url?: string;
  file_size?: number;
}

const PACKAGE_SIZES: PackageSize[] = [
  {
    id: 'small',
    name: 'Small Package',
    description: 'Documents, accessories, small items',
    icon: 'mail'
  },
  {
    id: 'medium',
    name: 'Medium Package',
    description: 'Books, clothes, electronics',
    icon: 'box'
  },
  {
    id: 'large',
    name: 'Large Package',
    description: 'Bulky items, furniture parts',
    icon: 'truck'
  }
];

const DELIVERY_INFO: Record<string, DeliveryInfo> = {
  fragile: {
    title: 'Fragile Items',
    description: 'We have a dedicated delivery service for items that require extra care which will be prioritised & sent out immediately. Please select your current location and the rider will come collect the package and send it to where it\'s supposed to go.'
  },
  send: {
    title: 'Send a Package',
    description: 'There are 2 options - Home and Office. The Home option will have the item delivered right to their location while the Office option will be delivered to our office for the receiver to collect.'
  },
  collect: {
    title: 'Collect my Packages',
    description: 'This is where we collect your packages after you\'ve made an order and then dispatch it. Payment needs to be paid in advance.'
  }
};

const PACKAGE_SIZE_INFO: Record<string, PackageSizeInfo> = {
  small: {
    title: 'Small Package',
    description: 'Perfect for documents, accessories, and small items. These packages can be sent via both delivery options.',
    deliveryOptions: ['Home Delivery - Direct to recipient address', 'Office Delivery - Collect from our office']
  },
  medium: {
    title: 'Medium Package',
    description: 'Ideal for books, clothes, and electronics. These packages can be sent via both delivery options.',
    deliveryOptions: ['Home Delivery - Direct to recipient address', 'Office Delivery - Collect from our office']
  },
  large: {
    title: 'Large Package',
    description: 'For bulky items and furniture parts. Large packages can only be sent via Home Delivery and must not exceed our stipulated size limits.',
    deliveryOptions: ['Home Delivery - Direct to recipient address (Only option for large packages)']
  }
};

// FIXED: Area Selection Modal Component with Keyboard Handling
const AreaSelectionModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: SelectedLocation) => void;
  title: string;
  type: 'origin' | 'destination';
}> = ({ visible, onClose, onSelect, title, type }) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'areas' | 'offices'>('all');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    if (visible) {
      loadLocationData();
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // FIXED: Add keyboard listeners
      const keyboardWillShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      const keyboardWillHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });

      return () => {
        keyboardWillShowListener?.remove();
        keyboardWillHideListener?.remove();
      };
    }
  }, [visible]);

  const loadLocationData = async () => {
    try {
      setIsLoading(true);
      const [areasData, agentsData] = await Promise.all([
        getAreas(),
        getAgents()
      ]);
      setAreas(areasData);
      setAgents(agentsData);
    } catch (error) {
      console.error('Failed to load location data:', error);
      Alert.alert('Error', 'Failed to load locations');
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      setSearchQuery('');
      setSelectedFilter('all');
      setKeyboardHeight(0);
    });
  };

  const filteredAreas = areas.filter(area => {
    if (selectedFilter === 'offices') return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return area.name.toLowerCase().includes(query) ||
           area.location?.name.toLowerCase().includes(query);
  });

  const filteredAgents = agents.filter(agent => {
    if (selectedFilter === 'areas') return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return agent.name.toLowerCase().includes(query) ||
           agent.area?.name.toLowerCase().includes(query) ||
           agent.area?.location?.name.toLowerCase().includes(query);
  });

  const handleAreaSelect = (area: Area) => {
    const selection: SelectedLocation = {
      id: area.id,
      name: area.name,
      type: 'area',
      locationName: area.location?.name
    };
    onSelect(selection);
    closeModal();
  };

  const handleAgentSelect = (agent: Agent) => {
    const selection: SelectedLocation = {
      id: agent.area_id,
      name: agent.area?.name || 'Unknown Area',
      type: 'office',
      locationName: agent.area?.location?.name,
      agentName: agent.name,
      phone: agent.phone
    };
    onSelect(selection);
    closeModal();
  };

  const renderAreaItem = ({ item }: { item: Area }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleAreaSelect(item)}
    >
      <View style={styles.locationIcon}>
        <Text style={styles.locationInitials}>
          {item.initials || item.name.substring(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{item.name}</Text>
        <Text style={styles.locationAddress}>{item.location?.name}</Text>
        <Text style={styles.locationDescription}>Area</Text>
      </View>
      <View style={styles.areaTypeTag}>
        <Text style={styles.areaTypeText}>AREA</Text>
      </View>
    </TouchableOpacity>
  );

  const renderAgentItem = ({ item }: { item: Agent }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleAgentSelect(item)}
    >
      <View style={styles.locationIcon}>
        <Text style={styles.locationInitials}>
          {item.name.substring(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{item.name}</Text>
        <Text style={styles.locationAddress}>{item.area?.name} • {item.area?.location?.name}</Text>
        <Text style={styles.locationDescription}>Office • {item.phone}</Text>
      </View>
      <View style={styles.officeTypeTag}>
        <Text style={styles.officeTypeText}>OFFICE</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <Animated.View
            style={[
              styles.areaModalContainer,
              { 
                transform: [{ translateY: slideAnim }],
                marginBottom: keyboardHeight > 0 ? keyboardHeight - 50 : 0,
                height: keyboardHeight > 0 ? screenHeight * 0.6 : screenHeight * 0.85,
              }
            ]}
          >
            <LinearGradient
              colors={['#1a1a2e', '#2d3748', '#4a5568']}
              style={styles.areaModalContent}
            >
              <View style={styles.areaModalHeader}>
                <TouchableOpacity onPress={closeModal} style={styles.modalCloseButton}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.areaModalTitle}>{title}</Text>
                <View style={styles.placeholder} />
              </View>
              
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search areas or offices..."
                  placeholderTextColor="#888"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  returnKeyType="search"
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.filterContainer}>
                {['all', 'areas', 'offices'].map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterButton,
                      selectedFilter === filter && styles.filterButtonActive
                    ]}
                    onPress={() => setSelectedFilter(filter as any)}
                  >
                    <Text style={[
                      styles.filterText,
                      selectedFilter === filter && styles.filterTextActive
                    ]}>
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                    <Text style={styles.loadingText}>Loading locations...</Text>
                  </View>
                ) : (
                  <View>
                    {(selectedFilter === 'all' || selectedFilter === 'areas') && filteredAreas.length > 0 && (
                      <View>
                        <Text style={styles.modalSectionTitle}>Areas ({filteredAreas.length})</Text>
                        <FlatList
                          data={filteredAreas}
                          keyExtractor={(item) => `area-${item.id}`}
                          renderItem={renderAreaItem}
                          scrollEnabled={false}
                        />
                      </View>
                    )}
                    
                    {(selectedFilter === 'all' || selectedFilter === 'offices') && filteredAgents.length > 0 && (
                      <View style={{ marginTop: selectedFilter === 'all' && filteredAreas.length > 0 ? 16 : 0 }}>
                        <Text style={styles.modalSectionTitle}>Offices ({filteredAgents.length})</Text>
                        <FlatList
                          data={filteredAgents}
                          keyExtractor={(item) => `agent-${item.id}`}
                          renderItem={renderAgentItem}
                          scrollEnabled={false}
                        />
                      </View>
                    )}
                    
                    {filteredAreas.length === 0 && filteredAgents.length === 0 && !isLoading && (
                      <View style={styles.noResults}>
                        <Feather name="search" size={48} color="#666" />
                        <Text style={styles.noResultsText}>No locations found</Text>
                        <Text style={styles.noResultsSubtext}>Try a different search term or filter</Text>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default function HomeScreen() {
  const [selectedOriginLocation, setSelectedOriginLocation] = useState<SelectedLocation | null>(null);
  const [selectedDestinationLocation, setSelectedDestinationLocation] = useState<SelectedLocation | null>(null);
  const [selectedPackageSize, setSelectedPackageSize] = useState<PackageSize | null>(null);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Data from API - starts with default locations for immediate display
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  
  // Modal states
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showFragileModal, setShowFragileModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<DeliveryInfo | null>(null);
  const [showPackageSizeInfoModal, setShowPackageSizeInfoModal] = useState(false);
  const [selectedPackageSizeInfo, setSelectedPackageSizeInfo] = useState<PackageSizeInfo | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<SuccessModalData | null>(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);

  // Update modal states
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateMetadata, setUpdateMetadata] = useState<UpdateMetadata | null>(null);
  
  // New modal states for area selection
  const [showOriginModal, setShowOriginModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  
  // FIXED: Add navigation tracking state
  const [navigationRegistered, setNavigationRegistered] = useState(false);
  
  // FIXED: Animation interaction states
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);
  const [manualScrollPosition, setManualScrollPosition] = useState(0);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    user, 
    currentAccount,
    loading: userLoading,
    error: userError,
    getDisplayName, 
    getUserPhone,
    getCurrentToken,
    getCurrentUserId,
  } = useUser();
  
  // FIXED: Use navigation hook for better integration
  const navigation = useNavigation();
  
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // FAB Menu Animations
  const fabRotation = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const optionsScale = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(100)).current;
  const successModalScale = useRef(new Animated.Value(0)).current;
  const successModalOpacity = useRef(new Animated.Value(0)).current;

  // FIXED: Register home screen with navigation system on mount
  useEffect(() => {
    const registerWithNavigationSystem = async () => {
      try {
        if (!navigationRegistered) {
          console.log('🏠 HomeScreen: Registering with navigation system...');
          
          // Ensure NavigationHelper is initialized
          await NavigationHelper.initialize();
          
          // Register this screen as the home route
          await NavigationHelper.trackRouteChange('/', {});
          
          setNavigationRegistered(true);
          console.log('✅ HomeScreen: Successfully registered with navigation system');
        }
      } catch (error) {
        console.error('❌ HomeScreen: Failed to register with navigation system:', error);
        // Continue anyway - non-critical error
        setNavigationRegistered(true);
      }
    };

    registerWithNavigationSystem();
  }, [navigationRegistered]);

  // FIXED: Re-register when screen gains focus to ensure navigation consistency
  useFocusEffect(
    useCallback(() => {
      const reRegisterOnFocus = async () => {
        try {
          console.log('🏠 HomeScreen: Screen gained focus, re-registering...');
          
          // Always track when home screen gains focus to ensure it's in navigation history
          await NavigationHelper.trackRouteChange('/', {});
          
          console.log('✅ HomeScreen: Successfully re-registered on focus');
        } catch (error) {
          console.error('❌ HomeScreen: Failed to re-register on focus:', error);
        }
      };

      reRegisterOnFocus();
    }, [])
  );

  // Initialize app with APK update system
  useEffect(() => {
    initializeApp();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Load additional data in background while showing default locations immediately
  useEffect(() => {
    loadFormDataInBackground();
  }, []);

  // FIXED: Enhanced location scrolling animation with interaction
  useEffect(() => {
    if (locations.length === 0) return;
    
    const locationTagWidth = 120;
    const singleSetWidth = locations.length * locationTagWidth;

    const startContinuousLoop = () => {
      if (isAnimationPaused) return;
      
      scrollX.setValue(manualScrollPosition);
      
      Animated.timing(scrollX, {
        toValue: manualScrollPosition - singleSetWidth,
        duration: 12000 * (1 - (manualScrollPosition / singleSetWidth)),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !isAnimationPaused) {
          setManualScrollPosition(0);
          startContinuousLoop();
        }
      });
    };

    if (!isAnimationPaused) {
      startContinuousLoop();
    }

    return () => {
      scrollX.stopAnimation();
    };
  }, [scrollX, locations, isAnimationPaused, manualScrollPosition]);

  // FIXED: Pan responder for location animation interaction
  const locationPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Stop animation when user touches
        setIsAnimationPaused(true);
        scrollX.stopAnimation((value) => {
          setManualScrollPosition(value);
        });
        
        // Clear existing timer
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        // Handle manual scrolling
        const locationTagWidth = 120;
        const singleSetWidth = locations.length * locationTagWidth;
        const newPosition = manualScrollPosition + gestureState.dx;
        
        // Keep within bounds for infinite loop
        let constrainedPosition = newPosition;
        if (newPosition > 0) {
          constrainedPosition = newPosition - singleSetWidth;
        } else if (newPosition < -singleSetWidth) {
          constrainedPosition = newPosition + singleSetWidth;
        }
        
        scrollX.setValue(constrainedPosition);
      },
      onPanResponderRelease: (_, gestureState) => {
        // Update manual position
        const locationTagWidth = 120;
        const singleSetWidth = locations.length * locationTagWidth;
        let newPosition = manualScrollPosition + gestureState.dx;
        
        // Normalize position for infinite loop
        if (newPosition > 0) {
          newPosition = newPosition - singleSetWidth;
        } else if (newPosition < -singleSetWidth) {
          newPosition = newPosition + singleSetWidth;
        }
        
        setManualScrollPosition(newPosition);
        
        // Start inactivity timer to resume animation
        inactivityTimer.current = setTimeout(() => {
          setIsAnimationPaused(false);
        }, 3000); // Resume after 3 seconds of inactivity
      },
    })
  ).current;

  // Initialize app with APK update system
  const initializeApp = async () => {
    try {
      // Initialize APK update service
      const updateService = UpdateService.getInstance();
      await updateService.initialize();

      // Check if changelog should be shown
      await checkChangelogDisplay();
      
      // Check for APK updates on app start (delay to not block UI)
      setTimeout(checkForAPKUpdates, 2000);
    } catch (error) {
      console.error('App initialization error:', error);
    }
  };

  // Check if user has seen the current changelog version
  const checkChangelogDisplay = async () => {
    try {
      const hasSeenChangelog = await AsyncStorage.getItem(CHANGELOG_KEY);
      
      if (!hasSeenChangelog) {
        setTimeout(() => {
          setShowChangelogModal(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error checking changelog status:', error);
    }
  };

  // Check for APK updates
  const checkForAPKUpdates = async () => {
    try {
      const updateService = UpdateService.getInstance();
      
      // Only check for updates on Android devices
      if (!updateService.isUpdateSupported()) {
        console.log('APK updates not supported on this platform');
        return;
      }
      
      const { hasUpdate, metadata } = await updateService.checkForUpdates();
      
      if (hasUpdate && metadata) {
        console.log('APK update available:', metadata.version);
        
        // Check if user previously postponed this update
        const hasPostponed = await updateService.hasUserPostponedUpdate();
        if (hasPostponed && !metadata.force_update) {
          console.log('User previously postponed this update');
          return;
        }
        
        // Show update modal instead of alert
        setUpdateMetadata(metadata);
        setShowUpdateModal(true);
      }
    } catch (error) {
      console.error('Error checking for APK updates:', error);
    }
  };

  // Handle app state changes
  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background - schedule any pending downloads
      handleAppGoingBackground();
    } else if (nextAppState === 'active') {
      // App coming to foreground - check for updates and download status
      setTimeout(checkForAPKUpdates, 1000);
    }
  };

  // FIXED: Handle changelog modal close
  const handleChangelogClose = async () => {
    try {
      await AsyncStorage.setItem(CHANGELOG_KEY, 'true');
      setShowChangelogModal(false);
    } catch (error) {
      console.error('Error saving changelog status:', error);
      setShowChangelogModal(false);
    }
  };

  // Handle app going to background
  const handleAppGoingBackground = async () => {
    try {
      // If user has seen an update but didn't download, schedule background download
      if (updateMetadata && !showUpdateModal) {
        const updateService = UpdateService.getInstance();
        await updateService.scheduleBackgroundDownload(updateMetadata);
        console.log('Scheduled background download for when app is backgrounded');
      }
    } catch (error) {
      console.error('Failed to schedule background download:', error);
    }
  };

  // Handle update modal events
  const handleUpdateStart = () => {
    console.log('Update download started');
  };

  const handleUpdateComplete = () => {
    console.log('Update download completed');
    // Metadata will be cleared when modal closes
  };

  const handleUpdateModalClose = () => {
    setShowUpdateModal(false);
    setUpdateMetadata(null);
  };

  // Load form data in background without blocking UI
  const loadFormDataInBackground = async () => {
    try {
      console.log('Loading additional location data in background...');
      const formData = await getPackageFormData();
      
      if (formData.locations && formData.locations.length > 0) {
        setLocations(formData.locations);
      }
    } catch (error) {
      console.error('Failed to load additional form data (non-critical):', error);
    }
  };

  const calculateCost = async () => {
    if (!selectedOriginLocation || !selectedDestinationLocation || !selectedPackageSize) {
      Alert.alert('Missing Information', 'Please select origin location, destination location, and package size');
      return;
    }

    try {
      setLoading(true);
      
      const pricingData = {
        origin_area_id: selectedOriginLocation.id,
        destination_area_id: selectedDestinationLocation.id,
        package_size: selectedPackageSize.id
      };

      const result = await calculatePackagePricing(pricingData);
      setPricing(result);
    } catch (error) {
      console.error('Failed to calculate pricing:', error);
      Alert.alert('Error', 'Failed to calculate pricing');
    } finally {
      setLoading(false);
    }
  };

  const isUserAuthenticated = () => {
    return !!(user && currentAccount && getCurrentToken() && getCurrentUserId());
  };

  const validateUserForPackageCreation = (): boolean => {
    if (userLoading) {
      Alert.alert('Please wait', 'User authentication is loading...');
      return false;
    }

    if (userError) {
      Alert.alert('Authentication Error', 'Please refresh the app and try again.');
      return false;
    }

    if (!isUserAuthenticated()) {
      Alert.alert(
        'Authentication Required', 
        'Please ensure you are logged in to create packages. You may need to log in or switch to a valid account.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const token = getCurrentToken();
    const userId = getCurrentUserId();
    
    if (!token || !userId) {
      Alert.alert(
        'Session Error', 
        'Your session may have expired. Please log out and log back in.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  // FAB Menu Handlers
  const openFabMenu = () => {
    setFabMenuOpen(true);
    
    Animated.parallel([
      Animated.timing(fabRotation, {
        toValue: 1,
        duration: 150,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(optionsScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
      Animated.timing(optionsTranslateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeFabMenu = () => {
    Animated.parallel([
      Animated.timing(fabRotation, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(optionsScale, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(optionsTranslateY, {
        toValue: 100,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFabMenuOpen(false);
    });
  };

  const handleFabPress = () => {
    if (fabMenuOpen) {
      closeFabMenu();
    } else {
      openFabMenu();
    }
  };

  const showDeliveryInfo = (type: string) => {
    setSelectedInfo(DELIVERY_INFO[type]);
    setShowInfoModal(true);
  };

  const showPackageSizeInfo = (sizeId: string) => {
    setSelectedPackageSizeInfo(PACKAGE_SIZE_INFO[sizeId]);
    setShowPackageSizeInfoModal(true);
  };

  const closeInfoModal = () => {
    setShowInfoModal(false);
    setSelectedInfo(null);
  };

  const closePackageSizeInfoModal = () => {
    setShowPackageSizeInfoModal(false);
    setSelectedPackageSizeInfo(null);
  };

  const showSuccessPopup = (data: SuccessModalData) => {
    setSuccessModalData(data);
    setShowSuccessModal(true);
    
    Animated.parallel([
      Animated.spring(successModalScale, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(successModalOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      closeSuccessModal();
    }, 4000);
  };

  const closeSuccessModal = () => {
    Animated.parallel([
      Animated.timing(successModalScale, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(successModalOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessModal(false);
      setSuccessModalData(null);
      successModalScale.setValue(0);
      successModalOpacity.setValue(0);
    });
  };

  const handleFragileDelivery = () => {
    if (!validateUserForPackageCreation()) return;
    closeFabMenu();
    setTimeout(() => setShowFragileModal(true), 300);
  };

  const handleSendToSomeone = () => {
    if (!validateUserForPackageCreation()) return;
    closeFabMenu();
    setTimeout(() => setShowPackageModal(true), 300);
  };

  const handleCollectAndDeliver = () => {
    if (!validateUserForPackageCreation()) return;
    closeFabMenu();
    setTimeout(() => setShowCollectModal(true), 300);
  };

  const fabOptions: FABOption[] = [
    {
      id: 'fragile',
      label: 'Fragile Items',
      icon: 'alert-triangle',
      color: '#FF9500',
      backgroundColor: '#FF9500',
      glowColor: '#FF9500',
      action: handleFragileDelivery,
      infoAction: () => showDeliveryInfo('fragile'),
    },
    {
      id: 'send',
      label: 'Send a Package',
      icon: 'send',
      color: '#8B5CF6',
      backgroundColor: '#8B5CF6',
      glowColor: '#8B5CF6',
      action: handleSendToSomeone,
      infoAction: () => showDeliveryInfo('send'),
    },
    {
      id: 'collect',
      label: 'Collect my Packages',
      icon: 'package',
      color: '#10B981',
      backgroundColor: '#10B981',
      glowColor: '#10B981',
      action: handleCollectAndDeliver,
      infoAction: () => showDeliveryInfo('collect'),
    },
  ];

  const handlePackageSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
      };
      
      const response = await createPackage(enhancedPackageData);
      
      showSuccessPopup({
        title: 'Package Created Successfully!',
        message: 'Your package has been created and is ready for delivery.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#8B5CF6',
        icon: 'send'
      });
      
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to create package. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const handleFragileSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        delivery_type: 'fragile' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      showSuccessPopup({
        title: 'Fragile Items Scheduled!',
        message: 'Your fragile items delivery has been scheduled with special handling.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#FF9500',
        icon: 'alert-triangle'
      });
      
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to schedule fragile items delivery. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const handleCollectSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        receiver_name: getDisplayName(),
        receiver_phone: getUserPhone(),
        delivery_type: 'collection' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      showSuccessPopup({
        title: 'Package Collection Scheduled!',
        message: 'Your package collection request has been scheduled.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#10B981',
        icon: 'package'
      });
      
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to schedule package collection. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const LocationTag = ({ location }) => (
    <LinearGradient
      colors={['rgba(124, 58, 237, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.locationTagGradient}
    >
      <TouchableOpacity
        style={styles.locationTag}
        activeOpacity={0.8}
      >
        <Text style={styles.locationText}>{location.name}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderPackageSizes = () => (
    <View style={styles.packageSizeContainer}>
      <Text style={styles.sectionLabel}>What are you sending?</Text>
      <View style={styles.packageSizeGrid}>
        {PACKAGE_SIZES.map((size) => (
          <TouchableOpacity
            key={size.id}
            style={[
              styles.packageSizeCard,
              selectedPackageSize?.id === size.id && styles.packageSizeCardSelected
            ]}
            onPress={() => setSelectedPackageSize(size)}
          >
            <View style={styles.packageSizeContent}>
              <Feather name={size.icon as any} size={24} color={selectedPackageSize?.id === size.id ? '#8B5CF6' : '#fff'} />
              <Text style={[
                styles.packageSizeName,
                selectedPackageSize?.id === size.id && styles.packageSizeNameSelected
              ]}>
                {size.name}
              </Text>
              <Text style={styles.packageSizeDescription}>{size.description}</Text>
              <TouchableOpacity
                style={styles.infoIconButton}
                onPress={() => showPackageSizeInfo(size.id)}
              >
                <Feather name="info" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPricingResults = () => {
    if (!pricing) return null;

    return (
      <View style={styles.pricingContainer}>
        <Text style={styles.pricingTitle}>Estimated Costs</Text>
        <View style={styles.pricingGrid}>
          <View style={[styles.pricingCard, { borderColor: '#FF9500' }]}>
            <Text style={styles.pricingType}>Fragile</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.fragile.toLocaleString()}</Text>
          </View>
          <View style={[styles.pricingCard, { borderColor: '#8B5CF6' }]}>
            <Text style={styles.pricingType}>Home</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.home.toLocaleString()}</Text>
          </View>
          <View style={[styles.pricingCard, { borderColor: '#6366F1' }]}>
            <Text style={styles.pricingType}>Office</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.office.toLocaleString()}</Text>
          </View>
          <View style={[styles.pricingCard, { borderColor: '#10B981' }]}>
            <Text style={styles.pricingType}>Collection</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.collection.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFabOption = (option: FABOption, index: number) => {
    const optionOpacity = overlayOpacity.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const optionTranslateY = optionsTranslateY.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 100 + (index * 20)],
    });

    return (
      <Animated.View
        key={option.id}
        style={[
          styles.fabOptionWrapper,
          {
            opacity: optionOpacity,
            transform: [
              { scale: optionsScale },
              { translateY: optionTranslateY },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.fabOptionContainer}
          onPress={option.action}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.fabOptionBackground,
              {
                borderColor: option.color,
                borderWidth: 2,
                backgroundColor: option.color,
                shadowColor: option.glowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
              }
            ]}
          >
            <View style={styles.fabOptionContent}>
              <View style={[
                styles.fabOptionIcon,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  borderWidth: 1,
                  shadowColor: option.glowColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                }
              ]}>
                <Feather name={option.icon as any} size={22} color="white" />
              </View>
              <Text style={[styles.fabOptionLabel, { color: 'white' }]}>{option.label}</Text>
              <TouchableOpacity 
                style={[styles.infoButton, { borderColor: 'white', borderWidth: 1 }]}
                onPress={(e) => {
                  e.stopPropagation();
                  option.infoAction();
                }}
              >
                <Feather name="info" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const fabIconRotation = fabRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <GLTHeader />

      {/* FIXED: Interactive Currently Reaching Section with seamless endless scrolling */}
      <View style={styles.locationsContainer}>
        <Text style={styles.mainSectionTitle}>Currently Reaching</Text>
        <View style={styles.animatedContainer}>
          <Animated.View
            style={[
              styles.animatedContent,
              { transform: [{ translateX: scrollX }] },
            ]}
            {...locationPanResponder.panHandlers}
          >
            {Array(10).fill(locations).flat().map((location, index) => (
              <LocationTag key={`${location.name}-${index}`} location={location} />
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Enhanced Cost Calculator with proper bottom padding */}
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calculatorContainer}>
          <Text style={styles.calculatorTitle}>Cost Calculator</Text>
          
          {/* Origin Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Where are you sending from?</Text>
            <TouchableOpacity 
              style={[styles.locationInput, selectedOriginLocation && styles.locationInputSelected]}
              onPress={() => setShowOriginModal(true)}
            >
              <Text style={[styles.locationText, selectedOriginLocation && styles.locationTextSelected]}>
                {selectedOriginLocation ? 
                  `${selectedOriginLocation.name}${selectedOriginLocation.locationName ? ` (${selectedOriginLocation.locationName})` : ''}${selectedOriginLocation.type === 'office' ? ` - ${selectedOriginLocation.agentName}` : ''}` : 
                  'Tap to select origin location'
                }
              </Text>
              <View style={styles.locationInputIcon}>
                {selectedOriginLocation?.type === 'office' && (
                  <View style={styles.officeTypeTag}>
                    <Text style={styles.officeTypeText}>OFFICE</Text>
                  </View>
                )}
                {selectedOriginLocation?.type === 'area' && (
                  <View style={styles.areaTypeTag}>
                    <Text style={styles.areaTypeText}>AREA</Text>
                  </View>
                )}
                <Feather name="map-pin" size={20} color={selectedOriginLocation ? "#8B5CF6" : "#666"} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Destination Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Where are you sending to?</Text>
            <TouchableOpacity 
              style={[styles.locationInput, selectedDestinationLocation && styles.locationInputSelected]}
              onPress={() => setShowDestinationModal(true)}
            >
              <Text style={[styles.locationText, selectedDestinationLocation && styles.locationTextSelected]}>
                {selectedDestinationLocation ? 
                  `${selectedDestinationLocation.name}${selectedDestinationLocation.locationName ? ` (${selectedDestinationLocation.locationName})` : ''}${selectedDestinationLocation.type === 'office' ? ` - ${selectedDestinationLocation.agentName}` : ''}` : 
                  'Tap to select destination location'
                }
              </Text>
              <View style={styles.locationInputIcon}>
                {selectedDestinationLocation?.type === 'office' && (
                  <View style={styles.officeTypeTag}>
                    <Text style={styles.officeTypeText}>OFFICE</Text>
                  </View>
                )}
                {selectedDestinationLocation?.type === 'area' && (
                  <View style={styles.areaTypeTag}>
                    <Text style={styles.areaTypeText}>AREA</Text>
                  </View>
                )}
                <Feather name="map-pin" size={20} color={selectedDestinationLocation ? "#8B5CF6" : "#666"} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Package Size Selection */}
          {renderPackageSizes()}

          {/* Calculate Button */}
          <TouchableOpacity 
            onPress={calculateCost} 
            activeOpacity={0.8}
            disabled={loading || !selectedOriginLocation || !selectedDestinationLocation || !selectedPackageSize}
            style={[
              styles.calculateButton,
              (!selectedOriginLocation || !selectedDestinationLocation || !selectedPackageSize) && styles.calculateButtonDisabled
            ]}
          >
            <LinearGradient 
              colors={['#7c3aed', '#3b82f6', '#10b981']} 
              style={styles.calculateButtonGradient}
            >
              <Text style={styles.calculateButtonText}>
                {loading ? 'Calculating...' : 'Calculate Cost'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Pricing Results */}
          {renderPricingResults()}
        </View>
      </ScrollView>

      {/* FAB Menu Overlay */}
      {fabMenuOpen && (
        <Animated.View
          style={[
            styles.fabOverlay,
            { opacity: overlayOpacity },
          ]}
        >
          <TouchableOpacity
            style={styles.fabOverlayTouchable}
            onPress={closeFabMenu}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* FAB Options */}
      {fabMenuOpen && (
        <View style={styles.fabOptionsContainer}>
          {fabOptions.map((option, index) => renderFabOption(option, index))}
        </View>
      )}

      {/* Main FAB */}
      <View style={styles.fabContainer}>
        <LinearGradient colors={['#7c3aed', '#3b82f6']} style={styles.fabGradient}>
          <TouchableOpacity
            style={styles.fabTouchable}
            onPress={handleFabPress}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.fabIconContainer,
                { transform: [{ rotate: fabIconRotation }] },
              ]}
            >
              <Feather 
                name="plus" 
                size={24} 
                color="white" 
                style={styles.fabIcon}
              />
            </Animated.View>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Area Selection Modals */}
      <AreaSelectionModal
        visible={showOriginModal}
        onClose={() => setShowOriginModal(false)}
        onSelect={setSelectedOriginLocation}
        title="Select Origin Location"
        type="origin"
      />
      
      <AreaSelectionModal
        visible={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        onSelect={setSelectedDestinationLocation}
        title="Select Destination Location"
        type="destination"
      />

      {/* Enhanced Changelog Modal for APK Updates */}
      <ChangelogModal
        visible={showChangelogModal}
        onClose={handleChangelogClose}
      />

      {/* Enhanced Update Modal */}
      <UpdateModal
        visible={showUpdateModal}
        onClose={handleUpdateModalClose}
        metadata={updateMetadata}
        onUpdateStart={handleUpdateStart}
        onUpdateComplete={handleUpdateComplete}
      />

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={closeInfoModal}
      >
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalContainer}>
            <LinearGradient
              colors={['rgba(26, 26, 46, 0.95)', 'rgba(22, 33, 62, 0.95)']}
              style={styles.infoModalContent}
            >
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>{selectedInfo?.title}</Text>
                <TouchableOpacity onPress={closeInfoModal} style={styles.infoModalClose}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.infoModalText}>{selectedInfo?.description}</Text>
              <TouchableOpacity onPress={closeInfoModal} style={styles.infoModalButton}>
                <View style={styles.infoModalButtonBackground}>
                  <Text style={styles.infoModalButtonText}>Got it</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Package Size Info Modal */}
      <Modal
        visible={showPackageSizeInfoModal}
        transparent
        animationType="fade"
        onRequestClose={closePackageSizeInfoModal}
      >
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalContainer}>
            <LinearGradient
              colors={['rgba(26, 26, 46, 0.95)', 'rgba(22, 33, 62, 0.95)']}
              style={styles.infoModalContent}
            >
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>{selectedPackageSizeInfo?.title}</Text>
                <TouchableOpacity onPress={closePackageSizeInfoModal} style={styles.infoModalClose}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.infoModalText}>{selectedPackageSizeInfo?.description}</Text>
              <View style={styles.deliveryOptionsContainer}>
                <Text style={styles.deliveryOptionsTitle}>Available Delivery Options:</Text>
                {selectedPackageSizeInfo?.deliveryOptions.map((option, index) => (
                  <Text key={index} style={styles.deliveryOption}>• {option}</Text>
                ))}
              </View>
              <TouchableOpacity onPress={closePackageSizeInfoModal} style={styles.infoModalButton}>
                <View style={styles.infoModalButtonBackground}>
                  <Text style={styles.infoModalButtonText}>Got it</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="none"
        onRequestClose={closeSuccessModal}
      >
        <View style={styles.successModalOverlay}>
          <TouchableOpacity 
            style={styles.successModalTouchable}
            onPress={closeSuccessModal}
            activeOpacity={1}
          >
            <Animated.View
              style={[
                styles.successModalContainer,
                {
                  opacity: successModalOpacity,
                  transform: [{ scale: successModalScale }],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  `${successModalData?.color}15`,
                  `${successModalData?.color}25`,
                  `${successModalData?.color}15`,
                ]}
                style={[
                  styles.successModalContent,
                  {
                    borderColor: `${successModalData?.color}40`,
                    shadowColor: successModalData?.color,
                  }
                ]}
              >
                <View style={styles.successModalHeader}>
                  <View 
                    style={[
                      styles.successModalIconContainer,
                      { 
                        backgroundColor: `${successModalData?.color}20`,
                        shadowColor: successModalData?.color,
                      }
                    ]}
                  >
                    <Feather 
                      name={successModalData?.icon as any} 
                      size={28} 
                      color={successModalData?.color} 
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={closeSuccessModal} 
                    style={styles.successModalClose}
                  >
                    <Feather name="x" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.successModalTitle, { color: successModalData?.color }]}>
                  {successModalData?.title}
                </Text>
                
                <Text style={styles.successModalMessage}>
                  {successModalData?.message}
                </Text>
                
                <View style={styles.successModalDetails}>
                  <Text style={styles.successModalDetailLabel}>Tracking Code:</Text>
                  <Text style={[styles.successModalDetailValue, { color: successModalData?.color }]}>
                    {successModalData?.trackingNumber}
                  </Text>
                </View>
                
                <View style={styles.successModalDetails}>
                  <Text style={styles.successModalDetailLabel}>Status:</Text>
                  <Text style={styles.successModalDetailValue}>
                    {successModalData?.status}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Package Creation Modal */}
      <PackageCreationModal
        visible={showPackageModal}
        onClose={() => setShowPackageModal(false)}
        onSubmit={handlePackageSubmit}
      />

      {/* Fragile Delivery Modal */}
      <FragileDeliveryModal
        visible={showFragileModal}
        onClose={() => setShowFragileModal(false)}
        onSubmit={handleFragileSubmit}
      />

      {/* Collect & Deliver Modal */}
      <CollectDeliverModal
        visible={showCollectModal}
        onClose={() => setShowCollectModal(false)}
        onSubmit={handleCollectSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0f' 
  },
  locationsContainer: { 
    paddingTop: 20, 
    paddingBottom: 20,
    backgroundColor: '#0a0a0f',
  },
  mainSectionTitle: {
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff',
    textAlign: 'center', 
    marginBottom: 30,
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  animatedContainer: { 
    height: 60, 
    overflow: 'hidden' 
  },
  animatedContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16 
  },
  locationTagGradient: { 
    borderRadius: 25, 
    padding: 2, 
    marginHorizontal: 8 
  },
  locationTag: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 12, 
    paddingHorizontal: 20,
    borderRadius: 23, 
    minWidth: 80, 
    alignItems: 'center',
  },
  locationText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  scrollContainer: { 
    flex: 1 
  },
  scrollContentContainer: {
    paddingBottom: 120,
  },
  calculatorContainer: { 
    padding: 20, 
    marginTop: 20 
  },
  calculatorTitle: {
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff',
    textAlign: 'center', 
    marginBottom: 30,
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  inputSection: {
    marginBottom: 25,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    minHeight: 60,
  },
  locationInputSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  locationTextSelected: {
    color: '#fff',
  },
  locationInputIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageSizeContainer: {
    marginBottom: 25,
  },
  packageSizeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  packageSizeCard: {
    width: '31%',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  packageSizeCardSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  packageSizeContent: {
    alignItems: 'center',
    position: 'relative',
  },
  packageSizeName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  packageSizeNameSelected: {
    color: '#8B5CF6',
  },
  packageSizeDescription: {
    color: '#ccc',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  infoIconButton: {
    position: 'absolute',
    top: -5,
    right: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculateButton: {
    marginVertical: 20,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calculateButtonDisabled: {
    opacity: 0.5,
  },
  calculateButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pricingContainer: {
    marginTop: 20,
  },
  pricingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pricingCard: {
    width: '48%',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 2,
    alignItems: 'center',
  },
  pricingType: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  pricingAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // FAB Styles
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    zIndex: 1000,
  },
  fabGradient: {
    borderRadius: 28,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabTouchable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {},
  fabOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 999,
  },
  fabOverlayTouchable: {
    flex: 1,
  },
  fabOptionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    alignItems: 'flex-end',
    zIndex: 1001,
  },
  fabOptionWrapper: {
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  fabOptionContainer: {
    borderRadius: 20,
    overflow: 'visible',
  },
  fabOptionBackground: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 240,
    borderRadius: 20,
    overflow: 'visible',
  },
  fabOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    elevation: 8,
  },
  fabOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // FIXED: Enhanced Modal Styles with Keyboard Handling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  areaModalContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  areaModalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  areaModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 15,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 14,
    color: '#ccc',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#8B5CF6',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 10,
    marginTop: 10,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  locationDescription: {
    fontSize: 12,
    color: '#666',
  },
  areaTypeTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  areaTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  officeTypeTag: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  officeTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f97316',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#8B5CF6',
    marginTop: 10,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 18,
    color: '#888',
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },

  // Info Modal Styles
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  infoModalContent: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  infoModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    marginBottom: 24,
  },
  deliveryOptionsContainer: {
    marginBottom: 24,
  },
  deliveryOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  deliveryOption: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 4,
  },
  infoModalButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoModalButtonBackground: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
  },
  successModalContent: {
    padding: 28,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    backdropFilter: 'blur(20px)',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 25,
  },
  successModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  successModalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  successModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  successModalMessage: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.9,
  },
  successModalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  successModalDetailLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  successModalDetailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
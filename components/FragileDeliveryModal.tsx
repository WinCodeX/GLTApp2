// components/FragileDeliveryModal.tsx - FIXED: Auto-population timing and dependencies

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
  Alert,
  Keyboard,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '@/lib/api';
import { 
  type PackageData, 
  type Area, 
  type Agent, 
  type Location as LocationType,
  getPackageFormData,
  getAreas,
  getAgents
} from '../lib/helpers/packageHelpers';
import { useUser } from '../context/UserContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

// AsyncStorage key for fragile packages
const FRAGILE_PACKAGES_KEY = 'fragile_packages_in_progress';

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
  description?: string;
}

interface Package {
  id: string;
  code: string;
  state: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone: string;
  delivery_type: string;
  delivery_location?: string;
  package_description?: string;
  special_instructions?: string;
  pickup_location?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  origin_area_id?: string;
  destination_area_id?: string;
  origin_agent_id?: string;
  destination_agent_id?: string;
  business_name?: string;
  business_phone?: string;
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
}

interface SavedFragilePackage {
  id: string;
  receiverName: string;
  receiverPhone: string;
  deliveryAddress: string;
  itemDescription: string;
  specialInstructions: string;
  pickupLocation: LocationData | null;
  deliveryLocation: LocationData | null;
  selectedPickupArea: Area | null;
  selectedDeliveryArea: Area | null;
  selectedDeliveryAgent: Agent | null;
  createdAt: string;
  businessId?: string | null;
  businessName?: string;
  businessPhone?: string;
}

interface FragileDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: LocationData | null;
  editPackage?: Package;
  resubmitPackage?: Package;
  mode: 'create' | 'edit' | 'resubmit';
}

// Location Selection Modal
const LocationSelectorModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData, area?: Area, agent?: Agent) => void;
  title: string;
  type: 'pickup' | 'delivery';
  currentLocation?: LocationData | null;
}> = ({ visible, onClose, onLocationSelect, title, type, currentLocation }) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      loadLocationData();
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadLocationData = async () => {
    try {
      setIsLoading(true);
      const [areasData, agentsData] = await Promise.all([
        getAreas(),
        type === 'pickup' ? getAgents() : Promise.resolve([])
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
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      setSearchQuery('');
    });
  };

  const filteredAreas = useMemo(() => {
    if (!searchQuery) return areas;
    const query = searchQuery.toLowerCase();
    return areas.filter(area => 
      area.name.toLowerCase().includes(query) ||
      area.location?.name.toLowerCase().includes(query)
    );
  }, [areas, searchQuery]);

  const filteredAgents = useMemo(() => {
    if (!searchQuery || type === 'delivery') return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(query) ||
      agent.area?.name.toLowerCase().includes(query) ||
      agent.area?.location?.name.toLowerCase().includes(query)
    );
  }, [agents, searchQuery, type]);

  const handleAreaSelect = (area: Area) => {
    const locationData: LocationData = {
      latitude: 0,
      longitude: 0,
      address: `${area.name}, ${area.location?.name}`,
      name: area.name,
      description: `${area.name} area in ${area.location?.name}`
    };
    
    onLocationSelect(locationData, area);
    closeModal();
  };

  const handleAgentSelect = (agent: Agent) => {
    const locationData: LocationData = {
      latitude: 0,
      longitude: 0,
      address: `${agent.name} - ${agent.area?.name}, ${agent.area?.location?.name}`,
      name: agent.area?.name || 'Unknown Area',
      description: `Agent: ${agent.name}`
    };
    
    onLocationSelect(locationData, agent.area, agent);
    closeModal();
  };

  const useCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      const currentLoc: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address[0] ? 
          `${address[0].street}, ${address[0].city}` : 'Current Location',
        name: 'Current Location',
        description: 'Your current position'
      };

      onLocationSelect(currentLoc);
      closeModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location');
    }
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
      <Feather name="chevron-right" size={20} color="#f97316" />
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
        <Text style={styles.locationDescription}>Agent • {item.phone}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#f97316" />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.mapModalSafeArea}>
        <Animated.View
          style={[
            styles.mapModalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.mapContainer}>
            <LinearGradient
              colors={['#1a1a2e', '#2d3748', '#4a5568']}
              style={styles.mapGradient}
            >
              <View style={styles.mapHeader}>
                <TouchableOpacity onPress={closeModal} style={styles.mapCloseButton}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.mapHeaderTitle}>{title}</Text>
                <TouchableOpacity onPress={useCurrentLocation} style={styles.currentLocationButton}>
                  <Feather name="target" size={20} color="#f97316" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.mapSearchContainer}>
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search areas or agents..."
                  placeholderTextColor="#888"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#f97316" />
                    <Text style={styles.loadingText}>Loading locations...</Text>
                  </View>
                ) : (
                  <View>
                    <View>
                      <Text style={styles.sectionTitle}>Areas ({filteredAreas.length})</Text>
                      <FlatList
                        data={filteredAreas}
                        keyExtractor={(item) => `area-${item.id}`}
                        renderItem={renderAreaItem}
                        scrollEnabled={false}
                      />
                    </View>
                    
                    {type === 'pickup' && filteredAgents.length > 0 && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={styles.sectionTitle}>Agents ({filteredAgents.length})</Text>
                        <FlatList
                          data={filteredAgents}
                          keyExtractor={(item) => `agent-${item.id}`}
                          renderItem={renderAgentItem}
                          scrollEnabled={false}
                        />
                      </View>
                    )}
                    
                    {filteredAreas.length === 0 && (type === 'delivery' || filteredAgents.length === 0) && (
                      <View style={styles.noResults}>
                        <Feather name="search" size={48} color="#666" />
                        <Text style={styles.noResultsText}>No locations found</Text>
                        <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

export default function FragileDeliveryModal({
  visible,
  onClose,
  onSubmit,
  currentLocation: initialLocation,
  editPackage,
  resubmitPackage,
  mode
}: FragileDeliveryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // Access user context for business information and user data
  const { selectedBusiness, getDisplayName, getUserPhone } = useUser();
  
  // FIXED: Enhanced dependency management states
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasTriedAutoPopulation, setHasTriedAutoPopulation] = useState(false);
  
  // Location states
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(initialLocation);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
  const [selectedPickupArea, setSelectedPickupArea] = useState<Area | null>(null);
  const [selectedDeliveryArea, setSelectedDeliveryArea] = useState<Area | null>(null);
  const [selectedDeliveryAgent, setSelectedDeliveryAgent] = useState<Agent | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Form states
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  // Multiple packages states
  const [savedPackages, setSavedPackages] = useState<SavedFragilePackage[]>([]);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  
  // Modal states
  const [showPickupMapModal, setShowPickupMapModal] = useState(false);
  const [showDeliveryMapModal, setShowDeliveryMapModal] = useState(false);
  
  const STEP_TITLES = [
    'Location Setup',
    'Receiver Details', 
    'Package Information',
    'Confirm Fragile Delivery'
  ];

  // Get modal title based on mode
  const getModalTitle = useCallback(() => {
    const currentStepTitle = STEP_TITLES[currentStep];
    
    switch (mode) {
      case 'edit':
        return `Edit Fragile Package - ${currentStepTitle}`;
      case 'resubmit':
        return `Resubmit Fragile Package - ${currentStepTitle}`;
      default:
        return currentStepTitle;
    }
  }, [mode, currentStep]);

  // Get action button text based on mode
  const getActionButtonText = useCallback(() => {
    const packageCount = savedPackages.length + 1;
    
    switch (mode) {
      case 'edit':
        return packageCount > 1 
          ? `Update ${packageCount} Fragile Deliveries`
          : 'Update Fragile Delivery';
      case 'resubmit':
        return packageCount > 1 
          ? `Resubmit ${packageCount} Fragile Deliveries`
          : 'Resubmit Fragile Delivery';
      default:
        return packageCount > 1 
          ? `Schedule ${packageCount} Fragile Deliveries`
          : 'Schedule Fragile Delivery';
    }
  }, [mode, savedPackages.length]);

  // FIXED: Enhanced load reference data with proper error handling and retry
  const loadReferenceData = useCallback(async (retryCount = 0): Promise<void> => {
    console.log(`🔄 Loading fragile modal reference data (attempt ${retryCount + 1})`);
    
    try {
      setIsDataLoading(true);
      setDataError(null);

      const [areasData, agentsData] = await Promise.all([
        getAreas(),
        getAgents()
      ]);

      console.log('✅ Reference data loaded:', {
        areas: areasData.length,
        agents: agentsData.length
      });

      setAreas(areasData);
      setAgents(agentsData);
      
      return Promise.resolve();
    } catch (error: any) {
      console.error('❌ Failed to load reference data:', error);
      
      if (retryCount < 2) {
        console.log('🔄 Retrying reference data load...');
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadReferenceData(retryCount + 1);
      }
      
      setDataError(error.message || 'Failed to load reference data');
      throw error;
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  // FIXED: Enhanced auto-population with comprehensive ID matching and validation
  const loadPackageForEditing = useCallback(async (pkg: Package) => {
    console.log('🔧 Loading fragile package for editing:', pkg.code);
    console.log('📦 Package data:', pkg);
    console.log('🏢 Available areas:', areas.length);
    console.log('👤 Available agents:', agents.length);
    
    // CRITICAL: Wait for reference data to be available
    if (areas.length === 0 || agents.length === 0) {
      console.log('⏳ Waiting for reference data before auto-populating...');
      return;
    }

    try {
      // Set basic form data
      setReceiverName(pkg.receiver_name || '');
      setReceiverPhone(pkg.receiver_phone || '');
      setDeliveryAddress(pkg.delivery_location || '');
      setItemDescription(pkg.package_description?.replace('FRAGILE DELIVERY: ', '') || '');
      setSpecialInstructions(pkg.special_instructions || '');
      
      // Set locations if available
      if (pkg.pickup_latitude && pkg.pickup_longitude) {
        setPickupLocation({
          latitude: pkg.pickup_latitude,
          longitude: pkg.pickup_longitude,
          address: pkg.pickup_location || 'Pickup Location'
        });
      }
      
      if (pkg.delivery_latitude && pkg.delivery_longitude) {
        setDeliveryLocation({
          latitude: pkg.delivery_latitude,
          longitude: pkg.delivery_longitude,
          address: pkg.delivery_location || 'Delivery Location'
        });
      }

      // FIXED: Enhanced area/agent matching with comprehensive ID comparison
      let originAreaFound = false;
      let destinationAreaFound = false;
      let destinationAgentFound = false;

      // FIXED: Match origin area with multiple ID formats
      if (pkg.origin_area_id) {
        console.log('🔍 Looking for origin area ID:', pkg.origin_area_id, typeof pkg.origin_area_id);
        
        const originArea = areas.find(area => {
          const areaIdStr = String(area.id);
          const pkgAreaIdStr = String(pkg.origin_area_id);
          const match = areaIdStr === pkgAreaIdStr || 
                       area.id === pkg.origin_area_id ||
                       Number(area.id) === Number(pkg.origin_area_id);
          
          if (match) {
            console.log('✅ Found matching origin area:', area.name, 'Area ID:', area.id);
          }
          return match;
        });
        
        if (originArea) {
          setSelectedPickupArea(originArea);
          originAreaFound = true;
          console.log('✅ Auto-selected origin area:', originArea.name);
        } else {
          console.warn('⚠️ Origin area not found for ID:', pkg.origin_area_id);
          console.log('🔍 Available area IDs:', areas.map(a => `${a.id} (${typeof a.id})`));
        }
      }

      // FIXED: Match destination area with multiple ID formats
      if (pkg.destination_area_id) {
        console.log('🔍 Looking for destination area ID:', pkg.destination_area_id, typeof pkg.destination_area_id);
        
        const destArea = areas.find(area => {
          const areaIdStr = String(area.id);
          const pkgAreaIdStr = String(pkg.destination_area_id);
          const match = areaIdStr === pkgAreaIdStr || 
                       area.id === pkg.destination_area_id ||
                       Number(area.id) === Number(pkg.destination_area_id);
          
          if (match) {
            console.log('✅ Found matching destination area:', area.name, 'Area ID:', area.id);
          }
          return match;
        });
        
        if (destArea) {
          setSelectedDeliveryArea(destArea);
          destinationAreaFound = true;
          console.log('✅ Auto-selected destination area:', destArea.name);
        } else {
          console.warn('⚠️ Destination area not found for ID:', pkg.destination_area_id);
          console.log('🔍 Available area IDs:', areas.map(a => `${a.id} (${typeof a.id})`));
        }
      }

      // FIXED: Match destination agent with multiple ID formats
      if (pkg.destination_agent_id) {
        console.log('🔍 Looking for destination agent ID:', pkg.destination_agent_id, typeof pkg.destination_agent_id);
        
        const destAgent = agents.find(agent => {
          const agentIdStr = String(agent.id);
          const pkgAgentIdStr = String(pkg.destination_agent_id);
          const match = agentIdStr === pkgAgentIdStr || 
                       agent.id === pkg.destination_agent_id ||
                       Number(agent.id) === Number(pkg.destination_agent_id);
          
          if (match) {
            console.log('✅ Found matching destination agent:', agent.name, 'Agent ID:', agent.id);
          }
          return match;
        });
        
        if (destAgent) {
          setSelectedDeliveryAgent(destAgent);
          // Also set the delivery area from the agent
          if (destAgent.area) {
            setSelectedDeliveryArea(destAgent.area);
          }
          destinationAgentFound = true;
          console.log('✅ Auto-selected destination agent:', destAgent.name);
        } else {
          console.warn('⚠️ Destination agent not found for ID:', pkg.destination_agent_id);
          console.log('🔍 Available agent IDs:', agents.map(a => `${a.id} (${typeof a.id})`));
        }
      }

      // FIXED: Handle step navigation for resubmit mode
      if (mode === 'resubmit') {
        console.log('🔄 Resubmit mode - navigating to confirmation step');
        setCurrentStep(STEP_TITLES.length - 1);
      }

      // Mark auto-population as completed
      setHasTriedAutoPopulation(true);

      console.log('✅ Package data loaded and auto-populated successfully', {
        originAreaFound,
        destinationAreaFound,
        destinationAgentFound
      });

    } catch (error) {
      console.error('❌ Error auto-populating package data:', error);
    }
  }, [areas, agents, mode, STEP_TITLES.length]);

  // FIXED: Proper initialization sequence with dependency management
  useEffect(() => {
    if (visible && !isInitialized) {
      console.log('🚀 Initializing fragile modal with dependency management');
      
      const initializeModal = async () => {
        try {
          // Reset states
          setHasTriedAutoPopulation(false);
          setDataError(null);
          
          // Step 1: Load reference data first
          await loadReferenceData();
          
          setIsInitialized(true);
          console.log('✅ Fragile modal initialization complete');
          
        } catch (error) {
          console.error('❌ Failed to initialize fragile modal:', error);
        }
      };

      initializeModal();
    }
  }, [visible, isInitialized, loadReferenceData]);

  // FIXED: Auto-populate when data becomes available
  useEffect(() => {
    if (isInitialized && areas.length > 0 && agents.length > 0 && !hasTriedAutoPopulation) {
      const packageToLoad = editPackage || resubmitPackage;
      if (packageToLoad && (mode === 'edit' || mode === 'resubmit')) {
        console.log('🔄 Reference data available, loading package data...');
        // Small delay to ensure state updates are processed
        setTimeout(() => {
          loadPackageForEditing(packageToLoad);
        }, 100);
      } else {
        // Mark as tried even if no package to load
        setHasTriedAutoPopulation(true);
      }
    }
  }, [isInitialized, areas.length, agents.length, hasTriedAutoPopulation, editPackage, resubmitPackage, mode, loadPackageForEditing]);

  // FIXED: Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      setIsInitialized(false);
      setHasTriedAutoPopulation(false);
      setAreas([]);
      setAgents([]);
      setDataError(null);
    }
  }, [visible]);

  // AsyncStorage functions
  const savePendingPackages = async (packages: SavedFragilePackage[]) => {
    try {
      await AsyncStorage.setItem(FRAGILE_PACKAGES_KEY, JSON.stringify(packages));
    } catch (error) {
      console.error('Failed to save pending packages:', error);
    }
  };

  const loadPendingPackages = async (): Promise<SavedFragilePackage[]> => {
    try {
      const stored = await AsyncStorage.getItem(FRAGILE_PACKAGES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load pending packages:', error);
      return [];
    }
  };

  const clearPendingPackages = async () => {
    try {
      await AsyncStorage.removeItem(FRAGILE_PACKAGES_KEY);
      setSavedPackages([]);
    } catch (error) {
      console.error('Failed to clear pending packages:', error);
    }
  };

  // Load saved packages when modal opens
  useEffect(() => {
    if (visible) {
      if (mode === 'create') {
        loadPendingPackages().then(setSavedPackages);
      }
    }
  }, [visible, mode]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  // Calculate modal height based on keyboard state
  const modalHeight = useMemo(() => {
    if (isKeyboardVisible) {
      const availableHeight = SCREEN_HEIGHT - keyboardHeight;
      const maxModalHeight = availableHeight - STATUS_BAR_HEIGHT - 20;
      return Math.min(maxModalHeight, availableHeight * 0.85);
    }
    return SCREEN_HEIGHT * 0.90;
  }, [isKeyboardVisible, keyboardHeight]);

  useEffect(() => {
    if (visible) {
      if (!isCreatingMultiple && mode === 'create') {
        resetForm();
      }
      requestLocationPermission();
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, isCreatingMultiple, mode]);

  const resetForm = () => {
    setCurrentStep(0);
    setPickupLocation(initialLocation);
    setDeliveryLocation(null);
    setSelectedPickupArea(null);
    setSelectedDeliveryArea(null);
    setSelectedDeliveryAgent(null);
    setReceiverName('');
    setReceiverPhone('');
    setDeliveryAddress('');
    setItemDescription('');
    setSpecialInstructions('');
    setIsSubmitting(false);
    setLocationError(null);
  };

  const closeModal = useCallback(() => {
    // Show warning if there are pending packages and we're in create mode
    if (savedPackages.length > 0 && mode === 'create') {
      Alert.alert(
        'Unsaved Packages',
        `You have ${savedPackages.length} unsaved package(s). If you close now, all progress will be lost.`,
        [
          {
            text: 'Continue Editing',
            style: 'cancel'
          },
          {
            text: 'Close and Lose Progress',
            style: 'destructive',
            onPress: () => {
              setSavedPackages([]);
              setIsCreatingMultiple(false);
              Keyboard.dismiss();
              Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
              }).start(() => {
                onClose();
              });
            }
          }
        ]
      );
    } else {
      Keyboard.dismiss();
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onClose();
      });
    }
  }, [slideAnim, onClose, savedPackages.length, mode]);

  const requestLocationPermission = async () => {
    try {
      setIsLocationLoading(true);
      setLocationError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable location services.');
        return;
      }
      
      if (!pickupLocation) {
        const location = await Location.getCurrentPositionAsync({});
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        setPickupLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Current Location'
        });
      }
    } catch (error) {
      setLocationError('Failed to get current location');
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handlePickupLocationSelect = (location: LocationData, area?: Area, agent?: Agent) => {
    setPickupLocation(location);
    if (area) setSelectedPickupArea(area);
  };

  const handleDeliveryLocationSelect = (location: LocationData, area?: Area, agent?: Agent) => {
    setDeliveryLocation(location);
    if (area) setSelectedDeliveryArea(area);
    if (agent) setSelectedDeliveryAgent(agent);
  };

  const isStepValid = useCallback((step: number) => {
    switch (step) {
      case 0:
        return pickupLocation !== null && deliveryLocation !== null;
      case 1:
        return receiverName.trim().length > 0 && receiverPhone.trim().length > 0;
      case 2:
        return deliveryAddress.trim().length > 0 && itemDescription.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  }, [pickupLocation, deliveryLocation, receiverName, receiverPhone, deliveryAddress, itemDescription]);

  const nextStep = useCallback(() => {
    if (currentStep < STEP_TITLES.length - 1 && isStepValid(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, isStepValid]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Save current package and start another
  const handleAddAnotherPackage = async () => {
    if (!isStepValid(2)) return;

    const currentPackage: SavedFragilePackage = {
      id: Date.now().toString(),
      receiverName,
      receiverPhone,
      deliveryAddress,
      itemDescription,
      specialInstructions,
      pickupLocation,
      deliveryLocation,
      selectedPickupArea,
      selectedDeliveryArea,
      selectedDeliveryAgent,
      createdAt: new Date().toISOString(),
      businessId: selectedBusiness?.id || null,
      businessName: selectedBusiness?.name || '',
      businessPhone: selectedBusiness?.phone_number || '',
    };

    const updatedPackages = [...savedPackages, currentPackage];
    setSavedPackages(updatedPackages);
    await savePendingPackages(updatedPackages);

    // Reset form for next package
    resetForm();
    setIsCreatingMultiple(true);
    setCurrentStep(1); // Skip location setup for subsequent packages
  };

  // Remove a saved package
  const handleRemoveSavedPackage = async (packageId: string) => {
    const updatedPackages = savedPackages.filter(pkg => pkg.id !== packageId);
    setSavedPackages(updatedPackages);
    await savePendingPackages(updatedPackages);
  };

  // Handle submission for different modes
  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Create array of all packages to submit
      const packagesToSubmit: PackageData[] = [];

      // Add saved packages (only for create mode)
      if (mode === 'create') {
        savedPackages.forEach(pkg => {
          const packageData: PackageData = {
            sender_name: getDisplayName(),
            sender_phone: getUserPhone(),
            receiver_name: pkg.receiverName,
            receiver_phone: pkg.receiverPhone,
            origin_area_id: pkg.selectedPickupArea?.id,
            destination_area_id: pkg.selectedDeliveryArea?.id || pkg.selectedDeliveryAgent?.area?.id,
            origin_agent_id: null,
            destination_agent_id: pkg.selectedDeliveryAgent?.id || null,
            delivery_type: 'fragile',
            delivery_location: pkg.deliveryAddress,
            package_description: `FRAGILE DELIVERY: ${pkg.itemDescription}${pkg.specialInstructions ? `\nSpecial Instructions: ${pkg.specialInstructions}` : ''}`,
            pickup_location: pkg.pickupLocation?.address || '',
            business_id: selectedBusiness?.id || null,
            business_name: selectedBusiness?.name || '',
            business_phone: selectedBusiness?.phone_number || '',
            coordinates: pkg.pickupLocation && pkg.deliveryLocation ? {
              pickup: pkg.pickupLocation,
              delivery: pkg.deliveryLocation
            } : undefined,
          };
          packagesToSubmit.push(packageData);
        });
      }

      // Add current package
      const currentPackageData: PackageData = {
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        origin_area_id: selectedPickupArea?.id,
        destination_area_id: selectedDeliveryArea?.id || selectedDeliveryAgent?.area?.id,
        origin_agent_id: null,
        destination_agent_id: selectedDeliveryAgent?.id || null,
        delivery_type: 'fragile',
        delivery_location: deliveryAddress,
        package_description: `FRAGILE DELIVERY: ${itemDescription}${specialInstructions ? `\nSpecial Instructions: ${specialInstructions}` : ''}`,
        pickup_location: pickupLocation?.address || '',
        business_id: selectedBusiness?.id || null,
        business_name: selectedBusiness?.name || '',
        business_phone: selectedBusiness?.phone_number || '',
        coordinates: pickupLocation && deliveryLocation ? {
          pickup: pickupLocation,
          delivery: deliveryLocation
        } : undefined,
      };

      if (mode === 'edit' && editPackage) {
        // Update existing package
        console.log('✏️ Updating fragile package:', editPackage.code);
        
        const response = await api.put(`/api/v1/packages/${editPackage.code}`, {
          package: currentPackageData
        });

        if (response.data.success) {
          console.log('✅ Fragile package updated successfully');
        } else {
          throw new Error(response.data.message || 'Failed to update package');
        }
      } else if (mode === 'resubmit' && resubmitPackage) {
        // Resubmit existing package
        console.log('🔄 Resubmitting fragile package:', resubmitPackage.code);
        
        const response = await api.post(`/api/v1/packages/${resubmitPackage.code}/resubmit`, {
          package: currentPackageData,
          reason: 'Fragile package updated and resubmitted by user'
        });

        if (response.data.success) {
          console.log('✅ Fragile package resubmitted successfully');
        } else {
          throw new Error(response.data.message || 'Failed to resubmit package');
        }
      } else {
        // Create new packages
        packagesToSubmit.push(currentPackageData);

        // Submit each package individually
        for (const packageData of packagesToSubmit) {
          await onSubmit(packageData);
        }

        // Clear saved packages after successful submission
        await clearPendingPackages();
      }
      
      closeModal();
      
    } catch (error) {
      console.error('Error submitting fragile deliveries:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // FIXED: Retry data loading with proper state management
  const retryDataLoad = useCallback(() => {
    console.log('🔄 Retrying data load...');
    setIsInitialized(false);
    setHasTriedAutoPopulation(false);
    setDataError(null);
    setAreas([]);
    setAgents([]);
    
    // Reinitialize after small delay
    setTimeout(() => {
      if (visible) {
        const initializeModal = async () => {
          try {
            await loadReferenceData();
            setIsInitialized(true);
          } catch (error) {
            console.error('❌ Retry failed:', error);
          }
        };
        
        initializeModal();
      }
    }, 500);
  }, [visible, loadReferenceData]);

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBackground}>
        <View 
          style={[
            styles.progressForeground,
            { width: `${((currentStep + 1) / STEP_TITLES.length) * 100}%` }
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        Step {currentStep + 1} of {STEP_TITLES.length} • {savedPackages.length + 1} Packages
        {mode !== 'create' && ` • ${mode === 'edit' ? 'Editing' : 'Resubmitting'} Package`}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{getModalTitle()}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  // FIXED: Loading state with proper messaging
  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#f97316" />
      <Text style={styles.loadingTitle}>
        {isDataLoading ? 'Loading Reference Data' : 'Initializing Modal'}
      </Text>
      <Text style={styles.loadingSubtitle}>
        {isDataLoading 
          ? 'Fetching areas and agents...' 
          : 'Preparing fragile delivery form...'
        }
      </Text>
    </View>
  );

  // FIXED: Error state with retry functionality
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={64} color="#ef4444" />
      <Text style={styles.errorTitle}>Failed to Load Data</Text>
      <Text style={styles.errorMessage}>
        {dataError}
        {'\n\n'}Unable to load required reference data. Please check your connection and try again.
      </Text>
      
      <View style={styles.errorButtons}>
        <TouchableOpacity onPress={retryDataLoad} style={styles.retryButton}>
          <Feather name="refresh-cw" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={closeModal} style={styles.cancelButton}>
          <Feather name="x" size={20} color="#fff" />
          <Text style={styles.cancelButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLocationSetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Fragile Delivery Setup</Text>
      <Text style={styles.stepSubtitle}>
        Set your pickup and delivery locations for fragile items
      </Text>
      
      {/* Show editing/resubmit notice */}
      {(mode === 'edit' || mode === 'resubmit') && (
        <View style={styles.modeNoticeSection}>
          <Feather 
            name={mode === 'edit' ? 'edit-3' : 'refresh-cw'} 
            size={16} 
            color={mode === 'edit' ? '#8b5cf6' : '#f97316'} 
          />
          <Text style={[styles.modeNoticeText, { color: mode === 'edit' ? '#8b5cf6' : '#f97316' }]}>
            {mode === 'edit' ? 'You are editing an existing fragile package' : 'You are resubmitting a rejected fragile package'}
          </Text>
        </View>
      )}
      
      {locationError && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color="#ea580c" />
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity onPress={requestLocationPermission}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isLocationLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#f97316" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}
      
      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Pickup Location</Text>
        <TouchableOpacity 
          style={[styles.locationInput, pickupLocation && styles.locationInputSelected]}
          onPress={() => setShowPickupMapModal(true)}
        >
          <Text style={[styles.locationText, pickupLocation && styles.locationTextSelected]}>
            {pickupLocation?.address || 'Tap to select pickup location'}
          </Text>
          <Feather name="map" size={20} color={pickupLocation ? "#f97316" : "#666"} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Delivery Location</Text>
        <TouchableOpacity 
          style={[styles.locationInput, deliveryLocation && styles.locationInputSelected]}
          onPress={() => setShowDeliveryMapModal(true)}
        >
          <Text style={[styles.locationText, deliveryLocation && styles.locationTextSelected]}>
            {deliveryLocation?.address || 'Tap to select delivery location'}
          </Text>
          <Feather name="map" size={20} color={deliveryLocation ? "#f97316" : "#666"} />
        </TouchableOpacity>
      </View>

      <View style={styles.fragileInfo}>
        <Feather name="alert-triangle" size={20} color="#f97316" />
        <View style={styles.fragileInfoText}>
          <Text style={styles.fragileInfoTitle}>Special Handling Included</Text>
          <Text style={styles.fragileInfoDescription}>
            Your fragile items will receive priority handling with extra care during transport
          </Text>
        </View>
      </View>
    </View>
  );

  const renderReceiverDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Receiver Information</Text>
      <Text style={styles.stepSubtitle}>Who will receive this fragile delivery?</Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Receiver's Full Name"
          placeholderTextColor="#888"
          value={receiverName}
          onChangeText={setReceiverName}
          autoCapitalize="words"
          returnKeyType="next"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Receiver's Phone (+254...)"
          placeholderTextColor="#888"
          value={receiverPhone}
          onChangeText={setReceiverPhone}
          keyboardType="phone-pad"
          returnKeyType="next"
        />
      </View>

      {/* Show selected business info (read-only) */}
      {selectedBusiness && (
        <View style={styles.businessPreviewSection}>
          <Text style={styles.businessPreviewTitle}>Package for Business</Text>
          <Text style={styles.businessPreviewText}>{selectedBusiness.name}</Text>
          {selectedBusiness.phone_number && (
            <Text style={styles.businessPreviewDetail}>{selectedBusiness.phone_number}</Text>
          )}
        </View>
      )}
    </View>
  );

  const renderPackageInformation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Package Details</Text>
      <Text style={styles.stepSubtitle}>
        Provide details about your fragile items and delivery requirements
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the fragile item(s)"
          placeholderTextColor="#888"
          value={itemDescription}
          onChangeText={setItemDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="next"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Delivery address, building details, floor, etc."
          placeholderTextColor="#888"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="next"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special instructions for fragile handling (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="done"
        />
      </View>

      {/* Only show add another button for create mode */}
      {mode === 'create' && isStepValid(2) && (
        <View style={styles.addAnotherSection}>
          <TouchableOpacity 
            style={styles.addAnotherButton}
            onPress={handleAddAnotherPackage}
          >
            <Feather name="plus-circle" size={20} color="#f97316" />
            <Text style={styles.addAnotherButtonText}>Save & Add Another Package</Text>
          </TouchableOpacity>
          <Text style={styles.addAnotherDescription}>
            Save this package and create another fragile delivery
          </Text>
        </View>
      )}

      <View style={styles.fragileNotice}>
        <Feather name="info" size={16} color="#f97316" />
        <Text style={styles.fragileNoticeText}>
          All fragile items are handled with extra care and receive priority processing
        </Text>
      </View>
    </View>
  );

  const renderSavedPackageItem = (pkg: SavedFragilePackage, index: number) => (
    <View key={pkg.id} style={styles.savedPackageItem}>
      <View style={styles.savedPackageHeader}>
        <Text style={styles.savedPackageTitle}>Package {index + 1}</Text>
        <TouchableOpacity 
          onPress={() => handleRemoveSavedPackage(pkg.id)}
          style={styles.removeSavedPackage}
        >
          <Feather name="x" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <Text style={styles.savedPackageDetail}>{pkg.receiverName}</Text>
      <Text style={styles.savedPackageSubDetail}>{pkg.itemDescription}</Text>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {mode === 'edit' ? 'Confirm Fragile Package Updates' :
         mode === 'resubmit' ? 'Confirm Fragile Package Resubmission' :
         'Confirm Fragile Deliveries'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {mode === 'edit' ? 'Please review your fragile delivery updates' :
         mode === 'resubmit' ? 'Please review your fragile delivery resubmission' :
         `Please review your fragile delivery details (${savedPackages.length + 1} packages)`}
      </Text>
      
      <ScrollView style={styles.confirmationContainer} showsVerticalScrollIndicator={false}>
        
        {/* Saved Packages - Only show for create mode */}
        {mode === 'create' && savedPackages.length > 0 && (
          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>Saved Packages ({savedPackages.length})</Text>
            {savedPackages.map((pkg, index) => renderSavedPackageItem(pkg, index))}
          </View>
        )}

        {/* Current Package */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>
            {mode === 'edit' ? 'Package Updates' :
             mode === 'resubmit' ? 'Package Resubmission' :
             'Current Package'}
          </Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeAddress}>{pickupLocation?.address}</Text>
              {selectedPickupArea && (
                <Text style={styles.routeAreaDetail}>{selectedPickupArea.name}</Text>
              )}
            </View>
            <View style={styles.routeArrow}>
              <Feather name="arrow-right" size={20} color="#f97316" />
            </View>
            <View style={styles.routePoint}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routeAddress}>{deliveryLocation?.address}</Text>
              {(selectedDeliveryArea || selectedDeliveryAgent) && (
                <Text style={styles.routeAreaDetail}>
                  {selectedDeliveryAgent ? `Agent: ${selectedDeliveryAgent.name}` : selectedDeliveryArea?.name}
                </Text>
              )}
            </View>
          </View>
          
          <Text style={styles.confirmationDetail}>{receiverName}</Text>
          <Text style={styles.confirmationDetail}>{receiverPhone}</Text>
          <Text style={styles.confirmationSubDetail}>Item: {itemDescription}</Text>
          <Text style={styles.confirmationSubDetail}>Address: {deliveryAddress}</Text>
          {specialInstructions && (
            <Text style={styles.confirmationSubDetail}>
              Special Instructions: {specialInstructions}
            </Text>
          )}
        </View>

        {/* Show business information if available */}
        {selectedBusiness && (
          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>Business Information</Text>
            <Text style={styles.confirmationDetail}>{selectedBusiness.name}</Text>
            {selectedBusiness.phone_number && (
              <Text style={styles.confirmationDetail}>{selectedBusiness.phone_number}</Text>
            )}
            <Text style={styles.confirmationSubDetail}>Package will be tagged with business information</Text>
          </View>
        )}

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Sender Information</Text>
          <Text style={styles.confirmationDetail}>{getDisplayName()}</Text>
          <Text style={styles.confirmationDetail}>{getUserPhone()}</Text>
          <Text style={styles.confirmationSubDetail}>Your contact information for the delivery</Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Fragile Service</Text>
          <View style={styles.serviceFeatures}>
            <View style={styles.serviceFeature}>
              <Feather name="shield" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Special handling care</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="clock" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Priority delivery</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="phone" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Real-time updates</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Total Cost</Text>
          <View style={styles.costBreakdown}>
            <View style={[styles.costLine, styles.totalCostLine]}>
              <Text style={styles.totalCostLabel}>
                {savedPackages.length + 1} Fragile Package{savedPackages.length > 0 ? 's' : ''}
              </Text>
              <Text style={styles.totalCostValue}>
                KES {((savedPackages.length + 1) * 1000).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Add Another Package - Only for create mode */}
        {mode === 'create' && isStepValid(2) && (
          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>Add More Packages</Text>
            <TouchableOpacity 
              style={styles.addAnotherButton}
              onPress={handleAddAnotherPackage}
            >
              <Feather name="plus-circle" size={20} color="#f97316" />
              <Text style={styles.addAnotherButtonText}>Add Another Fragile Delivery</Text>
            </TouchableOpacity>
            <Text style={styles.addAnotherDescription}>
              Need to send more fragile packages? Add another with the same care and handling.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderLocationSetup();
      case 1: return renderReceiverDetails();
      case 2: return renderPackageInformation();
      case 3: return renderConfirmation();
      default: return renderLocationSetup();
    }
  };

  const renderNavigationButtons = () => (
    <View style={styles.navigationContainer}>
      {currentStep > 0 && (
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#fff" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.spacer} />
      
      {currentStep < STEP_TITLES.length - 1 ? (
        <TouchableOpacity 
          onPress={nextStep} 
          style={[
            styles.nextButton,
            !isStepValid(currentStep) && styles.disabledButton
          ]}
          disabled={!isStepValid(currentStep)}
        >
          <Text style={[
            styles.nextButtonText,
            !isStepValid(currentStep) && styles.disabledButtonText
          ]}>
            Next
          </Text>
          <Feather name="arrow-right" size={20} color={isStepValid(currentStep) ? "#fff" : "#666"} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          onPress={handleSubmit} 
          style={[
            styles.submitButton,
            (!isStepValid(currentStep) || isSubmitting) && styles.disabledButton
          ]}
          disabled={!isStepValid(currentStep) || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={[
                styles.submitButtonText,
                (!isStepValid(currentStep) || isSubmitting) && styles.disabledButtonText
              ]}>
                {getActionButtonText()}
              </Text>
              <Feather 
                name={mode === 'edit' ? 'save' : mode === 'resubmit' ? 'refresh-cw' : 'alert-triangle'} 
                size={20} 
                color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#666"} 
              />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMainContent = () => {
    if (isDataLoading || !isInitialized) {
      return renderLoadingState();
    }

    if (dataError) {
      return renderErrorState();
    }

    return (
      <>
        {renderHeader()}
        {renderProgressBar()}
        
        <View style={styles.contentWrapper}>
          <ScrollView 
            style={styles.contentContainer}
            contentContainerStyle={[
              styles.scrollContentContainer,
              isKeyboardVisible && styles.keyboardVisiblePadding
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
          >
            {renderCurrentStep()}
          </ScrollView>
        </View>
        
        {renderNavigationButtons()}
      </>
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="none">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.modalWrapper}>
          <KeyboardAvoidingView 
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={styles.overlay}>
              <Animated.View
                style={[
                  styles.modalContainer,
                  { 
                    transform: [{ translateY: slideAnim }],
                    height: modalHeight
                  }
                ]}
              >
                <LinearGradient
                  colors={['#1a1a2e', '#16213e', '#0f1419']}
                  style={styles.modalContent}
                >
                  {renderMainContent()}
                </LinearGradient>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <LocationSelectorModal
        visible={showPickupMapModal}
        onClose={() => setShowPickupMapModal(false)}
        onLocationSelect={handlePickupLocationSelect}
        title="Select Pickup Location"
        type="pickup"
        currentLocation={pickupLocation}
      />
      
      <LocationSelectorModal
        visible={showDeliveryMapModal}
        onClose={() => setShowDeliveryMapModal(false)}
        onLocationSelect={handleDeliveryLocationSelect}
        title="Select Delivery Location"
        type="delivery"
        currentLocation={deliveryLocation}
      />
    </>
  );
}


const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    paddingTop: STATUS_BAR_HEIGHT,
  },
  keyboardContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: SCREEN_WIDTH,
    maxHeight: SCREEN_HEIGHT - STATUS_BAR_HEIGHT - 20,
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 6,
  },
  contentWrapper: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  keyboardVisiblePadding: {
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
    minHeight: 200,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 20,
    lineHeight: 20,
  },
  
  // ENHANCED: Loading state styles
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // ENHANCED: Error state styles
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f97316',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  
  // Mode notice section for edit/resubmit
  modeNoticeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  modeNoticeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 88, 12, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ea580c',
  },
  retryText: {
    fontSize: 14,
    color: '#ea580c',
    fontWeight: '600',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#f97316',
  },
  locationSection: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  locationInputSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#888',
  },
  locationTextSelected: {
    color: '#fff',
  },
  fragileInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    gap: 12,
  },
  fragileInfoText: {
    flex: 1,
  },
  fragileInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 4,
  },
  fragileInfoDescription: {
    fontSize: 14,
    color: '#f97316',
    lineHeight: 18,
  },
  formContainer: {
    gap: 16,
    paddingVertical: 8,
  },
  input: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  
  // Business Preview Styles (read-only display)
  businessPreviewSection: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
  },
  businessPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 4,
  },
  businessPreviewText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  businessPreviewDetail: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  
  addAnotherSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    marginBottom: 8,
  },
  addAnotherButtonText: {
    fontSize: 16,
    color: '#f97316',
    fontWeight: '600',
  },
  addAnotherDescription: {
    fontSize: 13,
    color: '#888',
    lineHeight: 16,
  },
  fragileNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  fragileNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#f97316',
    lineHeight: 18,
  },
  confirmationContainer: {
    flex: 1,
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  confirmationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 10,
  },
  confirmationDetail: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 3,
  },
  confirmationSubDetail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 6,
  },
  savedPackageItem: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
  },
  savedPackageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  savedPackageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  removeSavedPackage: {
    padding: 4,
  },
  savedPackageDetail: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 2,
  },
  savedPackageSubDetail: {
    fontSize: 12,
    color: '#888',
  },
  routeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  routePoint: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  routeAreaDetail: {
    fontSize: 12,
    color: '#f97316',
    marginTop: 2,
  },
  routeArrow: {
    paddingHorizontal: 10,
  },
  serviceFeatures: {
    gap: 8,
  },
  serviceFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceFeatureText: {
    fontSize: 14,
    color: '#fff',
  },
  costBreakdown: {
    gap: 8,
  },
  costLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalCostLine: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    marginTop: 4,
  },
  totalCostLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalCostValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1a1a2e',
  },
  spacer: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f97316',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f97316',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  disabledButtonText: {
    color: '#666',
  },

  // MAP MODAL STYLES
  mapModalSafeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: STATUS_BAR_HEIGHT,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  mapContainer: {
    flex: 1,
  },
  mapGradient: {
    flex: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  mapCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  currentLocationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSearchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  mapSearchInput: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 10,
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
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
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
});
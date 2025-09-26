// components/CollectDeliverModal.tsx - FIXED: Auto-population timing and dependencies

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
import { useUser } from '../context/UserContext';
import { 
  type PackageData, 
  type Area, 
  type Agent, 
  type Location as LocationType,
  getPackageFormData,
  updatePackage,
  getAreas,
  getAgents
} from '../lib/helpers/packageHelpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;
const STORAGE_KEY = 'pending_collections';

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
  description?: string;
}

// FIXED: Interface to support different modes
interface CollectDeliverModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (packageData: PackageData) => Promise<void>;
  onUpdate?: (packageId: string, packageData: PackageData) => Promise<void>;
  currentLocation: LocationData | null;
  
  // NEW: Mode and package data props
  mode?: 'create' | 'edit' | 'resubmit';
  editPackage?: any; // Package data when editing
  resubmitPackage?: any; // Package data when resubmitting
  packageId?: string;
}

interface PendingCollection {
  id: string;
  shopName: string;
  shopContact: string;
  collectionAddress: string;
  itemsToCollect: string;
  itemValue: string;
  itemDescription: string;
  specialInstructions: string;
  selectedArea: Area | null;
  collectionLocation: LocationData | null;
  createdAt: number;
}

// FIXED: Improved Location/Area Selection Modal with better error handling
const LocationAreaSelectorModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData, area?: Area, agent?: Agent) => void;
  title: string;
  type: 'collection' | 'delivery';
  currentLocation?: LocationData | null;
}> = ({ visible, onClose, onLocationSelect, title, type, currentLocation }) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
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
      setLocationError(null);
      
      const [areasData, agentsData] = await Promise.all([
        getAreas(),
        type === 'delivery' ? getAgents() : Promise.resolve([])
      ]);
      
      setAreas(areasData || []);
      setAgents(agentsData || []);
      
    } catch (error) {
      console.error('Failed to load location data:', error);
      setLocationError('Failed to load locations');
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
      setSearchQuery('');
      setLocationError(null);
      onClose();
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
    if (!searchQuery || type === 'collection') return agents;
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
      setLocationError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable location services.');
        return;
      }

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
        description: 'Your current GPS position'
      };

      onLocationSelect(currentLoc);
      closeModal();
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Failed to get current location');
    }
  };

  const renderAreaItem = ({ item }: { item: Area }) => (
    <TouchableOpacity style={styles.locationItem} onPress={() => handleAreaSelect(item)}>
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
      <Feather name="chevron-right" size={20} color="#10b981" />
    </TouchableOpacity>
  );

  const renderAgentItem = ({ item }: { item: Agent }) => (
    <TouchableOpacity style={styles.locationItem} onPress={() => handleAgentSelect(item)}>
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
      <Feather name="chevron-right" size={20} color="#10b981" />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.mapModalSafeArea}>
        <Animated.View
          style={[styles.mapModalContainer, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.mapContainer}>
            <LinearGradient colors={['#0a0a23', '#1a1a2e', '#2d3748']} style={styles.mapGradient}>
              <View style={styles.mapHeader}>
                <TouchableOpacity onPress={closeModal} style={styles.mapCloseButton}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.mapHeaderTitle}>{title}</Text>
                <TouchableOpacity onPress={useCurrentLocation} style={styles.currentLocationButton}>
                  <Feather name="target" size={20} color="#10b981" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.mapSearchContainer}>
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search for areas or agents..."
                  placeholderTextColor="#888"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {locationError && (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{locationError}</Text>
                  <TouchableOpacity onPress={() => setLocationError(null)}>
                    <Text style={styles.dismissText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Loading locations...</Text>
                  </View>
                ) : (
                  <View>
                    {filteredAreas.length > 0 && (
                      <View>
                        <Text style={styles.sectionTitle}>
                          Areas ({filteredAreas.length})
                        </Text>
                        <FlatList
                          data={filteredAreas}
                          keyExtractor={(item) => `area-${item.id}`}
                          renderItem={renderAreaItem}
                          scrollEnabled={false}
                        />
                      </View>
                    )}
                    
                    {type === 'delivery' && filteredAgents.length > 0 && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={styles.sectionTitle}>
                          Agents ({filteredAgents.length})
                        </Text>
                        <FlatList
                          data={filteredAgents}
                          keyExtractor={(item) => `agent-${item.id}`}
                          renderItem={renderAgentItem}
                          scrollEnabled={false}
                        />
                      </View>
                    )}
                    
                    {filteredAreas.length === 0 && (type === 'collection' || filteredAgents.length === 0) && (
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

export default function CollectDeliverModal({
  visible,
  onClose,
  onSubmit,
  onUpdate,
  currentLocation: initialLocation,
  mode = 'create',
  editPackage,
  resubmitPackage,
  packageId
}: CollectDeliverModalProps) {
  // User context integration
  const { user, getDisplayName, getUserPhone } = useUser();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // FIXED: Add areas and agents state for auto-population with dependency tracking
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasTriedAutoPopulation, setHasTriedAutoPopulation] = useState(false);
  
  // Location states with enhanced error handling
  const [collectionLocation, setCollectionLocation] = useState<LocationData | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(initialLocation);
  const [selectedCollectionArea, setSelectedCollectionArea] = useState<Area | null>(null);
  const [selectedDeliveryArea, setSelectedDeliveryArea] = useState<Area | null>(null);
  const [selectedDeliveryAgent, setSelectedDeliveryAgent] = useState<Agent | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Pending collections state (only for create mode)
  const [pendingCollections, setPendingCollections] = useState<PendingCollection[]>([]);
  
  // Form states
  const [shopName, setShopName] = useState('');
  const [shopContact, setShopContact] = useState('');
  const [collectionAddress, setCollectionAddress] = useState('');
  const [itemsToCollect, setItemsToCollect] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
  
  // Refs for TextInputs to prevent focus loss
  const specialInstructionsRef = useRef<TextInput>(null);
  const itemDescriptionRef = useRef<TextInput>(null);
  const collectionAddressRef = useRef<TextInput>(null);
  const deliveryAddressRef = useRef<TextInput>(null);
  
  // Map modal states
  const [showCollectionMapModal, setShowCollectionMapModal] = useState(false);
  const [showDeliveryMapModal, setShowDeliveryMapModal] = useState(false);
  
  // FIXED: Dynamic step titles based on mode
  const STEP_TITLES = useMemo(() => {
    const baseSteps = [
      'Collection Details',
      'Item Information', 
      'Delivery Setup',
      `${mode === 'edit' ? 'Update' : mode === 'resubmit' ? 'Resubmit' : 'Payment'} & Confirmation`
    ];
    return baseSteps;
  }, [mode]);

  // FIXED: Mode-specific UI text
  const getModeText = useCallback(() => {
    switch (mode) {
      case 'edit':
        return {
          title: 'Edit Collection Request',
          submitButton: 'Update Collection Request',
          confirmationTitle: 'Update Collection & Delivery',
          actionVerb: 'update'
        };
      case 'resubmit':
        return {
          title: 'Resubmit Collection Request',
          submitButton: 'Resubmit Collection Request',
          confirmationTitle: 'Resubmit Collection & Delivery',
          actionVerb: 'resubmit'
        };
      default:
        return {
          title: 'Create Collection Request',
          submitButton: 'Create Collection Request',
          confirmationTitle: 'Payment & Confirmation',
          actionVerb: 'create'
        };
    }
  }, [mode]);

  // FIXED: Load areas and agents data for auto-population with retry mechanism
  const loadModalData = useCallback(async (retryCount = 0): Promise<void> => {
    console.log(`🔄 Loading collection modal reference data (attempt ${retryCount + 1})`);
    
    try {
      setIsDataLoading(true);
      setDataError(null);
      
      const [areasData, agentsData] = await Promise.allSettled([
        getAreas(),
        getAgents()
      ]);
      
      if (areasData.status === 'fulfilled') {
        setAreas(areasData.value || []);
        console.log('✅ Areas loaded:', areasData.value?.length);
      } else {
        console.error('❌ Failed to load areas:', areasData.reason);
        setDataError('Failed to load areas');
      }
      
      if (agentsData.status === 'fulfilled') {
        setAgents(agentsData.value || []);
        console.log('✅ Agents loaded:', agentsData.value?.length);
      } else {
        console.error('❌ Failed to load agents:', agentsData.reason);
        // Agents are optional, so don't set error
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load modal data:', error);
      
      if (retryCount < 2) {
        console.log('🔄 Retrying modal data load...');
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadModalData(retryCount + 1);
      }
      
      setDataError(`Failed to load data: ${error.message}`);
      throw error;
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  // FIXED: Enhanced auto-population with comprehensive ID matching and proper timing
  const populateFormFromExistingPackage = useCallback(async () => {
    const packageData = editPackage || resubmitPackage;
    if (!packageData || mode === 'create') return;

    console.log('🔧 Populating form with existing package data:', packageData.code);
    console.log('📦 Package data:', packageData);
    console.log('🏢 Available areas:', areas.length);
    console.log('👤 Available agents:', agents.length);

    // CRITICAL: Ensure areas and agents are loaded before auto-populating
    if (areas.length === 0 || agents.length === 0) {
      console.log('⏳ Waiting for areas/agents to load before populating form...');
      return; // Will be called again after data loads
    }

    // Basic form fields
    setShopName(packageData.shop_name || '');
    setShopContact(packageData.shop_contact || '');
    setCollectionAddress(packageData.collection_address || '');
    setItemsToCollect(packageData.items_to_collect || '');
    setItemValue(packageData.item_value?.toString() || '');
    setItemDescription(packageData.item_description || '');
    setDeliveryAddress(packageData.delivery_location || '');
    setSpecialInstructions(packageData.special_instructions || '');
    setPaymentMethod(packageData.payment_method || 'mpesa');

    // FIXED: Enhanced area/agent matching with comprehensive ID comparison
    let collectionAreaFound = false;
    let deliveryAreaFound = false;
    let deliveryAgentFound = false;

    // FIXED: Auto-select collection area with multiple ID formats
    if (packageData.origin_area_id) {
      console.log('🔍 Looking for collection area ID:', packageData.origin_area_id, typeof packageData.origin_area_id);
      
      const collectionArea = areas.find(area => {
        const areaIdStr = String(area.id);
        const pkgAreaIdStr = String(packageData.origin_area_id);
        const match = areaIdStr === pkgAreaIdStr || 
                     area.id === packageData.origin_area_id ||
                     Number(area.id) === Number(packageData.origin_area_id);
        
        if (match) {
          console.log('✅ Found matching collection area:', area.name, 'Area ID:', area.id);
        }
        return match;
      });
      
      if (collectionArea) {
        console.log('✅ Auto-selected collection area:', collectionArea.name);
        setSelectedCollectionArea(collectionArea);
        collectionAreaFound = true;
      } else {
        console.warn('⚠️ Collection area not found for ID:', packageData.origin_area_id);
        console.log('🔍 Available area IDs:', areas.map(a => `${a.id} (${typeof a.id})`));
      }
    }

    // FIXED: Auto-select delivery area or agent with comprehensive ID matching
    if (packageData.destination_agent_id) {
      console.log('🔍 Looking for delivery agent ID:', packageData.destination_agent_id, typeof packageData.destination_agent_id);
      
      const deliveryAgent = agents.find(agent => {
        const agentIdStr = String(agent.id);
        const pkgAgentIdStr = String(packageData.destination_agent_id);
        const match = agentIdStr === pkgAgentIdStr || 
                     agent.id === packageData.destination_agent_id ||
                     Number(agent.id) === Number(packageData.destination_agent_id);
        
        if (match) {
          console.log('✅ Found matching delivery agent:', agent.name, 'Agent ID:', agent.id);
        }
        return match;
      });
      
      if (deliveryAgent) {
        console.log('✅ Auto-selected delivery agent:', deliveryAgent.name);
        setSelectedDeliveryAgent(deliveryAgent);
        setSelectedDeliveryArea(deliveryAgent.area || null);
        deliveryAgentFound = true;
      } else {
        console.warn('⚠️ Delivery agent not found for ID:', packageData.destination_agent_id);
        console.log('🔍 Available agent IDs:', agents.map(a => `${a.id} (${typeof a.id})`));
      }
    } else if (packageData.destination_area_id) {
      console.log('🔍 Looking for delivery area ID:', packageData.destination_area_id, typeof packageData.destination_area_id);
      
      const deliveryArea = areas.find(area => {
        const areaIdStr = String(area.id);
        const pkgAreaIdStr = String(packageData.destination_area_id);
        const match = areaIdStr === pkgAreaIdStr || 
                     area.id === packageData.destination_area_id ||
                     Number(area.id) === Number(packageData.destination_area_id);
        
        if (match) {
          console.log('✅ Found matching delivery area:', area.name, 'Area ID:', area.id);
        }
        return match;
      });
      
      if (deliveryArea) {
        console.log('✅ Auto-selected delivery area:', deliveryArea.name);
        setSelectedDeliveryArea(deliveryArea);
        deliveryAreaFound = true;
      } else {
        console.warn('⚠️ Delivery area not found for ID:', packageData.destination_area_id);
        console.log('🔍 Available area IDs:', areas.map(a => `${a.id} (${typeof a.id})`));
      }
    }

    // Location data
    if (packageData.pickup_latitude && packageData.pickup_longitude) {
      setCollectionLocation({
        latitude: packageData.pickup_latitude,
        longitude: packageData.pickup_longitude,
        address: packageData.collection_address || 'Collection Location'
      });
    }

    if (packageData.delivery_latitude && packageData.delivery_longitude) {
      setDeliveryLocation({
        latitude: packageData.delivery_latitude,
        longitude: packageData.delivery_longitude,
        address: packageData.delivery_location || 'Delivery Location'
      });
    }

    // FIXED: Handle step navigation for resubmit mode
    if (mode === 'resubmit') {
      console.log('🔄 Resubmit mode: navigating to confirmation step');
      setCurrentStep(STEP_TITLES.length - 1); // Skip to confirmation
    } else {
      console.log('✏️ Edit mode: starting from first step');
      setCurrentStep(0);
    }

    // Mark auto-population as completed
    setHasTriedAutoPopulation(true);

    console.log('✅ Form populated successfully', {
      collectionAreaFound,
      deliveryAreaFound,
      deliveryAgentFound
    });
  }, [editPackage, resubmitPackage, mode, areas, agents, STEP_TITLES.length]);

  // Load pending collections from AsyncStorage (only for create mode)
  const loadPendingCollections = async () => {
    if (mode !== 'create') return;
    
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const collections = JSON.parse(saved);
        setPendingCollections(collections);
        console.log('Loaded pending collections from storage:', collections.length);
      }
    } catch (error) {
      console.error('Failed to load pending collections:', error);
    }
  };

  // Save pending collections to AsyncStorage (only for create mode)
  const savePendingCollections = async (collections: PendingCollection[]) => {
    if (mode !== 'create') return;
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
      console.log('Saved pending collections to storage:', collections.length);
    } catch (error) {
      console.error('Failed to save pending collections:', error);
    }
  };

  // FIXED: Location permission handling with better error states
  const requestLocationPermission = async () => {
    try {
      setIsLocationLoading(true);
      setLocationError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable location services.');
        return;
      }
      
      if (!deliveryLocation) {
        const location = await Location.getCurrentPositionAsync({});
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        setDeliveryLocation({
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

  // FIXED: Proper initialization sequence with dependency management
  useEffect(() => {
    if (!visible) return;
    
    const initializeModal = async () => {
      try {
        console.log('🚀 Initializing modal in mode:', mode);
        
        // Reset states
        setHasTriedAutoPopulation(false);
        setDataError(null);
        
        // Step 1: Load areas and agents data FIRST
        await loadModalData();
        
        // Step 2: Request location permission and get current location
        await requestLocationPermission();
        
        // Step 3: Load pending collections only for create mode
        if (mode === 'create') {
          await loadPendingCollections();
        }

        setIsInitialized(true);
        console.log('✅ Modal initialization complete');
      } catch (error) {
        console.error('Failed to initialize modal:', error);
      }
    };

    initializeModal();
  }, [visible, mode]);

  // FIXED: Auto-populate when data becomes available
  useEffect(() => {
    if (isInitialized && areas.length > 0 && agents.length > 0 && !hasTriedAutoPopulation) {
      if ((mode === 'edit' || mode === 'resubmit') && (editPackage || resubmitPackage)) {
        console.log('🔄 Reference data available, attempting auto-population...');
        // Small delay to ensure state is updated
        setTimeout(() => {
          populateFormFromExistingPackage();
        }, 100);
      } else {
        // Mark as tried even if no package to load
        setHasTriedAutoPopulation(true);
      }
    }
  }, [isInitialized, areas.length, agents.length, hasTriedAutoPopulation, mode, editPackage, resubmitPackage, populateFormFromExistingPackage]);

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

  // FIXED: Keyboard handling with better offset calculation
  useEffect(() => {
    let keyboardWillShowListener: any;
    let keyboardWillHideListener: any;
    let keyboardDidShowListener: any;
    let keyboardDidHideListener: any;

    if (Platform.OS === 'ios') {
      keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      });
      keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      });
    } else {
      keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      });
      keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      });
    }

    return () => {
      if (Platform.OS === 'ios') {
        keyboardWillShowListener?.remove();
        keyboardWillHideListener?.remove();
      } else {
        keyboardDidShowListener?.remove();
        keyboardDidHideListener?.remove();
      }
    };
  }, []);

  // Modal animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // FIXED: Modal height calculation with improved keyboard handling
  const modalHeight = useMemo(() => {
    if (isKeyboardVisible) {
      const availableHeight = SCREEN_HEIGHT - keyboardHeight;
      const maxModalHeight = availableHeight - STATUS_BAR_HEIGHT - 20;
      return Math.min(maxModalHeight, availableHeight * 0.85);
    }
    return SCREEN_HEIGHT * 0.90;
  }, [isKeyboardVisible, keyboardHeight]);

  const resetForm = useCallback(async () => {
    setCurrentStep(0);
    setShopName('');
    setShopContact('');
    setCollectionAddress('');
    setItemsToCollect('');
    setItemValue('');
    setItemDescription('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setPaymentMethod('mpesa');
    setCollectionLocation(null);
    setDeliveryLocation(initialLocation);
    setSelectedCollectionArea(null);
    setSelectedDeliveryArea(null);
    setSelectedDeliveryAgent(null);
    setLocationError(null);
    setDataError(null);
    
    if (mode === 'create') {
      setPendingCollections([]);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    
    onClose();
  }, [initialLocation, onClose, mode]);

  const resetForNewCollection = useCallback(() => {
    setCurrentStep(0);
    setShopName('');
    setShopContact('');
    setCollectionAddress('');
    setItemsToCollect('');
    setItemValue('');
    setItemDescription('');
    setSpecialInstructions('');
    setCollectionLocation(null);
    setSelectedCollectionArea(null);
    // Keep delivery info for convenience
  }, []);

  const closeModal = useCallback(() => {
    if (mode === 'create' && pendingCollections.length > 0) {
      Alert.alert(
        'Unsaved Collections',
        `You have ${pendingCollections.length} unsaved collection(s). If you close now, all progress will be lost.`,
        [
          {
            text: 'Continue Editing',
            style: 'cancel'
          },
          {
            text: 'Close and Lose Progress',
            style: 'destructive',
            onPress: resetForm
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
        resetForm();
      });
    }
  }, [pendingCollections.length, resetForm, mode, slideAnim]);

  // Location selection handlers
  const handleCollectionLocationSelect = (location: LocationData, area?: Area) => {
    setCollectionLocation(location);
    if (area) setSelectedCollectionArea(area);
  };

  const handleDeliveryLocationSelect = (location: LocationData, area?: Area, agent?: Agent) => {
    setDeliveryLocation(location);
    if (area) setSelectedDeliveryArea(area);
    if (agent) setSelectedDeliveryAgent(agent);
  };

  // Add current collection to pending list (only for create mode)
  const addAnotherCollection = useCallback(async () => {
    if (mode !== 'create') return;

    if (!shopName.trim() || !collectionAddress.trim() || !itemsToCollect.trim() || !itemValue.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields before adding another collection.');
      return;
    }

    const newPendingCollection: PendingCollection = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      shopName,
      shopContact,
      collectionAddress,
      itemsToCollect,
      itemValue,
      itemDescription,
      specialInstructions,
      selectedArea: selectedCollectionArea,
      collectionLocation,
      createdAt: Date.now()
    };
    
    const updatedCollections = [...pendingCollections, newPendingCollection];
    setPendingCollections(updatedCollections);
    await savePendingCollections(updatedCollections);
    console.log('Added pending collection. Total pending:', updatedCollections.length);
    resetForNewCollection();
  }, [
    mode, shopName, shopContact, collectionAddress, itemsToCollect, itemValue, 
    itemDescription, specialInstructions, selectedCollectionArea, 
    collectionLocation, pendingCollections, resetForNewCollection
  ]);

  // Remove pending collection (only for create mode)
  const removePendingCollection = useCallback(async (collectionId: string) => {
    if (mode !== 'create') return;
    
    const updatedCollections = pendingCollections.filter(coll => coll.id !== collectionId);
    setPendingCollections(updatedCollections);
    await savePendingCollections(updatedCollections);
    console.log('Removed pending collection. Total pending:', updatedCollections.length);
  }, [pendingCollections, mode]);

  const isStepValid = useCallback((step: number) => {
    switch (step) {
      case 0:
        return shopName.trim().length > 0 && collectionAddress.trim().length > 0;
      case 1:
        return itemsToCollect.trim().length > 0 && itemValue.trim().length > 0;
      case 2:
        return deliveryAddress.trim().length > 0;
      case 3:
        // For edit/resubmit, payment method is not required
        return mode === 'edit' || mode === 'resubmit' || paymentMethod.length > 0;
      default:
        return false;
    }
  }, [shopName, collectionAddress, itemsToCollect, itemValue, deliveryAddress, paymentMethod, mode]);

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

  const calculateCosts = () => {
    const collectionFee = 200;
    const deliveryFee = 250;
    const itemValueNum = parseFloat(itemValue) || 0;
    const insuranceFee = Math.max(50, itemValueNum * 0.02);
    const serviceFee = 100;
    
    return {
      collection: collectionFee,
      delivery: deliveryFee,
      insurance: Math.round(insuranceFee),
      service: serviceFee,
      total: collectionFee + deliveryFee + Math.round(insuranceFee) + serviceFee
    };
  };

  // FIXED: Handle submission based on mode with user details
  const handleSubmit = async () => {
    if (!isStepValid(currentStep) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Use actual user details instead of hardcoded values
      const userName = getDisplayName();
      const userPhone = getUserPhone();
      
      // Get proper destination area ID from selected agent or area
      const destinationAreaId = selectedDeliveryAgent?.area?.id || selectedDeliveryArea?.id || undefined;
      
      // Create package data
      const packageData: PackageData = {
        sender_name: userName,
        sender_phone: userPhone,
        receiver_name: userName,
        receiver_phone: userPhone,
        
        origin_area_id: selectedCollectionArea?.id || undefined,
        destination_area_id: destinationAreaId,
        origin_agent_id: undefined,
        destination_agent_id: selectedDeliveryAgent?.id || undefined,
        
        delivery_type: 'collection',
        delivery_location: deliveryAddress,
        
        shop_name: shopName,
        shop_contact: shopContact,
        collection_address: collectionAddress,
        items_to_collect: itemsToCollect,
        item_value: parseFloat(itemValue) || 0,
        item_description: itemDescription.trim() || itemsToCollect,
        special_instructions: specialInstructions.trim(),
        payment_method: paymentMethod,
        collection_type: 'shop_pickup',
        
        pickup_latitude: collectionLocation?.latitude || 0,
        pickup_longitude: collectionLocation?.longitude || 0,
        delivery_latitude: deliveryLocation?.latitude || 0,
        delivery_longitude: deliveryLocation?.longitude || 0,
        
        collection_scheduled_at: null,
        payment_deadline: null,
      };

      if (mode === 'edit' && packageId && onUpdate) {
        console.log('Updating collection package:', packageId);
        await onUpdate(packageId, packageData);
        resetForm();
      } else if (mode === 'resubmit' && packageId && onUpdate) {
        console.log('Resubmitting collection package:', packageId);
        await onUpdate(packageId, packageData);
        resetForm();
      } else if (mode === 'create' && onSubmit) {
        // Handle multiple collections for create mode
        const currentCollection = {
          id: Date.now().toString(),
          shopName,
          shopContact,
          collectionAddress,
          itemsToCollect,
          itemValue,
          itemDescription,
          specialInstructions,
          selectedArea: selectedCollectionArea,
          collectionLocation,
          createdAt: Date.now()
        };

        const allCollections = [...pendingCollections, currentCollection];
        console.log(`Creating ${allCollections.length} collection(s)`);

        // Submit each collection
        for (const collection of allCollections) {
          const collectionPackageData: PackageData = {
            ...packageData,
            shop_name: collection.shopName,
            shop_contact: collection.shopContact,
            collection_address: collection.collectionAddress,
            items_to_collect: collection.itemsToCollect,
            item_value: parseFloat(collection.itemValue) || 0,
            item_description: collection.itemDescription.trim() || collection.itemsToCollect,
            special_instructions: collection.specialInstructions.trim(),
            origin_area_id: collection.selectedArea?.id || undefined,
            pickup_latitude: collection.collectionLocation?.latitude || 0,
            pickup_longitude: collection.collectionLocation?.longitude || 0,
          };
          
          await onSubmit(collectionPackageData);
        }

        // Clear storage and reset form after successful submission
        await AsyncStorage.removeItem(STORAGE_KEY);
        setPendingCollections([]);
        resetForm();
      }
      
    } catch (error) {
      console.error(`Error ${mode}ing collect & deliver request:`, error);
      Alert.alert('Error', `Failed to ${mode} collection request. Please try again.`);
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
            await loadModalData();
            setIsInitialized(true);
          } catch (error) {
            console.error('❌ Retry failed:', error);
          }
        };
        
        initializeModal();
      }
    }, 500);
  }, [visible, loadModalData]);

  const renderProgressBar = useCallback(() => (
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
        Step {currentStep + 1} of {STEP_TITLES.length}
        {mode === 'create' && pendingCollections.length > 0 && ` • ${pendingCollections.length} collection${pendingCollections.length > 1 ? 's' : ''} pending`}
      </Text>
    </View>
  ), [currentStep, pendingCollections.length, mode]);

  const renderHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STEP_TITLES[currentStep]}</Text>
        <View style={styles.placeholder} />
      </View>
    </View>
  ), [closeModal, currentStep]);

  // FIXED: Loading state with proper messaging
  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#10b981" />
      <Text style={styles.loadingTitle}>
        {isDataLoading ? 'Loading Reference Data' : 'Initializing Modal'}
      </Text>
      <Text style={styles.loadingSubtitle}>
        {isDataLoading 
          ? 'Fetching areas and agents...' 
          : 'Preparing collection form...'
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

  // FIXED: Collection details step with data loading state
  const renderCollectionDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {mode === 'edit' ? 'Edit Collection Setup' : mode === 'resubmit' ? 'Update Collection Details' : 'Collection Setup'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {mode === 'edit' ? 'Update collection details' : mode === 'resubmit' ? 'Review and update collection information' : 'Where should we collect your items from?'}
      </Text>
      
      {/* Mode-specific notices */}
      {(mode === 'edit' || mode === 'resubmit') && (
        <View style={styles.modeNoticeSection}>
          <Feather 
            name={mode === 'edit' ? 'edit-3' : 'refresh-cw'} 
            size={16} 
            color={mode === 'edit' ? '#8b5cf6' : '#10b981'} 
          />
          <Text style={[styles.modeNoticeText, { color: mode === 'edit' ? '#8b5cf6' : '#10b981' }]}>
            {mode === 'edit' ? 'You are editing an existing collection request' : 'You are resubmitting a collection request'}
          </Text>
        </View>
      )}

      {/* Data loading notice */}
      {isDataLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={styles.loadingText}>Loading location data...</Text>
        </View>
      )}

      {/* Data error banner */}
      {dataError && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{dataError}</Text>
          <TouchableOpacity onPress={retryDataLoad}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Location error banner */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity onPress={requestLocationPermission}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Location loading banner */}
      {isLocationLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}
      
      <View style={styles.formContainer}>
        <TextInput
          key="shop-name-input"
          style={styles.input}
          placeholder="Shop/Store Name *"
          placeholderTextColor="#888"
          value={shopName}
          onChangeText={setShopName}
          autoCapitalize="words"
        />
        
        <TextInput
          key="shop-contact-input"
          style={styles.input}
          placeholder="Shop Contact Number (optional)"
          placeholderTextColor="#888"
          value={shopContact}
          onChangeText={setShopContact}
          keyboardType="phone-pad"
        />
        
        <TextInput
          ref={collectionAddressRef}
          key="collection-address-input"
          style={[styles.input, styles.textArea]}
          placeholder="Collection address, building details, floor, etc. *"
          placeholderTextColor="#888"
          value={collectionAddress}
          onChangeText={setCollectionAddress}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Collection Area (Optional)</Text>
        <TouchableOpacity 
          style={[styles.locationInput, selectedCollectionArea && styles.locationInputSelected]}
          onPress={() => setShowCollectionMapModal(true)}
          disabled={isDataLoading}
        >
          <Text style={[styles.locationText, selectedCollectionArea && styles.locationTextSelected]}>
            {isDataLoading ? 'Loading areas...' :
             selectedCollectionArea ? 
              `${selectedCollectionArea.name} • ${selectedCollectionArea.location?.name}` :
              'Tap to select collection area (optional)'
            }
          </Text>
          <Feather 
            name={isDataLoading ? "loader" : "map"} 
            size={20} 
            color={selectedCollectionArea ? "#10b981" : "#666"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.serviceInfo}>
        <Feather name="info" size={16} color="#10b981" />
        <Text style={styles.serviceInfoText}>
          Our rider will visit the shop, collect your items, and deliver them to your specified location.
        </Text>
      </View>
    </View>
  );

  const renderItemInformation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {mode === 'edit' ? 'Edit Item Details' : mode === 'resubmit' ? 'Update Item Information' : 'Item Details'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {mode === 'edit' ? 'Update item information' : mode === 'resubmit' ? 'Review and update item details' : 'Tell us about the items we\'ll be collecting'}
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          key="items-to-collect-input"
          style={[styles.input, styles.textArea]}
          placeholder="What items should we collect? (e.g., phone, laptop, documents) *"
          placeholderTextColor="#888"
          value={itemsToCollect}
          onChangeText={setItemsToCollect}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        
        <TextInput
          key="item-value-input"
          style={styles.input}
          placeholder="Estimated total value (KES) *"
          placeholderTextColor="#888"
          value={itemValue}
          onChangeText={setItemValue}
          keyboardType="numeric"
        />
        
        <TextInput
          ref={itemDescriptionRef}
          key="item-description-input"
          style={[styles.input, styles.textArea]}
          placeholder="Additional item description or details (optional)"
          placeholderTextColor="#888"
          value={itemDescription}
          onChangeText={setItemDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.valueNotice}>
        <Feather name="shield" size={16} color="#10b981" />
        <Text style={styles.valueNoticeText}>
          Insurance will be calculated based on item value (minimum KES 50, 2% of value)
        </Text>
      </View>
    </View>
  );

  const renderDeliverySetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {mode === 'edit' ? 'Edit Delivery Setup' : mode === 'resubmit' ? 'Update Delivery Details' : 'Delivery Setup'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {mode === 'edit' ? 'Update delivery information' : mode === 'resubmit' ? 'Review and update delivery details' : 'Where should we deliver your collected items?'}
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          ref={deliveryAddressRef}
          key="delivery-address-input"
          style={[styles.input, styles.textArea]}
          placeholder="Your delivery address, building details, floor, etc. *"
          placeholderTextColor="#888"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        
        <TextInput
          ref={specialInstructionsRef}
          key="special-instructions-input"
          style={[styles.input, styles.textArea]}
          placeholder="Special delivery instructions (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Delivery Area (Optional)</Text>
        <TouchableOpacity 
          style={[styles.locationInput, (selectedDeliveryArea || selectedDeliveryAgent) && styles.locationInputSelected]}
          onPress={() => setShowDeliveryMapModal(true)}
          disabled={isDataLoading}
        >
          <Text style={[styles.locationText, (selectedDeliveryArea || selectedDeliveryAgent) && styles.locationTextSelected]}>
            {isDataLoading ? 'Loading areas and agents...' :
             selectedDeliveryAgent ? 
              `Agent: ${selectedDeliveryAgent.name} • ${selectedDeliveryAgent.area?.name}` :
              selectedDeliveryArea ? 
                `${selectedDeliveryArea.name} • ${selectedDeliveryArea.location?.name}` :
                'Tap to select delivery area (optional)'
            }
          </Text>
          <Feather 
            name={isDataLoading ? "loader" : "map-pin"} 
            size={20} 
            color={(selectedDeliveryArea || selectedDeliveryAgent) ? "#10b981" : "#666"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.deliveryInfo}>
        <Feather name="clock" size={16} color="#10b981" />
        <Text style={styles.deliveryInfoText}>
          Typical collection and delivery time: 2-4 hours depending on location
        </Text>
      </View>
    </View>
  );

  const renderPaymentConfirmation = () => {
    const costs = calculateCosts();
    const totalCollectionsCount = mode === 'create' ? pendingCollections.length + 1 : 1;
    const modeText = getModeText();
    
    // Calculate costs for all collections (only for create mode)
    const currentCost = costs.total;
    const pendingCosts = mode === 'create' ? pendingCollections.map(coll => {
      const itemValueNum = parseFloat(coll.itemValue) || 0;
      const insuranceFee = Math.max(50, itemValueNum * 0.02);
      return 200 + 250 + Math.round(insuranceFee) + 100;
    }) : [];
    const totalPendingCost = pendingCosts.reduce((sum, cost) => sum + cost, 0);
    const grandTotal = currentCost + totalPendingCost;
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{modeText.confirmationTitle}</Text>
        <Text style={styles.stepSubtitle}>
          {mode === 'create' && pendingCollections.length > 0 ? 
            `Review all ${totalCollectionsCount} collection${totalCollectionsCount > 1 ? 's' : ''} and confirm payment` :
            mode === 'edit' ? 'Review your changes and update the collection request' :
            mode === 'resubmit' ? 'Review your updates and resubmit the collection request' :
            'Review costs and select payment method'
          }
        </Text>
        
        <ScrollView style={styles.confirmationScrollContainer} showsVerticalScrollIndicator={false}>
          {/* Show pending collections only for create mode */}
          {mode === 'create' && pendingCollections.length > 0 && (
            <View style={styles.pendingCollectionsSection}>
              <Text style={styles.confirmationSectionTitle}>Pending Collections ({pendingCollections.length})</Text>
              {pendingCollections.map((collection, index) => (
                <View key={collection.id} style={styles.pendingCollectionItem}>
                  <View style={styles.pendingCollectionHeader}>
                    <Text style={styles.pendingCollectionNumber}>Collection {index + 1}</Text>
                    <TouchableOpacity 
                      onPress={() => removePendingCollection(collection.id)}
                      style={styles.removePendingButton}
                    >
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.pendingCollectionSummary}>
                    {collection.shopName} • {collection.itemsToCollect} • KES {collection.itemValue}
                    {collection.selectedArea && ` • ${collection.selectedArea.name}`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Current Collection Section */}
          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>
              {mode === 'create' && pendingCollections.length > 0 ? `Collection ${pendingCollections.length + 1} Summary` : 
               mode === 'edit' ? 'Updated Collection Summary' :
               mode === 'resubmit' ? 'Resubmission Summary' :
               'Service Summary'}
            </Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Collection from:</Text>
              <Text style={styles.summaryValue}>{shopName}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Items:</Text>
              <Text style={styles.summaryValue}>{itemsToCollect}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Delivery to:</Text>
              <Text style={styles.summaryValue}>{deliveryAddress.length > 30 ? 
                `${deliveryAddress.substring(0, 30)}...` : deliveryAddress}</Text>
            </View>
            {selectedCollectionArea && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Collection area:</Text>
                <Text style={styles.summaryValue}>{selectedCollectionArea.name}</Text>
              </View>
            )}
            {(selectedDeliveryArea || selectedDeliveryAgent) && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Delivery area:</Text>
                <Text style={styles.summaryValue}>
                  {selectedDeliveryAgent ? `Agent: ${selectedDeliveryAgent.name}` : selectedDeliveryArea?.name}
                </Text>
              </View>
            )}
          </View>

          {/* Cost Breakdown (only for create mode) */}
          {mode === 'create' && (
            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationSectionTitle}>
                {pendingCollections.length > 0 ? 'Total Cost Breakdown' : 'Cost Breakdown'}
              </Text>
              <View style={styles.costBreakdown}>
                {pendingCollections.length > 0 ? (
                  <>
                    <View style={styles.costLine}>
                      <Text style={styles.costLabel}>Pending Collections ({pendingCollections.length})</Text>
                      <Text style={styles.costValue}>KES {totalPendingCost}</Text>
                    </View>
                    <View style={styles.costLine}>
                      <Text style={styles.costLabel}>Current Collection</Text>
                      <Text style={styles.costValue}>KES {currentCost}</Text>
                    </View>
                    <View style={[styles.costLine, styles.totalLine]}>
                      <Text style={styles.totalLabel}>Total ({totalCollectionsCount} collections)</Text>
                      <Text style={styles.totalValue}>KES {grandTotal}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.costLine}>
                      <Text style={styles.costLabel}>Collection Fee</Text>
                      <Text style={styles.costValue}>KES {costs.collection}</Text>
                    </View>
                    <View style={styles.costLine}>
                      <Text style={styles.costLabel}>Delivery Fee</Text>
                      <Text style={styles.costValue}>KES {costs.delivery}</Text>
                    </View>
                    <View style={styles.costLine}>
                      <Text style={styles.costLabel}>Insurance</Text>
                      <Text style={styles.costValue}>KES {costs.insurance}</Text>
                    </View>
                    <View style={styles.costLine}>
                      <Text style={styles.costLabel}>Service Fee</Text>
                      <Text style={styles.costValue}>KES {costs.service}</Text>
                    </View>
                    <View style={[styles.costLine, styles.totalLine]}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>KES {costs.total}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Payment Method (only for create mode) */}
          {mode === 'create' && (
            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationSectionTitle}>Payment Method</Text>
              <View style={styles.paymentOptions}>
                <TouchableOpacity
                  style={[styles.paymentOption, paymentMethod === 'mpesa' && styles.paymentOptionSelected]}
                  onPress={() => setPaymentMethod('mpesa')}
                >
                  <Feather name={paymentMethod === 'mpesa' ? 'check-circle' : 'circle'} 
                           size={20} color={paymentMethod === 'mpesa' ? '#10b981' : '#666'} />
                  <Text style={[styles.paymentOptionText, 
                               paymentMethod === 'mpesa' && styles.paymentOptionTextSelected]}>
                    M-Pesa
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
                  onPress={() => setPaymentMethod('card')}
                >
                  <Feather name={paymentMethod === 'card' ? 'check-circle' : 'circle'} 
                           size={20} color={paymentMethod === 'card' ? '#10b981' : '#666'} />
                  <Text style={[styles.paymentOptionText, 
                               paymentMethod === 'card' && styles.paymentOptionTextSelected]}>
                    Card
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.paymentAdvanceNote}>
                <Feather name="info" size={16} color="#10b981" />
                <Text style={styles.paymentAdvanceNoteText}>
                  Please note that collections will not be scheduled until they are paid for. If you submit without payment you can find it in the pending section.
                </Text>
              </View>
            </View>
          )}

          {/* Add Another Collection Section (only for create mode) */}
          {mode === 'create' && (
            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationSectionTitle}>Multiple Collections</Text>
              <TouchableOpacity 
                style={styles.addAnotherButton}
                onPress={addAnotherCollection}
              >
                <Feather name="plus-circle" size={20} color="#10b981" />
                <Text style={styles.addAnotherButtonText}>Add Another Collection</Text>
              </TouchableOpacity>
              <Text style={styles.addAnotherDescription}>
                Need to collect items from multiple shops? Add another collection to this order.
              </Text>
            </View>
          )}

          {/* Mode-specific notes */}
          {mode === 'edit' && (
            <View style={styles.confirmationSection}>
              <View style={styles.editNote}>
                <Feather name="edit-3" size={16} color="#10b981" />
                <Text style={styles.editNoteText}>
                  You are updating an existing collection request. Changes will be saved when you click Update.
                </Text>
              </View>
            </View>
          )}

          {mode === 'resubmit' && (
            <View style={styles.confirmationSection}>
              <View style={styles.resubmitNote}>
                <Feather name="refresh-cw" size={16} color="#10b981" />
                <Text style={styles.resubmitNoteText}>
                  You are resubmitting a collection request. The updated information will be processed for delivery.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderCollectionDetails();
      case 1:
        return renderItemInformation();
      case 2:
        return renderDeliverySetup();
      case 3:
        return renderPaymentConfirmation();
      default:
        return null;
    }
  };

  const renderNavigationButtons = () => {
    const modeText = getModeText();
    
    return (
      <View style={styles.navigationContainer}>
        <View style={styles.navigationBackground}>
          <View style={styles.navigationContent}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={prevStep}>
                <Feather name="arrow-left" size={20} color="#10b981" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.spacer} />
            
            {currentStep < STEP_TITLES.length - 1 ? (
              <TouchableOpacity 
                style={[styles.nextButton, !isStepValid(currentStep) && styles.nextButtonDisabled]} 
                onPress={nextStep}
                disabled={!isStepValid(currentStep)}
              >
                <Text style={[styles.nextButtonText, !isStepValid(currentStep) && styles.nextButtonTextDisabled]}>
                  Next
                </Text>
                <Feather name="arrow-right" size={20} color={isStepValid(currentStep) ? "#fff" : "#888"} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.submitButton, (!isStepValid(currentStep) || isSubmitting) && styles.submitButtonDisabled]} 
                onPress={handleSubmit}
                disabled={!isStepValid(currentStep) || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={[styles.submitButtonText, 
                                 (!isStepValid(currentStep) || isSubmitting) && styles.submitButtonTextDisabled]}>
                      {mode === 'create' && pendingCollections.length > 0 ? 
                        `Create ${pendingCollections.length + 1} Collection${pendingCollections.length > 0 ? 's' : ''}` :
                        modeText.submitButton
                      }
                    </Text>
                    <Feather 
                      name={mode === 'edit' ? 'save' : mode === 'resubmit' ? 'refresh-cw' : 'check'} 
                      size={20} 
                      color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#888"} 
                    />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

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
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {renderStepContent()}
          </ScrollView>
        </View>
        
        {renderNavigationButtons()}
      </>
    );
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent={false}
        onRequestClose={closeModal}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.8)" barStyle="light-content" />
        
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
                    height: modalHeight,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <LinearGradient
                  colors={['#0a0a23', '#1a1a2e', '#16213e']}
                  style={styles.modalContent}
                >
                  {renderMainContent()}
                </LinearGradient>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Location Picker Modals */}
      <LocationAreaSelectorModal
        visible={showCollectionMapModal}
        onClose={() => setShowCollectionMapModal(false)}
        onLocationSelect={handleCollectionLocationSelect}
        title="Select Collection Area"
        type="collection"
        currentLocation={collectionLocation}
      />
      
      <LocationAreaSelectorModal
        visible={showDeliveryMapModal}
        onClose={() => setShowDeliveryMapModal(false)}
        onLocationSelect={handleDeliveryLocationSelect}
        title="Select Delivery Area"
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
  
  // Header
  headerContainer: {
    backgroundColor: 'rgba(10, 10, 35, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
    zIndex: 1000,
    elevation: Platform.OS === 'android' ? 5 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(10, 10, 35, 0.95)',
  },
  progressBackground: {
    height: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
    lineHeight: 22,
  },

  // Mode notice section
  modeNoticeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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

  // Error and loading banners
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
  },
  retryText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  dismissText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#10b981',
  },
  
  formContainer: {
    gap: 16,
    marginBottom: 20,
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  locationInputSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#888',
  },
  locationTextSelected: {
    color: '#fff',
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  serviceInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  valueNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  valueNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  deliveryInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  
  // Confirmation styles
  confirmationScrollContainer: {
    flex: 1,
  },
  confirmationSection: {
    marginBottom: 20,
  },
  confirmationSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  
  // Pending collections styles
  pendingCollectionsSection: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  pendingCollectionItem: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  pendingCollectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pendingCollectionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  removePendingButton: {
    padding: 4,
  },
  pendingCollectionSummary: {
    fontSize: 13,
    color: '#888',
  },
  
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#888',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  costBreakdown: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  costLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLine: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.3)',
    paddingTop: 8,
    marginTop: 8,
  },
  costLabel: {
    fontSize: 14,
    color: '#888',
  },
  costValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '700',
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  paymentOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  paymentOptionTextSelected: {
    color: '#fff',
  },
  
  // Payment note styles
  paymentAdvanceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  paymentAdvanceNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  
  // Add another collection button styles
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 8,
  },
  addAnotherButtonText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  addAnotherDescription: {
    fontSize: 13,
    color: '#888',
    lineHeight: 16,
  },

  // Mode-specific note styles
  editNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  editNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  resubmitNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  resubmitNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  
  // Navigation
  navigationContainer: {
    backgroundColor: 'rgba(10, 10, 35, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
    zIndex: 1000,
    elevation: Platform.OS === 'android' ? 5 : 0,
  },
  navigationBackground: {
    backgroundColor: 'rgba(10, 10, 35, 0.95)',
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  nextButtonTextDisabled: {
    color: '#888',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    minHeight: 48,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#888',
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
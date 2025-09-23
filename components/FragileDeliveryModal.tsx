// components/FragileDeliveryModal.tsx - Enhanced with edit/resubmit functionality

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

  // NEW: Get modal title based on mode
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

  // NEW: Get action button text based on mode
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

  // NEW: Load package data for editing/resubmitting
  const loadPackageForEditing = useCallback((pkg: Package) => {
    console.log('🔧 Loading fragile package for editing:', pkg.code);
    
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
  }, []);

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
      
      // NEW: Load package data for editing/resubmitting
      if (mode === 'edit' && editPackage) {
        loadPackageForEditing(editPackage);
      } else if (mode === 'resubmit' && resubmitPackage) {
        loadPackageForEditing(resubmitPackage);
      }
    }
  }, [visible, mode, editPackage, resubmitPackage]);

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

  // UPDATED: Handle submission for different modes
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
            sender_name: 'Fragile Service',
            sender_phone: '+254700000000',
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
        sender_name: 'Fragile Service',
        sender_phone: '+254700000000',
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
  
  // NEW: Mode notice section for edit/resubmit
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
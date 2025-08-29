// components/CollectDeliverModal.tsx - FIXED: Areas selection & multiple collection creation

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
import { 
  type PackageData, 
  type Area, 
  type Agent, 
  type Location as LocationType,
  getPackageFormData 
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

interface CollectDeliverModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: LocationData | null;
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

// Enhanced Location/Area Selection Modal Component  
const LocationAreaSelectorModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData, area?: Area, agent?: Agent) => void;
  title: string;
  type: 'collection' | 'delivery';
  areas: Area[];
  agents: Agent[];
  currentLocation?: LocationData | null;
}> = ({ visible, onClose, onLocationSelect, title, type, areas, agents }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{areas: Area[], agents: Agent[]}>({areas: [], agents: []});
  const [isSearching, setIsSearching] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSearchQuery('');
      onClose();
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults({areas: [], agents: []});
      return;
    }
    
    setIsSearching(true);
    try {
      const lowercaseQuery = query.toLowerCase();
      
      const filteredAreas = areas.filter(area => 
        area.name.toLowerCase().includes(lowercaseQuery) ||
        area.location?.name.toLowerCase().includes(lowercaseQuery)
      );
      
      const filteredAgents = type === 'delivery' ? agents.filter(agent => 
        agent.name.toLowerCase().includes(lowercaseQuery) ||
        agent.area?.name.toLowerCase().includes(lowercaseQuery) ||
        agent.area?.location?.name.toLowerCase().includes(lowercaseQuery)
      ) : [];
      
      setSearchResults({ areas: filteredAreas, agents: filteredAgents });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

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
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to use your current location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000,
      });
      
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      const currentLoc: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: reverseGeocode[0] ? 
          `${reverseGeocode[0].street || ''} ${reverseGeocode[0].city || ''}`.trim() || 'Current Location' : 'Current Location',
        name: 'Current Location',
        description: 'Your current GPS position'
      };

      onLocationSelect(currentLoc);
      closeModal();
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Could not get your current location. Please ensure location services are enabled and try again.');
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
                  onChangeText={handleSearch}
                />
                {isSearching && <ActivityIndicator size="small" color="#10b981" />}
              </View>

              <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                <View>
                  {(searchQuery.length > 0 ? searchResults.areas : areas).length > 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>
                        Areas ({searchQuery.length > 0 ? searchResults.areas.length : areas.length})
                      </Text>
                      <FlatList
                        data={searchQuery.length > 0 ? searchResults.areas : areas}
                        keyExtractor={(item) => `area-${item.id}`}
                        renderItem={renderAreaItem}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                  
                  {type === 'delivery' && (searchQuery.length > 0 ? searchResults.agents : agents).length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.sectionTitle}>
                        Agents ({searchQuery.length > 0 ? searchResults.agents.length : agents.length})
                      </Text>
                      <FlatList
                        data={searchQuery.length > 0 ? searchResults.agents : agents}
                        keyExtractor={(item) => `agent-${item.id}`}
                        renderItem={renderAgentItem}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                  
                  {searchQuery.length > 0 && searchResults.areas.length === 0 && searchResults.agents.length === 0 && (
                    <View style={styles.noResults}>
                      <Feather name="search" size={48} color="#666" />
                      <Text style={styles.noResultsText}>No locations found</Text>
                      <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                    </View>
                  )}
                </View>
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
  currentLocation: initialLocation
}: CollectDeliverModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // Areas and agents data
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingFormData, setIsLoadingFormData] = useState(false);
  
  // Location states with area support
  const [collectionLocation, setCollectionLocation] = useState<LocationData | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(initialLocation);
  const [selectedCollectionArea, setSelectedCollectionArea] = useState<Area | null>(null);
  const [selectedDeliveryArea, setSelectedDeliveryArea] = useState<Area | null>(null);
  const [selectedDeliveryAgent, setSelectedDeliveryAgent] = useState<Agent | null>(null);
  
  // Pending collections state
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
  
  // Map modal states
  const [showCollectionMapModal, setShowCollectionMapModal] = useState(false);
  const [showDeliveryMapModal, setShowDeliveryMapModal] = useState(false);
  
  const STEP_TITLES = [
    'Collection Details',
    'Item Information', 
    'Delivery Setup',
    'Payment & Confirmation'
  ];

  // Load pending collections from AsyncStorage
  const loadPendingCollections = async () => {
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

  // Save pending collections to AsyncStorage
  const savePendingCollections = async (collections: PendingCollection[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
      console.log('Saved pending collections to storage');
    } catch (error) {
      console.error('Failed to save pending collections:', error);
    }
  };

  // Load form data including areas
  useEffect(() => {
    const loadFormData = async () => {
      if (!visible) return;
      
      try {
        setIsLoadingFormData(true);
        const formData = await getPackageFormData();
        setAreas(formData.areas || []);
        setAgents(formData.agents || []);
        console.log('Loaded areas and agents:', { 
          areas: formData.areas?.length || 0, 
          agents: formData.agents?.length || 0 
        });

        // Load pending collections
        await loadPendingCollections();
      } catch (error) {
        console.error('Failed to load form data:', error);
      } finally {
        setIsLoadingFormData(false);
      }
    };

    loadFormData();
  }, [visible]);

  // Keyboard handling
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

  // Modal height calculation
  const modalHeight = useMemo(() => {
    const minModalHeight = SCREEN_HEIGHT * 0.6;
    const maxModalHeight = SCREEN_HEIGHT * 0.95;
    
    if (isKeyboardVisible) {
      const availableHeight = SCREEN_HEIGHT - keyboardHeight - STATUS_BAR_HEIGHT - 20;
      return Math.max(minModalHeight, Math.min(availableHeight, maxModalHeight));
    }
    
    return maxModalHeight;
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
    setPendingCollections([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
    onClose();
  }, [initialLocation, onClose]);

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
    if (pendingCollections.length > 0) {
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
      resetForm();
    }
  }, [pendingCollections.length, resetForm]);

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

  // Add current collection to pending list
  const addAnotherCollection = useCallback(async () => {
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
    resetForNewCollection();
  }, [
    shopName, shopContact, collectionAddress, itemsToCollect, itemValue, 
    itemDescription, specialInstructions, selectedCollectionArea, 
    collectionLocation, pendingCollections, resetForNewCollection
  ]);

  // Remove pending collection
  const removePendingCollection = useCallback(async (collectionId: string) => {
    const updatedCollections = pendingCollections.filter(coll => coll.id !== collectionId);
    setPendingCollections(updatedCollections);
    await savePendingCollections(updatedCollections);
  }, [pendingCollections]);

  const isStepValid = useCallback((step: number) => {
    switch (step) {
      case 0:
        return shopName.trim().length > 0 && collectionAddress.trim().length > 0;
      case 1:
        return itemsToCollect.trim().length > 0 && itemValue.trim().length > 0;
      case 2:
        return deliveryAddress.trim().length > 0;
      case 3:
        return paymentMethod.length > 0;
      default:
        return false;
    }
  }, [shopName, collectionAddress, itemsToCollect, itemValue, deliveryAddress, paymentMethod]);

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

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Create all packages - pending collections + current
      const allCollections = [
        ...pendingCollections,
        {
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
        }
      ];

      // Submit each collection
      for (const collection of allCollections) {
        const packageData: PackageData = {
          sender_name: 'Collection Service',
          sender_phone: '+254700000000', 
          receiver_name: 'Current User',
          receiver_phone: '+254700000000',
          
          origin_area_id: collection.selectedArea?.id || undefined,
          destination_area_id: selectedDeliveryArea?.id || selectedDeliveryAgent?.area?.id || undefined,
          origin_agent_id: undefined,
          destination_agent_id: selectedDeliveryAgent?.id || undefined,
          
          delivery_type: 'collection',
          delivery_location: deliveryAddress,
          
          shop_name: collection.shopName,
          shop_contact: collection.shopContact,
          collection_address: collection.collectionAddress,
          items_to_collect: collection.itemsToCollect,
          item_value: parseFloat(collection.itemValue) || 0,
          item_description: collection.itemDescription.trim() || collection.itemsToCollect,
          special_instructions: collection.specialInstructions.trim(),
          payment_method: paymentMethod,
          collection_type: 'shop_pickup',
          
          pickup_latitude: collection.collectionLocation?.latitude || 0,
          pickup_longitude: collection.collectionLocation?.longitude || 0,
          delivery_latitude: deliveryLocation?.latitude || 0,
          delivery_longitude: deliveryLocation?.longitude || 0,
          
          collection_scheduled_at: null,
          payment_deadline: null,
        };

        console.log('Submitting collection package data:', packageData);
        await onSubmit(packageData);
      }

      console.log(`Successfully submitted ${allCollections.length} collection(s)`);
      
      // Clear AsyncStorage after successful submission
      await AsyncStorage.removeItem(STORAGE_KEY);
      setPendingCollections([]);
      
      closeModal();
    } catch (error) {
      console.error('Error submitting collect & deliver request:', error);
      Alert.alert('Error', 'Failed to create collection request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        {pendingCollections.length > 0 && ` • ${pendingCollections.length} collection${pendingCollections.length > 1 ? 's' : ''} pending`}
      </Text>
    </View>
  ), [currentStep, pendingCollections.length]);

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

  const renderCollectionDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Collection Setup</Text>
      <Text style={styles.stepSubtitle}>
        Where should we collect your items from?
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Shop/Store Name *"
          placeholderTextColor="#888"
          value={shopName}
          onChangeText={setShopName}
          autoCapitalize="words"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Shop Contact Number (optional)"
          placeholderTextColor="#888"
          value={shopContact}
          onChangeText={setShopContact}
          keyboardType="phone-pad"
        />
        
        <TextInput
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
        >
          <Text style={[styles.locationText, selectedCollectionArea && styles.locationTextSelected]}>
            {selectedCollectionArea ? 
              `${selectedCollectionArea.name} • ${selectedCollectionArea.location?.name}` :
              'Tap to select collection area (optional)'
            }
          </Text>
          <Feather name="map" size={20} color={selectedCollectionArea ? "#10b981" : "#666"} />
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
      <Text style={styles.stepTitle}>Item Details</Text>
      <Text style={styles.stepSubtitle}>
        Tell us about the items we'll be collecting
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
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
          style={styles.input}
          placeholder="Estimated total value (KES) *"
          placeholderTextColor="#888"
          value={itemValue}
          onChangeText={setItemValue}
          keyboardType="numeric"
        />
        
        <TextInput
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
      <Text style={styles.stepTitle}>Delivery Setup</Text>
      <Text style={styles.stepSubtitle}>
        Where should we deliver your collected items?
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
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
        >
          <Text style={[styles.locationText, (selectedDeliveryArea || selectedDeliveryAgent) && styles.locationTextSelected]}>
            {selectedDeliveryAgent ? 
              `Agent: ${selectedDeliveryAgent.name} • ${selectedDeliveryAgent.area?.name}` :
              selectedDeliveryArea ? 
                `${selectedDeliveryArea.name} • ${selectedDeliveryArea.location?.name}` :
                'Tap to select delivery area (optional)'
            }
          </Text>
          <Feather name="map-pin" size={20} color={(selectedDeliveryArea || selectedDeliveryAgent) ? "#10b981" : "#666"} />
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
    const totalCollectionsCount = pendingCollections.length + 1;
    
    // Calculate costs for all collections
    const currentCost = costs.total;
    const pendingCosts = pendingCollections.map(coll => {
      const itemValueNum = parseFloat(coll.itemValue) || 0;
      const insuranceFee = Math.max(50, itemValueNum * 0.02);
      return 200 + 250 + Math.round(insuranceFee) + 100;
    });
    const totalPendingCost = pendingCosts.reduce((sum, cost) => sum + cost, 0);
    const grandTotal = currentCost + totalPendingCost;
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Payment & Confirmation</Text>
        <Text style={styles.stepSubtitle}>
          {pendingCollections.length > 0 ? 
            `Review all ${totalCollectionsCount} collection${totalCollectionsCount > 1 ? 's' : ''} and confirm payment` :
            'Review costs and select payment method'
          }
        </Text>
        
        <ScrollView style={styles.confirmationScrollContainer} showsVerticalScrollIndicator={false}>
          {/* Show pending collections */}
          {pendingCollections.length > 0 && (
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
              {pendingCollections.length > 0 ? `Collection ${pendingCollections.length + 1} Summary` : 'Service Summary'}
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

          {/* Cost Breakdown */}
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

          {/* Payment Method */}
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
                For high-value items (over KES 5,000), payment may be required before collection for security purposes.
              </Text>
            </View>
          </View>

          {/* Add Another Collection Section */}
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
        </ScrollView>
      </View>
    );
  };

  const renderStepContent = () => {
    if (isLoadingFormData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading areas...</Text>
        </View>
      );
    }

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

  const renderNavigationButtons = () => (
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
                    {pendingCollections.length > 0 ? 
                      `Create ${totalCollectionsCount} Collection${totalCollectionsCount > 1 ? 's' : ''}` :
                      'Create Collection Request'
                    }
                  </Text>
                  <Feather name="check" size={20} color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#888"} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

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
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.overlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardAvoidingView}
              keyboardVerticalOffset={0}
            >
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
                  {renderHeader()}
                  {renderProgressBar()}
                  
                  <ScrollView 
                    style={styles.contentContainer}
                    contentContainerStyle={[
                      styles.scrollContentContainer,
                      isKeyboardVisible && { paddingBottom: 20 }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {renderStepContent()}
                  </ScrollView>
                  
                  {renderNavigationButtons()}
                </LinearGradient>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Location Picker Modals */}
      <LocationAreaSelectorModal
        visible={showCollectionMapModal}
        onClose={() => setShowCollectionMapModal(false)}
        onLocationSelect={handleCollectionLocationSelect}
        title="Select Collection Area"
        type="collection"
        areas={areas}
        agents={agents}
      />
      
      <LocationAreaSelectorModal
        visible={showDeliveryMapModal}
        onClose={() => setShowDeliveryMapModal(false)}
        onLocationSelect={handleDeliveryLocationSelect}
        title="Select Delivery Area"
        type="delivery"
        areas={areas}
        agents={agents}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  stepContent: {
    padding: 20,
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
  
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
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
  
  // Payment advance note styles (informational only)
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
});
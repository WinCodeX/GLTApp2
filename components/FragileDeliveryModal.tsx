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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { 
  getPackageFormData,
  validatePackageFormData,
  createPackage,
  type Location, 
  type Area, 
  type Agent,
  type PackageData 
} from '../lib/helpers/packageHelpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

interface FragileDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: { latitude: number; longitude: number; address?: string } | null;
}

interface PendingFragilePackage extends PackageData {
  id: string;
  created_at: number;
}

// Storage keys for caching
const STORAGE_KEYS = {
  LOCATIONS: 'fragile_modal_locations',
  AREAS: 'fragile_modal_areas',
  AGENTS: 'fragile_modal_agents',
  LAST_UPDATED: 'fragile_modal_last_updated'
} as const;

const CACHE_DURATION = 24 * 60 * 60 * 1000;

const useDataCache = () => {
  const isCacheValid = useCallback(async (): Promise<boolean> => {
    try {
      const lastUpdated = await AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
      if (!lastUpdated) return false;
      
      const timeDiff = Date.now() - parseInt(lastUpdated);
      return timeDiff < CACHE_DURATION;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }, []);

  const loadFromCache = useCallback(async () => {
    try {
      const [locationsStr, areasStr, agentsStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.LOCATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.AREAS),
        AsyncStorage.getItem(STORAGE_KEYS.AGENTS)
      ]);

      if (!locationsStr || !areasStr || !agentsStr) return null;

      return {
        locations: JSON.parse(locationsStr),
        areas: JSON.parse(areasStr),
        agents: JSON.parse(agentsStr)
      };
    } catch (error) {
      console.error('Error loading from cache:', error);
      return null;
    }
  }, []);

  const saveToCache = useCallback(async (data: { locations: Location[], areas: Area[], agents: Agent[] }) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(data.locations)),
        AsyncStorage.setItem(STORAGE_KEYS.AREAS, JSON.stringify(data.areas)),
        AsyncStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(data.agents)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString())
      ]);
      console.log('Fragile modal data cached successfully');
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      await Promise.all(Object.values(STORAGE_KEYS).map(key => 
        AsyncStorage.removeItem(key)
      ));
      console.log('Fragile modal cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);

  return { isCacheValid, loadFromCache, saveToCache, clearCache };
};

export default function FragileDeliveryModal({
  visible,
  onClose,
  onSubmit,
  currentLocation: initialLocation
}: FragileDeliveryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { isCacheValid, loadFromCache, saveToCache, clearCache } = useDataCache();

  // Data states
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Multi-package states
  const [pendingPackages, setPendingPackages] = useState<PendingFragilePackage[]>([]);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  
  // Form states
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [pickupAgentId, setPickupAgentId] = useState('');
  const [deliveryAgentId, setDeliveryAgentId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Search states
  const [searchQueries, setSearchQueries] = useState({
    pickupAgent: '',
    deliveryAgent: ''
  });

  const [sortConfig, setSortConfig] = useState<{
    field: 'name' | 'location';
    direction: 'asc' | 'desc';
  }>({
    field: 'name',
    direction: 'asc'
  });
  
  const STEP_TITLES = [
    'Pickup & Delivery Locations',
    'Receiver Details', 
    'Package Information',
    'Confirm Fragile Delivery'
  ];

  // Calculate modal height
  const modalHeight = useMemo(() => {
    if (isKeyboardVisible) {
      const availableHeight = SCREEN_HEIGHT - keyboardHeight;
      const maxModalHeight = availableHeight - STATUS_BAR_HEIGHT - 20;
      return Math.min(maxModalHeight, availableHeight * 0.85);
    }
    return SCREEN_HEIGHT * 0.90;
  }, [isKeyboardVisible, keyboardHeight]);

  const totalPackages = pendingPackages.length + (currentStep === STEP_TITLES.length - 1 ? 1 : 0);

  const selectedPickupAgent = useMemo(() => 
    agents.find(agent => agent.id === pickupAgentId),
    [agents, pickupAgentId]
  );

  const selectedDeliveryAgent = useMemo(() => 
    agents.find(agent => agent.id === deliveryAgentId),
    [agents, deliveryAgentId]
  );

  // Keyboard handling
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

  useEffect(() => {
    if (visible) {
      console.log('Fragile modal opened, loading data...');
      resetForm();
      loadModalData();
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadModalData = useCallback(async () => {
    try {
      setIsDataLoading(true);
      setDataError(null);
      
      // Check cache first
      const cacheValid = await isCacheValid();
      
      if (cacheValid) {
        const cachedData = await loadFromCache();
        if (cachedData) {
          console.log('Loading fragile modal data from cache...');
          setLocations(cachedData.locations);
          setAreas(cachedData.areas);
          setAgents(cachedData.agents);
          
          const validation = validatePackageFormData(cachedData);
          if (!validation.isValid) {
            console.warn('Cached data validation failed:', validation.issues);
            await clearCache();
            throw new Error('Cached data is invalid, fetching fresh data...');
          }
          
          setIsDataLoading(false);
          return;
        }
      }
      
      console.log('Fetching fresh fragile modal data from API...');
      const formData = await getPackageFormData();
      
      const validation = validatePackageFormData(formData);
      if (!validation.isValid) {
        console.error('Fresh data validation failed:', validation.issues);
        setDataError(`Data validation failed: ${validation.issues.join(', ')}`);
        return;
      }
      
      setLocations(formData.locations);
      setAreas(formData.areas);
      setAgents(formData.agents);
      
      await saveToCache({
        locations: formData.locations,
        areas: formData.areas,
        agents: formData.agents
      });
      
    } catch (error: any) {
      console.error('Failed to load fragile modal data:', error);
      setDataError(error.message || 'Failed to load data');
      
      const cachedData = await loadFromCache();
      if (cachedData) {
        console.log('Using expired cache as fallback...');
        setLocations(cachedData.locations);
        setAreas(cachedData.areas);
        setAgents(cachedData.agents);
        setDataError(null);
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [isCacheValid, loadFromCache, saveToCache, clearCache]);

  const resetForm = useCallback(() => {
    setCurrentStep(0);
    setReceiverName('');
    setReceiverPhone('');
    setPickupAgentId('');
    setDeliveryAgentId('');
    setDeliveryAddress('');
    setItemDescription('');
    setSpecialInstructions('');
    setIsSubmitting(false);
    setSearchQueries({
      pickupAgent: '',
      deliveryAgent: ''
    });
    setSortConfig({ field: 'name', direction: 'asc' });
    setPendingPackages([]);
    setIsCreatingMultiple(false);
  }, []);

  const resetFormForNewPackage = useCallback(() => {
    setCurrentStep(0);
    setReceiverName('');
    setReceiverPhone('');
    setPickupAgentId('');
    setDeliveryAgentId('');
    setDeliveryAddress('');
    setItemDescription('');
    setSpecialInstructions('');
    setSearchQueries({
      pickupAgent: '',
      deliveryAgent: ''
    });
    setSortConfig({ field: 'name', direction: 'asc' });
  }, []);

  const closeModal = useCallback(() => {
    if (pendingPackages.length > 0) {
      Alert.alert(
        'Unsaved Packages',
        `You have ${pendingPackages.length} unsaved fragile package(s). If you close now, all progress will be lost. Submit your packages first.`,
        [
          {
            text: 'Continue Editing',
            style: 'cancel'
          },
          {
            text: 'Close and Lose Progress',
            style: 'destructive',
            onPress: () => {
              setPendingPackages([]);
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
  }, [slideAnim, onClose, pendingPackages.length]);

  const updateSearchQuery = useCallback((field: keyof typeof searchQueries, value: string) => {
    setSearchQueries(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSortChange = useCallback((field: 'name' | 'location') => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const getGroupedItems = useCallback((items: Agent[], searchQuery: string) => {
    // First filter the items based on search query
    const filtered = items.filter(agent => {
      const searchLower = searchQuery.toLowerCase();
      const name = agent.name || '';
      const areaName = agent.area?.name || '';
      const locationName = agent.area?.location?.name || '';
      
      return (
        name.toLowerCase().includes(searchLower) ||
        areaName.toLowerCase().includes(searchLower) ||
        locationName.toLowerCase().includes(searchLower)
      );
    });
    
    if (filtered.length === 0) return [];
    
    if (sortConfig.field === 'name') {
      // For name sorting: return flat list sorted by name only
      const sorted = filtered.sort((a, b) => {
        const aName = a.name || '';
        const bName = b.name || '';
        const comparison = aName.localeCompare(bName, 'en', { sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
      
      return [{
        locationName: 'All Items',
        items: sorted
      }];
    } else {
      // For location sorting: group by location
      const grouped = filtered.reduce((acc, agent) => {
        const locationName = agent.area?.location?.name || 'Unknown Location';
        
        if (!acc[locationName]) {
          acc[locationName] = [];
        }
        acc[locationName].push(agent);
        return acc;
      }, {} as Record<string, Agent[]>);

      const sortedGroups = Object.entries(grouped)
        .sort(([a], [b]) => {
          if (a === 'Unknown Location') return 1;
          if (b === 'Unknown Location') return -1;
          const comparison = a.localeCompare(b, 'en', { sensitivity: 'base' });
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        })
        .map(([locationName, items]) => ({
          locationName,
          items: items.sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName, 'en', { sensitivity: 'base' });
          })
        }));
      
      return sortedGroups;
    }
  }, [sortConfig]);

  const renderSearchAndSortHeader = useCallback((
    searchValue: string,
    onSearchChange: (value: string) => void,
    placeholder: string
  ) => (
    <View style={styles.searchAndSortContainer}>
      <View style={styles.searchInputContainer}>
        <Feather name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={searchValue}
          onChangeText={onSearchChange}
        />
        {searchValue.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Feather name="x" size={16} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <View style={styles.sortButtons}>
          {(['name', 'location'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.sortButton,
                sortConfig.field === option && styles.activeSortButton
              ]}
              onPress={() => handleSortChange(option)}
            >
              <Text style={[
                styles.sortButtonText,
                sortConfig.field === option && styles.activeSortButtonText
              ]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
              {sortConfig.field === option && (
                <Feather 
                  name={sortConfig.direction === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={12} 
                  color="#f97316" 
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  ), [sortConfig, handleSortChange]);

  const isStepValid = useCallback((step: number) => {
    switch (step) {
      case 0:
        return pickupAgentId.length > 0 && deliveryAgentId.length > 0;
      case 1:
        return receiverName.trim().length > 0 && receiverPhone.trim().length > 0;
      case 2:
        return deliveryAddress.trim().length > 0 && itemDescription.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  }, [pickupAgentId, deliveryAgentId, receiverName, receiverPhone, deliveryAddress, itemDescription]);

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

  const addAnotherPackage = useCallback(() => {
    const newPendingPackage: PendingFragilePackage = {
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      sender_name: 'Current User',
      sender_phone: '+254700000000',
      origin_agent_id: pickupAgentId,
      destination_agent_id: deliveryAgentId,
      delivery_type: 'fragile',
      delivery_location: deliveryAddress,
      package_description: `FRAGILE DELIVERY: ${itemDescription}${specialInstructions ? `\nSpecial Instructions: ${specialInstructions}` : ''}`,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      created_at: Date.now()
    };
    
    setPendingPackages(prev => [...prev, newPendingPackage]);
    setIsCreatingMultiple(true);
    resetFormForNewPackage();
  }, [receiverName, receiverPhone, pickupAgentId, deliveryAgentId, deliveryAddress, itemDescription, specialInstructions, resetFormForNewPackage]);

  const removePendingPackage = useCallback((packageId: string) => {
    setPendingPackages(prev => prev.filter(pkg => pkg.id !== packageId));
  }, []);

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Get pickup agent's area ID
      let pickupAreaId = '';
      if (selectedPickupAgent?.area?.id) {
        pickupAreaId = selectedPickupAgent.area.id;
      }

      // Get delivery agent's area ID
      let deliveryAreaId = '';
      if (selectedDeliveryAgent?.area?.id) {
        deliveryAreaId = selectedDeliveryAgent.area.id;
      }

      const currentPackageData: PackageData = {
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        sender_name: 'Current User',
        sender_phone: '+254700000000',
        origin_agent_id: pickupAgentId,
        destination_agent_id: deliveryAgentId,
        origin_area_id: pickupAreaId,
        destination_area_id: deliveryAreaId,
        delivery_type: 'fragile',
        delivery_location: deliveryAddress,
        package_description: `FRAGILE DELIVERY: ${itemDescription}${specialInstructions ? `\nSpecial Instructions: ${specialInstructions}` : ''}`
      };

      // Prepare all packages for submission
      const allPackages = [
        ...pendingPackages.map(pkg => ({
          ...pkg,
          origin_area_id: agents.find(a => a.id === pkg.origin_agent_id)?.area?.id || '',
          destination_area_id: agents.find(a => a.id === pkg.destination_agent_id)?.area?.id || ''
        })),
        currentPackageData
      ];

      console.log(`Submitting ${allPackages.length} fragile packages...`);

      // Submit all packages
      const responses = await Promise.all(
        allPackages.map(pkg => createPackage(pkg))
      );

      console.log('All fragile packages created successfully:', responses);

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Fragile Packages Created Successfully',
        text2: `${allPackages.length} fragile package${allPackages.length > 1 ? 's' : ''} created`,
        position: 'top',
        visibilityTime: 3000,
      });

      // Clear pending packages and close modal
      setPendingPackages([]);
      setIsCreatingMultiple(false);
      closeModal();
      
    } catch (error: any) {
      console.error('Failed to submit fragile packages:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Failed to Create Fragile Packages',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
      });
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
        {pendingPackages.length > 0 && ` • ${pendingPackages.length} package${pendingPackages.length > 1 ? 's' : ''} pending`}
      </Text>
    </View>
  ), [currentStep, pendingPackages.length]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{STEP_TITLES[currentStep]}</Text>
      <View style={styles.placeholder} />
    </View>
  ), [closeModal, currentStep]);

  const renderLocationSetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Fragile Delivery Setup</Text>
      <Text style={styles.stepSubtitle}>
        Select pickup and delivery locations for fragile items
      </Text>
      
      {dataError && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color="#ea580c" />
          <Text style={styles.errorText}>{dataError}</Text>
          <TouchableOpacity onPress={loadModalData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isDataLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#f97316" />
          <Text style={styles.loadingText}>Loading locations...</Text>
        </View>
      )}

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Pickup Location</Text>
        <Text style={styles.locationSubtitle}>Select pickup office</Text>
        
        {renderSearchAndSortHeader(
          searchQueries.pickupAgent,
          (value) => updateSearchQuery('pickupAgent', value),
          'Search pickup offices...'
        )}
        
        <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
          {getGroupedItems(agents, searchQueries.pickupAgent).map((group, groupIndex) => (
            <View key={groupIndex}>
              {sortConfig.field === 'location' && group.locationName !== 'All Items' && (
                <View style={styles.locationHeader}>
                  <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                  <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                </View>
              )}
              
              {group.items.map((agent) => (
                <TouchableOpacity
                  key={agent.id}
                  style={[
                    styles.selectionItem,
                    pickupAgentId === agent.id && styles.selectedItem
                  ]}
                  onPress={() => setPickupAgentId(agent.id)}
                >
                  <View style={styles.selectionItemContent}>
                    <View style={styles.selectionInitials}>
                      <Text style={styles.selectionInitialsText}>
                        {agent.name.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.selectionInfo}>
                      <Text style={styles.selectionName}>{agent.name}</Text>
                      <Text style={styles.selectionLocation}>
                        {agent.area?.name} • {agent.area?.location?.name}
                      </Text>
                    </View>
                    {pickupAgentId === agent.id && (
                      <Feather name="check-circle" size={20} color="#f97316" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Delivery Location</Text>
        <Text style={styles.locationSubtitle}>Select delivery office</Text>
        
        {renderSearchAndSortHeader(
          searchQueries.deliveryAgent,
          (value) => updateSearchQuery('deliveryAgent', value),
          'Search delivery offices...'
        )}
        
        <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
          {getGroupedItems(agents, searchQueries.deliveryAgent).map((group, groupIndex) => (
            <View key={groupIndex}>
              {sortConfig.field === 'location' && group.locationName !== 'All Items' && (
                <View style={styles.locationHeader}>
                  <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                  <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                </View>
              )}
              
              {group.items.map((agent) => (
                <TouchableOpacity
                  key={agent.id}
                  style={[
                    styles.selectionItem,
                    deliveryAgentId === agent.id && styles.selectedItem
                  ]}
                  onPress={() => setDeliveryAgentId(agent.id)}
                >
                  <View style={styles.selectionItemContent}>
                    <View style={styles.selectionInitials}>
                      <Text style={styles.selectionInitialsText}>
                        {agent.name.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.selectionInfo}>
                      <Text style={styles.selectionName}>{agent.name}</Text>
                      <Text style={styles.selectionLocation}>
                        {agent.area?.name} • {agent.area?.location?.name}
                      </Text>
                    </View>
                    {deliveryAgentId === agent.id && (
                      <Feather name="check-circle" size={20} color="#f97316" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
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
        Provide details about your fragile items
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

      <View style={styles.fragileNotice}>
        <Feather name="info" size={16} color="#f97316" />
        <Text style={styles.fragileNoticeText}>
          All fragile items are handled with extra care and receive priority processing
        </Text>
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Fragile Delivery</Text>
      <Text style={styles.stepSubtitle}>
        {pendingPackages.length > 0 
          ? `Review all ${totalPackages} fragile package${totalPackages > 1 ? 's' : ''} before submitting`
          : 'Review all information before submitting'
        }
      </Text>
      
      {/* Show pending packages if any */}
      {pendingPackages.length > 0 && (
        <View style={styles.pendingPackagesContainer}>
          <Text style={styles.pendingPackagesTitle}>Pending Fragile Packages ({pendingPackages.length})</Text>
          {pendingPackages.map((pkg, index) => (
            <View key={pkg.id} style={styles.pendingPackageItem}>
              <View style={styles.pendingPackageHeader}>
                <Text style={styles.pendingPackageNumber}>Fragile Package {index + 1}</Text>
                <TouchableOpacity 
                  onPress={() => removePendingPackage(pkg.id)}
                  style={styles.removePendingPackageButton}
                >
                  <Feather name="trash-2" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.pendingPackageSummary}>
                {pkg.receiver_name} • Fragile Delivery
              </Text>
            </View>
          ))}
        </View>
      )}
      
      <ScrollView style={styles.confirmationContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.currentPackageTitle}>
          {pendingPackages.length > 0 ? `Fragile Package ${pendingPackages.length + 1}` : 'Current Fragile Package'}
        </Text>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeAddress}>{selectedPickupAgent?.name}</Text>
              <Text style={styles.routeArea}>{selectedPickupAgent?.area?.name} • {selectedPickupAgent?.area?.location?.name}</Text>
            </View>
            <View style={styles.routeArrow}>
              <Feather name="arrow-right" size={20} color="#f97316" />
            </View>
            <View style={styles.routePoint}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routeAddress}>{selectedDeliveryAgent?.name}</Text>
              <Text style={styles.routeArea}>{selectedDeliveryAgent?.area?.name} • {selectedDeliveryAgent?.area?.location?.name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Receiver</Text>
          <Text style={styles.confirmationDetail}>{receiverName}</Text>
          <Text style={styles.confirmationDetail}>{receiverPhone}</Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Package Details</Text>
          <Text style={styles.confirmationDetail}>Item: {itemDescription}</Text>
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
          <Text style={styles.confirmationSectionTitle}>Cost Breakdown</Text>
          <View style={styles.costBreakdown}>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Fragile Service Fee</Text>
              <Text style={styles.costValue}>KES 500</Text>
            </View>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Priority Handling</Text>
              <Text style={styles.costValue}>KES 300</Text>
            </View>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Insurance</Text>
              <Text style={styles.costValue}>KES 200</Text>
            </View>
            <View style={[styles.costLine, styles.totalCostLine]}>
              <Text style={styles.totalCostLabel}>Total Amount</Text>
              <Text style={styles.totalCostValue}>KES 1,000</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Add Another Package Button */}
      {currentStep === STEP_TITLES.length - 1 && (
        <View style={styles.addAnotherContainer}>
          <TouchableOpacity 
            onPress={addAnotherPackage}
            style={styles.addAnotherButton}
          >
            <Feather name="plus" size={20} color="#f97316" />
            <Text style={styles.addAnotherButtonText}>Add Another Fragile Delivery</Text>
          </TouchableOpacity>
          <Text style={styles.addAnotherNote}>
            Note: If you close before submitting, all progress will be lost. Submit your packages first.
          </Text>
        </View>
      )}
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
                {pendingPackages.length > 0 
                  ? `Submit ${totalPackages} Fragile Package${totalPackages > 1 ? 's' : ''}`
                  : 'Schedule Fragile Delivery'
                }
              </Text>
              <Feather name="alert-triangle" size={20} color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#666"} />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMainContent = () => {
    if (isDataLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingTitle}>Loading Package Data</Text>
          <Text style={styles.loadingSubtitle}>
            Fetching locations and offices...
          </Text>
        </View>
      );
    }

    if (dataError) {
      return (
        <View style={styles.errorContainer}>
          <TouchableOpacity onPress={closeModal} style={styles.closeButtonAbsolute}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Feather name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Data</Text>
          <Text style={styles.errorMessage}>
            {dataError}
            Check your internet connection and make sure your API is running.
          </Text>
          
          <View style={styles.errorButtons}>
            <TouchableOpacity onPress={loadModalData} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeModal} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <>
        {renderHeader()}
        {renderProgressBar()}
        
        <ScrollView 
          style={styles.contentContainer}
          contentContainerStyle={[
            styles.scrollContentContainer,
            isKeyboardVisible && styles.keyboardVisiblePadding
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>
        
        {renderNavigationButtons()}
      </>
    );
  };

  return (
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
  closeButtonAbsolute: {
    position: 'absolute',
    top: 15,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  
  // Error/Loading banners
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
  
  // Search and sort
  searchAndSortContainer: {
    marginBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    paddingHorizontal: 16,
    minHeight: 44,
    gap: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 10,
  },
  
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sortLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  activeSortButton: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: '#f97316',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  activeSortButtonText: {
    color: '#f97316',
    fontWeight: '600',
  },
  
  // Location section
  locationSection: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(249, 115, 22, 0.2)',
  },
  locationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  locationHeaderCount: {
    fontSize: 12,
    color: '#888',
  },
  
  selectionList: {
    maxHeight: 200,
  },
  selectionItem: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  selectedItem: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  selectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  selectionInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 115, 22, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  selectionInitialsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  selectionInfo: {
    flex: 1,
  },
  selectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
  },
  selectionLocation: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  
  // Fragile info
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
  
  // Form
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
  
  // Fragile notice
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
  
  // Pending packages
  pendingPackagesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  pendingPackagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 12,
  },
  pendingPackageItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  pendingPackageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pendingPackageNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  removePendingPackageButton: {
    padding: 4,
  },
  pendingPackageSummary: {
    fontSize: 13,
    color: '#888',
  },
  currentPackageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  
  // Add another package
  addAnotherContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: '#f97316',
    gap: 8,
  },
  addAnotherButtonText: {
    fontSize: 16,
    color: '#f97316',
    fontWeight: '600',
  },
  addAnotherNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  
  // Confirmation
  confirmationContainer: {
    flex: 1,
    maxHeight: 400,
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
  
  // Route display
  routeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginBottom: 2,
  },
  routeArea: {
    fontSize: 12,
    color: '#888',
  },
  routeArrow: {
    paddingHorizontal: 10,
  },
  
  // Service features
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
  
  // Cost breakdown
  costBreakdown: {
    gap: 8,
  },
  costLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: '#888',
  },
  costValue: {
    fontSize: 14,
    color: '#fff',
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
  
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f97316',
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});
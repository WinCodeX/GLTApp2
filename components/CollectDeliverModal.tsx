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

interface CollectDeliverModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: { latitude: number; longitude: number; address?: string } | null;
}

interface PendingCollectionPackage extends PackageData {
  id: string;
  created_at: number;
}

// Storage keys for caching
const STORAGE_KEYS = {
  LOCATIONS: 'collection_modal_locations',
  AREAS: 'collection_modal_areas',
  AGENTS: 'collection_modal_agents',
  LAST_UPDATED: 'collection_modal_last_updated'
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
      console.log('Collection modal data cached successfully');
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      await Promise.all(Object.values(STORAGE_KEYS).map(key => 
        AsyncStorage.removeItem(key)
      ));
      console.log('Collection modal cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);

  return { isCacheValid, loadFromCache, saveToCache, clearCache };
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
  const { isCacheValid, loadFromCache, saveToCache, clearCache } = useDataCache();

  // Data states
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Multi-package states
  const [pendingPackages, setPendingPackages] = useState<PendingCollectionPackage[]>([]);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  
  // Form states
  const [shopName, setShopName] = useState('');
  const [shopContact, setShopContact] = useState('');
  const [collectionAddress, setCollectionAddress] = useState('');
  const [itemsToCollect, setItemsToCollect] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [deliveryAgentId, setDeliveryAgentId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
  const [requiresPaymentAdvance, setRequiresPaymentAdvance] = useState(false);

  // Search states
  const [searchQueries, setSearchQueries] = useState({
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
    'Collection Details',
    'Item Information', 
    'Delivery Setup',
    'Payment & Confirmation'
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
      console.log('Collection modal opened, loading data...');
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
          console.log('Loading collection modal data from cache...');
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
      
      console.log('Fetching fresh collection modal data from API...');
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
      console.error('Failed to load collection modal data:', error);
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
    setShopName('');
    setShopContact('');
    setCollectionAddress('');
    setItemsToCollect('');
    setItemValue('');
    setItemDescription('');
    setDeliveryAgentId('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setPaymentMethod('mpesa');
    setRequiresPaymentAdvance(false);
    setIsSubmitting(false);
    setSearchQueries({
      deliveryAgent: ''
    });
    setSortConfig({ field: 'name', direction: 'asc' });
    setPendingPackages([]);
    setIsCreatingMultiple(false);
  }, []);

  const resetFormForNewPackage = useCallback(() => {
    setCurrentStep(0);
    setShopName('');
    setShopContact('');
    setCollectionAddress('');
    setItemsToCollect('');
    setItemValue('');
    setItemDescription('');
    setDeliveryAgentId('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setPaymentMethod('mpesa');
    setRequiresPaymentAdvance(false);
    setSearchQueries({
      deliveryAgent: ''
    });
    setSortConfig({ field: 'name', direction: 'asc' });
  }, []);

  const closeModal = useCallback(() => {
    if (pendingPackages.length > 0) {
      Alert.alert(
        'Unsaved Packages',
        `You have ${pendingPackages.length} unsaved collection package(s). If you close now, all progress will be lost. Submit your packages first.`,
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
                  color="#10b981" 
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
        return shopName.trim().length > 0 && collectionAddress.trim().length > 0;
      case 1:
        return itemsToCollect.trim().length > 0 && itemValue.trim().length > 0;
      case 2:
        return deliveryAgentId.length > 0 && deliveryAddress.trim().length > 0;
      case 3:
        return paymentMethod.length > 0;
      default:
        return false;
    }
  }, [shopName, collectionAddress, itemsToCollect, itemValue, deliveryAgentId, deliveryAddress, paymentMethod]);

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
    const insuranceFee = Math.max(50, itemValueNum * 0.02); // 2% or minimum 50
    const serviceFee = 100;
    
    return {
      collection: collectionFee,
      delivery: deliveryFee,
      insurance: Math.round(insuranceFee),
      service: serviceFee,
      total: collectionFee + deliveryFee + Math.round(insuranceFee) + serviceFee
    };
  };

  const addAnotherPackage = useCallback(() => {
    // Get delivery agent's area ID
    let deliveryAreaId = '';
    if (selectedDeliveryAgent?.area?.id) {
      deliveryAreaId = selectedDeliveryAgent.area.id;
    }

    const newPendingPackage: PendingCollectionPackage = {
      sender_name: 'Collection Service',
      sender_phone: '+254700000000',
      receiver_name: 'Current User',
      receiver_phone: '+254700000000',
      destination_agent_id: deliveryAgentId,
      destination_area_id: deliveryAreaId,
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
      requires_payment_advance: requiresPaymentAdvance,
      collection_type: 'shop_pickup',
      payment_deadline: requiresPaymentAdvance ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      created_at: Date.now()
    };
    
    setPendingPackages(prev => [...prev, newPendingPackage]);
    setIsCreatingMultiple(true);
    resetFormForNewPackage();
  }, [shopName, shopContact, collectionAddress, itemsToCollect, itemValue, itemDescription, deliveryAgentId, deliveryAddress, specialInstructions, paymentMethod, requiresPaymentAdvance, selectedDeliveryAgent, resetFormForNewPackage]);

  const removePendingPackage = useCallback((packageId: string) => {
    setPendingPackages(prev => prev.filter(pkg => pkg.id !== packageId));
  }, []);

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Get delivery agent's area ID
      let deliveryAreaId = '';
      if (selectedDeliveryAgent?.area?.id) {
        deliveryAreaId = selectedDeliveryAgent.area.id;
      }

      const currentPackageData: PackageData = {
        sender_name: 'Collection Service',
        sender_phone: '+254700000000', 
        receiver_name: 'Current User',
        receiver_phone: '+254700000000',
        destination_agent_id: deliveryAgentId,
        destination_area_id: deliveryAreaId,
        delivery_type: 'collection',
        delivery_location: deliveryAddress,
        
        // Collection-specific fields
        shop_name: shopName,
        shop_contact: shopContact,
        collection_address: collectionAddress,
        items_to_collect: itemsToCollect,
        item_value: parseFloat(itemValue) || 0,
        item_description: itemDescription.trim() || itemsToCollect,
        special_instructions: specialInstructions.trim(),
        payment_method: paymentMethod,
        requires_payment_advance: requiresPaymentAdvance,
        collection_type: 'shop_pickup',
        
        // Timing
        collection_scheduled_at: null,
        payment_deadline: requiresPaymentAdvance ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      };

      // Prepare all packages for submission
      const allPackages = [
        ...pendingPackages.map(pkg => ({
          ...pkg,
          destination_area_id: agents.find(a => a.id === pkg.destination_agent_id)?.area?.id || ''
        })),
        currentPackageData
      ];

      console.log(`Submitting ${allPackages.length} collection packages...`);

      // Submit all packages
      const responses = await Promise.all(
        allPackages.map(pkg => createPackage(pkg))
      );

      console.log('All collection packages created successfully:', responses);

      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Collection Packages Created Successfully',
        text2: `${allPackages.length} collection package${allPackages.length > 1 ? 's' : ''} created`,
        position: 'top',
        visibilityTime: 3000,
      });

      // Clear pending packages and close modal
      setPendingPackages([]);
      setIsCreatingMultiple(false);
      closeModal();
      
    } catch (error: any) {
      console.error('Failed to submit collection packages:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Failed to Create Collection Packages',
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

  const renderCollectionDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Collection Setup</Text>
      <Text style={styles.stepSubtitle}>
        Where should we collect your items from?
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
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={styles.loadingText}>Loading locations...</Text>
        </View>
      )}
      
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
        Select delivery office for your collected items
      </Text>

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Delivery Office</Text>
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
                      <Feather name="check-circle" size={20} color="#10b981" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
      
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
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Payment & Confirmation</Text>
        <Text style={styles.stepSubtitle}>
          {pendingPackages.length > 0 
            ? `Review all ${totalPackages} collection package${totalPackages > 1 ? 's' : ''} before submitting`
            : 'Review costs and select payment method'
          }
        </Text>
        
        {/* Show pending packages if any */}
        {pendingPackages.length > 0 && (
          <View style={styles.pendingPackagesContainer}>
            <Text style={styles.pendingPackagesTitle}>Pending Collection Packages ({pendingPackages.length})</Text>
            {pendingPackages.map((pkg, index) => (
              <View key={pkg.id} style={styles.pendingPackageItem}>
                <View style={styles.pendingPackageHeader}>
                  <Text style={styles.pendingPackageNumber}>Collection Package {index + 1}</Text>
                  <TouchableOpacity 
                    onPress={() => removePendingPackage(pkg.id)}
                    style={styles.removePendingPackageButton}
                  >
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.pendingPackageSummary}>
                  {pkg.shop_name} • {pkg.items_to_collect}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        <ScrollView style={styles.confirmationContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.currentPackageTitle}>
            {pendingPackages.length > 0 ? `Collection Package ${pendingPackages.length + 1}` : 'Current Collection Package'}
          </Text>

          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>Service Summary</Text>
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
              <Text style={styles.summaryValue}>{selectedDeliveryAgent?.name}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Final address:</Text>
              <Text style={styles.summaryValue}>{deliveryAddress.length > 30 ? 
                `${deliveryAddress.substring(0, 30)}...` : deliveryAddress}</Text>
            </View>
          </View>

          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>Cost Breakdown</Text>
            <View style={styles.costBreakdown}>
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
            </View>
          </View>

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
            
            <TouchableOpacity
              style={styles.paymentAdvanceOption}
              onPress={() => setRequiresPaymentAdvance(!requiresPaymentAdvance)}
            >
              <Feather name={requiresPaymentAdvance ? 'check-square' : 'square'} 
                       size={20} color={requiresPaymentAdvance ? '#10b981' : '#666'} />
              <Text style={styles.paymentAdvanceText}>
                Require payment before collection (recommended for high-value items)
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Add Another Package Button */}
        {currentStep === STEP_TITLES.length - 1 && (
          <View style={styles.addAnotherContainer}>
            <TouchableOpacity 
              onPress={addAnotherPackage}
              style={styles.addAnotherButton}
            >
              <Feather name="plus" size={20} color="#10b981" />
              <Text style={styles.addAnotherButtonText}>Add Another Collection</Text>
            </TouchableOpacity>
            <Text style={styles.addAnotherNote}>
              Note: If you close before submitting, all progress will be lost. Submit your packages first.
            </Text>
          </View>
        )}
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

  const renderNavigationButtons = () => (
    <View style={styles.navigationContainer}>
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
                {pendingPackages.length > 0 
                  ? `Submit ${totalPackages} Collection Package${totalPackages > 1 ? 's' : ''}`
                  : 'Create Collection Request'
                }
              </Text>
              <Feather name="check" size={20} color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#888"} />
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
          <ActivityIndicator size="large" color="#10b981" />
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
            isKeyboardVisible && { paddingBottom: 20 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}
        </ScrollView>
        
        {renderNavigationButtons()}
      </>
    );
  };

  return (
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
                {renderMainContent()}
              </LinearGradient>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </Modal>
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
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
    backgroundColor: 'rgba(10, 10, 35, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonAbsolute: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 16 : 20,
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#10b981',
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  activeSortButtonText: {
    color: '#10b981',
    fontWeight: '600',
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
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
  },
  locationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  locationHeaderCount: {
    fontSize: 12,
    color: '#888',
  },
  
  selectionList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  selectionItem: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  selectedItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
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
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
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
  
  // Pending packages
  pendingPackagesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pendingPackagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
    gap: 8,
  },
  addAnotherButtonText: {
    fontSize: 16,
    color: '#10b981',
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
  
  confirmationContainer: {
    flex: 1,
    maxHeight: 400,
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
  paymentAdvanceOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  paymentAdvanceText: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: 'rgba(10, 10, 35, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  spacer: {
    flex: 1,
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
    backgroundColor: '#10b981',
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
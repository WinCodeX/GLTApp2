// components/PackageCreationModal.tsx - FIXED: Keyboard handling and modal spacing
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { 
  getPackageFormData,
  getPackagePricing, 
  validatePackageFormData,
  createPackage,
  type Location, 
  type Area, 
  type Agent,
  type PackageData 
} from '../lib/helpers/packageHelpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface PackageCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
}

const STEP_TITLES = [
  'Origin Agent',
  'Receiver Details', 
  'Delivery Method',
  'Destination',
  'Delivery Location',
  'Confirm Details'
];

type SortOption = 'name' | 'location' | 'area';
type SortDirection = 'asc' | 'desc';

// Enhanced delivery type with fragile option
type DeliveryType = 'fragile' | 'doorstep' | 'agent';

// Storage keys for caching
const STORAGE_KEYS = {
  LOCATIONS: 'package_modal_locations',
  AREAS: 'package_modal_areas',
  AGENTS: 'package_modal_agents',
  LAST_UPDATED: 'package_modal_last_updated'
} as const;

// Cache duration (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Custom hooks for better separation of concerns
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
      console.log('✅ Data cached successfully');
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      await Promise.all(Object.values(STORAGE_KEYS).map(key => 
        AsyncStorage.removeItem(key)
      ));
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }, []);

  return { isCacheValid, loadFromCache, saveToCache, clearCache };
};

export default function PackageCreationModal({
  visible,
  onClose,
  onSubmit
}: PackageCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // FIXED: Form data with fragile as default delivery type
  const [packageData, setPackageData] = useState<PackageData & { delivery_type: DeliveryType }>({
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    origin_area_id: '',
    destination_area_id: '',
    origin_agent_id: '',
    destination_agent_id: '',
    delivery_type: 'fragile' as DeliveryType
  });

  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  
  // Enhanced search and sort states
  const [searchQueries, setSearchQueries] = useState({
    originAgent: '',
    destinationAgent: '',
    destinationArea: ''
  });
  
  const [sortConfig, setSortConfig] = useState<{
    field: SortOption;
    direction: SortDirection;
  }>({
    field: 'name',
    direction: 'asc'
  });

  // FIXED: Keyboard handling
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

  // FIXED: Calculate modal height based on keyboard state
  const modalHeight = useMemo(() => {
    if (isKeyboardVisible) {
      // When keyboard is visible, make modal smaller and ensure header is visible
      const maxHeightWithKeyboard = SCREEN_HEIGHT - keyboardHeight - (Platform.OS === 'ios' ? 100 : 80);
      return Math.min(maxHeightWithKeyboard, SCREEN_HEIGHT * 0.85);
    }
    // When keyboard is hidden, use normal height
    return SCREEN_HEIGHT * 0.90;
  }, [isKeyboardVisible, keyboardHeight]);

  // Memoized selectors for better performance
  const selectedOriginAgent = useMemo(() => 
    agents.find(agent => agent.id === packageData.origin_agent_id),
    [agents, packageData.origin_agent_id]
  );

  const selectedDestinationArea = useMemo(() => {
    if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
      const selectedAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
      return areas.find(area => area.id === selectedAgent?.area_id);
    }
    return areas.find(area => area.id === packageData.destination_area_id);
  }, [agents, areas, packageData.delivery_type, packageData.destination_agent_id, packageData.destination_area_id]);

  const selectedDestinationAgent = useMemo(() =>
    agents.find(agent => agent.id === packageData.destination_agent_id),
    [agents, packageData.destination_agent_id]
  );

  useEffect(() => {
    if (visible) {
      console.log('📦 Modal opened, loading data...');
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
      console.log('🔍 Cache valid:', cacheValid);
      
      if (cacheValid) {
        const cachedData = await loadFromCache();
        if (cachedData) {
          console.log('📋 Loading from cache...');
          setLocations(cachedData.locations);
          setAreas(cachedData.areas);
          setAgents(cachedData.agents);
          
          console.log('✅ Cached data loaded:', {
            locations: cachedData.locations.length,
            areas: cachedData.areas.length,
            agents: cachedData.agents.length
          });
          
          // ENHANCED: Validate cached data structure
          const validation = validatePackageFormData(cachedData);
          if (!validation.isValid) {
            console.warn('⚠️ Cached data validation failed:', validation.issues);
            // Clear cache and fetch fresh data
            await clearCache();
            throw new Error('Cached data is invalid, fetching fresh data...');
          }
          
          setIsDataLoading(false);
          return;
        }
      }
      
      // Fetch fresh data using the proper helper function
      console.log('🌐 Fetching fresh data from API using helper...');
      console.log('🔗 API Call: getPackageFormData()');
      
      const formData = await getPackageFormData();
      
      // ENHANCED: Debug the helper response
      console.log('📦 Helper Response Structure:', {
        hasLocations: !!formData.locations,
        hasAreas: !!formData.areas,
        hasAgents: !!formData.agents,
        locationsLength: formData.locations?.length || 0,
        areasLength: formData.areas?.length || 0,
        agentsLength: formData.agents?.length || 0
      });
      
      // Validate the data before setting it
      const validation = validatePackageFormData(formData);
      if (!validation.isValid) {
        console.error('❌ Fresh data validation failed:', validation.issues);
        setDataError(`Data validation failed: ${validation.issues.join(', ')}`);
        return;
      }
      
      // Set the data directly from helper
      setLocations(formData.locations);
      setAreas(formData.areas);
      setAgents(formData.agents);
      
      // Save to cache
      await saveToCache({
        locations: formData.locations,
        areas: formData.areas,
        agents: formData.agents
      });
      
      console.log('✅ Fresh data loaded and cached successfully:', {
        locations: formData.locations.length,
        areas: formData.areas.length,
        agents: formData.agents.length
      });
      
      // ENHANCED: Sample data structure for debugging
      if (formData.agents.length > 0) {
        console.log('🔍 Sample agent structure:', JSON.stringify(formData.agents[0], null, 2));
      }
      if (formData.areas.length > 0) {
        console.log('🔍 Sample area structure:', JSON.stringify(formData.areas[0], null, 2));
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load modal data:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setDataError(error.message || 'Failed to load data');
      
      // Try to load cached data as fallback even if expired
      const cachedData = await loadFromCache();
      if (cachedData) {
        console.log('📋 Using expired cache as fallback...');
        setLocations(cachedData.locations);
        setAreas(cachedData.areas);
        setAgents(cachedData.agents);
        setDataError(null); // Clear error since we have fallback data
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [isCacheValid, loadFromCache, saveToCache, clearCache]);

  const resetForm = useCallback(() => {
    setCurrentStep(0);
    // FIXED: Default to fragile delivery
    setPackageData({
      sender_name: '',
      sender_phone: '',
      receiver_name: '',
      receiver_phone: '',
      origin_area_id: '',
      destination_area_id: '',
      origin_agent_id: '',
      destination_agent_id: '',
      delivery_type: 'fragile' as DeliveryType
    });
    setDeliveryLocation('');
    setEstimatedCost(null);
    setIsSubmitting(false);
    setSearchQueries({
      originAgent: '',
      destinationAgent: '',
      destinationArea: ''
    });
    setSortConfig({ field: 'name', direction: 'asc' });
  }, []);

  const closeModal = useCallback(() => {
    Keyboard.dismiss(); // FIXED: Dismiss keyboard when closing
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [slideAnim, onClose]);

  // Enhanced area-based cost calculation with fragile delivery pricing
  const calculateCost = useCallback(() => {
    console.log('💰 Starting cost calculation...');
    
    if (!selectedOriginAgent) {
      console.log('❌ Origin agent not found for cost calculation');
      return;
    }

    console.log('✅ Origin agent found:', {
      agentId: selectedOriginAgent.id,
      agentName: selectedOriginAgent.name,
      agentArea: selectedOriginAgent.area,
      agentAreaId: selectedOriginAgent.area?.id
    });

    // FIXED: Enhanced area lookup using selectedOriginAgent.area.id instead of area_id
    console.log('🔍 Searching for origin area...');
    const originArea = areas.find(a => {
      return a.id === selectedOriginAgent.area?.id || 
             a.id == selectedOriginAgent.area?.id || 
             String(a.id) === String(selectedOriginAgent.area?.id);
    });
    
    if (!originArea) {
      console.log('❌ Origin area not found for cost calculation');
      console.log('🔍 Available areas:', areas.map(a => ({ id: a.id, name: a.name })));
      console.log('🔍 Looking for area with ID:', selectedOriginAgent.area?.id);
      return;
    }

    console.log('✅ Origin area found:', {
      areaId: originArea.id,
      areaName: originArea.name,
      locationId: originArea.location_id,
      locationName: originArea.location?.name
    });

    if (!selectedDestinationArea) {
      console.log('❌ Destination area not found for cost calculation');
      return;
    }

    console.log('✅ Destination area found:', {
      areaId: selectedDestinationArea.id,
      areaName: selectedDestinationArea.name,
      locationId: selectedDestinationArea.location_id,
      locationName: selectedDestinationArea.location?.name
    });
    
    // Enhanced logging for debugging
    console.log('💰 Calculating cost with areas:', {
      originAgent: selectedOriginAgent.name,
      originArea: originArea.name,
      originLocation: originArea.location?.name,
      destinationArea: selectedDestinationArea.name,
      destinationLocation: selectedDestinationArea.location?.name,
      deliveryType: packageData.delivery_type
    });
    
    // Area-based pricing logic with fragile delivery
    const isIntraArea = String(originArea.id) === String(selectedDestinationArea.id);
    const isIntraLocation = String(originArea.location_id) === String(selectedDestinationArea.location_id);
    
    console.log('🔍 Pricing logic checks:', {
      originAreaId: originArea.id,
      destinationAreaId: selectedDestinationArea.id,
      originLocationId: originArea.location_id,
      destinationLocationId: selectedDestinationArea.location_id,
      isIntraArea,
      isIntraLocation
    });
    
    let baseCost = 0;
    
    if (packageData.delivery_type === 'fragile') {
      // Fragile delivery pricing (premium rates)
      if (isIntraArea) {
        baseCost = 350;
        console.log('💰 Same area fragile delivery: KES 350');
      } else if (isIntraLocation) {
        baseCost = 450;
        console.log('💰 Same location, different areas fragile delivery: KES 450');
      } else {
        baseCost = 580;
        console.log('💰 Different locations fragile delivery: KES 580');
      }
    } else if (packageData.delivery_type === 'agent') {
      // Agent-to-Agent pricing
      if (isIntraArea) {
        baseCost = 120;
        console.log('💰 Same area agent transfer: KES 120');
      } else if (isIntraLocation) {
        baseCost = 150;
        console.log('💰 Same location, different areas agent transfer: KES 150');
      } else {
        baseCost = 180;
        console.log('💰 Different locations agent transfer: KES 180');
      }
    } else {
      // Agent-to-Doorstep pricing
      if (isIntraArea) {
        baseCost = 250;
        console.log('💰 Same area doorstep delivery: KES 250');
      } else if (isIntraLocation) {
        baseCost = 300;
        console.log('💰 Same location, different areas doorstep delivery: KES 300');
      } else {
        baseCost = 380;
        console.log('💰 Different locations doorstep delivery: KES 380');
      }
    }
    
    console.log('💰 Final cost calculation result:', {
      isIntraArea,
      isIntraLocation,
      deliveryType: packageData.delivery_type,
      baseCost
    });
    
    setEstimatedCost(baseCost);
  }, [selectedOriginAgent, selectedDestinationArea, areas, packageData.delivery_type]);

  // FIXED: Updated package data function with proper origin_area_id handling
  const updatePackageData = useCallback((field: keyof (PackageData & { delivery_type: DeliveryType }), value: string) => {
    setPackageData(prev => {
      const updated = { ...prev, [field]: value };
      
      // FIXED: Auto-update origin_area_id when origin_agent_id changes
      if (field === 'origin_agent_id') {
        const selectedAgent = agents.find(agent => agent.id === value);
        if (selectedAgent && selectedAgent.area?.id) {
          updated.origin_area_id = selectedAgent.area.id;
          console.log('🎯 Origin agent selected:', {
            agentName: selectedAgent.name,
            agentId: selectedAgent.id,
            areaId: selectedAgent.area.id,
            areaName: selectedAgent.area.name,
            locationName: selectedAgent.area.location?.name
          });
          console.log('🎯 Updated origin_area_id to:', selectedAgent.area.id);
        } else {
          console.warn('⚠️ Selected agent has no area or area.id:', selectedAgent);
        }
      }
      
      // Debug the full package data state
      console.log('📦 Package data updated:', {
        field,
        value,
        origin_agent_id: updated.origin_agent_id,
        origin_area_id: updated.origin_area_id,
        destination_area_id: updated.destination_area_id,
        delivery_type: updated.delivery_type
      });
      
      return updated;
    });
  }, [agents]);

  const updateSearchQuery = useCallback((field: keyof typeof searchQueries, value: string) => {
    setSearchQueries(prev => ({ ...prev, [field]: value }));
  }, []);

  // ENHANCED: Better sorting and filtering with detailed logging
  const applySortAndFilter = useCallback((items: Agent[] | Area[], searchQuery: string, itemType: 'agent' | 'area') => {
    console.log(`🔍 Starting filter for ${itemType}s:`, {
      inputCount: items.length,
      searchQuery,
      hasSearchQuery: searchQuery.length > 0
    });

    if (items.length === 0) {
      console.warn(`⚠️ No ${itemType}s to filter`);
      return [];
    }

    // Filter by search query
    const filtered = items.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      if (itemType === 'agent') {
        const agent = item as Agent;
        const name = agent.name || '';
        const phone = agent.phone || '';
        const areaName = agent.area?.name || '';
        const locationName = agent.area?.location?.name || '';
        
        const matches = (
          name.toLowerCase().includes(searchLower) ||
          phone.toLowerCase().includes(searchLower) ||
          areaName.toLowerCase().includes(searchLower) ||
          locationName.toLowerCase().includes(searchLower)
        );
        
        if (searchQuery && matches) {
          console.log(`✅ Agent match: ${name} (${areaName})`);
        }
        
        return matches;
      } else {
        const area = item as Area;
        const name = area.name || '';
        const locationName = area.location?.name || '';
        
        const matches = (
          name.toLowerCase().includes(searchLower) ||
          locationName.toLowerCase().includes(searchLower)
        );
        
        if (searchQuery && matches) {
          console.log(`✅ Area match: ${name} (${locationName})`);
        }
        
        return matches;
      }
    });

    console.log(`✅ Filtered ${itemType}s:`, {
      filteredCount: filtered.length,
      originalCount: items.length,
      hasResults: filtered.length > 0
    });

    // Apply sorting
    const sorted = filtered.sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      switch (sortConfig.field) {
        case 'name':
          if (itemType === 'agent') {
            aValue = (a as Agent).name || '';
            bValue = (b as Agent).name || '';
          } else {
            aValue = (a as Area).name || '';
            bValue = (b as Area).name || '';
          }
          break;
        case 'location':
          if (itemType === 'agent') {
            aValue = (a as Agent).area?.location?.name || '';
            bValue = (b as Agent).area?.location?.name || '';
          } else {
            aValue = (a as Area).location?.name || '';
            bValue = (b as Area).location?.name || '';
          }
          break;
        case 'area':
          if (itemType === 'agent') {
            aValue = (a as Agent).area?.name || '';
            bValue = (b as Agent).area?.name || '';
          }
          break;
      }
      
      const comparison = aValue.localeCompare(bValue);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    console.log(`🔄 Sorted ${itemType}s by ${sortConfig.field} (${sortConfig.direction}):`, sorted.length);

    return sorted;
  }, [sortConfig]);

  // ENHANCED: Better grouping with detailed logging
  const getGroupedItems = useCallback((items: Agent[] | Area[], searchQuery: string, itemType: 'agent' | 'area') => {
    const sortedFiltered = applySortAndFilter(items, searchQuery, itemType);
    
    console.log(`📋 Starting grouping for ${itemType}s:`, {
      sortedFilteredCount: sortedFiltered.length
    });
    
    if (sortedFiltered.length === 0) {
      console.warn(`⚠️ No ${itemType}s to group`);
      return [];
    }
    
    const grouped = sortedFiltered.reduce((acc, item) => {
      let locationName = 'Unknown Location';
      if (itemType === 'agent') {
        const agent = item as Agent;
        locationName = agent.area?.location?.name || 'Unknown Location';
      } else {
        const area = item as Area;
        locationName = area.location?.name || 'Unknown Location';
      }
      
      if (!acc[locationName]) {
        acc[locationName] = [];
      }
      acc[locationName].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    const result = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([locationName, items]) => ({
        locationName,
        items
      }));

    console.log(`✅ Grouped ${itemType}s:`, {
      groupCount: result.length,
      groups: result.map(g => ({ location: g.locationName, count: g.items.length }))
    });

    return result;
  }, [applySortAndFilter]);

  const handleSortChange = useCallback((field: SortOption) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const isCurrentStepValid = useCallback(() => {
    switch (currentStep) {
      case 0: return packageData.origin_agent_id.length > 0;
      case 1: return packageData.receiver_name.trim().length > 0 && packageData.receiver_phone.trim().length > 0;
      case 2: return packageData.delivery_type.length > 0;
      case 3: 
        if (packageData.delivery_type === 'agent') {
          return packageData.destination_agent_id.length > 0;
        } else {
          return packageData.destination_area_id.length > 0;
        }
      case 4:
        if (packageData.delivery_type === 'doorstep' || packageData.delivery_type === 'fragile') {
          return deliveryLocation.trim().length > 0;
        }
        return true;
      case 5: return true;
      default: return false;
    }
  }, [currentStep, packageData, deliveryLocation]);

  const nextStep = useCallback(() => {
    if (currentStep < STEP_TITLES.length - 1 && isCurrentStepValid()) {
      if (currentStep === 3 && packageData.delivery_type === 'agent') {
        setCurrentStep(5);
        calculateCost();
      } else {
        setCurrentStep(prev => {
          const newStep = prev + 1;
          if (newStep === 5) calculateCost();
          return newStep;
        });
      }
    }
  }, [currentStep, isCurrentStepValid, packageData.delivery_type, calculateCost]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      if (currentStep === 5 && packageData.delivery_type === 'agent') {
        setCurrentStep(3);
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  }, [currentStep, packageData.delivery_type]);

  // FIXED: Enhanced submit handler with proper data validation and debugging
  const handleSubmit = useCallback(async () => {
    if (!isCurrentStepValid()) return;

    console.log('📦 Starting package submission...');
    console.log('📦 Current package data before submission:', packageData);
    console.log('📦 Origin agent:', selectedOriginAgent);
    console.log('📦 Delivery location:', deliveryLocation);

    setIsSubmitting(true);
    try {
      // FIXED: Ensure origin_area_id is properly set from the selected agent
      let finalOriginAreaId = packageData.origin_area_id;
      
      if (!finalOriginAreaId && selectedOriginAgent?.area?.id) {
        finalOriginAreaId = selectedOriginAgent.area.id;
        console.log('🔧 Fixed missing origin_area_id from selected agent:', finalOriginAreaId);
      }

      const finalPackageData = {
        ...packageData,
        origin_area_id: finalOriginAreaId,
        sender_name: 'Current User',
        sender_phone: '+254700000000',
        delivery_location: deliveryLocation
      };

      console.log('📦 Final submission data:', finalPackageData);
      
      // FIXED: Validate that origin_area_id is present
      if (!finalPackageData.origin_area_id) {
        console.error('❌ Missing origin_area_id in final submission');
        Toast.show({
          type: 'error',
          text1: 'Missing Origin Area',
          text2: 'Please select an origin agent first',
          position: 'top',
          visibilityTime: 4000,
        });
        setIsSubmitting(false);
        return;
      }
      
      // ENHANCED: Use the helper function directly
      const packageResponse = await createPackage(finalPackageData);
      console.log('✅ Package created successfully:', packageResponse);
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Package Created Successfully!',
        text2: `Tracking: ${packageResponse.tracking_code}`,
        position: 'top',
        visibilityTime: 4000,
      });
      
      closeModal();
    } catch (error: any) {
      console.error('❌ Failed to submit package:', error);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Failed to Create Package',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isCurrentStepValid, packageData, deliveryLocation, selectedOriginAgent, closeModal]);

  const retryDataLoad = useCallback(() => {
    console.log('🔄 Retrying data load...');
    loadModalData();
  }, [loadModalData]);

  const handleClearCache = useCallback(async () => {
    try {
      await clearCache();
      
      // Show cache cleared toast
      Toast.show({
        type: 'success',
        text1: 'Cache Cleared - Refreshing Data',
        position: 'top',
        visibilityTime: 2000,
      });
      
      // Immediately reload fresh data after clearing cache
      await loadModalData();
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Failed to Clear Cache',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  }, [clearCache, loadModalData]);

  // Enhanced Search and Sort Header Component
  const renderSearchAndSortHeader = useCallback((
    searchValue: string,
    onSearchChange: (value: string) => void,
    placeholder: string,
    showSort: boolean = true
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
      
      {showSort && (
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <View style={styles.sortButtons}>
            {(['name', 'location', 'area'] as SortOption[]).map((option) => (
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
                    color="#7c3aed" 
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  ), [sortConfig, handleSortChange]);

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
      </Text>
    </View>
  ), [currentStep]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{STEP_TITLES[currentStep]}</Text>
      <View style={styles.placeholder} />
    </View>
  ), [closeModal, currentStep]);

  // ENHANCED: Step 0: Origin Agent Selection with better error handling and data validation
  const renderOriginAgentSelection = useCallback(() => {
    console.log('🎯 Rendering origin agent selection...');
    console.log('🎯 Agents available:', agents.length);
    console.log('🎯 Search query:', searchQueries.originAgent);
    
    const groupedAgents = getGroupedItems(agents, searchQueries.originAgent, 'agent');
    console.log('🎯 Grouped agents result:', groupedAgents.length, 'groups');
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Select Origin Agent</Text>
        <Text style={styles.stepSubtitle}>Which agent will collect the package?</Text>
        
        {/* ENHANCED: Show data loading/count info */}
        <View style={styles.dataInfoContainer}>
          <Text style={styles.dataInfoText}>
            {agents.length} agents available
          </Text>
          {searchQueries.originAgent && (
            <Text style={styles.dataInfoText}>
              Search: "{searchQueries.originAgent}"
            </Text>
          )}
        </View>
        
        {renderSearchAndSortHeader(
          searchQueries.originAgent,
          (value) => updateSearchQuery('originAgent', value),
          'Search agents by name, area, or location...'
        )}
        
        <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
          {groupedAgents.length > 0 ? (
            groupedAgents.map((group, groupIndex) => (
              <View key={groupIndex}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                  <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                </View>
                
                {group.items.map((agent) => {
                  const agentData = agent as Agent;
                  const agentName = agentData.name || 'Unknown Agent';
                  const agentPhone = agentData.phone || '';
                  const agentId = agentData.id || '';
                  
                  const areaName = agentData.area?.name || 'Unknown Area';
                  const locationName = agentData.area?.location?.name || group.locationName;
                  
                  return (
                    <TouchableOpacity
                      key={agentId}
                      style={[
                        styles.selectionItem,
                        packageData.origin_agent_id === agentId && styles.selectedItem
                      ]}
                      onPress={() => updatePackageData('origin_agent_id', agentId)}
                    >
                      <View style={styles.selectionItemContent}>
                        <View style={styles.selectionInitials}>
                          <Text style={styles.selectionInitialsText}>
                            {agentName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.selectionInfo}>
                          <Text style={styles.selectionName}>{agentName}</Text>
                          <Text style={styles.selectionLocation}>
                            {areaName} • {locationName}
                          </Text>
                          <Text style={styles.selectionPhone}>{agentPhone}</Text>
                        </View>
                        {packageData.origin_agent_id === agentId && (
                          <Feather name="check-circle" size={20} color="#10b981" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.noResultsContainer}>
              <Feather name="search" size={48} color="#666" />
              <Text style={styles.noResultsTitle}>
                {searchQueries.originAgent ? 'No agents found' : 'No agents available'}
              </Text>
              <Text style={styles.noResultsText}>
                {searchQueries.originAgent 
                  ? 'Try a different search term or clear the search' 
                  : 'Check your data connection and try refreshing'
                }
              </Text>
              {searchQueries.originAgent && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => updateSearchQuery('originAgent', '')}
                >
                  <Text style={styles.clearSearchButtonText}>Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }, [agents, searchQueries.originAgent, packageData.origin_agent_id, renderSearchAndSortHeader, getGroupedItems, updatePackageData, updateSearchQuery]);

  // Keep the rest of the render methods the same as they're working...
  const renderReceiverDetails = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Receiver Details</Text>
      <Text style={styles.stepSubtitle}>Who will receive this package?</Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Receiver's Full Name"
          placeholderTextColor="#888"
          value={packageData.receiver_name}
          onChangeText={(value) => updatePackageData('receiver_name', value)}
          autoCapitalize="words"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Receiver's Phone (+254...)"
          placeholderTextColor="#888"
          value={packageData.receiver_phone}
          onChangeText={(value) => updatePackageData('receiver_phone', value)}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  ), [packageData.receiver_name, packageData.receiver_phone, updatePackageData]);

  // UPDATED: Enhanced delivery method selection with fragile as first option
  const renderDeliveryMethodSelection = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Method</Text>
      <Text style={styles.stepSubtitle}>How should the package be delivered?</Text>
      
      <View style={styles.deliveryOptions}>
        {/* Fragile Delivery - First option (DEFAULT) */}
        <TouchableOpacity
          style={[
            styles.deliveryOption,
            packageData.delivery_type === 'fragile' && styles.selectedDeliveryOption
          ]}
          onPress={() => updatePackageData('delivery_type', 'fragile')}
        >
          <View style={styles.deliveryOptionContent}>
            <Feather name="alert-triangle" size={24} color="#ff6b6b" />
            <View style={styles.deliveryOptionText}>
              <Text style={styles.deliveryOptionTitle}>⚠️ Fragile Delivery</Text>
              <Text style={styles.deliveryOptionSubtitle}>Special handling for delicate items (RECOMMENDED)</Text>
            </View>
            {packageData.delivery_type === 'fragile' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>

        {/* Doorstep Delivery - Second option */}
        <TouchableOpacity
          style={[
            styles.deliveryOption,
            packageData.delivery_type === 'doorstep' && styles.selectedDeliveryOption
          ]}
          onPress={() => updatePackageData('delivery_type', 'doorstep')}
        >
          <View style={styles.deliveryOptionContent}>
            <Feather name="home" size={24} color="#fff" />
            <View style={styles.deliveryOptionText}>
              <Text style={styles.deliveryOptionTitle}>Doorstep Delivery</Text>
              <Text style={styles.deliveryOptionSubtitle}>Direct delivery to address</Text>
            </View>
            {packageData.delivery_type === 'doorstep' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>

        {/* Agent Delivery - Third option */}
        <TouchableOpacity
          style={[
            styles.deliveryOption,
            packageData.delivery_type === 'agent' && styles.selectedDeliveryOption
          ]}
          onPress={() => updatePackageData('delivery_type', 'agent')}
        >
          <View style={styles.deliveryOptionContent}>
            <Feather name="user" size={24} color="#fff" />
            <View style={styles.deliveryOptionText}>
              <Text style={styles.deliveryOptionTitle}>Agent Delivery</Text>
              <Text style={styles.deliveryOptionSubtitle}>Collect from destination agent</Text>
            </View>
            {packageData.delivery_type === 'agent' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  ), [packageData.delivery_type, updatePackageData]);

  const renderDestinationSelection = useCallback(() => {
    if (packageData.delivery_type === 'agent') {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Select Destination Agent</Text>
          <Text style={styles.stepSubtitle}>Which agent will handle final delivery?</Text>
          
          {renderSearchAndSortHeader(
            searchQueries.destinationAgent,
            (value) => updateSearchQuery('destinationAgent', value),
            'Search destination agents...'
          )}
          
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
            {getGroupedItems(agents, searchQueries.destinationAgent, 'agent').map((group, groupIndex) => (
              <View key={groupIndex}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                  <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                </View>
                
                {group.items.map((agent) => {
                  const agentData = agent as Agent;
                  const agentName = agentData.name || 'Unknown Agent';
                  const agentPhone = agentData.phone || '';
                  const agentId = agentData.id || '';
                  
                  const areaName = agentData.area?.name || 'Unknown Area';
                  const locationName = agentData.area?.location?.name || group.locationName;
                  
                  return (
                    <TouchableOpacity
                      key={agentId}
                      style={[
                        styles.selectionItem,
                        packageData.destination_agent_id === agentId && styles.selectedItem
                      ]}
                      onPress={() => updatePackageData('destination_agent_id', agentId)}
                    >
                      <View style={styles.selectionItemContent}>
                        <View style={styles.selectionInitials}>
                          <Text style={styles.selectionInitialsText}>
                            {agentName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.selectionInfo}>
                          <Text style={styles.selectionName}>{agentName}</Text>
                          <Text style={styles.selectionLocation}>
                            {areaName} • {locationName}
                          </Text>
                          <Text style={styles.selectionPhone}>{agentPhone}</Text>
                        </View>
                        {packageData.destination_agent_id === agentId && (
                          <Feather name="check-circle" size={20} color="#10b981" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      );
    } else {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Select Destination Area</Text>
          <Text style={styles.stepSubtitle}>Which area should we deliver to?</Text>
          
          {renderSearchAndSortHeader(
            searchQueries.destinationArea,
            (value) => updateSearchQuery('destinationArea', value),
            'Search destination areas...'
          )}
          
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
            {getGroupedItems(areas, searchQueries.destinationArea, 'area').map((group, groupIndex) => (
              <View key={groupIndex}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                  <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                </View>
                
                {group.items.map((area) => (
                  <TouchableOpacity
                    key={area.id}
                    style={[
                      styles.selectionItem,
                      packageData.destination_area_id === area.id && styles.selectedItem
                    ]}
                    onPress={() => updatePackageData('destination_area_id', area.id)}
                  >
                    <View style={styles.selectionItemContent}>
                      <View style={styles.selectionInitials}>
                        <Text style={styles.selectionInitialsText}>
                          {(area as Area).initials || (area as Area).name?.substring(0, 2).toUpperCase() || 'AR'}
                        </Text>
                      </View>
                      <View style={styles.selectionInfo}>
                        <Text style={styles.selectionName}>{(area as Area).name}</Text>
                        <Text style={styles.selectionLocation}>
                          {(area as Area).location?.name}
                        </Text>
                      </View>
                      {packageData.destination_area_id === area.id && (
                        <Feather name="check-circle" size={20} color="#10b981" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }
  }, [packageData.delivery_type, packageData.destination_agent_id, packageData.destination_area_id, agents, areas, searchQueries.destinationAgent, searchQueries.destinationArea, renderSearchAndSortHeader, getGroupedItems, updatePackageData]);

  const renderDeliveryLocation = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Location</Text>
      <Text style={styles.stepSubtitle}>
        {packageData.delivery_type === 'fragile' 
          ? 'Provide specific handling instructions and delivery address'
          : 'Provide the exact delivery address'
        }
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={
            packageData.delivery_type === 'fragile' 
              ? "Enter specific address, special handling instructions, fragile item details..."
              : "Enter specific address, building name, floor, etc."
          }
          placeholderTextColor="#888"
          value={deliveryLocation}
          onChangeText={setDeliveryLocation}
          multiline
          numberOfLines={packageData.delivery_type === 'fragile' ? 6 : 4}
          textAlignVertical="top"
        />
        {packageData.delivery_type === 'fragile' && (
          <View style={styles.fragileNotice}>
            <Feather name="info" size={16} color="#ff6b6b" />
            <Text style={styles.fragileNoticeText}>
              Include details about the fragile items and any special handling requirements
            </Text>
          </View>
        )}
      </View>
    </View>
  ), [deliveryLocation, packageData.delivery_type]);

  const renderConfirmation = useCallback(() => (
    <View style={[styles.stepContent, styles.stepContentConfirmation]}>
      <Text style={styles.stepTitle}>Confirm Package Details</Text>
      <Text style={styles.stepSubtitle}>Review all information before submitting</Text>
      
      <View style={styles.confirmationContainer}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeAreaInitials}>
                {selectedOriginAgent?.name?.substring(0, 2).toUpperCase() || '--'}
              </Text>
              <Text style={styles.routeAreaName}>{selectedOriginAgent?.name || 'Unknown'}</Text>
              <Text style={styles.routeLocationName}>
                {selectedOriginAgent?.area?.name} • {selectedOriginAgent?.area?.location?.name}
              </Text>
            </View>
            <Feather name="arrow-right" size={20} color="#7c3aed" />
            <View style={styles.routePoint}>
              {packageData.delivery_type === 'agent' ? (
                <>
                  <Text style={styles.routeAreaInitials}>
                    {selectedDestinationAgent?.name?.substring(0, 2).toUpperCase() || '--'}
                  </Text>
                  <Text style={styles.routeAreaName}>{selectedDestinationAgent?.name || 'Unknown'}</Text>
                  <Text style={styles.routeLocationName}>
                    {selectedDestinationAgent?.area?.name} • {selectedDestinationAgent?.area?.location?.name}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.routeAreaInitials}>{selectedDestinationArea?.initials || '--'}</Text>
                  <Text style={styles.routeAreaName}>{selectedDestinationArea?.name || 'Unknown'}</Text>
                  <Text style={styles.routeLocationName}>{selectedDestinationArea?.location?.name || 'Unknown'}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Receiver</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_name}</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_phone}</Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Delivery Method</Text>
          <Text style={styles.confirmationDetail}>
            {packageData.delivery_type === 'fragile' ? 'Fragile Delivery' :
             packageData.delivery_type === 'doorstep' ? 'Doorstep Delivery' : 'Agent Delivery'}
          </Text>
          
          {packageData.delivery_type === 'fragile' && (
            <View style={styles.fragileInfo}>
              <Feather name="alert-triangle" size={16} color="#ff6b6b" />
              <Text style={styles.fragileInfoText}>Special handling required</Text>
            </View>
          )}
          
          {packageData.delivery_type === 'agent' && selectedDestinationAgent && (
            <View style={styles.agentInfo}>
              <Text style={styles.confirmationDetail}>Destination Agent: {selectedDestinationAgent?.name}</Text>
              <Text style={styles.confirmationSubDetail}>{selectedDestinationAgent?.phone}</Text>
            </View>
          )}

          {(packageData.delivery_type === 'doorstep' || packageData.delivery_type === 'fragile') && deliveryLocation && (
            <View style={styles.deliveryLocationInfo}>
              <Text style={styles.confirmationSubDetail}>
                {packageData.delivery_type === 'fragile' ? 'Delivery Address & Instructions:' : 'Delivery Address:'}
              </Text>
              <Text style={styles.confirmationDetail}>{deliveryLocation}</Text>
            </View>
          )}
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Estimated Cost</Text>
          {estimatedCost ? (
            <View style={styles.costDisplay}>
              <Text style={styles.estimatedCost}>KES {estimatedCost.toLocaleString()}</Text>
              {packageData.delivery_type === 'fragile' && (
                <Text style={styles.fragileNoteText}>*Includes fragile handling surcharge</Text>
              )}
            </View>
          ) : (
            <Text style={styles.pricingError}>Unable to calculate cost</Text>
          )}
          
          {/* Debug information for cost calculation */}
          {__DEV__ && selectedOriginAgent && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>
                Debug: {selectedOriginAgent?.area?.name} → {selectedDestinationArea?.name}
              </Text>
              <Text style={styles.debugText}>
                Same Area: {selectedOriginAgent?.area?.id === selectedDestinationArea?.id ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.debugText}>
                Same Location: {selectedOriginAgent?.area?.location_id === selectedDestinationArea?.location_id ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.debugText}>
                Delivery Type: {packageData.delivery_type}
              </Text>
              <Text style={styles.debugText}>
                Origin Area ID: {packageData.origin_area_id}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  ), [selectedOriginAgent, selectedDestinationAgent, selectedDestinationArea, packageData, deliveryLocation, estimatedCost]);

  const renderCurrentStep = useCallback(() => {
    switch (currentStep) {
      case 0: return renderOriginAgentSelection();
      case 1: return renderReceiverDetails();
      case 2: return renderDeliveryMethodSelection();
      case 3: return renderDestinationSelection();
      case 4: return renderDeliveryLocation();
      case 5: return renderConfirmation();
      default: return renderOriginAgentSelection();
    }
  }, [currentStep, renderOriginAgentSelection, renderReceiverDetails, renderDeliveryMethodSelection, renderDestinationSelection, renderDeliveryLocation, renderConfirmation]);

  const renderNavigationButtons = useCallback(() => (
    <View style={styles.navigationContainer}>
      {currentStep > 0 && (
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#fff" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.spacer} />
      
      {/* Debug cache clear button in development */}
      {__DEV__ && currentStep === 0 && (
        <TouchableOpacity onPress={handleClearCache} style={styles.debugButton}>
          <Text style={styles.debugButtonText}>Clear Cache</Text>
        </TouchableOpacity>
      )}
      
      {currentStep < STEP_TITLES.length - 1 ? (
        <TouchableOpacity 
          onPress={nextStep} 
          style={[
            styles.nextButton,
            !isCurrentStepValid() && styles.disabledButton
          ]}
          disabled={!isCurrentStepValid()}
        >
          <Text style={[
            styles.nextButtonText,
            !isCurrentStepValid() && styles.disabledButtonText
          ]}>
            Next
          </Text>
          <Feather name="arrow-right" size={20} color={isCurrentStepValid() ? "#fff" : "#666"} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          onPress={handleSubmit} 
          style={[
            styles.submitButton,
            (!isCurrentStepValid() || isSubmitting) && styles.disabledButton
          ]}
          disabled={!isCurrentStepValid() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={[
                styles.submitButtonText,
                (!isCurrentStepValid() || isSubmitting) && styles.disabledButtonText
              ]}>
                Create Package
              </Text>
              <Feather name="check" size={20} color={isCurrentStepValid() && !isSubmitting ? "#fff" : "#666"} />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  ), [currentStep, prevStep, nextStep, handleSubmit, isCurrentStepValid, isSubmitting, handleClearCache]);

  // MAIN CONTENT RENDERING
  const renderMainContent = useCallback(() => {
    if (isDataLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingTitle}>Loading Package Data</Text>
          <Text style={styles.loadingSubtitle}>
            Fetching locations, areas, and agents...
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
            {'\n\n'}Check your internet connection and make sure your API is running.
          </Text>
          
          <View style={styles.errorButtons}>
            <TouchableOpacity onPress={retryDataLoad} style={styles.retryButton}>
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
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>
        
        {renderNavigationButtons()}
      </>
    );
  }, [isDataLoading, dataError, closeModal, retryDataLoad, renderHeader, renderProgressBar, renderCurrentStep, renderNavigationButtons]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.overlay}>
            <Animated.View
              style={[
                styles.modalContainer,
                { 
                  transform: [{ translateY: slideAnim }],
                  height: modalHeight // FIXED: Dynamic height based on keyboard state
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
      </SafeAreaView>
    </Modal>
  );
}

// FIXED: Enhanced styles with better keyboard handling and reduced spacing
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // FIXED: Make SafeAreaView transparent
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
    // Height is now dynamic - set via style prop
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  
  // FIXED: Reduced header padding for better keyboard handling
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 15, // FIXED: Reduced top padding
    paddingBottom: 8, // FIXED: Reduced bottom padding
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
    top: Platform.OS === 'ios' ? 10 : 15, // FIXED: Match header padding
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
    marginTop: 4, // FIXED: Reduced margin
  },
  placeholder: {
    width: 40,
  },
  
  // FIXED: Reduced progress bar padding
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10, // FIXED: Reduced from 15 to 10
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 6, // FIXED: Reduced from 8 to 6
  },
  
  // FIXED: Optimized content container for keyboard
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 10, // FIXED: Reduced bottom padding
  },
  stepContent: {
    flex: 1,
    minHeight: 300, // FIXED: Reduced from 400
  },
  stepContentConfirmation: {
    flex: 1,
    minHeight: 450, // FIXED: Reduced from 600
  },
  stepTitle: {
    fontSize: 22, // FIXED: Slightly smaller
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6, // FIXED: Reduced spacing
  },
  stepSubtitle: {
    fontSize: 15, // FIXED: Slightly smaller
    color: '#888',
    marginBottom: 20, // FIXED: Reduced from 30
    lineHeight: 20,
  },
  
  // ENHANCED: Data info container
  dataInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10, // FIXED: Reduced from 12
  },
  dataInfoText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  
  // ENHANCED: Clear search button
  clearSearchButton: {
    marginTop: 12, // FIXED: Reduced from 16
    paddingHorizontal: 20, // FIXED: Reduced from 24
    paddingVertical: 10, // FIXED: Reduced from 12
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  clearSearchButtonText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // NEW: Fragile delivery styles
  fragileNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    padding: 10, // FIXED: Reduced from 12
    marginTop: 10, // FIXED: Reduced from 12
    gap: 8,
  },
  fragileNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#ff6b6b',
    lineHeight: 18, // FIXED: Reduced line height
  },
  fragileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  fragileInfoText: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '500',
  },
  costDisplay: {
    alignItems: 'flex-start',
  },
  fragileNoteText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // FIXED: Enhanced Search and Sort styles with reduced spacing
  searchAndSortContainer: {
    marginBottom: 15, // FIXED: Reduced from 20
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    paddingHorizontal: 16,
    minHeight: 44, // FIXED: Reduced from 48
    gap: 12,
    marginBottom: 10, // FIXED: Reduced from 12
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 10, // FIXED: Reduced from 12
  },
  
  // Sort container styles
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
    paddingHorizontal: 10, // FIXED: Reduced from 12
    paddingVertical: 5, // FIXED: Reduced from 6
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  activeSortButton: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: '#7c3aed',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  activeSortButtonText: {
    color: '#7c3aed',
    fontWeight: '600',
  },
  
  // FIXED: Location header styles with reduced spacing
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6, // FIXED: Reduced from 8
    marginTop: 8, // FIXED: Reduced from 12
    marginBottom: 6, // FIXED: Reduced from 8
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  locationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
  },
  locationHeaderCount: {
    fontSize: 12,
    color: '#888',
  },
  
  // FIXED: Selection list styles with reduced spacing
  selectionList: {
    flex: 1,
  },
  selectionItem: {
    marginBottom: 8, // FIXED: Reduced from 12
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  selectedItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  selectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14, // FIXED: Reduced from 16
  },
  selectionInitials: {
    width: 44, // FIXED: Reduced from 50
    height: 44, // FIXED: Reduced from 50
    borderRadius: 22, // FIXED: Adjusted for new size
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14, // FIXED: Reduced from 16
  },
  selectionInitialsText: {
    fontSize: 15, // FIXED: Reduced from 16
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
    marginBottom: 3, // FIXED: Reduced from 4
  },
  selectionLocation: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  selectionPhone: {
    fontSize: 12,
    color: '#666',
  },
  
  // No results styles
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40, // FIXED: Reduced from 60
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // FIXED: Form styles with reduced spacing
  formContainer: {
    gap: 16, // FIXED: Reduced from 20
    paddingVertical: 8, // FIXED: Reduced from 10
  },
  input: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14, // FIXED: Reduced from 16
    fontSize: 16,
    color: '#fff',
    minHeight: 52, // FIXED: Reduced from 56
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  textArea: {
    minHeight: 100, // FIXED: Reduced from 120
    textAlignVertical: 'top',
    paddingTop: 14, // FIXED: Reduced from 16
  },
  
  // FIXED: Delivery options with reduced spacing
  deliveryOptions: {
    gap: 12, // FIXED: Reduced from 16
  },
  deliveryOption: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  selectedDeliveryOption: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: '#7c3aed',
  },
  deliveryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16, // FIXED: Reduced from 20
  },
  deliveryOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  deliveryOptionTitle: {
    fontSize: 17, // FIXED: Reduced from 18
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3, // FIXED: Reduced from 4
  },
  deliveryOptionSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  
  // FIXED: Confirmation styles with reduced spacing
  confirmationContainer: {
    gap: 16, // FIXED: Reduced from 20
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14, // FIXED: Reduced from 16
  },
  confirmationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 10, // FIXED: Reduced from 12
  },
  confirmationDetail: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 3, // FIXED: Reduced from 4
  },
  confirmationSubDetail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 6, // FIXED: Reduced from 8
  },
  routeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routePoint: {
    alignItems: 'center',
    flex: 1,
  },
  routeAreaInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 4,
  },
  routeAreaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
  },
  routeLocationName: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  agentInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  deliveryLocationInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  estimatedCost: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
  },
  pricingError: {
    fontSize: 14,
    color: '#ef4444',
  },
  
  // Debug styles (only visible in development)
  debugInfo: {
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 0, 0.1)',
    borderRadius: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#ffeb3b',
    marginBottom: 2,
  },
  debugButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    marginRight: 8,
  },
  debugButtonText: {
    fontSize: 12,
    color: '#ffc107',
    fontWeight: '600',
  },
  
  // FIXED: Navigation with reduced spacing
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16, // FIXED: Reduced from 20
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  spacer: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18, // FIXED: Reduced from 20
    paddingVertical: 10, // FIXED: Reduced from 12
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
    paddingHorizontal: 20, // FIXED: Reduced from 24
    paddingVertical: 10, // FIXED: Reduced from 12
    borderRadius: 8,
    backgroundColor: '#7c3aed',
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
    paddingHorizontal: 20, // FIXED: Reduced from 24
    paddingVertical: 10, // FIXED: Reduced from 12
    borderRadius: 8,
    backgroundColor: '#10b981',
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
  
  // Loading and error
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
    backgroundColor: '#7c3aed',
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
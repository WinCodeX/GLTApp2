// components/PackageCreationModal.tsx - ENHANCED WITH TOAST NOTIFICATIONS
import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { 
  getPackageFormData,
  getPackagePricing, 
  validatePackageFormData,
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

// Storage keys for caching
const STORAGE_KEYS = {
  LOCATIONS: 'package_modal_locations',
  AREAS: 'package_modal_areas',
  AGENTS: 'package_modal_agents',
  LAST_UPDATED: 'package_modal_last_updated'
};

// Cache duration (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export default function PackageCreationModal({
  visible,
  onClose,
  onSubmit
}: PackageCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Data states
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form data - Updated for agent-centric flow with area-based pricing
  const [packageData, setPackageData] = useState<PackageData>({
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    origin_area_id: '', // Will be derived from origin agent
    destination_area_id: '',
    origin_agent_id: '', // Primary origin selection
    destination_agent_id: '',
    delivery_type: 'doorstep'
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

  // Check if cached data is still valid
  const isCacheValid = async (): Promise<boolean> => {
    try {
      const lastUpdated = await AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
      if (!lastUpdated) return false;
      
      const timeDiff = Date.now() - parseInt(lastUpdated);
      return timeDiff < CACHE_DURATION;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  };

  // Load data from cache
  const loadFromCache = async (): Promise<{ locations: Location[], areas: Area[], agents: Agent[] } | null> => {
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
  };

  // Save data to cache
  const saveToCache = async (data: { locations: Location[], areas: Area[], agents: Agent[] }): Promise<void> => {
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
  };

  const loadModalData = async () => {
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
          
          setIsDataLoading(false);
          return;
        }
      }
      
      // Fetch fresh data if cache is invalid or missing
      console.log('🌐 Fetching fresh data from API...');
      console.log('🔗 API Call: getPackageFormData()');
      
      const formData = await getPackageFormData();
      
      // DEBUG: Log the raw API response
      console.log('📦 RAW API Response:', JSON.stringify(formData, null, 2));
      console.log('📊 API Response Structure:', {
        hasLocations: !!formData.locations,
        hasAreas: !!formData.areas,
        hasAgents: !!formData.agents,
        locationsType: typeof formData.locations,
        areasType: typeof formData.areas,
        agentsType: typeof formData.agents,
        locationsLength: formData.locations?.length || 0,
        areasLength: formData.areas?.length || 0,
        agentsLength: formData.agents?.length || 0
      });
      
      setLocations(formData.locations || []);
      setAreas(formData.areas || []);
      setAgents(formData.agents || []);
      
      // Save to cache
      await saveToCache(formData);
      
      console.log('✅ Fresh data loaded and cached:', {
        locations: (formData.locations || []).length,
        areas: (formData.areas || []).length,
        agents: (formData.agents || []).length
      });
      
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
  };

  const resetForm = () => {
    setCurrentStep(0);
    setPackageData({
      sender_name: '',
      sender_phone: '',
      receiver_name: '',
      receiver_phone: '',
      origin_area_id: '',
      destination_area_id: '',
      origin_agent_id: '',
      destination_agent_id: '',
      delivery_type: 'doorstep'
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
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  // Enhanced area-based cost calculation with detailed debugging
  const calculateCost = () => {
    console.log('💰 Starting cost calculation...');
    
    const originAgent = agents.find(a => a.id === packageData.origin_agent_id);
    if (!originAgent) {
      console.log('❌ Origin agent not found for cost calculation');
      console.log('📊 Available agents:', agents.map(a => ({ id: a.id, name: a.name })));
      console.log('🎯 Looking for agent ID:', packageData.origin_agent_id);
      return;
    }

    console.log('✅ Origin agent found:', {
      agentId: originAgent.id,
      agentName: originAgent.name,
      agentAreaId: originAgent.area_id,
      agentAreaIdType: typeof originAgent.area_id
    });

    // Enhanced area lookup with debugging
    console.log('🔍 Searching for origin area...');
    console.log('📊 Available areas:', areas.map(a => ({ id: a.id, name: a.name, idType: typeof a.id })));
    console.log('🎯 Looking for area ID:', originAgent.area_id, 'Type:', typeof originAgent.area_id);
    
    const originArea = areas.find(a => {
      console.log(`🔍 Comparing area ${a.id} (${typeof a.id}) with ${originAgent.area_id} (${typeof originAgent.area_id})`);
      // Try both strict and loose comparison
      return a.id === originAgent.area_id || a.id == originAgent.area_id || 
             String(a.id) === String(originAgent.area_id);
    });
    
    if (!originArea) {
      console.log('❌ Origin area not found for cost calculation');
      console.log('🔍 Debug info:', {
        agentAreaId: originAgent.area_id,
        agentAreaIdType: typeof originAgent.area_id,
        availableAreaIds: areas.map(a => ({ id: a.id, type: typeof a.id, name: a.name }))
      });
      return;
    }

    console.log('✅ Origin area found:', {
      areaId: originArea.id,
      areaName: originArea.name,
      locationId: originArea.location_id,
      locationName: originArea.location?.name
    });

    let destinationAreaId = packageData.destination_area_id;
    let destinationAgent = null;
    
    if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
      destinationAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
      if (destinationAgent) {
        destinationAreaId = destinationAgent.area_id || '';
        console.log('✅ Destination agent found:', {
          agentId: destinationAgent.id,
          agentName: destinationAgent.name,
          agentAreaId: destinationAgent.area_id
        });
      }
    }

    if (!destinationAreaId) {
      console.log('❌ Destination area ID not found for cost calculation');
      return;
    }

    console.log('🔍 Searching for destination area...');
    const destinationArea = areas.find(a => {
      return a.id === destinationAreaId || a.id == destinationAreaId || 
             String(a.id) === String(destinationAreaId);
    });
    
    if (!destinationArea) {
      console.log('❌ Destination area not found for cost calculation');
      console.log('🔍 Debug info:', {
        destinationAreaId,
        destinationAreaIdType: typeof destinationAreaId,
        availableAreaIds: areas.map(a => ({ id: a.id, type: typeof a.id, name: a.name }))
      });
      return;
    }

    console.log('✅ Destination area found:', {
      areaId: destinationArea.id,
      areaName: destinationArea.name,
      locationId: destinationArea.location_id,
      locationName: destinationArea.location?.name
    });
    
    // Enhanced logging for debugging
    console.log('💰 Calculating cost with areas:', {
      originAgent: originAgent.name,
      originArea: originArea.name,
      originLocation: originArea.location?.name,
      destinationArea: destinationArea.name,
      destinationLocation: destinationArea.location?.name,
      deliveryType: packageData.delivery_type
    });
    
    // Area-based pricing logic - both agent-to-agent and agent-to-doorstep use area calculations
    const isIntraArea = String(originArea.id) === String(destinationArea.id);
    const isIntraLocation = String(originArea.location_id) === String(destinationArea.location_id);
    
    console.log('🔍 Pricing logic checks:', {
      originAreaId: originArea.id,
      destinationAreaId: destinationArea.id,
      originLocationId: originArea.location_id,
      destinationLocationId: destinationArea.location_id,
      isIntraArea,
      isIntraLocation
    });
    
    let baseCost = 0;
    
    if (packageData.delivery_type === 'agent') {
      // Agent-to-Agent pricing (typically lower due to no last-mile delivery)
      if (isIntraArea) {
        baseCost = 120; // Same area agent transfer
        console.log('💰 Same area agent transfer: KES 120');
      } else if (isIntraLocation) {
        baseCost = 150; // Same location (e.g., within Nairobi), different areas
        console.log('💰 Same location, different areas agent transfer: KES 150');
      } else {
        baseCost = 180; // Different locations (e.g., Nairobi to Mombasa)
        console.log('💰 Different locations agent transfer: KES 180');
      }
    } else {
      // Agent-to-Doorstep pricing (higher due to last-mile delivery)
      if (isIntraArea) {
        baseCost = 250; // Same area doorstep delivery
        console.log('💰 Same area doorstep delivery: KES 250');
      } else if (isIntraLocation) {
        baseCost = 300; // Same location, different areas, doorstep delivery
        console.log('💰 Same location, different areas doorstep delivery: KES 300');
      } else {
        baseCost = 380; // Different locations, doorstep delivery
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
  };

  const updatePackageData = (field: keyof PackageData, value: string) => {
    setPackageData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-update origin_area_id when origin_agent_id changes
      if (field === 'origin_agent_id') {
        const selectedAgent = agents.find(agent => agent.id === value);
        if (selectedAgent) {
          updated.origin_area_id = selectedAgent.area_id || '';
          console.log('🎯 Origin agent selected:', {
            agentName: selectedAgent.name,
            agentId: selectedAgent.id,
            areaId: selectedAgent.area_id,
            areaName: selectedAgent.area?.name,
            locationName: selectedAgent.area?.location?.name
          });
        }
      }
      
      return updated;
    });
  };

  const updateSearchQuery = (field: keyof typeof searchQueries, value: string) => {
    setSearchQueries(prev => ({ ...prev, [field]: value }));
  };

  // Enhanced sorting functionality
  const applySortAndFilter = (items: Agent[] | Area[], searchQuery: string, itemType: 'agent' | 'area') => {
    // Debug log the input
    console.log(`🔍 Filtering ${itemType}s:`, {
      inputCount: items.length,
      searchQuery,
      firstItem: items[0]
    });

    // Filter by search query
    const filtered = items.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      if (itemType === 'agent') {
        const agent = item as Agent;
        const name = agent.name || agent.attributes?.name || '';
        const phone = agent.phone || agent.attributes?.phone || '';
        const areaName = agent.area?.name || agent.relationships?.area?.data?.name || '';
        const locationName = agent.area?.location?.name || '';
        
        return (
          name.toLowerCase().includes(searchLower) ||
          phone.toLowerCase().includes(searchLower) ||
          areaName.toLowerCase().includes(searchLower) ||
          locationName.toLowerCase().includes(searchLower)
        );
      } else {
        const area = item as Area;
        const name = area.name || area.attributes?.name || '';
        const locationName = area.location?.name || '';
        return (
          name.toLowerCase().includes(searchLower) ||
          locationName.toLowerCase().includes(searchLower)
        );
      }
    });

    console.log(`✅ Filtered ${itemType}s:`, {
      filteredCount: filtered.length,
      originalCount: items.length
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      switch (sortConfig.field) {
        case 'name':
          if (itemType === 'agent') {
            aValue = (a as Agent).name || (a as Agent).attributes?.name || '';
            bValue = (b as Agent).name || (b as Agent).attributes?.name || '';
          } else {
            aValue = (a as Area).name || (a as Area).attributes?.name || '';
            bValue = (b as Area).name || (b as Area).attributes?.name || '';
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
  };

  // Group filtered and sorted items by location
  const getGroupedItems = (items: Agent[] | Area[], searchQuery: string, itemType: 'agent' | 'area') => {
    const sortedFiltered = applySortAndFilter(items, searchQuery, itemType);
    
    console.log(`📋 Grouping ${itemType}s:`, {
      sortedFilteredCount: sortedFiltered.length
    });
    
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
  };

  const handleSortChange = (field: SortOption) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSelectedOriginAgent = () => {
    return agents.find(agent => agent.id === packageData.origin_agent_id);
  };

  const getSelectedDestinationArea = () => {
    if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
      const selectedAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
      return areas.find(area => area.id === selectedAgent?.area_id);
    }
    return areas.find(area => area.id === packageData.destination_area_id);
  };

  const getSelectedDestinationAgent = () => {
    return agents.find(agent => agent.id === packageData.destination_agent_id);
  };

  const isCurrentStepValid = () => {
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
        if (packageData.delivery_type === 'doorstep') {
          return deliveryLocation.trim().length > 0;
        }
        return true;
      case 5: return true;
      default: return false;
    }
  };

  const nextStep = () => {
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
  };

  const prevStep = () => {
    if (currentStep > 0) {
      if (currentStep === 5 && packageData.delivery_type === 'agent') {
        setCurrentStep(3);
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentStepValid()) return;

    setIsSubmitting(true);
    try {
      const finalPackageData = {
        ...packageData,
        sender_name: 'Current User',
        sender_phone: '+254700000000',
      };

      console.log('📦 Submitting package data:', finalPackageData);
      await onSubmit(finalPackageData);
      
      // Show success toast
      Toast.show({
        type: 'successToast',
        text1: 'Package Created Successfully!',
        position: 'top',
        visibilityTime: 4000,
      });
      
      closeModal();
    } catch (error: any) {
      console.error('❌ Failed to submit package:', error);
      
      // Show error toast instead of Alert
      Toast.show({
        type: 'errorToast',
        text1: 'Failed to Create Package',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryDataLoad = () => {
    console.log('🔄 Retrying data load...');
    loadModalData();
  };

  // Clear cache function for debugging/maintenance
  const clearCache = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.LOCATIONS),
        AsyncStorage.removeItem(STORAGE_KEYS.AREAS),
        AsyncStorage.removeItem(STORAGE_KEYS.AGENTS),
        AsyncStorage.removeItem(STORAGE_KEYS.LAST_UPDATED)
      ]);
      console.log('🗑️ Cache cleared');
      
      // Show cache cleared toast
      Toast.show({
        type: 'defaultToast',
        text1: 'Cache Cleared - Refreshing Data',
        position: 'top',
        visibilityTime: 2000,
      });
      
      // Immediately reload fresh data after clearing cache
      await loadModalData();
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      
      Toast.show({
        type: 'errorToast',
        text1: 'Failed to Clear Cache',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Enhanced Search and Sort Header Component
  const renderSearchAndSortHeader = (
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
  );

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
        Step {currentStep + 1} of {STEP_TITLES.length}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{STEP_TITLES[currentStep]}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  // Step 0: Origin Agent Selection with enhanced area logging
  const renderOriginAgentSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Origin Agent</Text>
      <Text style={styles.stepSubtitle}>Which agent will collect the package?</Text>
      
      {renderSearchAndSortHeader(
        searchQueries.originAgent,
        (value) => updateSearchQuery('originAgent', value),
        'Search agents by name, area, or location...'
      )}
      
      <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
        {getGroupedItems(agents, searchQueries.originAgent, 'agent').map((group, groupIndex) => (
          <View key={groupIndex}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationHeaderText}>{group.locationName}</Text>
              <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
            </View>
            
            {group.items.map((agent) => {
              const agentData = agent as Agent;
              const agentName = agentData.name || agentData.attributes?.name || 'Unknown Agent';
              const agentPhone = agentData.phone || agentData.attributes?.phone || '';
              const agentId = agentData.id || agentData.attributes?.id || '';
              
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
                        {agentData.area?.name || 'Unknown Area'} • {group.locationName}
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
        ))}
        
        {applySortAndFilter(agents, searchQueries.originAgent, 'agent').length === 0 && (
          <View style={styles.noResultsContainer}>
            <Feather name="search" size={48} color="#666" />
            <Text style={styles.noResultsTitle}>No agents found</Text>
            <Text style={styles.noResultsText}>Try a different search term or adjust filters</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderReceiverDetails = () => (
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
  );

  const renderDeliveryMethodSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Method</Text>
      <Text style={styles.stepSubtitle}>How should the package be delivered?</Text>
      
      <View style={styles.deliveryOptions}>
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
              <Text style={styles.deliveryOptionTitle}>Agent to Agent</Text>
              <Text style={styles.deliveryOptionSubtitle}>Collect from destination agent</Text>
            </View>
            {packageData.delivery_type === 'agent' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>

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
              <Text style={styles.deliveryOptionTitle}>Agent to Doorstep</Text>
              <Text style={styles.deliveryOptionSubtitle}>Direct delivery to address</Text>
            </View>
            {packageData.delivery_type === 'doorstep' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDestinationSelection = () => {
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
                  const agentName = agentData.name || agentData.attributes?.name || 'Unknown Agent';
                  const agentPhone = agentData.phone || agentData.attributes?.phone || '';
                  const agentId = agentData.id || agentData.attributes?.id || '';
                  
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
                            {agentData.area?.name || 'Unknown Area'} • {group.locationName}
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
  };

  const renderDeliveryLocation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Location</Text>
      <Text style={styles.stepSubtitle}>Provide the exact delivery address</Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter specific address, building name, floor, etc."
          placeholderTextColor="#888"
          value={deliveryLocation}
          onChangeText={setDeliveryLocation}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <View style={[styles.stepContent, styles.stepContentConfirmation]}>
      <Text style={styles.stepTitle}>Confirm Package Details</Text>
      <Text style={styles.stepSubtitle}>Review all information before submitting</Text>
      
      <View style={styles.confirmationContainer}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeAreaInitials}>
                {getSelectedOriginAgent()?.name?.substring(0, 2).toUpperCase() || '--'}
              </Text>
              <Text style={styles.routeAreaName}>{getSelectedOriginAgent()?.name || 'Unknown'}</Text>
              <Text style={styles.routeLocationName}>
                {getSelectedOriginAgent()?.area?.name} • {getSelectedOriginAgent()?.area?.location?.name}
              </Text>
            </View>
            <Feather name="arrow-right" size={20} color="#7c3aed" />
            <View style={styles.routePoint}>
              {packageData.delivery_type === 'agent' ? (
                <>
                  <Text style={styles.routeAreaInitials}>
                    {getSelectedDestinationAgent()?.name?.substring(0, 2).toUpperCase() || '--'}
                  </Text>
                  <Text style={styles.routeAreaName}>{getSelectedDestinationAgent()?.name || 'Unknown'}</Text>
                  <Text style={styles.routeLocationName}>
                    {getSelectedDestinationAgent()?.area?.name} • {getSelectedDestinationAgent()?.area?.location?.name}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.routeAreaInitials}>{getSelectedDestinationArea()?.initials || '--'}</Text>
                  <Text style={styles.routeAreaName}>{getSelectedDestinationArea()?.name || 'Unknown'}</Text>
                  <Text style={styles.routeLocationName}>{getSelectedDestinationArea()?.location?.name || 'Unknown'}</Text>
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
            {packageData.delivery_type === 'doorstep' ? 'Agent to Doorstep' : 'Agent to Agent'}
          </Text>
          
          {packageData.delivery_type === 'agent' && getSelectedDestinationAgent() && (
            <View style={styles.agentInfo}>
              <Text style={styles.confirmationDetail}>Destination Agent: {getSelectedDestinationAgent()?.name}</Text>
              <Text style={styles.confirmationSubDetail}>{getSelectedDestinationAgent()?.phone}</Text>
            </View>
          )}

          {packageData.delivery_type === 'doorstep' && deliveryLocation && (
            <View style={styles.deliveryLocationInfo}>
              <Text style={styles.confirmationSubDetail}>Delivery Address:</Text>
              <Text style={styles.confirmationDetail}>{deliveryLocation}</Text>
            </View>
          )}
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Estimated Cost</Text>
          {estimatedCost ? (
            <Text style={styles.estimatedCost}>KES {estimatedCost.toLocaleString()}</Text>
          ) : (
            <Text style={styles.pricingError}>Unable to calculate cost</Text>
          )}
          
          {/* Debug information for cost calculation */}
          {__DEV__ && getSelectedOriginAgent() && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>
                Debug: {getSelectedOriginAgent()?.area?.name} → {getSelectedDestinationArea()?.name}
              </Text>
              <Text style={styles.debugText}>
                Same Area: {getSelectedOriginAgent()?.area_id === getSelectedDestinationArea()?.id ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.debugText}>
                Same Location: {getSelectedOriginAgent()?.area?.location_id === getSelectedDestinationArea()?.location_id ? 'Yes' : 'No'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderOriginAgentSelection();
      case 1: return renderReceiverDetails();
      case 2: return renderDeliveryMethodSelection();
      case 3: return renderDestinationSelection();
      case 4: return renderDeliveryLocation();
      case 5: return renderConfirmation();
      default: return renderOriginAgentSelection();
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
      
      {/* Debug cache clear button in development */}
      {__DEV__ && currentStep === 0 && (
        <TouchableOpacity onPress={clearCache} style={styles.debugButton}>
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
  );

  // MAIN CONTENT RENDERING
  const renderMainContent = () => {
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
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.modalContainer,
              { transform: [{ translateY: slideAnim }] }
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
    </Modal>
  );
}

// Enhanced Styles with new search and sort components + debug styles
const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.95, // Increased from 0.9 to 0.95
    minHeight: SCREEN_HEIGHT * 0.7,  // Increased from 0.6 to 0.7
    width: SCREEN_WIDTH,
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
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
    top: 20,
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
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  
  // Progress bar
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
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
    marginTop: 8,
  },
  
  // Content styles
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContent: {
    flex: 1,
    minHeight: 400,
  },
  stepContentConfirmation: {
    flex: 1,
    minHeight: 600, // Larger height specifically for confirmation step
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
    marginBottom: 30,
  },
  
  // Enhanced Search and Sort styles
  searchAndSortContainer: {
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    paddingHorizontal: 16,
    minHeight: 48,
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  
  // Location header styles
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 8,
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
  
  // Selection list styles
  selectionList: {
    flex: 1,
  },
  selectionItem: {
    marginBottom: 12,
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
    padding: 16,
  },
  selectionInitials: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  selectionInitialsText: {
    fontSize: 16,
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
    marginBottom: 4,
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
    paddingVertical: 60,
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
  },
  
  // Form styles
  formContainer: {
    gap: 20,
    paddingVertical: 10,
  },
  input: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  
  // Delivery options
  deliveryOptions: {
    gap: 16,
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
    padding: 20,
  },
  deliveryOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  deliveryOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deliveryOptionSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  
  // Confirmation styles - Enhanced for better visibility
  confirmationContainer: {
    gap: 20, // Reduced from 24 to 20 for tighter spacing
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16, // Reduced from 20 to 16 for more compact sections
  },
  confirmationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 12,
  },
  confirmationDetail: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  confirmationSubDetail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
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
  
  // Navigation
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  spacer: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    paddingHorizontal: 24,
    paddingVertical: 12,
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
    paddingHorizontal: 24,
    paddingVertical: 12,
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
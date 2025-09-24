// components/PackageCreationModal.tsx - Enhanced with auto-population fix for edit/resubmit

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
  Keyboard,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '@/lib/api';
import { 
  getPackageFormData,
  getPackagePricing, 
  validatePackageFormData,
  createPackage,
  type Location, 
  type Area, 
  type Agent,
  type PackageData,
  getAreas,
  getAgents
} from '../lib/helpers/packageHelpers';
import { useUser } from '../context/UserContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Package {
  id: string;
  code: string;
  state: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone: string;
  delivery_type: string;
  origin_area_id?: string;
  destination_area_id?: string;
  origin_agent_id?: string;
  destination_agent_id?: string;
  delivery_location?: string;
  package_description?: string;
  package_size?: string;
  special_instructions?: string;
  business_name?: string;
  business_phone?: string;
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
}

interface PackageCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  editPackage?: Package;
  resubmitPackage?: Package;
  mode: 'create' | 'edit' | 'resubmit';
}

// UPDATED: New step titles with package size as first step
const STEP_TITLES = [
  'Package Size',
  'Sender Office',
  'Receiver Details', 
  'Delivery Method',
  'Destination',
  'Delivery Location',
  'Confirm Details'
];

type SortDirection = 'asc' | 'desc';
type DeliveryType = 'doorstep' | 'agent';
type PackageSize = 'small' | 'medium' | 'large';

// Storage keys for caching
const STORAGE_KEYS = {
  LOCATIONS: 'package_modal_locations',
  AREAS: 'package_modal_areas',
  AGENTS: 'package_modal_agents',
  LAST_UPDATED: 'package_modal_last_updated'
} as const;

const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Extended PackageData interface with size and notes (business info auto-populated)
interface ExtendedPackageData extends PackageData {
  delivery_type: DeliveryType;
  package_size?: PackageSize;
  receiver_notes?: string;
  rider_notes?: string;
}

// Interface for pending packages
interface PendingPackage extends ExtendedPackageData {
  id: string;
  created_at: number;
  delivery_location?: string;
}

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
  onSubmit,
  editPackage,
  resubmitPackage,
  mode
}: PackageCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { isCacheValid, loadFromCache, saveToCache, clearCache } = useDataCache();

  // Access user context for business information
  const { selectedBusiness, getDisplayName, getUserPhone } = useUser();

  // ENHANCED: Dependency management states
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Multi-package states
  const [pendingPackages, setPendingPackages] = useState<PendingPackage[]>([]);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);

  // Large package modal state
  const [showLargePackageModal, setShowLargePackageModal] = useState(false);
  const [largePackageInstructions, setLargePackageInstructions] = useState('');

  // Form data with extended properties (business info auto-populated)
  const [packageData, setPackageData] = useState<ExtendedPackageData>({
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    origin_area_id: '',
    destination_area_id: '',
    origin_agent_id: '',
    destination_agent_id: '',
    delivery_type: 'doorstep' as DeliveryType,
    package_size: 'medium' as PackageSize, // Default to medium
    receiver_notes: '',
    rider_notes: ''
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
    field: 'name' | 'location';
    direction: SortDirection;
  }>({
    field: 'name',
    direction: 'asc'
  });

  // NEW: Get modal title based on mode and package type
  const getModalTitle = useCallback(() => {
    const currentStepTitle = STEP_TITLES[currentStep];
    
    switch (mode) {
      case 'edit':
        return `Edit Package - ${currentStepTitle}`;
      case 'resubmit':
        return `Resubmit Package - ${currentStepTitle}`;
      default:
        return currentStepTitle;
    }
  }, [mode, currentStep]);

  // NEW: Get action button text based on mode
  const getActionButtonText = useCallback(() => {
    const packageCount = pendingPackages.length + 1;
    
    switch (mode) {
      case 'edit':
        return pendingPackages.length > 0 
          ? `Update ${packageCount} Package${packageCount > 1 ? 's' : ''}`
          : 'Update Package';
      case 'resubmit':
        return pendingPackages.length > 0 
          ? `Resubmit ${packageCount} Package${packageCount > 1 ? 's' : ''}`
          : 'Resubmit Package';
      default:
        return pendingPackages.length > 0 
          ? `Submit ${packageCount} Package${packageCount > 1 ? 's' : ''}`
          : 'Create Package';
    }
  }, [mode, pendingPackages.length]);

  // ENHANCED: Load reference data with dependency management
  const loadReferenceData = useCallback(async (retryCount = 0): Promise<void> => {
    console.log(`🔄 Loading package modal reference data (attempt ${retryCount + 1})`);
    
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
          
          const validation = validatePackageFormData(cachedData);
          if (!validation.isValid) {
            console.warn('⚠️ Cached data validation failed:', validation.issues);
            await clearCache();
            throw new Error('Cached data is invalid, fetching fresh data...');
          }
          
          return Promise.resolve();
        }
      }
      
      console.log('🌐 Fetching fresh data from API...');
      
      // Load data using individual functions for better reliability
      const [areasData, agentsData, locationsData] = await Promise.all([
        getAreas(),
        getAgents(),
        getPackageFormData().then(data => data.locations).catch(() => [])
      ]);
      
      console.log('📦 Fresh data loaded:', {
        locations: locationsData.length,
        areas: areasData.length,
        agents: agentsData.length
      });
      
      setLocations(locationsData);
      setAreas(areasData);
      setAgents(agentsData);
      
      // Save to cache
      await saveToCache({
        locations: locationsData,
        areas: areasData,
        agents: agentsData
      });
      
      console.log('✅ Fresh data loaded and cached successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to load reference data:', error);
      
      if (retryCount < 2) {
        console.log('🔄 Retrying reference data load...');
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadReferenceData(retryCount + 1);
      }
      
      // Try to use cached data as fallback
      const cachedData = await loadFromCache();
      if (cachedData) {
        console.log('📋 Using expired cache as fallback...');
        setLocations(cachedData.locations);
        setAreas(cachedData.areas);
        setAgents(cachedData.agents);
        setDataError(null);
        return Promise.resolve();
      }
      
      setDataError(error.message || 'Failed to load reference data');
      throw error;
    } finally {
      setIsDataLoading(false);
    }
  }, [isCacheValid, loadFromCache, clearCache, saveToCache]);

  // ENHANCED: Load package data for editing/resubmitting with proper dependency management
  const loadPackageForEditing = useCallback(async (pkg: Package) => {
    console.log('🔧 Loading package for editing:', pkg.code);
    
    // Wait for reference data to be available
    if (areas.length === 0 || agents.length === 0) {
      console.log('⏳ Waiting for reference data before auto-populating...');
      return;
    }

    try {
      // Set basic form data
      setPackageData(prev => ({
        ...prev,
        sender_name: pkg.sender_name || '',
        sender_phone: pkg.sender_phone || '',
        receiver_name: pkg.receiver_name || '',
        receiver_phone: pkg.receiver_phone || '',
        delivery_type: (pkg.delivery_type as DeliveryType) || 'doorstep',
        package_size: (pkg.package_size as PackageSize) || 'medium',
        special_instructions: pkg.special_instructions || '',
        business_name: pkg.business_name || selectedBusiness?.name || '',
        business_phone: pkg.business_phone || selectedBusiness?.phone_number || '',
        receiver_notes: '',
        rider_notes: ''
      }));
      
      setDeliveryLocation(pkg.delivery_location || '');
      setLargePackageInstructions(pkg.special_instructions || '');

      // ENHANCED: Map and select areas/agents with proper matching
      if (pkg.origin_area_id) {
        const originArea = areas.find(area => 
          area.id === pkg.origin_area_id || 
          area.id == pkg.origin_area_id ||
          String(area.id) === String(pkg.origin_area_id)
        );
        
        if (originArea) {
          setPackageData(prev => ({ ...prev, origin_area_id: originArea.id }));
          console.log('✅ Mapped origin area:', originArea.name);
        } else {
          console.warn('⚠️ Origin area not found:', pkg.origin_area_id);
        }
      }

      if (pkg.origin_agent_id) {
        const originAgent = agents.find(agent => 
          agent.id === pkg.origin_agent_id || 
          agent.id == pkg.origin_agent_id ||
          String(agent.id) === String(pkg.origin_agent_id)
        );
        
        if (originAgent) {
          setPackageData(prev => ({ 
            ...prev, 
            origin_agent_id: originAgent.id,
            origin_area_id: originAgent.area?.id || prev.origin_area_id
          }));
          console.log('✅ Mapped origin agent:', originAgent.name);
        } else {
          console.warn('⚠️ Origin agent not found:', pkg.origin_agent_id);
        }
      }

      if (pkg.destination_area_id) {
        const destArea = areas.find(area => 
          area.id === pkg.destination_area_id || 
          area.id == pkg.destination_area_id ||
          String(area.id) === String(pkg.destination_area_id)
        );
        
        if (destArea) {
          setPackageData(prev => ({ ...prev, destination_area_id: destArea.id }));
          console.log('✅ Mapped destination area:', destArea.name);
        } else {
          console.warn('⚠️ Destination area not found:', pkg.destination_area_id);
        }
      }

      if (pkg.destination_agent_id) {
        const destAgent = agents.find(agent => 
          agent.id === pkg.destination_agent_id || 
          agent.id == pkg.destination_agent_id ||
          String(agent.id) === String(pkg.destination_agent_id)
        );
        
        if (destAgent) {
          setPackageData(prev => ({ 
            ...prev, 
            destination_agent_id: destAgent.id,
            destination_area_id: destAgent.area?.id || prev.destination_area_id
          }));
          console.log('✅ Mapped destination agent:', destAgent.name);
        } else {
          console.warn('⚠️ Destination agent not found:', pkg.destination_agent_id);
        }
      }

      // ENHANCED: Handle step navigation for resubmit mode
      if (mode === 'resubmit') {
        console.log('🔄 Resubmit mode - navigating to confirmation step');
        setCurrentStep(STEP_TITLES.length - 1);
      }

      console.log('✅ Package data loaded and auto-populated successfully');

    } catch (error) {
      console.error('❌ Error auto-populating package data:', error);
    }
  }, [areas, agents, selectedBusiness, mode, STEP_TITLES.length]);

  // ENHANCED: Dependency-aware initialization
  useEffect(() => {
    if (visible && !isInitialized) {
      console.log('🚀 Initializing package modal with dependency management');
      
      const initializeModal = async () => {
        try {
          // Step 1: Load reference data first
          await loadReferenceData();
          
          // Step 2: Load package data for editing/resubmitting (if applicable)
          const packageToLoad = editPackage || resubmitPackage;
          if (packageToLoad && (mode === 'edit' || mode === 'resubmit')) {
            // Small delay to ensure state updates are processed
            setTimeout(() => {
              loadPackageForEditing(packageToLoad);
            }, 100);
          }
          
          setIsInitialized(true);
          console.log('✅ Package modal initialization complete');
          
        } catch (error) {
          console.error('❌ Failed to initialize package modal:', error);
        }
      };

      initializeModal();
    }
  }, [visible, isInitialized, loadReferenceData, loadPackageForEditing, editPackage, resubmitPackage, mode]);

  // Effect to handle package data loading when reference data becomes available
  useEffect(() => {
    if (areas.length > 0 && agents.length > 0) {
      const packageToLoad = editPackage || resubmitPackage;
      if (packageToLoad && (mode === 'edit' || mode === 'resubmit') && isInitialized) {
        console.log('🔄 Reference data available, loading package data...');
        loadPackageForEditing(packageToLoad);
      }
    }
  }, [areas, agents, editPackage, resubmitPackage, mode, isInitialized, loadPackageForEditing]);

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

  // Calculate modal height based on keyboard state
  const modalHeight = useMemo(() => {
    if (isKeyboardVisible) {
      const maxHeightWithKeyboard = SCREEN_HEIGHT - keyboardHeight - (Platform.OS === 'ios' ? 100 : 80);
      return Math.min(maxHeightWithKeyboard, SCREEN_HEIGHT * 0.85);
    }
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

  // Calculate total packages (pending + current)
  const totalPackages = pendingPackages.length + (currentStep === STEP_TITLES.length - 1 ? 1 : 0);

  useEffect(() => {
    if (visible) {
      if (!isCreatingMultiple && mode === 'create') {
        resetForm();
      }
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset initialization state when modal closes
      setIsInitialized(false);
    }
  }, [visible, isCreatingMultiple, mode]);

  const resetForm = useCallback(() => {
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
      delivery_type: 'doorstep' as DeliveryType,
      package_size: 'medium' as PackageSize,
      special_instructions: ''
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
    setShowLargePackageModal(false);
    setLargePackageInstructions('');
    setPendingPackages([]);
    setIsCreatingMultiple(false);
    setDataError(null);
    setLocations([]);
    setAreas([]);
    setAgents([]);
    setIsInitialized(false);
  }, []);

  // Reset only for new package (keep pending packages)
  const resetFormForNewPackage = useCallback(() => {
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
      delivery_type: 'doorstep' as DeliveryType,
      package_size: 'medium' as PackageSize,
      special_instructions: ''
    });
    setDeliveryLocation('');
    setEstimatedCost(null);
    setSearchQueries({
      originAgent: '',
      destinationAgent: '',
      destinationArea: ''
    });
    setSortConfig({ field: 'name', direction: 'asc' });
    setShowLargePackageModal(false);
    setLargePackageInstructions('');
  }, []);

  const closeModal = useCallback(() => {
    // Show warning if there are pending packages
    if (pendingPackages.length > 0) {
      Alert.alert(
        'Unsaved Packages',
        `You have ${pendingPackages.length} unsaved package(s). If you close now, all progress will be lost. It's recommended to submit your packages first.`,
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

  // Package size cost calculation with pricing tiers
  const calculateSizeCost = useCallback((size: PackageSize) => {
    switch (size) {
      case 'small': return 0; // No additional cost
      case 'medium': return 50; // Additional 50 KES
      case 'large': return 120; // Additional 120 KES
      default: return 50;
    }
  }, []);

  const calculateCost = useCallback(() => {
    console.log('💰 Starting cost calculation...');
    
    if (!selectedOriginAgent) {
      console.log('❌ Origin agent not found for cost calculation');
      return;
    }

    const originArea = areas.find(a => {
      return a.id === selectedOriginAgent.area?.id || 
             a.id == selectedOriginAgent.area?.id || 
             String(a.id) === String(selectedOriginAgent.area?.id);
    });
    
    if (!originArea) {
      console.log('❌ Origin area not found for cost calculation');
      return;
    }

    if (!selectedDestinationArea) {
      console.log('❌ Destination area not found for cost calculation');
      return;
    }
    
    const isIntraArea = String(originArea.id) === String(selectedDestinationArea.id);
    const isIntraLocation = String(originArea.location_id) === String(selectedDestinationArea.location_id);
    
    let baseCost = 0;
    
    if (packageData.delivery_type === 'agent') {
      if (isIntraArea) {
        baseCost = 120;
      } else if (isIntraLocation) {
        baseCost = 150;
      } else {
        baseCost = 180;
      }
    } else {
      if (isIntraArea) {
        baseCost = 250;
      } else if (isIntraLocation) {
        baseCost = 300;
      } else {
        baseCost = 380;
      }
    }
    
    // Add package size cost for doorstep delivery
    if (packageData.delivery_type === 'doorstep') {
      const sizeCost = calculateSizeCost(packageData.package_size || 'medium');
      baseCost += sizeCost;
      console.log('💰 Added size cost:', {
        size: packageData.package_size,
        sizeCost,
        totalCost: baseCost
      });
    }
    
    setEstimatedCost(baseCost);
  }, [selectedOriginAgent, selectedDestinationArea, areas, packageData.delivery_type, packageData.package_size, calculateSizeCost]);

  // Updated updatePackageData to handle both origin and destination agents
  const updatePackageData = useCallback((field: keyof ExtendedPackageData, value: string) => {
    setPackageData(prev => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'origin_agent_id') {
        const selectedAgent = agents.find(agent => agent.id === value);
        if (selectedAgent && selectedAgent.area?.id) {
          updated.origin_area_id = selectedAgent.area.id;
        }
      }
      
      if (field === 'destination_agent_id') {
        const selectedAgent = agents.find(agent => agent.id === value);
        if (selectedAgent && selectedAgent.area?.id) {
          updated.destination_area_id = selectedAgent.area.id;
        }
      }
      
      return updated;
    });
  }, [agents]);

  // Handler for package size with modal trigger
  const handlePackageSizeChange = useCallback((size: PackageSize) => {
    updatePackageData('package_size', size);
    
    // Show modal only when changing TO large package
    if (size === 'large' && packageData.package_size !== 'large') {
      setLargePackageInstructions(packageData.special_instructions || '');
      setShowLargePackageModal(true);
    }
  }, [updatePackageData, packageData.package_size, packageData.special_instructions]);

  const updateSearchQuery = useCallback((field: keyof typeof searchQueries, value: string) => {
    setSearchQueries(prev => ({ ...prev, [field]: value }));
  }, []);

  const getGroupedItems = useCallback((items: Agent[] | Area[], searchQuery: string, itemType: 'agent' | 'area') => {
    // First filter the items based on search query
    const filtered = items.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      if (itemType === 'agent') {
        const agent = item as Agent;
        const name = agent.name || '';
        const areaName = agent.area?.name || '';
        const locationName = agent.area?.location?.name || '';
        
        return (
          name.toLowerCase().includes(searchLower) ||
          areaName.toLowerCase().includes(searchLower) ||
          locationName.toLowerCase().includes(searchLower)
        );
      } else {
        const area = item as Area;
        const name = area.name || '';
        const locationName = area.location?.name || '';
        
        return (
          name.toLowerCase().includes(searchLower) ||
          locationName.toLowerCase().includes(searchLower)
        );
      }
    });
    
    if (filtered.length === 0) return [];
    
    // Handle sorting based on field
    if (sortConfig.field === 'name') {
      // For name sorting: return flat list sorted by name only
      const sorted = filtered.sort((a, b) => {
        let aName = '';
        let bName = '';
        if (itemType === 'agent') {
          aName = (a as Agent).name || '';
          bName = (b as Agent).name || '';
        } else {
          aName = (a as Area).name || '';
          bName = (b as Area).name || '';
        }
        const comparison = aName.localeCompare(bName, 'en', { sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
      
      // Return as a single group with no location header
      return [{
        locationName: 'All Items',
        items: sorted
      }];
    } else {
      // For location sorting: group by location and sort both groups and items within groups
      const grouped = filtered.reduce((acc, item) => {
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

      // Sort locations alphabetically A-Z, with "Unknown Location" at the end
      const sortedGroups = Object.entries(grouped)
        .sort(([a], [b]) => {
          if (a === 'Unknown Location') return 1;
          if (b === 'Unknown Location') return -1;
          const comparison = a.localeCompare(b, 'en', { sensitivity: 'base' });
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        })
        .map(([locationName, items]) => ({
          locationName,
          // Sort items within each location alphabetically by name
          items: items.sort((a, b) => {
            let aName = '';
            let bName = '';
            if (itemType === 'agent') {
              aName = (a as Agent).name || '';
              bName = (b as Agent).name || '';
            } else {
              aName = (a as Area).name || '';
              bName = (b as Area).name || '';
            }
            return aName.localeCompare(bName, 'en', { sensitivity: 'base' });
          })
        }));
      
      return sortedGroups;
    }
  }, [sortConfig]);

  const handleSortChange = useCallback((field: 'name' | 'location') => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // UPDATED: Step validation with new step order
  const isCurrentStepValid = useCallback(() => {
    switch (currentStep) {
      case 0: return packageData.package_size && packageData.package_size.length > 0;
      case 1: return packageData.origin_agent_id.length > 0;
      case 2: return packageData.receiver_name.trim().length > 0 && packageData.receiver_phone.trim().length > 0;
      case 3: return packageData.delivery_type.length > 0;
      case 4: 
        if (packageData.delivery_type === 'agent') {
          return packageData.destination_agent_id.length > 0;
        } else {
          return packageData.destination_area_id.length > 0;
        }
      case 5:
        if (packageData.delivery_type === 'doorstep') {
          return deliveryLocation.trim().length > 0;
        }
        return true;
      case 6: return true;
      default: return false;
    }
  }, [currentStep, packageData, deliveryLocation]);

  // UPDATED: Navigation with new step order
  const nextStep = useCallback(() => {
    if (currentStep < STEP_TITLES.length - 1 && isCurrentStepValid()) {
      if (currentStep === 4 && packageData.delivery_type === 'agent') {
        setCurrentStep(6);
        calculateCost();
      } else {
        setCurrentStep(prev => {
          const newStep = prev + 1;
          if (newStep === 6) calculateCost();
          return newStep;
        });
      }
    }
  }, [currentStep, isCurrentStepValid, packageData.delivery_type, calculateCost]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      if (currentStep === 6 && packageData.delivery_type === 'agent') {
        setCurrentStep(4);
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  }, [currentStep, packageData.delivery_type]);

  // Add current package to pending list
  const addAnotherPackage = useCallback(() => {
    const newPendingPackage: PendingPackage = {
      ...packageData,
      delivery_location: deliveryLocation,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      created_at: Date.now()
    };
    
    setPendingPackages(prev => [...prev, newPendingPackage]);
    setIsCreatingMultiple(true);
    resetFormForNewPackage();
  }, [packageData, deliveryLocation, resetFormForNewPackage]);

  // Remove package from pending list
  const removePendingPackage = useCallback((packageId: string) => {
    setPendingPackages(prev => prev.filter(pkg => pkg.id !== packageId));
  }, []);

  // UPDATED: Handle submission for different modes
  const handleSubmit = useCallback(async () => {
    if (!isCurrentStepValid()) return;

    setIsSubmitting(true);
    try {
      // Prepare current package
      let finalOriginAreaId = packageData.origin_area_id;
      
      if (!finalOriginAreaId && selectedOriginAgent?.area?.id) {
        finalOriginAreaId = selectedOriginAgent.area.id;
      }

      const currentPackageData = {
        ...packageData,
        origin_area_id: finalOriginAreaId,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        delivery_location: deliveryLocation,
        business_id: selectedBusiness?.id || null,
        business_name: selectedBusiness?.name || '',
        business_phone: selectedBusiness?.phone_number || ''
      };

      // Only create packages that haven't been submitted yet
      const packagesToSubmit = [
        ...pendingPackages.map(pkg => ({
          ...pkg,
          sender_name: getDisplayName(),
          sender_phone: getUserPhone(),
          business_id: selectedBusiness?.id || null,
          business_name: selectedBusiness?.name || '',
          business_phone: selectedBusiness?.phone_number || ''
        })),
        currentPackageData
      ];

      console.log(`📦 Submitting ${packagesToSubmit.length} packages...`);

      if (mode === 'edit' && editPackage) {
        // Update existing package
        console.log('✏️ Updating package:', editPackage.code);
        
        const response = await api.put(`/api/v1/packages/${editPackage.code}`, {
          package: currentPackageData
        });

        if (response.data.success) {
          console.log('✅ Package updated successfully');
        } else {
          throw new Error(response.data.message || 'Failed to update package');
        }
      } else if (mode === 'resubmit' && resubmitPackage) {
        // Resubmit existing package
        console.log('🔄 Resubmitting package:', resubmitPackage.code);
        
        const response = await api.post(`/api/v1/packages/${resubmitPackage.code}/resubmit`, {
          package: currentPackageData,
          reason: 'Package updated and resubmitted by user'
        });

        if (response.data.success) {
          console.log('✅ Package resubmitted successfully');
        } else {
          throw new Error(response.data.message || 'Failed to resubmit package');
        }
      } else {
        // Create new packages via API
        const responses = await Promise.all(
          packagesToSubmit.map(pkg => createPackage(pkg))
        );

        console.log('✅ All packages created successfully:', responses);
      }

      // Clear pending packages and close modal
      setPendingPackages([]);
      setIsCreatingMultiple(false);
      
      // Call onSubmit to trigger parent component refresh
      await onSubmit(currentPackageData);
      
    } catch (error: any) {
      console.error('❌ Failed to submit packages:', error);
      
      Toast.show({
        type: 'error',
        text1: `Failed to ${mode === 'edit' ? 'Update' : mode === 'resubmit' ? 'Resubmit' : 'Create'} Package`,
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isCurrentStepValid, packageData, deliveryLocation, selectedOriginAgent, pendingPackages, mode, editPackage, resubmitPackage, onSubmit, getDisplayName, getUserPhone, selectedBusiness]);

  // ENHANCED: Retry data loading with proper state management
  const retryDataLoad = useCallback(() => {
    console.log('🔄 Retrying data load...');
    setIsInitialized(false);
    setDataError(null);
    setAreas([]);
    setAgents([]);
    setLocations([]);
    
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

  const handleClearCache = useCallback(async () => {
    try {
      await clearCache();
      Toast.show({
        type: 'success',
        text1: 'Cache Cleared - Refreshing Data',
        position: 'top',
        visibilityTime: 2000,
      });
      await loadReferenceData();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to Clear Cache',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  }, [clearCache, loadReferenceData]);

  // Save large package instructions and close modal
  const handleSaveLargePackageInstructions = useCallback(() => {
    updatePackageData('special_instructions', largePackageInstructions);
    setShowLargePackageModal(false);
  }, [largePackageInstructions, updatePackageData]);

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
        {pendingPackages.length > 0 && ` • ${pendingPackages.length} package${pendingPackages.length !== 1 ? 's' : ''} pending`}
        {mode !== 'create' && ` • ${mode === 'edit' ? 'Editing' : 'Resubmitting'} Package`}
      </Text>
    </View>
  ), [currentStep, pendingPackages.length, mode]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{getModalTitle()}</Text>
      <View style={styles.placeholder} />
    </View>
  ), [closeModal, getModalTitle]);

  // ENHANCED: Loading state with proper messaging
  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#7c3aed" />
      <Text style={styles.loadingTitle}>
        {isDataLoading ? 'Loading Reference Data' : 'Initializing Modal'}
      </Text>
      <Text style={styles.loadingSubtitle}>
        {isDataLoading 
          ? 'Fetching locations, areas, and offices...' 
          : 'Preparing package creation form...'
        }
      </Text>
    </View>
  );

  // ENHANCED: Error state with retry functionality
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

  // Large Package Notes Modal with separate state
  const renderLargePackageModal = useCallback(() => (
    <Modal visible={showLargePackageModal} transparent animationType="fade">
      <View style={styles.largePackageModalOverlay}>
        <View style={styles.largePackageModalContainer}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.95)', 'rgba(22, 33, 62, 0.95)']}
            style={styles.largePackageModalContent}
          >
            <View style={styles.largePackageModalHeader}>
              <Text style={styles.largePackageModalTitle}>Large Package - Special Instructions</Text>
              <TouchableOpacity 
                onPress={() => setShowLargePackageModal(false)} 
                style={styles.largePackageModalClose}
              >
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.largePackageModalSubtitle}>
              Large packages require additional handling care. Please provide special instructions:
            </Text>
            
            <View style={styles.largePackageFormContainer}>
              <Text style={styles.largePackageInputLabel}>Special Handling Instructions:</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., Handle with care, fragile contents, requires 2 people to carry, use freight elevator, call before delivery..."
                placeholderTextColor="#888"
                value={largePackageInstructions}
                onChangeText={setLargePackageInstructions}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity 
              onPress={handleSaveLargePackageInstructions} 
              style={styles.largePackageModalButton}
            >
              <Text style={styles.largePackageModalButtonText}>Save Instructions</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  ), [showLargePackageModal, largePackageInstructions, handleSaveLargePackageInstructions]);

  // NEW: Step 0 - Package Size Selection
  const renderPackageSizeSelection = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What are you sending?</Text>
      <Text style={styles.stepSubtitle}>Choose the size of your package</Text>
      
      {/* Show editing/resubmit notice */}
      {(mode === 'edit' || mode === 'resubmit') && (
        <View style={styles.modeNoticeSection}>
          <Feather 
            name={mode === 'edit' ? 'edit-3' : 'refresh-cw'} 
            size={16} 
            color={mode === 'edit' ? '#8b5cf6' : '#f97316'} 
          />
          <Text style={[styles.modeNoticeText, { color: mode === 'edit' ? '#8b5cf6' : '#f97316' }]}>
            {mode === 'edit' ? 'You are editing an existing package' : 'You are resubmitting a rejected package'}
          </Text>
        </View>
      )}
      
      <View style={styles.packageSizeOptions}>
        <TouchableOpacity
          style={[
            styles.packageSizeOption,
            packageData.package_size === 'small' && styles.selectedPackageSizeOption
          ]}
          onPress={() => handlePackageSizeChange('small')}
        >
          <View style={styles.packageSizeContent}>
            <Text style={styles.packageSizeLabel}>Small Package</Text>
            <Text style={styles.packageSizeDescription}>Perfect for documents and small items</Text>
          </View>
          {packageData.package_size === 'small' && (
            <Feather name="check-circle" size={20} color="#10b981" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.packageSizeOption,
            packageData.package_size === 'medium' && styles.selectedPackageSizeOption
          ]}
          onPress={() => handlePackageSizeChange('medium')}
        >
          <View style={styles.packageSizeContent}>
            <Text style={styles.packageSizeLabel}>Medium</Text>
            <Text style={styles.packageSizeDescription}>For electronics, clothing, and medium-sized items</Text>
          </View>
          {packageData.package_size === 'medium' && (
            <Feather name="check-circle" size={20} color="#10b981" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.packageSizeOption, styles.disabledPackageSize]}
          onPress={() => {}}
          disabled
        >
          <View style={styles.packageSizeContent}>
            <Text style={styles.packageSizeLabelDisabled}>Large</Text>
            <Text style={styles.packageSizeDescriptionDisabled}>Coming Soon</Text>
          </View>
          <Feather name="lock" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.packageSizeNote}>
        <Feather name="info" size={16} color="#7c3aed" />
        <Text style={styles.packageSizeNoteText}>
          Pricing is calculated automatically based on your selection and delivery options
        </Text>
      </View>
    </View>
  ), [packageData.package_size, handlePackageSizeChange, mode]);

  // Step 1: Sender Office Selection - UPDATED: Using package size option styling
  const renderOriginAgentSelection = useCallback(() => {
    const groupedAgents = getGroupedItems(agents, searchQueries.originAgent, 'agent');
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Select Sender Office</Text>
        <Text style={styles.stepSubtitle}>Which office will collect the package?</Text>
        
        <View style={styles.dataInfoContainer}>
          <Text style={styles.dataInfoText}>
            {agents.length} offices available
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
          'Search offices by name, area, or location...'
        )}
        
        <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
          {groupedAgents.length > 0 ? (
            groupedAgents.map((group, groupIndex) => (
              <View key={groupIndex}>
                {/* Only show location header when sorting by location */}
                {sortConfig.field === 'location' && group.locationName !== 'All Items' && (
                  <View style={styles.locationHeader}>
                    <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                    <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                  </View>
                )}
                
                {group.items.map((agent) => {
                  const agentData = agent as Agent;
                  const agentName = agentData.name || 'Unknown Office';
                  const agentId = agentData.id || '';
                  
                  const areaName = agentData.area?.name || 'Unknown Area';
                  const locationName = agentData.area?.location?.name || group.locationName || 'Unknown Location';
                  
                  return (
                    <TouchableOpacity
                      key={agentId}
                      style={[
                        styles.packageSizeOption,
                        packageData.origin_agent_id === agentId && styles.selectedPackageSizeOption
                      ]}
                      onPress={() => updatePackageData('origin_agent_id', agentId)}
                    >
                      <View style={styles.packageSizeContent}>
                        <Text style={styles.packageSizeLabel}>{agentName}</Text>
                        <Text style={styles.packageSizeDescription}>
                          {areaName} • {locationName}
                        </Text>
                      </View>
                      {packageData.origin_agent_id === agentId && (
                        <Feather name="check-circle" size={20} color="#10b981" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.noResultsContainer}>
              <Feather name="search" size={48} color="#666" />
              <Text style={styles.noResultsTitle}>
                {searchQueries.originAgent ? 'No offices found' : 'No offices available'}
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
  }, [agents, searchQueries.originAgent, packageData.origin_agent_id, renderSearchAndSortHeader, getGroupedItems, updatePackageData, updateSearchQuery, sortConfig.field]);

  // Step 2: Receiver Details (previously step 1) - UPDATED: Removed business input section
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

      {/* Show selected business info (read-only) */}
      {selectedBusiness && (
        <View style={styles.businessPreviewSection}>
          <Text style={styles.businessPreviewTitle}>Package for Business</Text>
          <Text style={styles.businessPreviewText}>{selectedBusiness.name}</Text>
        </View>
      )}
    </View>
  ), [packageData.receiver_name, packageData.receiver_phone, selectedBusiness, updatePackageData]);

  // Step 3: Delivery method selection (previously step 2) - UPDATED: Removed "RECOMMENDED" text
  const renderDeliveryMethodSelection = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Method</Text>
      <Text style={styles.stepSubtitle}>How should the package be delivered?</Text>
      
      <View style={styles.deliveryOptions}>
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
              <Text style={styles.deliveryOptionTitle}>Home Delivery</Text>
              <Text style={styles.deliveryOptionSubtitle}>Direct delivery to address</Text>
            </View>
            {packageData.delivery_type === 'doorstep' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deliveryOption,
            packageData.delivery_type === 'agent' && styles.selectedDeliveryOption
          ]}
          onPress={() => updatePackageData('delivery_type', 'agent')}
        >
          <View style={styles.deliveryOptionContent}>
            <Feather name="briefcase" size={24} color="#fff" />
            <View style={styles.deliveryOptionText}>
              <Text style={styles.deliveryOptionTitle}>Office Delivery</Text>
              <Text style={styles.deliveryOptionSubtitle}>Collect from destination office</Text>
            </View>
            {packageData.delivery_type === 'agent' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.deliveryNote}>
        <Feather name="info" size={16} color="#7c3aed" />
        <Text style={styles.deliveryNoteText}>
          For fragile items requiring special handling, use the "Fragile Delivery" option from the main menu
        </Text>
      </View>
    </View>
  ), [packageData.delivery_type, updatePackageData]);

  // Step 4: Destination selection - UPDATED: Using package size option styling for both agents and areas
  const renderDestinationSelection = useCallback(() => {
    if (packageData.delivery_type === 'agent') {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Select Receiving Office</Text>
          <Text style={styles.stepSubtitle}>Which office will handle final delivery?</Text>
          
          {renderSearchAndSortHeader(
            searchQueries.destinationAgent,
            (value) => updateSearchQuery('destinationAgent', value),
            'Search receiving offices...'
          )}
          
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
            {getGroupedItems(agents, searchQueries.destinationAgent, 'agent').map((group, groupIndex) => (
              <View key={groupIndex}>
                {/* Only show location header when sorting by location */}
                {sortConfig.field === 'location' && group.locationName !== 'All Items' && (
                  <View style={styles.locationHeader}>
                    <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                    <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                  </View>
                )}
                
                {group.items.map((agent) => {
                  const agentData = agent as Agent;
                  const agentName = agentData.name || 'Unknown Office';
                  const agentId = agentData.id || '';
                  
                  const areaName = agentData.area?.name || 'Unknown Area';
                  const locationName = agentData.area?.location?.name || group.locationName || 'Unknown Location';
                  
                  return (
                    <TouchableOpacity
                      key={agentId}
                      style={[
                        styles.packageSizeOption,
                        packageData.destination_agent_id === agentId && styles.selectedPackageSizeOption
                      ]}
                      onPress={() => updatePackageData('destination_agent_id', agentId)}
                    >
                      <View style={styles.packageSizeContent}>
                        <Text style={styles.packageSizeLabel}>{agentName}</Text>
                        <Text style={styles.packageSizeDescription}>
                          {areaName} • {locationName}
                        </Text>
                      </View>
                      {packageData.destination_agent_id === agentId && (
                        <Feather name="check-circle" size={20} color="#10b981" />
                      )}
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
                {/* Only show location header when sorting by location */}
                {sortConfig.field === 'location' && group.locationName !== 'All Items' && (
                  <View style={styles.locationHeader}>
                    <Text style={styles.locationHeaderText}>{group.locationName}</Text>
                    <Text style={styles.locationHeaderCount}>({group.items.length})</Text>
                  </View>
                )}
                
                {group.items.map((area) => {
                  const areaData = area as Area;
                  const areaName = areaData.name || 'Unknown Area';
                  const areaId = areaData.id || '';
                  const locationName = areaData.location?.name || group.locationName || 'Unknown Location';
                  
                  return (
                    <TouchableOpacity
                      key={areaId}
                      style={[
                        styles.packageSizeOption,
                        packageData.destination_area_id === areaId && styles.selectedPackageSizeOption
                      ]}
                      onPress={() => updatePackageData('destination_area_id', areaId)}
                    >
                      <View style={styles.packageSizeContent}>
                        <Text style={styles.packageSizeLabel}>{areaName}</Text>
                        <Text style={styles.packageSizeDescription}>
                          {locationName}
                        </Text>
                      </View>
                      {packageData.destination_area_id === areaId && (
                        <Feather name="check-circle" size={20} color="#10b981" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }
  }, [packageData.delivery_type, packageData.destination_agent_id, packageData.destination_area_id, agents, areas, searchQueries.destinationAgent, searchQueries.destinationArea, renderSearchAndSortHeader, getGroupedItems, updatePackageData, sortConfig.field]);

  // Step 5: Delivery Location (previously step 4)
  const renderDeliveryLocation = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Location</Text>
      <Text style={styles.stepSubtitle}>
        Provide the exact delivery address
      </Text>
      
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
  ), [deliveryLocation]);

  // Step 6: Enhanced confirmation (previously step 5)
  const renderConfirmation = useCallback(() => (
    <View style={[styles.stepContent, styles.stepContentConfirmation]}>
      <Text style={styles.stepTitle}>
        {mode === 'edit' ? 'Confirm Package Updates' : 
         mode === 'resubmit' ? 'Confirm Package Resubmission' : 
         'Confirm Package Details'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {pendingPackages.length > 0 
          ? `Review all ${totalPackages} package${totalPackages > 1 ? 's' : ''} before ${mode === 'edit' ? 'updating' : mode === 'resubmit' ? 'resubmitting' : 'submitting'}`
          : `Review all information before ${mode === 'edit' ? 'updating' : mode === 'resubmit' ? 'resubmitting' : 'submitting'}`
        }
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
            {mode === 'edit' ? 'You are editing an existing package' : 'You are resubmitting a rejected package'}
          </Text>
        </View>
      )}
      
      {/* Show pending packages if any */}
      {pendingPackages.length > 0 && (
        <View style={styles.pendingPackagesContainer}>
          <Text style={styles.pendingPackagesTitle}>Pending Packages ({pendingPackages.length})</Text>
          {pendingPackages.map((pkg, index) => (
            <View key={pkg.id} style={styles.pendingPackageItem}>
              <View style={styles.pendingPackageHeader}>
                <Text style={styles.pendingPackageNumber}>Package {index + 1}</Text>
                <TouchableOpacity 
                  onPress={() => removePendingPackage(pkg.id)}
                  style={styles.removePendingPackageButton}
                >
                  <Feather name="trash-2" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.pendingPackageSummary}>
                {pkg.receiver_name} • {pkg.delivery_type === 'doorstep' ? 'Home' : 'Office'} Delivery
                {pkg.package_size && ` • ${pkg.package_size.charAt(0).toUpperCase() + pkg.package_size.slice(1)}`}
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {/* Current package confirmation */}
      <View style={styles.confirmationContainer}>
        <Text style={styles.currentPackageTitle}>
          {pendingPackages.length > 0 ? `Package ${pendingPackages.length + 1}` : 
           mode === 'edit' ? 'Package Updates' :
           mode === 'resubmit' ? 'Package Resubmission' :
           'Current Package'}
        </Text>
        
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Package Size</Text>
          <Text style={styles.confirmationDetail}>
            {packageData.package_size?.charAt(0).toUpperCase() + packageData.package_size?.slice(1)} Package
          </Text>
        </View>

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
          
          {/* Show business information if available */}
          {selectedBusiness && (
            <View style={styles.businessInfoSection}>
              <Text style={styles.confirmationSubDetail}>Business Information:</Text>
              <Text style={styles.confirmationDetail}>{selectedBusiness.name}</Text>
              {selectedBusiness.phone_number && (
                <Text style={styles.confirmationDetail}>{selectedBusiness.phone_number}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Delivery Method</Text>
          <Text style={styles.confirmationDetail}>
            {packageData.delivery_type === 'doorstep' ? 'Home Delivery' : 'Office Delivery'}
          </Text>
          
          {packageData.delivery_type === 'agent' && selectedDestinationAgent && (
            <View style={styles.agentInfo}>
              <Text style={styles.confirmationDetail}>Receiving Office: {selectedDestinationAgent?.name}</Text>
            </View>
          )}

          {packageData.delivery_type === 'doorstep' && deliveryLocation && (
            <View style={styles.deliveryLocationInfo}>
              <Text style={styles.confirmationSubDetail}>Delivery Address:</Text>
              <Text style={styles.confirmationDetail}>{deliveryLocation}</Text>
            </View>
          )}

          {/* Show large package instructions */}
          {packageData.package_size === 'large' && packageData.special_instructions && (
            <View style={styles.largePackageNotesInfo}>
              <Text style={styles.confirmationSubDetail}>Special Handling Instructions:</Text>
              <Text style={styles.confirmationDetail}>{packageData.special_instructions}</Text>
            </View>
          )}
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Estimated Cost</Text>
          {estimatedCost ? (
            <View style={styles.costDisplay}>
              <Text style={styles.estimatedCost}>KES {estimatedCost.toLocaleString()}</Text>
            </View>
          ) : (
            <Text style={styles.pricingError}>Unable to calculate cost</Text>
          )}
        </View>
      </View>

      {/* Add Another Package Button - Only for create mode */}
      {mode === 'create' && currentStep === STEP_TITLES.length - 1 && (
        <View style={styles.addAnotherContainer}>
          <TouchableOpacity 
            onPress={addAnotherPackage}
            style={styles.addAnotherButton}
          >
            <Feather name="plus" size={20} color="#7c3aed" />
            <Text style={styles.addAnotherButtonText}>Add Another Package</Text>
          </TouchableOpacity>
          <Text style={styles.addAnotherNote}>
            Note: If you close before submitting, all progress will be lost. Submit your packages first.
          </Text>
        </View>
      )}
    </View>
  ), [
    mode, selectedOriginAgent, selectedDestinationAgent, selectedDestinationArea, packageData, 
    deliveryLocation, estimatedCost, pendingPackages, totalPackages, removePendingPackage, addAnotherPackage, currentStep, selectedBusiness
  ]);

  // UPDATED: Step routing with new order
  const renderCurrentStep = useCallback(() => {
    switch (currentStep) {
      case 0: return renderPackageSizeSelection();
      case 1: return renderOriginAgentSelection();
      case 2: return renderReceiverDetails();
      case 3: return renderDeliveryMethodSelection();
      case 4: return renderDestinationSelection();
      case 5: return renderDeliveryLocation();
      case 6: return renderConfirmation();
      default: return renderPackageSizeSelection();
    }
  }, [currentStep, renderPackageSizeSelection, renderOriginAgentSelection, renderReceiverDetails, renderDeliveryMethodSelection, renderDestinationSelection, renderDeliveryLocation, renderConfirmation]);

  const renderNavigationButtons = useCallback(() => (
    <View style={styles.navigationContainer}>
      {currentStep > 0 && (
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#fff" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.spacer} />
      
      {__DEV__ && currentStep === 1 && (
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
                {getActionButtonText()}
              </Text>
              <Feather 
                name={mode === 'edit' ? 'save' : mode === 'resubmit' ? 'refresh-cw' : 'check'} 
                size={20} 
                color={isCurrentStepValid() && !isSubmitting ? "#fff" : "#666"} 
              />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  ), [currentStep, prevStep, nextStep, handleSubmit, isCurrentStepValid, isSubmitting, handleClearCache, getActionButtonText, mode]);

  const renderMainContent = useCallback(() => {
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
  }, [isDataLoading, isInitialized, dataError, renderHeader, renderProgressBar, renderCurrentStep, renderNavigationButtons]);

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
      </SafeAreaView>
      
      {/* Large Package Modal */}
      {renderLargePackageModal()}
    </Modal>
  );
}

// Enhanced styles with mode notice section
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
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
    paddingTop: Platform.OS === 'ios' ? 10 : 15,
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
    backgroundColor: '#7c3aed',
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
    paddingBottom: 10,
  },
  stepContent: {
    flex: 1,
    minHeight: 300,
  },
  stepContentConfirmation: {
    flex: 1,
    minHeight: 450,
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
    backgroundColor: '#7c3aed',
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
  
  // NEW: Mode notice section for edit/resubmit
  modeNoticeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
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
  
  // CONSISTENT: Package Size Selection Styles (used across all selection components)
  packageSizeOptions: {
    gap: 12,
    marginBottom: 20,
  },
  packageSizeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    marginBottom: 8,
  },
  selectedPackageSizeOption: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: '#7c3aed',
  },
  disabledPackageSize: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.6,
  },
  packageSizeContent: {
    flex: 1,
  },
  packageSizeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  packageSizeLabelDisabled: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  packageSizeDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  packageSizeDescriptionDisabled: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  packageSizeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  packageSizeNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#7c3aed',
    lineHeight: 18,
  },
  
  dataInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  dataInfoText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  
  clearSearchButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  
  deliveryNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 16,
    gap: 8,
  },
  deliveryNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#7c3aed',
    lineHeight: 18,
  },
  
  // Large Package Modal Styles
  largePackageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  largePackageModalContainer: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  largePackageModalContent: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  largePackageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  largePackageModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  largePackageModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largePackageModalSubtitle: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 20,
  },
  largePackageFormContainer: {
    gap: 16,
    marginBottom: 20,
  },
  largePackageInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  largePackageModalButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  largePackageModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Pending Packages Styles
  pendingPackagesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  pendingPackagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
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
  
  // Add Another Package Styles
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
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: '#7c3aed',
    gap: 8,
  },
  addAnotherButtonText: {
    fontSize: 16,
    color: '#7c3aed',
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
  
  searchAndSortContainer: {
    marginBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
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
  
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 6,
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
  
  selectionList: {
    flex: 1,
  },
  
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
    borderColor: 'rgba(124, 58, 237, 0.3)',
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
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  businessPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 4,
  },
  businessPreviewText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  
  // Business Information Confirmation Styles
  businessInfoSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  deliveryOptions: {
    gap: 12,
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
    padding: 16,
  },
  deliveryOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  deliveryOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
  },
  deliveryOptionSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  
  confirmationContainer: {
    gap: 16,
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
  },
  confirmationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
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
  largePackageNotesInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  costDisplay: {
    alignItems: 'flex-start',
  },
  estimatedCost: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
  },
  costBreakdown: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  pricingError: {
    fontSize: 14,
    color: '#ef4444',
  },
  
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
  
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
    paddingHorizontal: 20,
    paddingVertical: 10,
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
});
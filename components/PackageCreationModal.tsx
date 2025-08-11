// components/PackageCreationModal.tsx - ENHANCED WITH AGENT-CENTRIC FLOW
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
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
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

  // Form data - Updated for agent-centric flow
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

  const loadModalData = async () => {
    try {
      setIsDataLoading(true);
      setDataError(null);
      
      const formData = await getPackageFormData();
      
      setLocations(formData.locations);
      setAreas(formData.areas);
      setAgents(formData.agents);
      
      console.log('✅ Data loaded:', {
        locations: formData.locations.length,
        areas: formData.areas.length,
        agents: formData.agents.length
      });
      
    } catch (error: any) {
      console.error('❌ Failed to load modal data:', error);
      setDataError(error.message || 'Failed to load data');
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

  // Enhanced cost calculation for agent-to-agent pricing
  const calculateCost = () => {
    const originAgent = agents.find(a => a.id === packageData.origin_agent_id);
    if (!originAgent) return;

    let destinationAreaId = packageData.destination_area_id;
    let destinationAgent = null;
    
    if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
      destinationAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
      destinationAreaId = destinationAgent?.area_id || '';
    }

    if (!destinationAreaId) return;

    const originArea = areas.find(a => a.id === originAgent.area_id);
    const destinationArea = areas.find(a => a.id === destinationAreaId);
    
    if (!originArea || !destinationArea) return;
    
    // Agent-to-Agent vs Agent-to-Area pricing logic
    const isAgentToAgent = packageData.delivery_type === 'agent' && destinationAgent;
    const isIntraArea = originAgent.area_id === destinationAreaId;
    const isIntraLocation = originArea.location_id === destinationArea.location_id;
    
    let baseCost = 0;
    
    if (isAgentToAgent) {
      // Agent-to-Agent pricing (typically lower)
      if (isIntraArea) {
        baseCost = 120; // Same area agent transfer
      } else if (isIntraLocation) {
        baseCost = 150; // Same location, different areas
      } else {
        baseCost = 180; // Different locations
      }
    } else {
      // Agent-to-Doorstep pricing
      if (isIntraArea) {
        baseCost = 250;
      } else if (isIntraLocation) {
        baseCost = 300;
      } else {
        baseCost = 380;
      }
    }
    
    setEstimatedCost(baseCost);
  };

  const updatePackageData = (field: keyof PackageData, value: string) => {
    setPackageData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-update origin_area_id when origin_agent_id changes
      if (field === 'origin_agent_id') {
        const selectedAgent = agents.find(agent => agent.id === value);
        updated.origin_area_id = selectedAgent?.area_id || '';
      }
      
      return updated;
    });
  };

  const updateSearchQuery = (field: keyof typeof searchQueries, value: string) => {
    setSearchQueries(prev => ({ ...prev, [field]: value }));
  };

  // Enhanced sorting functionality
  const applySortAndFilter = (items: Agent[] | Area[], searchQuery: string, itemType: 'agent' | 'area') => {
    // Filter by search query
    const filtered = items.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      if (itemType === 'agent') {
        const agent = item as Agent;
        return (
          agent.name?.toLowerCase().includes(searchLower) ||
          agent.phone?.toLowerCase().includes(searchLower) ||
          agent.area?.name?.toLowerCase().includes(searchLower) ||
          agent.area?.location?.name?.toLowerCase().includes(searchLower)
        );
      } else {
        const area = item as Area;
        return (
          area.name?.toLowerCase().includes(searchLower) ||
          area.location?.name?.toLowerCase().includes(searchLower)
        );
      }
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      switch (sortConfig.field) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
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
    
    const grouped = sortedFiltered.reduce((acc, item) => {
      let locationName = '';
      if (itemType === 'agent') {
        locationName = (item as Agent).area?.location?.name || 'Unknown Location';
      } else {
        locationName = (item as Area).location?.name || 'Unknown Location';
      }
      
      if (!acc[locationName]) {
        acc[locationName] = [];
      }
      acc[locationName].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([locationName, items]) => ({
        locationName,
        items
      }));
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
      closeModal();
    } catch (error: any) {
      console.error('❌ Failed to submit package:', error);
      Alert.alert('Error', error.message || 'Failed to create package. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryDataLoad = () => {
    console.log('🔄 Retrying data load...');
    loadModalData();
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

  // Step 0: Origin Agent Selection (Replaces Origin Area)
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
            
            {group.items.map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.selectionItem,
                  packageData.origin_agent_id === agent.id && styles.selectedItem
                ]}
                onPress={() => updatePackageData('origin_agent_id', agent.id)}
              >
                <View style={styles.selectionItemContent}>
                  <View style={styles.selectionInitials}>
                    <Text style={styles.selectionInitialsText}>
                      {(agent as Agent).name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.selectionInfo}>
                    <Text style={styles.selectionName}>{(agent as Agent).name}</Text>
                    <Text style={styles.selectionLocation}>
                      {(agent as Agent).area?.name} • {(agent as Agent).area?.location?.name}
                    </Text>
                    <Text style={styles.selectionPhone}>{(agent as Agent).phone}</Text>
                  </View>
                  {packageData.origin_agent_id === agent.id && (
                    <Feather name="check-circle" size={20} color="#10b981" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
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
                
                {group.items.map((agent) => (
                  <TouchableOpacity
                    key={agent.id}
                    style={[
                      styles.selectionItem,
                      packageData.destination_agent_id === agent.id && styles.selectedItem
                    ]}
                    onPress={() => updatePackageData('destination_agent_id', agent.id)}
                  >
                    <View style={styles.selectionItemContent}>
                      <View style={styles.selectionInitials}>
                        <Text style={styles.selectionInitialsText}>
                          {(agent as Agent).name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.selectionInfo}>
                        <Text style={styles.selectionName}>{(agent as Agent).name}</Text>
                        <Text style={styles.selectionLocation}>
                          {(agent as Agent).area?.name} • {(agent as Agent).area?.location?.name}
                        </Text>
                        <Text style={styles.selectionPhone}>{(agent as Agent).phone}</Text>
                      </View>
                      {packageData.destination_agent_id === agent.id && (
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
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
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
        </View>
      </View>
    </ScrollView>
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

// Enhanced Styles with new search and sort components
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
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: SCREEN_HEIGHT * 0.6,
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
  
  // Confirmation styles
  confirmationContainer: {
    gap: 24,
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
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
// components/PackageCreationModal.tsx - FIXED VERSION
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
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
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
  // Optional props for backwards compatibility
  locations?: Location[];
  areas?: Area[];
  agents?: Agent[];
}

type DeliveryType = 'doorstep' | 'agent' | 'mixed';

const STEP_TITLES = [
  'Origin Location',
  'Origin Area',
  'Sender Details',
  'Destination Location', 
  'Destination Area',
  'Receiver Details',
  'Delivery Method',
  'Confirm Details'
];

export default function PackageCreationModal({
  visible,
  onClose,
  onSubmit,
  locations: propLocations = [],
  areas: propAreas = [],
  agents: propAgents = []
}: PackageCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [selectedOriginLocation, setSelectedOriginLocation] = useState<string>('');
  const [selectedDestinationLocation, setSelectedDestinationLocation] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Internal data loading states
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [packageData, setPackageData] = useState<PackageData>({
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

  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Load data when modal becomes visible
  useEffect(() => {
    if (visible) {
      console.log('📦 Modal opened, initializing data...');
      initializeModalData();
    }
  }, [visible]);

  const initializeModalData = async () => {
    // Reset form state
    resetForm();
    
    // Start entrance animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();

    // Check if we have prop data, otherwise load from API
    if (propLocations.length > 0 && propAreas.length > 0 && propAgents.length > 0) {
      console.log('📦 Using data from props:', {
        locations: propLocations.length,
        areas: propAreas.length,
        agents: propAgents.length
      });
      setLocations(propLocations);
      setAreas(propAreas);
      setAgents(propAgents);
      setDataError(null);
    } else {
      console.log('📦 No prop data available, loading from helpers...');
      await loadModalData();
    }
  };

  const loadModalData = async () => {
    try {
      setIsDataLoading(true);
      setDataError(null);
      
      console.log('🔄 Calling getPackageFormData() from helpers...');
      
      // This will call your actual helper functions
      const formData = await getPackageFormData();
      
      console.log('✅ Data loaded from helpers:', {
        locations: formData.locations.length,
        areas: formData.areas.length,
        agents: formData.agents.length
      });

      // Validate the data structure
      const validation = validatePackageFormData(formData);
      if (!validation.isValid) {
        console.warn('⚠️ Data validation issues:', validation.issues);
        // Still proceed but log warnings
      }

      // Log sample data for debugging
      if (formData.locations.length > 0) {
        console.log('📍 Sample location:', formData.locations[0]);
      }
      if (formData.areas.length > 0) {
        console.log('🏢 Sample area:', formData.areas[0]);
      }
      if (formData.agents.length > 0) {
        console.log('👥 Sample agent:', formData.agents[0]);
      }
      
      // Set the state - this should trigger re-render
      setLocations(formData.locations);
      setAreas(formData.areas);
      setAgents(formData.agents);
      
      console.log('📦 State updated with data, modal should now show items');
      
    } catch (error: any) {
      console.error('❌ Failed to load modal data:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      setDataError(error.message || 'Failed to load data');
    } finally {
      setIsDataLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedOriginLocation('');
    setSelectedDestinationLocation('');
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
    setEstimatedCost(null);
    setPricingError(null);
    setIsPricingLoading(false);
    setIsSubmitting(false);
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

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep / (STEP_TITLES.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  useEffect(() => {
    // Calculate estimated cost when origin, destination, and delivery type are set
    if (packageData.origin_area_id && packageData.destination_area_id && packageData.delivery_type) {
      fetchRealTimePricing();
    } else {
      setEstimatedCost(null);
      setPricingError(null);
    }
  }, [packageData.origin_area_id, packageData.destination_area_id, packageData.delivery_type]);

  const fetchRealTimePricing = async () => {
    if (!packageData.origin_area_id || !packageData.destination_area_id || !packageData.delivery_type) {
      return;
    }

    setIsPricingLoading(true);
    setPricingError(null);

    try {
      console.log('💰 Fetching pricing for:', {
        origin_area_id: packageData.origin_area_id,
        destination_area_id: packageData.destination_area_id,
        delivery_type: packageData.delivery_type
      });

      const pricingResponse = await getPackagePricing({
        origin_area_id: packageData.origin_area_id,
        destination_area_id: packageData.destination_area_id,
        delivery_type: packageData.delivery_type,
      });

      setEstimatedCost(pricingResponse.cost);
      console.log('💰 Pricing fetched successfully:', pricingResponse);
    } catch (error: any) {
      console.error('❌ Failed to fetch pricing:', error);
      setPricingError('Failed to load pricing');
      
      // Fallback to local calculation
      calculateFallbackCost();
    } finally {
      setIsPricingLoading(false);
    }
  };

  const calculateFallbackCost = () => {
    const originArea = areas.find(a => a.id === packageData.origin_area_id);
    const destinationArea = areas.find(a => a.id === packageData.destination_area_id);
    
    if (!originArea || !destinationArea) return;
    
    const isIntraLocation = originArea.location_id === destinationArea.location_id;
    const isIntraArea = packageData.origin_area_id === packageData.destination_area_id;
    
    let baseCost = 0;
    
    if (isIntraArea) {
      baseCost = packageData.delivery_type === 'doorstep' ? 280 : 
                 packageData.delivery_type === 'agent' ? 150 : 215;
    } else if (isIntraLocation) {
      baseCost = packageData.delivery_type === 'doorstep' ? 320 : 
                 packageData.delivery_type === 'agent' ? 150 : 235;
    } else {
      baseCost = packageData.delivery_type === 'doorstep' ? 380 : 
                 packageData.delivery_type === 'agent' ? 150 : 265;
    }
    
    setEstimatedCost(baseCost);
  };

  const updatePackageData = (field: keyof PackageData, value: string) => {
    setPackageData(prev => ({ ...prev, [field]: value }));
  };

  const getAreasForLocation = (locationId: string) => {
    console.log(`🔍 Filtering areas for location ${locationId}:`, areas.length, 'total areas');
    const filtered = areas.filter(area => area.location_id === locationId);
    console.log(`🔍 Found ${filtered.length} areas for location ${locationId}`);
    return filtered;
  };

  const getOriginAreas = () => {
    return getAreasForLocation(selectedOriginLocation);
  };

  const getDestinationAreas = () => {
    return getAreasForLocation(selectedDestinationLocation);
  };

  const getOriginAgents = () => {
    return agents.filter(agent => agent.area_id === packageData.origin_area_id);
  };

  const getDestinationAgents = () => {
    return agents.filter(agent => agent.area_id === packageData.destination_area_id);
  };

  const getSelectedOriginArea = () => {
    return areas.find(area => area.id === packageData.origin_area_id);
  };

  const getSelectedDestinationArea = () => {
    return areas.find(area => area.id === packageData.destination_area_id);
  };

  const getSelectedOriginLocation = () => {
    return locations.find(loc => loc.id === selectedOriginLocation);
  };

  const getSelectedDestinationLocation = () => {
    return locations.find(loc => loc.id === selectedDestinationLocation);
  };

  const isCurrentStepValid = () => {
    switch (currentStep) {
      case 0: return selectedOriginLocation.length > 0;
      case 1: return packageData.origin_area_id.length > 0;
      case 2: return packageData.sender_name.trim().length > 0 && packageData.sender_phone.trim().length > 0;
      case 3: return selectedDestinationLocation.length > 0;
      case 4: return packageData.destination_area_id.length > 0;
      case 5: return packageData.receiver_name.trim().length > 0 && packageData.receiver_phone.trim().length > 0;
      case 6: return packageData.delivery_type.length > 0;
      case 7: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (currentStep < STEP_TITLES.length - 1 && isCurrentStepValid()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentStepValid()) return;

    setIsSubmitting(true);
    try {
      console.log('📦 Submitting package data:', packageData);
      await onSubmit(packageData);
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

  // Show loading state while fetching data
  if (isDataLoading) {
    return (
      <Modal visible={visible} transparent animationType="none">
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
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={styles.loadingTitle}>Loading Package Data</Text>
                <Text style={styles.loadingSubtitle}>
                  Fetching locations, areas, and agents from your backend...
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // Show error state if data loading failed
  if (dataError) {
    return (
      <Modal visible={visible} transparent animationType="none">
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
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // Main modal content - only render when data is successfully loaded
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBackground}>
        <Animated.View
          style={[
            styles.progressForeground,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
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

  const renderLocationSelection = (
    selectedId: string,
    onSelect: (id: string) => void,
    title: string,
    data: Location[]
  ) => {
    console.log(`📍 Rendering location selection with ${data.length} items`);
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.dataDebugText}>
          Available: {data.length} locations
        </Text>
        
        {data.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Feather name="map-pin" size={48} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No Locations Available</Text>
            <Text style={styles.emptyStateMessage}>
              Please check if locations are configured in your system.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.locationsList} showsVerticalScrollIndicator={false}>
            {data.map((location) => {
              console.log(`📍 Rendering location: ${location.name} (ID: ${location.id})`);
              return (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationItem,
                    selectedId === location.id && styles.selectedLocationItem
                  ]}
                  onPress={() => {
                    console.log(`📍 Selected location: ${location.name} (ID: ${location.id})`);
                    onSelect(location.id);
                  }}
                >
                  <LinearGradient
                    colors={selectedId === location.id ? 
                      ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                      ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                    style={styles.locationItemGradient}
                  >
                    <View style={styles.locationItemContent}>
                      <View style={styles.locationInitials}>
                        <Text style={styles.locationInitialsText}>
                          {location.initials || location.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.locationName}>{location.name}</Text>
                      {selectedId === location.id && (
                        <Feather name="check-circle" size={20} color="#10b981" />
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderAreaSelection = (
    selectedId: string,
    onSelect: (id: string) => void,
    title: string,
    data: Area[]
  ) => {
    console.log(`🏢 Rendering area selection with ${data.length} items`);
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.dataDebugText}>
          Available: {data.length} areas
        </Text>
        
        {data.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Feather name="map" size={48} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No Areas Available</Text>
            <Text style={styles.emptyStateMessage}>
              Please select a location first, or check if areas are configured for this location.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.locationsList} showsVerticalScrollIndicator={false}>
            {data.map((area) => {
              console.log(`🏢 Rendering area: ${area.name} (ID: ${area.id})`);
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.locationItem,
                    selectedId === area.id && styles.selectedLocationItem
                  ]}
                  onPress={() => {
                    console.log(`🏢 Selected area: ${area.name} (ID: ${area.id})`);
                    onSelect(area.id);
                  }}
                >
                  <LinearGradient
                    colors={selectedId === area.id ? 
                      ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                      ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                    style={styles.locationItemGradient}
                  >
                    <View style={styles.locationItemContent}>
                      <View style={styles.locationInitials}>
                        <Text style={styles.locationInitialsText}>
                          {area.initials || area.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.areaInfo}>
                        <Text style={styles.locationName}>{area.name}</Text>
                        {area.location && (
                          <Text style={styles.areaLocationText}>
                            {area.location.name}
                          </Text>
                        )}
                      </View>
                      {selectedId === area.id && (
                        <Feather name="check-circle" size={20} color="#10b981" />
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  // Rest of the render methods remain the same...
  const renderDetailsForm = (
    nameValue: string,
    phoneValue: string,
    onNameChange: (value: string) => void,
    onPhoneChange: (value: string) => void,
    title: string,
    subtitle: string
  ) => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
      
      <View style={styles.formContainer}>
        <LinearGradient colors={['rgba(124, 58, 237, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.inputGradientBorder}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#888"
            value={nameValue}
            onChangeText={onNameChange}
            autoCapitalize="words"
          />
        </LinearGradient>
        
        <LinearGradient colors={['rgba(124, 58, 237, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.inputGradientBorder}>
          <TextInput
            style={styles.input}
            placeholder="Phone Number (+254...)"
            placeholderTextColor="#888"
            value={phoneValue}
            onChangeText={onPhoneChange}
            keyboardType="phone-pad"
          />
        </LinearGradient>
      </View>
    </View>
  );

  const renderDeliveryMethod = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Delivery Method</Text>
      <Text style={styles.stepSubtitle}>Choose how the package should be delivered</Text>
      
      <View style={styles.deliveryOptions}>
        {[
          { type: 'doorstep' as DeliveryType, title: 'Doorstep Delivery', subtitle: 'Direct delivery to address', icon: 'home' },
          { type: 'agent' as DeliveryType, title: 'Agent Pickup', subtitle: 'Collect from our agent', icon: 'user' },
          { type: 'mixed' as DeliveryType, title: 'Mixed Delivery', subtitle: 'Combination of both', icon: 'shuffle' }
        ].map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.deliveryOption,
              packageData.delivery_type === option.type && styles.selectedDeliveryOption
            ]}
            onPress={() => updatePackageData('delivery_type', option.type)}
          >
            <LinearGradient
              colors={packageData.delivery_type === option.type ? 
                ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
              style={styles.deliveryOptionGradient}
            >
              <View style={styles.deliveryOptionContent}>
                <Feather name={option.icon as any} size={24} color="#fff" />
                <View style={styles.deliveryOptionText}>
                  <Text style={styles.deliveryOptionTitle}>{option.title}</Text>
                  <Text style={styles.deliveryOptionSubtitle}>{option.subtitle}</Text>
                </View>
                {packageData.delivery_type === option.type && (
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Confirm Package Details</Text>
      <Text style={styles.stepSubtitle}>Review all information before submitting</Text>
      
      <View style={styles.confirmationContainer}>
        {/* Route Information */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeLocationInitials}>{getSelectedOriginLocation()?.initials || '--'}</Text>
              <Text style={styles.routeLocationName}>{getSelectedOriginLocation()?.name || 'Unknown'}</Text>
              <Text style={styles.routeAreaName}>{getSelectedOriginArea()?.name || 'Unknown'}</Text>
            </View>
            <Feather name="arrow-right" size={20} color="#7c3aed" />
            <View style={styles.routePoint}>
              <Text style={styles.routeLocationInitials}>{getSelectedDestinationLocation()?.initials || '--'}</Text>
              <Text style={styles.routeLocationName}>{getSelectedDestinationLocation()?.name || 'Unknown'}</Text>
              <Text style={styles.routeAreaName}>{getSelectedDestinationArea()?.name || 'Unknown'}</Text>
            </View>
          </View>
        </View>

        {/* Sender Information */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Sender</Text>
          <Text style={styles.confirmationDetail}>{packageData.sender_name}</Text>
          <Text style={styles.confirmationDetail}>{packageData.sender_phone}</Text>
        </View>

        {/* Receiver Information */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Receiver</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_name}</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_phone}</Text>
        </View>

        {/* Delivery Method */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Delivery Method</Text>
          <Text style={styles.confirmationDetail}>
            {packageData.delivery_type === 'doorstep' ? 'Doorstep Delivery' :
             packageData.delivery_type === 'agent' ? 'Agent Pickup' : 'Mixed Delivery'}
          </Text>
        </View>

        {/* Estimated Cost */}
        <View style={styles.costSection}>
          <LinearGradient colors={['rgba(16, 185, 129, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.costGradientBg}>
            <Text style={styles.costLabel}>Estimated Cost</Text>
            
            {isPricingLoading ? (
              <View style={styles.costLoadingContainer}>
                <ActivityIndicator size="small" color="#7c3aed" />
                <Text style={styles.costLoadingText}>Calculating...</Text>
              </View>
            ) : pricingError ? (
              <View style={styles.costErrorContainer}>
                <Feather name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.costErrorText}>{pricingError}</Text>
              </View>
            ) : estimatedCost !== null ? (
              <Text style={styles.costAmount}>KSh {estimatedCost.toLocaleString()}</Text>
            ) : (
              <Text style={styles.costAmount}>KSh --</Text>
            )}
          </LinearGradient>
        </View>
      </View>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    console.log(`🎯 Rendering step ${currentStep}: ${STEP_TITLES[currentStep]}`);
    console.log(`📊 Current data counts: locations=${locations.length}, areas=${areas.length}, agents=${agents.length}`);
    
    switch (currentStep) {
      case 0:
        return renderLocationSelection(
          selectedOriginLocation,
          setSelectedOriginLocation,
          'Select origin location',
          locations
        );
      case 1:
        return renderAreaSelection(
          packageData.origin_area_id,
          (id) => updatePackageData('origin_area_id', id),
          'Select origin area',
          getOriginAreas()
        );
      case 2:
        return renderDetailsForm(
          packageData.sender_name,
          packageData.sender_phone,
          (value) => updatePackageData('sender_name', value),
          (value) => updatePackageData('sender_phone', value),
          'Sender Information',
          'Enter the sender\'s details'
        );
      case 3:
        return renderLocationSelection(
          selectedDestinationLocation,
          setSelectedDestinationLocation,
          'Select destination location',
          locations
        );
      case 4:
        return renderAreaSelection(
          packageData.destination_area_id,
          (id) => updatePackageData('destination_area_id', id),
          'Select destination area',
          getDestinationAreas()
        );
      case 5:
        return renderDetailsForm(
          packageData.receiver_name,
          packageData.receiver_phone,
          (value) => updatePackageData('receiver_name', value),
          (value) => updatePackageData('receiver_phone', value),
          'Receiver Information',
          'Enter the receiver\'s details'
        );
      case 6:
        return renderDeliveryMethod();
      case 7:
        return renderConfirmation();
      default:
        return null;
    }
  };

  const renderFooter = () => (
    <View style={styles.footer}>
      <View style={styles.buttonContainer}>
        {currentStep > 0 && (
          <TouchableOpacity onPress={prevStep} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          onPress={currentStep === STEP_TITLES.length - 1 ? handleSubmit : nextStep}
          style={[styles.primaryButton, !isCurrentStepValid() && styles.disabledButton]}
          disabled={!isCurrentStepValid() || isSubmitting}
        >
          <LinearGradient 
            colors={isCurrentStepValid() ? ['#7c3aed', '#3b82f6'] : ['#6b7280', '#6b7280']} 
            style={styles.primaryButtonGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {currentStep === STEP_TITLES.length - 1 ? 'Create Package' : 'Next'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Debug render to check if we have data
  console.log(`🔍 Modal render check - visible: ${visible}, isDataLoading: ${isDataLoading}, dataError: ${dataError}, locations: ${locations.length}, areas: ${areas.length}, agents: ${agents.length}`);

  return (
    <Modal visible={visible} transparent animationType="none">
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
            {renderProgressBar()}
            {renderHeader()}
            <KeyboardAvoidingView
              style={styles.content}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {renderCurrentStep()}
            </KeyboardAvoidingView>
            {renderFooter()}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: SCREEN_HEIGHT * 0.9,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    position: 'relative',
  },
  closeButtonAbsolute: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 10,
    zIndex: 1,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
  },
  retryButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty States
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateMessage: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Progress Bar
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  progressText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 34,
  },

  // Content
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  dataDebugText: {
    color: '#7c3aed',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },

  // Location/Area Lists
  locationsList: {
    flex: 1,
  },
  locationItem: {
    marginBottom: 12,
  },
  selectedLocationItem: {
    // Additional styling for selected item if needed
  },
  locationItemGradient: {
    borderRadius: 12,
    padding: 1,
  },
  locationItemContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 11,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationInitialsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Area specific styles
  areaInfo: {
    flex: 1,
  },
  areaLocationText: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },

  // Forms
  formContainer: {
    gap: 20,
  },
  inputGradientBorder: {
    borderRadius: 12,
    padding: 2,
  },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
  },

  // Delivery Options
  deliveryOptions: {
    gap: 16,
  },
  deliveryOption: {
    // Container styles
  },
  selectedDeliveryOption: {
    // Additional styling for selected option if needed
  },
  deliveryOptionGradient: {
    borderRadius: 12,
    padding: 1,
  },
  deliveryOptionContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 11,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  deliveryOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  deliveryOptionSubtitle: {
    color: '#888',
    fontSize: 14,
  },

  // Confirmation
  confirmationContainer: {
    gap: 20,
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  confirmationSectionTitle: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  confirmationDetail: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
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
  routeLocationInitials: {
    color: '#7c3aed',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routeLocationName: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 2,
  },
  routeAreaName: {
    color: '#888',
    fontSize: 12,
  },

  // Cost Section
  costSection: {
    marginTop: 10,
  },
  costGradientBg: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  costLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  costAmount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  costLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  costLoadingText: {
    color: '#888',
    fontSize: 16,
  },
  costErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  costErrorText: {
    color: '#ef4444',
    fontSize: 14,
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
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
}

type DeliveryType = 'doorstep' | 'agent';

const STEP_TITLES = [
  'Origin Area',           // Step 0: Select where package is coming from
  'Receiver Details',      // Step 1: Name and phone of receiver
  'Delivery Method',       // Step 2: Choose agent pickup or doorstep
  'Destination',          // Step 3: Select destination (agent or area)
  'Delivery Location',    // Step 4: Exact location for doorstep delivery
  'Confirm Details'       // Step 5: Review and submit
];

export default function PackageCreationModal({
  visible,
  onClose,
  onSubmit
}: PackageCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Data states
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form data
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

  const [deliveryLocation, setDeliveryLocation] = useState<string>(''); // For doorstep delivery
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

    await loadModalData();
  };

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

  // Calculate pricing when we have enough info
  useEffect(() => {
    if (packageData.origin_area_id && 
        ((packageData.delivery_type === 'agent' && packageData.destination_agent_id) ||
         (packageData.delivery_type === 'doorstep' && packageData.destination_area_id))) {
      fetchRealTimePricing();
    } else {
      setEstimatedCost(null);
      setPricingError(null);
    }
  }, [packageData.origin_area_id, packageData.destination_area_id, packageData.destination_agent_id, packageData.delivery_type]);

  const fetchRealTimePricing = async () => {
    setIsPricingLoading(true);
    setPricingError(null);

    try {
      let destinationAreaId = packageData.destination_area_id;
      
      // If agent delivery, get the area from the selected agent
      if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
        const selectedAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
        destinationAreaId = selectedAgent?.area_id || '';
      }

      if (!destinationAreaId) {
        setPricingError('Cannot calculate pricing');
        return;
      }

      const pricingResponse = await getPackagePricing({
        origin_area_id: packageData.origin_area_id,
        destination_area_id: destinationAreaId,
        delivery_type: packageData.delivery_type,
      });

      setEstimatedCost(pricingResponse.cost);
      console.log('💰 Pricing fetched successfully:', pricingResponse);
    } catch (error: any) {
      console.error('❌ Failed to fetch pricing:', error);
      setPricingError('Failed to load pricing');
      calculateFallbackCost();
    } finally {
      setIsPricingLoading(false);
    }
  };

  const calculateFallbackCost = () => {
    let destinationAreaId = packageData.destination_area_id;
    
    if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
      const selectedAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
      destinationAreaId = selectedAgent?.area_id || '';
    }

    const originArea = areas.find(a => a.id === packageData.origin_area_id);
    const destinationArea = areas.find(a => a.id === destinationAreaId);
    
    if (!originArea || !destinationArea) return;
    
    const isIntraArea = packageData.origin_area_id === destinationAreaId;
    const isIntraLocation = originArea.location_id === destinationArea.location_id;
    
    let baseCost = 0;
    
    if (isIntraArea) {
      baseCost = packageData.delivery_type === 'doorstep' ? 280 : 150;
    } else if (isIntraLocation) {
      baseCost = packageData.delivery_type === 'doorstep' ? 320 : 150;
    } else {
      baseCost = packageData.delivery_type === 'doorstep' ? 380 : 150;
    }
    
    setEstimatedCost(baseCost);
  };

  const updatePackageData = (field: keyof PackageData, value: string) => {
    setPackageData(prev => ({ ...prev, [field]: value }));
  };

  const getAgentsForDelivery = () => {
    // Return all agents for destination selection
    return agents;
  };

  const getSelectedOriginArea = () => {
    return areas.find(area => area.id === packageData.origin_area_id);
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
      case 0: return packageData.origin_area_id.length > 0;
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
        return true; // Skip this step for agent delivery
      case 5: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (currentStep < STEP_TITLES.length - 1 && isCurrentStepValid()) {
      // Skip delivery location step for agent delivery
      if (currentStep === 3 && packageData.delivery_type === 'agent') {
        setCurrentStep(5); // Jump to confirmation
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      // Handle skipping back over delivery location step for agent delivery
      if (currentStep === 5 && packageData.delivery_type === 'agent') {
        setCurrentStep(3); // Jump back to destination selection
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentStepValid()) return;

    setIsSubmitting(true);
    try {
      // Prepare final package data
      const finalPackageData = {
        ...packageData,
        sender_name: 'Current User', // You can get this from user context
        sender_phone: '+254700000000', // You can get this from user context
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

  // Render methods for each step
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

  // Step 0: Origin Area Selection
  const renderOriginAreaSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Origin Area</Text>
      <Text style={styles.stepSubtitle}>Where is the package coming from?</Text>
      
      <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
        {areas.map((area) => (
          <TouchableOpacity
            key={area.id}
            style={[
              styles.selectionItem,
              packageData.origin_area_id === area.id && styles.selectedItem
            ]}
            onPress={() => updatePackageData('origin_area_id', area.id)}
          >
            <LinearGradient
              colors={packageData.origin_area_id === area.id ? 
                ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
              style={styles.selectionItemGradient}
            >
              <View style={styles.selectionItemContent}>
                <View style={styles.selectionInitials}>
                  <Text style={styles.selectionInitialsText}>
                    {area.initials || area.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.selectionInfo}>
                  <Text style={styles.selectionName}>{area.name}</Text>
                  {area.location && (
                    <Text style={styles.selectionLocation}>{area.location.name}</Text>
                  )}
                </View>
                {packageData.origin_area_id === area.id && (
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Step 1: Receiver Details
  const renderReceiverDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Receiver Details</Text>
      <Text style={styles.stepSubtitle}>Who will receive this package?</Text>
      
      <View style={styles.formContainer}>
        <LinearGradient colors={['rgba(124, 58, 237, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.inputGradientBorder}>
          <TextInput
            style={styles.input}
            placeholder="Receiver's Full Name"
            placeholderTextColor="#888"
            value={packageData.receiver_name}
            onChangeText={(value) => updatePackageData('receiver_name', value)}
            autoCapitalize="words"
          />
        </LinearGradient>
        
        <LinearGradient colors={['rgba(124, 58, 237, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.inputGradientBorder}>
          <TextInput
            style={styles.input}
            placeholder="Receiver's Phone (+254...)"
            placeholderTextColor="#888"
            value={packageData.receiver_phone}
            onChangeText={(value) => updatePackageData('receiver_phone', value)}
            keyboardType="phone-pad"
          />
        </LinearGradient>
      </View>
    </View>
  );

  // Step 2: Delivery Method Selection
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
          <LinearGradient
            colors={packageData.delivery_type === 'agent' ? 
              ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
              ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
            style={styles.deliveryOptionGradient}
          >
            <View style={styles.deliveryOptionContent}>
              <Feather name="user" size={24} color="#fff" />
              <View style={styles.deliveryOptionText}>
                <Text style={styles.deliveryOptionTitle}>Agent Pickup</Text>
                <Text style={styles.deliveryOptionSubtitle}>Collect from our agent</Text>
              </View>
              {packageData.delivery_type === 'agent' && (
                <Feather name="check-circle" size={20} color="#10b981" />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deliveryOption,
            packageData.delivery_type === 'doorstep' && styles.selectedDeliveryOption
          ]}
          onPress={() => updatePackageData('delivery_type', 'doorstep')}
        >
          <LinearGradient
            colors={packageData.delivery_type === 'doorstep' ? 
              ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
              ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
            style={styles.deliveryOptionGradient}
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
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Step 3: Destination Selection (Agent or Area)
  const renderDestinationSelection = () => {
    if (packageData.delivery_type === 'agent') {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Select Receiving Agent</Text>
          <Text style={styles.stepSubtitle}>Which agent will handle delivery?</Text>
          
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
            {agents.map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.selectionItem,
                  packageData.destination_agent_id === agent.id && styles.selectedItem
                ]}
                onPress={() => updatePackageData('destination_agent_id', agent.id)}
              >
                <LinearGradient
                  colors={packageData.destination_agent_id === agent.id ? 
                    ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                    ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                  style={styles.selectionItemGradient}
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
                      <Text style={styles.selectionPhone}>{agent.phone}</Text>
                    </View>
                    {packageData.destination_agent_id === agent.id && (
                      <Feather name="check-circle" size={20} color="#10b981" />
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    } else {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Select Destination Area</Text>
          <Text style={styles.stepSubtitle}>Which area should we deliver to?</Text>
          
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
            {areas.map((area) => (
              <TouchableOpacity
                key={area.id}
                style={[
                  styles.selectionItem,
                  packageData.destination_area_id === area.id && styles.selectedItem
                ]}
                onPress={() => updatePackageData('destination_area_id', area.id)}
              >
                <LinearGradient
                  colors={packageData.destination_area_id === area.id ? 
                    ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                    ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                  style={styles.selectionItemGradient}
                >
                  <View style={styles.selectionItemContent}>
                    <View style={styles.selectionInitials}>
                      <Text style={styles.selectionInitialsText}>
                        {area.initials || area.name.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.selectionInfo}>
                      <Text style={styles.selectionName}>{area.name}</Text>
                      {area.location && (
                        <Text style={styles.selectionLocation}>{area.location.name}</Text>
                      )}
                    </View>
                    {packageData.destination_area_id === area.id && (
                      <Feather name="check-circle" size={20} color="#10b981" />
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
  };

  // Step 4: Delivery Location (only for doorstep delivery)
  const renderDeliveryLocation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Location</Text>
      <Text style={styles.stepSubtitle}>Provide the exact delivery address</Text>
      
      <View style={styles.formContainer}>
        <LinearGradient colors={['rgba(124, 58, 237, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.inputGradientBorder}>
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
        </LinearGradient>
      </View>
    </View>
  );

  // Step 5: Confirmation
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
              <Text style={styles.routeAreaInitials}>{getSelectedOriginArea()?.initials || '--'}</Text>
              <Text style={styles.routeAreaName}>{getSelectedOriginArea()?.name || 'Unknown'}</Text>
              <Text style={styles.routeLocationName}>{getSelectedOriginArea()?.location?.name || 'Unknown'}</Text>
            </View>
            <Feather name="arrow-right" size={20} color="#7c3aed" />
            <View style={styles.routePoint}>
              <Text style={styles.routeAreaInitials}>{getSelectedDestinationArea()?.initials || '--'}</Text>
              <Text style={styles.routeAreaName}>{getSelectedDestinationArea()?.name || 'Unknown'}</Text>
              <Text style={styles.routeLocationName}>{getSelectedDestinationArea()?.location?.name || 'Unknown'}</Text>
            </View>
          </View>
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
            {packageData.delivery_type === 'doorstep' ? 'Doorstep Delivery' : 'Agent Pickup'}
          </Text>
          
          {packageData.delivery_type === 'agent' && getSelectedDestinationAgent() && (
            <View style={styles.agentInfo}>
              <Text style={styles.confirmationDetail}>Agent: {getSelectedDestinationAgent()?.name}</Text>
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

        {/* Pricing Information */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Estimated Cost</Text>
          {isPricingLoading ? (
            <View style={styles.pricingLoader}>
              <ActivityIndicator size="small" color="#7c3aed" />
              <Text style={styles.pricingLoadingText}>Calculating...</Text>
            </View>
          ) : pricingError ? (
            <Text style={styles.pricingError}>{pricingError}</Text>
          ) : estimatedCost ? (
            <Text style={styles.estimatedCost}>KES {estimatedCost.toLocaleString()}</Text>
          ) : (
            <Text style={styles.pricingError}>Unable to calculate cost</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );

  // Main render method that switches between steps
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderOriginAreaSelection();
      case 1: return renderReceiverDetails();
      case 2: return renderDeliveryMethodSelection();
      case 3: return renderDestinationSelection();
      case 4: return renderDeliveryLocation();
      case 5: return renderConfirmation();
      default: return renderOriginAreaSelection();
    }
  };

  // Navigation buttons
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
            <KeyboardAvoidingView
              style={styles.keyboardAvoidingView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {renderHeader()}
              {renderProgressBar()}
              
              <View style={styles.contentContainer}>
                {renderCurrentStep()}
              </View>
              
              {renderNavigationButtons()}
            </KeyboardAvoidingView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

// StyleSheet
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: SCREEN_HEIGHT * 0.9,
    width: SCREEN_WIDTH,
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  keyboardAvoidingView: {
    flex: 1,
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
  
  // Progress bar styles
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
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
    paddingHorizontal: 20,
  },
  stepContent: {
    flex: 1,
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
  
  // Selection list styles
  selectionList: {
    flex: 1,
  },
  selectionItem: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedItem: {
    transform: [{ scale: 1.02 }],
  },
  selectionItemGradient: {
    padding: 1,
    borderRadius: 12,
  },
  selectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 11,
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
  
  // Form styles
  formContainer: {
    gap: 20,
  },
  inputGradientBorder: {
    padding: 1,
    borderRadius: 12,
  },
  input: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 11,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 56,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  
  // Delivery options styles
  deliveryOptions: {
    gap: 16,
  },
  deliveryOption: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedDeliveryOption: {
    transform: [{ scale: 1.02 }],
  },
  deliveryOptionGradient: {
    padding: 1,
    borderRadius: 12,
  },
  deliveryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 11,
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
  
  // Pricing styles
  pricingLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pricingLoadingText: {
    fontSize: 14,
    color: '#888',
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
  
  // Navigation styles
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
  
  // Loading and error states
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
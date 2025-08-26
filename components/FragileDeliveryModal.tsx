// components/FragileDeliveryModal.tsx - Updated to create package in pending_unpaid state
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { 
  getPackageFormData,
  createPackage,
  type PackageData,
  type Agent,
  type Area 
} from '../lib/helpers/packageHelpers';
import Toast from 'react-native-toast-message';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
  description?: string;
}

interface FragileDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  onPackageCreated: (packageId: string, cost: number) => void; // Changed: Redirect to payment
}

export default function FragileDeliveryModal({
  visible,
  onClose,
  onPackageCreated,
}: FragileDeliveryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // Form data
  const [agents, setAgents] = useState<Agent[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  
  // Location states
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
  
  // Selected agents/areas
  const [selectedOriginAgent, setSelectedOriginAgent] = useState<Agent | null>(null);
  const [selectedDestinationArea, setSelectedDestinationArea] = useState<Area | null>(null);
  
  // Form states
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  
  const STEP_TITLES = [
    'Pickup Location',
    'Receiver Details',
    'Item Details', 
    'Delivery Location',
    'Confirm & Pay'
  ];

  // Load form data
  const loadFormData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const formData = await getPackageFormData();
      setAgents(formData.agents);
      setAreas(formData.areas);
    } catch (error: any) {
      console.error('❌ Failed to load form data:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Data',
        text2: error.message || 'Could not load agents and areas',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Animation effects
  useEffect(() => {
    if (visible) {
      loadFormData();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, loadFormData]);

  // Calculate pricing
  useEffect(() => {
    if (selectedOriginAgent && selectedDestinationArea) {
      calculateFragilePrice();
    }
  }, [selectedOriginAgent, selectedDestinationArea]);

  const calculateFragilePrice = () => {
    if (!selectedOriginAgent || !selectedDestinationArea) return;

    // Get origin area from selected agent
    const originArea = selectedOriginAgent.area;
    if (!originArea) return;

    const isIntraArea = originArea.id === selectedDestinationArea.id;
    const isIntraLocation = originArea.location_id === selectedDestinationArea.location_id;

    let baseCost = 0;
    
    if (isIntraArea) {
      baseCost = 350; // Same area fragile delivery
    } else if (isIntraLocation) {
      baseCost = 420; // Same location, different areas
    } else {
      baseCost = 580; // Different locations
    }

    // Add fragile handling surcharge
    const totalCost = baseCost + 120; // Special handling fee
    setEstimatedCost(totalCost);
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      resetForm();
      onClose();
    });
  };

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedOriginAgent(null);
    setSelectedDestinationArea(null);
    setPickupLocation(null);
    setDeliveryLocation(null);
    setReceiverName('');
    setReceiverPhone('');
    setItemDescription('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setEstimatedCost(null);
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return selectedOriginAgent !== null;
      case 1:
        return receiverName.trim().length > 0 && receiverPhone.trim().length > 0;
      case 2:
        return itemDescription.trim().length > 0;
      case 3:
        return selectedDestinationArea !== null && deliveryAddress.trim().length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < STEP_TITLES.length - 1 && isStepValid(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isStepValid(currentStep) || !selectedOriginAgent || !selectedDestinationArea) return;

    setIsSubmitting(true);
    try {
      console.log('📦 Creating fragile package...');
      
      const packageData: PackageData = {
        sender_name: 'Current User', // Will be set by backend from user info
        sender_phone: '+254700000000', // Will be set by backend from user info
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        origin_agent_id: selectedOriginAgent.id,
        destination_agent_id: '', // Not needed for fragile doorstep delivery
        origin_area_id: selectedOriginAgent.area?.id || '',
        destination_area_id: selectedDestinationArea.id,
        delivery_type: 'fragile',
        delivery_location: deliveryAddress.trim(),
        item_description: itemDescription.trim(),
        special_instructions: specialInstructions.trim(),
        pickup_latitude: pickupLocation?.latitude,
        pickup_longitude: pickupLocation?.longitude,
        delivery_latitude: deliveryLocation?.latitude,
        delivery_longitude: deliveryLocation?.longitude,
      };

      console.log('🚀 Submitting fragile package data:', packageData);

      const response = await createPackage(packageData);
      
      console.log('✅ Fragile package created successfully:', response);
      
      closeModal();
      
      // Redirect to payment with package details
      onPackageCreated(response.id, estimatedCost || 580);
      
      Toast.show({
        type: 'success',
        text1: 'Package Created! 📦',
        text2: `Package ${response.tracking_code} created. Redirecting to payment...`,
        position: 'top',
        visibilityTime: 3000,
      });
      
    } catch (error: any) {
      console.error('❌ Error creating fragile package:', error);
      Toast.show({
        type: 'error',
        text1: 'Package Creation Failed',
        text2: error.message || 'Failed to create package. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
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

  const renderPickupLocationStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>⚠️ Fragile Item Pickup</Text>
      <Text style={styles.stepSubtitle}>
        Select the agent who will collect your fragile item
      </Text>
      
      <View style={styles.fragileInfo}>
        <Feather name="shield" size={20} color="#f97316" />
        <View style={styles.fragileInfoText}>
          <Text style={styles.fragileInfoTitle}>Special Care Service</Text>
          <Text style={styles.fragileInfoDescription}>
            Our fragile delivery service includes special packaging, priority handling, 
            and real-time tracking for your peace of mind.
          </Text>
        </View>
      </View>

      {isLoadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Loading pickup agents...</Text>
        </View>
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.agentItem,
                selectedOriginAgent?.id === item.id && styles.selectedAgentItem
              ]}
              onPress={() => setSelectedOriginAgent(item)}
            >
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{item.name}</Text>
                <Text style={styles.agentLocation}>
                  {item.area?.name}, {item.area?.location?.name}
                </Text>
                <Text style={styles.agentPhone}>{item.phone}</Text>
              </View>
              {selectedOriginAgent?.id === item.id && (
                <Feather name="check-circle" size={20} color="#f97316" />
              )}
            </TouchableOpacity>
          )}
          style={styles.agentsList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderReceiverDetailsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>👤 Receiver Information</Text>
      <Text style={styles.stepSubtitle}>
        Who should receive this fragile item?
      </Text>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Receiver's Full Name"
          placeholderTextColor="#888"
          value={receiverName}
          onChangeText={setReceiverName}
          autoCapitalize="words"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Receiver's Phone Number"
          placeholderTextColor="#888"
          value={receiverPhone}
          onChangeText={setReceiverPhone}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderItemDetailsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📦 Fragile Item Details</Text>
      <Text style={styles.stepSubtitle}>
        Describe the item that needs special care
      </Text>

      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the fragile item (e.g., glassware, electronics, artwork)"
          placeholderTextColor="#888"
          value={itemDescription}
          onChangeText={setItemDescription}
          multiline
          textAlignVertical="top"
        />
        
        <View style={styles.fragileNotice}>
          <Feather name="alert-triangle" size={16} color="#f97316" />
          <Text style={styles.fragileNoticeText}>
            Please provide detailed description for proper handling
          </Text>
        </View>
      </View>
    </View>
  );

  const renderDeliveryLocationStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📍 Delivery Location</Text>
      <Text style={styles.stepSubtitle}>
        Where should we deliver this fragile item?
      </Text>

      <View style={styles.formContainer}>
        {isLoadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Loading delivery areas...</Text>
          </View>
        ) : (
          <FlatList
            data={areas}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.areaItem,
                  selectedDestinationArea?.id === item.id && styles.selectedAreaItem
                ]}
                onPress={() => setSelectedDestinationArea(item)}
              >
                <View style={styles.areaInfo}>
                  <Text style={styles.areaName}>{item.name}</Text>
                  <Text style={styles.areaLocation}>{item.location?.name}</Text>
                </View>
                {selectedDestinationArea?.id === item.id && (
                  <Feather name="check-circle" size={20} color="#f97316" />
                )}
              </TouchableOpacity>
            )}
            style={styles.areasList}
            showsVerticalScrollIndicator={false}
          />
        )}
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Specific delivery address and instructions"
          placeholderTextColor="#888"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          textAlignVertical="top"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special delivery instructions (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderConfirmationStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>✅ Confirm Fragile Delivery</Text>
      <Text style={styles.stepSubtitle}>
        Review your details and proceed to payment
      </Text>

      <View style={styles.confirmationContainer}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>📍 Pickup</Text>
          <Text style={styles.confirmationDetail}>
            Agent: {selectedOriginAgent?.name}
          </Text>
          <Text style={styles.confirmationSubDetail}>
            {selectedOriginAgent?.area?.name}, {selectedOriginAgent?.area?.location?.name}
          </Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>👤 Receiver</Text>
          <Text style={styles.confirmationDetail}>{receiverName}</Text>
          <Text style={styles.confirmationDetail}>{receiverPhone}</Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>📦 Fragile Item</Text>
          <Text style={styles.confirmationDetail}>{itemDescription}</Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>🚚 Delivery</Text>
          <Text style={styles.confirmationDetail}>
            To: {selectedDestinationArea?.name}, {selectedDestinationArea?.location?.name}
          </Text>
          <Text style={styles.confirmationSubDetail}>{deliveryAddress}</Text>
          {specialInstructions && (
            <Text style={styles.confirmationSubDetail}>
              Instructions: {specialInstructions}
            </Text>
          )}
        </View>

        <View style={styles.pricingSection}>
          <Text style={styles.pricingSectionTitle}>💰 Total Cost</Text>
          {estimatedCost && (
            <Text style={styles.totalCost}>KES {estimatedCost.toLocaleString()}</Text>
          )}
          <View style={styles.serviceFeatures}>
            <View style={styles.serviceFeature}>
              <Feather name="shield" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Special handling & packaging</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="zap" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Priority delivery service</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="phone" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Real-time tracking updates</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderPickupLocationStep();
      case 1:
        return renderReceiverDetailsStep();
      case 2:
        return renderItemDetailsStep();
      case 3:
        return renderDeliveryLocationStep();
      case 4:
        return renderConfirmationStep();
      default:
        return renderPickupLocationStep();
    }
  };

  const renderNavigationButtons = () => (
    <View style={styles.navigationContainer}>
      <TouchableOpacity
        style={[styles.navButton, styles.backButton, currentStep === 0 && styles.disabledButton]}
        onPress={prevStep}
        disabled={currentStep === 0}
      >
        <Feather name="chevron-left" size={20} color={currentStep === 0 ? "#666" : "#fff"} />
        <Text style={[styles.navButtonText, currentStep === 0 && styles.disabledButtonText]}>
          Back
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.navButton,
          currentStep === STEP_TITLES.length - 1 ? styles.submitButton : styles.nextButton,
          !isStepValid(currentStep) && styles.disabledButton
        ]}
        onPress={currentStep === STEP_TITLES.length - 1 ? handleSubmit : nextStep}
        disabled={!isStepValid(currentStep) || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Text style={[styles.navButtonText, !isStepValid(currentStep) && styles.disabledButtonText]}>
              {currentStep === STEP_TITLES.length - 1 ? 'Create Package' : 'Next'}
            </Text>
            {currentStep < STEP_TITLES.length - 1 && (
              <Feather name="chevron-right" size={20} color={!isStepValid(currentStep) ? "#666" : "#fff"} />
            )}
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <SafeAreaView style={styles.safeArea}>
              {renderHeader()}
              {renderProgressBar()}
              
              <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {renderStepContent()}
              </ScrollView>
              
              {renderNavigationButtons()}
            </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// Styles remain the same as original FragileDeliveryModal
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalContainer: {
    height: SCREEN_HEIGHT * 0.95,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(249, 115, 22, 0.2)',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressForeground: {
    height: 4,
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
  },
  fragileInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#f97316',
    marginTop: 10,
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
  fragileNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  fragileNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#f97316',
  },
  agentsList: {
    maxHeight: 300,
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  selectedAgentItem: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: '#f97316',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  agentLocation: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  agentPhone: {
    fontSize: 12,
    color: '#666',
  },
  areasList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  selectedAreaItem: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: '#f97316',
  },
  areaInfo: {
    flex: 1,
  },
  areaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  areaLocation: {
    fontSize: 14,
    color: '#888',
  },
  confirmationContainer: {
    gap: 16,
  },
  confirmationSection: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  confirmationSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 8,
  },
  confirmationDetail: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  confirmationSubDetail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  pricingSection: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  pricingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 8,
  },
  totalCost: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
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
    color: '#f97316',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(249, 115, 22, 0.2)',
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nextButton: {
    backgroundColor: '#f97316',
  },
  submitButton: {
    backgroundColor: '#10b981',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButtonText: {
    color: '#666',
  },
});
// components/CollectDeliverModal.tsx - Updated to create package in pending_unpaid state
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
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { 
  getPackageFormData,
  createPackage,
  type PackageData,
  type Agent,
  type Area 
} from '../lib/helpers/packageHelpers';
import Toast from 'react-native-toast-message';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface CollectDeliverModalProps {
  visible: boolean;
  onClose: () => void;
  onPackageCreated: (packageId: string, cost: number) => void; // Changed: Redirect to payment
}

export default function CollectDeliverModal({
  visible,
  onClose,
  onPackageCreated,
}: CollectDeliverModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // Form data
  const [agents, setAgents] = useState<Agent[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  
  // Selected agents/areas
  const [selectedOriginAgent, setSelectedOriginAgent] = useState<Agent | null>(null);
  const [selectedDestinationArea, setSelectedDestinationArea] = useState<Area | null>(null);
  
  // Form states
  const [shopName, setShopName] = useState('');
  const [shopContact, setShopContact] = useState('');
  const [collectionAddress, setCollectionAddress] = useState('');
  const [itemsToCollect, setItemsToCollect] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  
  const STEP_TITLES = [
    'Collection Details',
    'Item Information', 
    'Delivery Setup',
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

  // Calculate pricing based on collection service
  useEffect(() => {
    if (selectedOriginAgent && selectedDestinationArea && itemValue) {
      calculateCollectionPrice();
    }
  }, [selectedOriginAgent, selectedDestinationArea, itemValue]);

  const calculateCollectionPrice = () => {
    if (!selectedOriginAgent || !selectedDestinationArea) return;

    const originArea = selectedOriginAgent.area;
    if (!originArea) return;

    const isIntraArea = originArea.id === selectedDestinationArea.id;
    const isIntraLocation = originArea.location_id === selectedDestinationArea.location_id;

    let baseCost = 0;
    
    // Collection service base pricing
    if (isIntraArea) {
      baseCost = 400; // Same area collection + delivery
    } else if (isIntraLocation) {
      baseCost = 500; // Same location, different areas
    } else {
      baseCost = 650; // Different locations
    }

    // Add value-based fee for high-value items
    const value = parseFloat(itemValue) || 0;
    if (value > 10000) {
      baseCost += 150; // High-value item surcharge
    } else if (value > 5000) {
      baseCost += 100; // Medium-value item surcharge
    }

    setEstimatedCost(baseCost);
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
    setShopName('');
    setShopContact('');
    setCollectionAddress('');
    setItemsToCollect('');
    setItemValue('');
    setReceiverName('');
    setReceiverPhone('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setEstimatedCost(null);
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return selectedOriginAgent && shopName.trim() && shopContact.trim() && collectionAddress.trim();
      case 1:
        return itemsToCollect.trim() && itemValue.trim() && parseFloat(itemValue) > 0;
      case 2:
        return selectedDestinationArea && receiverName.trim() && receiverPhone.trim() && deliveryAddress.trim();
      case 3:
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
      console.log('📦 Creating collection package...');
      
      const packageData: PackageData = {
        sender_name: 'Current User', // Will be set by backend from user info
        sender_phone: '+254700000000', // Will be set by backend from user info
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        origin_agent_id: selectedOriginAgent.id,
        destination_agent_id: '', // Collection is pickup + doorstep delivery
        origin_area_id: selectedOriginAgent.area?.id || '',
        destination_area_id: selectedDestinationArea.id,
        delivery_type: 'collection',
        delivery_location: deliveryAddress.trim(),
        // Collection-specific fields
        shop_name: shopName.trim(),
        shop_contact: shopContact.trim(),
        collection_address: collectionAddress.trim(),
        items_to_collect: itemsToCollect.trim(),
        item_value: parseFloat(itemValue),
        special_instructions: specialInstructions.trim(),
      };

      console.log('🚀 Submitting collection package data:', packageData);

      const response = await createPackage(packageData);
      
      console.log('✅ Collection package created successfully:', response);
      
      closeModal();
      
      // Redirect to payment with package details
      onPackageCreated(response.id, estimatedCost || 500);
      
      Toast.show({
        type: 'success',
        text1: 'Collection Service Created! 📦',
        text2: `Package ${response.tracking_code} created. Redirecting to payment...`,
        position: 'top',
        visibilityTime: 3000,
      });
      
    } catch (error: any) {
      console.error('❌ Error creating collection package:', error);
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

  const renderCollectionDetailsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📍 Collection Setup</Text>
      <Text style={styles.stepSubtitle}>
        Tell us where to collect your items from
      </Text>
      
      <View style={styles.collectionInfo}>
        <Feather name="package" size={20} color="#10b981" />
        <View style={styles.collectionInfoText}>
          <Text style={styles.collectionInfoTitle}>Collection & Delivery Service</Text>
          <Text style={styles.collectionInfoDescription}>
            We'll pick up your items from the specified location and deliver them safely. 
            Payment required in advance.
          </Text>
        </View>
      </View>

      <View style={styles.formContainer}>
        {/* Agent Selection */}
        <Text style={styles.fieldLabel}>Select Collection Agent:</Text>
        {isLoadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading agents...</Text>
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
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            )}
            style={styles.agentsList}
            showsVerticalScrollIndicator={false}
          />
        )}
        
        {/* Shop Details */}
        <TextInput
          style={styles.input}
          placeholder="Shop/Business Name"
          placeholderTextColor="#888"
          value={shopName}
          onChangeText={setShopName}
          autoCapitalize="words"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Shop Contact Number"
          placeholderTextColor="#888"
          value={shopContact}
          onChangeText={setShopContact}
          keyboardType="phone-pad"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Collection Address (detailed location)"
          placeholderTextColor="#888"
          value={collectionAddress}
          onChangeText={setCollectionAddress}
          multiline
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderItemInformationStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📦 What are we collecting?</Text>
      <Text style={styles.stepSubtitle}>
        Provide details about the items to collect
      </Text>

      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe items to collect (e.g., 5 boxes of electronics, furniture set)"
          placeholderTextColor="#888"
          value={itemsToCollect}
          onChangeText={setItemsToCollect}
          multiline
          textAlignVertical="top"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Estimated total value (KES)"
          placeholderTextColor="#888"
          value={itemValue}
          onChangeText={setItemValue}
          keyboardType="numeric"
        />
        
        <View style={styles.valueNotice}>
          <Feather name="info" size={16} color="#10b981" />
          <Text style={styles.valueNoticeText}>
            Higher value items may incur additional insurance fees
          </Text>
        </View>
      </View>
    </View>
  );

  const renderDeliverySetupStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🚚 Delivery Details</Text>
      <Text style={styles.stepSubtitle}>
        Where should we deliver the collected items?
      </Text>

      <View style={styles.formContainer}>
        {/* Destination Area Selection */}
        <Text style={styles.fieldLabel}>Select Delivery Area:</Text>
        {isLoadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
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
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            )}
            style={styles.areasList}
            showsVerticalScrollIndicator={false}
          />
        )}
        
        {/* Receiver Details */}
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
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Delivery address and instructions"
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
      <Text style={styles.stepTitle}>✅ Confirm Collection Service</Text>
      <Text style={styles.stepSubtitle}>
        Review details and proceed to payment
      </Text>

      <View style={styles.confirmationContainer}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>📍 Collection From</Text>
          <Text style={styles.confirmationDetail}>{shopName}</Text>
          <Text style={styles.confirmationSubDetail}>{shopContact}</Text>
          <Text style={styles.confirmationSubDetail}>{collectionAddress}</Text>
          <Text style={styles.confirmationSubDetail}>
            Agent: {selectedOriginAgent?.name} ({selectedOriginAgent?.phone})
          </Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>📦 Items</Text>
          <Text style={styles.confirmationDetail}>{itemsToCollect}</Text>
          <Text style={styles.confirmationSubDetail}>
            Estimated Value: KES {parseFloat(itemValue).toLocaleString()}
          </Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>🚚 Delivery To</Text>
          <Text style={styles.confirmationDetail}>{receiverName}</Text>
          <Text style={styles.confirmationDetail}>{receiverPhone}</Text>
          <Text style={styles.confirmationSubDetail}>
            Area: {selectedDestinationArea?.name}, {selectedDestinationArea?.location?.name}
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
              <Feather name="package" size={16} color="#10b981" />
              <Text style={styles.serviceFeatureText}>Complete pickup service</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="truck" size={16} color="#10b981" />
              <Text style={styles.serviceFeatureText}>Safe transportation</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="shield" size={16} color="#10b981" />
              <Text style={styles.serviceFeatureText}>Item value protection</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="clock" size={16} color="#10b981" />
              <Text style={styles.serviceFeatureText}>Same-day collection</Text>
            </View>
          </View>
          
          <View style={styles.paymentNotice}>
            <Feather name="alert-circle" size={16} color="#f59e0b" />
            <Text style={styles.paymentNoticeText}>
              Payment required in advance for collection services
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderCollectionDetailsStep();
      case 1:
        return renderItemInformationStep();
      case 2:
        return renderDeliverySetupStep();
      case 3:
        return renderConfirmationStep();
      default:
        return renderCollectionDetailsStep();
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
              {currentStep === STEP_TITLES.length - 1 ? 'Create & Pay' : 'Next'}
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
              { 
                transform: [{ translateY: slideAnim }],
                height: isKeyboardVisible ? SCREEN_HEIGHT - keyboardHeight : SCREEN_HEIGHT * 0.95
              }
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
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressForeground: {
    height: 4,
    backgroundColor: '#10b981',
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
  collectionInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  collectionInfoText: {
    flex: 1,
  },
  collectionInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  collectionInfoDescription: {
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  formContainer: {
    gap: 16,
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#10b981',
    marginTop: 10,
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
  agentsList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  selectedAgentItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  selectedAreaItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
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
  valueNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  valueNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
  },
  confirmationContainer: {
    gap: 16,
  },
  confirmationSection: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  confirmationSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  pricingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
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
    marginBottom: 12,
  },
  serviceFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceFeatureText: {
    fontSize: 14,
    color: '#10b981',
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  paymentNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '500',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
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
    backgroundColor: '#10b981',
  },
  submitButton: {
    backgroundColor: '#059669',
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
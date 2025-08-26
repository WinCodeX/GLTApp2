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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { type PackageData } from '../lib/helpers/packageHelpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

interface CollectDeliverModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: LocationData | null;
}

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
  
  // Form states
  const [shopName, setShopName] = useState('');
  const [shopContact, setShopContact] = useState('');
  const [collectionAddress, setCollectionAddress] = useState('');
  const [itemsToCollect, setItemsToCollect] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  
  const STEP_TITLES = [
    'Collection Details',
    'Item Information',
    'Delivery Setup',
    'Payment & Confirmation'
  ];

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
      return Math.max(maxHeightWithKeyboard, SCREEN_HEIGHT * 0.5);
    }
    return SCREEN_HEIGHT * 0.90;
  }, [isKeyboardVisible, keyboardHeight]);

  useEffect(() => {
    if (visible) {
      resetForm();
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const resetForm = () => {
    setCurrentStep(0);
    setShopName('');
    setShopContact('');
    setCollectionAddress('');
    setItemsToCollect('');
    setItemValue('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setPaymentMethod('mpesa');
    setReceiverName('');
    setReceiverPhone('');
    setIsSubmitting(false);
  };

  const closeModal = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [slideAnim, onClose]);

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return shopName.trim().length > 0 && shopContact.trim().length > 0 && collectionAddress.trim().length > 0;
      case 1:
        return itemsToCollect.trim().length > 0 && itemValue.trim().length > 0;
      case 2:
        return receiverName.trim().length > 0 && receiverPhone.trim().length > 0 && deliveryAddress.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEP_TITLES.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const packageData: PackageData = {
        // Collection service specific fields
        shop_name: shopName.trim(),
        shop_contact: shopContact.trim(),
        collection_address: collectionAddress.trim(),
        items_to_collect: itemsToCollect.trim(),
        item_value: parseFloat(itemValue),
        
        // Standard package fields
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        delivery_type: 'doorstep', // Collection service uses doorstep delivery
        delivery_location: deliveryAddress.trim(),
        sender_name: 'GLT Collection Service',
        sender_phone: '+254700000000',
        
        // Payment and special handling
        payment_method: paymentMethod,
        special_instructions: specialInstructions.trim() || undefined,
        requires_payment_advance: true,
        collection_type: 'pickup_and_deliver',
      };

      await onSubmit(packageData);
      closeModal();
    } catch (error) {
      console.error('Error submitting collection request:', error);
      Alert.alert('Error', 'Failed to create collection request. Please try again.');
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

  const renderCollectionDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🏪 Collection Details</Text>
      <Text style={styles.stepSubtitle}>
        Tell us where to collect your items
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Shop/Business Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter shop or business name"
          placeholderTextColor="#888"
          value={shopName}
          onChangeText={setShopName}
          autoCapitalize="words"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Contact Person/Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="Contact person or phone number"
          placeholderTextColor="#888"
          value={shopContact}
          onChangeText={setShopContact}
          autoCapitalize="words"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Collection Address *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Complete address where we should collect the items"
          placeholderTextColor="#888"
          value={collectionAddress}
          onChangeText={setCollectionAddress}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderItemInformation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📦 Item Information</Text>
      <Text style={styles.stepSubtitle}>
        Details about the items to collect
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Items to Collect *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the items to be collected"
          placeholderTextColor="#888"
          value={itemsToCollect}
          onChangeText={setItemsToCollect}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Estimated Value (KSH) *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter estimated value in KSH"
          placeholderTextColor="#888"
          value={itemValue}
          onChangeText={setItemValue}
          keyboardType="numeric"
        />
      </View>
    </View>
  );

  const renderDeliverySetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🚚 Delivery Setup</Text>
      <Text style={styles.stepSubtitle}>
        Where should we deliver the collected items?
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Receiver Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Name of person receiving the items"
          placeholderTextColor="#888"
          value={receiverName}
          onChangeText={setReceiverName}
          autoCapitalize="words"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Receiver Phone *</Text>
        <TextInput
          style={styles.input}
          placeholder="+254700000000"
          placeholderTextColor="#888"
          value={receiverPhone}
          onChangeText={setReceiverPhone}
          keyboardType="phone-pad"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Delivery Address *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Complete delivery address"
          placeholderTextColor="#888"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Special Instructions</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any special delivery instructions (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderPaymentConfirmation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>💳 Payment & Confirmation</Text>
      <Text style={styles.stepSubtitle}>
        Review details and choose payment method
      </Text>
      
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Collection:</Text>
          <Text style={styles.summaryValue}>{shopName}</Text>
          <Text style={styles.summaryValue}>{collectionAddress}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Items:</Text>
          <Text style={styles.summaryValue}>{itemsToCollect}</Text>
          <Text style={styles.summaryValue}>Value: KSH {itemValue}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Delivery:</Text>
          <Text style={styles.summaryValue}>{receiverName} - {receiverPhone}</Text>
          <Text style={styles.summaryValue}>{deliveryAddress}</Text>
        </View>
      </View>
      
      <View style={styles.paymentMethodContainer}>
        <Text style={styles.inputLabel}>Payment Method</Text>
        <View style={styles.paymentOptions}>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'mpesa' && styles.selectedPaymentOption
            ]}
            onPress={() => setPaymentMethod('mpesa')}
          >
            <Text style={[
              styles.paymentOptionText,
              paymentMethod === 'mpesa' && styles.selectedPaymentOptionText
            ]}>
              M-Pesa
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'card' && styles.selectedPaymentOption
            ]}
            onPress={() => setPaymentMethod('card')}
          >
            <Text style={[
              styles.paymentOptionText,
              paymentMethod === 'card' && styles.selectedPaymentOptionText
            ]}>
              Card
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.alertContainer}>
        <Feather name="info" size={24} color="#3b82f6" />
        <Text style={styles.alertText}>
          Payment required in advance for collection services
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
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
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Feather name="chevron-left" size={20} color="#7c3aed" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      
      {currentStep < STEP_TITLES.length - 1 ? (
        <TouchableOpacity 
          onPress={handleNext} 
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
          <Feather name="chevron-right" size={20} color={isStepValid(currentStep) ? "#fff" : "#666"} />
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
                Request Collection
              </Text>
              <Feather name="package" size={20} color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#666"} />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

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
              </LinearGradient>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

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
  
  // Header - Fixed padding for proper status bar handling
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 40,
  },
  
  // Progress Bar
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  progressText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Content
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 20,
    lineHeight: 20,
  },
  
  // Input Fields
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 50,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  
  // Payment Method
  paymentMethodContainer: {
    marginBottom: 20,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedPaymentOption: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  paymentOptionText: {
    color: '#ccc',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedPaymentOptionText: {
    color: '#3b82f6',
  },
  
  // Summary
  summaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryItem: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 18,
  },
  
  // Alert
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 16,
  },
  alertText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  
  // Navigation
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  backButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: '#7c3aed',
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  disabledButtonText: {
    color: '#666',
  },
});
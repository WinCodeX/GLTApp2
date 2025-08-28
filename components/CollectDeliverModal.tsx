// components/CollectDeliverModal.tsx - FIXED: Proper keyboard handling and header visibility
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
import * as Location from 'expo-location';
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
  // FIXED: Stable state management - no dependencies on currentStep
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // FIXED: Persistent location states - initialized once
  const [collectionLocation, setCollectionLocation] = useState<LocationData | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(initialLocation);
  
  // FIXED: Persistent form states - no reset on step change
  const [shopName, setShopName] = useState('');
  const [shopContact, setShopContact] = useState('');
  const [collectionAddress, setCollectionAddress] = useState('');
  const [itemsToCollect, setItemsToCollect] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
  
  const STEP_TITLES = [
    'Collection Details',
    'Item Information', 
    'Delivery Setup',
    'Payment & Confirmation'
  ];

  // FIXED: Better keyboard handling to prevent modal hiding
  useEffect(() => {
    if (!visible) return;

    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, [visible]);

  // FIXED: Better modal height calculation to prevent hiding
  const modalHeight = useMemo(() => {
    const statusBarHeight = Platform.OS === 'ios' ? 47 : 24;
    const headerHeight = 80;
    const minModalHeight = 400;
    
    if (isKeyboardVisible) {
      // When keyboard is visible, calculate available space
      const availableHeight = SCREEN_HEIGHT - keyboardHeight - statusBarHeight;
      return Math.max(availableHeight * 0.95, minModalHeight);
    }
    
    // When keyboard is hidden, use most of the screen
    return Math.min(SCREEN_HEIGHT * 0.92, SCREEN_HEIGHT - statusBarHeight - 20);
  }, [isKeyboardVisible, keyboardHeight]);

  // FIXED: One-time initialization when modal opens
  useEffect(() => {
    if (visible && !isInitialized) {
      console.log('Initializing CollectDeliverModal once...');
      initializeModal();
      setIsInitialized(true);
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (!visible) {
      setIsInitialized(false);
    }
  }, [visible]);

  const initializeModal = useCallback(() => {
    if (initialLocation && !deliveryLocation) {
      setDeliveryLocation(initialLocation);
    }
    
    setCurrentStep(0);
    setIsSubmitting(false);
  }, [initialLocation, deliveryLocation]);

  const resetForm = useCallback(() => {
    setCurrentStep(0);
    setCollectionLocation(null);
    setDeliveryLocation(initialLocation);
    setShopName('');
    setShopContact('');
    setCollectionAddress('');
    setItemsToCollect('');
    setItemValue('');
    setDeliveryAddress('');
    setSpecialInstructions('');
    setPaymentMethod('mpesa');
    setIsSubmitting(false);
    setIsInitialized(false);
  }, [initialLocation]);

  const closeModal = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      resetForm();
      onClose();
    });
  }, [slideAnim, onClose, resetForm]);

  const selectLocationOnMap = useCallback(async (type: 'collection' | 'delivery') => {
    Alert.alert(
      'Select Location',
      `This would open a map to select ${type} location. For demo purposes, we'll use current location.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Use Current Location',
          onPress: async () => {
            try {
              const location = await Location.getCurrentPositionAsync({});
              const address = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              
              const locationData = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Selected Location'
              };
              
              if (type === 'collection') {
                setCollectionLocation(locationData);
              } else {
                setDeliveryLocation(locationData);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to get location');
            }
          }
        }
      ]
    );
  }, []);

  const isStepValid = useCallback((step: number) => {
    switch (step) {
      case 0:
        return shopName.trim().length > 0 && collectionAddress.trim().length > 0;
      case 1:
        return itemsToCollect.trim().length > 0 && itemValue.trim().length > 0;
      case 2:
        return deliveryAddress.trim().length > 0;
      case 3:
        return paymentMethod.length > 0;
      default:
        return false;
    }
  }, [shopName, collectionAddress, itemsToCollect, itemValue, deliveryAddress, paymentMethod]);

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

  const calculateCosts = useMemo(() => {
    const collectionFee = 200;
    const deliveryFee = 250;
    const itemValueNum = parseFloat(itemValue) || 0;
    const insuranceFee = Math.max(50, itemValueNum * 0.02);
    const serviceFee = 100;
    
    return {
      collection: collectionFee,
      delivery: deliveryFee,
      insurance: Math.round(insuranceFee),
      service: serviceFee,
      total: collectionFee + deliveryFee + Math.round(insuranceFee) + serviceFee
    };
  }, [itemValue]);

  const handleSubmit = useCallback(async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    
    try {
      const packageData: PackageData = {
        receiver_name: 'Self',
        receiver_phone: '+254700000000',
        pickup_location: `${shopName} - ${collectionAddress}`,
        delivery_location: deliveryAddress,
        delivery_type: 'collection',
        package_description: `COLLECT & DELIVER: ${itemsToCollect}\nValue: KES ${itemValue}\nSpecial Instructions: ${specialInstructions}`,
        coordinates: collectionLocation && deliveryLocation ? {
          pickup: collectionLocation,
          delivery: deliveryLocation
        } : undefined,
        collection_details: {
          shop_name: shopName,
          shop_contact: shopContact,
          items_to_collect: itemsToCollect,
          estimated_value: itemValue,
          payment_method: paymentMethod
        }
      };

      await onSubmit(packageData);
      closeModal();
    } catch (error) {
      console.error('Error submitting collect & deliver request:', error);
      Alert.alert('Submission Error', 'Failed to submit collection request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, isStepValid, shopName, collectionAddress, deliveryAddress, itemsToCollect, 
      itemValue, specialInstructions, paymentMethod, collectionLocation, deliveryLocation, 
      onSubmit, closeModal]);

  // FIXED: Header with proper positioning under status bar
  const renderHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STEP_TITLES[currentStep]}</Text>
        <View style={styles.placeholder} />
      </View>
    </View>
  ), [closeModal, currentStep]);

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

  const renderCollectionDetails = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📦 Collection Setup</Text>
      <Text style={styles.stepSubtitle}>
        Where should we collect your items from?
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Shop/Store Name"
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
          placeholder="Collection address, building details, floor, etc."
          placeholderTextColor="#888"
          value={collectionAddress}
          onChangeText={setCollectionAddress}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.serviceInfo}>
        <Feather name="truck" size={16} color="#10b981" />
        <Text style={styles.serviceInfoText}>
          Our rider will visit this location to collect your items
        </Text>
      </View>
    </View>
  ), [shopName, shopContact, collectionAddress]);

  const renderItemInformation = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📋 Item Details</Text>
      <Text style={styles.stepSubtitle}>
        Tell us what we'll be collecting
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the items to collect (size, quantity, type)"
          placeholderTextColor="#888"
          value={itemsToCollect}
          onChangeText={setItemsToCollect}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Estimated value (KES)"
          placeholderTextColor="#888"
          value={itemValue}
          onChangeText={setItemValue}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.valueNotice}>
        <Feather name="shield" size={16} color="#10b981" />
        <Text style={styles.valueNoticeText}>
          Insurance coverage included based on declared value
        </Text>
      </View>
    </View>
  ), [itemsToCollect, itemValue]);

  const renderDeliverySetup = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🎯 Delivery Details</Text>
      <Text style={styles.stepSubtitle}>
        Where should we deliver your collected items?
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Delivery address, building details, floor, etc."
          placeholderTextColor="#888"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special delivery instructions (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.deliveryInfo}>
        <Feather name="home" size={16} color="#10b981" />
        <Text style={styles.deliveryInfoText}>
          Items will be delivered to your specified address
        </Text>
      </View>
    </View>
  ), [deliveryAddress, specialInstructions]);

  const renderPaymentConfirmation = useCallback(() => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>💳 Payment & Summary</Text>
      <Text style={styles.stepSubtitle}>
        Review your collection request and payment details
      </Text>
      
      <View style={styles.costBreakdown}>
        <Text style={styles.costTitle}>Service Breakdown</Text>
        
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Collection Fee</Text>
          <Text style={styles.costValue}>KES {calculateCosts.collection}</Text>
        </View>
        
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Delivery Fee</Text>
          <Text style={styles.costValue}>KES {calculateCosts.delivery}</Text>
        </View>
        
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Insurance</Text>
          <Text style={styles.costValue}>KES {calculateCosts.insurance}</Text>
        </View>
        
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Service Fee</Text>
          <Text style={styles.costValue}>KES {calculateCosts.service}</Text>
        </View>
        
        <View style={[styles.costItem, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>KES {calculateCosts.total}</Text>
        </View>
      </View>

      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        
        <TouchableOpacity
          style={[styles.paymentOption, paymentMethod === 'mpesa' && styles.paymentSelected]}
          onPress={() => setPaymentMethod('mpesa')}
        >
          <View style={styles.paymentLeft}>
            <View style={[styles.radio, paymentMethod === 'mpesa' && styles.radioSelected]} />
            <Text style={styles.paymentText}>M-Pesa</Text>
          </View>
          <Feather name="smartphone" size={20} color={paymentMethod === 'mpesa' ? '#10b981' : '#666'} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentSelected]}
          onPress={() => setPaymentMethod('card')}
        >
          <View style={styles.paymentLeft}>
            <View style={[styles.radio, paymentMethod === 'card' && styles.radioSelected]} />
            <Text style={styles.paymentText}>Debit/Credit Card</Text>
          </View>
          <Feather name="credit-card" size={20} color={paymentMethod === 'card' ? '#10b981' : '#666'} />
        </TouchableOpacity>
      </View>

      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <Text style={styles.summaryText}>📍 Collection: {shopName}</Text>
        <Text style={styles.summaryText}>📦 Items: {itemsToCollect}</Text>
        <Text style={styles.summaryText}>💰 Value: KES {itemValue}</Text>
        <Text style={styles.summaryText}>🎯 Delivery: {deliveryAddress}</Text>
      </View>
    </View>
  ), [calculateCosts, paymentMethod, shopName, itemsToCollect, itemValue, deliveryAddress]);

  const renderNavigationButtons = useCallback(() => (
    <View style={styles.navigationContainer}>
      {currentStep > 0 && (
        <TouchableOpacity
          style={[styles.navButton, styles.backButton]}
          onPress={prevStep}
          disabled={isSubmitting}
        >
          <Feather name="arrow-left" size={18} color="#10b981" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity
        style={[
          styles.navButton,
          styles.nextButton,
          (!isStepValid(currentStep) || isSubmitting) && styles.disabledButton
        ]}
        onPress={currentStep === STEP_TITLES.length - 1 ? handleSubmit : nextStep}
        disabled={!isStepValid(currentStep) || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#1a1a2e" />
        ) : (
          <>
            <Text style={styles.nextButtonText}>
              {currentStep === STEP_TITLES.length - 1 ? 'Submit Request' : 'Continue'}
            </Text>
            {currentStep < STEP_TITLES.length - 1 && (
              <Feather name="arrow-right" size={18} color="#1a1a2e" />
            )}
          </>
        )}
      </TouchableOpacity>
    </View>
  ), [currentStep, isStepValid, isSubmitting, prevStep, nextStep, handleSubmit]);

  const renderCurrentStep = useMemo(() => {
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
        return renderCollectionDetails();
    }
  }, [currentStep, renderCollectionDetails, renderItemInformation, renderDeliverySetup, renderPaymentConfirmation]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={false}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      <SafeAreaView style={styles.container}>
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
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          >
            {renderHeader()}
            {renderProgressBar()}
            
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.contentContainer}
              keyboardVerticalOffset={0}
            >
              <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={[
                  styles.scrollContentContainer,
                  { paddingBottom: isKeyboardVisible ? 10 : 90 }
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {renderCurrentStep}
              </ScrollView>
              
              {renderNavigationButtons()}
            </KeyboardAvoidingView>
          </LinearGradient>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  gradientBackground: {
    flex: 1,
  },
  
  // FIXED: Header with proper spacing under status bar
  headerContainer: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 60,
  },
  closeButton: {
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
    flex: 1,
  },
  placeholder: {
    width: 40,
  },
  
  // Progress
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 6,
  },
  
  // Content
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    flex: 1,
    minHeight: 300,
    paddingVertical: 20,
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
  
  // Form
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
  
  // Info sections
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
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
    padding: 12,
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
    padding: 12,
    gap: 8,
  },
  deliveryInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },

  // Cost breakdown
  costBreakdown: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  costTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
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
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },

  // Payment section
  paymentSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  paymentSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
  },
  radioSelected: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  paymentText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },

  // Summary section
  summarySection: {
    backgroundColor: 'rgba(26, 26, 46, 0.4)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  summaryText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
    lineHeight: 18,
  },
  
  // FIXED: Navigation buttons with proper positioning
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    gap: 12,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    minHeight: 50,
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  nextButton: {
    backgroundColor: '#10b981',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#666',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
});
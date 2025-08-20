import React, { useState, useEffect, useRef } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // Location states
  const [collectionLocation, setCollectionLocation] = useState<LocationData | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(initialLocation);
  
  // Form states
  const [shopName, setShopName] = useState('');
  const [shopContact, setShopContact] = useState('');
  const [collectionAddress, setCollectionAddress] = useState('');
  const [itemsToCollect, setItemsToCollect] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash' | 'card'>('mpesa');
  
  const STEP_TITLES = [
    'Collection Details',
    'Item Information',
    'Delivery Setup',
    'Payment & Confirmation'
  ];

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

  const selectLocationOnMap = async (type: 'collection' | 'delivery') => {
    // In a real app, this would open a map picker
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
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return shopName.trim().length > 0 && collectionAddress.trim().length > 0 && collectionLocation;
      case 1:
        return itemsToCollect.trim().length > 0 && itemValue.trim().length > 0;
      case 2:
        return deliveryAddress.trim().length > 0 && deliveryLocation;
      case 3:
        return paymentMethod.length > 0;
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

  const calculateCosts = () => {
    const collectionFee = 200;
    const deliveryFee = 250;
    const itemValueNum = parseFloat(itemValue) || 0;
    const insuranceFee = Math.max(50, itemValueNum * 0.02); // 2% or minimum 50
    const serviceFee = 100;
    
    return {
      collection: collectionFee,
      delivery: deliveryFee,
      insurance: Math.round(insuranceFee),
      service: serviceFee,
      total: collectionFee + deliveryFee + Math.round(insuranceFee) + serviceFee
    };
  };

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    try {
      const packageData: PackageData = {
        receiver_name: 'Self', // Collecting for self
        receiver_phone: '+254700000000', // Would come from user context
        pickup_location: `${shopName} - ${collectionAddress}`,
        delivery_location: deliveryAddress,
        delivery_type: 'doorstep',
        package_description: `COLLECT & DELIVER: ${itemsToCollect}\nValue: KES ${itemValue}\nSpecial Instructions: ${specialInstructions}`,
        coordinates: {
          pickup: collectionLocation!,
          delivery: deliveryLocation!
        },
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

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>🛍️ Collection Point on Map</Text>
        <TouchableOpacity 
          style={[styles.locationInput, collectionLocation && styles.locationInputSelected]}
          onPress={() => selectLocationOnMap('collection')}
        >
          <Text style={[styles.locationText, collectionLocation && styles.locationTextSelected]}>
            {collectionLocation?.address || 'Tap to set collection point on map'}
          </Text>
          <Feather name="map-pin" size={20} color={collectionLocation ? "#10b981" : "#666"} />
        </TouchableOpacity>
      </View>

      <View style={styles.serviceInfo}>
        <Feather name="info" size={16} color="#10b981" />
        <Text style={styles.serviceInfoText}>
          We'll go to the shop, collect your items, and deliver them to you
        </Text>
      </View>
    </View>
  );

  const renderItemInformation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📝 What to Collect</Text>
      <Text style={styles.stepSubtitle}>
        Tell us about the items you want us to collect
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the items to collect (e.g., 2x shoes size 42, 1x jacket XL)"
          placeholderTextColor="#888"
          value={itemsToCollect}
          onChangeText={setItemsToCollect}
          multiline
          numberOfLines={4}
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
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special instructions for collection (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.valueNotice}>
        <Feather name="shield" size={16} color="#10b981" />
        <Text style={styles.valueNoticeText}>
          Insurance coverage is automatically calculated based on item value
        </Text>
      </View>
    </View>
  );

  const renderDeliverySetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🏠 Delivery to You</Text>
      <Text style={styles.stepSubtitle}>
        Where should we deliver your collected items?
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Your delivery address, building details, floor, etc."
          placeholderTextColor="#888"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>🎯 Delivery Location on Map</Text>
        <TouchableOpacity 
          style={[styles.locationInput, deliveryLocation && styles.locationInputSelected]}
          onPress={() => selectLocationOnMap('delivery')}
        >
          <Text style={[styles.locationText, deliveryLocation && styles.locationTextSelected]}>
            {deliveryLocation?.address || 'Tap to set delivery location on map'}
          </Text>
          <Feather name="map-pin" size={20} color={deliveryLocation ? "#10b981" : "#666"} />
        </TouchableOpacity>
      </View>

      <View style={styles.deliveryInfo}>
        <Feather name="clock" size={16} color="#10b981" />
        <Text style={styles.deliveryInfoText}>
          Typical collection and delivery time: 2-4 hours depending on location
        </Text>
      </View>
    </View>
  );

  const renderPaymentConfirmation = () => {
    const costs = calculateCosts();
    
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>💳 Payment & Confirmation</Text>
        <Text style={styles.stepSubtitle}>
          Review costs and select payment method
        </Text>
        
        <ScrollView style={styles.confirmationContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>📋 Service Summary</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Collection from:</Text>
              <Text style={styles.summaryValue}>{shopName}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Items:</Text>
              <Text style={styles.summaryValue}>{itemsToCollect}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Delivery to:</Text>
              <Text style={styles.summaryValue}>{deliveryAddress}</Text>
            </View>
          </View>

          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>💰 Cost Breakdown</Text>
            <View style={styles.costBreakdown}>
              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Collection Fee</Text>
                <Text style={styles.costValue}>KES {costs.collection}</Text>
              </View>
              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Delivery Fee</Text>
                <Text style={styles.costValue}>KES {costs.delivery}</Text>
              </View>
              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Insurance Coverage</Text>
                <Text style={styles.costValue}>KES {costs.insurance}</Text>
              </View>
              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Service Fee</Text>
                <Text style={styles.costValue}>KES {costs.service}</Text>
              </View>
              <View style={[styles.costLine, styles.totalCostLine]}>
                <Text style={styles.totalCostLabel}>Total Amount</Text>
                <Text style={styles.totalCostValue}>KES {costs.total.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>💳 Payment Method</Text>
            <View style={styles.paymentMethods}>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'mpesa' && styles.selectedPaymentOption]}
                onPress={() => setPaymentMethod('mpesa')}
              >
                <View style={styles.paymentOptionContent}>
                  <Feather name="smartphone" size={20} color="#10b981" />
                  <Text style={styles.paymentOptionText}>M-Pesa</Text>
                  {paymentMethod === 'mpesa' && (
                    <Feather name="check-circle" size={20} color="#10b981" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'card' && styles.selectedPaymentOption]}
                onPress={() => setPaymentMethod('card')}
              >
                <View style={styles.paymentOptionContent}>
                  <Feather name="credit-card" size={20} color="#10b981" />
                  <Text style={styles.paymentOptionText}>Card Payment</Text>
                  {paymentMethod === 'card' && (
                    <Feather name="check-circle" size={20} color="#10b981" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'cash' && styles.selectedPaymentOption]}
                onPress={() => setPaymentMethod('cash')}
              >
                <View style={styles.paymentOptionContent}>
                  <Feather name="dollar-sign" size={20} color="#10b981" />
                  <Text style={styles.paymentOptionText}>Cash on Collection</Text>
                  {paymentMethod === 'cash' && (
                    <Feather name="check-circle" size={20} color="#10b981" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.confirmationSection}>
            <Text style={styles.confirmationSectionTitle}>ℹ️ Important Notes</Text>
            <View style={styles.notesList}>
              <Text style={styles.noteItem}>• Payment must be made in advance</Text>
              <Text style={styles.noteItem}>• You'll receive real-time updates via SMS</Text>
              <Text style={styles.noteItem}>• Our rider will verify items before collection</Text>
              <Text style={styles.noteItem}>• Insurance covers loss or damage during transit</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderCollectionDetails();
      case 1: return renderItemInformation();
      case 2: return renderDeliverySetup();
      case 3: return renderPaymentConfirmation();
      default: return renderCollectionDetails();
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
          <Feather name="arrow-right" size={20} color={isStepValid(currentStep) ? "#fff" : "#666"} />
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
                Confirm & Pay
              </Text>
              <Feather name="check" size={20} color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#666"} />
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
                { transform: [{ translateY: slideAnim }] }
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
    height: SCREEN_HEIGHT * 0.90,
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
  
  // Progress
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
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stepContent: {
    flex: 1,
    minHeight: 300,
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
    paddingVertical: 8,
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
  
  // Location section
  locationSection: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  locationInputSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#888',
  },
  locationTextSelected: {
    color: '#fff',
  },
  
  // Service info
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  serviceInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  
  // Value notice
  valueNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  valueNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  
  // Delivery info
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  deliveryInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 18,
  },
  
  // Confirmation
  confirmationContainer: {
    flex: 1,
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  confirmationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 10,
  },
  
  // Summary
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#888',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
    flex: 2,
    textAlign: 'right',
  },
  
  // Cost breakdown
  costBreakdown: {
    gap: 8,
  },
  costLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: '#888',
  },
  costValue: {
    fontSize: 14,
    color: '#fff',
  },
  totalCostLine: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    marginTop: 4,
  },
  totalCostLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalCostValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  
  // Payment methods
  paymentMethods: {
    gap: 12,
  },
  paymentOption: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  selectedPaymentOption: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  paymentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  paymentOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  
  // Notes
  notesList: {
    gap: 6,
  },
  noteItem: {
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  
  // Navigation
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
    backgroundColor: '#10b981',
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
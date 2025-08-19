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

interface FragileDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: LocationData | null;
}

export default function FragileDeliveryModal({
  visible,
  onClose,
  onSubmit,
  currentLocation: initialLocation
}: FragileDeliveryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  // Location states
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(initialLocation);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Form states
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  const STEP_TITLES = [
    'Location Setup',
    'Receiver Details', 
    'Package Information',
    'Confirm Fragile Delivery'
  ];

  useEffect(() => {
    if (visible) {
      resetForm();
      requestLocationPermission();
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const resetForm = () => {
    setCurrentStep(0);
    setPickupLocation(initialLocation);
    setDeliveryLocation(null);
    setReceiverName('');
    setReceiverPhone('');
    setDeliveryAddress('');
    setItemDescription('');
    setSpecialInstructions('');
    setIsSubmitting(false);
    setLocationError(null);
  };

  const requestLocationPermission = async () => {
    try {
      setIsLocationLoading(true);
      setLocationError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location permission is required for fragile delivery');
        return;
      }

      // Get current location if not provided
      if (!pickupLocation) {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        setPickupLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Current Location'
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Failed to get current location. Please enable location services.');
    } finally {
      setIsLocationLoading(false);
    }
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

  const selectLocationOnMap = async (type: 'pickup' | 'delivery') => {
    // In a real app, this would open a map picker
    // For now, we'll simulate location selection
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
              
              if (type === 'pickup') {
                setPickupLocation(locationData);
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
        return pickupLocation && deliveryLocation;
      case 1:
        return receiverName.trim().length > 0 && receiverPhone.trim().length > 0;
      case 2:
        return itemDescription.trim().length > 0 && deliveryAddress.trim().length > 0;
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

  const calculateEstimatedCost = () => {
    // Enhanced pricing for fragile delivery
    const baseCost = 580; // Premium fragile delivery base rate
    const specialHandlingSurcharge = 120;
    const urgentDeliveryFee = 80;
    return baseCost + specialHandlingSurcharge + urgentDeliveryFee;
  };

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    try {
      const packageData: PackageData = {
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        pickup_location: pickupLocation?.address || 'Unknown Pickup Location',
        delivery_location: `${deliveryAddress}\n\nSpecial Instructions: ${specialInstructions}`,
        delivery_type: 'fragile',
        package_description: `FRAGILE ITEM: ${itemDescription}`,
        coordinates: {
          pickup: pickupLocation!,
          delivery: deliveryLocation!
        }
      };

      await onSubmit(packageData);
      closeModal();
    } catch (error) {
      console.error('Error submitting fragile delivery:', error);
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

  const renderLocationSetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>⚠️ Fragile Delivery Setup</Text>
      <Text style={styles.stepSubtitle}>
        Set your pickup and delivery locations for fragile items
      </Text>
      
      {locationError && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity onPress={requestLocationPermission}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isLocationLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#ff6b6b" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}
      
      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>📍 Pickup Location</Text>
        <TouchableOpacity 
          style={[styles.locationInput, pickupLocation && styles.locationInputSelected]}
          onPress={() => selectLocationOnMap('pickup')}
        >
          <Text style={[styles.locationText, pickupLocation && styles.locationTextSelected]}>
            {pickupLocation?.address || 'Tap to set pickup location'}
          </Text>
          <Feather name="map-pin" size={20} color={pickupLocation ? "#ff6b6b" : "#666"} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>🎯 Delivery Location</Text>
        <TouchableOpacity 
          style={[styles.locationInput, deliveryLocation && styles.locationInputSelected]}
          onPress={() => selectLocationOnMap('delivery')}
        >
          <Text style={[styles.locationText, deliveryLocation && styles.locationTextSelected]}>
            {deliveryLocation?.address || 'Tap to set delivery location'}
          </Text>
          <Feather name="map-pin" size={20} color={deliveryLocation ? "#ff6b6b" : "#666"} />
        </TouchableOpacity>
      </View>

      <View style={styles.fragileInfo}>
        <Feather name="alert-triangle" size={20} color="#ff6b6b" />
        <View style={styles.fragileInfoText}>
          <Text style={styles.fragileInfoTitle}>Special Handling Included</Text>
          <Text style={styles.fragileInfoDescription}>
            Your fragile items will receive priority handling with extra care during transport
          </Text>
        </View>
      </View>
    </View>
  );

  const renderReceiverDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Receiver Information</Text>
      <Text style={styles.stepSubtitle}>Who will receive this fragile delivery?</Text>
      
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
          placeholder="Receiver's Phone (+254...)"
          placeholderTextColor="#888"
          value={receiverPhone}
          onChangeText={setReceiverPhone}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderPackageInformation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Package Details</Text>
      <Text style={styles.stepSubtitle}>
        Provide details about your fragile items and delivery requirements
      </Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Describe the fragile item(s)"
          placeholderTextColor="#888"
          value={itemDescription}
          onChangeText={setItemDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Delivery address, building details, floor, etc."
          placeholderTextColor="#888"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special handling instructions (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.fragileNotice}>
        <Feather name="info" size={16} color="#ff6b6b" />
        <Text style={styles.fragileNoticeText}>
          Our riders are specially trained to handle fragile items with maximum care
        </Text>
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Fragile Delivery</Text>
      <Text style={styles.stepSubtitle}>Review all details before scheduling</Text>
      
      <ScrollView style={styles.confirmationContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>🚚 Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeAddress}>{pickupLocation?.address}</Text>
            </View>
            <Feather name="arrow-right" size={20} color="#ff6b6b" />
            <View style={styles.routePoint}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routeAddress}>{deliveryLocation?.address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>👤 Receiver</Text>
          <Text style={styles.confirmationDetail}>{receiverName}</Text>
          <Text style={styles.confirmationDetail}>{receiverPhone}</Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>📦 Package Details</Text>
          <Text style={styles.confirmationDetail}>Item: {itemDescription}</Text>
          <Text style={styles.confirmationSubDetail}>Address: {deliveryAddress}</Text>
          {specialInstructions && (
            <Text style={styles.confirmationSubDetail}>
              Special Instructions: {specialInstructions}
            </Text>
          )}
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>⚠️ Fragile Service</Text>
          <View style={styles.serviceFeatures}>
            <View style={styles.serviceFeature}>
              <Feather name="shield" size={16} color="#ff6b6b" />
              <Text style={styles.serviceFeatureText}>Special handling care</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="clock" size={16} color="#ff6b6b" />
              <Text style={styles.serviceFeatureText}>Priority delivery</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="phone" size={16} color="#ff6b6b" />
              <Text style={styles.serviceFeatureText}>Real-time updates</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>💰 Cost Breakdown</Text>
          <View style={styles.costBreakdown}>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Base Delivery</Text>
              <Text style={styles.costValue}>KES 580</Text>
            </View>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Special Handling</Text>
              <Text style={styles.costValue}>KES 120</Text>
            </View>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Priority Service</Text>
              <Text style={styles.costValue}>KES 80</Text>
            </View>
            <View style={[styles.costLine, styles.totalCostLine]}>
              <Text style={styles.totalCostLabel}>Total</Text>
              <Text style={styles.totalCostValue}>KES {calculateEstimatedCost().toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderLocationSetup();
      case 1: return renderReceiverDetails();
      case 2: return renderPackageInformation();
      case 3: return renderConfirmation();
      default: return renderLocationSetup();
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
                Schedule Fragile Delivery
              </Text>
              <Feather name="alert-triangle" size={20} color={isStepValid(currentStep) && !isSubmitting ? "#fff" : "#666"} />
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
  
  // Header
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
    backgroundColor: '#ff6b6b',
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
  
  // Error/Loading banners
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
  },
  retryText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#ff6b6b',
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
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  locationInputSelected: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#888',
  },
  locationTextSelected: {
    color: '#fff',
  },
  
  // Fragile info
  fragileInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    gap: 12,
  },
  fragileInfoText: {
    flex: 1,
  },
  fragileInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b6b',
    marginBottom: 4,
  },
  fragileInfoDescription: {
    fontSize: 14,
    color: '#ff6b6b',
    lineHeight: 18,
  },
  
  // Form
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
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  
  // Fragile notice
  fragileNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  fragileNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#ff6b6b',
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
    color: '#ff6b6b',
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
  
  // Route display
  routeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routePoint: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  
  // Service features
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
    color: '#fff',
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
    color: '#ff6b6b',
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
    backgroundColor: '#ff6b6b',
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
    backgroundColor: '#ff6b6b',
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
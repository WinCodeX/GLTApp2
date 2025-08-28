// components/FragileDeliveryModal.tsx - FIXED: Proper keyboard handling to prevent status bar overlap

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
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { type PackageData } from '../lib/helpers/packageHelpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

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
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: LocationData | null;
}

// Location Picker Modal Component
const LocationPickerModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  title: string;
  currentLocation?: LocationData | null;
}> = ({ visible, onClose, onLocationSelect, title, currentLocation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(currentLocation);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Mock search results - in real app, this would geocode the query
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockResults: LocationData[] = [
        { latitude: -1.2921, longitude: 36.8219, name: 'Nairobi CBD', address: 'City Square, Nairobi', description: 'Central business district' },
        { latitude: -1.2764, longitude: 36.8044, name: 'Westlands', address: 'Westlands Avenue, Nairobi', description: 'Shopping and business area' },
        { latitude: -1.2634, longitude: 36.8081, name: 'Karen', address: 'Karen Road, Nairobi', description: 'Residential suburb' },
      ].filter(location => 
        location.name.toLowerCase().includes(query.toLowerCase()) ||
        location.address.toLowerCase().includes(query.toLowerCase())
      );
      
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationTap = (location: LocationData) => {
    setSelectedLocation(location);
    onLocationSelect(location);
    closeModal();
  };

  const useCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      const currentLoc: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address[0] ? 
          `${address[0].street}, ${address[0].city}` : 'Current Location',
        name: 'Current Location',
        description: 'Your current position'
      };

      onLocationSelect(currentLoc);
      closeModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  const renderLocationItem = ({ item }: { item: LocationData }) => (
    <TouchableOpacity
      style={[
        styles.locationItem,
        selectedLocation?.latitude === item.latitude && 
        selectedLocation?.longitude === item.longitude && styles.selectedLocationItem
      ]}
      onPress={() => handleLocationTap(item)}
    >
      <View style={styles.locationIcon}>
        <Feather name="map-pin" size={20} color="#f97316" />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{item.name}</Text>
        <Text style={styles.locationAddress}>{item.address}</Text>
        <Text style={styles.locationDescription}>{item.description}</Text>
      </View>
      {selectedLocation?.latitude === item.latitude && 
       selectedLocation?.longitude === item.longitude && (
        <Feather name="check-circle" size={20} color="#f97316" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.mapModalSafeArea}>
        <Animated.View
          style={[
            styles.mapModalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Map Area (Simulated) */}
          <View style={styles.mapContainer}>
            <LinearGradient
              colors={['#1a1a2e', '#2d3748', '#4a5568']}
              style={styles.mapGradient}
            >
              {/* Map Header */}
              <View style={styles.mapHeader}>
                <TouchableOpacity onPress={closeModal} style={styles.mapCloseButton}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.mapHeaderTitle}>{title}</Text>
                <TouchableOpacity onPress={useCurrentLocation} style={styles.currentLocationButton}>
                  <Feather name="target" size={20} color="#f97316" />
                </TouchableOpacity>
              </View>
              
              {/* Search */}
              <View style={styles.mapSearchContainer}>
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search for a location..."
                  placeholderTextColor="#888"
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
                {isSearching && <ActivityIndicator size="small" color="#f97316" />}
              </View>

              <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                {searchResults.length > 0 ? (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
                    renderItem={renderLocationItem}
                    scrollEnabled={false}
                  />
                ) : (
                  <View style={styles.noResults}>
                    <Feather name="map-pin" size={48} color="#666" />
                    <Text style={styles.noResultsText}>No locations found</Text>
                    <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

export default function FragileDeliveryModal({
  visible,
  onClose,
  onSubmit,
  currentLocation: initialLocation
}: FragileDeliveryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
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
  
  // Map modal states
  const [showPickupMapModal, setShowPickupMapModal] = useState(false);
  const [showDeliveryMapModal, setShowDeliveryMapModal] = useState(false);
  
  const STEP_TITLES = [
    'Location Setup',
    'Receiver Details', 
    'Package Information',
    'Confirm Fragile Delivery'
  ];

  // ✅ FIXED: Improved keyboard handling
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

  // ✅ FIXED: Better modal height calculation to avoid status bar overlap
  const modalHeight = useMemo(() => {
    if (isKeyboardVisible) {
      // Calculate available space above keyboard
      const availableHeight = SCREEN_HEIGHT - keyboardHeight;
      // Leave space for status bar and some padding
      const maxModalHeight = availableHeight - STATUS_BAR_HEIGHT - 20;
      // Use 85% of available space or calculated max, whichever is smaller
      return Math.min(maxModalHeight, availableHeight * 0.85);
    }
    // When keyboard is hidden, use 90% of screen height
    return SCREEN_HEIGHT * 0.90;
  }, [isKeyboardVisible, keyboardHeight]);

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

  // ✅ FIXED: Better modal close handling
  const closeModal = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [slideAnim, onClose]);

  const requestLocationPermission = async () => {
    try {
      setIsLocationLoading(true);
      setLocationError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable location services.');
        return;
      }
      
      if (!pickupLocation) {
        const location = await Location.getCurrentPositionAsync({});
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
      setLocationError('Failed to get current location');
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handlePickupLocationSelect = (location: LocationData) => {
    setPickupLocation(location);
  };

  const handleDeliveryLocationSelect = (location: LocationData) => {
    setDeliveryLocation(location);
  };

  const isStepValid = useCallback((step: number) => {
    switch (step) {
      case 0:
        return pickupLocation !== null && deliveryLocation !== null;
      case 1:
        return receiverName.trim().length > 0 && receiverPhone.trim().length > 0;
      case 2:
        return deliveryAddress.trim().length > 0 && itemDescription.trim().length > 0;
      case 3:
        return true; // Confirmation step is always valid if we reached it
      default:
        return false;
    }
  }, [pickupLocation, deliveryLocation, receiverName, receiverPhone, deliveryAddress, itemDescription]);

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

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) return;

    setIsSubmitting(true);
    try {
      const packageData: PackageData = {
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        pickup_location: pickupLocation?.address || '',
        delivery_location: deliveryAddress,
        delivery_type: 'fragile',
        package_description: `FRAGILE DELIVERY: ${itemDescription}${specialInstructions ? `\nSpecial Instructions: ${specialInstructions}` : ''}`,
        coordinates: pickupLocation && deliveryLocation ? {
          pickup: pickupLocation,
          delivery: deliveryLocation
        } : undefined,
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
          <Feather name="alert-circle" size={16} color="#ea580c" />
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity onPress={requestLocationPermission}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isLocationLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#f97316" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}
      
      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>📍 Pickup Location</Text>
        <TouchableOpacity 
          style={[styles.locationInput, pickupLocation && styles.locationInputSelected]}
          onPress={() => setShowPickupMapModal(true)}
        >
          <Text style={[styles.locationText, pickupLocation && styles.locationTextSelected]}>
            {pickupLocation?.address || 'Tap to select pickup location'}
          </Text>
          <Feather name="map" size={20} color={pickupLocation ? "#f97316" : "#666"} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>🎯 Delivery Location</Text>
        <TouchableOpacity 
          style={[styles.locationInput, deliveryLocation && styles.locationInputSelected]}
          onPress={() => setShowDeliveryMapModal(true)}
        >
          <Text style={[styles.locationText, deliveryLocation && styles.locationTextSelected]}>
            {deliveryLocation?.address || 'Tap to select delivery location'}
          </Text>
          <Feather name="map" size={20} color={deliveryLocation ? "#f97316" : "#666"} />
        </TouchableOpacity>
      </View>

      <View style={styles.fragileInfo}>
        <Feather name="alert-triangle" size={20} color="#f97316" />
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
          returnKeyType="next"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Receiver's Phone (+254...)"
          placeholderTextColor="#888"
          value={receiverPhone}
          onChangeText={setReceiverPhone}
          keyboardType="phone-pad"
          returnKeyType="next"
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
          style={[styles.input, styles.textArea]}
          placeholder="Describe the fragile item(s)"
          placeholderTextColor="#888"
          value={itemDescription}
          onChangeText={setItemDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="next"
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
          returnKeyType="next"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special instructions for fragile handling (optional)"
          placeholderTextColor="#888"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="done"
        />
      </View>

      <View style={styles.fragileNotice}>
        <Feather name="info" size={16} color="#f97316" />
        <Text style={styles.fragileNoticeText}>
          All fragile items are handled with extra care and receive priority processing
        </Text>
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🎯 Confirm Fragile Delivery</Text>
      <Text style={styles.stepSubtitle}>
        Please review your fragile delivery details
      </Text>
      
      <ScrollView style={styles.confirmationContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>🗺️ Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeAddress}>{pickupLocation?.address}</Text>
            </View>
            <View style={styles.routeArrow}>
              <Feather name="arrow-right" size={20} color="#f97316" />
            </View>
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
              <Feather name="shield" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Special handling care</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="clock" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Priority delivery</Text>
            </View>
            <View style={styles.serviceFeature}>
              <Feather name="phone" size={16} color="#f97316" />
              <Text style={styles.serviceFeatureText}>Real-time updates</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>💰 Cost Breakdown</Text>
          <View style={styles.costBreakdown}>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Fragile Service Fee</Text>
              <Text style={styles.costValue}>KES 500</Text>
            </View>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Priority Handling</Text>
              <Text style={styles.costValue}>KES 300</Text>
            </View>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>Insurance</Text>
              <Text style={styles.costValue}>KES 200</Text>
            </View>
            <View style={[styles.costLine, styles.totalCostLine]}>
              <Text style={styles.totalCostLabel}>Total Amount</Text>
              <Text style={styles.totalCostValue}>KES 1,000</Text>
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
    <>
      <Modal visible={visible} transparent animationType="none">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        {/* ✅ FIXED: Better SafeAreaView handling to prevent status bar overlap */}
        <View style={styles.modalWrapper}>
          <KeyboardAvoidingView 
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
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
                  
                  {/* ✅ FIXED: Better content container with proper padding */}
                  <View style={styles.contentWrapper}>
                    <ScrollView 
                      style={styles.contentContainer}
                      contentContainerStyle={[
                        styles.scrollContentContainer,
                        // ✅ FIXED: Add extra bottom padding when keyboard is visible
                        isKeyboardVisible && styles.keyboardVisiblePadding
                      ]}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      keyboardDismissMode="interactive"
                    >
                      {renderCurrentStep()}
                    </ScrollView>
                  </View>
                  
                  {renderNavigationButtons()}
                </LinearGradient>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Location Picker Modals */}
      <LocationPickerModal
        visible={showPickupMapModal}
        onClose={() => setShowPickupMapModal(false)}
        onLocationSelect={handlePickupLocationSelect}
        title="Select Pickup Location"
        currentLocation={pickupLocation}
      />
      
      <LocationPickerModal
        visible={showDeliveryMapModal}
        onClose={() => setShowDeliveryMapModal(false)}
        onLocationSelect={handleDeliveryLocationSelect}
        title="Select Delivery Location"
        currentLocation={deliveryLocation}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // ✅ FIXED: Better modal wrapper to handle status bar properly
  modalWrapper: {
    flex: 1,
    paddingTop: STATUS_BAR_HEIGHT, // Ensure we don't overlap status bar
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
    maxHeight: SCREEN_HEIGHT - STATUS_BAR_HEIGHT - 20, // ✅ FIXED: Respect status bar
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  
  // ✅ FIXED: Better header padding
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15, // ✅ FIXED: Consistent padding regardless of platform
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
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 6,
  },
  
  // ✅ FIXED: Better content structure
  contentWrapper: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20, // ✅ FIXED: Better base padding
  },
  // ✅ FIXED: Extra padding when keyboard is visible
  keyboardVisiblePadding: {
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
    minHeight: 200, // ✅ FIXED: Reduced minimum height
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
    backgroundColor: 'rgba(234, 88, 12, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ea580c',
  },
  retryText: {
    fontSize: 14,
    color: '#ea580c',
    fontWeight: '600',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#f97316',
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
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  locationInputSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
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
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
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
    color: '#f97316',
    marginBottom: 4,
  },
  fragileInfoDescription: {
    fontSize: 14,
    color: '#f97316',
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
    borderColor: 'rgba(249, 115, 22, 0.3)',
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
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  fragileNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#f97316',
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
    color: '#f97316',
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
  routeArrow: {
    paddingHorizontal: 10,
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
    color: '#f97316',
  },
  
  // ✅ FIXED: Better navigation container
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1a1a2e', // ✅ FIXED: Ensure background color
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
    backgroundColor: '#f97316',
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
    backgroundColor: '#f97316',
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

  // MAP MODAL STYLES - ✅ FIXED: Better positioning
  mapModalSafeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: STATUS_BAR_HEIGHT,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  mapContainer: {
    flex: 1,
  },
  mapGradient: {
    flex: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  mapCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  currentLocationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSearchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  mapSearchInput: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 18,
    color: '#888',
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  selectedLocationItem: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  locationDescription: {
    fontSize: 12,
    color: '#666',
  },
});
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
  FlatList,
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
  name?: string;
  description?: string;
}

interface FragileDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
  currentLocation: LocationData | null;
}

// Sample locations for demo (would come from a places API in real app)
const SAMPLE_LOCATIONS: LocationData[] = [
  {
    latitude: -1.2921,
    longitude: 36.8219,
    address: "Tom Mboya Street, Nairobi",
    name: "Tom Mboya Street",
    description: "Central Business District"
  },
  {
    latitude: -1.2833,
    longitude: 36.8167,
    address: "Kenyatta Avenue, Nairobi",
    name: "Kenyatta Avenue",
    description: "City Center"
  },
  {
    latitude: -1.2902,
    longitude: 36.8236,
    address: "Moi Avenue, Nairobi",
    name: "Moi Avenue",
    description: "Downtown"
  },
  {
    latitude: -1.3028,
    longitude: 36.7750,
    address: "Westlands, Nairobi",
    name: "Westlands",
    description: "Business District"
  },
  {
    latitude: -1.2631,
    longitude: 36.8056,
    address: "Upperhill, Nairobi",
    name: "Upperhill",
    description: "Financial District"
  }
];

// Map Picker Modal Component
const LocationPickerModal = ({ 
  visible, 
  onClose, 
  onLocationSelect, 
  title = "Select Location",
  currentLocation 
}: {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  title?: string;
  currentLocation?: LocationData | null;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setSearchResults(SAMPLE_LOCATIONS);
    }
  }, [visible]);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      setSearchQuery('');
      setSelectedLocation(null);
      setSearchResults([]);
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    
    // Simulate search delay
    setTimeout(() => {
      if (query.trim() === '') {
        setSearchResults(SAMPLE_LOCATIONS);
      } else {
        const filtered = SAMPLE_LOCATIONS.filter(location =>
          location.name?.toLowerCase().includes(query.toLowerCase()) ||
          location.address?.toLowerCase().includes(query.toLowerCase()) ||
          location.description?.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
      }
      setIsSearching(false);
    }, 300);
  };

  const handleLocationTap = (location: LocationData) => {
    setSelectedLocation(location);
  };

  const confirmLocation = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
      closeModal();
    }
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const currentLoc: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Current Location',
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
        <Feather name="map-pin" size={20} color="#ff6b6b" />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{item.name}</Text>
        <Text style={styles.locationAddress}>{item.address}</Text>
        <Text style={styles.locationDescription}>{item.description}</Text>
      </View>
      {selectedLocation?.latitude === item.latitude && 
       selectedLocation?.longitude === item.longitude && (
        <Feather name="check-circle" size={20} color="#ff6b6b" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <StatusBar barStyle="light-content" />
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
                  <Feather name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.mapTitle}>{title}</Text>
                <TouchableOpacity onPress={useCurrentLocation} style={styles.currentLocationButton}>
                  <Feather name="crosshair" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Simulated Map Content */}
              <View style={styles.mapContent}>
                <View style={styles.mapGrid}>
                  {/* Grid lines to simulate map */}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <View key={`h-${i}`} style={[styles.gridLine, styles.horizontalLine, { top: `${i * 12.5}%` }]} />
                  ))}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={`v-${i}`} style={[styles.gridLine, styles.verticalLine, { left: `${i * 16.67}%` }]} />
                  ))}
                </View>

                {/* Sample location pins */}
                <View style={[styles.mapPin, { top: '20%', left: '30%' }]}>
                  <View style={styles.mapPinInner}>
                    <Text style={styles.mapPinText}>H</Text>
                  </View>
                  <Text style={styles.mapPinLabel}>MP Shah Hospital</Text>
                </View>

                <View style={[styles.mapPin, { top: '40%', left: '60%' }]}>
                  <View style={[styles.mapPinInner, { backgroundColor: '#8b5cf6' }]}>
                    <Text style={styles.mapPinText}>M</Text>
                  </View>
                  <Text style={styles.mapPinLabel}>Museum</Text>
                </View>

                <View style={[styles.mapPin, { top: '60%', left: '25%' }]}>
                  <View style={[styles.mapPinInner, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.mapPinText}>📍</Text>
                  </View>
                  <Text style={styles.mapPinLabel}>Selected</Text>
                </View>

                {/* Road lines */}
                <View style={[styles.roadLine, { top: '35%', left: '10%', width: '80%', transform: [{ rotate: '15deg' }] }]} />
                <View style={[styles.roadLine, { top: '55%', left: '5%', width: '90%', transform: [{ rotate: '-10deg' }] }]} />
                <View style={[styles.roadLine, { top: '25%', left: '40%', height: '50%', width: 3 }]} />
              </View>

              {/* Location confirmation overlay */}
              {selectedLocation && (
                <View style={styles.locationConfirmOverlay}>
                  <View style={styles.locationConfirmCard}>
                    <Text style={styles.locationConfirmName}>{selectedLocation.name}</Text>
                    <Text style={styles.locationConfirmAddress}>{selectedLocation.address}</Text>
                    <TouchableOpacity 
                      style={styles.confirmLocationButton}
                      onPress={confirmLocation}
                    >
                      <Text style={styles.confirmLocationButtonText}>Confirm Location</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Search Bottom Sheet */}
          <View style={styles.searchBottomSheet}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={20} color="#888" />
              <TextInput
                style={styles.mapSearchInput}
                placeholder="Where to?"
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={handleSearch}
              />
              {isSearching && <ActivityIndicator size="small" color="#ff6b6b" />}
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
          address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Current Location',
          name: 'Current Location'
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

  const handlePickupLocationSelect = (location: LocationData) => {
    setPickupLocation(location);
  };

  const handleDeliveryLocationSelect = (location: LocationData) => {
    setDeliveryLocation(location);
    // Auto-fill delivery address if available
    if (location.address) {
      setDeliveryAddress(location.address);
    }
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
    const baseCost = 580;
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
          onPress={() => setShowPickupMapModal(true)}
        >
          <Text style={[styles.locationText, pickupLocation && styles.locationTextSelected]}>
            {pickupLocation?.address || 'Tap to select pickup location'}
          </Text>
          <Feather name="map" size={20} color={pickupLocation ? "#ff6b6b" : "#666"} />
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
          <Feather name="map" size={20} color={deliveryLocation ? "#ff6b6b" : "#666"} />
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
    <>
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

  // MAP MODAL STYLES
  mapModalSafeArea: {
    flex: 1,
    backgroundColor: 'transparent',
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
  },
  mapCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  currentLocationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContent: {
    flex: 1,
    position: 'relative',
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  horizontalLine: {
    left: 0,
    right: 0,
    height: 1,
  },
  verticalLine: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  mapPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  mapPinInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapPinText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  mapPinLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roadLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    height: 2,
  },
  locationConfirmOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    padding: 20,
  },
  locationConfirmCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  locationConfirmName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  locationConfirmAddress: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  confirmLocationButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  searchBottomSheet: {
    backgroundColor: 'rgba(26, 26, 46, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 4,
  },
  searchResults: {
    flex: 1,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedLocationItem: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    color: '#ccc',
    marginBottom: 2,
  },
  locationDescription: {
    fontSize: 12,
    color: '#888',
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});
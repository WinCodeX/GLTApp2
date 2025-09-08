import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Animated,
  ScrollView,
  Dimensions,
  Easing,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import GLTHeader from '../../components/GLTHeader';
import PackageCreationModal from '../../components/PackageCreationModal';
import FragileDeliveryModal from '../../components/FragileDeliveryModal';
import CollectDeliverModal from '../../components/CollectDeliverModal';
import { createPackage, type PackageData, getPackageFormData, calculatePackagePricing } from '../../lib/helpers/packageHelpers';
import { useUser } from '../../context/UserContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Location {
  id: string;
  name: string;
  initials?: string;
}

interface Area {
  id: string;
  name: string;
  location_id?: string;
  location?: Location;
}

interface PackageSize {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface PricingResult {
  fragile: number;
  home: number;
  office: number;
  collection: number;
}

interface FABOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  backgroundColor: string;
  glowColor: string;
  action: () => void;
  infoAction: () => void;
}

interface DeliveryInfo {
  title: string;
  description: string;
}

interface PackageSizeInfo {
  title: string;
  description: string;
  deliveryOptions: string[];
}

interface SuccessModalData {
  title: string;
  message: string;
  trackingNumber: string;
  status: string;
  color: string;
  icon: string;
}

const PACKAGE_SIZES: PackageSize[] = [
  {
    id: 'small',
    name: 'Small Package',
    description: 'Documents, accessories, small items',
    icon: 'package'
  },
  {
    id: 'medium',
    name: 'Medium Package',
    description: 'Books, clothes, electronics',
    icon: 'box'
  },
  {
    id: 'large',
    name: 'Large Package',
    description: 'Bulky items, furniture parts',
    icon: 'truck'
  }
];

const DELIVERY_INFO: Record<string, DeliveryInfo> = {
  fragile: {
    title: 'Fragile Items',
    description: 'We have a dedicated delivery service for items that require extra care which will be prioritised & sent out immediately. Please select your current location and the rider will come collect the package and send it to where it\'s supposed to go.'
  },
  send: {
    title: 'Send a Package',
    description: 'There are 2 options - Home and Office. The Home option will have the item delivered right to their location while the Office option will be delivered to our office for the receiver to collect.'
  },
  collect: {
    title: 'Collect my Packages',
    description: 'This is where we collect your packages after you\'ve made an order and then dispatch it. Payment needs to be paid in advance.'
  }
};

const PACKAGE_SIZE_INFO: Record<string, PackageSizeInfo> = {
  small: {
    title: 'Small Package',
    description: 'Perfect for documents, accessories, and small items. These packages can be sent via both delivery options.',
    deliveryOptions: ['Home Delivery - Direct to recipient address', 'Office Delivery - Collect from our office']
  },
  medium: {
    title: 'Medium Package',
    description: 'Ideal for books, clothes, and electronics. These packages can be sent via both delivery options.',
    deliveryOptions: ['Home Delivery - Direct to recipient address', 'Office Delivery - Collect from our office']
  },
  large: {
    title: 'Large Package',
    description: 'For bulky items and furniture parts. Large packages can only be sent via Home Delivery and must not exceed our stipulated size limits.',
    deliveryOptions: ['Home Delivery - Direct to recipient address (Only option for large packages)']
  }
};

export default function HomeScreen() {
  const [selectedOriginLocation, setSelectedOriginLocation] = useState<Location | null>(null);
  const [selectedOriginArea, setSelectedOriginArea] = useState<Area | null>(null);
  const [selectedDestinationLocation, setSelectedDestinationLocation] = useState<Location | null>(null);
  const [selectedDestinationArea, setSelectedDestinationArea] = useState<Area | null>(null);
  const [selectedPackageSize, setSelectedPackageSize] = useState<PackageSize | null>(null);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Data from API
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filteredOriginAreas, setFilteredOriginAreas] = useState<Area[]>([]);
  const [filteredDestinationAreas, setFilteredDestinationAreas] = useState<Area[]>([]);
  
  // Modal states
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showFragileModal, setShowFragileModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<DeliveryInfo | null>(null);
  const [showPackageSizeInfoModal, setShowPackageSizeInfoModal] = useState(false);
  const [selectedPackageSizeInfo, setSelectedPackageSizeInfo] = useState<PackageSizeInfo | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<SuccessModalData | null>(null);
  
  const { 
    user, 
    currentAccount,
    loading: userLoading,
    error: userError,
    getDisplayName, 
    getUserPhone,
    getCurrentToken,
    getCurrentUserId,
  } = useUser();
  
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // FAB Menu Animations
  const fabRotation = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const optionsScale = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(100)).current;
  const successModalScale = useRef(new Animated.Value(0)).current;
  const successModalOpacity = useRef(new Animated.Value(0)).current;

  // Load data on mount
  useEffect(() => {
    loadFormData();
  }, []);

  // Location scrolling animation
  useEffect(() => {
    if (locations.length === 0) return;
    
    const locationTagWidth = 120;
    const visibleSetWidth = locations.length * locationTagWidth;
    const repeatedList = 5;
    const scrollDistance = visibleSetWidth * repeatedList;

    const loop = () => {
      scrollX.setValue(0);
      Animated.timing(scrollX, {
        toValue: -scrollDistance / 2,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        loop();
      });
    };

    loop();

    return () => scrollX.stopAnimation();
  }, [scrollX, locations]);

  // Filter areas based on selected locations
  useEffect(() => {
    if (selectedOriginLocation) {
      const filtered = areas.filter(area => area.location_id === selectedOriginLocation.id);
      setFilteredOriginAreas(filtered);
    } else {
      setFilteredOriginAreas([]);
    }
  }, [selectedOriginLocation, areas]);

  useEffect(() => {
    if (selectedDestinationLocation) {
      const filtered = areas.filter(area => area.location_id === selectedDestinationLocation.id);
      setFilteredDestinationAreas(filtered);
    } else {
      setFilteredDestinationAreas([]);
    }
  }, [selectedDestinationLocation, areas]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const formData = await getPackageFormData();
      setLocations(formData.locations || []);
      setAreas(formData.areas || []);
    } catch (error) {
      console.error('Failed to load form data:', error);
      Alert.alert('Error', 'Failed to load locations and areas');
    } finally {
      setLoading(false);
    }
  };

  const calculateCost = async () => {
    if (!selectedOriginArea || !selectedDestinationArea || !selectedPackageSize) {
      Alert.alert('Missing Information', 'Please select origin area, destination area, and package size');
      return;
    }

    try {
      setLoading(true);
      
      const pricingData = {
        origin_area_id: selectedOriginArea.id,
        destination_area_id: selectedDestinationArea.id,
        package_size: selectedPackageSize.id
      };

      const result = await calculatePackagePricing(pricingData);
      setPricing(result);
    } catch (error) {
      console.error('Failed to calculate pricing:', error);
      Alert.alert('Error', 'Failed to calculate pricing');
    } finally {
      setLoading(false);
    }
  };

  const isUserAuthenticated = () => {
    return !!(user && currentAccount && getCurrentToken() && getCurrentUserId());
  };

  const validateUserForPackageCreation = (): boolean => {
    if (userLoading) {
      Alert.alert('Please wait', 'User authentication is loading...');
      return false;
    }

    if (userError) {
      Alert.alert('Authentication Error', 'Please refresh the app and try again.');
      return false;
    }

    if (!isUserAuthenticated()) {
      Alert.alert(
        'Authentication Required', 
        'Please ensure you are logged in to create packages. You may need to log in or switch to a valid account.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const token = getCurrentToken();
    const userId = getCurrentUserId();
    
    if (!token || !userId) {
      Alert.alert(
        'Session Error', 
        'Your session may have expired. Please log out and log back in.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  // FAB Menu Handlers
  const openFabMenu = () => {
    setFabMenuOpen(true);
    
    Animated.parallel([
      Animated.timing(fabRotation, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(optionsScale, {
        toValue: 1,
        duration: 400,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
      Animated.timing(optionsTranslateY, {
        toValue: 0,
        duration: 400,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeFabMenu = () => {
    Animated.parallel([
      Animated.timing(fabRotation, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(optionsScale, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(optionsTranslateY, {
        toValue: 100,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFabMenuOpen(false);
    });
  };

  const handleFabPress = () => {
    if (fabMenuOpen) {
      closeFabMenu();
    } else {
      openFabMenu();
    }
  };

  const showDeliveryInfo = (type: string) => {
    setSelectedInfo(DELIVERY_INFO[type]);
    setShowInfoModal(true);
  };

  const showPackageSizeInfo = (sizeId: string) => {
    setSelectedPackageSizeInfo(PACKAGE_SIZE_INFO[sizeId]);
    setShowPackageSizeInfoModal(true);
  };

  const closeInfoModal = () => {
    setShowInfoModal(false);
    setSelectedInfo(null);
  };

  const closePackageSizeInfoModal = () => {
    setShowPackageSizeInfoModal(false);
    setSelectedPackageSizeInfo(null);
  };

  const showSuccessPopup = (data: SuccessModalData) => {
    setSuccessModalData(data);
    setShowSuccessModal(true);
    
    Animated.parallel([
      Animated.spring(successModalScale, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(successModalOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      closeSuccessModal();
    }, 4000);
  };

  const closeSuccessModal = () => {
    Animated.parallel([
      Animated.timing(successModalScale, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(successModalOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessModal(false);
      setSuccessModalData(null);
      successModalScale.setValue(0);
      successModalOpacity.setValue(0);
    });
  };

  const handleFragileDelivery = () => {
    if (!validateUserForPackageCreation()) return;
    closeFabMenu();
    setTimeout(() => setShowFragileModal(true), 300);
  };

  const handleSendToSomeone = () => {
    if (!validateUserForPackageCreation()) return;
    closeFabMenu();
    setTimeout(() => setShowPackageModal(true), 300);
  };

  const handleCollectAndDeliver = () => {
    if (!validateUserForPackageCreation()) return;
    closeFabMenu();
    setTimeout(() => setShowCollectModal(true), 300);
  };

  const fabOptions: FABOption[] = [
    {
      id: 'fragile',
      label: 'Fragile Items',
      icon: 'alert-triangle',
      color: '#FF9500',
      backgroundColor: '#FF9500',
      glowColor: '#FF9500',
      action: handleFragileDelivery,
      infoAction: () => showDeliveryInfo('fragile'),
    },
    {
      id: 'send',
      label: 'Send a Package',
      icon: 'send',
      color: '#8B5CF6',
      backgroundColor: '#8B5CF6',
      glowColor: '#8B5CF6',
      action: handleSendToSomeone,
      infoAction: () => showDeliveryInfo('send'),
    },
    {
      id: 'collect',
      label: 'Collect my Packages',
      icon: 'package',
      color: '#10B981',
      backgroundColor: '#10B981',
      glowColor: '#10B981',
      action: handleCollectAndDeliver,
      infoAction: () => showDeliveryInfo('collect'),
    },
  ];

  const handlePackageSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
      };
      
      const response = await createPackage(enhancedPackageData);
      
      showSuccessPopup({
        title: 'Package Created Successfully!',
        message: 'Your package has been created and is ready for delivery.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#8B5CF6',
        icon: 'send'
      });
      
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to create package. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const handleFragileSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        delivery_type: 'fragile' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      showSuccessPopup({
        title: 'Fragile Items Scheduled!',
        message: 'Your fragile items delivery has been scheduled with special handling.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#FF9500',
        icon: 'alert-triangle'
      });
      
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to schedule fragile items delivery. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const handleCollectSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        receiver_name: getDisplayName(),
        receiver_phone: getUserPhone(),
        delivery_type: 'collection' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      showSuccessPopup({
        title: 'Package Collection Scheduled!',
        message: 'Your package collection request has been scheduled.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#10B981',
        icon: 'package'
      });
      
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to schedule package collection. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const LocationTag = ({ location }) => (
    <LinearGradient
      colors={['rgba(124, 58, 237, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.locationTagGradient}
    >
      <TouchableOpacity
        style={styles.locationTag}
        onPress={() => setSelectedOriginLocation(location)}
        activeOpacity={0.8}
      >
        <Text style={styles.locationText}>{location.name}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderDropdown = (
    items: any[],
    selectedItem: any,
    onSelect: (item: any) => void,
    placeholder: string,
    getDisplayName: (item: any) => string
  ) => (
    <View style={styles.dropdownContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dropdownScroll}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.dropdownItem,
              selectedItem?.id === item.id && styles.dropdownItemSelected
            ]}
            onPress={() => onSelect(item)}
          >
            <Text style={[
              styles.dropdownText,
              selectedItem?.id === item.id && styles.dropdownTextSelected
            ]}>
              {getDisplayName(item)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderPackageSizes = () => (
    <View style={styles.packageSizeContainer}>
      <Text style={styles.sectionLabel}>What are you sending?</Text>
      <View style={styles.packageSizeGrid}>
        {PACKAGE_SIZES.map((size) => (
          <TouchableOpacity
            key={size.id}
            style={[
              styles.packageSizeCard,
              selectedPackageSize?.id === size.id && styles.packageSizeCardSelected
            ]}
            onPress={() => setSelectedPackageSize(size)}
          >
            <View style={styles.packageSizeContent}>
              <Feather name={size.icon as any} size={24} color={selectedPackageSize?.id === size.id ? '#8B5CF6' : '#fff'} />
              <Text style={[
                styles.packageSizeName,
                selectedPackageSize?.id === size.id && styles.packageSizeNameSelected
              ]}>
                {size.name}
              </Text>
              <Text style={styles.packageSizeDescription}>{size.description}</Text>
              <TouchableOpacity
                style={styles.infoIconButton}
                onPress={() => showPackageSizeInfo(size.id)}
              >
                <Feather name="info" size={16} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPricingResults = () => {
    if (!pricing) return null;

    return (
      <View style={styles.pricingContainer}>
        <Text style={styles.pricingTitle}>Estimated Costs</Text>
        <View style={styles.pricingGrid}>
          <View style={[styles.pricingCard, { borderColor: '#FF9500' }]}>
            <Text style={styles.pricingType}>Fragile</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.fragile.toLocaleString()}</Text>
          </View>
          <View style={[styles.pricingCard, { borderColor: '#8B5CF6' }]}>
            <Text style={styles.pricingType}>Home</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.home.toLocaleString()}</Text>
          </View>
          <View style={[styles.pricingCard, { borderColor: '#10B981' }]}>
            <Text style={styles.pricingType}>Office</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.office.toLocaleString()}</Text>
          </View>
          <View style={[styles.pricingCard, { borderColor: '#6366F1' }]}>
            <Text style={styles.pricingType}>Collection</Text>
            <Text style={styles.pricingAmount}>KSh {pricing.collection.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFabOption = (option: FABOption, index: number) => {
    const optionOpacity = overlayOpacity.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const optionTranslateY = optionsTranslateY.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 100 + (index * 20)],
    });

    return (
      <Animated.View
        key={option.id}
        style={[
          styles.fabOptionWrapper,
          {
            opacity: optionOpacity,
            transform: [
              { scale: optionsScale },
              { translateY: optionTranslateY },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.fabOptionContainer,
            {
              shadowColor: option.glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 15,
              elevation: 15,
            }
          ]}
          onPress={option.action}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.fabOptionBackground,
              {
                backgroundColor: option.backgroundColor,
                shadowColor: option.glowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
              }
            ]}
          >
            <View style={styles.fabOptionContent}>
              <View style={[
                styles.fabOptionIcon,
                {
                  shadowColor: option.glowColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                }
              ]}>
                <Feather name={option.icon as any} size={22} color="white" />
              </View>
              <Text style={styles.fabOptionLabel}>{option.label}</Text>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  option.infoAction();
                }}
              >
                <Feather name="info" size={18} color="rgba(255, 255, 255, 0.9)" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const fabIconRotation = fabRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <GLTHeader />

      {/* Animated Scrolling Section */}
      <View style={styles.locationsContainer}>
        <Text style={styles.sectionTitle}>Currently Reaching</Text>
        <View style={styles.animatedContainer}>
          <Animated.View
            style={[
              styles.animatedContent,
              { transform: [{ translateX: scrollX }] },
            ]}
          >
            {Array(5).fill(locations).flat().map((location, index) => (
              <LocationTag key={`${location.name}-${index}`} location={location} />
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Enhanced Cost Calculator */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.calculatorContainer}>
          <Text style={styles.calculatorTitle}>Cost Calculator</Text>
          
          {/* Origin Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Where are you sending from?</Text>
            <Text style={styles.subLabel}>Select Location</Text>
            {renderDropdown(
              locations,
              selectedOriginLocation,
              setSelectedOriginLocation,
              'Select Origin Location',
              (item) => item.name
            )}
            {selectedOriginLocation && (
              <>
                <Text style={styles.subLabel}>Select Area</Text>
                {renderDropdown(
                  filteredOriginAreas,
                  selectedOriginArea,
                  setSelectedOriginArea,
                  'Select Origin Area',
                  (item) => item.name
                )}
              </>
            )}
          </View>

          {/* Destination Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Where are you sending to?</Text>
            <Text style={styles.subLabel}>Select Location</Text>
            {renderDropdown(
              locations,
              selectedDestinationLocation,
              setSelectedDestinationLocation,
              'Select Destination Location',
              (item) => item.name
            )}
            {selectedDestinationLocation && (
              <>
                <Text style={styles.subLabel}>Select Area</Text>
                {renderDropdown(
                  filteredDestinationAreas,
                  selectedDestinationArea,
                  setSelectedDestinationArea,
                  'Select Destination Area',
                  (item) => item.name
                )}
              </>
            )}
          </View>

          {/* Package Size Selection */}
          {renderPackageSizes()}

          {/* Calculate Button */}
          <TouchableOpacity 
            onPress={calculateCost} 
            activeOpacity={0.8}
            disabled={loading || !selectedOriginArea || !selectedDestinationArea || !selectedPackageSize}
            style={[
              styles.calculateButton,
              (!selectedOriginArea || !selectedDestinationArea || !selectedPackageSize) && styles.calculateButtonDisabled
            ]}
          >
            <LinearGradient 
              colors={['#7c3aed', '#3b82f6', '#10b981']} 
              style={styles.calculateButtonGradient}
            >
              <Text style={styles.calculateButtonText}>
                {loading ? 'Calculating...' : 'Calculate Cost'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Pricing Results */}
          {renderPricingResults()}
        </View>
      </ScrollView>

      {/* FAB Menu Overlay */}
      {fabMenuOpen && (
        <Animated.View
          style={[
            styles.fabOverlay,
            { opacity: overlayOpacity },
          ]}
        >
          <TouchableOpacity
            style={styles.fabOverlayTouchable}
            onPress={closeFabMenu}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* FAB Options */}
      {fabMenuOpen && (
        <View style={styles.fabOptionsContainer}>
          {fabOptions.map((option, index) => renderFabOption(option, index))}
        </View>
      )}

      {/* Main FAB */}
      <View style={styles.fabContainer}>
        <LinearGradient colors={['#7c3aed', '#3b82f6']} style={styles.fabGradient}>
          <TouchableOpacity
            style={styles.fabTouchable}
            onPress={handleFabPress}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.fabIconContainer,
                { transform: [{ rotate: fabIconRotation }] },
              ]}
            >
              <Feather 
                name="plus" 
                size={24} 
                color="white" 
                style={styles.fabIcon}
              />
            </Animated.View>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={closeInfoModal}
      >
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalContainer}>
            <LinearGradient
              colors={['rgba(26, 26, 46, 0.95)', 'rgba(22, 33, 62, 0.95)']}
              style={styles.infoModalContent}
            >
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>{selectedInfo?.title}</Text>
                <TouchableOpacity onPress={closeInfoModal} style={styles.infoModalClose}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.infoModalText}>{selectedInfo?.description}</Text>
              <TouchableOpacity onPress={closeInfoModal} style={styles.infoModalButton}>
                <View style={styles.infoModalButtonBackground}>
                  <Text style={styles.infoModalButtonText}>Got it</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Package Size Info Modal */}
      <Modal
        visible={showPackageSizeInfoModal}
        transparent
        animationType="fade"
        onRequestClose={closePackageSizeInfoModal}
      >
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalContainer}>
            <LinearGradient
              colors={['rgba(26, 26, 46, 0.95)', 'rgba(22, 33, 62, 0.95)']}
              style={styles.infoModalContent}
            >
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>{selectedPackageSizeInfo?.title}</Text>
                <TouchableOpacity onPress={closePackageSizeInfoModal} style={styles.infoModalClose}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.infoModalText}>{selectedPackageSizeInfo?.description}</Text>
              <View style={styles.deliveryOptionsContainer}>
                <Text style={styles.deliveryOptionsTitle}>Available Delivery Options:</Text>
                {selectedPackageSizeInfo?.deliveryOptions.map((option, index) => (
                  <Text key={index} style={styles.deliveryOption}>• {option}</Text>
                ))}
              </View>
              <TouchableOpacity onPress={closePackageSizeInfoModal} style={styles.infoModalButton}>
                <View style={styles.infoModalButtonBackground}>
                  <Text style={styles.infoModalButtonText}>Got it</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="none"
        onRequestClose={closeSuccessModal}
      >
        <View style={styles.successModalOverlay}>
          <TouchableOpacity 
            style={styles.successModalTouchable}
            onPress={closeSuccessModal}
            activeOpacity={1}
          >
            <Animated.View
              style={[
                styles.successModalContainer,
                {
                  opacity: successModalOpacity,
                  transform: [{ scale: successModalScale }],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  `${successModalData?.color}15`,
                  `${successModalData?.color}25`,
                  `${successModalData?.color}15`,
                ]}
                style={[
                  styles.successModalContent,
                  {
                    borderColor: `${successModalData?.color}40`,
                    shadowColor: successModalData?.color,
                  }
                ]}
              >
                <View style={styles.successModalHeader}>
                  <View 
                    style={[
                      styles.successModalIconContainer,
                      { 
                        backgroundColor: `${successModalData?.color}20`,
                        shadowColor: successModalData?.color,
                      }
                    ]}
                  >
                    <Feather 
                      name={successModalData?.icon as any} 
                      size={28} 
                      color={successModalData?.color} 
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={closeSuccessModal} 
                    style={styles.successModalClose}
                  >
                    <Feather name="x" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.successModalTitle, { color: successModalData?.color }]}>
                  {successModalData?.title}
                </Text>
                
                <Text style={styles.successModalMessage}>
                  {successModalData?.message}
                </Text>
                
                <View style={styles.successModalDetails}>
                  <Text style={styles.successModalDetailLabel}>Tracking Code:</Text>
                  <Text style={[styles.successModalDetailValue, { color: successModalData?.color }]}>
                    {successModalData?.trackingNumber}
                  </Text>
                </View>
                
                <View style={styles.successModalDetails}>
                  <Text style={styles.successModalDetailLabel}>Status:</Text>
                  <Text style={styles.successModalDetailValue}>
                    {successModalData?.status}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Package Creation Modal */}
      <PackageCreationModal
        visible={showPackageModal}
        onClose={() => setShowPackageModal(false)}
        onSubmit={handlePackageSubmit}
      />

      {/* Fragile Delivery Modal */}
      <FragileDeliveryModal
        visible={showFragileModal}
        onClose={() => setShowFragileModal(false)}
        onSubmit={handleFragileSubmit}
      />

      {/* Collect & Deliver Modal */}
      <CollectDeliverModal
        visible={showCollectModal}
        onClose={() => setShowCollectModal(false)}
        onSubmit={handleCollectSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0f' 
  },
  locationsContainer: { 
    paddingTop: 20, 
    paddingBottom: 20,
    backgroundColor: '#0a0a0f',
  },
  sectionTitle: {
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#ffffff',
    textAlign: 'center', 
    marginBottom: 15, 
    opacity: 1,
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  animatedContainer: { 
    height: 60, 
    overflow: 'hidden' 
  },
  animatedContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16 
  },
  locationTagGradient: { 
    borderRadius: 25, 
    padding: 2, 
    marginHorizontal: 8 
  },
  locationTag: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 12, 
    paddingHorizontal: 20,
    borderRadius: 23, 
    minWidth: 80, 
    alignItems: 'center',
  },
  locationText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  scrollContainer: { 
    flex: 1 
  },
  calculatorContainer: { 
    padding: 20, 
    marginTop: 20 
  },
  calculatorTitle: {
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff',
    textAlign: 'center', 
    marginBottom: 30,
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  inputSection: {
    marginBottom: 25,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 10,
    marginLeft: 5,
  },
  dropdownContainer: {
    marginBottom: 15,
  },
  dropdownScroll: {
    maxHeight: 50,
  },
  dropdownItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.6)',
    borderColor: '#7c3aed',
  },
  dropdownText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  packageSizeContainer: {
    marginBottom: 25,
  },
  packageSizeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  packageSizeCard: {
    width: '31%',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  packageSizeCardSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  packageSizeContent: {
    alignItems: 'center',
    position: 'relative',
  },
  packageSizeName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  packageSizeNameSelected: {
    color: '#8B5CF6',
  },
  packageSizeDescription: {
    color: '#ccc',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  infoIconButton: {
    position: 'absolute',
    top: -5,
    right: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculateButton: {
    marginVertical: 20,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calculateButtonDisabled: {
    opacity: 0.5,
  },
  calculateButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pricingContainer: {
    marginTop: 20,
  },
  pricingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pricingCard: {
    width: '48%',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 2,
    alignItems: 'center',
  },
  pricingType: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  pricingAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // FAB Styles
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    zIndex: 1000,
  },
  fabGradient: {
    borderRadius: 28,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabTouchable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {},
  fabOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 999,
  },
  fabOverlayTouchable: {
    flex: 1,
  },
  fabOptionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    alignItems: 'flex-end',
    zIndex: 1001,
  },
  fabOptionWrapper: {
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  fabOptionContainer: {
    borderRadius: 20,
    overflow: 'visible',
  },
  fabOptionBackground: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 240,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'visible',
  },
  fabOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    elevation: 8,
  },
  fabOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Modal Styles
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  infoModalContent: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  infoModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    marginBottom: 24,
  },
  deliveryOptionsContainer: {
    marginBottom: 24,
  },
  deliveryOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  deliveryOption: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 4,
  },
  infoModalButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoModalButtonBackground: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
  },
  successModalContent: {
    padding: 28,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    backdropFilter: 'blur(20px)',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 25,
  },
  successModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  successModalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  successModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  successModalMessage: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.9,
  },
  successModalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  successModalDetailLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  successModalDetailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
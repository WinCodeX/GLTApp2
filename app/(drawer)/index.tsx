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
  Modal,
  Platform,
} from 'react-native';
import { FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import GLTHeader from '../../components/GLTHeader';
import PackageCreationModal from '../../components/PackageCreationModal';
import { createPackage, type PackageData } from '../../lib/helpers/packageHelpers';
import colors from '../../theme/colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const locations = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Eldoret', 'Nakuru',
  'Thika', 'Machakos', 'Kisii', 'Kakamega', 'Meru',
];

interface FABOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  gradientColors: string[];
  action: () => void;
  infoAction: () => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

interface DeliveryInfo {
  title: string;
  description: string;
}

const DELIVERY_INFO: Record<string, DeliveryInfo> = {
  fragile: {
    title: 'Fragile Delivery',
    description: 'We do fragile delivery on items that are breakable which are prioritized by the rider and are sent out immediately. Please select your current location and the rider will come collect the package and send it to where it\'s supposed to go.'
  },
  send: {
    title: 'Send to Someone',
    description: 'We have two delivery options to send to someone. Door delivery and agent delivery. Door delivery packages are sent straight to their home address. For agent delivery that\'s from one agent to another and the receiver will have to go and collect from the agent of their choice. For bulky packages - these are heavy packages that exceed our threshold and packages that exceed our stipulated size guidelines - we recommend using our Fragile delivery option.'
  },
  collect: {
    title: 'Collect & Deliver to Me',
    description: 'This is a service we provide whereby you can shop things online or from any shop within CBD and have us collect it for you - at a fee - and deliver it to you. Please note that collection and delivery will require you to pay in advance for both.'
  }
};

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  
  // New modal states
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<DeliveryInfo | null>(null);
  const [showFragileModal, setShowFragileModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  
  // Location states
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationData | null>(null);
  const [collectionLocation, setCollectionLocation] = useState<LocationData | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
  
  // User info (this would come from authentication/user context in real app)
  const [userInfo] = useState({
    name: 'Current User',
    phone: '+254700000000'
  });
  
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // FAB Menu Animations
  const fabRotation = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const optionsScale = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
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
    requestLocationPermission();

    return () => scrollX.stopAnimation();
  }, [scrollX]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Current Location'
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const calculateCost = () => {
    if (origin && destination) {
      const estimatedCost = 500 + Math.abs(locations.indexOf(origin) - locations.indexOf(destination)) * 100;
      setCost(estimatedCost);
    } else {
      setCost(null);
    }
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

  // Info Modal Handlers
  const showDeliveryInfo = (type: string) => {
    setSelectedInfo(DELIVERY_INFO[type]);
    setShowInfoModal(true);
  };

  const closeInfoModal = () => {
    setShowInfoModal(false);
    setSelectedInfo(null);
  };

  // FAB Options Actions
  const handleFragileDelivery = () => {
    closeFabMenu();
    setTimeout(() => {
      setShowFragileModal(true);
    }, 300);
  };

  const handleSendToSomeone = () => {
    closeFabMenu();
    setTimeout(() => {
      setShowPackageModal(true);
    }, 300);
  };

  const handleCollectAndDeliver = () => {
    closeFabMenu();
    setTimeout(() => {
      setShowCollectModal(true);
    }, 300);
  };

  const fabOptions: FABOption[] = [
    {
      id: 'fragile',
      label: 'Fragile Delivery',
      icon: 'alert-triangle',
      color: '#ff6b6b',
      gradientColors: ['rgba(255, 107, 107, 0.9)', 'rgba(255, 142, 142, 0.8)'],
      action: handleFragileDelivery,
      infoAction: () => showDeliveryInfo('fragile'),
    },
    {
      id: 'send',
      label: 'Send to Someone',
      icon: 'send',
      color: '#7c3aed',
      gradientColors: ['rgba(124, 58, 237, 0.9)', 'rgba(59, 130, 246, 0.8)'],
      action: handleSendToSomeone,
      infoAction: () => showDeliveryInfo('send'),
    },
    {
      id: 'collect',
      label: 'Collect & Deliver to Me',
      icon: 'package',
      color: '#10b981',
      gradientColors: ['rgba(16, 185, 129, 0.9)', 'rgba(52, 211, 153, 0.8)'],
      action: handleCollectAndDeliver,
      infoAction: () => showDeliveryInfo('collect'),
    },
  ];

  const handlePackageSubmit = async (packageData: PackageData) => {
    try {
      console.log('📦 Creating package with data:', packageData);
      
      // Auto-fill user info
      const enhancedPackageData = {
        ...packageData,
        sender_name: userInfo.name,
        sender_phone: userInfo.phone,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('✅ Package created successfully:', response);
      
      Alert.alert(
        'Success! 🎉',
        `Package created successfully!\n\nTracking Code: ${response.tracking_number || 'Generated'}\n\nStatus: ${response.status || 'Pending Payment'}`,
        [
          {
            text: 'Create Another',
            onPress: () => {
              setTimeout(() => setShowPackageModal(true), 500);
            }
          },
          { text: 'OK' }
        ]
      );
      
    } catch (error: any) {
      console.error('❌ Error creating package:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create package. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const handleCloseModal = () => {
    console.log('❌ Closing package modal');
    setShowPackageModal(false);
  };

  const handleFragileSubmit = async () => {
    if (!currentLocation || !destinationLocation) {
      Alert.alert('Error', 'Please set both pickup and delivery locations');
      return;
    }
    
    try {
      const packageData = {
        sender_name: userInfo.name,
        sender_phone: userInfo.phone,
        receiver_name: '', // Will be filled in the next step
        receiver_phone: '', // Will be filled in the next step
        delivery_type: 'fragile',
        pickup_location: currentLocation.address || 'Current Location',
        delivery_location: destinationLocation.address || 'Destination',
        coordinates: {
          pickup: currentLocation,
          delivery: destinationLocation
        }
      };
      
      setShowFragileModal(false);
      // Open regular modal to complete receiver details
      setTimeout(() => setShowPackageModal(true), 300);
      
    } catch (error) {
      console.error('Error with fragile delivery:', error);
      Alert.alert('Error', 'Failed to process fragile delivery request');
    }
  };

  const handleCollectSubmit = async () => {
    if (!collectionLocation || !deliveryLocation) {
      Alert.alert('Error', 'Please set both collection and delivery locations');
      return;
    }
    
    try {
      const packageData = {
        sender_name: userInfo.name,
        sender_phone: userInfo.phone,
        receiver_name: userInfo.name, // Delivering to self
        receiver_phone: userInfo.phone,
        delivery_type: 'doorstep',
        pickup_location: collectionLocation.address || 'Collection Point',
        delivery_location: deliveryLocation.address || 'Delivery Location',
        coordinates: {
          pickup: collectionLocation,
          delivery: deliveryLocation
        }
      };
      
      setShowCollectModal(false);
      Alert.alert('Success', 'Collection & delivery request submitted successfully!');
      
    } catch (error) {
      console.error('Error with collect and deliver:', error);
      Alert.alert('Error', 'Failed to process collection request');
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
        onPress={() => setOrigin(location)}
        activeOpacity={0.8}
      >
        <Text style={styles.locationText}>{location}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

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
          style={styles.fabOptionContainer}
          onPress={option.action}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={option.gradientColors}
            style={styles.fabOptionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.fabOptionContent}>
              <View style={styles.fabOptionIcon}>
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
                <Feather name="info" size={18} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderInfoModal = () => (
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
              <LinearGradient
                colors={['#7c3aed', '#3b82f6']}
                style={styles.infoModalButtonGradient}
              >
                <Text style={styles.infoModalButtonText}>Got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const renderFragileModal = () => (
    <Modal
      visible={showFragileModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFragileModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f1419']}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚠️ Fragile Delivery</Text>
              <TouchableOpacity onPress={() => setShowFragileModal(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollContent}>
              <Text style={styles.modalSubtitle}>
                Set your pickup and delivery locations for fragile items
              </Text>
              
              <View style={styles.locationSection}>
                <Text style={styles.locationLabel}>📍 Pickup Location</Text>
                <TouchableOpacity style={styles.locationInput}>
                  <Text style={styles.locationText}>
                    {currentLocation?.address || 'Tap to set pickup location'}
                  </Text>
                  <Feather name="map-pin" size={20} color="#7c3aed" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.locationSection}>
                <Text style={styles.locationLabel}>🎯 Delivery Location</Text>
                <TouchableOpacity style={styles.locationInput}>
                  <Text style={styles.locationText}>
                    {destinationLocation?.address || 'Tap to set delivery location'}
                  </Text>
                  <Feather name="map-pin" size={20} color="#7c3aed" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.costEstimate}>
                <Text style={styles.costLabel}>Estimated Cost:</Text>
                <Text style={styles.costValue}>KES 580 - 750</Text>
                <Text style={styles.costNote}>*Includes fragile handling surcharge</Text>
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleFragileSubmit}
            >
              <LinearGradient
                colors={['#ff6b6b', '#ff8e8e']}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>Continue with Fragile Delivery</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const renderCollectModal = () => (
    <Modal
      visible={showCollectModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCollectModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f1419']}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📦 Collect & Deliver</Text>
              <TouchableOpacity onPress={() => setShowCollectModal(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollContent}>
              <Text style={styles.modalSubtitle}>
                We'll collect your items and deliver them to you
              </Text>
              
              <View style={styles.locationSection}>
                <Text style={styles.locationLabel}>🛍️ Collection Point</Text>
                <TouchableOpacity style={styles.locationInput}>
                  <Text style={styles.locationText}>
                    {collectionLocation?.address || 'Tap to set collection point'}
                  </Text>
                  <Feather name="map-pin" size={20} color="#10b981" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.locationSection}>
                <Text style={styles.locationLabel}>🏠 Delivery to You</Text>
                <TouchableOpacity style={styles.locationInput}>
                  <Text style={styles.locationText}>
                    {deliveryLocation?.address || currentLocation?.address || 'Tap to set delivery location'}
                  </Text>
                  <Feather name="map-pin" size={20} color="#10b981" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.serviceNote}>
                <Feather name="info" size={16} color="#10b981" />
                <Text style={styles.serviceNoteText}>
                  Collection and delivery fees apply. Payment required in advance.
                </Text>
              </View>
              
              <View style={styles.costEstimate}>
                <Text style={styles.costLabel}>Service Fees:</Text>
                <Text style={styles.costValue}>Collection: KES 200</Text>
                <Text style={styles.costValue}>Delivery: KES 250</Text>
                <Text style={styles.costNote}>*Total: KES 450 + item cost</Text>
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCollectSubmit}
            >
              <LinearGradient
                colors={['#10b981', '#34d399']}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>Request Collection & Delivery</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

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
              <LocationTag key={`${location}-${index}`} location={location} />
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Cost Calculator */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.calculatorContainer}>
          <Text style={styles.calculatorTitle}>Cost Calculator</Text>
          <View style={styles.inputContainer}>
            <LinearGradient colors={['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)']} style={styles.inputGradientBorder}>
              <TextInput
                style={styles.input}
                placeholder="From Location"
                placeholderTextColor="#888"
                value={origin}
                onChangeText={setOrigin}
              />
            </LinearGradient>
            <LinearGradient colors={['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)']} style={styles.inputGradientBorder}>
              <TextInput
                style={styles.input}
                placeholder="To Location"
                placeholderTextColor="#888"
                value={destination}
                onChangeText={setDestination}
              />
            </LinearGradient>
            <TouchableOpacity onPress={calculateCost} activeOpacity={0.8}>
              <LinearGradient colors={['#7c3aed', '#3b82f6', '#10b981']} style={styles.calculateButton}>
                <Text style={styles.calculateButtonText}>Calculate Cost</Text>
              </LinearGradient>
            </TouchableOpacity>

            {cost !== null && (
              <View style={styles.costContainer}>
                <LinearGradient colors={['rgba(16, 185, 129, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.costGradientBg}>
                  <Text style={styles.costText}>Estimated Cost: KSh {cost.toLocaleString()}</Text>
                </LinearGradient>
              </View>
            )}
          </View>
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

      {/* Modals */}
      {renderInfoModal()}
      {renderFragileModal()}
      {renderCollectModal()}

      {/* Package Creation Modal */}
      <PackageCreationModal
        visible={showPackageModal}
        onClose={handleCloseModal}
        onSubmit={handlePackageSubmit}
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
    paddingBottom: 20 
  },
  sectionTitle: {
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff',
    textAlign: 'center', 
    marginBottom: 15, 
    opacity: 0.9,
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
  inputContainer: { 
    alignItems: 'center', 
    gap: 20 
  },
  inputGradientBorder: { 
    borderRadius: 12, 
    padding: 2, 
    width: '90%' 
  },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff', 
    padding: 16, 
    borderRadius: 10,
    fontSize: 16, 
    width: '100%',
  },
  calculateButton: {
    paddingVertical: 16, 
    paddingHorizontal: 40, 
    borderRadius: 25,
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#7c3aed', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 8,
  },
  calculateButtonText: {
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  costContainer: { 
    marginTop: 20, 
    width: '90%' 
  },
  costGradientBg: {
    borderRadius: 12, 
    padding: 16, 
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  costText: {
    fontSize: 18, 
    fontWeight: '600', 
    color: '#fff', 
    textAlign: 'center',
  },

  // Enhanced FAB Styles
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

  // FAB Overlay
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

  // Enhanced FAB Options with Bubble Style
  fabOptionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    alignItems: 'flex-end',
    zIndex: 1001,
  },
  fabOptionWrapper: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  fabOptionContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  fabOptionGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 240,
    borderRadius: 20,
    // Glass morphism effect
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fabOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    // Inner glow effect
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Info Modal Styles
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
  infoModalButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoModalButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Delivery Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: screenHeight * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalScrollContent: {
    flex: 1,
  },

  // Location Selection Styles
  locationSection: {
    marginBottom: 24,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },

  // Service Note Styles
  serviceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  serviceNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#10b981',
    lineHeight: 20,
  },

  // Cost Estimate Styles
  costEstimate: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 8,
  },
  costValue: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  costNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Submit Button Styles
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
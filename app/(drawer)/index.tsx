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
import { createPackage, type PackageData } from '../../lib/helpers/packageHelpers';

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
  backgroundColor: string;
  glowColor: string;
  action: () => void;
  infoAction: () => void;
}

interface DeliveryInfo {
  title: string;
  description: string;
}

interface SuccessModalData {
  title: string;
  message: string;
  trackingNumber: string;
  status: string;
  color: string;
  icon: string;
}

const DELIVERY_INFO: Record<string, DeliveryInfo> = {
  fragile: {
    title: 'Fragile Items',
    description: 'We have a dedicated delivery service for items that require extra care which will be prioritised & sent out immediately. Please select your current location and the rider will come collect the package and send it to where it\'s supposed to go.'
  },
  send: {
    title: 'Send a Package',
    description: 'There are 2 options - doorstep and office. The doorstep option will have the item delivered right to their location while the office option will be delivered to our office for the receiver to collect.'
  },
  collect: {
    title: 'Collect my Packages',
    description: 'This is where we collect your packages after you\'ve made an order and then dispatch it. Payment needs to be paid in advance.'
  }
};

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showFragileModal, setShowFragileModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  
  // Info modal states
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<DeliveryInfo | null>(null);
  
  // Success modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<SuccessModalData | null>(null);
  
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
  
  // Success modal animations
  const successModalScale = useRef(new Animated.Value(0)).current;
  const successModalOpacity = useRef(new Animated.Value(0)).current;

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

    return () => scrollX.stopAnimation();
  }, [scrollX]);

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

  // Success Modal Handlers
  const showSuccessPopup = (data: SuccessModalData) => {
    setSuccessModalData(data);
    setShowSuccessModal(true);
    
    // Animate in
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

    // Auto hide after 4 seconds
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
      console.log('📦 Creating package with data:', packageData);
      
      const enhancedPackageData = {
        ...packageData,
        sender_name: userInfo.name,
        sender_phone: userInfo.phone,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('✅ Package created successfully:', response);
      
      showSuccessPopup({
        title: 'Package Created Successfully!',
        message: 'Your package has been created and is ready for delivery.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#8B5CF6',
        icon: 'send'
      });
      
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

  const handleFragileSubmit = async (packageData: PackageData) => {
    try {
      console.log('📦 Creating fragile delivery package:', packageData);
      
      const enhancedPackageData = {
        ...packageData,
        sender_name: userInfo.name,
        sender_phone: userInfo.phone,
        delivery_type: 'fragile' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('✅ Fragile package created successfully:', response);
      
      showSuccessPopup({
        title: 'Fragile Items Scheduled!',
        message: 'Your fragile items delivery has been scheduled with special handling.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#FF9500',
        icon: 'alert-triangle'
      });
      
    } catch (error: any) {
      console.error('❌ Error creating fragile package:', error);
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
      console.log('📦 Creating collect package:', packageData);
      
      const enhancedPackageData = {
        ...packageData,
        sender_name: userInfo.name,
        sender_phone: userInfo.phone,
        receiver_name: userInfo.name, // Delivering to self
        receiver_phone: userInfo.phone,
        delivery_type: 'collection' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('✅ Collect package created successfully:', response);
      
      showSuccessPopup({
        title: 'Package Collection Scheduled!',
        message: 'Your package collection request has been scheduled.',
        trackingNumber: response.tracking_number || 'Generated',
        status: response.status || 'Pending Payment',
        color: '#10B981',
        icon: 'package'
      });
      
    } catch (error: any) {
      console.error('❌ Error creating collect package:', error);
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
              <View
                style={[
                  styles.infoModalButtonBackground,
                  { backgroundColor: '#CD56DD' }
                ]}
              >
                <Text style={styles.infoModalButtonText}>Got it</Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const renderSuccessModal = () => (
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

              <View style={styles.successModalButtons}>
                <TouchableOpacity 
                  onPress={() => {
                    closeSuccessModal();
                    setTimeout(() => {
                      if (successModalData?.icon === 'alert-triangle') {
                        setShowFragileModal(true);
                      } else if (successModalData?.icon === 'package') {
                        setShowCollectModal(true);
                      } else if (successModalData?.icon === 'send') {
                        setShowPackageModal(true);
                      }
                    }, 500);
                  }}
                  style={[
                    styles.successModalButton,
                    { backgroundColor: `${successModalData?.color}20` }
                  ]}
                >
                  <Text style={[styles.successModalButtonText, { color: successModalData?.color }]}>
                    {successModalData?.icon === 'send' ? 'Create Another' : 'Schedule Another'}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
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

      {/* Info Modal */}
      {renderInfoModal()}

      {/* Success Modal */}
      {renderSuccessModal()}

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
    zIndex: 10,
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

  // Single Color FAB Options with Glow
  fabOptionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    alignItems: 'flex-end',
    zIndex: 1001,
  },
  fabOptionWrapper: {
    marginBottom: 20, // Increased spacing for glow effect
    alignItems: 'flex-end',
  },
  fabOptionContainer: {
    borderRadius: 20,
    overflow: 'visible', // Changed to visible for glow effect
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
  infoModalButtonBackground: {
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
  successModalButtons: {
    marginTop: 20,
    alignItems: 'center',
  },
  successModalButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    minWidth: 160,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  successModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
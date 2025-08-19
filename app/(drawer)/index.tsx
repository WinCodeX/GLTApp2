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

interface DeliveryInfo {
  title: string;
  description: string;
}

const DELIVERY_INFO: Record<string, DeliveryInfo> = {
  fragile: {
    title: 'Fragile Items',
    description: 'We have a dedicated delivery service for items that require extra care which will be prioritised & sent out immediately. Please select your current location and the rider will come collect the package and send it to where it\'s supposed to go.'
  },
  send: {
    title: 'Send to Someone',
    description: 'There are 2 options - doorstep and office. The doorstep option will have the item delivered right to their location while the office option will be delivered to our office for the receiver to collect.'
  },
  collect: {
    title: 'Collect my packages',
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
  
  // Info modal states
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<DeliveryInfo | null>(null);
  
  // User info (this would come from authentication/user context in real app)
  const [userInfo] = useState({
    name: 'Current User',
    phone: '+254700000000'
  });
  
  const scrollX = useRef(new Animated.Value(0)).current;

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

  // Info Modal Handlers
  const showDeliveryInfo = (type: string) => {
    setSelectedInfo(DELIVERY_INFO[type]);
    setShowInfoModal(true);
  };

  const closeInfoModal = () => {
    setShowInfoModal(false);
    setSelectedInfo(null);
  };

  // Button Actions
  const handleFragileDelivery = () => {
    setShowFragileModal(true);
  };

  const handleSendToSomeone = () => {
    setShowPackageModal(true);
  };

  const handleCollectAndDeliver = () => {
    setShowCollectModal(true);
  };

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
      
      Alert.alert(
        'Fragile Items Scheduled! ⚠️',
        `Your fragile items delivery has been scheduled with special handling.\n\nTracking Code: ${response.tracking_number || 'Generated'}\n\nStatus: ${response.status || 'Pending Payment'}`,
        [
          {
            text: 'Schedule Another',
            onPress: () => {
              setTimeout(() => setShowFragileModal(true), 500);
            }
          },
          { text: 'OK' }
        ]
      );
      
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
        delivery_type: 'doorstep' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('✅ Collect package created successfully:', response);
      
      Alert.alert(
        'Package Collection Scheduled! 📦',
        `Your package collection request has been scheduled.\n\nTracking Code: ${response.tracking_number || 'Generated'}\n\nStatus: ${response.status || 'Pending Payment'}`,
        [
          {
            text: 'Schedule Another',
            onPress: () => {
              setTimeout(() => setShowCollectModal(true), 500);
            }
          },
          { text: 'OK' }
        ]
      );
      
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

  const renderActionButton = (title: string, icon: string, color: string, action: () => void, infoAction: () => void) => (
    <View style={styles.actionButtonContainer}>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: color }]}
        onPress={action}
        activeOpacity={0.8}
      >
        <View style={styles.actionButtonContent}>
          <View style={styles.actionButtonIcon}>
            <Feather name={icon as any} size={24} color="white" />
          </View>
          <Text style={styles.actionButtonText}>{title}</Text>
          <TouchableOpacity 
            style={styles.actionButtonInfo}
            onPress={(e) => {
              e.stopPropagation();
              infoAction();
            }}
          >
            <Feather name="info" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

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

            {cost !== null && (
              <View style={styles.costContainer}>
                <LinearGradient colors={['rgba(16, 185, 129, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.costGradientBg}>
                  <Text style={styles.costText}>Estimated Cost: KSh {cost.toLocaleString()}</Text>
                </LinearGradient>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {renderActionButton(
            'Fragile Items',
            'alert-triangle',
            '#FF9500', // Orange color to match the image
            handleFragileDelivery,
            () => showDeliveryInfo('fragile')
          )}
          
          {renderActionButton(
            'Send to Someone',
            'send',
            '#8B5CF6', // Purple color to match the image
            handleSendToSomeone,
            () => showDeliveryInfo('send')
          )}
          
          {renderActionButton(
            'Collect my packages',
            'package',
            '#10B981', // Green color to match the image
            handleCollectAndDeliver,
            () => showDeliveryInfo('collect')
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Close Button */}
      <View style={styles.closeButtonContainer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            // Handle close action - maybe navigate back or minimize
            Alert.alert('Close', 'Close the app?');
          }}
          activeOpacity={0.8}
        >
          <Feather name="x" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Info Modal */}
      {renderInfoModal()}

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

  // Action Buttons
  actionsContainer: {
    padding: 20,
    gap: 20,
  },
  actionButtonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    width: '90%',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginLeft: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionButtonInfo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Close Button
  closeButtonContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    zIndex: 1000,
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // Bottom spacing for scroll
  bottomSpacing: {
    height: 100,
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
});
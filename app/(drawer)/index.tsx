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
} from 'react-native';
import { FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
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
}

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  
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

  // FAB Options Actions
  const handleFragileDelivery = () => {
    closeFabMenu();
    setTimeout(() => {
      setShowPackageModal(true);
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
      Alert.alert(
        'Collect & Deliver',
        'This feature allows you to have items collected from your location and delivered to someone else.',
        [
          { text: 'Learn More', onPress: () => console.log('Learn more pressed') },
          { text: 'OK' }
        ]
      );
    }, 300);
  };

  const fabOptions: FABOption[] = [
    {
      id: 'fragile',
      label: 'Fragile Delivery',
      icon: 'alert-triangle',
      color: '#ff6b6b',
      gradientColors: ['#ff6b6b', '#ff8e8e'],
      action: handleFragileDelivery,
    },
    {
      id: 'send',
      label: 'Send to Someone',
      icon: 'send',
      color: '#7c3aed',
      gradientColors: ['#7c3aed', '#3b82f6'],
      action: handleSendToSomeone,
    },
    {
      id: 'collect',
      label: 'Collect & Deliver to Me',
      icon: 'package',
      color: '#10b981',
      gradientColors: ['#10b981', '#34d399'],
      action: handleCollectAndDeliver,
    },
  ];

  const handlePackageSubmit = async (packageData: PackageData) => {
    try {
      console.log('📦 Creating package with data:', packageData);
      
      const response = await createPackage(packageData);
      
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
    const animationDelay = (fabOptions.length - index - 1) * 50;
    
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
                <Feather name={option.icon as any} size={24} color="white" />
              </View>
              <Text style={styles.fabOptionLabel}>{option.label}</Text>
            </View>
          </LinearGradient>
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
  fabIcon: {
    // Additional icon styling if needed
  },

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

  // FAB Options
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabOptionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    minWidth: 200,
  },
  fabOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fabOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
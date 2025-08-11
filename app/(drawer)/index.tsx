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
  ActivityIndicator,
} from 'react-native';
import { FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import GLTHeader from '../../components/GLTHeader';
import PackageCreationModal from '../../components/PackageCreationModal';
import { 
  getPackageFormData,
  createPackage,
  type Location, 
  type Area, 
  type Agent, 
  type PackageData 
} from '../../lib/helpers/packageHelpers';
import colors from '../../theme/colors';

const { width: screenWidth } = Dimensions.get('window');

// Static locations for display animation
const displayLocations = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Eldoret', 'Nakuru',
  'Thika', 'Machakos', 'Kisii', 'Kakamega', 'Meru',
];

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  
  // Backend data for modal
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const locationTagWidth = 120;
    const visibleSetWidth = displayLocations.length * locationTagWidth;
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

  // Load data when component mounts
  useEffect(() => {
    loadPackageData();
  }, []);

  const loadPackageData = async () => {
    try {
      setIsDataLoading(true);
      setDataError(null);
      
      console.log('🔄 Loading package form data for modal...');
      
      const formData = await getPackageFormData();
      
      setLocations(formData.locations);
      setAreas(formData.areas);
      setAgents(formData.agents);
      
      console.log('✅ Package data loaded successfully:', {
        locations: formData.locations.length,
        areas: formData.areas.length,
        agents: formData.agents.length
      });
      
    } catch (error: any) {
      console.error('❌ Failed to load package data:', error);
      setDataError(error.message || 'Failed to load data');
    } finally {
      setIsDataLoading(false);
    }
  };

  const calculateCost = () => {
    if (origin && destination) {
      const estimatedCost = 500 + Math.abs(displayLocations.indexOf(origin) - displayLocations.indexOf(destination)) * 100;
      setCost(estimatedCost);
    } else {
      setCost(null);
    }
  };

  const handleFabPress = () => {
    console.log('📦 Opening package creation modal');
    console.log('📊 Data status:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length,
      isLoading: isDataLoading,
      hasError: !!dataError
    });

    // Check if data is available
    if (isDataLoading) {
      Alert.alert('Please Wait', 'Data is still loading. Please try again in a moment.');
      return;
    }

    if (dataError) {
      Alert.alert(
        'Data Error', 
        `Failed to load required data: ${dataError}\n\nWould you like to retry?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: loadPackageData }
        ]
      );
      return;
    }

    if (locations.length === 0) {
      Alert.alert(
        'No Data Available', 
        'No locations available. Please check your internet connection and try again.',
        [
          { text: 'OK' },
          { text: 'Retry', onPress: loadPackageData }
        ]
      );
      return;
    }

    if (areas.length === 0) {
      Alert.alert(
        'No Data Available', 
        'No areas available. Please check your internet connection and try again.',
        [
          { text: 'OK' },
          { text: 'Retry', onPress: loadPackageData }
        ]
      );
      return;
    }

    console.log('✅ All data checks passed, opening modal');
    setShowPackageModal(true);
  };

  const handlePackageSubmit = async (packageData: PackageData) => {
    try {
      console.log('📦 Creating package with data:', packageData);
      
      // Use the fixed createPackage function that handles data conversion
      const response = await createPackage(packageData);
      
      console.log('✅ Package created successfully:', response);
      
      Alert.alert(
        'Success! 🎉',
        `Package created successfully!\n\nTracking Code: ${response.tracking_number || 'N/A'}\n\nStatus: ${response.status || 'Pending Payment'}`,
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
      throw error; // Re-throw to let modal handle it
    }
  };

  const handleCloseModal = () => {
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

  return (
    <SafeAreaView style={styles.container}>
      <GLTHeader />

      {/* Data Loading Indicator */}
      {isDataLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading package data...</Text>
        </View>
      )}

      {/* Data Error Indicator */}
      {dataError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ Data loading failed</Text>
          <TouchableOpacity onPress={loadPackageData} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

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
            {Array(5).fill(displayLocations).flat().map((location, index) => (
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

      {/* FAB with data status indicator */}
      <LinearGradient colors={['#7c3aed', '#3b82f6']} style={styles.fabGradient}>
        <FAB 
          icon="plus" 
          style={[
            styles.fab,
            (isDataLoading || dataError || locations.length === 0) && styles.fabDisabled
          ]} 
          onPress={handleFabPress} 
          color="white"
          disabled={isDataLoading}
        />
        {/* Data status indicator on FAB */}
        {isDataLoading && (
          <View style={styles.fabLoadingIndicator}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
        {!isDataLoading && locations.length > 0 && (
          <View style={styles.fabStatusIndicator}>
            <Text style={styles.fabStatusText}>✓</Text>
          </View>
        )}
        {!isDataLoading && dataError && (
          <View style={[styles.fabStatusIndicator, styles.fabErrorIndicator]}>
            <Text style={styles.fabStatusText}>!</Text>
          </View>
        )}
      </LinearGradient>

      {/* Package Creation Modal - NOW WITH PROPER DATA! */}
      <PackageCreationModal
        visible={showPackageModal}
        onClose={handleCloseModal}
        onSubmit={handlePackageSubmit}
        locations={locations}  // ✅ Real data from API
        areas={areas}          // ✅ Real data from API  
        agents={agents}        // ✅ Real data from API
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  
  // Loading and Error States
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    marginHorizontal: 20,
    marginVertical: 5,
    borderRadius: 8,
  },
  loadingText: {
    color: '#7c3aed',
    fontSize: 12,
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 20,
    marginVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Existing styles
  locationsContainer: { paddingTop: 20, paddingBottom: 20 },
  sectionTitle: {
    fontSize: 24, fontWeight: 'bold', color: '#fff',
    textAlign: 'center', marginBottom: 15, opacity: 0.9,
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  animatedContainer: { height: 60, overflow: 'hidden' },
  animatedContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  locationTagGradient: { borderRadius: 25, padding: 2, marginHorizontal: 8 },
  locationTag: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 23, minWidth: 80, alignItems: 'center',
  },
  locationText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  scrollContainer: { flex: 1 },
  calculatorContainer: { padding: 20, marginTop: 20 },
  calculatorTitle: {
    fontSize: 24, fontWeight: 'bold', color: '#fff',
    textAlign: 'center', marginBottom: 30,
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  inputContainer: { alignItems: 'center', gap: 20 },
  inputGradientBorder: { borderRadius: 12, padding: 2, width: '90%' },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff', padding: 16, borderRadius: 10,
    fontSize: 16, width: '100%',
  },
  calculateButton: {
    paddingVertical: 16, paddingHorizontal: 40, borderRadius: 25,
    alignItems: 'center', marginTop: 10,
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  calculateButtonText: {
    color: '#fff', fontSize: 18, fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  costContainer: { marginTop: 20, width: '90%' },
  costGradientBg: {
    borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  costText: {
    fontSize: 18, fontWeight: '600', color: '#fff', textAlign: 'center',
  },
  
  // FAB styles
  fabGradient: {
    position: 'absolute', right: 20, bottom: 30, borderRadius: 28,
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  fab: { 
    backgroundColor: 'transparent', 
    elevation: 0, 
    shadowOpacity: 0 
  },
  fabDisabled: {
    opacity: 0.6,
  },
  fabLoadingIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabStatusIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabErrorIndicator: {
    backgroundColor: '#ef4444',
  },
  fabStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
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
} from 'react-native';
import { FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import GLTHeader from '../../components/GLTHeader';
import colors from '../../theme/colors';

const { width: screenWidth } = Dimensions.get('window');

// Dummy locations for demonstration
const locations = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Eldoret', 'Nakuru', 'Thika', 'Machakos', 'Kisii', 'Kakamega', 'Meru'
];

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: -screenWidth * 2, // Adjust multiplier based on content width
          duration: 20000, // 20 seconds for slow pace
          useNativeDriver: true,
        })
      ).start();
    };

    animate();
  }, [scrollX]);

  // Dummy cost calculation
  const calculateCost = () => {
    if (origin && destination) {
      const estimatedCost = 500 + Math.abs(locations.indexOf(origin) - locations.indexOf(destination)) * 100;
      setCost(estimatedCost);
    } else {
      setCost(null);
    }
  };

  const handleFabPress = () => {
    console.log('FAB pressed');
    // Add navigation or modal later
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
      {/* Custom Header */}
      <GLTHeader />

      {/* Animated Locations Section */}
      <View style={styles.locationsContainer}>
        <Text style={styles.sectionTitle}>Available Locations</Text>
        <View style={styles.animatedContainer}>
          <Animated.View
            style={[
              styles.animatedContent,
              {
                transform: [{ translateX: scrollX }],
              },
            ]}
          >
            {/* Render locations multiple times for continuous loop */}
            {[...locations, ...locations, ...locations].map((location, index) => (
              <LocationTag key={`${location}-${index}`} location={location} />
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Cost Calculator Section */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.calculatorContainer}>
          <Text style={styles.calculatorTitle}>Cost Calculator</Text>
          
          <View style={styles.inputContainer}>
            <LinearGradient
              colors={['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.inputGradientBorder}
            >
              <TextInput
                style={styles.input}
                placeholder="From Location"
                placeholderTextColor="#888"
                value={origin}
                onChangeText={setOrigin}
              />
            </LinearGradient>

            <LinearGradient
              colors={['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.inputGradientBorder}
            >
              <TextInput
                style={styles.input}
                placeholder="To Location"
                placeholderTextColor="#888"
                value={destination}
                onChangeText={setDestination}
              />
            </LinearGradient>

            <TouchableOpacity onPress={calculateCost} activeOpacity={0.8}>
              <LinearGradient
                colors={['#7c3aed', '#3b82f6', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.calculateButton}
              >
                <Text style={styles.calculateButtonText}>Calculate Cost</Text>
              </LinearGradient>
            </TouchableOpacity>

            {cost !== null && (
              <View style={styles.costContainer}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.2)', 'rgba(59, 130, 246, 0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.costGradientBg}
                >
                  <Text style={styles.costText}>
                    Estimated Cost: KSh {cost.toLocaleString()}
                  </Text>
                </LinearGradient>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <LinearGradient
        colors={['#7c3aed', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabGradient}
      >
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleFabPress}
          color="white"
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  locationsContainer: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    marginLeft: 16,
    opacity: 0.9,
  },
  animatedContainer: {
    height: 60,
    overflow: 'hidden',
  },
  animatedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  locationTagGradient: {
    borderRadius: 25,
    padding: 2, // This creates the gradient border effect
    marginHorizontal: 8,
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
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  calculatorContainer: {
    padding: 20,
    marginTop: 20,
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
    gap: 20,
  },
  inputGradientBorder: {
    borderRadius: 12,
    padding: 2,
    width: '90%',
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
    width: '90%',
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
  fabGradient: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    borderRadius: 28,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
});
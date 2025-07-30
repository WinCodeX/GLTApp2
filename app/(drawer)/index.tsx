import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { FAB } from 'react-native-paper';
import GLTHeader from '../../components/GLTHeader'; // ✅ your new header
import colors from '../../theme/colors'; // 🔁 dark theme colors

// Dummy locations for demonstration
const locations = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Eldoret', 'Nakuru', 'Thika', 'Machakos', 'Kisii', 'Kakamega', 'Meru'
];

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cost, setCost] = useState<number | null>(null);

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

  return (
    <SafeAreaView style={styles.container}>
      {/* ✅ Custom Header */}
      <GLTHeader />

      {/* Body */}
      <View style={styles.content}>
        <Text style={styles.welcome}>Welcome to GLT Logistics</Text>

        {/* Location Tags */}
        <Text style={styles.sectionTitle}>Available Locations</Text>
        <View style={styles.locationTags}>
          {locations.map((location) => (
            <TouchableOpacity
              key={location}
              style={styles.locationTag}
              onPress={() => setOrigin(location)}
            >
              <Text style={styles.locationText}>{location}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cost Calculator Section */}
        <Text style={styles.sectionTitle}>Cost Calculator</Text>
        <TextInput
          style={styles.input}
          placeholder="From Location"
          value={origin}
          onChangeText={setOrigin}
        />
        <TextInput
          style={styles.input}
          placeholder="To Location"
          value={destination}
          onChangeText={setDestination}
        />

        <FAB
          icon="calculator"
          style={styles.fab}
          onPress={calculateCost}
          color="white"
        />

        {cost !== null && (
          <Text style={styles.costText}>
            Estimated Cost: KSh {cost}
          </Text>
        )}
      </View>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleFabPress}
        color="white"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    color: colors.primary,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
  },
  locationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  locationTag: {
    backgroundColor: '#2a2a3d',
    paddingVertical: 8,
    paddingHorizontal: 15,
    margin: 5,
    borderRadius: 20,
  },
  locationText: {
    color: colors.primary,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#2a2a3d',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    width: '80%',
    borderWidth: 1,
    borderColor: '#444',
  },
  costText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 10,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    width: 56,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
});
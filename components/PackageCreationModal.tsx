// components/PackageCreationModal.tsx - DEBUG VERSION
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { 
  getPackageFormData,
  type Location, 
  type Area, 
  type Agent,
  type PackageData 
} from '../lib/helpers/packageHelpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface PackageCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: PackageData) => Promise<void>;
}

export default function PackageCreationModal({
  visible,
  onClose,
  onSubmit
}: PackageCreationModalProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Modal opened');
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      console.log('🐛 DEBUG: Modal visible, starting load...');
      setDebugInfo('Modal visible, loading data...');
      loadData();
      
      // Start animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadData = async () => {
    try {
      setIsDataLoading(true);
      setDebugInfo('Loading data from API...');
      
      const formData = await getPackageFormData();
      
      setLocations(formData.locations);
      setAreas(formData.areas);
      setAgents(formData.agents);
      
      setDebugInfo(`Data loaded: ${formData.locations.length} locations, ${formData.areas.length} areas, ${formData.agents.length} agents`);
      
      console.log('🐛 DEBUG: Data set in state:', {
        locations: formData.locations.length,
        areas: formData.areas.length,
        agents: formData.agents.length
      });
      
    } catch (error: any) {
      console.error('🐛 DEBUG: Error loading data:', error);
      setDataError(error.message);
      setDebugInfo(`Error: ${error.message}`);
    } finally {
      setIsDataLoading(false);
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

  console.log('🐛 DEBUG: Render called with:', {
    visible,
    isDataLoading,
    locationsCount: locations.length,
    areasCount: areas.length,
    agentsCount: agents.length,
    dataError
  });

  return (
    <Modal visible={visible} transparent animationType="none">
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
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Debug Package Modal</Text>
              <View style={styles.placeholder} />
            </View>

            {/* Debug Info Section */}
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>🐛 Debug Information</Text>
              <Text style={styles.debugText}>Status: {debugInfo}</Text>
              <Text style={styles.debugText}>Loading: {isDataLoading ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Locations: {locations.length}</Text>
              <Text style={styles.debugText}>Areas: {areas.length}</Text>
              <Text style={styles.debugText}>Agents: {agents.length}</Text>
              {dataError && <Text style={styles.errorText}>Error: {dataError}</Text>}
            </View>

            {/* Content */}
            <View style={styles.content}>
              {isDataLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#7c3aed" />
                  <Text style={styles.loadingText}>Loading data...</Text>
                </View>
              ) : dataError ? (
                <View style={styles.errorContainer}>
                  <Feather name="alert-circle" size={48} color="#ef4444" />
                  <Text style={styles.errorTitle}>Error Loading Data</Text>
                  <Text style={styles.errorMessage}>{dataError}</Text>
                  <TouchableOpacity onPress={loadData} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={styles.scrollView}>
                  <Text style={styles.sectionTitle}>📍 Locations ({locations.length})</Text>
                  {locations.length === 0 ? (
                    <Text style={styles.emptyText}>No locations loaded</Text>
                  ) : (
                    locations.map((location, index) => (
                      <View key={location.id} style={styles.itemContainer}>
                        <View style={styles.itemInitials}>
                          <Text style={styles.itemInitialsText}>
                            {location.initials || location.name.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{location.name}</Text>
                          <Text style={styles.itemId}>ID: {location.id}</Text>
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={styles.sectionTitle}>🏢 Sample Areas (First 5)</Text>
                  {areas.slice(0, 5).map((area, index) => (
                    <View key={area.id} style={styles.itemContainer}>
                      <View style={styles.itemInitials}>
                        <Text style={styles.itemInitialsText}>
                          {area.initials || area.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{area.name}</Text>
                        <Text style={styles.itemId}>ID: {area.id}, Location: {area.location_id}</Text>
                      </View>
                    </View>
                  ))}

                  <Text style={styles.sectionTitle}>👥 Sample Agents (First 5)</Text>
                  {agents.slice(0, 5).map((agent, index) => (
                    <View key={agent.id} style={styles.itemContainer}>
                      <View style={styles.itemInitials}>
                        <Text style={styles.itemInitialsText}>
                          {agent.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{agent.name}</Text>
                        <Text style={styles.itemId}>ID: {agent.id}, Area: {agent.area_id}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: SCREEN_HEIGHT * 0.9,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 34,
  },
  debugSection: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    padding: 15,
    margin: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  debugTitle: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  errorMessage: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 15,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    color: '#7c3aed',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInitialsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  itemId: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});
// components/PackageCreationModal.tsx - MINIMAL ADDITIONS ONLY
import React, { useState, useRef, useEffect } from 'react';
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
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { 
  getPackageFormData,
  getPackagePricing, 
  validatePackageFormData,
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

const STEP_TITLES = [
  'Origin Area',
  'Receiver Details',
  'Delivery Method',
  'Destination',
  'Delivery Location',
  'Confirm Details'
];

export default function PackageCreationModal({
  visible,
  onClose,
  onSubmit
}: PackageCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Simple slide animation - only one animation
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Data states
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form data
  const [packageData, setPackageData] = useState<PackageData>({
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    origin_area_id: '',
    destination_area_id: '',
    origin_agent_id: '',
    destination_agent_id: '',
    delivery_type: 'doorstep'
  });

  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);

  // ONLY add search - nothing else
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load data when modal becomes visible
  useEffect(() => {
    if (visible) {
      console.log('📦 Modal opened, loading data...');
      resetForm();
      loadModalData();
      
      // Simple slide up animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadModalData = async () => {
    try {
      setIsDataLoading(true);
      setDataError(null);
      
      const formData = await getPackageFormData();
      
      setLocations(formData.locations);
      setAreas(formData.areas);
      setAgents(formData.agents);
      
      console.log('✅ Data loaded:', {
        locations: formData.locations.length,
        areas: formData.areas.length,
        agents: formData.agents.length
      });
      
    } catch (error: any) {
      console.error('❌ Failed to load modal data:', error);
      setDataError(error.message || 'Failed to load data');
    } finally {
      setIsDataLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setPackageData({
      sender_name: '',
      sender_phone: '',
      receiver_name: '',
      receiver_phone: '',
      origin_area_id: '',
      destination_area_id: '',
      origin_agent_id: '',
      destination_agent_id: '',
      delivery_type: 'doorstep'
    });
    setDeliveryLocation('');
    setEstimatedCost(null);
    setIsSubmitting(false);
    setSearchQuery(''); // Reset search
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

  // Calculate simple fallback cost when needed
  const calculateCost = () => {
    if (!packageData.origin_area_id) return;
    
    let destinationAreaId = packageData.destination_area_id;
    
    if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
      const selectedAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
      destinationAreaId = selectedAgent?.area_id || '';
    }

    if (!destinationAreaId) return;

    const originArea = areas.find(a => a.id === packageData.origin_area_id);
    const destinationArea = areas.find(a => a.id === destinationAreaId);
    
    if (!originArea || !destinationArea) return;
    
    const isIntraArea = packageData.origin_area_id === destinationAreaId;
    const isIntraLocation = originArea.location_id === destinationArea.location_id;
    
    let baseCost = 0;
    
    if (isIntraArea) {
      baseCost = packageData.delivery_type === 'doorstep' ? 280 : 150;
    } else if (isIntraLocation) {
      baseCost = packageData.delivery_type === 'doorstep' ? 320 : 150;
    } else {
      baseCost = packageData.delivery_type === 'doorstep' ? 380 : 150;
    }
    
    setEstimatedCost(baseCost);
  };

  const updatePackageData = (field: keyof PackageData, value: string) => {
    setPackageData(prev => ({ ...prev, [field]: value }));
  };

  const getSelectedOriginArea = () => {
    return areas.find(area => area.id === packageData.origin_area_id);
  };

  const getSelectedDestinationArea = () => {
    if (packageData.delivery_type === 'agent' && packageData.destination_agent_id) {
      const selectedAgent = agents.find(agent => agent.id === packageData.destination_agent_id);
      return areas.find(area => area.id === selectedAgent?.area_id);
    }
    return areas.find(area => area.id === packageData.destination_area_id);
  };

  const getSelectedDestinationAgent = () => {
    return agents.find(agent => agent.id === packageData.destination_agent_id);
  };

  // ONLY add simple search filtering - nothing complex
  const getFilteredAreas = () => {
    if (!searchQuery.trim()) return areas;
    
    return areas.filter(area =>
      area.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      area.location?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // ONLY add simple grouping by location - no complex sorting
  const getGroupedAreas = () => {
    const filteredAreas = getFilteredAreas();
    
    // Group by location
    const grouped = filteredAreas.reduce((acc, area) => {
      const locationName = area.location?.name || 'Unknown Location';
      if (!acc[locationName]) {
        acc[locationName] = [];
      }
      acc[locationName].push(area);
      return acc;
    }, {} as Record<string, Area[]>);

    // Return grouped areas, sorted by location name
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([locationName, areas]) => ({
        locationName,
        areas: areas.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      }));
  };

  const isCurrentStepValid = () => {
    switch (currentStep) {
      case 0: return packageData.origin_area_id.length > 0;
      case 1: return packageData.receiver_name.trim().length > 0 && packageData.receiver_phone.trim().length > 0;
      case 2: return packageData.delivery_type.length > 0;
      case 3: 
        if (packageData.delivery_type === 'agent') {
          return packageData.destination_agent_id.length > 0;
        } else {
          return packageData.destination_area_id.length > 0;
        }
      case 4:
        if (packageData.delivery_type === 'doorstep') {
          return deliveryLocation.trim().length > 0;
        }
        return true;
      case 5: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (currentStep < STEP_TITLES.length - 1 && isCurrentStepValid()) {
      // Skip delivery location step for agent delivery
      if (currentStep === 3 && packageData.delivery_type === 'agent') {
        setCurrentStep(5);
        calculateCost(); // Calculate cost when we reach confirmation
      } else {
        setCurrentStep(prev => {
          const newStep = prev + 1;
          if (newStep === 5) calculateCost(); // Calculate cost when we reach confirmation
          return newStep;
        });
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      if (currentStep === 5 && packageData.delivery_type === 'agent') {
        setCurrentStep(3);
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentStepValid()) return;

    setIsSubmitting(true);
    try {
      const finalPackageData = {
        ...packageData,
        sender_name: 'Current User',
        sender_phone: '+254700000000',
      };

      console.log('📦 Submitting package data:', finalPackageData);
      await onSubmit(finalPackageData);
      closeModal();
    } catch (error: any) {
      console.error('❌ Failed to submit package:', error);
      Alert.alert('Error', error.message || 'Failed to create package. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryDataLoad = () => {
    console.log('🔄 Retrying data load...');
    loadModalData();
  };

  // Show loading state while fetching data
  if (isDataLoading) {
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
    <Modal>
  );
}

// Styles - same as working version with MINIMAL additions
const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: SCREEN_HEIGHT * 0.6,
    width: SCREEN_WIDTH,
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonAbsolute: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  
  // Progress bar
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Content styles
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContent: {
    flex: 1,
    minHeight: 400,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 30,
  },
  
  // ONLY add search styles - minimal
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    paddingHorizontal: 16,
    minHeight: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 12,
  },
  
  // ONLY add location header styles - minimal
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  locationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
  },
  locationHeaderCount: {
    fontSize: 12,
    color: '#888',
  },
  
  // Selection list styles - same as working version
  selectionList: {
    flex: 1,
  },
  selectionItem: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  selectedItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  selectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  selectionInitials: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  selectionInitialsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  selectionInfo: {
    flex: 1,
  },
  selectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  selectionLocation: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  selectionPhone: {
    fontSize: 12,
    color: '#666',
  },
  
  // ONLY add simple no results - minimal
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  
  // Form styles - same as working version
  formContainer: {
    gap: 20,
    paddingVertical: 10,
  },
  input: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  
  // Delivery options - same as working version
  deliveryOptions: {
    gap: 16,
  },
  deliveryOption: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  selectedDeliveryOption: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: '#7c3aed',
  },
  deliveryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  deliveryOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  deliveryOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deliveryOptionSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  
  // Confirmation styles - same as working version
  confirmationContainer: {
    gap: 24,
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
  },
  confirmationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 12,
  },
  confirmationDetail: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  confirmationSubDetail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  routeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routePoint: {
    alignItems: 'center',
    flex: 1,
  },
  routeAreaInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 4,
  },
  routeAreaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
  },
  routeLocationName: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  agentInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  deliveryLocationInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  estimatedCost: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
  },
  pricingError: {
    fontSize: 14,
    color: '#ef4444',
  },
  
  // Navigation - same as working version
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  spacer: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
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
  
  // Loading and error - same as working version
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={styles.loadingTitle}>Loading Package Data</Text>
                <Text style={styles.loadingSubtitle}>
                  Fetching locations, areas, and agents...
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // Show error state if data loading failed
  if (dataError) {
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
              <View style={styles.errorContainer}>
                <TouchableOpacity onPress={closeModal} style={styles.closeButtonAbsolute}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
                
                <Feather name="alert-circle" size={64} color="#ef4444" />
                <Text style={styles.errorTitle}>Failed to Load Data</Text>
                <Text style={styles.errorMessage}>
                  {dataError}
                  {'\n\n'}Check your internet connection and make sure your API is running.
                </Text>
                
                <View style={styles.errorButtons}>
                  <TouchableOpacity onPress={retryDataLoad} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closeModal} style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // Simple progress indicator
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

  // Step 0: Origin Area Selection with MINIMAL additions
  const renderOriginAreaSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Origin Area</Text>
      <Text style={styles.stepSubtitle}>Where is the package coming from?</Text>
      
      {/* ONLY add search input - simple */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search areas..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
        {getGroupedAreas().map((group, groupIndex) => (
          <View key={groupIndex}>
            {/* Simple location header */}
            <View style={styles.locationHeader}>
              <Text style={styles.locationHeaderText}>{group.locationName}</Text>
              <Text style={styles.locationHeaderCount}>({group.areas.length})</Text>
            </View>
            
            {/* Areas in this location */}
            {group.areas.map((area) => (
              <TouchableOpacity
                key={area.id}
                style={[
                  styles.selectionItem,
                  packageData.origin_area_id === area.id && styles.selectedItem
                ]}
                onPress={() => updatePackageData('origin_area_id', area.id)}
              >
                <View style={styles.selectionItemContent}>
                  <View style={styles.selectionInitials}>
                    <Text style={styles.selectionInitialsText}>
                      {area.initials || area.name?.substring(0, 2).toUpperCase() || 'AR'}
                    </Text>
                  </View>
                  <View style={styles.selectionInfo}>
                    <Text style={styles.selectionName}>{area.name || 'Unknown Area'}</Text>
                    {area.location?.name && (
                      <Text style={styles.selectionLocation}>{area.location.name}</Text>
                    )}
                  </View>
                  {packageData.origin_area_id === area.id && (
                    <Feather name="check-circle" size={20} color="#10b981" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        
        {/* Simple no results */}
        {getFilteredAreas().length === 0 && (
          <View style={styles.noResultsContainer}>
            <Feather name="search" size={48} color="#666" />
            <Text style={styles.noResultsTitle}>No areas found</Text>
            <Text style={styles.noResultsText}>Try a different search term</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  // All other steps remain exactly the same as working version
  const renderReceiverDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Receiver Details</Text>
      <Text style={styles.stepSubtitle}>Who will receive this package?</Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Receiver's Full Name"
          placeholderTextColor="#888"
          value={packageData.receiver_name}
          onChangeText={(value) => updatePackageData('receiver_name', value)}
          autoCapitalize="words"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Receiver's Phone (+254...)"
          placeholderTextColor="#888"
          value={packageData.receiver_phone}
          onChangeText={(value) => updatePackageData('receiver_phone', value)}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderDeliveryMethodSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Method</Text>
      <Text style={styles.stepSubtitle}>How should the package be delivered?</Text>
      
      <View style={styles.deliveryOptions}>
        <TouchableOpacity
          style={[
            styles.deliveryOption,
            packageData.delivery_type === 'agent' && styles.selectedDeliveryOption
          ]}
          onPress={() => updatePackageData('delivery_type', 'agent')}
        >
          <View style={styles.deliveryOptionContent}>
            <Feather name="user" size={24} color="#fff" />
            <View style={styles.deliveryOptionText}>
              <Text style={styles.deliveryOptionTitle}>Agent Pickup</Text>
              <Text style={styles.deliveryOptionSubtitle}>Collect from our agent</Text>
            </View>
            {packageData.delivery_type === 'agent' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deliveryOption,
            packageData.delivery_type === 'doorstep' && styles.selectedDeliveryOption
          ]}
          onPress={() => updatePackageData('delivery_type', 'doorstep')}
        >
          <View style={styles.deliveryOptionContent}>
            <Feather name="home" size={24} color="#fff" />
            <View style={styles.deliveryOptionText}>
              <Text style={styles.deliveryOptionTitle}>Doorstep Delivery</Text>
              <Text style={styles.deliveryOptionSubtitle}>Direct delivery to address</Text>
            </View>
            {packageData.delivery_type === 'doorstep' && (
              <Feather name="check-circle" size={20} color="#10b981" />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDestinationSelection = () => {
    if (packageData.delivery_type === 'agent') {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Select Receiving Agent</Text>
          <Text style={styles.stepSubtitle}>Which agent will handle delivery?</Text>
          
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
            {agents.map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.selectionItem,
                  packageData.destination_agent_id === agent.id && styles.selectedItem
                ]}
                onPress={() => updatePackageData('destination_agent_id', agent.id)}
              >
                <View style={styles.selectionItemContent}>
                  <View style={styles.selectionInitials}>
                    <Text style={styles.selectionInitialsText}>
                      {agent.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.selectionInfo}>
                    <Text style={styles.selectionName}>{agent.name}</Text>
                    <Text style={styles.selectionLocation}>
                      {agent.area?.name} • {agent.area?.location?.name}
                    </Text>
                    <Text style={styles.selectionPhone}>{agent.phone}</Text>
                  </View>
                  {packageData.destination_agent_id === agent.id && (
                    <Feather name="check-circle" size={20} color="#10b981" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    } else {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Select Destination Area</Text>
          <Text style={styles.stepSubtitle}>Which area should we deliver to?</Text>
          
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
            {areas.map((area) => (
              <TouchableOpacity
                key={area.id}
                style={[
                  styles.selectionItem,
                  packageData.destination_area_id === area.id && styles.selectedItem
                ]}
                onPress={() => updatePackageData('destination_area_id', area.id)}
              >
                <View style={styles.selectionItemContent}>
                  <View style={styles.selectionInitials}>
                    <Text style={styles.selectionInitialsText}>
                      {area.initials || area.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.selectionInfo}>
                    <Text style={styles.selectionName}>{area.name}</Text>
                    {area.location && (
                      <Text style={styles.selectionLocation}>{area.location.name}</Text>
                    )}
                  </View>
                  {packageData.destination_area_id === area.id && (
                    <Feather name="check-circle" size={20} color="#10b981" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
  };

  const renderDeliveryLocation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Delivery Location</Text>
      <Text style={styles.stepSubtitle}>Provide the exact delivery address</Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter specific address, building name, floor, etc."
          placeholderTextColor="#888"
          value={deliveryLocation}
          onChangeText={setDeliveryLocation}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Confirm Package Details</Text>
      <Text style={styles.stepSubtitle}>Review all information before submitting</Text>
      
      <View style={styles.confirmationContainer}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeAreaInitials}>{getSelectedOriginArea()?.initials || '--'}</Text>
              <Text style={styles.routeAreaName}>{getSelectedOriginArea()?.name || 'Unknown'}</Text>
              <Text style={styles.routeLocationName}>{getSelectedOriginArea()?.location?.name || 'Unknown'}</Text>
            </View>
            <Feather name="arrow-right" size={20} color="#7c3aed" />
            <View style={styles.routePoint}>
              <Text style={styles.routeAreaInitials}>{getSelectedDestinationArea()?.initials || '--'}</Text>
              <Text style={styles.routeAreaName}>{getSelectedDestinationArea()?.name || 'Unknown'}</Text>
              <Text style={styles.routeLocationName}>{getSelectedDestinationArea()?.location?.name || 'Unknown'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Receiver</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_name}</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_phone}</Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Delivery Method</Text>
          <Text style={styles.confirmationDetail}>
            {packageData.delivery_type === 'doorstep' ? 'Doorstep Delivery' : 'Agent Pickup'}
          </Text>
          
          {packageData.delivery_type === 'agent' && getSelectedDestinationAgent() && (
            <View style={styles.agentInfo}>
              <Text style={styles.confirmationDetail}>Agent: {getSelectedDestinationAgent()?.name}</Text>
              <Text style={styles.confirmationSubDetail}>{getSelectedDestinationAgent()?.phone}</Text>
            </View>
          )}

          {packageData.delivery_type === 'doorstep' && deliveryLocation && (
            <View style={styles.deliveryLocationInfo}>
              <Text style={styles.confirmationSubDetail}>Delivery Address:</Text>
              <Text style={styles.confirmationDetail}>{deliveryLocation}</Text>
            </View>
          )}
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Estimated Cost</Text>
          {estimatedCost ? (
            <Text style={styles.estimatedCost}>KES {estimatedCost.toLocaleString()}</Text>
          ) : (
            <Text style={styles.pricingError}>Unable to calculate cost</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderOriginAreaSelection();
      case 1: return renderReceiverDetails();
      case 2: return renderDeliveryMethodSelection();
      case 3: return renderDestinationSelection();
      case 4: return renderDeliveryLocation();
      case 5: return renderConfirmation();
      default: return renderOriginAreaSelection();
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
            !isCurrentStepValid() && styles.disabledButton
          ]}
          disabled={!isCurrentStepValid()}
        >
          <Text style={[
            styles.nextButtonText,
            !isCurrentStepValid() && styles.disabledButtonText
          ]}>
            Next
          </Text>
          <Feather name="arrow-right" size={20} color={isCurrentStepValid() ? "#fff" : "#666"} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          onPress={handleSubmit} 
          style={[
            styles.submitButton,
            (!isCurrentStepValid() || isSubmitting) && styles.disabledButton
          ]}
          disabled={!isCurrentStepValid() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={[
                styles.submitButtonText,
                (!isCurrentStepValid() || isSubmitting) && styles.disabledButtonText
              ]}>
                Create Package
              </Text>
              <Feather name="check" size={20} color={isCurrentStepValid() && !isSubmitting ? "#fff" : "#666"} />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
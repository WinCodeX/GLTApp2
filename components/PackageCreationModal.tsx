// components/PackageCreationModal.tsx
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
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Location {
  id: string;
  name: string;
  initials: string;
}

interface Agent {
  id: string;
  name: string;
  phone: string;
  area_id: string;
}

interface PackageCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (packageData: any) => Promise<void>;
  locations: Location[];
  agents: Agent[];
}

type DeliveryType = 'doorstep' | 'agent' | 'mixed';

interface PackageData {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_area_id: string;
  destination_area_id: string;
  origin_agent_id?: string;
  destination_agent_id?: string;
  delivery_type: DeliveryType;
}

const STEP_TITLES = [
  'Origin Location',
  'Sender Details',
  'Destination Location',
  'Receiver Details',
  'Delivery Method',
  'Confirm Details'
];

export default function PackageCreationModal({
  visible,
  onClose,
  onSubmit,
  locations,
  agents
}: PackageCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

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

  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
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
      setEstimatedCost(null);
      
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep / (STEP_TITLES.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  useEffect(() => {
    // Calculate estimated cost when origin, destination, and delivery type are set
    if (packageData.origin_area_id && packageData.destination_area_id && packageData.delivery_type) {
      calculateEstimatedCost();
    }
  }, [packageData.origin_area_id, packageData.destination_area_id, packageData.delivery_type]);

  const calculateEstimatedCost = () => {
    const isIntraArea = packageData.origin_area_id === packageData.destination_area_id;
    
    let baseCost = 0;
    if (isIntraArea) {
      baseCost = packageData.delivery_type === 'doorstep' ? 150 : 
                 packageData.delivery_type === 'agent' ? 100 : 125;
    } else {
      baseCost = packageData.delivery_type === 'doorstep' ? 300 : 
                 packageData.delivery_type === 'agent' ? 200 : 250;
    }
    
    setEstimatedCost(baseCost);
  };

  const updatePackageData = (field: keyof PackageData, value: string) => {
    setPackageData(prev => ({ ...prev, [field]: value }));
  };

  const isCurrentStepValid = () => {
    switch (currentStep) {
      case 0: return packageData.origin_area_id.length > 0;
      case 1: return packageData.sender_name.trim().length > 0 && packageData.sender_phone.trim().length > 0;
      case 2: return packageData.destination_area_id.length > 0;
      case 3: return packageData.receiver_name.trim().length > 0 && packageData.receiver_phone.trim().length > 0;
      case 4: return packageData.delivery_type.length > 0;
      case 5: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (currentStep < STEP_TITLES.length - 1 && isCurrentStepValid()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentStepValid()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(packageData);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to create package. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOriginAgents = () => {
    return agents.filter(agent => agent.area_id === packageData.origin_area_id);
  };

  const getDestinationAgents = () => {
    return agents.filter(agent => agent.area_id === packageData.destination_area_id);
  };

  const getSelectedOriginLocation = () => {
    return locations.find(loc => loc.id === packageData.origin_area_id);
  };

  const getSelectedDestinationLocation = () => {
    return locations.find(loc => loc.id === packageData.destination_area_id);
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBackground}>
        <Animated.View
          style={[
            styles.progressForeground,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
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
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{STEP_TITLES[currentStep]}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderLocationSelection = (
    selectedId: string,
    onSelect: (id: string) => void,
    title: string
  ) => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      <ScrollView style={styles.locationsList} showsVerticalScrollIndicator={false}>
        {locations.map((location) => (
          <TouchableOpacity
            key={location.id}
            style={[
              styles.locationItem,
              selectedId === location.id && styles.selectedLocationItem
            ]}
            onPress={() => onSelect(location.id)}
          >
            <LinearGradient
              colors={selectedId === location.id ? 
                ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
              style={styles.locationItemGradient}
            >
              <View style={styles.locationItemContent}>
                <View style={styles.locationInitials}>
                  <Text style={styles.locationInitialsText}>{location.initials}</Text>
                </View>
                <Text style={styles.locationName}>{location.name}</Text>
                {selectedId === location.id && (
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderDetailsForm = (
    nameValue: string,
    phoneValue: string,
    onNameChange: (value: string) => void,
    onPhoneChange: (value: string) => void,
    title: string,
    subtitle: string
  ) => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
      
      <View style={styles.formContainer}>
        <LinearGradient colors={['rgba(124, 58, 237, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.inputGradientBorder}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#888"
            value={nameValue}
            onChangeText={onNameChange}
            autoCapitalize="words"
          />
        </LinearGradient>
        
        <LinearGradient colors={['rgba(124, 58, 237, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.inputGradientBorder}>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#888"
            value={phoneValue}
            onChangeText={onPhoneChange}
            keyboardType="phone-pad"
          />
        </LinearGradient>
      </View>
    </View>
  );

  const renderDeliveryMethod = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Delivery Method</Text>
      <Text style={styles.stepSubtitle}>Choose how the package should be delivered</Text>
      
      <View style={styles.deliveryOptions}>
        {[
          { type: 'doorstep' as DeliveryType, title: 'Doorstep Delivery', subtitle: 'Direct delivery to address', icon: 'home' },
          { type: 'agent' as DeliveryType, title: 'Agent Pickup', subtitle: 'Collect from our agent', icon: 'user' },
          { type: 'mixed' as DeliveryType, title: 'Mixed Delivery', subtitle: 'Combination of both', icon: 'shuffle' }
        ].map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.deliveryOption,
              packageData.delivery_type === option.type && styles.selectedDeliveryOption
            ]}
            onPress={() => updatePackageData('delivery_type', option.type)}
          >
            <LinearGradient
              colors={packageData.delivery_type === option.type ? 
                ['rgba(124, 58, 237, 0.3)', 'rgba(59, 130, 246, 0.3)'] : 
                ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
              style={styles.deliveryOptionGradient}
            >
              <View style={styles.deliveryOptionContent}>
                <Feather name={option.icon as any} size={24} color="#fff" />
                <View style={styles.deliveryOptionText}>
                  <Text style={styles.deliveryOptionTitle}>{option.title}</Text>
                  <Text style={styles.deliveryOptionSubtitle}>{option.subtitle}</Text>
                </View>
                {packageData.delivery_type === option.type && (
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Confirm Package Details</Text>
      <Text style={styles.stepSubtitle}>Review all information before submitting</Text>
      
      <View style={styles.confirmationContainer}>
        {/* Route Information */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Route</Text>
          <View style={styles.routeDisplay}>
            <View style={styles.routePoint}>
              <Text style={styles.routeLocationInitials}>{getSelectedOriginLocation()?.initials}</Text>
              <Text style={styles.routeLocationName}>{getSelectedOriginLocation()?.name}</Text>
            </View>
            <Feather name="arrow-right" size={20} color="#7c3aed" />
            <View style={styles.routePoint}>
              <Text style={styles.routeLocationInitials}>{getSelectedDestinationLocation()?.initials}</Text>
              <Text style={styles.routeLocationName}>{getSelectedDestinationLocation()?.name}</Text>
            </View>
          </View>
        </View>

        {/* Sender Information */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Sender</Text>
          <Text style={styles.confirmationDetail}>{packageData.sender_name}</Text>
          <Text style={styles.confirmationDetail}>{packageData.sender_phone}</Text>
        </View>

        {/* Receiver Information */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Receiver</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_name}</Text>
          <Text style={styles.confirmationDetail}>{packageData.receiver_phone}</Text>
        </View>

        {/* Delivery Method */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationSectionTitle}>Delivery Method</Text>
          <Text style={styles.confirmationDetail}>
            {packageData.delivery_type === 'doorstep' ? 'Doorstep Delivery' :
             packageData.delivery_type === 'agent' ? 'Agent Pickup' : 'Mixed Delivery'}
          </Text>
        </View>

        {/* Estimated Cost */}
        {estimatedCost && (
          <View style={styles.costSection}>
            <LinearGradient colors={['rgba(16, 185, 129, 0.2)', 'rgba(59, 130, 246, 0.2)']} style={styles.costGradientBg}>
              <Text style={styles.costLabel}>Estimated Cost</Text>
              <Text style={styles.costAmount}>KSh {estimatedCost.toLocaleString()}</Text>
            </LinearGradient>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderLocationSelection(
          packageData.origin_area_id,
          (id) => updatePackageData('origin_area_id', id),
          'Select origin location'
        );
      case 1:
        return renderDetailsForm(
          packageData.sender_name,
          packageData.sender_phone,
          (value) => updatePackageData('sender_name', value),
          (value) => updatePackageData('sender_phone', value),
          'Sender Information',
          'Enter the sender\'s details'
        );
      case 2:
        return renderLocationSelection(
          packageData.destination_area_id,
          (id) => updatePackageData('destination_area_id', id),
          'Select destination location'
        );
      case 3:
        return renderDetailsForm(
          packageData.receiver_name,
          packageData.receiver_phone,
          (value) => updatePackageData('receiver_name', value),
          (value) => updatePackageData('receiver_phone', value),
          'Receiver Information',
          'Enter the receiver\'s details'
        );
      case 4:
        return renderDeliveryMethod();
      case 5:
        return renderConfirmation();
      default:
        return null;
    }
  };

  const renderFooter = () => (
    <View style={styles.footer}>
      <View style={styles.buttonContainer}>
        {currentStep > 0 && (
          <TouchableOpacity onPress={prevStep} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          onPress={currentStep === STEP_TITLES.length - 1 ? handleSubmit : nextStep}
          style={[styles.primaryButton, !isCurrentStepValid() && styles.disabledButton]}
          disabled={!isCurrentStepValid() || isSubmitting}
        >
          <LinearGradient 
            colors={isCurrentStepValid() ? ['#7c3aed', '#3b82f6'] : ['#6b7280', '#6b7280']} 
            style={styles.primaryButtonGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {currentStep === STEP_TITLES.length - 1 ? 'Create Package' : 'Next'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

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
            {renderProgressBar()}
            {renderHeader()}
            <KeyboardAvoidingView
              style={styles.content}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {renderCurrentStep()}
            </KeyboardAvoidingView>
            {renderFooter()}
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  progressText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
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
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  locationsList: {
    flex: 1,
  },
  locationItem: {
    marginBottom: 12,
  },
  selectedLocationItem: {
    // Additional styling for selected item if needed
  },
  locationItemGradient: {
    borderRadius: 12,
    padding: 1,
  },
  locationItemContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 11,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationInitialsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  formContainer: {
    gap: 20,
  },
  inputGradientBorder: {
    borderRadius: 12,
    padding: 2,
  },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
  },
  deliveryOptions: {
    gap: 16,
  },
  deliveryOption: {
    // Container styles
  },
  selectedDeliveryOption: {
    // Additional styling for selected option if needed
  },
  deliveryOptionGradient: {
    borderRadius: 12,
    padding: 1,
  },
  deliveryOptionContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 11,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  deliveryOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  deliveryOptionSubtitle: {
    color: '#888',
    fontSize: 14,
  },
  confirmationContainer: {
    gap: 20,
  },
  confirmationSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  confirmationSectionTitle: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  confirmationDetail: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
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
  routeLocationInitials: {
    color: '#7c3aed',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routeLocationName: {
    color: '#fff',
    fontSize: 14,
  },
  costSection: {
    marginTop: 10,
  },
  costGradientBg: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  costLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  costAmount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
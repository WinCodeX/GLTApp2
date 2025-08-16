// components/PackageEditModal.tsx - FIXED with proper helper functions
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../lib/api';

// FIXED: Import proper helper functions
import { getAreas, getAgents, Area, Agent } from '../lib/helpers/packageHelpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Package {
  id: string;
  code: string;
  state: string;
  state_display: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone: string;
  route_description: string;
  cost: number;
  delivery_type: string;
  created_at: string;
  origin_area?: Area;
  destination_area?: Area;
  origin_agent?: Agent;
  destination_agent?: Agent;
  delivery_location?: string;
  sender_phone?: string;
}

interface Location {
  id: string;
  name: string;
}

interface PackageEditModalProps {
  visible: boolean;
  package: Package | null;
  userRole: string;
  onClose: () => void;
  onSuccess: () => void;
}

type PackageState = 'pending_unpaid' | 'pending' | 'submitted' | 'in_transit' | 'delivered' | 'collected' | 'rejected';

const PACKAGE_STATES: { value: PackageState; label: string; description: string; color: string }[] = [
  { value: 'pending_unpaid', label: 'Pending Payment', description: 'Package created, awaiting payment', color: '#FF3B30' },
  { value: 'pending', label: 'Pending', description: 'Payment received, preparing for pickup', color: '#FF9500' },
  { value: 'submitted', label: 'Submitted', description: 'Package submitted for delivery', color: '#667eea' },
  { value: 'in_transit', label: 'In Transit', description: 'Package is in transit', color: '#764ba2' },
  { value: 'delivered', label: 'Delivered', description: 'Package delivered successfully', color: '#34C759' },
  { value: 'collected', label: 'Collected', description: 'Package collected by receiver', color: '#34C759' },
  { value: 'rejected', label: 'Rejected', description: 'Package delivery rejected', color: '#FF3B30' }
];

export default function PackageEditModal({
  visible,
  package: packageData,
  userRole,
  onClose,
  onSuccess
}: PackageEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Form data
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [selectedState, setSelectedState] = useState<PackageState>('pending');
  const [selectedDestinationArea, setSelectedDestinationArea] = useState<string>('');
  const [selectedDestinationAgent, setSelectedDestinationAgent] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  
  // Data states
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Derived state for current package type
  const isAgentDelivery = useMemo(() => 
    packageData?.delivery_type === 'agent', 
    [packageData?.delivery_type]
  );

  // Filtered areas for search
  const filteredAreas = useMemo(() => {
    if (!searchQuery.trim()) return areas;
    const query = searchQuery.toLowerCase();
    return areas.filter(area => 
      area.name.toLowerCase().includes(query) ||
      area.location?.name.toLowerCase().includes(query)
    );
  }, [areas, searchQuery]);

  // Filtered agents for the selected area or search
  const availableAgents = useMemo(() => {
    let filteredAgents = agents;
    
    // Filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredAgents = filteredAgents.filter(agent => 
        agent.name.toLowerCase().includes(query) ||
        agent.area?.name.toLowerCase().includes(query) ||
        agent.area?.location?.name.toLowerCase().includes(query) ||
        agent.phone.toLowerCase().includes(query)
      );
    }
    
    // For agent delivery, if area is selected, filter by area
    if (isAgentDelivery && selectedDestinationArea) {
      filteredAgents = filteredAgents.filter(agent => agent.area?.id === selectedDestinationArea);
    }
    
    return filteredAgents;
  }, [agents, searchQuery, isAgentDelivery, selectedDestinationArea]);

  // User permissions based on role and package state
  const canEditPersonalInfo = useMemo(() => {
    return ['admin', 'client'].includes(userRole) && 
           packageData && 
           ['pending_unpaid', 'pending'].includes(packageData.state);
  }, [userRole, packageData]);

  const canEditDestination = useMemo(() => {
    return ['admin', 'client'].includes(userRole) && 
           packageData && 
           ['pending_unpaid', 'pending'].includes(packageData.state);
  }, [userRole, packageData]);

  const canEditState = useMemo(() => {
    return ['admin', 'agent', 'rider', 'warehouse'].includes(userRole);
  }, [userRole]);

  const canEditDeliveryLocation = useMemo(() => {
    return ['admin', 'client', 'agent'].includes(userRole) && 
           packageData && 
           !['delivered', 'collected'].includes(packageData.state);
  }, [userRole, packageData]);

  useEffect(() => {
    if (visible && packageData) {
      console.log('🔄 Modal opened, loading form data...');
      loadFormData();
      loadAreasAndAgents();
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, packageData]);

  const loadFormData = useCallback(() => {
    if (!packageData) return;
    
    console.log('📋 Loading form data from package:', packageData);
    
    setSenderName(packageData.sender_name || '');
    setSenderPhone(packageData.sender_phone || '');
    setReceiverName(packageData.receiver_name || '');
    setReceiverPhone(packageData.receiver_phone || '');
    setSelectedState(packageData.state as PackageState);
    setSelectedDestinationArea(packageData.destination_area?.id || '');
    setSelectedDestinationAgent(packageData.destination_agent?.id || '');
    setDeliveryLocation(packageData.delivery_location || '');
    
    console.log('📋 Form data loaded:', {
      state: packageData.state,
      destinationArea: packageData.destination_area?.id,
      destinationAgent: packageData.destination_agent?.id,
      deliveryType: packageData.delivery_type
    });
  }, [packageData]);

  // FIXED: Use proper helper functions instead of direct API calls
  const loadAreasAndAgents = useCallback(async () => {
    try {
      setIsLoadingData(true);
      setLoadingError(null);
      
      console.log('🔄 Loading areas and agents using helper functions...');
      
      // FIXED: Use the proper helper functions that handle FastJSON
      const [areasData, agentsData] = await Promise.allSettled([
        getAreas(),
        getAgents()
      ]);
      
      // Process areas result
      if (areasData.status === 'fulfilled') {
        console.log('✅ Areas loaded successfully:', areasData.value.length);
        setAreas(areasData.value);
        
        if (areasData.value.length > 0) {
          console.log('📋 Sample area:', areasData.value[0]);
        }
      } else {
        console.error('❌ Failed to load areas:', areasData.reason);
        setLoadingError('Failed to load areas');
      }
      
      // Process agents result
      if (agentsData.status === 'fulfilled') {
        console.log('✅ Agents loaded successfully:', agentsData.value.length);
        setAgents(agentsData.value);
        
        if (agentsData.value.length > 0) {
          console.log('📋 Sample agent:', agentsData.value[0]);
        }
      } else {
        console.error('❌ Failed to load agents:', agentsData.reason);
        setLoadingError('Failed to load agents');
      }
      
      // Check if we have minimum required data
      const hasAreas = areasData.status === 'fulfilled' && areasData.value.length > 0;
      const hasAgents = agentsData.status === 'fulfilled' && agentsData.value.length > 0;
      
      if (!hasAreas && !hasAgents) {
        setLoadingError('No areas or agents available. Please check your data setup.');
      } else if (!hasAreas) {
        setLoadingError('No areas available. Package editing may be limited.');
      } else if (!hasAgents && isAgentDelivery) {
        setLoadingError('No agents available. Agent delivery editing may be limited.');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load form data:', error);
      setLoadingError(`Failed to load form data: ${error.message}`);
      
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Data',
        text2: error.message || 'Could not load areas and agents',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [isAgentDelivery]);

  const closeModal = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Reset state when modal closes
      setSearchQuery('');
      setLoadingError(null);
      onClose();
    });
  }, [slideAnim, onClose]);

  const validateForm = useCallback(() => {
    const errors: string[] = [];
    
    console.log('🔍 Validating form...');
    
    if (canEditPersonalInfo) {
      if (!senderName.trim()) {
        errors.push('Sender name is required');
      }
      
      if (!senderPhone.trim()) {
        errors.push('Sender phone is required');
      } else if (!senderPhone.match(/^\+254\d{9}$/)) {
        errors.push('Sender phone must be in format +254XXXXXXXXX');
      }
      
      if (!receiverName.trim()) {
        errors.push('Receiver name is required');
      }
      
      if (!receiverPhone.trim()) {
        errors.push('Receiver phone is required');
      } else if (!receiverPhone.match(/^\+254\d{9}$/)) {
        errors.push('Receiver phone must be in format +254XXXXXXXXX');
      }
    }
    
    if (canEditDestination) {
      if (isAgentDelivery) {
        if (!selectedDestinationAgent) {
          errors.push('Destination agent is required for agent delivery');
        }
      } else {
        if (!selectedDestinationArea) {
          errors.push('Destination area is required');
        }
      }
      
      // Validate delivery location for doorstep deliveries
      if (['doorstep', 'fragile'].includes(packageData?.delivery_type || '') && !deliveryLocation.trim()) {
        errors.push('Delivery location is required for doorstep/fragile delivery');
      }
    }
    
    console.log('🔍 Validation result:', { errors: errors.length, details: errors });
    
    return errors;
  }, [canEditPersonalInfo, canEditDestination, senderName, senderPhone, receiverName, receiverPhone, selectedDestinationArea, selectedDestinationAgent, deliveryLocation, isAgentDelivery, packageData]);

  const handleSubmit = useCallback(async () => {
    if (!packageData) return;
    
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('💾 Submitting package update...');
      
      const updateData: any = {};
      
      // Add editable fields based on permissions
      if (canEditPersonalInfo) {
        updateData.sender_name = senderName.trim();
        updateData.sender_phone = senderPhone.trim();
        updateData.receiver_name = receiverName.trim();
        updateData.receiver_phone = receiverPhone.trim();
      }
      
      if (canEditState) {
        updateData.state = selectedState;
      }
      
      if (canEditDestination) {
        if (isAgentDelivery) {
          updateData.destination_agent_id = selectedDestinationAgent;
          // When agent is selected, area is derived from agent
          const selectedAgent = agents.find(a => a.id === selectedDestinationAgent);
          if (selectedAgent?.area?.id) {
            updateData.destination_area_id = selectedAgent.area.id;
          }
        } else {
          updateData.destination_area_id = selectedDestinationArea;
          updateData.destination_agent_id = null; // Clear agent for non-agent delivery
        }
      }
      
      if (canEditDeliveryLocation && ['doorstep', 'fragile'].includes(packageData.delivery_type)) {
        updateData.delivery_location = deliveryLocation.trim();
      }
      
      console.log('💾 Update payload:', updateData);
      
      const response = await api.put(`/api/v1/packages/${packageData.code}`, {
        package: updateData
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('💾 Update response:', response.data);
      
      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Package Updated',
          text2: 'Package details updated successfully',
          position: 'top',
          visibilityTime: 3000,
        });
        
        closeModal();
        onSuccess();
      } else {
        throw new Error(response.data.message || 'Update failed');
      }
    } catch (error: any) {
      console.error('❌ Failed to update package:', error);
      
      let errorMessage = 'Failed to update package';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        errorMessage = Array.isArray(error.response.data.errors) 
          ? error.response.data.errors.join(', ')
          : String(error.response.data.errors);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [packageData, validateForm, canEditPersonalInfo, canEditState, canEditDestination, canEditDeliveryLocation, senderName, senderPhone, receiverName, receiverPhone, selectedState, selectedDestinationArea, selectedDestinationAgent, deliveryLocation, isAgentDelivery, agents, closeModal, onSuccess]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Edit Package</Text>
      <View style={styles.placeholder} />
    </View>
  ), [closeModal]);

  const renderPackageInfo = useCallback(() => (
    <View style={styles.packageInfoContainer}>
      <View style={styles.packageCodeContainer}>
        <Text style={styles.packageCode}>{packageData?.code}</Text>
        <LinearGradient
          colors={[getStateColor(packageData?.state || ''), getStateColor(packageData?.state || '') + '80']}
          style={styles.stateBadge}
        >
          <Text style={styles.stateText}>{packageData?.state_display}</Text>
        </LinearGradient>
      </View>
      <Text style={styles.routeDescription}>{packageData?.route_description}</Text>
      <Text style={styles.deliveryType}>
        {packageData?.delivery_type === 'agent' ? 'Agent Delivery' : 
         packageData?.delivery_type === 'fragile' ? 'Fragile Delivery' : 'Doorstep Delivery'}
      </Text>
      {packageData?.cost && (
        <Text style={styles.packageCost}>Cost: KES {packageData.cost}</Text>
      )}
    </View>
  ), [packageData]);

  const renderPersonalInfoEdit = useCallback(() => {
    if (!canEditPersonalInfo) return null;
    
    return (
      <View style={styles.editSection}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sender Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Sender's full name"
            placeholderTextColor="#888"
            value={senderName}
            onChangeText={setSenderName}
            autoCapitalize="words"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sender Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Sender's phone (+254...)"
            placeholderTextColor="#888"
            value={senderPhone}
            onChangeText={setSenderPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Receiver Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Receiver's full name"
            placeholderTextColor="#888"
            value={receiverName}
            onChangeText={setReceiverName}
            autoCapitalize="words"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Receiver Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Receiver's phone (+254...)"
            placeholderTextColor="#888"
            value={receiverPhone}
            onChangeText={setReceiverPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </View>
      </View>
    );
  }, [canEditPersonalInfo, senderName, senderPhone, receiverName, receiverPhone]);

  const renderStateEdit = useCallback(() => {
    if (!canEditState) return null;
    
    return (
      <View style={styles.editSection}>
        <Text style={styles.sectionTitle}>Package State</Text>
        <ScrollView style={styles.statesList} showsVerticalScrollIndicator={false}>
          {PACKAGE_STATES.map((state) => (
            <TouchableOpacity
              key={state.value}
              style={[
                styles.stateOption,
                selectedState === state.value && styles.selectedStateOption,
                { borderLeftColor: state.color }
              ]}
              onPress={() => setSelectedState(state.value)}
            >
              <View style={styles.stateOptionContent}>
                <Text style={[
                  styles.stateOptionLabel,
                  selectedState === state.value && styles.selectedStateOptionText
                ]}>
                  {state.label}
                </Text>
                <Text style={styles.stateOptionDescription}>{state.description}</Text>
              </View>
              {selectedState === state.value && (
                <Feather name="check-circle" size={20} color="#10b981" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [canEditState, selectedState]);

  const renderDestinationEdit = useCallback(() => {
    if (!canEditDestination) return null;
    
    return (
      <View style={styles.editSection}>
        <Text style={styles.sectionTitle}>
          {isAgentDelivery ? 'Destination Agent' : 'Destination Area'}
        </Text>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder={isAgentDelivery ? "Search agents..." : "Search areas..."}
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
        
        {!isAgentDelivery ? (
          // Area selection for doorstep/fragile delivery
          <ScrollView style={styles.destinationList} showsVerticalScrollIndicator={false}>
            {filteredAreas.length > 0 ? filteredAreas.map((area) => (
              <TouchableOpacity
                key={area.id}
                style={[
                  styles.destinationOption,
                  selectedDestinationArea === area.id && styles.selectedDestinationOption
                ]}
                onPress={() => {
                  setSelectedDestinationArea(area.id);
                  setSearchQuery(''); // Clear search after selection
                }}
              >
                <View style={styles.destinationInfo}>
                  <Text style={styles.destinationName}>{area.name}</Text>
                  <Text style={styles.destinationLocation}>{area.location?.name}</Text>
                </View>
                {selectedDestinationArea === area.id && (
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchQuery ? 'No areas match your search' : 'No areas available'}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          // Agent selection for agent delivery
          <ScrollView style={styles.destinationList} showsVerticalScrollIndicator={false}>
            {availableAgents.length > 0 ? availableAgents.map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.destinationOption,
                  selectedDestinationAgent === agent.id && styles.selectedDestinationOption
                ]}
                onPress={() => {
                  setSelectedDestinationAgent(agent.id);
                  setSearchQuery(''); // Clear search after selection
                }}
              >
                <View style={styles.destinationInfo}>
                  <Text style={styles.destinationName}>{agent.name}</Text>
                  <Text style={styles.destinationLocation}>
                    {agent.area?.name} • {agent.area?.location?.name}
                  </Text>
                  <Text style={styles.agentPhone}>{agent.phone}</Text>
                </View>
                {selectedDestinationAgent === agent.id && (
                  <Feather name="check-circle" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchQuery ? 'No agents match your search' : 'No agents available'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
        
        {/* Delivery location for doorstep/fragile */}
        {canEditDeliveryLocation && ['doorstep', 'fragile'].includes(packageData?.delivery_type || '') && (
          <View style={styles.deliveryLocationContainer}>
            <Text style={styles.deliveryLocationLabel}>Delivery Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter specific delivery address..."
              placeholderTextColor="#888"
              value={deliveryLocation}
              onChangeText={setDeliveryLocation}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}
      </View>
    );
  }, [canEditDestination, canEditDeliveryLocation, isAgentDelivery, searchQuery, filteredAreas, selectedDestinationArea, availableAgents, selectedDestinationAgent, packageData?.delivery_type, deliveryLocation]);

  const renderLoadingError = useCallback(() => {
    if (!loadingError) return null;
    
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={24} color="#FF3B30" />
        <Text style={styles.errorText}>{loadingError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadAreasAndAgents}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loadingError, loadAreasAndAgents]);

  const renderActionButtons = useCallback(() => (
    <View style={styles.actionButtons}>
      <TouchableOpacity onPress={closeModal} style={styles.cancelButton}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={handleSubmit} 
        style={[styles.saveButton, isSubmitting && styles.disabledButton]}
        disabled={isSubmitting || isLoadingData}
      >
        <LinearGradient
          colors={isSubmitting ? ['#666', '#666'] : ['#10b981', '#059669']}
          style={styles.saveButtonGradient}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.saveButtonText}>Save Changes</Text>
              <Feather name="save" size={20} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  ), [closeModal, handleSubmit, isSubmitting, isLoadingData]);

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'pending_unpaid': return '#FF3B30';
      case 'pending': return '#FF9500';
      case 'submitted': return '#667eea';
      case 'in_transit': return '#764ba2';
      case 'delivered': return '#34C759';
      case 'collected': return '#34C759';
      case 'rejected': return '#FF3B30';
      default: return '#a0aec0';
    }
  };

  if (!packageData) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
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
                {renderHeader()}
                
                <ScrollView 
                  style={styles.contentContainer}
                  contentContainerStyle={styles.scrollContentContainer}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {renderPackageInfo()}
                  
                  {isLoadingData ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#667eea" />
                      <Text style={styles.loadingText}>Loading form data...</Text>
                    </View>
                  ) : loadingError ? (
                    renderLoadingError()
                  ) : (
                    <>
                      {renderPersonalInfoEdit()}
                      {renderStateEdit()}
                      {renderDestinationEdit()}
                    </>
                  )}
                </ScrollView>
                
                {!isLoadingData && !loadingError && renderActionButtons()}
              </LinearGradient>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.95,
    minHeight: SCREEN_HEIGHT * 0.7,
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  
  // Package info styles
  packageInfoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  packageCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  stateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  routeDescription: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 4,
  },
  deliveryType: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  packageCost: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  
  // Content styles
  contentContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  
  // Loading styles
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#a0aec0',
    fontWeight: '500',
  },
  
  // Error styles
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: 12,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Edit section styles
  editSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  
  // Input styles
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0aec0',
    marginBottom: 8,
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
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 16,
    paddingLeft: 12,
  },
  
  // State list styles
  statesList: {
    maxHeight: 300,
  },
  stateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedStateOption: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: '#7c3aed',
  },
  stateOptionContent: {
    flex: 1,
  },
  stateOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  selectedStateOptionText: {
    color: '#7c3aed',
  },
  stateOptionDescription: {
    fontSize: 14,
    color: '#888',
  },
  
  // Destination list styles
  destinationList: {
    maxHeight: 300,
  },
  destinationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedDestinationOption: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: '#7c3aed',
  },
  destinationInfo: {
    flex: 1,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  destinationLocation: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  agentPhone: {
    fontSize: 12,
    color: '#666',
  },
  
  // Empty state styles
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  
  // Delivery location styles
  deliveryLocationContainer: {
    marginTop: 16,
  },
  deliveryLocationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  
  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
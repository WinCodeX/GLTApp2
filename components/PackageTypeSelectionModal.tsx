// components/PackageTypeSelectionModal.tsx - Fixed with solid translucent buttons
import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import colors from '@/theme/colors';
import { useUser } from '@/context/UserContext';
import { createPackage, type PackageData } from '@/lib/helpers/packageHelpers';
import PackageCreationModal from './PackageCreationModal';
import FragileDeliveryModal from './FragileDeliveryModal';
import CollectDeliverModal from './CollectDeliverModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PackageTypeSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onPackageCreated?: () => void;
}

interface PackageType {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
}

export default function PackageTypeSelectionModal({ 
  visible, 
  onClose,
  onPackageCreated
}: PackageTypeSelectionModalProps) {
  
  // Animation
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  // Modal states
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showFragileModal, setShowFragileModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  
  // Selection animation states
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // User context for authentication
  const { 
    user, 
    currentAccount,
    loading: userLoading,
    error: userError,
    getDisplayName, 
    getUserPhone,
    getCurrentToken,
    getCurrentUserId,
  } = useUser();

  // Package types matching the home screen FAB options
  const packageTypes: PackageType[] = [
    {
      id: 'fragile',
      label: 'Fragile Items',
      description: 'Items that require extra care and special handling during delivery',
      icon: 'alert-triangle',
      color: '#FF9500',
      backgroundColor: '#FF9500',
    },
    {
      id: 'send',
      label: 'Send a Package',
      description: 'Regular package delivery to home or office locations',
      icon: 'send',
      color: '#8B5CF6',
      backgroundColor: '#8B5CF6',
    },
    {
      id: 'collect',
      label: 'Collect my Packages',
      description: 'Collection service where we pick up your packages for delivery',
      icon: 'package',
      color: '#10B981',
      backgroundColor: '#10B981',
    },
  ];

  // Animation for modal show/hide
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 20 && Math.abs(gestureState.dx) < 100;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Check user authentication
  const isUserAuthenticated = () => {
    return !!(user && currentAccount && getCurrentToken() && getCurrentUserId());
  };

  const validateUserForPackageCreation = (): boolean => {
    if (userLoading) {
      Alert.alert('Please wait', 'User authentication is loading...');
      return false;
    }

    if (userError) {
      Alert.alert('Authentication Error', 'Please refresh the app and try again.');
      return false;
    }

    if (!isUserAuthenticated()) {
      Alert.alert(
        'Authentication Required', 
        'Please ensure you are logged in to create packages.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  // Handle package type selection with visual feedback
  const handleSelectPackageType = (packageType: PackageType) => {
    if (isProcessing || !validateUserForPackageCreation()) return;
    
    setSelectedType(packageType.id);
    setIsProcessing(true);

    // Brief delay for visual feedback
    setTimeout(() => {
      setSelectedType(null);
      setIsProcessing(false);

      // Open appropriate modal based on type
      switch (packageType.id) {
        case 'fragile':
          setShowFragileModal(true);
          break;
        case 'send':
          setShowPackageModal(true);
          break;
        case 'collect':
          setShowCollectModal(true);
          break;
        default:
          console.warn('Unknown package type:', packageType.id);
      }
    }, 200);
  };

  // Package submission handlers
  const handlePackageSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      console.log('Creating package with data:', packageData);
      
      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('Package created successfully:', response);
      
      // Close all modals
      setShowPackageModal(false);
      onClose();
      
      // Notify parent component
      if (onPackageCreated) {
        onPackageCreated();
      }
      
    } catch (error: any) {
      console.error('Error creating package:', error);
      
      if (error.message?.includes('Authentication') || 
          error.message?.includes('expired') || 
          error.message?.includes('401') ||
          error.message?.includes('422')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log out and log back in, then try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          error.message || 'Failed to create package. Please try again.',
          [{ text: 'OK' }]
        );
      }
      throw error;
    }
  };

  const handleFragileSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      console.log('Creating fragile delivery package:', packageData);
      
      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        delivery_type: 'fragile' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('Fragile package created successfully:', response);
      
      // Close all modals
      setShowFragileModal(false);
      onClose();
      
      // Notify parent component
      if (onPackageCreated) {
        onPackageCreated();
      }
      
    } catch (error: any) {
      console.error('Error creating fragile package:', error);
      
      if (error.message?.includes('Authentication') || 
          error.message?.includes('expired') || 
          error.message?.includes('401') ||
          error.message?.includes('422')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log out and log back in, then try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          error.message || 'Failed to schedule fragile items delivery. Please try again.',
          [{ text: 'OK' }]
        );
      }
      throw error;
    }
  };

  const handleCollectSubmit = async (packageData: PackageData) => {
    try {
      if (!validateUserForPackageCreation()) return;

      console.log('Creating collect package:', packageData);
      
      const enhancedPackageData = {
        ...packageData,
        sender_name: getDisplayName(),
        sender_phone: getUserPhone(),
        receiver_name: getDisplayName(), // Delivering to self
        receiver_phone: getUserPhone(),
        delivery_type: 'collection' as const,
      };
      
      const response = await createPackage(enhancedPackageData);
      
      console.log('Collect package created successfully:', response);
      
      // Close all modals
      setShowCollectModal(false);
      onClose();
      
      // Notify parent component
      if (onPackageCreated) {
        onPackageCreated();
      }
      
    } catch (error: any) {
      console.error('Error creating collect package:', error);
      
      if (error.message?.includes('Authentication') || 
          error.message?.includes('expired') || 
          error.message?.includes('401') ||
          error.message?.includes('422')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log out and log back in, then try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          error.message || 'Failed to schedule package collection. Please try again.',
          [{ text: 'OK' }]
        );
      }
      throw error;
    }
  };

  // Render outlined buttons with transparent backgrounds
  const renderPackageTypeOption = (packageType: PackageType, index: number) => {
    const isSelected = selectedType === packageType.id;
    
    return (
      <TouchableOpacity
        key={packageType.id}
        style={[
          styles.packageTypeOption,
          {
            backgroundColor: isSelected 
              ? `${packageType.backgroundColor}10` 
              : `${packageType.backgroundColor}15`,
            borderColor: isSelected 
              ? `${packageType.color}60` 
              : `${packageType.color}80`,
            opacity: isSelected ? 0.6 : 1,
            transform: isSelected ? [{ scale: 0.98 }] : [{ scale: 1 }],
          }
        ]}
        onPress={() => handleSelectPackageType(packageType)}
        activeOpacity={0.8}
        disabled={isProcessing}
      >
        <Feather 
          name={packageType.icon as any} 
          size={28} 
          color={isSelected ? `${packageType.color}70` : packageType.color}
          style={{ opacity: isSelected ? 0.7 : 1 }}
        />
        
        <View style={styles.packageTypeTextContainer}>
          <Text style={[
            styles.packageTypeLabel, 
            { 
              color: isSelected ? `${packageType.color}70` : packageType.color,
              opacity: isSelected ? 0.7 : 1,
            }
          ]}>
            {packageType.label}
          </Text>
          <Text style={[
            styles.packageTypeDescription,
            { 
              color: isSelected ? `${packageType.color}50` : `${packageType.color}80`,
              opacity: isSelected ? 0.5 : 0.8 
            }
          ]}>
            {packageType.description}
          </Text>
        </View>
        
        <Feather 
          name="chevron-right" 
          size={20} 
          color={isSelected ? `${packageType.color}60` : `${packageType.color}90`}
          style={{ opacity: isSelected ? 0.5 : 0.8 }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        <Animated.View 
          style={[styles.overlay, { opacity: opacityAnim }]}
        >
          <TouchableOpacity 
            style={styles.overlayTouchable} 
            activeOpacity={1} 
            onPress={onClose}
          />
          
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <LinearGradient
              colors={['rgba(26, 26, 46, 0.98)', 'rgba(22, 33, 62, 0.98)']}
              style={styles.modal}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.dragIndicator} />
                <View style={styles.headerContent}>
                  <View style={styles.headerIcon}>
                    <Feather name="plus" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.modalTitle}>Create New Package</Text>
                    <Text style={styles.modalSubtitle}>Choose the type of delivery service</Text>
                  </View>
                  <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Feather name="x" size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Package Type Options */}
              <View style={styles.packageTypesList}>
                {packageTypes.map((packageType, index) => 
                  renderPackageTypeOption(packageType, index)
                )}
              </View>

              {/* Footer Info */}
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  All package types can be tracked and managed from your dashboard
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </Modal>

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
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  
  // Modal Header
  modalHeader: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Package Types List
  packageTypesList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  
  // Outlined buttons with transparent backgrounds
  packageTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 16,
  },
  packageTypeTextContainer: {
    flex: 1,
  },
  packageTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  packageTypeDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  
  // Modal Footer
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.2)',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
});
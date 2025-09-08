// components/PackageTypeSelectionModal.tsx
import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import colors from '@/theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PackageTypeSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

interface PackageType {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
  route: string;
  params?: any;
}

export default function PackageTypeSelectionModal({ 
  visible, 
  onClose 
}: PackageTypeSelectionModalProps) {
  const router = useRouter();
  
  // Animation
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Package types matching the home screen FAB options
  const packageTypes: PackageType[] = [
    {
      id: 'fragile',
      label: 'Fragile Items',
      description: 'Items that require extra care and special handling during delivery',
      icon: 'alert-triangle',
      color: '#FF9500',
      backgroundColor: '#FF9500',
      route: '/(drawer)/(tabs)/send',
      params: { delivery_type: 'fragile' }
    },
    {
      id: 'send',
      label: 'Send a Package',
      description: 'Regular package delivery to home or office locations',
      icon: 'send',
      color: '#8B5CF6',
      backgroundColor: '#8B5CF6',
      route: '/(drawer)/(tabs)/send',
      params: { delivery_type: 'agent' }
    },
    {
      id: 'collect',
      label: 'Collect my Packages',
      description: 'Collection service where we pick up your packages for delivery',
      icon: 'package',
      color: '#10B981',
      backgroundColor: '#10B981',
      route: '/(drawer)/(tabs)/send',
      params: { delivery_type: 'collection' }
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

  // Handle package type selection
  const handleSelectPackageType = (packageType: PackageType) => {
    onClose();
    
    // Navigate to send page with appropriate params
    setTimeout(() => {
      router.push({
        pathname: packageType.route,
        params: packageType.params
      });
    }, 300);
  };

  // Render package type option
  const renderPackageTypeOption = (packageType: PackageType, index: number) => (
    <TouchableOpacity
      key={packageType.id}
      style={[
        styles.packageTypeOption,
        {
          shadowColor: packageType.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }
      ]}
      onPress={() => handleSelectPackageType(packageType)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[
          `${packageType.backgroundColor}15`,
          `${packageType.backgroundColor}25`,
          `${packageType.backgroundColor}15`,
        ]}
        style={[
          styles.packageTypeGradient,
          {
            borderColor: `${packageType.color}40`,
          }
        ]}
      >
        <View style={styles.packageTypeContent}>
          <View 
            style={[
              styles.packageTypeIcon,
              {
                backgroundColor: `${packageType.color}20`,
                borderColor: `${packageType.color}40`,
              }
            ]}
          >
            <Feather 
              name={packageType.icon as any} 
              size={28} 
              color={packageType.color} 
            />
          </View>
          
          <View style={styles.packageTypeText}>
            <Text style={[styles.packageTypeLabel, { color: packageType.color }]}>
              {packageType.label}
            </Text>
            <Text style={styles.packageTypeDescription}>
              {packageType.description}
            </Text>
          </View>
          
          <View style={styles.packageTypeArrow}>
            <Feather name="chevron-right" size={20} color="#888" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
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
  
  // Package Type Option
  packageTypeOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  packageTypeGradient: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  packageTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  packageTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  packageTypeText: {
    flex: 1,
  },
  packageTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  packageTypeDescription: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  packageTypeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
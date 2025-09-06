// components/BusinessModal.tsx - Fixed category selection with matching colors
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { createBusiness } from '../lib/helpers/business';

interface BusinessModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
}

const BUSINESS_CATEGORIES = [
  'Technology', 'Retail', 'Food & Beverage', 'Healthcare', 'Education',
  'Finance', 'Real Estate', 'Manufacturing', 'Transportation', 'Entertainment',
  'Consulting', 'Construction', 'Agriculture', 'Tourism', 'Fashion',
  'Beauty & Wellness', 'Legal Services', 'Marketing', 'Sports & Fitness', 'Non-Profit'
];

// Category Selection Modal Component
const CategorySelectionModal = ({ 
  visible, 
  onClose, 
  selectedCategories, 
  onCategoryToggle 
}: {
  visible: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.categoryModalOverlay}>
        <TouchableOpacity 
          style={styles.categoryModalBackdrop} 
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={styles.categoryModalContent}>
          {/* Handle Bar */}
          <View style={styles.modalHandle} />
          
          {/* Header */}
          <View style={styles.categoryModalHeader}>
            <Text style={styles.categoryModalTitle}>Select Business Categories</Text>
            <Text style={styles.categoryModalSubtitle}>
              Choose up to 5 categories ({selectedCategories.length}/5)
            </Text>
          </View>

          {/* Categories List */}
          <ScrollView style={styles.categoriesList} showsVerticalScrollIndicator={false}>
            {BUSINESS_CATEGORIES.map((category) => {
              const isSelected = selectedCategories.includes(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryListItem,
                    isSelected && styles.selectedCategoryListItem
                  ]}
                  onPress={() => onCategoryToggle(category)}
                >
                  <Text style={[
                    styles.categoryListText,
                    isSelected && styles.selectedCategoryListText
                  ]}>
                    {category}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={18} color="#7c3aed" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Done Button */}
          <TouchableOpacity 
            style={styles.categoryDoneButton} 
            onPress={onClose}
          >
            <Text style={styles.categoryDoneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function BusinessModal({ visible, onClose, onCreate }: BusinessModalProps) {
  const [businessName, setBusinessName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else if (prev.length < 5) {
        return [...prev, category];
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Maximum Categories',
          text2: 'You can select up to 5 categories only',
        });
        return prev;
      }
    });
  }, []);

  const handleCreate = async () => {
    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter a business name');
      return;
    }

    if (selectedCategories.length === 0) {
      Alert.alert('Error', 'Please select at least one category');
      return;
    }

    setLoading(true);
    try {
      await createBusiness({
        name: businessName.trim(),
        categories: selectedCategories,
      });

      Toast.show({
        type: 'success',
        text1: 'Business Created',
        text2: `${businessName} has been created successfully`,
      });

      setBusinessName('');
      setSelectedCategories([]);
      onCreate();
    } catch (error: any) {
      console.error('Create business error:', error);
      Alert.alert(
        'Creation Failed',
        error.message || 'Failed to create business. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setBusinessName('');
      setSelectedCategories([]);
      onClose();
    }
  };

  const getCategoryDisplayText = () => {
    if (selectedCategories.length === 0) return 'Choose categories';
    if (selectedCategories.length === 1) return selectedCategories[0];
    return `${selectedCategories.length} categories selected`;
  };

  return (
    <>
      <Modal 
        visible={visible} 
        transparent 
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleClose}
          >
            <TouchableOpacity 
              style={styles.modalContent}
              activeOpacity={1}
              onPress={() => {}}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.headerIcon}>
                  <Feather name="briefcase" size={28} color="#7c3aed" />
                </View>
                <Text style={styles.modalTitle}>Create New Business</Text>
                <Text style={styles.modalSubtitle}>
                  Start your business and invite team members
                </Text>
              </View>

              {/* Form */}
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="Enter business name"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    maxLength={50}
                    editable={!loading}
                  />
                  <Text style={styles.characterCount}>
                    {businessName.length}/50
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Categories * ({selectedCategories.length}/5)
                  </Text>
                  <TouchableOpacity
                    style={styles.categoryDropdown}
                    onPress={() => setShowCategoryModal(true)}
                    disabled={loading}
                  >
                    <Text style={[
                      styles.categoryDropdownText,
                      selectedCategories.length === 0 && styles.categoryPlaceholder
                    ]}>
                      {getCategoryDisplayText()}
                    </Text>
                    <Feather name="chevron-down" size={20} color="rgba(255, 255, 255, 0.7)" />
                  </TouchableOpacity>
                  <Text style={styles.helpText}>
                    Select up to 5 categories that best describe your business
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={[styles.secondaryButton, loading && styles.disabledButton]}
                  onPress={handleClose}
                  disabled={loading}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!businessName.trim() || selectedCategories.length === 0 || loading) && styles.disabledButton
                  ]}
                  onPress={handleCreate}
                  disabled={!businessName.trim() || selectedCategories.length === 0 || loading}
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.primaryButtonText}>Creating...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryButtonText}>Create Business</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Selection Modal */}
      <CategorySelectionModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        selectedCategories={selectedCategories}
        onCategoryToggle={handleCategoryToggle}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#16213e', // Direct background, no transparency
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#16213e',
    padding: 32,
    paddingTop: 60, // Account for status bar
    paddingBottom: 40,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 32,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
  },
  characterCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'right',
    marginTop: 8,
  },
  categoryDropdown: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryDropdownText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  categoryPlaceholder: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 'auto',
    paddingTop: 24,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  // Category Modal Styles - Changed to match main modal colors
  categoryModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  categoryModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  categoryModalContent: {
    backgroundColor: '#16213e', // Changed from white to match main modal
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.4)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Changed from dark to light
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  categoryModalHeader: {
    marginBottom: 24,
  },
  categoryModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff', // Changed from dark to white
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryModalSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)', // Changed from dark to light
    textAlign: 'center',
  },
  categoriesList: {
    flex: 1,
    marginBottom: 24,
  },
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)', // Changed from dark to light
  },
  selectedCategoryListItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)', // Adjusted for dark background
  },
  categoryListText: {
    fontSize: 16,
    color: '#fff', // Changed from dark to white
    fontWeight: '500',
  },
  selectedCategoryListText: {
    color: '#7c3aed',
    fontWeight: '600',
  },
  categoryDoneButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  categoryDoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
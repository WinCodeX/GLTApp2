// components/BusinessModal.tsx - Updated to always fetch fresh categories
import React, { useState, useCallback, useEffect } from 'react';
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
import { createBusiness, fetchCategories, validatePhoneNumber, formatPhoneNumber, clearCategoriesCache } from '../lib/helpers/business';

interface BusinessModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

// Centralized toast helper
const showToast = {
  success: (text1: string, text2?: string) => {
    Toast.show({
      type: 'success',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 2500,
    });
  },
  
  error: (text1: string, text2?: string) => {
    Toast.show({
      type: 'error',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 4000,
    });
  },
  
  warning: (text1: string, text2?: string) => {
    Toast.show({
      type: 'warning',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 3500,
    });
  },
};

export default function BusinessModal({ visible, onClose, onCreate }: BusinessModalProps) {
  const [businessName, setBusinessName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Load fresh categories when modal opens
  useEffect(() => {
    if (visible) {
      loadFreshCategories();
    }
  }, [visible]);

  // ALWAYS fetch fresh categories from server
  const loadFreshCategories = async () => {
    setLoadingCategories(true);
    setCategoriesError(null);
    setCategories([]); // Clear existing categories
    
    try {
      console.log('🏷️ BusinessModal: Force clearing cache and loading fresh categories...');
      
      // Always clear cache and force fresh fetch
      await clearCategoriesCache();
      const fetchedCategories = await fetchCategories(true); // Force refresh = true
      
      console.log('🏷️ BusinessModal: Fresh categories loaded:', {
        count: fetchedCategories.length,
        ids: fetchedCategories.map(c => c.id),
        names: fetchedCategories.map(c => c.name)
      });
      
      if (fetchedCategories.length === 0) {
        throw new Error('No categories available. Please contact support.');
      }
      
      setCategories(fetchedCategories);
      
    } catch (error: any) {
      console.error('🏷️ BusinessModal: Error loading fresh categories:', error);
      
      // Don't use fallback categories - show error instead
      setCategoriesError(error.message || 'Failed to load categories. Please try again.');
      
      // Show toast for user feedback
      showToast.error('Failed to load categories', 'Please check your connection and try again');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCategoryToggle = useCallback((categoryId: number) => {
    console.log('🏷️ BusinessModal: Toggling category ID:', categoryId);
    setSelectedCategoryIds(prev => {
      if (prev.includes(categoryId)) {
        const newSelection = prev.filter(id => id !== categoryId);
        console.log('🏷️ BusinessModal: Removed category, new selection:', newSelection);
        return newSelection;
      } else if (prev.length < 5) {
        const newSelection = [...prev, categoryId];
        console.log('🏷️ BusinessModal: Added category, new selection:', newSelection);
        return newSelection;
      } else {
        showToast.warning('Maximum Categories', 'You can select up to 5 categories only');
        return prev;
      }
    });
  }, []);

  const handlePhoneNumberChange = (text: string) => {
    // Allow only digits, spaces, hyphens, parentheses, and plus sign
    const cleaned = text.replace(/[^\d\s\-\(\)\+]/g, '');
    setPhoneNumber(cleaned);
  };

  const validateForm = () => {
    // Business name validation
    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter a business name');
      return false;
    }

    if (businessName.trim().length < 2) {
      Alert.alert('Error', 'Business name must be at least 2 characters long');
      return false;
    }

    // Phone number validation
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return false;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert(
        'Invalid Phone Number', 
        'Please enter a valid Kenyan phone number (e.g., 712345678 or +254712345678)'
      );
      return false;
    }

    // Categories validation
    if (selectedCategoryIds.length === 0) {
      Alert.alert('Error', 'Please select at least one category');
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      console.log('🏢 BusinessModal: Creating business with data:', {
        name: businessName.trim(),
        phone_number: formatPhoneNumber(phoneNumber),
        category_ids: selectedCategoryIds
      });

      // Add debug info about selected categories
      const selectedCategoryNames = categories
        .filter(cat => selectedCategoryIds.includes(cat.id))
        .map(cat => cat.name);
      
      console.log('🏷️ BusinessModal: Selected categories details:', {
        ids: selectedCategoryIds,
        names: selectedCategoryNames,
        totalAvailable: categories.length
      });

      const result = await createBusiness({
        name: businessName.trim(),
        phone_number: formatPhoneNumber(phoneNumber),
        category_ids: selectedCategoryIds,
      });

      console.log('🏢 BusinessModal: Business creation result:', result);

      showToast.success('Business Created', `${businessName} has been created successfully`);

      // Reset form
      setBusinessName('');
      setPhoneNumber('');
      setSelectedCategoryIds([]);
      
      // Close modal and trigger refresh
      onClose();
      onCreate();
      
    } catch (error: any) {
      console.error('🏢 BusinessModal: Create business error:', error);
      
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.errors?.join(', ') ||
                          error?.response?.data?.error || 
                          error?.message || 
                          'Failed to create business. Please try again.';
      
      Alert.alert('Creation Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setBusinessName('');
      setPhoneNumber('');
      setSelectedCategoryIds([]);
      setCategoriesError(null);
      setCategories([]);
      onClose();
    }
  };

  const retryLoadCategories = () => {
    loadFreshCategories();
  };

  return (
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
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              bounces={false}
              contentContainerStyle={styles.scrollContent}
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
                {/* Business Name */}
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
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <Text style={styles.characterCount}>
                    {businessName.length}/50
                  </Text>
                </View>

                {/* Categories Section */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Categories * ({selectedCategoryIds.length}/5)
                  </Text>
                  <Text style={styles.helpText}>
                    Select up to 5 categories that best describe your business
                  </Text>
                  
                  {/* Categories Loading/Error State */}
                  {loadingCategories ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#7c3aed" />
                      <Text style={styles.loadingText}>Loading fresh categories...</Text>
                    </View>
                  ) : categoriesError ? (
                    <View style={styles.errorContainer}>
                      <Feather name="alert-circle" size={24} color="#ef4444" />
                      <Text style={styles.errorText}>{categoriesError}</Text>
                      <TouchableOpacity style={styles.retryButton} onPress={retryLoadCategories}>
                        <Feather name="refresh-cw" size={16} color="#7c3aed" />
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : categories.length === 0 ? (
                    <View style={styles.errorContainer}>
                      <Feather name="inbox" size={24} color="#6b7280" />
                      <Text style={styles.errorText}>No categories available</Text>
                      <TouchableOpacity style={styles.retryButton} onPress={retryLoadCategories}>
                        <Feather name="refresh-cw" size={16} color="#7c3aed" />
                        <Text style={styles.retryButtonText}>Try Again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Categories Grid */
                    <View style={styles.categoriesContainer}>
                      <ScrollView 
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                        style={styles.categoriesScrollView}
                        contentContainerStyle={styles.categoriesScrollContent}
                      >
                        <View style={styles.categoriesGrid}>
                          {categories.map((category) => {
                            const isSelected = selectedCategoryIds.includes(category.id);
                            return (
                              <TouchableOpacity
                                key={`category-${category.id}`}
                                style={[
                                  styles.categoryChip,
                                  isSelected && styles.selectedCategoryChip
                                ]}
                                onPress={() => handleCategoryToggle(category.id)}
                                disabled={loading}
                              >
                                <Text style={[
                                  styles.categoryChipText,
                                  isSelected && styles.selectedCategoryChipText
                                ]}>
                                  {category.name}
                                </Text>
                                {isSelected && (
                                  <Feather name="check" size={14} color="#fff" style={styles.categoryCheckIcon} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Phone Number Section */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <Text style={styles.helpText}>
                    Enter your business phone number (e.g., 712345678 or +254712345678)
                  </Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.countryCodeContainer}>
                      <Text style={styles.countryCodeText}>🇰🇪 +254</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      value={phoneNumber}
                      onChangeText={handlePhoneNumberChange}
                      placeholder="712345678"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      keyboardType="phone-pad"
                      maxLength={20}
                      editable={!loading}
                    />
                  </View>
                  <Text style={styles.phoneHint}>
                    {phoneNumber && validatePhoneNumber(phoneNumber) ? (
                      <Text style={styles.validPhone}>✓ Valid phone number</Text>
                    ) : phoneNumber ? (
                      <Text style={styles.invalidPhone}>✗ Invalid phone number</Text>
                    ) : (
                      <Text style={styles.phoneHintText}>Enter a valid Kenyan phone number</Text>
                    )}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Actions - Fixed at bottom */}
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
                  (!businessName.trim() || !phoneNumber.trim() || selectedCategoryIds.length === 0 || loading || loadingCategories || categories.length === 0) && styles.disabledButton
                ]}
                onPress={handleCreate}
                disabled={!businessName.trim() || !phoneNumber.trim() || selectedCategoryIds.length === 0 || loading || loadingCategories || categories.length === 0}
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
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 20,
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
  helpText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  
  // Loading and Error States
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Categories
  categoriesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    height: 280,
    padding: 16,
  },
  categoriesScrollView: {
    flex: 1,
  },
  categoriesScrollContent: {
    paddingBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: 2,
    minHeight: 44,
    maxWidth: '48%',
    flexShrink: 1,
  },
  selectedCategoryChip: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedCategoryChipText: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryCheckIcon: {
    marginLeft: 6,
  },
  
  // Phone Number Styles
  phoneInputContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  countryCodeContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(124, 58, 237, 0.3)',
    justifyContent: 'center',
  },
  countryCodeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
  },
  phoneHint: {
    marginTop: 8,
  },
  phoneHintText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  validPhone: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '500',
  },
  invalidPhone: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
  },
  
  // Action Buttons
  actionContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 32,
    paddingVertical: 24,
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.2)',
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
});
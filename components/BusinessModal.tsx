// components/BusinessModal.tsx - Fixed with inline category selection
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

export default function BusinessModal({ visible, onClose, onCreate }: BusinessModalProps) {
  const [businessName, setBusinessName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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

                {/* Categories Section */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Categories * ({selectedCategories.length}/5)
                  </Text>
                  <Text style={styles.helpText}>
                    Select up to 5 categories that best describe your business
                  </Text>
                  
                  {/* Categories Grid */}
                  <View style={styles.categoriesContainer}>
                    <ScrollView 
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      style={styles.categoriesScrollView}
                      contentContainerStyle={styles.categoriesScrollContent}
                    >
                      <View style={styles.categoriesGrid}>
                        {BUSINESS_CATEGORIES.map((category, index) => {
                          const isSelected = selectedCategories.includes(category);
                          return (
                            <TouchableOpacity
                              key={`category-${index}`}
                              style={[
                                styles.categoryChip,
                                isSelected && styles.selectedCategoryChip
                              ]}
                              onPress={() => handleCategoryToggle(category)}
                              disabled={loading}
                            >
                              <Text style={[
                                styles.categoryChipText,
                                isSelected && styles.selectedCategoryChipText
                              ]}>
                                {category}
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
    maxWidth: '48%', // Allows 2 per row for longer text
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
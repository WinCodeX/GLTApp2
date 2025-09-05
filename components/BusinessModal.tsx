// components/BusinessModal.tsx - Optimized with category selection
import React, { useState, useMemo } from 'react';
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

  const handleCategoryToggle = (category: string) => {
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
  };

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

  const memoizedCategories = useMemo(() => 
    BUSINESS_CATEGORIES.map(category => (
      <TouchableOpacity
        key={category}
        style={[
          styles.categoryItem,
          selectedCategories.includes(category) && styles.selectedCategory
        ]}
        onPress={() => handleCategoryToggle(category)}
        disabled={loading}
      >
        <Text style={[
          styles.categoryText,
          selectedCategories.includes(category) && styles.selectedCategoryText
        ]}>
          {category}
        </Text>
        {selectedCategories.includes(category) && (
          <Feather name="check" size={14} color="#fff" />
        )}
      </TouchableOpacity>
    )), [selectedCategories, loading]);

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
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.headerIcon}>
                  <Feather name="briefcase" size={24} color="#7c3aed" />
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
                  <View style={styles.categoriesContainer}>
                    {memoizedCategories}
                  </View>
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
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
  },
  characterCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 3,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    maxHeight: 120,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  selectedCategory: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  categoryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: '600',
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 15,
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
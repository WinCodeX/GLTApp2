// components/EditBusinessModal.tsx - Edit business modal with logo upload
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { SafeLogo } from './SafeLogo';
import { fetchCategories } from '../lib/helpers/business';
import { uploadBusinessLogo } from '../lib/helpers/uploadBusinessLogo';
import { useUser } from '../context/UserContext';
import colors from '../theme/colors';

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

interface Business {
  id: number;
  name: string;
  phone_number?: string;
  logo_url?: string;
  categories: Category[];
}

interface EditBusinessModalProps {
  visible: boolean;
  business: Business;
  onClose: () => void;
  onUpdate: (updatedBusiness: Business) => void;
}

export default function EditBusinessModal({ 
  visible, 
  business, 
  onClose, 
  onUpdate 
}: EditBusinessModalProps) {
  const { user, triggerAvatarRefresh } = useUser();
  
  const [businessName, setBusinessName] = useState(business.name);
  const [phoneNumber, setPhoneNumber] = useState(business.phone_number || '');
  const [selectedCategories, setSelectedCategories] = useState<number[]>(
    business.categories.map(cat => cat.id)
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [previewLogoUri, setPreviewLogoUri] = useState<string | null>(null);
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(Date.now());

  // Load categories on mount
  useEffect(() => {
    if (visible) {
      loadCategories();
    }
  }, [visible]);

  // Reset form when business changes
  useEffect(() => {
    setBusinessName(business.name);
    setPhoneNumber(business.phone_number || '');
    setSelectedCategories(business.categories.map(cat => cat.id));
    setPreviewLogoUri(null);
  }, [business]);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const categoriesData = await fetchCategories();
      setCategories(categoriesData);
    } catch (error: any) {
      console.error('Failed to load categories:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load categories',
        text2: error.message || 'Please try again',
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else if (prev.length < 5) {
        return [...prev, categoryId];
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Maximum categories reached',
          text2: 'You can select up to 5 categories',
        });
        return prev;
      }
    });
  };

  const pickBusinessLogo = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({
          type: 'error',
          text1: 'Photo access denied',
          text2: 'Please allow photo access to change business logo',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;
      
      const asset = result.assets[0];
      console.log('Selected business logo:', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize
      });
      
      setPreviewLogoUri(asset.uri);
    } catch (error) {
      console.error('Error picking business logo:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to select image',
        text2: 'Please try again',
      });
    }
  }, []);

  const uploadLogo = async () => {
    if (!previewLogoUri) return;

    try {
      setLogoUploading(true);
      console.log('Starting business logo upload...');
      
      const result = await uploadBusinessLogo(previewLogoUri, business.id);
      
      if (result.success && result.logo_url) {
        console.log('Business logo uploaded successfully');
        setLogoUpdateTrigger(Date.now());
        triggerAvatarRefresh();
        
        Toast.show({
          type: 'success',
          text1: 'Business logo updated!',
          text2: 'Logo has been changed successfully',
        });
        
        // Update the business object with new logo URL
        const updatedBusiness = { ...business, logo_url: result.logo_url };
        onUpdate(updatedBusiness);
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Business logo upload error:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2: error.message || 'Please try again',
      });
    } finally {
      setPreviewLogoUri(null);
      setLogoUploading(false);
    }
  };

  const validateForm = () => {
    if (!businessName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Business name is required',
      });
      return false;
    }

    if (selectedCategories.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error', 
        text2: 'Please select at least one category',
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      // Here you would typically call an API to update the business
      // For now, we'll just simulate success
      const updatedBusiness = {
        ...business,
        name: businessName.trim(),
        phone_number: phoneNumber.trim(),
        categories: categories.filter(cat => selectedCategories.includes(cat.id))
      };

      Toast.show({
        type: 'success',
        text1: 'Business updated!',
        text2: 'Changes have been saved successfully',
      });

      onUpdate(updatedBusiness);
      onClose();
    } catch (error: any) {
      console.error('Update business error:', error);
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: error.message || 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Edit Business</Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={styles.saveButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Business Logo Section */}
          <View style={styles.logoSection}>
            <Text style={styles.sectionTitle}>Business Logo</Text>
            
            <View style={styles.logoContainer}>
              <SafeLogo
                size={80}
                logoUrl={business.logo_url}
                avatarUrl={user?.avatar_url}
                style={styles.logo}
                onPress={pickBusinessLogo}
                updateTrigger={logoUpdateTrigger}
              />
              
              <TouchableOpacity 
                style={styles.logoButton}
                onPress={pickBusinessLogo}
                disabled={logoUploading}
              >
                <Feather 
                  name={logoUploading ? "loader" : "camera"} 
                  size={16} 
                  color="#fff" 
                />
                <Text style={styles.logoButtonText}>
                  {logoUploading ? 'Uploading...' : 'Change Logo'}
                </Text>
              </TouchableOpacity>
            </View>

            {previewLogoUri && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewText}>New logo preview:</Text>
                <SafeLogo
                  size={60}
                  logoUrl={previewLogoUri}
                  style={styles.previewLogo}
                />
                <View style={styles.previewActions}>
                  <TouchableOpacity 
                    style={styles.previewCancel}
                    onPress={() => setPreviewLogoUri(null)}
                  >
                    <Text style={styles.previewCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.previewConfirm}
                    onPress={uploadLogo}
                    disabled={logoUploading}
                  >
                    <Text style={styles.previewConfirmText}>
                      {logoUploading ? 'Uploading...' : 'Upload'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Business Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Enter business name"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>

          {/* Phone Number */}
          <View style={styles.section}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter phone number"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="phone-pad"
            />
          </View>

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Categories * ({selectedCategories.length}/5)
            </Text>
            
            {loadingCategories ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : (
              <View style={styles.categoriesContainer}>
                {categories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryItem,
                        isSelected && styles.selectedCategoryItem
                      ]}
                      onPress={() => toggleCategory(category.id)}
                    >
                      <Text style={[
                        styles.categoryText,
                        isSelected && styles.selectedCategoryText
                      ]}>
                        {category.name}
                      </Text>
                      {isSelected && (
                        <Feather name="check" size={16} color="#fff" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  logoSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    marginBottom: 12,
  },
  logoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  logoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  previewText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  previewLogo: {
    marginBottom: 12,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  previewCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  previewCancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  previewConfirm: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  previewConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    gap: 6,
  },
  selectedCategoryItem: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: '500',
  },
});
// components/EditBusinessModal.tsx - Fixed with ImagePreviewModal and category fetching
import React, { useState, useEffect, useCallback, Suspense } from 'react';
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
import { fetchCategories, validatePhoneNumber, formatPhoneNumber } from '../lib/helpers/business';
import { uploadBusinessLogo } from '../lib/helpers/uploadBusinessLogo';
import { useUser } from '../context/UserContext';
import colors from '../theme/colors';

// Lazy load ImagePreviewModal
const ImagePreviewModal = React.lazy(() => import('./ImagePreviewModal'));

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

export default function EditBusinessModal({ 
  visible, 
  business, 
  onClose, 
  onUpdate 
}: EditBusinessModalProps) {
  const { user, triggerAvatarRefresh, clearUserCache, refreshBusinesses } = useUser();
  
  // Form states
  const [businessName, setBusinessName] = useState(business.name);
  const [phoneNumber, setPhoneNumber] = useState(business.phone_number || '');
  const [selectedCategories, setSelectedCategories] = useState<number[]>(
    business.categories.map(cat => cat.id)
  );
  
  // Categories data
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  
  // Image upload states
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(Date.now());
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null);

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
    setPreviewUri(null);
    setLocalLogoUrl(null);
  }, [business]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    setCategoriesError(null);
    
    try {
      console.log('🏷️ EditBusinessModal: Loading categories...');
      const categoriesData = await fetchCategories();
      setCategories(categoriesData);
      console.log('🏷️ EditBusinessModal: Categories loaded:', categoriesData.length);
    } catch (error: any) {
      console.error('🏷️ EditBusinessModal: Error loading categories:', error);
      setCategoriesError('Failed to load categories. Please try again.');
      
      // Set some default categories as fallback
      setCategories([
        { id: 1, name: 'Technology', slug: 'technology' },
        { id: 2, name: 'Retail', slug: 'retail' },
        { id: 3, name: 'Food & Beverage', slug: 'food-beverage' },
        { id: 4, name: 'Healthcare', slug: 'healthcare' },
        { id: 5, name: 'Other', slug: 'other' }
      ]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const retryLoadCategories = () => {
    loadCategories();
  };

  const toggleCategory = useCallback((categoryId: number) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else if (prev.length < 5) {
        return [...prev, categoryId];
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

  // Enhanced business logo picker
  const pickBusinessLogo = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast.error('Photo access denied', 'Please allow photo access to change business logo');
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
      console.log('🎭 EditBusinessModal: Selected business logo:', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize
      });
      
      setPreviewUri(asset.uri);
    } catch (error) {
      console.error('🎭 EditBusinessModal: Error picking business logo:', error);
      showToast.error('Failed to select image', 'Please try again');
    }
  }, []);

  // Enhanced upload handler with instant feedback
  const confirmUploadLogo = useCallback(async () => {
    if (!previewUri) return;

    try {
      console.log('🎭 EditBusinessModal: Starting business logo upload...');
      
      const result = await uploadBusinessLogo(previewUri, business.id);
      
      if (result.success && result.logo_url) {
        console.log('🎭 EditBusinessModal: Business logo uploaded successfully');
        
        // INSTANT UPDATE: Set local logo for immediate visual feedback
        setLocalLogoUrl(result.logo_url);
        setLogoUpdateTrigger(Date.now());
        triggerAvatarRefresh();
        
        showToast.success('Business logo updated!', 'Logo has been changed successfully');
        
        // Update the business object with new logo URL and notify parent
        const updatedBusiness = { ...business, logo_url: result.logo_url };
        onUpdate(updatedBusiness);
        
        // Background sync (don't await to keep UI responsive)
        setTimeout(async () => {
          try {
            await clearUserCache();
            await refreshBusinesses(true);
          } catch (bgError) {
            console.error('Background refresh error:', bgError);
          }
        }, 1000);
        
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('🎭 EditBusinessModal: Business logo upload error:', error);
      showToast.error('Upload failed', error.message || 'Please try again');
    } finally {
      setPreviewUri(null);
    }
  }, [previewUri, business, onUpdate, triggerAvatarRefresh, clearUserCache, refreshBusinesses]);

  const validateForm = () => {
    if (!businessName.trim()) {
      showToast.error('Validation Error', 'Business name is required');
      return false;
    }

    if (businessName.trim().length < 2) {
      showToast.error('Validation Error', 'Business name must be at least 2 characters long');
      return false;
    }

    if (phoneNumber.trim() && !validatePhoneNumber(phoneNumber)) {
      showToast.error('Invalid Phone Number', 'Please enter a valid Kenyan phone number (e.g., 712345678 or +254712345678)');
      return false;
    }

    if (selectedCategories.length === 0) {
      showToast.error('Validation Error', 'Please select at least one category');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      // Here you would typically call an API to update the business
      // For now, we'll simulate success
      const updatedBusiness = {
        ...business,
        name: businessName.trim(),
        phone_number: phoneNumber.trim() ? formatPhoneNumber(phoneNumber.trim()) : '',
        categories: categories.filter(cat => selectedCategories.includes(cat.id)),
        // Keep the current logo URL unless we have a new local one
        logo_url: localLogoUrl || business.logo_url
      };

      showToast.success('Business updated!', 'Changes have been saved successfully');

      onUpdate(updatedBusiness);
      onClose();
    } catch (error: any) {
      console.error('Update business error:', error);
      showToast.error('Update failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  // Get current logo URL (local takes precedence for instant updates)
  const getCurrentLogoUrl = () => {
    return localLogoUrl || business.logo_url;
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
                logoUrl={getCurrentLogoUrl()}
                avatarUrl={user?.avatar_url}
                style={styles.logo}
                onPress={pickBusinessLogo}
                updateTrigger={logoUpdateTrigger}
              />
              
              <TouchableOpacity 
                style={styles.logoButton}
                onPress={pickBusinessLogo}
              >
                <Feather name="camera" size={16} color="#fff" />
                <Text style={styles.logoButtonText}>Change Logo</Text>
              </TouchableOpacity>
            </View>
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
              maxLength={50}
              editable={!loading}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Text style={styles.characterCount}>
              {businessName.length}/50
            </Text>
          </View>

          {/* Phone Number */}
          <View style={styles.section}>
            <Text style={styles.label}>Phone Number</Text>
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
                placeholderTextColor="rgba(255,255,255,0.5)"
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

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Categories * ({selectedCategories.length}/5)
            </Text>
            <Text style={styles.helpText}>
              Select up to 5 categories that best describe your business
            </Text>
            
            {loadingCategories ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : categoriesError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{categoriesError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={retryLoadCategories}>
                  <Feather name="refresh-cw" size={16} color={colors.primary} />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.categoriesContainer}>
                <ScrollView 
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  style={styles.categoriesScrollView}
                  contentContainerStyle={styles.categoriesScrollContent}
                >
                  <View style={styles.categoriesGrid}>
                    {categories.map((category) => {
                      const isSelected = selectedCategories.includes(category.id);
                      return (
                        <TouchableOpacity
                          key={`category-${category.id}`}
                          style={[
                            styles.categoryChip,
                            isSelected && styles.selectedCategoryChip
                          ]}
                          onPress={() => toggleCategory(category.id)}
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
        </ScrollView>

        {/* Lazy loaded ImagePreviewModal */}
        <Suspense fallback={<View />}>
          {previewUri && (
            <ImagePreviewModal
              visible={true}
              uri={previewUri}
              uploadType="business-logo"
              businessName={business.name}
              onCancel={() => setPreviewUri(null)}
              onConfirm={confirmUploadLogo}
            />
          )}
        </Suspense>
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
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
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
});
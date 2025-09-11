// app/(drawer)/business.tsx - Business Screen with Enhanced NavigationHelper
import React, { useState, Suspense, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '../../context/UserContext';
import colors from '../../theme/colors';
import LoginModal from '../../components/LoginModal';
import SignupModal from '../../components/SignupModal';
import { createInvite } from '../../lib/helpers/business';
import { SafeLogo } from '../../components/SafeLogo';

// Import Enhanced NavigationHelper
import { NavigationHelper } from '../../lib/helpers/navigation';

// Import the upload helpers
import { uploadAvatar } from '../../lib/helpers/uploadAvatar';
import { uploadBusinessLogo } from '../../lib/helpers/uploadBusinessLogo';

// Lazy load business modals and components
const BusinessModal = React.lazy(() => import('../../components/BusinessModal'));
const JoinBusinessModal = React.lazy(() => import('../../components/JoinBusinessModal'));
const ImagePreviewModal = React.lazy(() => import('../../components/ImagePreviewModal'));
const EditBusinessModal = React.lazy(() => import('../../components/EditBusinessModal'));

interface BusinessProps {
  navigation: any;
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
  
  info: (text1: string, text2?: string) => {
    Toast.show({
      type: 'info',
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 3000,
    });
  },
};

export default function Business({ navigation }: BusinessProps) {
  const { 
    user, 
    businesses,
    getUserPhone,
    getDisplayName,
    refreshBusinesses,
    refreshUser,
    clearUserCache,
    selectedBusiness,
    setSelectedBusiness,
    avatarUpdateTrigger,
    triggerAvatarRefresh,
  } = useUser();

  // Core modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // UI states
  const [showAddBusinessOptions, setShowAddBusinessOptions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Business sharing states
  const [selectedBusinessForShare, setSelectedBusinessForShare] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  
  // Image upload states
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'avatar' | 'business-logo'>('avatar');
  const [selectedBusinessForUpload, setSelectedBusinessForUpload] = useState<any>(null);
  
  // Update triggers for immediate visual feedback
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(Date.now());
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [localBusinessLogos, setLocalBusinessLogos] = useState<Record<number, string>>({});

  const userPhone = getUserPhone();
  const username = getDisplayName();

  // Enhanced refresh handler
  const onRefresh = useCallback(async () => {
    try {
      if (!user) {
        showToast.warning('Please log in first');
        return;
      }

      setRefreshing(true);
      console.log('🔄 Business: Manual refresh triggered');
      
      await clearUserCache();
      await refreshUser(true);
      await refreshBusinesses(true);
      
      triggerAvatarRefresh();
      setLogoUpdateTrigger(Date.now());
      
      // Clear local URLs to force refresh from server
      setLocalAvatarUrl(null);
      setLocalBusinessLogos({});
      
      showToast.success('Data refreshed');
    } catch (error) {
      console.error('🔄 Business: Refresh error:', error);
      showToast.error('Failed to refresh data', 'Please check your connection');
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh, user]);

  // Enhanced back navigation using NavigationHelper
  const handleGoBack = useCallback(async () => {
    console.log('🔙 Business: Going back...');
    
    try {
      const success = await NavigationHelper.goBack({
        fallbackRoute: '/(drawer)/',
        replaceIfNoHistory: true
      });
      
      if (!success) {
        console.log('🔙 Business: Back navigation used fallback');
      }
    } catch (error) {
      console.error('🔙 Business: Back navigation failed:', error);
    }
  }, []);

  const handleLogin = () => setShowLoginModal(true);
  const handleSignup = () => setShowSignupModal(true);

  const switchToSignup = () => {
    setShowLoginModal(false);
    setTimeout(() => setShowSignupModal(true), 300);
  };

  const switchToLogin = () => {
    setShowSignupModal(false);
    setTimeout(() => setShowLoginModal(true), 300);
  };

  // Handle business selection
  const handleBusinessSelect = (business: any) => {
    console.log('🎭 Business: Selecting business:', business.name);
    setSelectedBusiness(business);
    showToast.info('Business selected', business.name);
  };

  // Enhanced navigation to business details using NavigationHelper
  const handleBusinessDetails = useCallback(async (business: any) => {
    console.log('🎭 Business: Navigating to business details:', business.name);
    setSelectedBusiness(business);
    
    try {
      await NavigationHelper.navigateTo('/(drawer)/BusinessDetails');
      console.log('✅ Business: Successfully navigated to BusinessDetails');
    } catch (error) {
      console.error('❌ Business: Navigation to BusinessDetails failed:', error);
    }
  }, [setSelectedBusiness]);

  // Handle creating new business
  const handleCreateBusiness = () => {
    setShowAddBusinessOptions(false);
    setShowBusinessModal(true);
  };

  // Handle joining business
  const handleJoinBusiness = () => {
    setShowAddBusinessOptions(false);
    setShowJoinModal(true);
  };

  // Handle business modal close with refresh and auto-select
  const handleBusinessModalClose = async (newBusiness?: any) => {
    setShowBusinessModal(false);
    try {
      console.log('🔄 Business: Refreshing businesses after modal close');
      await refreshBusinesses(true);
      setLogoUpdateTrigger(Date.now());
      
      // Auto-select newly created business
      if (newBusiness) {
        console.log('🎭 Business: Auto-selecting newly created business:', newBusiness.name);
        setSelectedBusiness(newBusiness);
        showToast.success('Business created!', `${newBusiness.name} is now selected`);
      }
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };

  // Handle join modal close with refresh
  const handleJoinModalClose = async () => {
    setShowJoinModal(false);
    try {
      console.log('🔄 Business: Refreshing businesses after join modal close');
      await refreshBusinesses(true);
      setLogoUpdateTrigger(Date.now());
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };

  // Handle business update from edit modal
  const handleBusinessUpdate = async (updatedBusiness: any) => {
    try {
      console.log('🔄 Business: Handling business update:', updatedBusiness);
      
      // Update local business logo cache if logo changed
      if (updatedBusiness.logo_url && selectedBusiness?.id === updatedBusiness.id) {
        setLocalBusinessLogos(prev => ({
          ...prev,
          [updatedBusiness.id]: updatedBusiness.logo_url
        }));
      }
      
      // Update selected business if it's the one being edited
      if (selectedBusiness?.id === updatedBusiness.id) {
        setSelectedBusiness(updatedBusiness);
      }
      
      await refreshBusinesses(true);
      setLogoUpdateTrigger(Date.now());
      triggerAvatarRefresh();
    } catch (error) {
      console.error('Error refreshing after business update:', error);
    }
  };

  // Enhanced context-aware image picker
  const pickAndPreviewImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast.error('Photo access denied', 'Please allow photo access to change image');
        return;
      }

      // Determine upload context based on selected business
      const isBusinessSelected = selectedBusiness;
      const targetUploadType: 'avatar' | 'business-logo' = isBusinessSelected ? 'business-logo' : 'avatar';
      const targetBusiness = isBusinessSelected ? selectedBusiness : null;

      console.log('🎭 Business: Image picker context:', {
        selectedBusiness: selectedBusiness?.name || 'None',
        uploadType: targetUploadType,
        business: targetBusiness?.name || 'None'
      });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;
      
      const asset = result.assets[0];
      console.log(`🎭 Business: Selected ${targetUploadType}:`, {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize
      });
      
      setUploadType(targetUploadType);
      setSelectedBusinessForUpload(targetBusiness);
      setPreviewUri(asset.uri);
    } catch (error) {
      console.error('Business: Error picking image:', error);
      showToast.error('Failed to select image', 'Please try again');
    }
  }, [selectedBusiness]);

  // Enhanced upload handler with instant visual feedback
  const confirmUploadImage = useCallback(async () => {
    try {
      if (!previewUri) return;

      const isBusinessLogoUpload = uploadType === 'business-logo';
      const targetBusiness = selectedBusinessForUpload;

      console.log(`🎭 Business: Starting ${uploadType} upload process...`, {
        business: targetBusiness?.name || 'None',
        uploadType
      });
      
      let result;
      if (isBusinessLogoUpload && targetBusiness) {
        // Upload business logo
        result = await uploadBusinessLogo(previewUri, targetBusiness.id);
        console.log('🎭 Business: Business logo upload result:', result);
        
        // INSTANT UPDATE: Update local logo cache immediately
        if (result?.success && result?.logo_url) {
          console.log('🎭 Business: Updating local business logo cache');
          setLocalBusinessLogos(prev => ({
            ...prev,
            [targetBusiness.id]: result.logo_url
          }));
          
          // Update selected business if it's the one we uploaded to
          if (selectedBusiness?.id === targetBusiness.id) {
            setSelectedBusiness({
              ...selectedBusiness,
              logo_url: result.logo_url
            });
          }
        }
      } else {
        // Upload user avatar
        result = await uploadAvatar(previewUri);
        console.log('🎭 Business: Avatar upload result:', result);
        
        // INSTANT UPDATE: Update local avatar cache immediately
        if (result?.success && result?.avatar_url) {
          console.log('🎭 Business: Updating local avatar cache');
          setLocalAvatarUrl(result.avatar_url);
        }
      }
      
      // Check for success
      if (result?.success || result?.logo_url || result?.avatar_url) {
        console.log(`🎭 Business: ${uploadType} uploaded successfully, starting background sync...`);
        
        // Trigger immediate UI refresh
        setLogoUpdateTrigger(Date.now());
        triggerAvatarRefresh();
        
        // Background refresh (don't await to keep UI responsive)
        setTimeout(async () => {
          try {
            await clearUserCache();
            await refreshUser(true);
            await refreshBusinesses(true);
          } catch (bgError) {
            console.error('Background refresh error:', bgError);
          }
        }, 1000);
        
        showToast.success(
          `${isBusinessLogoUpload ? 'Business logo' : 'Avatar'} updated!`, 
          `Your ${uploadType.replace('-', ' ')} has been changed`
        );
        
        console.log(`🎭 Business: ${uploadType} upload completed with instant feedback`);
      } else {
        throw new Error(`Upload successful but no ${uploadType} URL returned`);
      }
      
    } catch (error: any) {
      console.error('🎭 Business: Error during image upload:', error);
      showToast.error('Upload failed', error.message || 'Please try again');
    } finally {
      setPreviewUri(null);
      setSelectedBusinessForUpload(null);
    }
  }, [previewUri, uploadType, selectedBusinessForUpload, selectedBusiness, refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh]);

  // Get the appropriate image URL based on selected business
  const getCurrentImageUrl = () => {
    if (selectedBusiness) {
      // Check local cache first for instant updates
      const localLogoUrl = localBusinessLogos[selectedBusiness.id];
      return localLogoUrl || selectedBusiness.logo_url;
    } else {
      // Personal mode - use avatar
      return localAvatarUrl || user?.avatar_url;
    }
  };

  // Get the current display info
  const getCurrentDisplayInfo = () => {
    if (selectedBusiness) {
      return {
        name: selectedBusiness.name,
        phone: selectedBusiness.phone_number || userPhone,
        type: 'Business'
      };
    } else {
      return {
        name: username,
        phone: userPhone,
        type: 'Personal Account'
      };
    }
  };

  // Render business item with enhanced navigation
  const renderBusinessItem = useCallback((business: any, isOwned: boolean = true) => (
    <TouchableOpacity
      key={business.id}
      style={[
        styles.businessItem,
        selectedBusiness?.id === business.id && styles.selectedBusinessItem
      ]}
      onPress={() => isOwned ? handleBusinessDetails(business) : handleBusinessSelect(business)}
      activeOpacity={0.7}
    >
      <SafeLogo
        size={40}
        logoUrl={localBusinessLogos[business.id] || business.logo_url}
        avatarUrl={user?.avatar_url}
        style={styles.businessItemLogo}
        updateTrigger={logoUpdateTrigger}
      />
      
      <View style={styles.businessItemInfo}>
        <Text style={styles.businessItemName}>{business.name}</Text>
        <Text style={styles.businessItemPhone}>
          {business.phone_number || 'No phone number'}
        </Text>
        {business.categories && business.categories.length > 0 && (
          <Text style={styles.businessItemCategories}>
            {business.categories.slice(0, 2).map(cat => cat.name).join(', ')}
            {business.categories.length > 2 && ` +${business.categories.length - 2} more`}
          </Text>
        )}
      </View>
      
      <View style={styles.businessItemActions}>
        {selectedBusiness?.id === business.id && (
          <View style={styles.selectedIndicator}>
            <Feather name="check-circle" size={20} color="#7c3aed" />
          </View>
        )}
        <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
      </View>
    </TouchableOpacity>
  ), [selectedBusiness, localBusinessLogos, user?.avatar_url, logoUpdateTrigger, handleBusinessDetails, handleBusinessSelect]);

  const currentInfo = getCurrentDisplayInfo();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Business</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIcon}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Feather 
              name="refresh-cw" 
              size={20} 
              color="#fff" 
              style={refreshing ? { opacity: 0.6 } : {}}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="plus-square" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="menu" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#7c3aed']}
            tintColor="#7c3aed"
            title="Pull to refresh"
            titleColor="#7c3aed"
          />
        }
      >
        {/* Profile Section - Current Selection */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <SafeLogo
              size={86}
              logoUrl={getCurrentImageUrl()}
              avatarUrl={selectedBusiness ? null : getCurrentImageUrl()}
              style={styles.avatar}
              onPress={pickAndPreviewImage}
              updateTrigger={logoUpdateTrigger + avatarUpdateTrigger}
            />
          </View>

          <View style={styles.currentInfoContainer}>
            <Text style={styles.currentInfoType}>{currentInfo.type}</Text>
            <Text style={styles.currentInfoName}>{currentInfo.name}</Text>
            <Text style={styles.currentInfoPhone}>{currentInfo.phone}</Text>
          </View>
        </View>

        {/* Businesses Section */}
        <View style={styles.businessesSection}>
          <Text style={styles.sectionTitle}>Businesses</Text>
          
          {/* Owned Businesses */}
          <View style={styles.businessSubsection}>
            <Text style={styles.subsectionTitle}>Owned Businesses</Text>
            <View style={styles.businessList}>
              {businesses.owned.length > 0 ? (
                <>
                  {businesses.owned.map(business => renderBusinessItem(business, true))}
                  {/* Only show Add Another Business button if owned businesses < 2 */}
                  {businesses.owned.length < 2 && (
                    <TouchableOpacity
                      style={styles.addBusinessButton}
                      onPress={() => setShowAddBusinessOptions(true)}
                    >
                      <Feather name="plus" size={20} color="#7c3aed" />
                      <Text style={styles.addBusinessText}>Add Another Business</Text>
                      <Feather name="chevron-right" size={20} color="#7c3aed" />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={styles.createBusinessButton}
                  onPress={handleCreateBusiness}
                >
                  <Feather name="plus-circle" size={24} color="#7c3aed" />
                  <Text style={styles.createBusinessText}>Create Your First Business</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Joined Businesses */}
          <View style={styles.businessSubsection}>
            <Text style={styles.subsectionTitle}>Joined Businesses</Text>
            <View style={styles.businessList}>
              {businesses.joined.length > 0 ? (
                <>
                  {businesses.joined.map(business => renderBusinessItem(business, false))}
                  {/* Only show Join Another Business button if joined businesses < 2 */}
                  {businesses.joined.length < 2 && (
                    <TouchableOpacity
                      style={styles.joinBusinessButton}
                      onPress={handleJoinBusiness}
                    >
                      <Feather name="users" size={20} color="#7c3aed" />
                      <Text style={styles.joinBusinessText}>Join Another Business</Text>
                      <Feather name="chevron-right" size={20} color="#7c3aed" />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={styles.joinBusinessButton}
                  onPress={handleJoinBusiness}
                >
                  <Feather name="users" size={24} color="#7c3aed" />
                  <Text style={styles.joinBusinessText}>Join a Business</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Add Business Options Modal */}
      {showAddBusinessOptions && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowAddBusinessOptions(false)}
          >
            <View style={styles.optionsModal}>
              <Text style={styles.optionsTitle}>Add Business</Text>
              <Text style={styles.optionsSubtitle}>Choose an option</Text>
              
              <TouchableOpacity style={styles.optionButton} onPress={handleCreateBusiness}>
                <Feather name="plus-circle" size={28} color="#7c3aed" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Create New</Text>
                  <Text style={styles.optionDescription}>Start a new business</Text>
                </View>
              </TouchableOpacity>

              {/* Only show Join Existing option if joined businesses < 2 */}
              {businesses.joined.length < 2 && (
                <TouchableOpacity style={styles.optionButton} onPress={handleJoinBusiness}>
                  <Feather name="users" size={28} color="#7c3aed" />
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Join Existing</Text>
                    <Text style={styles.optionDescription}>Join a business</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Lazy loaded modals */}
      <Suspense fallback={<View />}>
        {showBusinessModal && (
          <BusinessModal
            visible={showBusinessModal}
            onClose={handleBusinessModalClose}
            onCreate={handleBusinessModalClose}
          />
        )}

        {showJoinModal && (
          <JoinBusinessModal
            visible={showJoinModal}
            onClose={handleJoinModalClose}
            onJoin={handleJoinModalClose}
          />
        )}

        {showEditModal && selectedBusiness && (
          <EditBusinessModal
            visible={showEditModal}
            business={selectedBusiness}
            onClose={() => setShowEditModal(false)}
            onUpdate={handleBusinessUpdate}
          />
        )}

        {previewUri && (
          <ImagePreviewModal
            visible={true}
            uri={previewUri}
            uploadType={uploadType}
            businessName={uploadType === 'business-logo' ? selectedBusinessForUpload?.name : undefined}
            onCancel={() => {
              setPreviewUri(null);
              setSelectedBusinessForUpload(null);
            }}
            onConfirm={confirmUploadImage}
          />
        )}
      </Suspense>

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToSignup={switchToSignup}
      />

      <SignupModal
        visible={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSwitchToLogin={switchToLogin}
      />
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  avatarContainer: {
    marginRight: 20,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  currentInfoContainer: {
    flex: 1,
  },
  currentInfoType: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  currentInfoName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentInfoPhone: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
  },
  businessesSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  businessSubsection: {
    marginBottom: 24,
  },
  subsectionTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  businessList: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    overflow: 'hidden',
  },
  businessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  selectedBusinessItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  businessItemLogo: {
    marginRight: 12,
  },
  businessItemInfo: {
    flex: 1,
  },
  businessItemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  businessItemPhone: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 2,
  },
  businessItemCategories: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '500',
  },
  businessItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedIndicator: {
    // Visual indicator for selected business
  },
  createBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  createBusinessText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '600',
  },
  addBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.3)',
  },
  addBusinessText: {
    flex: 1,
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  joinBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  joinBusinessText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsModal: {
    backgroundColor: '#16213e',
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    width: '85%',
    maxWidth: 400,
  },
  optionsTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  optionsSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    marginBottom: 20,
  },
  optionContent: {
    flex: 1,
    marginLeft: 20,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  optionDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    lineHeight: 22,
  },
});
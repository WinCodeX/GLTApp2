// app/(drawer)/Business.tsx - Complete rewrite with business logo and edit functionality
import React, { useState, Suspense, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useUser } from '../../context/UserContext';
import colors from '../../theme/colors';
import LoginModal from '../../components/LoginModal';
import SignupModal from '../../components/SignupModal';
import { createInvite } from '../../lib/helpers/business';
import { getFullAvatarUrl } from '../../lib/api';
import { SafeLogo } from '../../components/SafeLogo';

// Import the upload helpers
import { uploadAvatar } from '../../lib/helpers/uploadAvatar';
import { uploadBusinessLogo } from '../../lib/helpers/uploadBusinessLogo';

// Lazy load business modals and components
const BusinessModal = React.lazy(() => import('../../components/BusinessModal'));
const JoinBusinessModal = React.lazy(() => import('../../components/JoinBusinessModal'));
const AvatarPreviewModal = React.lazy(() => import('../../components/AvatarPreviewModal'));
const EditBusinessModal = React.lazy(() => import('../../components/EditBusinessModal'));

interface BusinessProps {
  navigation: any;
}

// Enhanced Safe Avatar Component with business logo support
interface SafeAvatarProps {
  size: number;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
  onPress?: () => void;
  updateTrigger?: number;
}

const SafeAvatar: React.FC<SafeAvatarProps> = ({ 
  size, 
  avatarUrl, 
  fallbackSource = require('../../assets/images/avatar_placeholder.png'),
  style,
  onPress,
  updateTrigger = 0
}) => {
  const [hasError, setHasError] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  useEffect(() => {
    console.log('🎭 Business SafeAvatar: Update triggered', {
      avatarUrl,
      updateTrigger,
      timestamp: Date.now()
    });
    
    setHasError(false);
    setImageKey(Date.now());
  }, [avatarUrl, updateTrigger]);
  
  if (!fullAvatarUrl || hasError) {
    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Image
          source={fallbackSource}
          style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <Image
        source={{ 
          uri: `${fullAvatarUrl}?v=${imageKey}&t=${updateTrigger}`,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={() => {
          console.warn('🎭 Business SafeAvatar: Failed to load:', fullAvatarUrl);
          setHasError(true);
        }}
      />
    </TouchableOpacity>
  );
};

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
  const router = useRouter();
  const { 
    user, 
    businesses,
    currentAccount,
    getBusinessDisplayName, 
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

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [selectedBusinessForShare, setSelectedBusinessForShare] = useState(null);
  const [currentBusinessIndex, setCurrentBusinessIndex] = useState(0);
  const [inviteLink, setInviteLink] = useState(null);
  const [showAddBusinessOptions, setShowAddBusinessOptions] = useState(false);
  
  // Avatar/Logo functionality states
  const [previewUri, setPreviewUri] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(Date.now());
  
  // Refresh functionality states
  const [refreshing, setRefreshing] = useState(false);

  const displayName = getBusinessDisplayName();
  const userPhone = getUserPhone();
  const username = getDisplayName();

  const currentBusiness = selectedBusiness || businesses.owned[currentBusinessIndex] || businesses.owned[0];

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
      
      showToast.success('Data refreshed');
    } catch (error) {
      console.error('🔄 Business: Refresh error:', error);
      showToast.error('Failed to refresh data', 'Please check your connection');
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh, user]);

  // Fixed back navigation
  const handleGoBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      try {
        if (navigation?.goBack) {
          navigation.goBack();
        } else if (navigation?.navigate) {
          navigation.navigate('index');
        }
      } catch (navError) {
        console.error('Fallback navigation error:', navError);
      }
    }
  };

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

  // Business dropdown selection
  const handleBusinessSelect = (businessIndex: number) => {
    const selectedBiz = businesses.owned[businessIndex];
    setCurrentBusinessIndex(businessIndex);
    setSelectedBusiness?.(selectedBiz);
    setShowBusinessDropdown(false);
    showToast.info('Business selected', selectedBiz?.name);
  };

  // Share business functionality
  const handleShareBusiness = () => {
    if (currentBusiness) {
      setSelectedBusinessForShare(currentBusiness);
    } else {
      showToast.warning('No business selected', 'Please select a business first');
    }
  };

  // Generate invite link
  const generateInviteLink = async () => {
    if (!selectedBusinessForShare) return;

    try {
      const result = await createInvite(selectedBusinessForShare.id);
      setInviteLink(result?.code || 'No code generated');
      showToast.success('Invite link generated', 'Copy and share with your team');
    } catch (error) {
      console.error('Error creating invite:', error);
      showToast.error('Failed to create invite', 'Please try again');
    }
  };

  // Copy invite link
  const copyInviteLink = () => {
    if (inviteLink) {
      Clipboard.setStringAsync(inviteLink);
      showToast.success('Copied to clipboard!', 'Share this invite code');
    }
  };

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

  // Handle business modal close with refresh
  const handleBusinessModalClose = async () => {
    setShowBusinessModal(false);
    try {
      console.log('🔄 Business: Refreshing businesses after modal close');
      await refreshBusinesses?.(true);
      setLogoUpdateTrigger(Date.now());
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };

  // Handle join modal close with refresh
  const handleJoinModalClose = async () => {
    setShowJoinModal(false);
    try {
      console.log('🔄 Business: Refreshing businesses after join modal close');
      await refreshBusinesses?.(true);
      setLogoUpdateTrigger(Date.now());
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };

  // Handle business update from edit modal
  const handleBusinessUpdate = async (updatedBusiness: any) => {
    try {
      console.log('🔄 Business: Refreshing after business update');
      await refreshBusinesses?.(true);
      setLogoUpdateTrigger(Date.now());
      triggerAvatarRefresh();
    } catch (error) {
      console.error('Error refreshing after business update:', error);
    }
  };

  // Context-aware image picker - handles both avatar and business logo
  const pickAndPreviewImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast.error('Photo access denied', 'Please allow photo access to change image');
        return;
      }

      // Determine what we're uploading based on current context
      const isBusinessLogoUpload = !!currentBusiness;
      const uploadType = isBusinessLogoUpload ? 'business logo' : 'avatar';

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;
      
      const asset = result.assets[0];
      console.log(`🎭 Business: Selected ${uploadType}:`, {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize
      });
      
      setPreviewUri(asset.uri);
    } catch (error) {
      console.error('Business: Error picking image:', error);
      showToast.error('Failed to select image', 'Please try again');
    }
  }, [currentBusiness]);

  // Context-aware upload handler
  const confirmUploadImage = useCallback(async () => {
    try {
      if (!previewUri) return;

      setAvatarLoading(true);
      const isBusinessLogoUpload = !!currentBusiness;
      const uploadType = isBusinessLogoUpload ? 'business logo' : 'avatar';

      console.log(`🎭 Business: Starting ${uploadType} upload process...`);
      
      let result;
      if (isBusinessLogoUpload) {
        // Upload business logo
        result = await uploadBusinessLogo(previewUri, currentBusiness.id);
        console.log('🎭 Business: Business logo upload result:', result);
      } else {
        // Upload user avatar
        result = await uploadAvatar(previewUri);
        console.log('🎭 Business: Avatar upload result:', result);
      }
      
      // Check for success
      if (result?.success || result?.logo_url || result?.avatar_url) {
        console.log(`🎭 Business: ${uploadType} uploaded successfully, starting synchronization...`);
        
        // Clear all caches
        console.log('🎭 Business: Clearing all caches...');
        await clearUserCache();
        
        // Wait a moment for server to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force refresh data
        console.log('🎭 Business: Force refreshing data...');
        await refreshUser(true);
        await refreshBusinesses(true);
        
        // Trigger UI refresh
        console.log('🎭 Business: Triggering UI refresh...');
        triggerAvatarRefresh();
        setLogoUpdateTrigger(Date.now());
        
        // Another small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 200));
        
        showToast.success(
          `${isBusinessLogoUpload ? 'Business logo' : 'Avatar'} updated!`, 
          `Your ${uploadType} has been changed`
        );
        
        console.log(`🎭 Business: ${uploadType} upload and synchronization completed`);
      } else {
        throw new Error(`Upload successful but no ${uploadType} URL returned`);
      }
      
    } catch (error: any) {
      console.error('🎭 Business: Error during image upload:', error);
      showToast.error('Upload failed', error.message || 'Please try again');
    } finally {
      setPreviewUri(null);
      setAvatarLoading(false);
    }
  }, [previewUri, currentBusiness, refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh]);

  // Context-aware avatar display selection
  const getDisplayImageUrl = () => {
    if (currentBusiness?.logo_url) {
      return currentBusiness.logo_url;
    }
    return user?.avatar_url;
  };

  // Context-aware upload button text
  const getUploadButtonText = () => {
    if (currentBusiness) {
      return currentBusiness.logo_url ? 'Change Logo' : 'Add Logo';
    }
    return user?.avatar_url ? 'Change Avatar' : 'Add Avatar';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header with fixed back navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.username}>{username}</Text>
          <Feather name="chevron-down" size={20} color="#fff" />
        </View>
        
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
        {/* Profile Section with context-aware avatar/logo */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <SafeLogo
              size={86}
              logoUrl={currentBusiness?.logo_url}
              avatarUrl={user?.avatar_url}
              style={styles.avatar}
              onPress={pickAndPreviewImage}
              updateTrigger={logoUpdateTrigger + avatarUpdateTrigger}
            />
            <TouchableOpacity 
              style={styles.addAvatarButton}
              onPress={pickAndPreviewImage}
              disabled={avatarLoading}
            >
              <Feather name={avatarLoading ? "loader" : "plus"} size={20} color="#fff" />
            </TouchableOpacity>
            
            {/* Context indicator */}
            <View style={styles.uploadIndicator}>
              <Text style={styles.uploadIndicatorText}>
                {currentBusiness ? `${currentBusiness.name} Logo` : 'Your Avatar'}
              </Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>1</Text>
              <Text style={styles.statLabel}>accounts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{businesses.owned.length}</Text>
              <Text style={styles.statLabel}>businesses</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{businesses.joined.length}</Text>
              <Text style={styles.statLabel}>joined</Text>
            </View>
          </View>
        </View>

        {/* Current Business Info with Categories */}
        <View style={styles.currentBusinessSection}>
          {businesses.owned.length > 0 ? (
            <TouchableOpacity 
              style={styles.businessDropdownButton}
              onPress={() => setShowBusinessDropdown(true)}
            >
              <Text style={styles.businessName}>{currentBusiness?.name || 'Select Business'}</Text>
              <Feather name="chevron-down" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.businessName}>No businesses owned</Text>
          )}
          
          {/* Business Categories Display */}
          {currentBusiness?.categories && currentBusiness.categories.length > 0 ? (
            <View style={styles.categoriesSection}>
              <Text style={styles.categoriesTitle}>Categories</Text>
              <View style={styles.categoriesContainer}>
                {currentBusiness.categories.map((category, index) => (
                  <View key={category.id} style={styles.categoryChip}>
                    <Text style={styles.categoryText}>{category.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : currentBusiness ? (
            <View style={styles.categoriesSection}>
              <Text style={styles.noCategoriesText}>No categories selected</Text>
            </View>
          ) : (
            <View style={styles.categoriesSection}>
              <Text style={styles.noCategoriesText}>Select a business to view categories</Text>
            </View>
          )}
          
          <View style={styles.contactInfo}>
            <Text style={styles.phoneNumber}>{userPhone}</Text>
          </View>
        </View>

        {/* Business Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.editButton}
            disabled={!currentBusiness}
            onPress={() => setShowEditModal(true)}
          >
            <Text style={styles.editButtonText}>Edit Business</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.shareButton}
            disabled={!currentBusiness}
            onPress={handleShareBusiness}
          >
            <Text style={styles.shareButtonText}>Share Business</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => setShowAddBusinessOptions(true)}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Add Business Button */}
        <View style={styles.addBusinessSection}>
          <TouchableOpacity 
            style={styles.addBusinessButton}
            onPress={() => setShowAddBusinessOptions(true)}
          >
            <Feather name="briefcase" size={20} color="#7c3aed" />
            <Text style={styles.addBusinessText}>Add Another Business</Text>
            <Feather name="chevron-right" size={20} color="#7c3aed" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Business Selection Dropdown */}
      {showBusinessDropdown && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowBusinessDropdown(false)}
          >
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownTitle}>Select Business</Text>
              {businesses.owned.map((business, index) => (
                <TouchableOpacity
                  key={business.id}
                  style={[
                    styles.dropdownItem,
                    index === currentBusinessIndex && styles.selectedDropdownItem
                  ]}
                  onPress={() => handleBusinessSelect(index)}
                >
                  <SafeLogo
                    size={24}
                    logoUrl={business.logo_url}
                    avatarUrl={user?.avatar_url}
                    style={styles.dropdownBusinessLogo}
                    updateTrigger={logoUpdateTrigger}
                  />
                  <Text style={[
                    styles.dropdownItemText,
                    index === currentBusinessIndex && styles.selectedDropdownItemText
                  ]}>
                    {business.name}
                  </Text>
                  {index === currentBusinessIndex && (
                    <Feather name="check" size={16} color="#7c3aed" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

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

              <TouchableOpacity style={styles.optionButton} onPress={handleJoinBusiness}>
                <Feather name="users" size={28} color="#7c3aed" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Join Existing</Text>
                  <Text style={styles.optionDescription}>Join a business</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Share Business Modal */}
      {selectedBusinessForShare && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => {
              setSelectedBusinessForShare(null);
              setInviteLink(null);
            }}
          >
            <View style={styles.inviteModal}>
              <Text style={styles.modalText}>
                Share "{selectedBusinessForShare.name}"
              </Text>

              {!inviteLink ? (
                <TouchableOpacity style={styles.generateButton} onPress={generateInviteLink}>
                  <Text style={styles.generateButtonText}>Generate Invite Link</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.inviteLinkContainer}>
                  <Text style={styles.inviteCode}>{inviteLink}</Text>
                  <TouchableOpacity style={styles.copyButton} onPress={copyInviteLink}>
                    <Feather name="copy" size={16} color="#fff" />
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setSelectedBusinessForShare(null);
                  setInviteLink(null);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
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

        {showEditModal && currentBusiness && (
          <EditBusinessModal
            visible={showEditModal}
            business={currentBusiness}
            onClose={() => setShowEditModal(false)}
            onUpdate={handleBusinessUpdate}
          />
        )}

        {previewUri && (
          <AvatarPreviewModal
            visible
            uri={previewUri}
            onCancel={() => setPreviewUri(null)}
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  username: {
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
    paddingBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  addAvatarButton: {
    position: 'absolute',
    bottom: 8,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1a1a2e',
  },
  uploadIndicator: {
    marginTop: 8,
    alignItems: 'center',
  },
  uploadIndicatorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 100,
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  currentBusinessSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  businessDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    marginBottom: 8,
  },
  businessName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoriesSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  categoriesTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    color: '#bd93f9',
    fontSize: 12,
    fontWeight: '500',
  },
  noCategoriesText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontStyle: 'italic',
  },
  contactInfo: {
    marginTop: 4,
  },
  phoneNumber: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  moreButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBusinessSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  addBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  addBusinessText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 32,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    maxWidth: 300,
    width: '80%',
  },
  dropdownTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedDropdownItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  dropdownBusinessLogo: {
    marginRight: 12,
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  selectedDropdownItemText: {
    color: '#bd93f9',
    fontWeight: '600',
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
  inviteModal: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 32,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    alignItems: 'center',
  },
  modalText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  generateButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteLinkContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteCode: {
    color: '#bd93f9',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  closeButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});
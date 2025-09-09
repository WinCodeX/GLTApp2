// app/(drawer)/Business.tsx - Fixed header dropdown and removed plus button
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
const ImagePreviewModal = React.lazy(() => import('../../components/ImagePreviewModal'));
const EditBusinessModal = React.lazy(() => import('../../components/EditBusinessModal'));

interface BusinessProps {
  navigation: any;
}

// Display modes for the profile section
type DisplayMode = 'you' | 'business';

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

  // Core modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // UI states
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [showAddBusinessOptions, setShowAddBusinessOptions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Business sharing states
  const [selectedBusinessForShare, setSelectedBusinessForShare] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  
  // NEW: Display mode state - determines if we show user avatar or business logo
  const [displayMode, setDisplayMode] = useState<DisplayMode>('you');
  
  // Image upload states with enhanced context awareness
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'avatar' | 'business-logo'>('avatar');
  const [selectedBusinessForUpload, setSelectedBusinessForUpload] = useState<any>(null);
  
  // Update triggers for immediate visual feedback
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(Date.now());
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [localBusinessLogos, setLocalBusinessLogos] = useState<Record<number, string>>({});

  const displayName = getBusinessDisplayName();
  const userPhone = getUserPhone();
  const username = getDisplayName();

  // Initialize display mode based on selected business
  useEffect(() => {
    if (selectedBusiness) {
      setDisplayMode('business');
    } else {
      setDisplayMode('you');
    }
  }, [selectedBusiness]);

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

  // NEW: Handle header dropdown toggle
  const handleHeaderDropdown = () => {
    console.log('🎭 Business: Header dropdown tapped');
    setShowBusinessDropdown(true);
  };

  // NEW: Handle display mode switching
  const handleDisplayModeSwitch = (mode: DisplayMode) => {
    console.log('🎭 Business: Switching display mode to:', mode);
    setDisplayMode(mode);
    
    if (mode === 'you') {
      setSelectedBusiness(null);
      showToast.info('Personal mode', 'Now showing your profile');
    } else if (mode === 'business' && businesses.owned.length > 0) {
      const firstBusiness = businesses.owned[0];
      setSelectedBusiness(firstBusiness);
      showToast.info('Business mode', `Now showing ${firstBusiness.name}`);
    }
    
    setShowBusinessDropdown(false);
  };

  // Business dropdown selection with display mode update
  const handleBusinessSelect = (business: any) => {
    console.log('🎭 Business: Selecting business:', business.name);
    setSelectedBusiness(business);
    setDisplayMode('business');
    setShowBusinessDropdown(false);
    showToast.info('Business selected', business.name);
  };

  // Fixed share business functionality
  const handleShareBusiness = () => {
    if (displayMode === 'business' && selectedBusiness) {
      console.log('🎭 Business: Setting business for share:', selectedBusiness.name);
      setSelectedBusinessForShare(selectedBusiness);
      setInviteLink(null); // Reset invite link
    } else {
      showToast.warning('No business selected', 'Please select a business first');
    }
  };

  // Fixed generate invite link with better error handling
  const generateInviteLink = async () => {
    if (!selectedBusinessForShare) {
      showToast.error('No business selected', 'Please select a business first');
      return;
    }

    try {
      setGeneratingInvite(true);
      console.log('🎭 Business: Generating invite for business:', selectedBusinessForShare.id);
      
      const result = await createInvite(selectedBusinessForShare.id);
      console.log('🎭 Business: Invite result:', result);
      
      if (result?.success && result?.data?.code) {
        setInviteLink(result.data.code);
        showToast.success('Invite link generated', 'Copy and share with your team');
      } else if (result?.code) {
        // Handle legacy response format
        setInviteLink(result.code);
        showToast.success('Invite link generated', 'Copy and share with your team');
      } else {
        throw new Error('No invite code received from server');
      }
    } catch (error: any) {
      console.error('🎭 Business: Error creating invite:', error);
      const errorMessage = error.message || 'Failed to generate invite code';
      showToast.error('Failed to create invite', errorMessage);
    } finally {
      setGeneratingInvite(false);
    }
  };

  // Copy invite link
  const copyInviteLink = async () => {
    if (inviteLink) {
      try {
        await Clipboard.setStringAsync(inviteLink);
        showToast.success('Copied to clipboard!', 'Share this invite code');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showToast.error('Failed to copy', 'Please try again');
      }
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
      await refreshBusinesses(true);
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
      await refreshBusinesses(true);
      setLogoUpdateTrigger(Date.now());
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };

  // Handle business update from edit modal with instant logo update
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

      // Determine upload context based on display mode
      const isBusinessMode = displayMode === 'business' && selectedBusiness;
      const targetUploadType: 'avatar' | 'business-logo' = isBusinessMode ? 'business-logo' : 'avatar';
      const targetBusiness = isBusinessMode ? selectedBusiness : null;

      console.log('🎭 Business: Image picker context:', {
        displayMode,
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
  }, [displayMode, selectedBusiness]);

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

  // Get the appropriate image URL based on display mode
  const getCurrentImageUrl = () => {
    if (displayMode === 'business' && selectedBusiness) {
      // Check local cache first for instant updates
      const localLogoUrl = localBusinessLogos[selectedBusiness.id];
      return localLogoUrl || selectedBusiness.logo_url;
    } else {
      // Personal mode - use avatar
      return localAvatarUrl || user?.avatar_url;
    }
  };

  // Get the current display name based on mode
  const getCurrentDisplayName = () => {
    if (displayMode === 'business' && selectedBusiness) {
      return selectedBusiness.name;
    } else {
      return username;
    }
  };

  // Get upload indicator text
  const getUploadIndicatorText = () => {
    if (displayMode === 'business' && selectedBusiness) {
      return `${selectedBusiness.name} Logo`;
    } else {
      return 'Your Avatar';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header with functional dropdown */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        
        {/* Make header center touchable for dropdown */}
        <TouchableOpacity 
          style={styles.headerCenter}
          onPress={handleHeaderDropdown}
          activeOpacity={0.7}
        >
          <Text style={styles.username}>{getCurrentDisplayName()}</Text>
          <Feather name="chevron-down" size={20} color="#fff" />
        </TouchableOpacity>
        
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
        {/* Enhanced Profile Section without plus button */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <SafeLogo
              size={86}
              logoUrl={getCurrentImageUrl()}
              avatarUrl={displayMode === 'you' ? getCurrentImageUrl() : null}
              style={styles.avatar}
              onPress={pickAndPreviewImage}
              updateTrigger={logoUpdateTrigger + avatarUpdateTrigger}
            />
            
            {/* Enhanced upload indicator */}
            <View style={styles.uploadIndicator}>
              <Text style={styles.uploadIndicatorText}>
                {getUploadIndicatorText()}
              </Text>
              <Text style={styles.uploadModeText}>
                {displayMode === 'business' ? 'Business Mode' : 'Personal Mode'}
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

        {/* Enhanced Mode Switcher Section */}
        <View style={styles.modeSwitcherSection}>
          <TouchableOpacity 
            style={[
              styles.modeButton,
              displayMode === 'you' && styles.activeModeButton
            ]}
            onPress={() => handleDisplayModeSwitch('you')}
          >
            <Feather name="user" size={18} color={displayMode === 'you' ? '#fff' : '#7c3aed'} />
            <Text style={[
              styles.modeButtonText,
              displayMode === 'you' && styles.activeModeButtonText
            ]}>You</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.modeButton,
              displayMode === 'business' && styles.activeModeButton
            ]}
            onPress={() => handleDisplayModeSwitch('business')}
            disabled={businesses.owned.length === 0}
          >
            <Feather name="briefcase" size={18} color={displayMode === 'business' ? '#fff' : '#7c3aed'} />
            <Text style={[
              styles.modeButtonText,
              displayMode === 'business' && styles.activeModeButtonText,
              businesses.owned.length === 0 && styles.disabledModeButtonText
            ]}>Business</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Content Section based on display mode */}
        <View style={styles.currentBusinessSection}>
          {displayMode === 'you' ? (
            /* Personal Mode Content */
            <View style={styles.personalModeContent}>
              <Text style={styles.personalModeTitle}>Personal Account</Text>
              <Text style={styles.personalModeName}>{username}</Text>
              <View style={styles.contactInfo}>
                <Text style={styles.phoneNumber}>{userPhone}</Text>
              </View>
            </View>
          ) : (
            /* Business Mode Content */
            <View style={styles.businessModeContent}>
              {businesses.owned.length > 0 ? (
                <TouchableOpacity 
                  style={styles.businessDropdownButton}
                  onPress={() => setShowBusinessDropdown(true)}
                >
                  <Text style={styles.businessName}>{selectedBusiness?.name || 'Select Business'}</Text>
                  <Feather name="chevron-down" size={20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.businessName}>No businesses owned</Text>
              )}
              
              {/* Business Categories Display */}
              {selectedBusiness?.categories && selectedBusiness.categories.length > 0 ? (
                <View style={styles.categoriesSection}>
                  <Text style={styles.categoriesTitle}>Categories</Text>
                  <View style={styles.categoriesContainer}>
                    {selectedBusiness.categories.map((category, index) => (
                      <View key={category.id} style={styles.categoryChip}>
                        <Text style={styles.categoryText}>{category.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : selectedBusiness ? (
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
          )}
        </View>

        {/* Enhanced Action Buttons based on mode */}
        <View style={styles.actionButtons}>
          {displayMode === 'you' ? (
            /* Personal Mode Actions */
            <>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => showToast.info('Edit Profile', 'Navigate to account settings')}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.shareButton}
                onPress={() => showToast.info('Share Profile', 'Profile sharing coming soon')}
              >
                <Text style={styles.shareButtonText}>Share Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Business Mode Actions */
            <>
              <TouchableOpacity 
                style={styles.editButton}
                disabled={!selectedBusiness}
                onPress={() => setShowEditModal(true)}
              >
                <Text style={styles.editButtonText}>Edit Business</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.shareButton}
                disabled={!selectedBusiness}
                onPress={handleShareBusiness}
              >
                <Text style={styles.shareButtonText}>Share Business</Text>
              </TouchableOpacity>
            </>
          )}
          
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

      {/* Enhanced Business Selection Dropdown with You option */}
      {showBusinessDropdown && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowBusinessDropdown(false)}
          >
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownTitle}>Select Mode</Text>
              
              {/* You option */}
              <TouchableOpacity
                style={[
                  styles.dropdownItem,
                  displayMode === 'you' && styles.selectedDropdownItem
                ]}
                onPress={() => handleDisplayModeSwitch('you')}
              >
                <SafeAvatar
                  size={24}
                  avatarUrl={user?.avatar_url}
                  style={styles.dropdownBusinessLogo}
                  updateTrigger={avatarUpdateTrigger}
                />
                <Text style={[
                  styles.dropdownItemText,
                  displayMode === 'you' && styles.selectedDropdownItemText
                ]}>
                  You (Personal)
                </Text>
                {displayMode === 'you' && (
                  <Feather name="check" size={16} color="#7c3aed" />
                )}
              </TouchableOpacity>
              
              {/* Business options */}
              {businesses.owned.map((business, index) => (
                <TouchableOpacity
                  key={business.id}
                  style={[
                    styles.dropdownItem,
                    selectedBusiness?.id === business.id && displayMode === 'business' && styles.selectedDropdownItem
                  ]}
                  onPress={() => handleBusinessSelect(business)}
                >
                  <SafeLogo
                    size={24}
                    logoUrl={localBusinessLogos[business.id] || business.logo_url}
                    avatarUrl={user?.avatar_url}
                    style={styles.dropdownBusinessLogo}
                    updateTrigger={logoUpdateTrigger}
                  />
                  <Text style={[
                    styles.dropdownItemText,
                    selectedBusiness?.id === business.id && displayMode === 'business' && styles.selectedDropdownItemText
                  ]}>
                    {business.name}
                  </Text>
                  {selectedBusiness?.id === business.id && displayMode === 'business' && (
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

      {/* Fixed Share Business Modal */}
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
                <TouchableOpacity 
                  style={styles.generateButton} 
                  onPress={generateInviteLink}
                  disabled={generatingInvite}
                >
                  <Text style={styles.generateButtonText}>
                    {generatingInvite ? 'Generating...' : 'Generate Invite Link'}
                  </Text>
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
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
  uploadModeText: {
    color: '#7c3aed',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
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
  
  // NEW: Mode Switcher Styles
  modeSwitcherSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 8,
    gap: 8,
  },
  activeModeButton: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  modeButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
  },
  activeModeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledModeButtonText: {
    color: 'rgba(124, 58, 237, 0.5)',
  },
  
  currentBusinessSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // Personal Mode Styles
  personalModeContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  personalModeTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  personalModeName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  
  // Business Mode Styles
  businessModeContent: {
    // Existing business content styles
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
    minWidth: 150,
    alignItems: 'center',
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
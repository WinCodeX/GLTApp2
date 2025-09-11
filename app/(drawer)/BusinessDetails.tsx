// app/(drawer)/BusinessDetails.tsx - Business Details Screen with Enhanced NavigationHelper
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '../../context/UserContext';
import colors from '../../theme/colors';
import { createInvite } from '../../lib/helpers/business';
import { SafeLogo } from '../../components/SafeLogo';

// Import Enhanced NavigationHelper
import { NavigationHelper } from '../../lib/helpers/navigation';

// Import the upload helpers
import { uploadBusinessLogo } from '../../lib/helpers/uploadBusinessLogo';

// Lazy load components
const ImagePreviewModal = React.lazy(() => import('../../components/ImagePreviewModal'));
const EditBusinessModal = React.lazy(() => import('../../components/EditBusinessModal'));

interface BusinessDetailsProps {
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

export default function BusinessDetails({ navigation }: BusinessDetailsProps) {
  const { 
    user, 
    getUserPhone,
    refreshBusinesses,
    refreshUser,
    clearUserCache,
    selectedBusiness,
    setSelectedBusiness,
    avatarUpdateTrigger,
    triggerAvatarRefresh,
  } = useUser();

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  // UI states
  const [refreshing, setRefreshing] = useState(false);
  
  // Business sharing states
  const [inviteLink, setInviteLink] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Image upload states
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [localBusinessLogo, setLocalBusinessLogo] = useState<string | null>(null);
  
  // Update triggers for immediate visual feedback
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(Date.now());

  const userPhone = getUserPhone();

  // Redirect if no business selected using enhanced navigation
  useEffect(() => {
    if (!selectedBusiness) {
      const redirectToBusiness = async () => {
        try {
          await NavigationHelper.navigateWithReset('/(drawer)/business');
          showToast.warning('No business selected', 'Please select a business first');
        } catch (error) {
          console.error('Failed to redirect to business screen:', error);
        }
      };
      
      redirectToBusiness();
    }
  }, [selectedBusiness]);

  // Enhanced refresh handler
  const onRefresh = useCallback(async () => {
    try {
      if (!user || !selectedBusiness) {
        showToast.warning('Please select a business first');
        return;
      }

      setRefreshing(true);
      console.log('🔄 BusinessDetails: Manual refresh triggered');
      
      await clearUserCache();
      await refreshUser(true);
      await refreshBusinesses(true);
      
      triggerAvatarRefresh();
      setLogoUpdateTrigger(Date.now());
      
      // Clear local URLs to force refresh from server
      setLocalBusinessLogo(null);
      
      showToast.success('Data refreshed');
    } catch (error) {
      console.error('🔄 BusinessDetails: Refresh error:', error);
      showToast.error('Failed to refresh data', 'Please check your connection');
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh, user, selectedBusiness]);

  // Enhanced back navigation using NavigationHelper
  const handleGoBack = useCallback(async () => {
    console.log('🔙 BusinessDetails: Going back...');
    
    try {
      const success = await NavigationHelper.goBack({
        fallbackRoute: '/(drawer)/business',
        replaceIfNoHistory: true
      });
      
      if (!success) {
        console.log('🔙 BusinessDetails: Back navigation used fallback');
      }
    } catch (error) {
      console.error('🔙 BusinessDetails: Back navigation failed:', error);
    }
  }, []);

  // Handle business logo picker
  const pickBusinessLogo = useCallback(async () => {
    if (!selectedBusiness) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast.error('Photo access denied', 'Please allow photo access to change logo');
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
      console.log('🎭 BusinessDetails: Selected business logo:', {
        uri: asset.uri,
        business: selectedBusiness.name
      });
      
      setPreviewUri(asset.uri);
    } catch (error) {
      console.error('BusinessDetails: Error picking image:', error);
      showToast.error('Failed to select image', 'Please try again');
    }
  }, [selectedBusiness]);

  // Enhanced upload handler with instant visual feedback
  const confirmUploadLogo = useCallback(async () => {
    if (!previewUri || !selectedBusiness) return;

    try {
      console.log('🎭 BusinessDetails: Starting business logo upload...');
      
      const result = await uploadBusinessLogo(previewUri, selectedBusiness.id);
      console.log('🎭 BusinessDetails: Business logo upload result:', result);
      
      // INSTANT UPDATE: Update local logo cache immediately
      if (result?.success && result?.logo_url) {
        console.log('🎭 BusinessDetails: Updating local business logo');
        setLocalBusinessLogo(result.logo_url);
        
        // Update selected business
        setSelectedBusiness({
          ...selectedBusiness,
          logo_url: result.logo_url
        });
        
        // Trigger immediate UI refresh
        setLogoUpdateTrigger(Date.now());
        triggerAvatarRefresh();
        
        showToast.success('Business logo updated!', 'Logo has been changed successfully');
        
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
      } else {
        throw new Error('Upload successful but no logo URL returned');
      }
      
    } catch (error: any) {
      console.error('🎭 BusinessDetails: Logo upload error:', error);
      showToast.error('Upload failed', error.message || 'Please try again');
    } finally {
      setPreviewUri(null);
    }
  }, [previewUri, selectedBusiness, refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh, setSelectedBusiness]);

  // Handle business update from edit modal
  const handleBusinessUpdate = async (updatedBusiness: any) => {
    try {
      console.log('🔄 BusinessDetails: Handling business update:', updatedBusiness);
      
      // Update local business logo cache if logo changed
      if (updatedBusiness.logo_url) {
        setLocalBusinessLogo(updatedBusiness.logo_url);
      }
      
      // Update selected business
      setSelectedBusiness(updatedBusiness);
      
      await refreshBusinesses(true);
      setLogoUpdateTrigger(Date.now());
      triggerAvatarRefresh();
    } catch (error) {
      console.error('Error refreshing after business update:', error);
    }
  };

  // Fixed share business functionality
  const handleShareBusiness = () => {
    if (!selectedBusiness) {
      showToast.warning('No business selected', 'Please select a business first');
      return;
    }

    console.log('🎭 BusinessDetails: Setting business for share:', selectedBusiness.name);
    setShowShareModal(true);
    setInviteLink(null); // Reset invite link
  };

  // Fixed generate invite link with better error handling
  const generateInviteLink = async () => {
    if (!selectedBusiness) {
      showToast.error('No business selected', 'Please select a business first');
      return;
    }

    try {
      setGeneratingInvite(true);
      console.log('🎭 BusinessDetails: Generating invite for business:', selectedBusiness.id);
      
      const result = await createInvite(selectedBusiness.id);
      console.log('🎭 BusinessDetails: Invite result:', result);
      
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
      console.error('🎭 BusinessDetails: Error creating invite:', error);
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

  // Get current logo URL
  const getCurrentLogoUrl = () => {
    return localBusinessLogo || selectedBusiness?.logo_url;
  };

  // Mock data for demonstration
  const mockMembers = [
    { id: 1, name: 'John Doe', role: 'Manager', joinedAt: '2024-01-15', active: true },
    { id: 2, name: 'Jane Smith', role: 'Staff', joinedAt: '2024-02-20', active: true },
    { id: 3, name: 'Mike Johnson', role: 'Staff', joinedAt: '2024-03-10', active: false },
  ];

  const mockAnalytics = {
    totalMembers: mockMembers.length,
    activeMembers: mockMembers.filter(m => m.active).length,
    totalInvites: 5,
    recentActivity: '2 hours ago',
    categories: selectedBusiness?.categories?.length || 0,
    monthlyGrowth: '+12%',
  };

  if (!selectedBusiness) {
    return null; // Will redirect in useEffect
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle} numberOfLines={1}>
          {selectedBusiness.name}
        </Text>
        
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
            <Feather name="more-vertical" size={20} color="#fff" />
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
        {/* Business Info Section */}
        <View style={styles.businessInfoSection}>
          <View style={styles.avatarContainer}>
            <SafeLogo
              size={86}
              logoUrl={getCurrentLogoUrl()}
              avatarUrl={user?.avatar_url}
              style={styles.avatar}
              onPress={pickBusinessLogo}
              updateTrigger={logoUpdateTrigger + avatarUpdateTrigger}
            />
          </View>

          <View style={styles.businessInfo}>
            <Text style={styles.businessName}>{selectedBusiness.name}</Text>
            <Text style={styles.businessPhone}>
              {selectedBusiness.phone_number || userPhone}
            </Text>
            
            {/* Categories */}
            {selectedBusiness.categories && selectedBusiness.categories.length > 0 && (
              <View style={styles.categoriesContainer}>
                {selectedBusiness.categories.slice(0, 3).map((category, index) => (
                  <View key={category.id} style={styles.categoryChip}>
                    <Text style={styles.categoryText}>{category.name}</Text>
                  </View>
                ))}
                {selectedBusiness.categories.length > 3 && (
                  <Text style={styles.moreCategoriesText}>
                    +{selectedBusiness.categories.length - 3} more
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsSection}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setShowEditModal(true)}
          >
            <Feather name="edit-3" size={18} color="#fff" />
            <Text style={styles.editButtonText}>Edit Business</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={handleShareBusiness}
          >
            <Feather name="share-2" size={18} color="#fff" />
            <Text style={styles.shareButtonText}>Share Business</Text>
          </TouchableOpacity>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.membersHeader}
            onPress={() => setShowMembersModal(true)}
          >
            <View style={styles.membersInfo}>
              <Text style={styles.sectionTitle}>Team Members</Text>
              <Text style={styles.membersCount}>
                {mockAnalytics.activeMembers} active • {mockAnalytics.totalMembers} total
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <View style={styles.membersPreview}>
            {mockMembers.slice(0, 3).map((member, index) => (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitials}>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
                <View style={[
                  styles.memberStatus,
                  { backgroundColor: member.active ? '#10b981' : '#6b7280' }
                ]} />
              </View>
            ))}
            
            {mockMembers.length > 3 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => setShowMembersModal(true)}
              >
                <Text style={styles.viewAllText}>
                  View all {mockMembers.length} members
                </Text>
                <Feather name="arrow-right" size={16} color="#7c3aed" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Analytics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Analytics</Text>
          
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{mockAnalytics.totalMembers}</Text>
              <Text style={styles.analyticsLabel}>Total Members</Text>
            </View>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{mockAnalytics.activeMembers}</Text>
              <Text style={styles.analyticsLabel}>Active Members</Text>
            </View>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{mockAnalytics.totalInvites}</Text>
              <Text style={styles.analyticsLabel}>Total Invites</Text>
            </View>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{mockAnalytics.categories}</Text>
              <Text style={styles.analyticsLabel}>Categories</Text>
            </View>
          </View>

          <View style={styles.recentActivityCard}>
            <View style={styles.activityHeader}>
              <Feather name="activity" size={20} color="#7c3aed" />
              <Text style={styles.activityTitle}>Recent Activity</Text>
            </View>
            <Text style={styles.activityTime}>Last activity: {mockAnalytics.recentActivity}</Text>
            <Text style={styles.activityGrowth}>Monthly growth: {mockAnalytics.monthlyGrowth}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Share Business Modal */}
      {showShareModal && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => {
              setShowShareModal(false);
              setInviteLink(null);
            }}
          >
            <View style={styles.inviteModal}>
              <Text style={styles.modalText}>
                Share "{selectedBusiness.name}"
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
                  setShowShareModal(false);
                  setInviteLink(null);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowMembersModal(false)}
          >
            <View style={styles.membersModal}>
              <View style={styles.membersModalHeader}>
                <Text style={styles.membersModalTitle}>Team Members</Text>
                <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.membersModalContent}>
                {mockMembers.map((member) => (
                  <View key={member.id} style={styles.fullMemberItem}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberInitials}>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </View>
                    <View style={styles.fullMemberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                      <Text style={styles.memberJoined}>
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[
                      styles.memberStatus,
                      { backgroundColor: member.active ? '#10b981' : '#6b7280' }
                    ]} />
                  </View>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Lazy loaded modals */}
      <Suspense fallback={<View />}>
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
            uploadType="business-logo"
            businessName={selectedBusiness.name}
            onCancel={() => setPreviewUri(null)}
            onConfirm={confirmUploadLogo}
          />
        )}
      </Suspense>
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
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
  businessInfoSection: {
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
  businessInfo: {
    flex: 1,
  },
  businessName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  businessPhone: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
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
    fontSize: 11,
    fontWeight: '500',
  },
  moreCategoriesText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  actionButtonsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  membersInfo: {
    flex: 1,
  },
  membersCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  membersPreview: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    overflow: 'hidden',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInitials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  memberRole: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  memberStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  viewAllText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  analyticsCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    padding: 16,
    alignItems: 'center',
  },
  analyticsValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  analyticsLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  recentActivityCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  activityTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activityTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  activityGrowth: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
  membersModal: {
    backgroundColor: '#1a1a2e',
    marginTop: 100,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    maxHeight: '80%',
  },
  membersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  membersModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  membersModalContent: {
    padding: 20,
  },
  fullMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  fullMemberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberJoined: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
});
// app/(drawer)/BusinessDetails.tsx - Business Details Screen with Enhanced Activities and Analytics
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
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '../../context/UserContext';
import colors from '../../theme/colors';
import { createInvite } from '../../lib/helpers/business';
import { SafeLogo } from '../../components/SafeLogo';
import api from '../../lib/api';

// Import Enhanced NavigationHelper
import { NavigationHelper } from '../../lib/helpers/navigation';

// Import the upload helpers
import { uploadBusinessLogo } from '../../lib/helpers/uploadBusinessLogo';

// Lazy load components
const ImagePreviewModal = React.lazy(() => import('../../components/ImagePreviewModal'));
const EditBusinessModal = React.lazy(() => import('../../components/EditBusinessModal'));

const { width: screenWidth } = Dimensions.get('window');

interface BusinessDetailsProps {
  navigation: any;
}

interface StaffMember {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
  role: 'owner' | 'staff';
  joined_at: string;
  active: boolean;
}

interface BusinessActivity {
  id: number;
  activity_type: string;
  description: string;
  formatted_time: string;
  activity_icon: string;
  activity_color: string;
  user: {
    id: number;
    name: string;
    avatar_url?: string;
  };
  target_user?: {
    id: number;
    name: string;
  };
  package?: {
    id: number;
    code: string;
  };
}

interface StaffData {
  owner: StaffMember;
  staff: StaffMember[];
  total_members: number;
  active_members: number;
}

interface ActivitiesData {
  activities: BusinessActivity[];
  summary: {
    total_activities: number;
    package_activities: number;
    staff_activities: number;
  };
}

interface PackageGraphData {
  current_month: {
    month: string;
    packages: number;
  };
  previous_month: {
    month: string;
    packages: number;
  };
  yearly_data?: Array<{
    month: string;
    packages: number;
  }>;
}

type ActivityFilter = 'total' | 'package' | 'staff';

// FIXED: Client-side timezone-aware time formatting
const formatLocalTime = (timeString: string): string => {
  try {
    // Parse the time string - handle both ISO format and backend formatted time
    let date: Date;
    
    // If it's already formatted by backend (contains AM/PM), return as-is for now
    if (timeString.includes('AM') || timeString.includes('PM')) {
      return timeString;
    }
    
    // Parse ISO string or Unix timestamp
    if (timeString.includes('T') || timeString.includes('Z')) {
      date = new Date(timeString);
    } else {
      // Assume it's a Unix timestamp if it's just numbers
      const timestamp = parseInt(timeString);
      date = isNaN(timestamp) ? new Date(timeString) : new Date(timestamp * 1000);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', timeString);
      return 'Unknown time';
    }
    
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    // If it's today (within 24 hours and same day)
    if (diffInHours < 24 && now.toDateString() === date.toDateString()) {
      return date.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // If it's within the last week
    if (diffInHours < 168) { // 7 days * 24 hours
      return date.toLocaleDateString([], { 
        weekday: 'short', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // For older dates
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
  } catch (error) {
    console.error('Error formatting time:', error, 'Input:', timeString);
    return 'Unknown time';
  }
};

// Enhanced activity interface to handle both server and client time
interface EnhancedBusinessActivity extends BusinessActivity {
  created_at?: string; // Add created_at field for client-side formatting
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

// Updated Horizontal Bar Graph Component (like second image)
const HorizontalBarGraph = ({ data, onPress }: { data: PackageGraphData; onPress: () => void }) => {
  const graphWidth = screenWidth - 80;
  const maxValue = Math.max(data.current_month.packages, data.previous_month.packages) || 1;
  
  // Calculate bar widths as percentages
  const prevWidth = (data.previous_month.packages / maxValue) * 100;
  const currWidth = (data.current_month.packages / maxValue) * 100;
  
  return (
    <TouchableOpacity style={styles.graphContainer} onPress={onPress}>
      <Text style={styles.graphTitle}>Analytics</Text>
      
      <View style={styles.horizontalGraphWrapper}>
        <View style={styles.verticalAxis}>
          <Text style={styles.gameLabel}>{data.current_month.month}</Text>
          <Text style={styles.gameLabel}>{data.previous_month.month}</Text>
        </View>
        
        <View style={styles.barsContainer}>
          {/* Current Month Bar */}
          <View style={styles.barRow}>
            <View 
              style={[
                styles.horizontalBar, 
                { 
                  width: `${currWidth}%`,
                  backgroundColor: '#10b981'
                }
              ]} 
            />
            <Text style={styles.barValue}>{data.current_month.packages}</Text>
          </View>
          
          {/* Previous Month Bar */}
          <View style={styles.barRow}>
            <View 
              style={[
                styles.horizontalBar, 
                { 
                  width: `${prevWidth}%`,
                  backgroundColor: '#ef4444'
                }
              ]} 
            />
            <Text style={styles.barValue}>{data.previous_month.packages}</Text>
          </View>
        </View>
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Current</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Previous</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
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
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showStaffActivityModal, setShowStaffActivityModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState<StaffMember | null>(null);
  
  // UI states
  const [refreshing, setRefreshing] = useState(false);
  
  // Business sharing states
  const [inviteLink, setInviteLink] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Image upload states
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [localBusinessLogo, setLocalBusinessLogo] = useState<string | null>(null);
  
  // Data states
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [activitiesData, setActivitiesData] = useState<ActivitiesData | null>(null);
  const [staffActivities, setStaffActivities] = useState<BusinessActivity[]>([]);
  const [packageGraphData, setPackageGraphData] = useState<PackageGraphData | null>(null);
  
  // Loading states
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingStaffActivities, setLoadingStaffActivities] = useState(false);
  const [loadingGraphData, setLoadingGraphData] = useState(false);
  
  // Activity filter state
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('total');
  
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
    } else {
      // Load initial data
      loadStaffData();
      loadActivitiesData();
      loadPackageGraphData();
    }
  }, [selectedBusiness]);

  // Load staff data
  const loadStaffData = useCallback(async () => {
    if (!selectedBusiness) return;
    
    try {
      setLoadingStaff(true);
      console.log('🔄 Loading staff data for business:', selectedBusiness.id);
      
      const response = await api.get(`/api/v1/businesses/${selectedBusiness.id}/staff`);
      
      if (response.data.success) {
        setStaffData(response.data.data);
        console.log('✅ Staff data loaded:', response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to load staff data');
      }
    } catch (error: any) {
      console.error('❌ Error loading staff:', error);
      showToast.error('Failed to load staff', error.message || 'Please try again');
    } finally {
      setLoadingStaff(false);
    }
  }, [selectedBusiness]);

  // FIXED: Enhanced load activities with client-side time formatting
  const loadActivitiesData = useCallback(async () => {
    if (!selectedBusiness) return;
    
    try {
      setLoadingActivities(true);
      console.log('🔄 Loading activities data for business:', selectedBusiness.id);
      
      const response = await api.get(`/api/v1/businesses/${selectedBusiness.id}/activities`);
      
      if (response.data.success) {
        // Process activities to add client-side formatted time
        const processedActivities = response.data.data.activities.map((activity: any) => ({
          ...activity,
          // Override formatted_time with client-side formatting
          formatted_time: formatLocalTime(activity.created_at || activity.formatted_time || new Date().toISOString())
        }));
        
        setActivitiesData({
          ...response.data.data,
          activities: processedActivities
        });
        
        console.log('✅ Activities data loaded and processed:', {
          total: processedActivities.length,
          firstActivity: processedActivities[0]
        });
      } else {
        throw new Error(response.data.message || 'Failed to load activities data');
      }
    } catch (error: any) {
      console.error('❌ Error loading activities:', error);
      showToast.error('Failed to load activities', error.message || 'Please try again');
    } finally {
      setLoadingActivities(false);
    }
  }, [selectedBusiness]);

  // Load staff activities for specific staff member
  const loadStaffActivities = useCallback(async (staffId: number) => {
    if (!selectedBusiness) return;
    
    try {
      setLoadingStaffActivities(true);
      console.log('🔄 Loading activities for staff:', staffId);
      
      const response = await api.get(`/api/v1/businesses/${selectedBusiness.id}/staff/${staffId}/activities`);
      
      if (response.data.success) {
        const processedActivities = response.data.data.map((activity: any) => ({
          ...activity,
          formatted_time: formatLocalTime(activity.created_at || activity.formatted_time || new Date().toISOString())
        }));
        
        setStaffActivities(processedActivities);
        console.log('✅ Staff activities loaded:', processedActivities.length);
      } else {
        throw new Error(response.data.message || 'Failed to load staff activities');
      }
    } catch (error: any) {
      console.error('❌ Error loading staff activities:', error);
      showToast.error('Failed to load staff activities', error.message || 'Please try again');
    } finally {
      setLoadingStaffActivities(false);
    }
  }, [selectedBusiness]);

  // Load package graph data
  const loadPackageGraphData = useCallback(async () => {
    if (!selectedBusiness) return;
    
    try {
      setLoadingGraphData(true);
      console.log('🔄 Loading package graph data for business:', selectedBusiness.id);
      
      const response = await api.get(`/api/v1/businesses/${selectedBusiness.id}/analytics/packages-comparison`);
      
      if (response.data.success) {
        setPackageGraphData(response.data.data);
        console.log('✅ Package graph data loaded:', response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to load graph data');
      }
    } catch (error: any) {
      console.error('❌ Error loading graph data:', error);
      showToast.error('Failed to load graph data', error.message || 'Please try again');
    } finally {
      setLoadingGraphData(false);
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
      
      // Reload all data
      await Promise.all([
        loadStaffData(),
        loadActivitiesData(),
        loadPackageGraphData()
      ]);
      
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
  }, [refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh, user, selectedBusiness, loadStaffData, loadActivitiesData, loadPackageGraphData]);

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

  // Handle staff member click
  const handleStaffClick = useCallback(async (staff: StaffMember) => {
    setSelectedStaffMember(staff);
    await loadStaffActivities(staff.id);
    setShowStaffActivityModal(true);
  }, [loadStaffActivities]);

  // Handle analytics graph click
  const handleAnalyticsPress = useCallback(() => {
    setShowAnalyticsModal(true);
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
        
        // Reload activities to show logo update activity
        loadActivitiesData();
        
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
  }, [previewUri, selectedBusiness, refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh, setSelectedBusiness, loadActivitiesData]);

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
      
      // Reload activities to show update activity
      loadActivitiesData();
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
        
        // Reload activities to show invite sent activity
        loadActivitiesData();
      } else if (result?.code) {
        // Handle legacy response format
        setInviteLink(result.code);
        showToast.success('Invite link generated', 'Copy and share with your team');
        loadActivitiesData();
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

  // Get filtered activities based on current filter
  const getFilteredActivities = () => {
    if (!activitiesData) return [];
    
    switch (activityFilter) {
      case 'package':
        return activitiesData.activities.filter(activity => 
          activity.activity_type.includes('package') || 
          activity.package
        );
      case 'staff':
        return activitiesData.activities.filter(activity => 
          activity.activity_type.includes('staff') || 
          activity.activity_type.includes('user') ||
          activity.target_user
        );
      case 'total':
      default:
        return activitiesData.activities;
    }
  };

  // Get current logo URL
  const getCurrentLogoUrl = () => {
    return localBusinessLogo || selectedBusiness?.logo_url;
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

        {/* Joined Section (Redesigned Staff Section) */}
<View style={styles.section}>
  <View
    style={[
      styles.joinedSectionContainer,
      staffData?.staff?.length === 1 && styles.singleMemberContainer
    ]}
  >
    <View style={styles.joinedVerticalSection}>
      <Text style={styles.joinedVerticalText}>JOINED</Text>
    </View>

    <View
      style={[
        styles.joinedMembersSection,
        staffData?.staff?.length === 1 && styles.singleMemberMembersSection
      ]}
    >
      {loadingStaff ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#7c3aed" size="small" />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      ) : staffData ? (
        <View
          style={[
            styles.joinedMembers,
            staffData?.staff?.length === 1 && styles.singleMemberMembers
          ]}
        >
          {/* Show only staff members (excluding owner) */}
          {staffData.staff.slice(0, 4).map((staff) => (
            <TouchableOpacity
              key={staff.id}
              style={[
                styles.joinedMember,
                staffData?.staff?.length === 1 && styles.singleMember
              ]}
              onPress={() => handleStaffClick(staff)}
            >
              <View style={styles.memberInitial}>
                <Text style={styles.memberInitialText}>
                  {staff.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.memberName}>{staff.name}</Text>
            </TouchableOpacity>
          ))}

          {staffData.staff.length > 4 && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => setShowStaffModal(true)}
            >
              <View style={styles.viewMoreIcon}>
                <Text style={styles.viewMoreText}>
                  +{staffData.staff.length - 4}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {staffData.staff.length === 0 && (
            <View style={styles.emptyMembers}>
              <Text style={styles.emptyMembersText}>No staff members yet</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load members</Text>
          <TouchableOpacity onPress={loadStaffData} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </View>
</View>

        {/* Analytics Section (Updated Package Analytics) */}
        <View style={styles.section}>
          {loadingGraphData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#7c3aed" size="small" />
              <Text style={styles.loadingText}>Loading analytics...</Text>
            </View>
          ) : packageGraphData ? (
            <HorizontalBarGraph data={packageGraphData} onPress={handleAnalyticsPress} />
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Unable to load analytics</Text>
              <TouchableOpacity onPress={loadPackageGraphData} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recent Section (Updated Activities Section) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          
          {/* Activity Filter Buttons */}
          <View style={styles.activityFilters}>
            <TouchableOpacity 
              style={[
                styles.filterButton,
                activityFilter === 'total' && styles.filterButtonActive
              ]}
              onPress={() => setActivityFilter('total')}
            >
              <Text style={[
                styles.filterButtonText,
                activityFilter === 'total' && styles.filterButtonTextActive
              ]}>
                Total Activities
              </Text>
              {activitiesData && (
                <Text style={[
                  styles.filterButtonCount,
                  activityFilter === 'total' && styles.filterButtonCountActive
                ]}>
                  {activitiesData.summary.total_activities}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                activityFilter === 'package' && styles.filterButtonActive
              ]}
              onPress={() => setActivityFilter('package')}
            >
              <Text style={[
                styles.filterButtonText,
                activityFilter === 'package' && styles.filterButtonTextActive
              ]}>
                Package Activities
              </Text>
              {activitiesData && (
                <Text style={[
                  styles.filterButtonCount,
                  activityFilter === 'package' && styles.filterButtonCountActive
                ]}>
                  {activitiesData.summary.package_activities}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.filterButton,
                activityFilter === 'staff' && styles.filterButtonActive
              ]}
              onPress={() => setActivityFilter('staff')}
            >
              <Text style={[
                styles.filterButtonText,
                activityFilter === 'staff' && styles.filterButtonTextActive
              ]}>
                Staff Activities
              </Text>
              {activitiesData && (
                <Text style={[
                  styles.filterButtonCount,
                  activityFilter === 'staff' && styles.filterButtonCountActive
                ]}>
                  {activitiesData.summary.staff_activities}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {loadingActivities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#7c3aed" size="small" />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : activitiesData ? (
            <>
              {/* Recent Activities List */}
              <View style={styles.activitiesList}>
                {getFilteredActivities().slice(0, 10).map((activity) => (
                  <View key={activity.id} style={styles.activityItem}>
                    <View style={[styles.activityIcon, { backgroundColor: activity.activity_color }]}>
                      <Feather name={activity.activity_icon as any} size={16} color="#fff" />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityDescription}>{activity.description}</Text>
                      {/* FIXED: Now uses client-side formatted time */}
                      <Text style={styles.activityTime}>{activity.formatted_time}</Text>
                    </View>
                  </View>
                ))}
                
                {getFilteredActivities().length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No activities found for this filter</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Unable to load activities</Text>
              <TouchableOpacity onPress={loadActivitiesData} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Analytics Modal */}
      {showAnalyticsModal && packageGraphData && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowAnalyticsModal(false)}
          >
            <View style={styles.analyticsModal}>
              <View style={styles.analyticsModalHeader}>
                <Text style={styles.analyticsModalTitle}>Year Analytics Overview</Text>
                <TouchableOpacity onPress={() => setShowAnalyticsModal(false)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.analyticsModalContent}>
                <View style={styles.modalGraphContainer}>
                  <Text style={styles.modalSubtitle}>Current Year Comparison</Text>
                  <View style={styles.modalCurrentData}>
                    <View style={styles.modalDataItem}>
                      <Text style={styles.modalDataLabel}>This Month</Text>
                      <Text style={styles.modalDataValue}>{packageGraphData.current_month.packages}</Text>
                      <Text style={styles.modalDataMonth}>{packageGraphData.current_month.month}</Text>
                    </View>
                    <View style={styles.modalDataItem}>
                      <Text style={styles.modalDataLabel}>Previous Month</Text>
                      <Text style={styles.modalDataValue}>{packageGraphData.previous_month.packages}</Text>
                      <Text style={styles.modalDataMonth}>{packageGraphData.previous_month.month}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalNote}>
                    Swipe to view previous years (Coming Soon)
                  </Text>
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

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

      {/* Staff Modal */}
      {showStaffModal && staffData && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowStaffModal(false)}
          >
            <View style={styles.staffModal}>
              <View style={styles.staffModalHeader}>
                <Text style={styles.staffModalTitle}>Joined Members</Text>
                <TouchableOpacity onPress={() => setShowStaffModal(false)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.staffModalContent}>
                {/* Staff Members (excluding owner) */}
                {staffData.staff.map((staff) => (
                  <TouchableOpacity 
                    key={staff.id} 
                    style={styles.fullStaffItem}
                    onPress={() => {
                      setShowStaffModal(false);
                      handleStaffClick(staff);
                    }}
                  >
                    <View style={styles.staffAvatar}>
                      <Text style={styles.staffInitials}>
                        {staff.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </View>
                    <View style={styles.fullStaffInfo}>
                      <Text style={styles.staffName}>{staff.name}</Text>
                      <Text style={styles.staffRole}>Staff</Text>
                      <Text style={styles.staffJoined}>
                        Joined {new Date(staff.joined_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[
                      styles.staffStatus,
                      { backgroundColor: staff.active ? '#10b981' : '#6b7280' }
                    ]} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Staff Activity Modal */}
      {showStaffActivityModal && selectedStaffMember && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setShowStaffActivityModal(false)}
          >
            <View style={styles.staffModal}>
              <View style={styles.staffModalHeader}>
                <Text style={styles.staffModalTitle}>
                  {selectedStaffMember.name}'s Activities
                </Text>
                <TouchableOpacity onPress={() => setShowStaffActivityModal(false)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.staffModalContent}>
                {loadingStaffActivities ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#7c3aed" size="small" />
                    <Text style={styles.loadingText}>Loading activities...</Text>
                  </View>
                ) : staffActivities.length > 0 ? (
                  staffActivities.map((activity) => (
                    <View key={activity.id} style={styles.activityItem}>
                      <View style={[styles.activityIcon, { backgroundColor: activity.activity_color }]}>
                        <Feather name={activity.activity_icon as any} size={16} color="#fff" />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityDescription}>{activity.description}</Text>
                        <Text style={styles.activityTime}>{activity.formatted_time}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No activities found for this staff member</Text>
                  </View>
                )}
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
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 16,
    marginTop: -12,
  },
  
  // New Joined Section Styles
singleMemberContainer: {
  minHeight: 80, // reduce height when only one member
  alignItems: 'center',
},

singleMemberMembersSection: {
  justifyContent: 'center',
},

singleMemberMembers: {
  justifyContent: 'center',
},

singleMember: {
  width: 70,  // slightly larger to emphasize single member
},
  joinedSectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    flexDirection: 'row',
    minHeight: 120,
  },
  joinedVerticalSection: {
    width: 60,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
  joinedVerticalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    transform: [{ rotate: '-90deg' }],
    letterSpacing: 2,
  },
  joinedMembersSection: {
    flex: 1,
    padding: 16,
  },
  joinedMembers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  joinedMember: {
    alignItems: 'center',
    width: 60,
  },
  memberInitial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  memberInitialText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberName: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  viewMoreButton: {
    alignItems: 'center',
    width: 60,
  },
  viewMoreIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  viewMoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyMembers: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyMembersText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  // Updated Graph Styles for Horizontal Bar
  graphContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    padding: 20,
    marginBottom: 8,
  },
  graphTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  horizontalGraphWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 120,
    paddingHorizontal: 16,
  },
  verticalAxis: {
    justifyContent: 'space-around',
    height: '100%',
    marginRight: 20,
    width: 60,
  },
  gameLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'right',
  },
  barsContainer: {
    flex: 1,
    justifyContent: 'space-around',
    height: '100%',
    paddingRight: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  horizontalBar: {
    height: 20,
    borderRadius: 4,
    minWidth: 20,
  },
  barValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },

  // Analytics Modal Styles
  analyticsModal: {
    backgroundColor: '#1a1a2e',
    marginTop: 60,
    marginBottom: 60,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    height: '75%',
    width: '95%',
    alignSelf: 'center',
  },
  analyticsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  analyticsModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  analyticsModalContent: {
    padding: 20,
  },
  modalGraphContainer: {
    alignItems: 'center',
  },
  modalSubtitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
  },
  modalCurrentData: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 30,
  },
  modalDataItem: {
    alignItems: 'center',
  },
  modalDataLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 8,
  },
  modalDataValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalDataMonth: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '500',
  },
  modalNote: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  
  // Activity Filter Styles
  activityFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderColor: '#7c3aed',
  },
  filterButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterButtonCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '700',
  },
  filterButtonCountActive: {
    color: '#bd93f9',
  },
  activitiesList: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
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
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
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
  staffModal: {
    backgroundColor: '#1a1a2e',
    marginTop: 60,
    marginBottom: 60,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    height: '75%',
    width: '95%',
    alignSelf: 'center',
  },
  staffModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  staffModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  staffModalContent: {
    padding: 20,
  },
  fullStaffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  staffInitials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fullStaffInfo: {
    flex: 1,
    marginLeft: 12,
  },
  staffName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  staffRole: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  staffJoined: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  staffStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
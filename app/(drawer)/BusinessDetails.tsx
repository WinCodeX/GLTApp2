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
}

interface LocationData {
  location: string;
  count: number;
  percentage: number;
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

// Simple Line Graph Component
const SimpleLineGraph = ({ data }: { data: PackageGraphData }) => {
  const graphWidth = screenWidth - 80;
  const graphHeight = 120;
  const maxValue = Math.max(data.current_month.packages, data.previous_month.packages) || 1;
  
  // Calculate positions
  const prevHeight = (data.previous_month.packages / maxValue) * (graphHeight - 20);
  const currHeight = (data.current_month.packages / maxValue) * (graphHeight - 20);
  
  return (
    <View style={styles.graphContainer}>
      <Text style={styles.graphTitle}>Package Comparison (2 Months)</Text>
      
      <View style={styles.graphWrapper}>
        <View style={[styles.graph, { width: graphWidth, height: graphHeight }]}>
          {/* Y-axis labels */}
          <View style={styles.yAxisLabels}>
            <Text style={styles.axisLabel}>{maxValue}</Text>
            <Text style={styles.axisLabel}>{Math.floor(maxValue / 2)}</Text>
            <Text style={styles.axisLabel}>0</Text>
          </View>
          
          {/* Graph area */}
          <View style={styles.graphArea}>
            {/* Grid lines */}
            <View style={[styles.gridLine, { top: 0 }]} />
            <View style={[styles.gridLine, { top: '50%' }]} />
            <View style={[styles.gridLine, { bottom: 0 }]} />
            
            {/* Data points and line */}
            <View style={styles.dataContainer}>
              {/* Previous month */}
              <View style={styles.dataPoint}>
                <View 
                  style={[
                    styles.dataBar, 
                    { 
                      height: prevHeight,
                      backgroundColor: 'rgba(124, 58, 237, 0.7)'
                    }
                  ]} 
                />
                <View style={[styles.dot, { backgroundColor: '#7c3aed' }]} />
                <Text style={styles.dataValue}>{data.previous_month.packages}</Text>
                <Text style={styles.monthLabel}>{data.previous_month.month}</Text>
              </View>
              
              {/* Current month */}
              <View style={styles.dataPoint}>
                <View 
                  style={[
                    styles.dataBar, 
                    { 
                      height: currHeight,
                      backgroundColor: 'rgba(16, 185, 129, 0.7)'
                    }
                  ]} 
                />
                <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.dataValue}>{data.current_month.packages}</Text>
                <Text style={styles.monthLabel}>{data.current_month.month}</Text>
              </View>
            </div>
          </View>
        </View>
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#7c3aed' }]} />
          <Text style={styles.legendText}>Previous Month</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Current Month</Text>
        </View>
      </View>
    </View>
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
  const [locationsData, setLocationsData] = useState<LocationData[]>([]);
  
  // Loading states
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingStaffActivities, setLoadingStaffActivities] = useState(false);
  const [loadingGraphData, setLoadingGraphData] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  
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
      loadLocationsData();
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

  // Load best locations data
  const loadLocationsData = useCallback(async () => {
    if (!selectedBusiness) return;
    
    try {
      setLoadingLocations(true);
      console.log('🔄 Loading locations data for business:', selectedBusiness.id);
      
      const response = await api.get(`/api/v1/businesses/${selectedBusiness.id}/analytics/best-locations`);
      
      if (response.data.success) {
        setLocationsData(response.data.data);
        console.log('✅ Locations data loaded:', response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to load locations data');
      }
    } catch (error: any) {
      console.error('❌ Error loading locations data:', error);
      showToast.error('Failed to load locations data', error.message || 'Please try again');
    } finally {
      setLoadingLocations(false);
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
        loadPackageGraphData(),
        loadLocationsData()
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
  }, [refreshUser, refreshBusinesses, clearUserCache, triggerAvatarRefresh, user, selectedBusiness, loadStaffData, loadActivitiesData, loadPackageGraphData, loadLocationsData]);

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

        {/* Staff Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.staffHeader}
            onPress={() => setShowStaffModal(true)}
          >
            <View style={styles.staffInfo}>
              <Text style={styles.sectionTitle}>Staff Members</Text>
              {staffData ? (
                <Text style={styles.staffCount}>
                  {staffData.active_members} active • {staffData.total_members} total
                </Text>
              ) : loadingStaff ? (
                <Text style={styles.staffCount}>Loading...</Text>
              ) : (
                <Text style={styles.staffCount}>Unable to load</Text>
              )}
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <View style={styles.staffPreview}>
            {loadingStaff ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#7c3aed" size="small" />
                <Text style={styles.loadingText}>Loading staff...</Text>
              </View>
            ) : staffData ? (
              <>
                {/* Show owner first */}
                <TouchableOpacity 
                  style={styles.staffItem}
                  onPress={() => handleStaffClick(staffData.owner)}
                >
                  <View style={styles.staffAvatar}>
                    <Text style={styles.staffInitials}>
                      {staffData.owner.name.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={styles.staffItemInfo}>
                    <Text style={styles.staffName}>{staffData.owner.name}</Text>
                    <Text style={styles.staffRole}>Owner</Text>
                  </View>
                  <View style={[
                    styles.staffStatus,
                    { backgroundColor: '#10b981' } // Owner is always active
                  ]} />
                </TouchableOpacity>
                
                {/* Show up to 2 staff members */}
                {staffData.staff.slice(0, 2).map((staff) => (
                  <TouchableOpacity 
                    key={staff.id} 
                    style={styles.staffItem}
                    onPress={() => handleStaffClick(staff)}
                  >
                    <View style={styles.staffAvatar}>
                      <Text style={styles.staffInitials}>
                        {staff.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </View>
                    <View style={styles.staffItemInfo}>
                      <Text style={styles.staffName}>{staff.name}</Text>
                      <Text style={styles.staffRole}>Staff</Text>
                    </View>
                    <View style={[
                      styles.staffStatus,
                      { backgroundColor: staff.active ? '#10b981' : '#6b7280' }
                    ]} />
                  </TouchableOpacity>
                ))}
                
                {staffData.total_members > 3 && (
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => setShowStaffModal(true)}
                  >
                    <Text style={styles.viewAllText}>
                      View all {staffData.total_members} members
                    </Text>
                    <Feather name="arrow-right" size={16} color="#7c3aed" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Unable to load staff members</Text>
                <TouchableOpacity onPress={loadStaffData} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Package Analytics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Package Analytics</Text>
          
          {loadingGraphData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#7c3aed" size="small" />
              <Text style={styles.loadingText}>Loading analytics...</Text>
            </View>
          ) : packageGraphData ? (
            <SimpleLineGraph data={packageGraphData} />
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Unable to load analytics</Text>
              <TouchableOpacity onPress={loadPackageGraphData} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Best Locations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Best Locations This Month</Text>
          <Text style={styles.sectionSubtitle}>Based on delivered and collected packages</Text>
          
          {loadingLocations ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#7c3aed" size="small" />
              <Text style={styles.loadingText}>Loading locations...</Text>
            </View>
          ) : locationsData.length > 0 ? (
            <View style={styles.locationsContainer}>
              {locationsData.map((location, index) => (
                <View key={index} style={styles.locationItem}>
                  <View style={styles.locationRank}>
                    <Text style={styles.locationRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{location.location}</Text>
                    <Text style={styles.locationCount}>{location.count} packages</Text>
                  </View>
                  <View style={styles.locationPercentage}>
                    <Text style={styles.locationPercentageText}>{location.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No location data available</Text>
            </View>
          )}
        </View>

        {/* Activities Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          
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
                <Text style={styles.staffModalTitle}>Staff Members</Text>
                <TouchableOpacity onPress={() => setShowStaffModal(false)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.staffModalContent}>
                {/* Owner */}
                <TouchableOpacity 
                  style={styles.fullStaffItem}
                  onPress={() => {
                    setShowStaffModal(false);
                    handleStaffClick(staffData.owner);
                  }}
                >
                  <View style={styles.staffAvatar}>
                    <Text style={styles.staffInitials}>
                      {staffData.owner.name.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={styles.fullStaffInfo}>
                    <Text style={styles.staffName}>{staffData.owner.name}</Text>
                    <Text style={styles.staffRole}>Owner</Text>
                    <Text style={styles.staffJoined}>
                      Created {new Date(staffData.owner.joined_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[
                    styles.staffStatus,
                    { backgroundColor: '#10b981' }
                  ]} />
                </TouchableOpacity>

                {/* Staff Members */}
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
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  staffInfo: {
    flex: 1,
  },
  staffCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  staffPreview: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    overflow: 'hidden',
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  staffItemInfo: {
    flex: 1,
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
  staffStatus: {
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
  // Graph Styles
  graphContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    padding: 16,
    marginBottom: 8,
  },
  graphTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  graphWrapper: {
    alignItems: 'center',
  },
  graph: {
    flexDirection: 'row',
    position: 'relative',
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    paddingRight: 8,
    width: 30,
    height: '100%',
  },
  axisLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    textAlign: 'right',
  },
  graphArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dataContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    paddingTop: 20,
  },
  dataPoint: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  dataBar: {
    width: 20,
    backgroundColor: '#7c3aed',
    borderRadius: 2,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7c3aed',
    marginBottom: 8,
  },
  dataValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  monthLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
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
  // Locations Styles
  locationsContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    overflow: 'hidden',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  locationRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationRankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  locationCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  locationPercentage: {
    alignItems: 'flex-end',
  },
  locationPercentageText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
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
  fullStaffInfo: {
    flex: 1,
    marginLeft: 12,
  },
  staffJoined: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
});
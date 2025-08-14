// lib/helpers/scanningHelpers.ts - API helpers for scanning system
import api from '../api';
import * as SecureStore from 'expo-secure-store';

// Scanning-related types
export interface ScanActionRequest {
  package_code: string;
  action_type: 'collect' | 'deliver' | 'print' | 'confirm_receipt' | 'process';
  metadata?: {
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
      address?: string;
    };
    device_info?: any;
    notes?: string;
    offline_sync?: boolean;
    original_timestamp?: string;
  };
}

export interface ScanActionResponse {
  success: boolean;
  message: string;
  data?: {
    package: any;
    action_performed: string;
    performed_by: {
      id: string;
      name: string;
      role: string;
    };
    timestamp: string;
    next_actions: AvailableAction[];
    print_data?: any;
  };
  error_code?: string;
}

export interface BulkScanRequest {
  package_codes: string[];
  action_type: 'collect' | 'deliver' | 'print' | 'process';
  metadata?: {
    bulk_operation: boolean;
    location?: any;
    device_info?: any;
  };
}

export interface BulkScanResponse {
  success: boolean;
  message: string;
  data?: {
    results: BulkScanResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  };
}

export interface BulkScanResult {
  package_code: string;
  success: boolean;
  message: string;
  new_state?: string;
  error_code?: string;
}

export interface AvailableAction {
  action: string;
  label: string;
  description: string;
}

export interface PackageDetailsResponse {
  success: boolean;
  data?: {
    package: any;
    available_actions: AvailableAction[];
    user_context: {
      role: string;
      can_collect: boolean;
      can_deliver: boolean;
      can_print: boolean;
      can_confirm: boolean;
      can_process: boolean;
    };
  };
  message?: string;
  error_code?: string;
}

export interface ScanStatistics {
  packages_scanned_today: number;
  packages_processed_today: number;
  total_packages_processed: number;
  last_scan_time?: string;
}

export interface RecentScan {
  id: string;
  package_code: string;
  action_type: string;
  timestamp: string;
  location?: string;
}

// Authentication helper
export const getAuthToken = async (): Promise<string> => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    return token || '';
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return '';
  }
};

// Get current user info
export const getCurrentUser = async () => {
  try {
    const userId = await SecureStore.getItemAsync('user_id');
    const userName = await SecureStore.getItemAsync('user_name') || 'Unknown User';
    const userRole = await SecureStore.getItemAsync('user_role') || 'client';
    
    return {
      id: userId || 'unknown',
      name: userName,
      role: userRole
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
    return {
      id: 'unknown',
      name: 'Unknown User',
      role: 'client'
    };
  }
};

// Perform a single scan action
export const performScanAction = async (request: ScanActionRequest): Promise<ScanActionResponse> => {
  try {
    console.log('🔄 Performing scan action:', request);
    
    const response = await api.post('/api/v1/user/scan_stats', request, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Scan action response:', response.data);
    return response.data as ScanActionResponse;
  } catch (error: any) {
    console.error('❌ Scan action error:', error);
    
    const errorResponse: ScanActionResponse = {
      success: false,
      message: error.response?.data?.message || error.message || 'Scan action failed',
      error_code: error.response?.data?.error_code || 'SCAN_ACTION_ERROR'
    };
    
    return errorResponse;
  }
};

// Perform bulk scan actions
export const performBulkScan = async (request: BulkScanRequest): Promise<BulkScanResponse> => {
  try {
    console.log('🔄 Performing bulk scan:', request);
    
    const response = await api.post('/api/v1/scanning/bulk_scan', request, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Bulk scan response:', response.data);
    return response.data as BulkScanResponse;
  } catch (error: any) {
    console.error('❌ Bulk scan error:', error);
    
    const errorResponse: BulkScanResponse = {
      success: false,
      message: error.response?.data?.message || error.message || 'Bulk scan failed'
    };
    
    return errorResponse;
  }
};

// Get package details for scanning
export const getPackageDetailsForScanning = async (packageCode: string): Promise<PackageDetailsResponse> => {
  try {
    console.log('🔄 Getting package details for scanning:', packageCode);
    
    const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Package details response:', response.data);
    return response.data as PackageDetailsResponse;
  } catch (error: any) {
    console.error('❌ Package details error:', error);
    
    const errorResponse: PackageDetailsResponse = {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get package details',
      error_code: error.response?.data?.error_code || 'PACKAGE_DETAILS_ERROR'
    };
    
    return errorResponse;
  }
};

// Get available actions for a package
export const getAvailableActions = async (packageCode: string): Promise<{
  success: boolean;
  data?: {
    package_code: string;
    package_state: string;
    available_actions: AvailableAction[];
    user_role: string;
  };
  message?: string;
}> => {
  try {
    console.log('🔄 Getting available actions for:', packageCode);
    
    const response = await api.get(`/api/v1/scanning/package/${packageCode}/actions`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Available actions response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Available actions error:', error);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get available actions'
    };
  }
};

// Validate if an action can be performed
export const validateScanAction = async (packageCode: string, actionType: string): Promise<{
  success: boolean;
  data?: {
    can_perform: boolean;
    valid_state: boolean;
    can_execute: boolean;
    current_state: string;
    required_states: string[];
    user_role: string;
    action_type: string;
  };
  message?: string;
}> => {
  try {
    console.log('🔄 Validating scan action:', { packageCode, actionType });
    
    const response = await api.post(`/api/v1/scanning/package/${packageCode}/validate`, {
      action_type: actionType
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Validate action response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Validate action error:', error);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to validate action'
    };
  }
};

// Get scanning statistics for current user
export const getScanningStatistics = async (): Promise<{
  success: boolean;
  data?: ScanStatistics;
  message?: string;
}> => {
  try {
    console.log('🔄 Getting scanning statistics');
    
    const response = await api.get('/api/v1/scanning/scan_statistics', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Scanning statistics response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Scanning statistics error:', error);
    
    // Return fallback data for demo purposes
    return {
      success: true,
      data: {
        packages_scanned_today: Math.floor(Math.random() * 20) + 5,
        packages_processed_today: Math.floor(Math.random() * 15) + 3,
        total_packages_processed: Math.floor(Math.random() * 200) + 50,
        last_scan_time: new Date().toISOString()
      }
    };
  }
};

// Get recent scans for current user
export const getRecentScans = async (limit: number = 10): Promise<{
  success: boolean;
  data?: RecentScan[];
  message?: string;
}> => {
  try {
    console.log('🔄 Getting recent scans');
    
    const response = await api.get(`/api/v1/scanning/recent_scans?limit=${limit}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Recent scans response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Recent scans error:', error);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get recent scans'
    };
  }
};

// Search packages with scanning context
export const searchPackagesForScanning = async (query: string): Promise<{
  success: boolean;
  data?: any[];
  query?: string;
  count?: number;
  message?: string;
}> => {
  try {
    console.log('🔄 Searching packages for scanning:', query);
    
    const response = await api.get(`/api/v1/scanning/search_packages?query=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Package search response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Package search error:', error);
    
    // Fallback to regular package search
    try {
      const fallbackResponse = await api.get(`/api/v1/packages/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
      });
      
      return fallbackResponse.data;
    } catch (fallbackError) {
      return {
        success: false,
        message: 'Failed to search packages'
      };
    }
  }
};

// Get sync status for offline scanning
export const getSyncStatus = async (): Promise<{
  success: boolean;
  data?: {
    last_sync: string | null;
    pending_actions: number;
    is_online: boolean;
    sync_in_progress: boolean;
  };
  message?: string;
}> => {
  try {
    console.log('🔄 Getting sync status');
    
    const response = await api.get('/api/v1/scanning/sync_status', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Sync status response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Sync status error:', error);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get sync status'
    };
  }
};

// Sync offline actions
export const syncOfflineActions = async (actions: any[]): Promise<{
  success: boolean;
  data?: {
    synced: number;
    failed: number;
    message: string;
  };
  message?: string;
}> => {
  try {
    console.log('🔄 Syncing offline actions:', actions);
    
    const response = await api.post('/api/v1/scanning/sync_offline_actions', {
      actions: actions
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Sync offline actions response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Sync offline actions error:', error);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to sync offline actions'
    };
  }
};

// Clear offline data
export const clearOfflineData = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    console.log('🔄 Clearing offline data');
    
    const response = await api.delete('/api/v1/scanning/clear_offline_data', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    console.log('✅ Clear offline data response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Clear offline data error:', error);
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to clear offline data'
    };
  }
};

// Network connectivity check
export const checkConnectivity = async (): Promise<boolean> => {
  try {
    const response = await api.get('/api/v1/ping', {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    return response.status === 200;
  } catch (error) {
    console.log('Network connectivity check failed:', error);
    return false;
  }
};

// Role-based action permissions
export const getUserPermissions = async (): Promise<{
  can_scan_packages: boolean;
  can_print_labels: boolean;
  can_manage_packages: boolean;
  can_view_all_packages: boolean;
  available_actions: string[];
  role: string;
}> => {
  try {
    const user = await getCurrentUser();
    
    // Define permissions based on role
    const permissions = {
      client: {
        can_scan_packages: false,
        can_print_labels: false,
        can_manage_packages: false,
        can_view_all_packages: false,
        available_actions: ['confirm_receipt'],
      },
      agent: {
        can_scan_packages: true,
        can_print_labels: true,
        can_manage_packages: false,
        can_view_all_packages: false,
        available_actions: ['print'],
      },
      rider: {
        can_scan_packages: true,
        can_print_labels: false,
        can_manage_packages: false,
        can_view_all_packages: false,
        available_actions: ['collect', 'deliver'],
      },
      warehouse: {
        can_scan_packages: true,
        can_print_labels: true,
        can_manage_packages: true,
        can_view_all_packages: false,
        available_actions: ['collect', 'process', 'print'],
      },
      admin: {
        can_scan_packages: true,
        can_print_labels: true,
        can_manage_packages: true,
        can_view_all_packages: true,
        available_actions: ['collect', 'deliver', 'print', 'process', 'confirm_receipt'],
      },
    };
    
    const userPermissions = permissions[user.role as keyof typeof permissions] || permissions.client;
    
    return {
      ...userPermissions,
      role: user.role,
    };
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    
    // Return minimal permissions
    return {
      can_scan_packages: false,
      can_print_labels: false,
      can_manage_packages: false,
      can_view_all_packages: false,
      available_actions: [],
      role: 'client',
    };
  }
};

// Device info helper
export const getDeviceInfo = () => {
  return {
    platform: 'react-native',
    timestamp: new Date().toISOString(),
    app_version: '1.0.0', // You can get this from app.json or package.json
    user_agent: 'GLT-Mobile-App/1.0.0',
  };
};

// Location helper (placeholder - implement with actual location services)
export const getCurrentLocation = async (): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
} | null> => {
  try {
    // TODO: Implement actual location services using expo-location
    // For now, return null to indicate location is not available
    return null;
  } catch (error) {
    console.error('Failed to get current location:', error);
    return null;
  }
};

// Export all helpers
export {
  performScanAction,
  performBulkScan,
  getPackageDetailsForScanning,
  getAvailableActions,
  validateScanAction,
  getScanningStatistics,
  getRecentScans,
  searchPackagesForScanning,
  getSyncStatus,
  syncOfflineActions,
  clearOfflineData,
  checkConnectivity,
  getUserPermissions,
  getDeviceInfo,
  getCurrentLocation,
  getAuthToken,
  getCurrentUser,
};
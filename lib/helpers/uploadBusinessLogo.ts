// lib/helpers/uploadBusinessLogo.ts - Fixed to use legacy FileSystem API
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import api from '../api';

interface UploadBusinessLogoResult {
  success: boolean;
  logo_url?: string;
  message?: string;
  errors?: string[];
}

export const uploadBusinessLogo = async (
  imageUri: string, 
  businessId: number
): Promise<UploadBusinessLogoResult> => {
  try {
    console.log('📷 Starting business logo upload process...', {
      businessId,
      imageUri: imageUri.substring(0, 50) + '...'
    });

    // Get auth token
    const token = await SecureStore.getItemAsync("auth_token");
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    // Validate image URI
    if (!imageUri || (!imageUri.startsWith('file://') && !imageUri.startsWith('content://'))) {
      throw new Error('Invalid image URI provided');
    }

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new Error('Selected image file does not exist');
    }

    console.log('📷 Image file info:', {
      exists: fileInfo.exists,
      size: fileInfo.size,
      uri: imageUri.substring(0, 50) + '...'
    });

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileInfo.size && fileInfo.size > maxSize) {
      throw new Error('Image file is too large. Please select an image under 5MB.');
    }

    // Create form data with proper file metadata (same pattern as avatar upload)
    const formData = new FormData();
    formData.append('logo', {
      uri: imageUri,
      name: 'business_logo.jpg',
      type: Platform.OS === 'ios' ? 'image/jpeg' : 'image/jpg',
    } as any);

    console.log('📷 Uploading business logo using API instance...', {
      businessId,
      fileName: 'business_logo.jpg'
    });

    // Use the api instance (which has proper file upload handling) instead of fetch
    const response = await api.post(`api/v1/businesses/${businessId}/logo`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000, // 30 second timeout for uploads
    });
    
    console.log('📷 Business logo upload response:', {
      status: response.status,
      success: response.data.success,
      hasLogoUrl: !!response.data.data?.logo_url
    });

    if (!response.data.success) {
      console.error('📷 Server reported business logo upload failure:', response.data);
      return {
        success: false,
        message: response.data.message || 'Upload failed',
        errors: response.data.errors
      };
    }

    const logoUrl = response.data.data?.logo_url;
    if (!logoUrl) {
      console.error('📷 No logo URL in successful response:', response.data);
      return {
        success: false,
        message: 'Upload completed but no logo URL received'
      };
    }

    console.log('📷 Business logo upload successful:', {
      logoUrl: logoUrl.substring(0, 50) + '...',
      businessId
    });

    return {
      success: true,
      logo_url: logoUrl,
      message: 'Business logo uploaded successfully'
    };

  } catch (error: any) {
    console.error('📷 Business logo upload error:', {
      message: error.message,
      name: error.name,
      status: error.response?.status
    });

    // Handle authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('🔐 Authentication failed during business logo upload');
      throw new Error('Session expired. Please log in again.');
    }
    
    // Handle validation errors
    if (error.response?.status === 422) {
      const errorMessage = error.response?.data?.message || 'Invalid file format or size';
      throw new Error(errorMessage);
    }
    
    // Handle file size errors
    if (error.response?.status === 413) {
      throw new Error('File too large. Please choose a smaller image.');
    }
    
    // Handle other API errors
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    
    // Handle network/connection errors
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Upload timeout. Please try again with a smaller image.');
    }

    // Generic error fallback
    throw new Error(error.message || 'Failed to upload business logo');
  }
};
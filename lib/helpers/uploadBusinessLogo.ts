// lib/helpers/uploadBusinessLogo.ts - Business logo upload helper
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../api';

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
    if (!imageUri || !imageUri.startsWith('file://') && !imageUri.startsWith('content://')) {
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

    // Prepare FormData for upload
    const formData = new FormData();
    
    // Determine file extension and MIME type
    const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    let mimeType = 'image/jpeg';
    
    switch (fileExtension) {
      case 'png':
        mimeType = 'image/png';
        break;
      case 'gif':
        mimeType = 'image/gif';
        break;
      case 'webp':
        mimeType = 'image/webp';
        break;
      default:
        mimeType = 'image/jpeg';
    }

    // Append image file to FormData
    formData.append('logo', {
      uri: imageUri,
      type: mimeType,
      name: `business_logo.${fileExtension}`,
    } as any);

    console.log('📷 Uploading business logo to server...', {
      businessId,
      mimeType,
      fileName: `business_logo.${fileExtension}`
    });

    // Upload to server
    const response = await fetch(`${API_BASE_URL}/api/v1/businesses/${businessId}/logo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const responseData = await response.json();
    
    console.log('📷 Business logo upload response:', {
      status: response.status,
      success: responseData.success,
      hasLogoUrl: !!responseData.data?.logo_url
    });

    if (!response.ok) {
      const errorMessage = responseData.message || responseData.error || `Upload failed with status ${response.status}`;
      console.error('📷 Business logo upload error:', {
        status: response.status,
        message: errorMessage,
        errors: responseData.errors
      });
      
      return {
        success: false,
        message: errorMessage,
        errors: responseData.errors
      };
    }

    if (!responseData.success) {
      console.error('📷 Server reported business logo upload failure:', responseData);
      return {
        success: false,
        message: responseData.message || 'Upload failed',
        errors: responseData.errors
      };
    }

    const logoUrl = responseData.data?.logo_url;
    if (!logoUrl) {
      console.error('📷 No logo URL in successful response:', responseData);
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
      stack: error.stack?.substring(0, 200)
    });

    let errorMessage = 'Failed to upload business logo';
    
    if (error.message.includes('Network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Upload timeout. Please try again.';
    } else if (error.message.includes('Authentication')) {
      errorMessage = 'Session expired. Please log in again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      message: errorMessage,
      errors: [errorMessage]
    };
  }
};
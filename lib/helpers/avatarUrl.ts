// lib/helpers/avatarUrl.ts - New helper to ensure proper avatar URLs
import { API_BASE_URL } from '../api';

export const getFullAvatarUrl = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;
  
  try {
    // If it's already a full URL, return as-is
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    // If it's a relative URL, combine with base URL
    if (avatarUrl.startsWith('/')) {
      const baseUrl = API_BASE_URL.replace('/api/v1', ''); // Remove API path
      return `${baseUrl}${avatarUrl}`;
    }
    
    // If it's just a path fragment, build the full URL
    const baseUrl = API_BASE_URL.replace('/api/v1', '');
    return `${baseUrl}/${avatarUrl}`;
    
  } catch (error) {
    console.error('❌ Error building avatar URL:', error);
    return null;
  }
};

// Enhanced avatar component with error handling
import React, { useState } from 'react';
import { Avatar } from 'react-native-paper';

interface SafeAvatarProps {
  size: number;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
}

export const SafeAvatar: React.FC<SafeAvatarProps> = ({ 
  size, 
  avatarUrl, 
  fallbackSource = require('../../assets/images/avatar_placeholder.png'),
  style 
}) => {
  const [hasError, setHasError] = useState(false);
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  // Use fallback if no URL or error occurred
  if (!fullAvatarUrl || hasError) {
    return (
      <Avatar.Image
        size={size}
        source={fallbackSource}
        style={style}
      />
    );
  }

  return (
    <Avatar.Image
      size={size}
      source={{ 
        uri: fullAvatarUrl,
        // Add cache headers for better performance
        headers: {
          'Cache-Control': 'max-age=3600'
        }
      }}
      style={style}
      onError={() => {
        console.warn('❌ Avatar failed to load:', fullAvatarUrl);
        setHasError(true);
      }}
    />
  );
};

// Updated AccountContent.tsx - Key changes to avatar handling
// Replace your Avatar.Image usage with this:

// ✅ BEFORE (in your component):
/*
<Avatar.Image
  size={60}
  source={
    user?.avatar_url
      ? { uri: user.avatar_url }
      : require('../assets/images/avatar_placeholder.png')
  }
/>
*/

// ✅ AFTER (replace with this):
/*
import { SafeAvatar, getFullAvatarUrl } from '../lib/helpers/avatarUrl';

// In your component:
<TouchableOpacity onPress={pickAndPreviewAvatar}>
  <SafeAvatar
    size={60}
    avatarUrl={user?.avatar_url}
    fallbackSource={require('../assets/images/avatar_placeholder.png')}
  />
</TouchableOpacity>
*/

// lib/api.ts - Make sure your API base URL is correct
export const API_BASE_URL = __DEV__ 
  ? 'http://192.168.100.73:3000/api/v1'  // Your development URL
  : 'https://glt-53x8.onrender.com/api/v1'; // Your production URL

// Helper to get the base domain (without /api/v1)
export const getBaseDomain = () => {
  return API_BASE_URL.replace('/api/v1', '');
};

// Enhanced avatar upload function
// lib/helpers/uploadAvatar.ts - Updated version
import { API_BASE_URL } from '../api';

export const uploadAvatar = async (uri: string) => {
  try {
    const formData = new FormData();
    
    // Get file extension
    const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
    
    formData.append('avatar', {
      uri,
      type: mimeType,
      name: `avatar.${fileExtension}`,
    } as any);

    const response = await fetch(`${API_BASE_URL}/me/avatar`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'multipart/form-data',
        // Add your auth headers here
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Avatar uploaded successfully:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Avatar upload error:', error);
    throw error;
  }
};

// Components/AccountContent.tsx - Updated imports and avatar usage
// Add these imports at the top:
import { SafeAvatar, getFullAvatarUrl } from '../lib/helpers/avatarUrl';

// Replace your avatar implementation with:
const renderUserAvatar = () => (
  <TouchableOpacity onPress={pickAndPreviewAvatar}>
    <SafeAvatar
      size={60}
      avatarUrl={user?.avatar_url}
      fallbackSource={require('../assets/images/avatar_placeholder.png')}
    />
  </TouchableOpacity>
);

// In your JSX, replace the Avatar.Image with:
{renderUserAvatar()}

// Enhanced avatar upload confirmation
const confirmUploadAvatar = useCallback(async () => {
  try {
    if (!previewUri) return;

    if (!isConnected()) {
      const title = networkStatus === 'offline' ? 'Offline Mode' : 'Server Unavailable';
      showToast.error(title, 'Cannot upload while server is unavailable');
      return;
    }

    setLoading(true);
    
    const result = await uploadAvatar(previewUri);
    
    // Check if we got a valid avatar URL back
    if (result?.avatar_url) {
      console.log('✅ New avatar URL received:', result.avatar_url);
      const fullUrl = getFullAvatarUrl(result.avatar_url);
      console.log('✅ Full avatar URL:', fullUrl);
    }
    
    showToast.success('Avatar updated!');
    await refreshUser(); // This should update the user context with new avatar
  } catch (error) {
    console.error('❌ Error uploading avatar:', error);
    const errorMessage = networkStatus === 'server_error' 
      ? 'Server temporarily unavailable' 
      : 'Check your connection and try again';
    showToast.error('Upload failed', errorMessage);
  } finally {
    setPreviewUri(null);
    setLoading(false);
  }
}, [previewUri, refreshUser, networkStatus, isConnected]);

// Debug function to check avatar URLs (add this temporarily)
const debugAvatarUrl = () => {
  console.log('🔍 Avatar Debug Info:');
  console.log('- Raw avatar_url:', user?.avatar_url);
  console.log('- Full avatar URL:', getFullAvatarUrl(user?.avatar_url));
  console.log('- API Base URL:', API_BASE_URL);
  console.log('- Base Domain:', getBaseDomain());
};
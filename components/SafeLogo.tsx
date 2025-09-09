// components/SafeLogo.tsx - Safe business logo component with avatar fallback
import React, { useState, useEffect } from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { getFullAvatarUrl } from '../lib/api';

interface SafeLogoProps {
  size: number;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  fallbackSource?: any;
  style?: any;
  onPress?: () => void;
  updateTrigger?: number;
}

export const SafeLogo: React.FC<SafeLogoProps> = ({ 
  size, 
  logoUrl, 
  avatarUrl,
  fallbackSource = require('../assets/images/avatar_placeholder.png'),
  style,
  onPress,
  updateTrigger = 0
}) => {
  const [hasLogoError, setHasLogoError] = useState(false);
  const [hasAvatarError, setHasAvatarError] = useState(false);
  const [imageKey, setImageKey] = useState(Date.now());
  
  const fullLogoUrl = getFullAvatarUrl(logoUrl);
  const fullAvatarUrl = getFullAvatarUrl(avatarUrl);
  
  // Reset error states when URLs or updateTrigger changes
  useEffect(() => {
    console.log('SafeLogo: Update triggered', {
      logoUrl,
      avatarUrl,
      updateTrigger,
      timestamp: Date.now()
    });
    
    setHasLogoError(false);
    setHasAvatarError(false);
    setImageKey(Date.now());
  }, [logoUrl, avatarUrl, updateTrigger]);
  
  // Determine which image to show
  let imageSource;
  let isRemoteImage = false;
  
  if (fullLogoUrl && !hasLogoError) {
    // Try business logo first
    imageSource = { 
      uri: `${fullLogoUrl}?v=${imageKey}&t=${updateTrigger}`,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };
    isRemoteImage = true;
  } else if (fullAvatarUrl && !hasAvatarError) {
    // Fallback to user avatar
    imageSource = { 
      uri: `${fullAvatarUrl}?v=${imageKey}&t=${updateTrigger}`,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };
    isRemoteImage = true;
  } else {
    // Final fallback to placeholder
    imageSource = fallbackSource;
    isRemoteImage = false;
  }
  
  const handleImageError = () => {
    if (fullLogoUrl && !hasLogoError) {
      console.warn('SafeLogo: Logo failed to load, trying avatar fallback');
      setHasLogoError(true);
    } else if (fullAvatarUrl && !hasAvatarError) {
      console.warn('SafeLogo: Avatar fallback failed to load, using placeholder');
      setHasAvatarError(true);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <Image
        source={imageSource}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={isRemoteImage ? handleImageError : undefined}
      />
    </TouchableOpacity>
  );
};
// lib/helpers/uploadAvatar.ts - Fixed version using direct SecureStore access
import api from "../api";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const uploadAvatar = async (uri: string) => {
  try {
    console.log('🔄 Starting avatar upload process...');
    
    // Get auth token directly from SecureStore (reliable approach)
    const token = await SecureStore.getItemAsync("auth_token");
    
    if (!token) {
      console.error('❌ No auth token found for avatar upload');
      throw new Error('Authentication required. Please log in again.');
    }
    
    console.log('✅ Found auth token for upload');

    // Create form data with proper file metadata
    const form = new FormData();
    form.append("avatar", {
      uri,
      name: "avatar.jpg",
      type: Platform.OS === "ios" ? "image/jpeg" : "image/jpg",
    } as any);

    console.log('📤 Uploading avatar...');

    // Make API request with explicit authorization header
    const res = await api.put("/api/v1/me/avatar", form, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000, // 30 second timeout for uploads
    });

    console.log('✅ Avatar upload successful:', res.data);
    return res.data;

  } catch (error: any) {
    console.error('❌ Avatar upload failed:', error);
    
    // Handle authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('🔐 Authentication failed during upload');
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
    throw new Error(error.message || 'Avatar upload failed. Please try again.');
  }
};
// lib/helpers/uploadAvatar.ts
import api from "../api";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const uploadAvatar = async (uri: string) => {
  try {
    console.log('Starting avatar upload process...');
    
    // Get and validate auth tokens
    const token = await SecureStore.getItemAsync("auth_token");
    const userId = await SecureStore.getItemAsync("user_id");
    
    if (!token || !userId) {
      console.error('No auth tokens found for avatar upload');
      throw new Error('Authentication required. Please log in again.');
    }
    
    console.log('Auth tokens validated for user:', userId);

    // Create form data
    const form = new FormData();
    form.append("avatar", {
      uri,
      name: "avatar.jpg",
      type: Platform.OS === "ios" ? "image/jpeg" : "image/jpg",
    } as any);

    console.log('Uploading avatar for user:', userId);

    // Make API request with enhanced headers
    const res = await api.put("/api/v1/me/avatar", form, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
        // Add user context for server validation
        "X-User-ID": userId,
      },
    });

    console.log('Avatar upload successful:', res.data);
    return res.data;

  } catch (error: any) {
    console.error('Avatar upload failed:', error);
    
    // Handle authentication errors
    if (error.response?.status === 401 || error.response?.status === 422) {
      console.log('Authentication failed, clearing tokens');
      
      // Clear potentially invalid tokens
      await SecureStore.deleteItemAsync('auth_token').catch(() => {});
      await SecureStore.deleteItemAsync('user_id').catch(() => {});
      await SecureStore.deleteItemAsync('user_role').catch(() => {});
      
      throw new Error('Session expired. Please log in again.');
    }
    
    // Handle other API errors
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    
    // Handle network/connection errors
    if (error.message) {
      throw new Error(error.message);
    }
    
    throw new Error('Avatar upload failed. Please try again.');
  }
};
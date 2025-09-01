// lib/helpers/uploadAvatar.ts - Updated to use AccountManager
import api from "../api";
import { Platform } from "react-native";
import { accountManager } from "../AccountManager";

export const uploadAvatar = async (uri: string) => {
  try {
    console.log('🔄 Starting avatar upload process...');
    
    // Get current account data from AccountManager
    const currentAccount = accountManager.getCurrentAccount();
    
    if (!currentAccount) {
      console.error('❌ No current account found for avatar upload');
      throw new Error('No active account. Please log in again.');
    }
    
    console.log('✅ Using account for upload:', {
      email: currentAccount.email,
      userId: currentAccount.id,
      hasToken: !!currentAccount.token
    });

    // Create form data
    const form = new FormData();
    form.append("avatar", {
      uri,
      name: "avatar.jpg",
      type: Platform.OS === "ios" ? "image/jpeg" : "image/jpg",
    } as any);

    console.log('📤 Uploading avatar for user:', currentAccount.id);

    // Make API request - the API instance will automatically use the current account's token
    const res = await api.put("/api/v1/me/avatar", form, {
      headers: {
        "Content-Type": "multipart/form-data",
        // Add user context for server validation
        "X-User-ID": currentAccount.id,
        "X-User-Email": currentAccount.email,
      },
    });

    console.log('✅ Avatar upload successful:', res.data);
    return res.data;

  } catch (error: any) {
    console.error('❌ Avatar upload failed:', error);
    
    // Handle authentication errors
    if (error.response?.status === 401 || error.response?.status === 422) {
      console.log('🔐 Authentication failed during upload');
      
      const currentAccount = accountManager.getCurrentAccount();
      if (currentAccount) {
        console.log('🗑️ Removing invalid account:', currentAccount.email);
        try {
          await accountManager.removeAccount(currentAccount.id);
        } catch (removeError) {
          console.error('❌ Failed to remove invalid account:', removeError);
        }
      }
      
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
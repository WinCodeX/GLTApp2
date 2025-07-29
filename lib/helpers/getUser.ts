// lib/helpers/getUser.ts
import api from "../api";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getUser = async () => {
  const token = await SecureStore.getItemAsync("auth_token");

  try {
    const res = await api.get("/api/v1/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const user = res.data.data.attributes;

    // Save to cache for offline use
    await AsyncStorage.setItem("cached_user", JSON.stringify(user));

    return user;
  } catch (error) {
    // Try to load from cache
    const cached = await AsyncStorage.getItem("cached_user");

    if (cached) {
      const user = JSON.parse(cached);

      // Add basic fallback if cache exists but is malformed
      if (user && typeof user === "object") {
        return user;
      }
    }

    // Rethrow error so screens can handle and show fallback UI
    throw new Error("Unable to load user data. Please check your connection.");
  }
};
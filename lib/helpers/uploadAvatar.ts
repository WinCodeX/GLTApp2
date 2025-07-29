// lib/helpers/uploadAvatar.ts
import api from "../api";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const uploadAvatar = async (uri: string) => {
  const token = await SecureStore.getItemAsync("auth_token");
  const form = new FormData();

  form.append("avatar", {
    uri,
    name: "avatar.jpg",
    type: Platform.OS === "ios" ? "image/jpeg" : "image/jpg",
  } as any);

  const res = await api.put("/api/v1/me/avatar", form, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
};

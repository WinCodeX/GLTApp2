// lib/helpers/addStock.ts

import api from "../api";

export const addStock = async (productId: number, quantity: number) => {
  try {
    const response = await api.post(
      `/api/v1/products/${productId}/stocks`,
      {
        stock: { quantity },
      }
    );

    return response.data;

  } catch (error: any) {
    console.error("Failed to add stock:", error.response?.data || error.message);
    throw error;
  }
};
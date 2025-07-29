import api from '../api';

export const searchProducts = async (query: string) => {
  const response = await api.get('/api/v1/products', {
    params: { query },
  });

  return response.data.products.data; // Assuming you're using jsonapi-serializer
};
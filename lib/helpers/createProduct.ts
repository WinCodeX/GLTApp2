import api from '../api';

export const createProduct = async (product: {
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string; // This should be the URI of the image
}) => {
  try {
    const formData = new FormData();

    formData.append('product[name]', product.name);
    formData.append('product[sku]', product.sku);
    formData.append('product[price]', product.price.toString());
    formData.append('product[quantity]', product.quantity.toString());

    if (product.image) {
      formData.append('product[image]', {
        uri: product.image,
        type: 'image/jpeg',
        name: 'product.jpg',
      } as any);
    }

    const response = await api.post('/api/v1/products', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Failed to create product:', error.response?.data || error.message);
    throw error;
  }
};
import { api } from '../api';

export interface PricingRequest {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: 'doorstep' | 'agent' | 'mixed';
}

export interface PricingResponse {
  cost: number;
  delivery_type: string;
  route_type: 'intra_area' | 'intra_location' | 'inter_location';
  origin_area: string;
  destination_area: string;
}

export async function getPackagePricing(request: PricingRequest): Promise<PricingResponse> {
  try {
    console.log('💰 Fetching pricing...');
    console.log('💰 Pricing request:', request);
    
    const response = await api.get('/api/v1/pricing', {
      params: {
        origin_area_id: request.origin_area_id,
        destination_area_id: request.destination_area_id,
        delivery_type: request.delivery_type,
      }
    });
    
    console.log('💰 Pricing response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Error fetching pricing:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch pricing: ${error.message}`);
  }
}
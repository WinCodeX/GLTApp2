// lib/helpers/getPackagePricing.ts - FIXED: Use correct prices controller endpoint

import api from '../api';

export interface PricingRequest {
  origin_area_id: string;
  destination_area_id: string;
  package_size: string; // FIXED: Changed from delivery_type to package_size to match your controller
}

export interface PricingResponse {
  success: boolean;
  data: {
    fragile: number;
    home: number;
    office: number;
    collection: number;
  };
  route_info?: {
    origin_area: string;
    destination_area: string;
    route_type: 'intra_area' | 'intra_location' | 'inter_location';
  };
  message?: string;
}

export async function getPackagePricing(request: PricingRequest): Promise<PricingResponse['data']> {
  try {
    console.log('💰 Fetching pricing...');
    console.log('💰 Pricing request:', request);
    
    // FIXED: Use correct endpoint that matches your prices_controller.rb
    const response = await api.post('/api/v1/prices/calculate', {
      origin_area_id: request.origin_area_id,
      destination_area_id: request.destination_area_id,
      package_size: request.package_size,
      all_types: 'true' // Request all delivery types
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('💰 Pricing response:', response.data);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Failed to calculate pricing');
    }
  } catch (error: any) {
    console.error('❌ Error fetching pricing:', error);
    console.error('❌ Error response:', error.response?.data);
    
    // Provide fallback pricing if API fails
    console.warn('⚠️ Using fallback pricing calculation');
    return calculateFallbackPricing(request.origin_area_id, request.destination_area_id, request.package_size);
  }
}

// Fallback pricing calculation
function calculateFallbackPricing(originAreaId: string, destinationAreaId: string, packageSize: string) {
  const isSameArea = originAreaId === destinationAreaId;
  
  // Base cost calculation
  let basePrice = isSameArea ? 200 : 350;
  
  // Package size multiplier
  const sizeMultiplier = packageSize === 'small' ? 0.8 : packageSize === 'large' ? 1.4 : 1.0;
  basePrice = Math.round(basePrice * sizeMultiplier);
  
  return {
    fragile: Math.round(basePrice * 1.5) + 100,
    home: Math.round(basePrice * 1.2),
    office: Math.round(basePrice * 0.75),
    collection: Math.round(basePrice * 1.3) + 50
  };
}
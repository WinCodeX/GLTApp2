// lib/helpers/getPackagePricing.ts
import { getBaseUrl } from './getBaseUrl';

export interface PricingRequest {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: 'doorstep' | 'agent' | 'mixed';
}

export interface PricingResponse {
  cost: number;
  delivery_type: string;
  route_type: 'intra_area' | 'intra_location' | 'inter_location';
}

export async function getPackagePricing(request: PricingRequest): Promise<PricingResponse> {
  try {
    const baseUrl = getBaseUrl();
    const queryParams = new URLSearchParams({
      origin_area_id: request.origin_area_id,
      destination_area_id: request.destination_area_id,
      delivery_type: request.delivery_type,
    });

    const response = await fetch(`${baseUrl}/api/v1/pricing?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching pricing:', error);
    throw new Error('Failed to fetch pricing');
  }
}
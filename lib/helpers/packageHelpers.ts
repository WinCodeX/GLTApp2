// lib/helpers/packageHelpers.ts - FIXED VERSION
import { getLocations, Location } from './getLocations';
import { getAreas, Area } from './getAreas';
import { getAgents, Agent } from './getAgents';
import { getPackagePricing as getApiPricing, PricingRequest, PricingResponse } from './getPackagePricing';
import { api } from '../api';

// =================================================================
// UNIFIED TYPES FOR MODAL COMPATIBILITY
// =================================================================

// Modal expects this interface
export interface PackageData {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_area_id: string;
  destination_area_id: string;
  origin_agent_id: string;
  destination_agent_id: string;
  delivery_type: 'doorstep' | 'agent' | 'mixed';
}

// API expects this different interface
interface ApiPackageData {
  receiverName: string;
  receiverPhone: string;
  originAgent: any;
  destinationAgent: any;
  originArea: any;
  destinationArea: any;
  deliveryType: 'doorstep' | 'agent' | 'mixed';
  cost: number;
}

export interface PackageResponse {
  id: string;
  status: string;
  tracking_number: string;
  cost: number;
  created_at: string;
}

export interface PackageFormData {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}

// =================================================================
// UNIFIED FUNCTIONS
// =================================================================

// Wrapper function that converts modal data to API format
export const createPackage = async (modalPackageData: PackageData): Promise<PackageResponse> => {
  try {
    console.log('🔄 Converting modal data to API format...');
    console.log('📤 Modal data received:', modalPackageData);

    // Get the area and agent objects for the API
    const [locations, areas, agents] = await Promise.all([
      getLocations(),
      getAreas(),
      getAgents(),
    ]);

    const originArea = areas.find(a => a.id === modalPackageData.origin_area_id);
    const destinationArea = areas.find(a => a.id === modalPackageData.destination_area_id);
    const originAgent = agents.find(a => a.id === modalPackageData.origin_agent_id);
    const destinationAgent = agents.find(a => a.id === modalPackageData.destination_agent_id);

    if (!originArea || !destinationArea) {
      throw new Error('Origin or destination area not found');
    }

    // Get pricing
    const pricing = await getPackagePricing({
      origin_area_id: modalPackageData.origin_area_id,
      destination_area_id: modalPackageData.destination_area_id,
      delivery_type: modalPackageData.delivery_type,
    });

    // Convert to API format
    const apiPackageData: ApiPackageData = {
      receiverName: modalPackageData.receiver_name,
      receiverPhone: modalPackageData.receiver_phone,
      originAgent: originAgent || null,
      destinationAgent: destinationAgent || null,
      originArea: originArea,
      destinationArea: destinationArea,
      deliveryType: modalPackageData.delivery_type,
      cost: pricing.cost,
    };

    console.log('🔄 Converted API data:', apiPackageData);

    // Call your existing API
    const response = await api.post('/api/v1/packages', {
      package: apiPackageData,
    });

    console.log('✅ Package created successfully:', response.data);
    return response.data;

  } catch (error: any) {
    console.error('❌ Error creating package:', error);
    if (error.response?.data?.errors) {
      throw new Error(`API Error: ${error.response.data.errors.join(', ')}`);
    }
    throw new Error(error.message || 'Failed to create package');
  }
};

// Wrapper function that provides consistent pricing interface for modal
export const getPackagePricing = async (data: {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: string;
}): Promise<{ cost: number }> => {
  try {
    console.log('💰 Fetching pricing with modal format:', data);
    
    // Convert to your API's expected format
    const pricingRequest: PricingRequest = {
      origin_area_id: data.origin_area_id,
      destination_area_id: data.destination_area_id,
      delivery_type: data.delivery_type as 'doorstep' | 'agent' | 'mixed',
    };
    
    // Call your existing pricing function
    const response: PricingResponse = await getApiPricing(pricingRequest);
    
    console.log('💰 Pricing response:', response);
    
    // Return in format expected by modal
    return { cost: response.cost };
    
  } catch (error: any) {
    console.error('❌ Pricing error:', error);
    
    // Fallback calculation if API fails
    console.log('🔄 Using fallback pricing calculation...');
    const fallbackCost = calculateFallbackPricing(data);
    return { cost: fallbackCost };
  }
};

// Fallback pricing calculation
const calculateFallbackPricing = (data: {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: string;
}): number => {
  const isIntraArea = data.origin_area_id === data.destination_area_id;
  
  let baseCost = 0;
  
  if (isIntraArea) {
    // Same area delivery
    baseCost = data.delivery_type === 'doorstep' ? 280 : 
               data.delivery_type === 'agent' ? 150 : 215;
  } else {
    // Different areas - simplified calculation
    baseCost = data.delivery_type === 'doorstep' ? 350 : 
               data.delivery_type === 'agent' ? 200 : 275;
  }
  
  console.log(`💰 Fallback pricing calculated: ${baseCost} for ${data.delivery_type} delivery`);
  return baseCost;
};

// =================================================================
// DATA FETCHING
// =================================================================

export async function getPackageFormData(): Promise<PackageFormData> {
  try {
    console.log('🔄 Fetching all package form data...');
    
    // Fetch all data in parallel for better performance
    const [locations, areas, agents] = await Promise.all([
      getLocations(),
      getAreas(),
      getAgents(),
    ]);

    console.log('✅ All package data fetched successfully:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length
    });

    return {
      locations,
      areas,
      agents,
    };
  } catch (error: any) {
    console.error('❌ Error fetching package form data:', error);
    throw new Error(`Failed to fetch package form data: ${error.message}`);
  }
}

// =================================================================
// RE-EXPORTS FOR COMPATIBILITY
// =================================================================

export type {
  Location,
  Area,
  Agent,
  PricingRequest,
  PricingResponse,
};

export {
  getLocations,
  getAreas,
  getAgents,
};
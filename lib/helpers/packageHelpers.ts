// lib/helpers/packageHelpers.ts
import { getLocations, Location } from './getLocations';
import { getAreas, Area } from './getAreas';
import { getAgents, Agent } from './getAgents';
import { createPackage, PackageData, PackageResponse } from './createPackage';
import { getPackagePricing, PricingRequest, PricingResponse } from './getPackagePricing';

// Re-export all types from individual modules for modal compatibility
export type {
  Location,
  Area,
  Agent,
  PackageData,
  PackageResponse,
  PricingRequest as PackagePricingRequest,
  PricingResponse as PackagePricingResponse,
};

// Re-export functions
export {
  getLocations,
  getAreas,
  getAgents,
  createPackage,
};

// Create a unified pricing function that matches modal expectations
export const getPackagePricing = async (data: {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: string;
}): Promise<{ cost: number }> => {
  try {
    console.log('🔄 Fetching package pricing:', data);
    
    // Convert to your PricingRequest format
    const pricingRequest: PricingRequest = {
      origin_area_id: data.origin_area_id,
      destination_area_id: data.destination_area_id,
      delivery_type: data.delivery_type,
    };
    
    // Call your actual pricing function
    const response: PricingResponse = await getPackagePricing(pricingRequest);
    
    // Return in format expected by modal
    return { cost: response.cost };
    
  } catch (error: any) {
    console.error('❌ Pricing error:', error);
    throw new Error(`Failed to get package pricing: ${error.message}`);
  }
};

export interface PackageFormData {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}

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
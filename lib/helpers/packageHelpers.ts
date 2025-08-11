import { getLocations, Location } from './getLocations';
import { getAreas, Area } from './getAreas';
import { getAgents, Agent } from './getAgents';
import { createPackage, PackageData, PackageResponse } from './createPackage';
import { getPackagePricing, PricingRequest, PricingResponse } from './getPackagePricing';

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

// Re-export all types and functions from individual modules
export type {
  Location,
  Area,
  Agent,
  PackageData,
  PackageResponse,
  PricingRequest,
  PricingResponse,
};

export {
  getLocations,
  getAreas,
  getAgents,
  createPackage,
  getPackagePricing,
};
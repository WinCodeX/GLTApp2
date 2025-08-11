// lib/helpers/packageHelpers.ts
// Combined helper for fetching all package-related data
import { getLocations, Location } from './getLocations';
import { getAreas, Area } from './getAreas';
import { getAgents, Agent } from './getAgents';

export interface PackageFormData {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}

export async function getPackageFormData(): Promise<PackageFormData> {
  try {
    // Fetch all data in parallel for better performance
    const [locations, areas, agents] = await Promise.all([
      getLocations(),
      getAreas(),
      getAgents(),
    ]);

    return {
      locations,
      areas,
      agents,
    };
  } catch (error) {
    console.error('Error fetching package form data:', error);
    throw new Error('Failed to fetch package form data');
  }
}

// Export all types and functions
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
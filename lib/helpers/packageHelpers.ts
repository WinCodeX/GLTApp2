// lib/helpers/packageHelpers.ts - DEBUG VERSION
import { getLocations, Location } from './getLocations';
import { getAreas, Area } from './getAreas';
import { getAgents, Agent } from './getAgents';
import { getPackagePricing as getApiPricing, PricingRequest, PricingResponse } from './getPackagePricing';
import { api } from '../api';

// Debug function to check API configuration
export const debugApiConnection = async () => {
  try {
    console.log('🔍 Testing API connection...');
    console.log('📍 API Base URL:', api.defaults.baseURL);
    console.log('🔑 API Headers:', api.defaults.headers);
    
    // Test basic connectivity
    const response = await api.get('/ping');
    console.log('✅ API ping successful:', response.data);
    return true;
  } catch (error: any) {
    console.error('❌ API ping failed:', error);
    console.error('❌ Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        headers: error.config?.headers
      }
    });
    return false;
  }
};

// Enhanced getPackageFormData with detailed debugging
export async function getPackageFormData(): Promise<{
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}> {
  try {
    console.log('🔄 Starting getPackageFormData...');
    
    // First, test API connectivity
    const apiConnected = await debugApiConnection();
    if (!apiConnected) {
      throw new Error('API connection failed - check your server and network');
    }

    console.log('🔄 API connection successful, fetching data...');
    
    // Fetch data with individual error handling
    const results = await Promise.allSettled([
      fetchLocationsWithDebug(),
      fetchAreasWithDebug(),
      fetchAgentsWithDebug(),
    ]);

    // Process results
    const locations = results[0].status === 'fulfilled' ? results[0].value : [];
    const areas = results[1].status === 'fulfilled' ? results[1].value : [];
    const agents = results[2].status === 'fulfilled' ? results[2].value : [];

    // Log results
    results.forEach((result, index) => {
      const names = ['locations', 'areas', 'agents'];
      if (result.status === 'rejected') {
        console.error(`❌ Failed to fetch ${names[index]}:`, result.reason);
      } else {
        console.log(`✅ ${names[index]} fetched:`, result.value.length, 'items');
      }
    });

    // Check if we have any data
    if (locations.length === 0 && areas.length === 0 && agents.length === 0) {
      throw new Error('No data received from any endpoints. Check your API endpoints and data.');
    }

    console.log('✅ Package form data completed:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length
    });

    return { locations, areas, agents };

  } catch (error: any) {
    console.error('❌ getPackageFormData failed:', error);
    throw new Error(`Failed to fetch package form data: ${error.message}`);
  }
}

// Debug wrapper for getLocations
async function fetchLocationsWithDebug(): Promise<Location[]> {
  try {
    console.log('📍 Fetching locations...');
    console.log('📍 Calling getLocations() from helper...');
    
    const locations = await getLocations();
    
    console.log('📍 Raw locations response:', locations);
    console.log('📍 Locations type:', typeof locations);
    console.log('📍 Locations length:', locations?.length);
    
    if (locations && locations.length > 0) {
      console.log('📍 Sample location:', locations[0]);
    }
    
    return locations || [];
  } catch (error: any) {
    console.error('❌ getLocations error:', error);
    throw error;
  }
}

// Debug wrapper for getAreas
async function fetchAreasWithDebug(): Promise<Area[]> {
  try {
    console.log('🏢 Fetching areas...');
    console.log('🏢 Calling getAreas() from helper...');
    
    const areas = await getAreas();
    
    console.log('🏢 Raw areas response:', areas);
    console.log('🏢 Areas type:', typeof areas);
    console.log('🏢 Areas length:', areas?.length);
    
    if (areas && areas.length > 0) {
      console.log('🏢 Sample area:', areas[0]);
    }
    
    return areas || [];
  } catch (error: any) {
    console.error('❌ getAreas error:', error);
    throw error;
  }
}

// Debug wrapper for getAgents
async function fetchAgentsWithDebug(): Promise<Agent[]> {
  try {
    console.log('👥 Fetching agents...');
    console.log('👥 Calling getAgents() from helper...');
    
    const agents = await getAgents();
    
    console.log('👥 Raw agents response:', agents);
    console.log('👥 Agents type:', typeof agents);
    console.log('👥 Agents length:', agents?.length);
    
    if (agents && agents.length > 0) {
      console.log('👥 Sample agent:', agents[0]);
    }
    
    return agents || [];
  } catch (error: any) {
    console.error('❌ getAgents error:', error);
    throw error;
  }
}

// Enhanced pricing with debugging
export const getPackagePricing = async (data: {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: string;
}): Promise<{ cost: number }> => {
  try {
    console.log('💰 Fetching pricing with data:', data);
    
    // Convert to your API's expected format
    const pricingRequest: PricingRequest = {
      origin_area_id: data.origin_area_id,
      destination_area_id: data.destination_area_id,
      delivery_type: data.delivery_type as 'doorstep' | 'agent' | 'mixed',
    };
    
    console.log('💰 Formatted pricing request:', pricingRequest);
    console.log('💰 Calling getApiPricing...');
    
    // Call your existing pricing function
    const response: PricingResponse = await getApiPricing(pricingRequest);
    
    console.log('💰 Pricing API response:', response);
    
    // Return in format expected by modal
    return { cost: response.cost };
    
  } catch (error: any) {
    console.error('❌ Pricing error:', error);
    console.error('❌ Pricing error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Fallback calculation if API fails
    console.log('🔄 Using fallback pricing calculation...');
    const fallbackCost = calculateFallbackPricing(data);
    console.log('💰 Fallback cost calculated:', fallbackCost);
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

// Re-export types for compatibility
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
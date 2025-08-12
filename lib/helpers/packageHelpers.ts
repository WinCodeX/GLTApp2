// lib/helpers/packageHelpers.ts - UPDATED for FastJSON with createPackage
import { getLocations, Location } from './getLocations';
import { getAreas, Area } from './getAreas';
import { getAgents, Agent } from './getAgents';
import { getPackagePricing as getApiPricing, PricingRequest, PricingResponse } from './getPackagePricing';
import api from '../api';

// Package-related types
export interface PackageData {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_area_id: string;
  destination_area_id: string;
  origin_agent_id?: string;
  destination_agent_id?: string;
  delivery_type: 'doorstep' | 'agent' | 'mixed';
  delivery_location?: string; // For doorstep delivery address
}

export interface PackageResponse {
  id: string;
  tracking_code: string;
  cost: number;
  state: string;
  created_at: string;
  updated_at: string;
  sender_name: string;
  receiver_name: string;
  delivery_type: string;
}

// Debug function to check API configuration
export const debugApiConnection = async () => {
  try {
    console.log('🔍 Testing API connection...');
    console.log('📍 API Base URL:', api.defaults.baseURL);
    console.log('🔑 API Headers:', JSON.stringify(api.defaults.headers, null, 2));
    
    // Test basic connectivity with correct endpoint
    const response = await api.get('/api/v1/ping');
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
    console.log('🔄 Using FastJSON API with updated parsers...');
    
    // First, test API connectivity
    const apiConnected = await debugApiConnection();
    if (!apiConnected) {
      throw new Error('API connection failed - check your server and network');
    }

    console.log('🔄 API connection successful, fetching data...');
    
    // Fetch data with individual error handling and better error messages
    const results = await Promise.allSettled([
      fetchLocationsWithDebug(),
      fetchAreasWithDebug(),
      fetchAgentsWithDebug(),
    ]);

    // Process results with detailed logging
    const locations = results[0].status === 'fulfilled' ? results[0].value : [];
    const areas = results[1].status === 'fulfilled' ? results[1].value : [];
    const agents = results[2].status === 'fulfilled' ? results[2].value : [];

    // Log results with more detail
    results.forEach((result, index) => {
      const names = ['locations', 'areas', 'agents'];
      if (result.status === 'rejected') {
        console.error(`❌ Failed to fetch ${names[index]}:`, result.reason?.message || result.reason);
        console.error(`❌ ${names[index]} error details:`, result.reason);
      } else {
        console.log(`✅ ${names[index]} fetched:`, result.value.length, 'items');
        if (result.value.length > 0) {
          console.log(`✅ Sample ${names[index]}:`, result.value[0]);
        }
      }
    });

    // Provide more specific guidance if no data is received
    if (locations.length === 0 && areas.length === 0 && agents.length === 0) {
      console.error('❌ No data received from any endpoints');
      console.error('❌ Check the following:');
      console.error('   1. Rails server is running');
      console.error('   2. Database has locations, areas, and agents');
      console.error('   3. Authentication token is valid');
      console.error('   4. API endpoints are correctly configured');
      throw new Error('No data received from any endpoints. Check your API endpoints and data.');
    }

    // Warn about missing data types
    if (locations.length === 0) {
      console.warn('⚠️ No locations found - package creation may not work');
    }
    if (areas.length === 0) {
      console.warn('⚠️ No areas found - package creation may not work');
    }
    if (agents.length === 0) {
      console.warn('⚠️ No agents found - some delivery options may not be available');
    }

    console.log('✅ Package form data completed:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length,
      totalItems: locations.length + areas.length + agents.length
    });

    return { locations, areas, agents };

  } catch (error: any) {
    console.error('❌ getPackageFormData failed:', error);
    
    // Provide actionable error message
    if (error.message.includes('Network Error') || error.message.includes('ECONNREFUSED')) {
      throw new Error('Cannot connect to server. Please check if your Rails server is running on the correct port.');
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      throw new Error('Authentication failed. Please check your login token and try logging in again.');
    } else if (error.message.includes('500')) {
      throw new Error('Server error occurred. Please check your Rails server logs for details.');
    } else {
      throw new Error(`Failed to fetch package form data: ${error.message}`);
    }
  }
}

// Debug wrapper for getLocations
async function fetchLocationsWithDebug(): Promise<Location[]> {
  try {
    console.log('📍 Fetching locations with FastJSON parser...');
    
    const locations = await getLocations();
    
    console.log('📍 FastJSON locations parsed successfully');
    console.log('📍 Locations count:', locations?.length || 0);
    
    if (locations && locations.length > 0) {
      console.log('📍 Sample location structure:', locations[0]);
      
      // Validate location structure
      const sampleLocation = locations[0];
      if (!sampleLocation.id || !sampleLocation.name) {
        console.warn('⚠️ Location structure may be incomplete:', sampleLocation);
      }
    } else {
      console.warn('⚠️ No locations returned from API');
    }
    
    return locations || [];
  } catch (error: any) {
    console.error('❌ getLocations error:', error);
    console.error('❌ This usually indicates:');
    console.error('   - FastJSON response format issue');
    console.error('   - Server returned unexpected data structure');
    console.error('   - Network connectivity problem');
    throw error;
  }
}

// Debug wrapper for getAreas
async function fetchAreasWithDebug(): Promise<Area[]> {
  try {
    console.log('🏢 Fetching areas with FastJSON parser...');
    
    const areas = await getAreas();
    
    console.log('🏢 FastJSON areas parsed successfully');
    console.log('🏢 Areas count:', areas?.length || 0);
    
    if (areas && areas.length > 0) {
      console.log('🏢 Sample area structure:', areas[0]);
      
      // Validate area structure and relationships
      const sampleArea = areas[0];
      if (!sampleArea.id || !sampleArea.name || !sampleArea.location_id) {
        console.warn('⚠️ Area structure may be incomplete:', sampleArea);
      }
      if (!sampleArea.location || !sampleArea.location.id) {
        console.warn('⚠️ Area location relationship may be missing:', sampleArea);
      }
    } else {
      console.warn('⚠️ No areas returned from API');
    }
    
    return areas || [];
  } catch (error: any) {
    console.error('❌ getAreas error:', error);
    console.error('❌ This usually indicates:');
    console.error('   - FastJSON include relationships not working');
    console.error('   - Areas table is empty');
    console.error('   - Location relationship missing');
    throw error;
  }
}

// Debug wrapper for getAgents
async function fetchAgentsWithDebug(): Promise<Agent[]> {
  try {
    console.log('👥 Fetching agents with FastJSON parser...');
    
    const agents = await getAgents();
    
    console.log('👥 FastJSON agents parsed successfully');
    console.log('👥 Agents count:', agents?.length || 0);
    
    if (agents && agents.length > 0) {
      console.log('👥 Sample agent structure:', agents[0]);
      
      // Validate agent structure and nested relationships
      const sampleAgent = agents[0];
      if (!sampleAgent.id || !sampleAgent.name || !sampleAgent.area_id) {
        console.warn('⚠️ Agent structure may be incomplete:', sampleAgent);
      }
      if (!sampleAgent.area || !sampleAgent.area.id) {
        console.warn('⚠️ Agent area relationship may be missing:', sampleAgent);
      }
      if (sampleAgent.area && (!sampleAgent.area.location || !sampleAgent.area.location.id)) {
        console.warn('⚠️ Agent area location relationship may be missing:', sampleAgent);
      }
    } else {
      console.warn('⚠️ No agents returned from API');
    }
    
    return agents || [];
  } catch (error: any) {
    console.error('❌ getAgents error:', error);
    console.error('❌ This usually indicates:');
    console.error('   - FastJSON nested includes not working (area.location)');
    console.error('   - Agents table is empty');
    console.error('   - Area or Location relationships missing');
    throw error;
  }
}

// Enhanced pricing with debugging and better error handling
export const getPackagePricing = async (data: {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: string;
}): Promise<{ cost: number }> => {
  try {
    console.log('💰 Fetching pricing with data:', data);
    
    // Validate input data
    if (!data.origin_area_id || !data.destination_area_id) {
      throw new Error('Origin and destination area IDs are required for pricing');
    }
    
    // Convert to your API's expected format
    const pricingRequest: PricingRequest = {
      origin_area_id: data.origin_area_id,
      destination_area_id: data.destination_area_id,
      delivery_type: data.delivery_type as 'doorstep' | 'agent' | 'mixed',
    };
    
    console.log('💰 Formatted pricing request:', pricingRequest);
    console.log('💰 Calling pricing API...');
    
    // Call your pricing API endpoint
    const response: PricingResponse = await getApiPricing(pricingRequest);
    
    console.log('💰 Pricing API response:', response);
    
    // Validate response
    if (typeof response.cost !== 'number' || response.cost < 0) {
      console.warn('⚠️ Invalid cost received from API, using fallback');
      throw new Error('Invalid pricing response');
    }
    
    // Return in format expected by modal
    return { cost: response.cost };
    
  } catch (error: any) {
    console.error('❌ Pricing API error:', error);
    console.error('❌ Pricing error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    
    // Fallback calculation if API fails
    console.log('🔄 Using fallback pricing calculation...');
    const fallbackCost = calculateFallbackPricing(data);
    console.log('💰 Fallback cost calculated:', fallbackCost);
    return { cost: fallbackCost };
  }
};

// Enhanced fallback pricing calculation
const calculateFallbackPricing = (data: {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: string;
}): number => {
  const isIntraArea = data.origin_area_id === data.destination_area_id;
  
  let baseCost = 0;
  
  if (isIntraArea) {
    // Same area delivery
    switch (data.delivery_type) {
      case 'doorstep':
        baseCost = 280;
        break;
      case 'agent':
        baseCost = 150;
        break;
      case 'mixed':
        baseCost = 215;
        break;
      default:
        baseCost = 150;
    }
  } else {
    // Different areas - simplified calculation
    switch (data.delivery_type) {
      case 'doorstep':
        baseCost = 350;
        break;
      case 'agent':
        baseCost = 200;
        break;
      case 'mixed':
        baseCost = 275;
        break;
      default:
        baseCost = 200;
    }
  }
  
  console.log(`💰 Fallback pricing: ${baseCost} KSh for ${data.delivery_type} delivery (${isIntraArea ? 'intra-area' : 'inter-area'})`);
  return baseCost;
};

// CREATE PACKAGE FUNCTION - This was missing!
export async function createPackage(packageData: PackageData): Promise<PackageResponse> {
  try {
    console.log('📦 Creating package...');
    console.log('📦 Package data:', packageData);
    
    // Prepare the request payload according to your Rails API structure
    const payload = {
      package: {
        sender_name: packageData.sender_name,
        sender_phone: packageData.sender_phone,
        receiver_name: packageData.receiver_name,
        receiver_phone: packageData.receiver_phone,
        origin_area_id: packageData.origin_area_id,
        destination_area_id: packageData.destination_area_id,
        origin_agent_id: packageData.origin_agent_id,
        destination_agent_id: packageData.destination_agent_id,
        delivery_type: packageData.delivery_type,
        delivery_location: packageData.delivery_location
      }
    };
    
    console.log('📦 API payload:', payload);
    
    const response = await api.post('/api/v1/packages', payload);
    
    console.log('📦 Package creation response:', response.data);
    
    // Handle both response.data.data (FastJSON) and response.data.package (legacy) formats
    const packageResponse = response.data.data?.package || 
                           response.data.package || 
                           response.data;
    
    if (!packageResponse) {
      throw new Error('Invalid response format from server');
    }
    
    return packageResponse;
  } catch (error: any) {
    console.error('❌ Error creating package:', error);
    console.error('❌ Error response:', error.response?.data);
    
    // Extract meaningful error message
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.response?.data?.errors?.[0] ||
                        error.message || 
                        'Failed to create package';
    
    throw new Error(errorMessage);
  }
}

// Utility function to validate package form data
export const validatePackageFormData = (data: {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  if (data.locations.length === 0) {
    issues.push('No locations available');
  }
  
  if (data.areas.length === 0) {
    issues.push('No areas available');
  }
  
  if (data.agents.length === 0) {
    issues.push('No agents available');
  }
  
  // Check for proper relationships
  const areasWithoutLocations = data.areas.filter(area => !area.location || !area.location.id);
  if (areasWithoutLocations.length > 0) {
    issues.push(`${areasWithoutLocations.length} areas missing location data`);
  }
  
  const agentsWithoutAreas = data.agents.filter(agent => !agent.area || !agent.area.id);
  if (agentsWithoutAreas.length > 0) {
    issues.push(`${agentsWithoutAreas.length} agents missing area data`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
};

// Re-export types for compatibility
export type {
  Location,
  Area,
  Agent,
  PricingRequest,
  PricingResponse,
  PackageData,
  PackageResponse,
};

// Export all functions - FIXED: Added createPackage
export {
  getLocations,
  getAreas,
  getAgents,
  createPackage, // This was missing!
  debugApiConnection,
  getPackageFormData,
  getPackagePricing,
  validatePackageFormData,
};
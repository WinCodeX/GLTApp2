// lib/helpers/packageHelpers.ts - FIXED to use proper helper functions
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
    
    // Test basic connectivity with correct endpoint and headers
    const response = await api.get('/api/v1/ping', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
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

// FIXED: Use the actual helper functions instead of manual API calls
export async function getPackageFormData(): Promise<{
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}> {
  try {
    console.log('🔄 Starting getPackageFormData...');
    console.log('🔄 Using proper helper functions with FastJSON parsing...');
    
    // First, test API connectivity
    const apiConnected = await debugApiConnection();
    if (!apiConnected) {
      throw new Error('API connection failed - check your server and network');
    }

    console.log('🔄 API connection successful, fetching data with proper helpers...');
    
    // FIXED: Use the actual helper functions that handle FastJSON properly
    const results = await Promise.allSettled([
      getLocations(),
      getAreas(), 
      getAgents(),
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
          console.log(`✅ Sample ${names[index]}:`, JSON.stringify(result.value[0], null, 2));
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

    // FIXED: Enhanced validation of data structure
    const validation = validatePackageFormData({ locations, areas, agents });
    if (!validation.isValid) {
      console.warn('⚠️ Data validation issues found:', validation.issues);
      // Still continue but log the issues
    }

    console.log('✅ Package form data completed:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length,
      totalItems: locations.length + areas.length + agents.length,
      validation: validation.isValid ? 'passed' : 'failed'
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

// CREATE PACKAGE FUNCTION
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
    
    const response = await api.post('/api/v1/packages', payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
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

// ENHANCED: Utility function to validate package form data
export const validatePackageFormData = (data: {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  console.log('🔍 Validating package form data...');
  console.log('🔍 Data counts:', {
    locations: data.locations.length,
    areas: data.areas.length,
    agents: data.agents.length
  });
  
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
    console.warn('⚠️ Areas without locations:', areasWithoutLocations.map(a => ({ id: a.id, name: a.name })));
  }
  
  const agentsWithoutAreas = data.agents.filter(agent => !agent.area || !agent.area.id);
  if (agentsWithoutAreas.length > 0) {
    issues.push(`${agentsWithoutAreas.length} agents missing area data`);
    console.warn('⚠️ Agents without areas:', agentsWithoutAreas.map(a => ({ id: a.id, name: a.name })));
  }
  
  // Check for agents without nested location data
  const agentsWithoutLocations = data.agents.filter(agent => 
    agent.area && agent.area.id && (!agent.area.location || !agent.area.location.id)
  );
  if (agentsWithoutLocations.length > 0) {
    issues.push(`${agentsWithoutLocations.length} agents missing location data in area relationship`);
    console.warn('⚠️ Agents without location in area:', agentsWithoutLocations.map(a => ({ 
      id: a.id, 
      name: a.name, 
      area: a.area?.name 
    })));
  }
  
  console.log('🔍 Validation result:', {
    isValid: issues.length === 0,
    issues: issues
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
};

// Package listing and tracking types
export interface Package {
  id: string;
  code: string;
  state: string;
  state_display: string;
  sender_name: string;
  receiver_name: string;
  cost: number;
  delivery_type: string;
  route_description: string;
  created_at: string;
  updated_at: string;
  sender_phone?: string;
  receiver_phone?: string;
  origin_area?: Area;
  destination_area?: Area;
  origin_agent?: Agent;
  destination_agent?: Agent;
  delivery_location?: string;
}

export interface PackageListResponse {
  success: boolean;
  data: Package[];
  pagination: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface QRCodeResponse {
  success: boolean;
  data: {
    qr_code_base64: string | null;
    tracking_url: string;
    package_code: string;
    package_state: string;
    route_description: string;
  };
}

// State mapping from drawer to API states
export const STATE_MAPPING = {
  'pending': 'pending_unpaid',
  'paid': 'pending',
  'submitted': 'submitted',
  'in-transit': 'in_transit',
  'delivered': 'delivered',
  'collected': 'collected',
  'rejected': 'rejected'
} as const;

export type DrawerState = keyof typeof STATE_MAPPING;
export type ApiState = typeof STATE_MAPPING[DrawerState];

// GET PACKAGES FUNCTION
export async function getPackages(filters?: {
  state?: string;
  page?: number;
  per_page?: number;
  search?: string;
}): Promise<PackageListResponse> {
  try {
    console.log('📦 Fetching packages with filters:', filters);
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters?.state) {
      // Map drawer state to API state
      const apiState = STATE_MAPPING[filters.state as DrawerState] || filters.state;
      params.append('state', apiState);
      console.log(`🔍 Mapping drawer state "${filters.state}" to API state "${apiState}"`);
    }
    
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.search) params.append('search', filters.search);
    
    const queryString = params.toString();
    const url = `/api/v1/packages${queryString ? `?${queryString}` : ''}`;
    
    console.log('📦 API URL:', url);
    
    const response = await api.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📦 Packages API response:', response.data);
    
    // Handle the response format from your Rails API
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch packages');
    }
    
    return response.data as PackageListResponse;
    
  } catch (error: any) {
    console.error('❌ Error fetching packages:', error);
    console.error('❌ Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        'Failed to fetch packages';
    
    throw new Error(errorMessage);
  }
}

// GET PACKAGE QR CODE FUNCTION
export async function getPackageQRCode(packageCode: string): Promise<QRCodeResponse> {
  try {
    console.log('🔲 Fetching QR code for package:', packageCode);
    
    const response = await api.get(`/api/v1/packages/${packageCode}/qr_code`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔲 QR code API response:', response.data);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch QR code');
    }
    
    return response.data as QRCodeResponse;
    
  } catch (error: any) {
    console.error('❌ Error fetching QR code:', error);
    console.error('❌ QR code error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        'Failed to fetch QR code';
    
    throw new Error(errorMessage);
  }
}

// GET SINGLE PACKAGE FUNCTION
export async function getPackageDetails(packageCode: string): Promise<Package> {
  try {
    console.log('📦 Fetching package details for:', packageCode);
    
    const response = await api.get(`/api/v1/packages/${packageCode}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📦 Package details API response:', response.data);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch package details');
    }
    
    return response.data.data as Package;
    
  } catch (error: any) {
    console.error('❌ Error fetching package details:', error);
    
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        'Failed to fetch package details';
    
    throw new Error(errorMessage);
  }
}

// SEARCH PACKAGES FUNCTION
export async function searchPackages(query: string): Promise<Package[]> {
  try {
    console.log('🔍 Searching packages with query:', query);
    
    const response = await api.get(`/api/v1/packages/search?query=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔍 Search API response:', response.data);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Search failed');
    }
    
    return response.data.data as Package[];
    
  } catch (error: any) {
    console.error('❌ Error searching packages:', error);
    
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        'Search failed';
    
    throw new Error(errorMessage);
  }
}

// Re-export types for compatibility
export type {
  Location,
  Area,
  Agent,
  PricingRequest,
  PricingResponse,
  PackageData,
  PackageResponse,
  Package,
  PackageListResponse,
  QRCodeResponse,
  DrawerState,
  ApiState,
};

// Export all functions
export {
  getLocations,
  getAreas,
  getAgents,
  createPackage,
  getPackages,
  getPackageQRCode,
  getPackageDetails,
  searchPackages,
  debugApiConnection,
  getPackageFormData,
  getPackagePricing,
  validatePackageFormData,
  STATE_MAPPING,
};
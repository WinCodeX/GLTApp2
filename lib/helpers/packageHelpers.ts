// lib/helpers/packageHelpers.ts - FIXED: Fragile deliveries don't require agents

import api from '../api';

// FIXED: Import the working implementations from separate files
import { getAreas } from './getAreas';
import { getAgents } from './getAgents';

export interface Location {
  id: string;
  name: string;
  initials?: string;
}

export interface Area {
  id: string;
  name: string;
  location_id?: string;
  location?: Location;
  initials?: string;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  area_id?: string;
  area?: Area;
}

export interface Package {
  id: string;
  code: string;
  state: string;
  state_display: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone: string;
  route_description: string;
  cost: number;
  delivery_type: string;
  created_at: string;
  updated_at: string;
  origin_area?: Area;
  destination_area?: Area;
  origin_agent?: Agent;
  destination_agent?: Agent;
  delivery_location?: string;
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
  business_name?: string;
  package_size?: string;
  special_instructions?: string;
}

export interface PackageData {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_area_id?: string;
  destination_area_id?: string;
  origin_agent_id?: string | null;
  destination_agent_id?: string | null;
  delivery_type: string;
  delivery_location?: string;
  
  // Package size and special instructions for doorstep deliveries
  package_size?: string; // 'small', 'medium', 'large' for doorstep deliveries
  special_instructions?: string; // For large packages and special handling requirements
  
  // Additional fields for special delivery types
  package_description?: string; // For fragile items description
  pickup_location?: string; // For collect & deliver and fragile
  coordinates?: {
    pickup?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    delivery?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  };
  
  // Collection-specific fields
  shop_name?: string;
  shop_contact?: string;
  collection_address?: string;
  items_to_collect?: string;
  item_value?: number;
  item_description?: string;
  payment_method?: string;
  requires_payment_advance?: boolean;
  collection_type?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  collection_scheduled_at?: string | null;
  payment_deadline?: string | null;
}

export interface PackageFormData {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

export interface QRCodeResponse {
  data: {
    qr_code_base64: string | null;
    tracking_url: string;
    package_code: string;
    package_state: string;
    route_description: string;
  };
  success: boolean;
  message?: string;
}

// FIXED: Updated pricing interfaces to match your controller
export interface PricingRequest {
  origin_area_id: string;
  destination_area_id: string;
  package_size: string;
}

export interface PricingResult {
  fragile: number;
  home: number;
  office: number;
  collection: number;
}

export type DrawerState = 
  | 'pending' 
  | 'paid' 
  | 'submitted' 
  | 'in-transit' 
  | 'delivered' 
  | 'collected' 
  | 'rejected';

export const STATE_MAPPING: Record<DrawerState, string> = {
  'pending': 'pending_unpaid',
  'paid': 'pending', 
  'submitted': 'submitted',
  'in-transit': 'in_transit',
  'delivered': 'delivered',
  'collected': 'collected',
  'rejected': 'rejected'
};

export interface PackageResponse {
  data: Package[];
  pagination: {
    total_count: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  success: boolean;
  message?: string;
}

export interface PackageFilters {
  state?: DrawerState;
  page?: number;
  per_page?: number;
  search?: string;
}

// Cache for areas and agents to avoid repeated API calls
let areasCache: Area[] | null = null;
let agentsCache: Agent[] | null = null;
let locationsCache: Location[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// FIXED: Delivery types that don't require origin agent (fragile included)
const NO_ORIGIN_AGENT_DELIVERY_TYPES = [
  'fragile', 
  'collect', 
  'collect_deliver',
  'collection'
];

// FIXED: Delivery types that don't require destination area (fragile included)
const NO_DESTINATION_AREA_DELIVERY_TYPES = [
  'fragile',
  'collection'
];

// FIXED: Delivery types where agents are completely optional
const OPTIONAL_AGENT_DELIVERY_TYPES = [
  'fragile'
];

/**
 * UPDATED: Helper function to resolve area ID from agent ID (only if agent provided)
 */
const resolveAreaIdFromAgent = async (agentId: string): Promise<string | null> => {
  try {
    if (!agentId) return null;
    
    console.log('Resolving area ID for agent:', agentId);
    
    const agents = await getAgents();
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) {
      console.warn('Agent not found:', agentId);
      return null;
    }
    
    const areaId = agent.area?.id;
    console.log('Resolved area ID:', areaId, 'for agent:', agent.name);
    
    return areaId || null;
  } catch (error) {
    console.error('Failed to resolve area ID from agent:', error);
    return null;
  }
};

/**
 * Get all package form data required by the modal
 */
export const getPackageFormData = async (): Promise<PackageFormData> => {
  try {
    console.log('Starting getPackageFormData...');
    
    // Check if we have valid cached data
    const now = Date.now();
    const isCacheValid = cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION;
    
    if (isCacheValid && locationsCache && areasCache && agentsCache) {
      console.log('Returning cached package form data:', {
        locations: locationsCache.length,
        areas: areasCache.length,
        agents: agentsCache.length
      });
      
      return {
        locations: locationsCache,
        areas: areasCache,
        agents: agentsCache
      };
    }
    
    console.log('Fetching fresh package form data from API...');
    
    const [locationsResult, areasResult, agentsResult] = await Promise.allSettled([
      getLocations(),
      getAreas(),
      getAgents()
    ]);
    
    // Handle locations
    let locations: Location[] = [];
    if (locationsResult.status === 'fulfilled') {
      locations = locationsResult.value;
      console.log('Locations loaded:', locations.length);
    } else {
      console.error('Failed to load locations:', locationsResult.reason);
    }
    
    // Handle areas
    let areas: Area[] = [];
    if (areasResult.status === 'fulfilled') {
      areas = areasResult.value;
      console.log('Areas loaded:', areas.length);
    } else {
      console.error('Failed to load areas:', areasResult.reason);
      throw new Error('Failed to load areas - required for package creation');
    }
    
    // Handle agents
    let agents: Agent[] = [];
    if (agentsResult.status === 'fulfilled') {
      agents = agentsResult.value;
      console.log('Agents loaded:', agents.length);
    } else {
      console.error('Failed to load agents:', agentsResult.reason);
      throw new Error('Failed to load agents - required for package creation');
    }
    
    if (areas.length === 0) {
      console.warn('No areas available - standard agent deliveries will be disabled');
    }
    
    if (agents.length === 0) {
      console.warn('No agents available - agent deliveries will be disabled');
    }
    
    // Update cache
    locationsCache = locations;
    areasCache = areas;
    agentsCache = agents;
    cacheTimestamp = now;
    
    const formData: PackageFormData = {
      locations,
      areas,
      agents
    };
    
    console.log('Package form data assembled successfully:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length
    });
    
    return formData;
    
  } catch (error: any) {
    console.error('getPackageFormData failed:', error);
    
    // Try to return cached data if available, even if stale
    if (locationsCache && areasCache && agentsCache) {
      console.log('Returning stale cached data as fallback...');
      return {
        locations: locationsCache,
        areas: areasCache,
        agents: agentsCache
      };
    }
    
    throw new Error(`Failed to load package form data: ${error.message}`);
  }
};

/**
 * Get all locations
 */
export const getLocations = async (): Promise<Location[]> => {
  try {
    console.log('Fetching locations from API...');
    
    const response = await api.get('/api/v1/locations', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    let transformedLocations: Location[] = [];
    
    if (response.data.data) {
      const locationsData = Array.isArray(response.data.data) ?
        response.data.data : [response.data.data];
      transformedLocations = locationsData.map((item: any) => transformLocationData(item));
    } else if (Array.isArray(response.data)) {
      transformedLocations = response.data.map((item: any) => transformLocationData(item));
    } else {
      console.warn('Unexpected locations API response format:', response.data);
    }
    
    console.log('Locations loaded:', transformedLocations.length);
    return transformedLocations;
    
  } catch (error: any) {
    console.error('Failed to fetch locations:', error);
    console.log('Continuing without locations data');
    return [];
  }
};

/**
 * Transform location data from API response
 */
const transformLocationData = (rawData: any): Location => {
  try {
    let locationData = rawData;
    
    if (rawData.attributes) {
      locationData = {
        id: rawData.id,
        ...rawData.attributes
      };
    }
    
    return {
      id: String(locationData.id || ''),
      name: locationData.name || 'Unknown Location',
      initials: locationData.initials
    };
    
  } catch (error) {
    console.error('Error transforming location data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || rawData.attributes?.name || 'Unknown Location',
      initials: rawData.initials || rawData.attributes?.initials
    };
  }
};

/**
 * FIXED: Calculate pricing for all delivery types using correct endpoint
 */
export const calculatePackagePricing = async (pricingData: PricingRequest): Promise<PricingResult> => {
  try {
    console.log('📦 Calculating pricing for:', pricingData);
    
    // FIXED: Use the correct endpoint that matches your prices_controller.rb
    const response = await api.post('/api/v1/prices/calculate', {
      origin_area_id: pricingData.origin_area_id,
      destination_area_id: pricingData.destination_area_id,
      package_size: pricingData.package_size,
      all_types: 'true' // Request pricing for all delivery types
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('Pricing calculated:', response.data);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Failed to calculate pricing');
    }
    
  } catch (error: any) {
    console.error('Failed to calculate pricing:', error);
    
    // FIXED: Better error handling with fallback
    console.warn('⚠️ API pricing failed, using fallback calculation');
    
    // Fallback pricing calculation
    const isSameArea = pricingData.origin_area_id === pricingData.destination_area_id;
    let basePrice = isSameArea ? 200 : 350;
    
    // Package size multiplier
    const sizeMultiplier = pricingData.package_size === 'small' ? 0.8 : 
                          pricingData.package_size === 'large' ? 1.4 : 1.0;
    basePrice = Math.round(basePrice * sizeMultiplier);
    
    return {
      fragile: Math.round(basePrice * 1.5) + 100,
      home: Math.round(basePrice * 1.2),
      office: Math.round(basePrice * 0.75),
      collection: Math.round(basePrice * 1.3) + 50
    };
  }
};

/**
 * Validate package form data structure with flexible requirements
 */
export const validatePackageFormData = (data: any): ValidationResult => {
  const issues: string[] = [];
  
  try {
    if (!data || typeof data !== 'object') {
      issues.push('Data is not a valid object');
      return { isValid: false, issues };
    }
    
    // Check locations (optional)
    if (data.locations !== undefined) {
      if (!Array.isArray(data.locations)) {
        issues.push('Locations must be an array');
      } else {
        data.locations.forEach((location: any, index: number) => {
          if (!location.id || !location.name) {
            issues.push(`Location ${index} missing required fields (id, name)`);
          }
        });
      }
    }
    
    // Check areas (required for standard deliveries, optional for special deliveries)
    if (!data.areas || !Array.isArray(data.areas)) {
      issues.push('Areas must be an array');
    } else {
      if (data.areas.length === 0) {
        console.warn('No areas available - some delivery types may be limited');
      } else {
        data.areas.forEach((area: any, index: number) => {
          if (!area.id || !area.name) {
            issues.push(`Area ${index} missing required fields (id, name)`);
          }
        });
      }
    }
    
    // Check agents (required for standard deliveries, optional for special deliveries)
    if (!data.agents || !Array.isArray(data.agents)) {
      issues.push('Agents must be an array');
    } else {
      if (data.agents.length === 0) {
        console.warn('No agents available - agent deliveries will be disabled');
      } else {
        data.agents.forEach((agent: any, index: number) => {
          if (!agent.id || !agent.name) {
            issues.push(`Agent ${index} missing required fields (id, name)`);
          }
        });
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
    
  } catch (error: any) {
    issues.push(`Validation error: ${error.message}`);
    return { isValid: false, issues };
  }
};

/**
 * FIXED: Validate individual package data - fragile deliveries don't require agents
 */
const validatePackageData = (packageData: PackageData): ValidationResult => {
  const issues: string[] = [];
  
  try {
    // Basic required fields
    if (!packageData.receiver_name?.trim()) {
      issues.push('Receiver name is required');
    }
    
    if (!packageData.receiver_phone?.trim()) {
      issues.push('Receiver phone is required');
    }
    
    if (!packageData.delivery_type) {
      issues.push('Delivery type is required');
    }
    
    // Conditional validation based on delivery type
    const deliveryType = packageData.delivery_type.toLowerCase();
    
    // Check if origin agent is required (not for fragile deliveries)
    if (!NO_ORIGIN_AGENT_DELIVERY_TYPES.includes(deliveryType)) {
      if (!packageData.origin_agent_id) {
        issues.push('Origin agent is required for standard deliveries');
      }
    }
    
    // Check if destination area is required (not for fragile deliveries)
    if (!NO_DESTINATION_AREA_DELIVERY_TYPES.includes(deliveryType)) {
      if (!packageData.destination_area_id) {
        issues.push('Destination area is required for standard deliveries');
      }
    }
    
    // UPDATED: Doorstep delivery validation with package size
    if (deliveryType === 'doorstep') {
      if (!packageData.delivery_location?.trim()) {
        issues.push('Delivery location is required for doorstep deliveries');
      }
      
      // Validate package size if provided
      if (packageData.package_size && !['small', 'medium', 'large'].includes(packageData.package_size)) {
        issues.push('Package size must be small, medium, or large');
      }
      
      // Validate special instructions for large packages
      if (packageData.package_size === 'large' && !packageData.special_instructions?.trim()) {
        issues.push('Special instructions are required for large packages');
      }
    }
    
    // Collection-specific validation
    if (deliveryType === 'collection') {
      if (!packageData.shop_name?.trim()) {
        issues.push('Shop name is required for collection deliveries');
      }
      
      if (!packageData.collection_address?.trim()) {
        issues.push('Collection address is required for collection deliveries');
      }
      
      if (!packageData.items_to_collect?.trim()) {
        issues.push('Items to collect description is required');
      }
      
      if (!packageData.item_value || packageData.item_value <= 0) {
        issues.push('Item value is required and must be greater than 0');
      }
      
      if (!packageData.delivery_location?.trim()) {
        issues.push('Delivery location is required for collection deliveries');
      }
    }
    
    // FIXED: Fragile-specific validation - agents are now optional
    if (deliveryType === 'fragile') {
      // Only require delivery location and package description
      if (!packageData.delivery_location?.trim()) {
        issues.push('Delivery location is required for fragile deliveries');
      }
      
      if (!packageData.package_description?.trim()) {
        issues.push('Package description is required for fragile items');
      }
      
      // Agents are completely optional for fragile deliveries
      // Areas are also optional - the system can handle fragile deliveries without specific area assignments
      console.log('Fragile delivery validation: agents and areas are optional');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
    
  } catch (error: any) {
    issues.push(`Package validation error: ${error.message}`);
    return { isValid: false, issues };
  }
};

/**
 * FIXED: Create a new package - fragile deliveries work without required agents
 */
export const createPackage = async (packageData: PackageData): Promise<any> => {
  try {
    console.log('Creating package with data:', packageData);
    
    // Validate package data first
    const validation = validatePackageData(packageData);
    if (!validation.isValid) {
      throw new Error(validation.issues.join(', '));
    }
    
    // Enhanced package data processing with agent-to-area mapping
    let processedPackageData = { ...packageData };
    
    const deliveryType = packageData.delivery_type.toLowerCase();
    
    // FIXED: For fragile deliveries, only resolve areas if agents are provided
    if (deliveryType === 'fragile') {
      console.log('Processing fragile delivery - agents and areas are optional...');
      
      // Only resolve origin area if origin agent is provided
      if (packageData.origin_agent_id && !packageData.origin_area_id) {
        const originAreaId = await resolveAreaIdFromAgent(packageData.origin_agent_id);
        if (originAreaId) {
          processedPackageData.origin_area_id = originAreaId;
          console.log('Resolved origin area ID:', originAreaId);
        }
      }
      
      // Only resolve destination area if destination agent is provided
      if (packageData.destination_agent_id && !packageData.destination_area_id) {
        const destinationAreaId = await resolveAreaIdFromAgent(packageData.destination_agent_id);
        if (destinationAreaId) {
          processedPackageData.destination_area_id = destinationAreaId;
          console.log('Resolved destination area ID:', destinationAreaId);
        }
      }
      
      // If no agents provided, fragile delivery can still proceed without area assignments
      if (!packageData.origin_agent_id && !packageData.destination_agent_id) {
        console.log('Fragile delivery proceeding without agent assignments - using direct location addressing');
      }
    }
    
    if (deliveryType === 'collection') {
      console.log('Processing collection delivery - resolving area ID from destination agent...');
      
      // Resolve destination area from destination agent
      if (packageData.destination_agent_id && !packageData.destination_area_id) {
        const destinationAreaId = await resolveAreaIdFromAgent(packageData.destination_agent_id);
        if (destinationAreaId) {
          processedPackageData.destination_area_id = destinationAreaId;
          console.log('Resolved destination area ID for collection:', destinationAreaId);
        }
      }
    }
    
    if (deliveryType === 'doorstep') {
      console.log('Processing doorstep delivery - resolving origin area ID from agent...');
      
      // Resolve origin area from origin agent (existing functionality)
      if (packageData.origin_agent_id && !packageData.origin_area_id) {
        const originAreaId = await resolveAreaIdFromAgent(packageData.origin_agent_id);
        if (originAreaId) {
          processedPackageData.origin_area_id = originAreaId;
          console.log('Resolved origin area ID for doorstep:', originAreaId);
        }
      }
    }
    
    // Clean up package data and ensure package_size and special_instructions are included
    const cleanPackageData = {
      ...processedPackageData,
      // Convert null to undefined for optional fields
      origin_agent_id: processedPackageData.origin_agent_id || undefined,
      destination_agent_id: processedPackageData.destination_agent_id || undefined,
      origin_area_id: processedPackageData.origin_area_id || undefined,
      destination_area_id: processedPackageData.destination_area_id || undefined,
      
      // Include package_size and special_instructions for doorstep deliveries
      package_size: deliveryType === 'doorstep' ? processedPackageData.package_size || 'medium' : undefined,
      special_instructions: processedPackageData.special_instructions || undefined
    };
    
    // Remove undefined values to keep the payload clean
    Object.keys(cleanPackageData).forEach(key => {
      if (cleanPackageData[key] === undefined) {
        delete cleanPackageData[key];
      }
    });
    
    console.log('Sending package data to API:', {
      ...cleanPackageData,
      // Log which fields are being sent
      has_package_size: !!cleanPackageData.package_size,
      has_special_instructions: !!cleanPackageData.special_instructions,
      resolved_origin_area: !!cleanPackageData.origin_area_id,
      resolved_destination_area: !!cleanPackageData.destination_area_id,
      has_origin_agent: !!cleanPackageData.origin_agent_id,
      has_destination_agent: !!cleanPackageData.destination_agent_id,
      delivery_type: cleanPackageData.delivery_type
    });
    
    const response = await api.post('/api/v1/packages', cleanPackageData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('Package created successfully:', response.data);
    return response.data;
    
  } catch (error: any) {
    console.error('Failed to create package:', error);
    
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      throw new Error(error.response.data.errors.join(', '));
    } else {
      throw new Error(error.message || 'Failed to create package');
    }
  }
};

/**
 * FIXED: Get package pricing using correct endpoint
 */
export const getPackagePricing = async (packageData: Partial<PackageData>): Promise<any> => {
  try {
    console.log('Getting package pricing for:', packageData);
    
    // FIXED: Use GET request to match legacy pricing endpoint
    const response = await api.get('/api/v1/packages/pricing', {
      params: packageData,
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('Pricing calculated:', response.data);
    return response.data;
    
  } catch (error: any) {
    console.error('Failed to get package pricing:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to calculate pricing');
  }
};

// Export the working functions from the separate files
export { getAreas } from './getAreas';
export { getAgents } from './getAgents';

// Rest of your existing helper functions...
export const getAgentsForArea = async (areaId: string): Promise<Agent[]> => {
  try {
    const agents = await getAgents();
    return agents.filter(agent => agent.area_id === areaId);
  } catch (error: any) {
    console.error('Failed to get agents for area:', error);
    return [];
  }
};

export const searchAreas = async (query: string): Promise<Area[]> => {
  try {
    const areas = await getAreas();
    return areas.filter(area => 
      area.name.toLowerCase().includes(query.toLowerCase())
    );
  } catch (error: any) {
    console.error('Failed to search areas:', error);
    return [];
  }
};

export const searchAgents = async (query: string): Promise<Agent[]> => {
  try {
    const agents = await getAgents();
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(query.toLowerCase()) ||
      agent.phone.includes(query)
    );
  } catch (error: any) {
    console.error('Failed to search agents:', error);
    return [];
  }
};

export const clearCache = (): void => {
  areasCache = null;
  agentsCache = null;
  locationsCache = null;
  cacheTimestamp = 0;
  console.log('Package helpers cache cleared');
};

export const getAreaById = async (areaId: string): Promise<Area | null> => {
  try {
    const areas = await getAreas();
    return areas.find(area => area.id === areaId) || null;
  } catch (error: any) {
    console.error('Failed to get area by ID:', error);
    return null;
  }
};

export const getAgentById = async (agentId: string): Promise<Agent | null> => {
  try {
    const agents = await getAgents();
    return agents.find(agent => agent.id === agentId) || null;
  } catch (error: any) {
    console.error('Failed to get agent by ID:', error);
    return null;
  }
};

export const isValidPackageState = (state: string): boolean => {
  const validStates = [
    'pending_unpaid',
    'pending', 
    'submitted',
    'in_transit',
    'delivered',
    'collected',
    'rejected'
  ];
  
  return validStates.includes(state);
};

export const getStateDisplay = (state: string): string => {
  const stateMap: Record<string, string> = {
    'pending_unpaid': 'Pending Payment',
    'pending': 'Pending',
    'submitted': 'Submitted',
    'in_transit': 'In Transit', 
    'delivered': 'Delivered',
    'collected': 'Collected',
    'rejected': 'Rejected'
  };
  
  return stateMap[state] || state.charAt(0).toUpperCase() + state.slice(1);
};

export const getStateColor = (state: string): string => {
  const colorMap: Record<string, string> = {
    'pending_unpaid': '#FF3B30',
    'pending': '#FF9500',
    'submitted': '#667eea',
    'in_transit': '#764ba2',
    'delivered': '#34C759',
    'collected': '#10b981',
    'rejected': '#FF3B30'
  };
  
  return colorMap[state] || '#666666';
};

export const canEditPackage = (state: string, userRole: string): boolean => {
  const adminEditableStates = ['pending_unpaid', 'pending', 'submitted', 'in_transit', 'delivered', 'collected', 'rejected'];
  const agentEditableStates = ['pending', 'submitted', 'in_transit', 'delivered', 'collected'];
  
  if (userRole === 'admin' || userRole === 'super_admin') {
    return adminEditableStates.includes(state);
  } else if (userRole === 'agent') {
    return agentEditableStates.includes(state);
  }
  
  return false;
};

export const getNextValidStates = (currentState: string, userRole: string): string[] => {
  const stateTransitions: Record<string, string[]> = {
    'pending_unpaid': ['pending', 'rejected'],
    'pending': ['submitted', 'rejected'],
    'submitted': ['in_transit', 'rejected'],
    'in_transit': ['delivered', 'rejected'],
    'delivered': ['collected'],
    'collected': [],
    'rejected': []
  };
  
  return stateTransitions[currentState] || [];
};

export const formatRouteDescription = (originArea?: Area, destinationArea?: Area): string => {
  if (!originArea || !destinationArea) {
    return 'Route information unavailable';
  }
  
  const origin = originArea.location?.name || originArea.name;
  const destination = destinationArea.location?.name || destinationArea.name;
  
  return `${origin} → ${destination}`;
};

// Utility functions for delivery type checking
export const requiresOriginAgent = (deliveryType: string): boolean => {
  return !NO_ORIGIN_AGENT_DELIVERY_TYPES.includes(deliveryType.toLowerCase());
};

export const requiresDestinationArea = (deliveryType: string): boolean => {
  return !NO_DESTINATION_AREA_DELIVERY_TYPES.includes(deliveryType.toLowerCase());
};

export const isSpecialDeliveryType = (deliveryType: string): boolean => {
  const specialTypes = ['fragile', 'collection', 'collect', 'collect_deliver'];
  return specialTypes.includes(deliveryType.toLowerCase());
};

// ADDED: Check if agents are optional for delivery type
export const hasOptionalAgents = (deliveryType: string): boolean => {
  return OPTIONAL_AGENT_DELIVERY_TYPES.includes(deliveryType.toLowerCase());
};

// Updated default export with all functions including pricing
export default {
  // MAIN FUNCTIONS
  getPackageFormData,
  validatePackageFormData,
  createPackage,
  getPackagePricing,
  calculatePackagePricing,
  getLocations,
  
  // IMPORTED FUNCTIONS
  getAreas,
  getAgents,
  
  // UTILITY FUNCTIONS
  requiresOriginAgent,
  requiresDestinationArea,
  isSpecialDeliveryType,
  hasOptionalAgents, // NEW: Check for optional agents
  resolveAreaIdFromAgent,
  
  // EXISTING FUNCTIONS
  getAgentsForArea,
  searchAreas,
  searchAgents,
  clearCache,
  getAreaById,
  getAgentById,
  isValidPackageState,
  getStateDisplay,
  getStateColor,
  canEditPackage,
  getNextValidStates,
  formatRouteDescription,
  STATE_MAPPING
};
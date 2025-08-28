// lib/helpers/packageHelpers.ts - FIXED: Import working getAreas from separate file
import api from '../api';

// FIXED: Import the working implementations from separate files
import { getAreas } from './getAreas';
import { getAgents } from './getAgents';

export interface Location {
  id: string;
  name: string;
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
}

// FIXED: Enhanced Package creation data interface to support collection deliveries
export interface PackageData {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_area_id?: string; // Optional for fragile and collection deliveries
  destination_area_id?: string; // Optional for some delivery types
  origin_agent_id?: string | null; // Optional for fragile/collection deliveries
  destination_agent_id?: string | null; // Optional for doorstep deliveries
  delivery_type: string;
  delivery_location?: string;
  
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
  special_instructions?: string;
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

/**
 * FIXED: Get all package form data required by the modal
 * Now uses the working imported functions
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
    
    // Use the working imported functions instead of local implementations
    const [locationsResult, areasResult, agentsResult] = await Promise.allSettled([
      getLocations(),
      getAreas(), // This now uses the working implementation from getAreas.ts
      getAgents() // This now uses the working implementation from getAgents.ts
    ]);
    
    // Handle locations
    let locations: Location[] = [];
    if (locationsResult.status === 'fulfilled') {
      locations = locationsResult.value;
      console.log('Locations loaded:', locations.length);
    } else {
      console.error('Failed to load locations:', locationsResult.reason);
      // Don't throw here, continue with empty array
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
    
    // More flexible validation for minimum required data
    if (areas.length === 0) {
      console.warn('No areas available - standard agent deliveries will be disabled');
      // Don't throw error - some delivery types can work without areas
    }
    
    if (agents.length === 0) {
      console.warn('No agents available - agent deliveries will be disabled');
      // Don't throw error - fragile and collection deliveries can work without agents
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
    
    // Return empty array instead of throwing - locations are optional
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
    
    // Handle JSON:API format
    if (rawData.attributes) {
      locationData = {
        id: rawData.id,
        ...rawData.attributes
      };
    }
    
    return {
      id: String(locationData.id || ''),
      name: locationData.name || 'Unknown Location'
    };
    
  } catch (error) {
    console.error('Error transforming location data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || rawData.attributes?.name || 'Unknown Location'
    };
  }
};

/**
 * FIXED: Validate package form data structure with flexible requirements
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
      // Only warn if no areas available - don't fail validation entirely
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
      // Only warn if no agents available - don't fail validation entirely
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
 * FIXED: Create a new package with bulletproof validation and debugging
 */
export const createPackage = async (packageData: PackageData): Promise<any> => {
  try {
    console.log('📦 Creating package with data:', packageData);
    console.log('📦 Delivery type:', packageData.delivery_type);
    console.log('📦 Origin agent ID:', packageData.origin_agent_id);
    console.log('📦 Destination area ID:', packageData.destination_area_id);
    
    // Basic required fields
    if (!packageData.receiver_name?.trim()) {
      throw new Error('Receiver name is required');
    }
    
    if (!packageData.receiver_phone?.trim()) {
      throw new Error('Receiver phone is required');
    }
    
    if (!packageData.delivery_type) {
      throw new Error('Delivery type is required');
    }
    
    // FIXED: Bulletproof validation with explicit delivery type checking
    const deliveryType = packageData.delivery_type.toLowerCase().trim();
    const specialDeliveryTypes = ['fragile', 'collect', 'collect_deliver', 'collection'];
    
    console.log('📦 Normalized delivery type:', deliveryType);
    console.log('📦 Special delivery types:', specialDeliveryTypes);
    console.log('📦 Is special delivery?', specialDeliveryTypes.includes(deliveryType));
    
    // Origin agent validation - skip for special delivery types
    if (!packageData.origin_agent_id) {
      const requiresOriginAgent = !specialDeliveryTypes.includes(deliveryType);
      console.log('📦 Requires origin agent?', requiresOriginAgent);
      
      if (requiresOriginAgent) {
        throw new Error('Origin agent is required for standard deliveries');
      }
    }
    
    // Destination area validation - skip for fragile and collection deliveries
    if (!packageData.destination_area_id) {
      const noAreaDeliveryTypes = ['fragile', 'collection'];
      const requiresDestinationArea = !noAreaDeliveryTypes.includes(deliveryType);
      console.log('📦 Requires destination area?', requiresDestinationArea);
      
      if (requiresDestinationArea) {
        throw new Error('Destination area is required for standard deliveries');
      }
    }
    
    console.log('📦 Validation passed, sending to API...');
    
    const response = await api.post('/api/v1/packages', packageData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ Package created successfully:', response.data);
    return response.data;
    
  } catch (error: any) {
    console.error('❌ Failed to create package:', error);
    
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
 * Get package pricing
 */
export const getPackagePricing = async (packageData: Partial<PackageData>): Promise<any> => {
  try {
    console.log('Getting package pricing for:', packageData);
    
    const response = await api.post('/api/v1/packages/pricing', packageData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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

// Data transformation helpers
const transformAreaData = (rawData: any, included: any[] = []): Area => {
  try {
    let areaData = rawData;
    
    if (rawData.attributes) {
      areaData = {
        id: rawData.id,
        name: rawData.attributes.name,
        ...rawData.attributes
      };
      
      if (rawData.relationships?.location?.data && included.length > 0) {
        const locationRef = rawData.relationships.location.data;
        const includedLocation = included.find((inc: any) => 
          inc.type === 'location' && inc.id === locationRef.id
        );
        
        if (includedLocation && includedLocation.attributes) {
          areaData.location = {
            id: includedLocation.id,
            name: includedLocation.attributes.name || 'Unknown Location'
          };
        }
      }
    }
    
    return {
      id: String(areaData.id),
      name: areaData.name || 'Unknown Area',
      location_id: areaData.location_id || areaData.location?.id,
      location: areaData.location ? {
        id: String(areaData.location.id),
        name: areaData.location.name || 'Unknown Location'
      } : undefined,
      initials: areaData.initials || areaData.name?.substring(0, 2).toUpperCase()
    };
  } catch (error) {
    console.error('Error transforming area data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || rawData.attributes?.name || 'Unknown Area'
    };
  }
};

const transformAgentData = (rawData: any, included: any[] = []): Agent => {
  try {
    let agentData = rawData;
    
    if (rawData.attributes) {
      agentData = {
        id: rawData.id,
        name: rawData.attributes.name,
        phone: rawData.attributes.phone,
        ...rawData.attributes
      };
      
      if (rawData.relationships?.area?.data && included.length > 0) {
        const areaRef = rawData.relationships.area.data;
        const includedArea = included.find((inc: any) => 
          inc.type === 'area' && inc.id === areaRef.id
        );
        
        if (includedArea && includedArea.attributes) {
          let location = undefined;
          if (includedArea.relationships?.location?.data) {
            const locationRef = includedArea.relationships.location.data;
            const includedLocation = included.find((inc: any) => 
              inc.type === 'location' && inc.id === locationRef.id
            );
            
            if (includedLocation && includedLocation.attributes) {
              location = {
                id: includedLocation.id,
                name: includedLocation.attributes.name || 'Unknown Location'
              };
            }
          }
          
          agentData.area = {
            id: includedArea.id,
            name: includedArea.attributes.name || 'Unknown Area',
            location_id: includedArea.attributes.location_id,
            location
          };
        }
      }
    }
    
    return {
      id: String(agentData.id),
      name: agentData.name || 'Unknown Agent',
      phone: agentData.phone || 'No phone',
      area_id: agentData.area_id || agentData.area?.id,
      area: agentData.area ? {
        id: String(agentData.area.id),
        name: agentData.area.name || 'Unknown Area',
        location_id: agentData.area.location_id,
        location: agentData.area.location ? {
          id: String(agentData.area.location.id),
          name: agentData.area.location.name || 'Unknown Location'
        } : undefined
      } : undefined
    };
  } catch (error) {
    console.error('Error transforming agent data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || rawData.attributes?.name || 'Unknown Agent',
      phone: rawData.phone || rawData.attributes?.phone || 'No phone'
    };
  }
};

// Additional helper functions for packages management...
export const getPackages = async (filters?: PackageFilters): Promise<PackageResponse> => {
  try {
    console.log('Fetching packages with filters:', filters);
    
    const params = new URLSearchParams();
    
    if (filters?.state) {
      const apiState = STATE_MAPPING[filters.state];
      params.append('state', apiState);
    }
    
    if (filters?.page) {
      params.append('page', filters.page.toString());
    }
    
    if (filters?.per_page) {
      params.append('per_page', filters.per_page.toString());
    }
    
    if (filters?.search) {
      params.append('search', filters.search);
    }
    
    const queryString = params.toString();
    const url = `/api/v1/packages${queryString ? '?' + queryString : ''}`;
    
    console.log('API call URL:', url);
    
    const response = await api.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('Packages API response:', {
      success: response.data.success,
      dataCount: response.data.data?.length || 0,
      totalCount: response.data.pagination?.total_count || 0
    });
    
    if (response.data.success !== false) {
      const packagesData = response.data.data || response.data || [];
      const included = response.data.included || [];
      
      const transformedPackages = Array.isArray(packagesData) 
        ? packagesData.map((pkg: any) => transformPackageData(pkg, included))
        : [transformPackageData(packagesData, included)];
      
      return {
        data: transformedPackages,
        pagination: response.data.pagination || {
          total_count: transformedPackages.length,
          page: 1,
          per_page: 20,
          total_pages: 1
        },
        success: true,
        message: response.data.message
      };
    } else {
      throw new Error(response.data.message || 'Failed to fetch packages');
    }
    
  } catch (error: any) {
    console.error('Failed to fetch packages:', error);
    
    return {
      data: [],
      pagination: {
        total_count: 0,
        page: 1,
        per_page: 20,
        total_pages: 0
      },
      success: false,
      message: error.message || 'Failed to fetch packages'
    };
  }
};

const transformPackageData = (rawData: any, included: any[] = []): Package => {
  try {
    let packageData = rawData;
    
    if (rawData.attributes) {
      packageData = {
        id: rawData.id,
        ...rawData.attributes
      };
      
      if (rawData.relationships && included.length > 0) {
        // Origin area
        if (rawData.relationships.origin_area?.data) {
          const areaRef = rawData.relationships.origin_area.data;
          const includedArea = included.find((inc: any) => 
            inc.type === 'area' && inc.id === areaRef.id
          );
          if (includedArea) {
            packageData.origin_area = transformAreaData(includedArea, included);
          }
        }
        
        // Destination area
        if (rawData.relationships.destination_area?.data) {
          const areaRef = rawData.relationships.destination_area.data;
          const includedArea = included.find((inc: any) => 
            inc.type === 'area' && inc.id === areaRef.id
          );
          if (includedArea) {
            packageData.destination_area = transformAreaData(includedArea, included);
          }
        }
        
        // Origin agent
        if (rawData.relationships.origin_agent?.data) {
          const agentRef = rawData.relationships.origin_agent.data;
          const includedAgent = included.find((inc: any) => 
            inc.type === 'agent' && inc.id === agentRef.id
          );
          if (includedAgent) {
            packageData.origin_agent = transformAgentData(includedAgent, included);
          }
        }
        
        // Destination agent
        if (rawData.relationships.destination_agent?.data) {
          const agentRef = rawData.relationships.destination_agent.data;
          const includedAgent = included.find((inc: any) => 
            inc.type === 'agent' && inc.id === agentRef.id
          );
          if (includedAgent) {
            packageData.destination_agent = transformAgentData(includedAgent, included);
          }
        }
      }
    }
    
    return {
      id: String(packageData.id || ''),
      code: packageData.code || '',
      state: packageData.state || 'unknown',
      state_display: packageData.state_display || getStateDisplay(packageData.state || ''),
      sender_name: packageData.sender_name || 'Unknown Sender',
      receiver_name: packageData.receiver_name || 'Unknown Receiver',
      receiver_phone: packageData.receiver_phone || '',
      route_description: packageData.route_description || 'Route information unavailable',
      cost: Number(packageData.cost) || 0,
      delivery_type: packageData.delivery_type || 'agent',
      created_at: packageData.created_at || new Date().toISOString(),
      updated_at: packageData.updated_at || packageData.created_at || new Date().toISOString(),
      origin_area: packageData.origin_area,
      destination_area: packageData.destination_area,
      origin_agent: packageData.origin_agent,
      destination_agent: packageData.destination_agent,
      delivery_location: packageData.delivery_location,
      sender_phone: packageData.sender_phone,
      sender_email: packageData.sender_email,
      receiver_email: packageData.receiver_email,
      business_name: packageData.business_name
    };
    
  } catch (error) {
    console.error('Error transforming package data:', error, rawData);
    throw new Error('Failed to transform package data');
  }
};

// Additional package management functions...
export const getPackagesByState = async (state: DrawerState, page = 1, perPage = 20): Promise<PackageResponse> => {
  return getPackages({ state, page, per_page: perPage });
};

export const searchPackages = async (query: string, page = 1, perPage = 20): Promise<PackageResponse> => {
  return getPackages({ search: query, page, per_page: perPage });
};

export const getPackageDetails = async (packageId: string): Promise<Package> => {
  try {
    console.log('Fetching package details for ID:', packageId);
    
    const response = await api.get(`/api/v1/packages/${packageId}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data.success !== false) {
      const included = response.data.included || [];
      return transformPackageData(response.data.data || response.data, included);
    } else {
      throw new Error(response.data.message || 'Failed to fetch package details');
    }
    
  } catch (error: any) {
    console.error('Failed to fetch package details:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch package details');
  }
};

export const getPackageQRCode = async (packageCode: string): Promise<QRCodeResponse> => {
  try {
    console.log('Fetching QR code for package:', packageCode);
    
    const response = await api.get(`/api/v1/packages/${packageCode}/qr_code`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('QR Code response:', response.data);
    
    // Handle the response format
    if (response.data.success !== false && response.data.data) {
      return {
        data: {
          qr_code_base64: response.data.data.qr_code_base64 || null,
          tracking_url: response.data.data.tracking_url || `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/track/${packageCode}`,
          package_code: packageCode,
          package_state: response.data.data.package_state || 'unknown',
          route_description: response.data.data.route_description || 'Route information unavailable'
        },
        success: true,
        message: response.data.message
      };
    } else {
      throw new Error(response.data.message || 'Failed to generate QR code');
    }
    
  } catch (error: any) {
    console.error('Failed to fetch QR code:', error);
    
    // Return fallback QR data instead of throwing
    return {
      data: {
        qr_code_base64: null,
        tracking_url: `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/track/${packageCode}`,
        package_code: packageCode,
        package_state: 'unknown',
        route_description: 'Route information unavailable'
      },
      success: false,
      message: error.message || 'Failed to generate QR code'
    };
  }
};

export const refreshData = async (): Promise<void> => {
  try {
    console.log('Refreshing package helpers data...');
    
    // Clear cache to force fresh fetch
    clearCache();
    
    // Fetch fresh data
    const [locations, areas, agents] = await Promise.allSettled([
      getLocations(),
      getAreas(),
      getAgents()
    ]);
    
    console.log('Data refresh results:', {
      locations: locations.status === 'fulfilled' ? locations.value.length : 'failed',
      areas: areas.status === 'fulfilled' ? areas.value.length : 'failed',
      agents: agents.status === 'fulfilled' ? agents.value.length : 'failed'
    });
  } catch (error: any) {
    console.error('Failed to refresh package helpers data:', error);
    throw error;
  }
};

// Updated default export with all functions
export default {
  // MAIN FUNCTIONS
  getPackageFormData,
  validatePackageFormData,
  createPackage,
  getPackagePricing,
  getLocations,
  
  // IMPORTED FUNCTIONS
  getAreas,
  getAgents,
  
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
  refreshData,
  
  // Package-specific functions
  getPackages,
  getPackagesByState,
  searchPackages,
  getPackageDetails,
  getPackageQRCode,
  STATE_MAPPING
};
// lib/helpers/packageHelpers.ts - COMPLETE with all missing functions
import api from '../api';

export interface Location {
  id: string;
  name: string;
}

export interface Area {
  id: string;
  name: string;
  location?: Location;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
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
  // Additional fields your track screen might expect
  recipient_name?: string;
  receiver?: { name: string };
  recipient?: { name: string };
  to_name?: string;
  from_location?: string;
  to_location?: string;
}

// ADDED: QR Code response interface
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

// ADDED: Types that your track screen expects
export type DrawerState = 
  | 'pending' 
  | 'paid' 
  | 'submitted' 
  | 'in-transit' 
  | 'delivered' 
  | 'collected' 
  | 'rejected';

// ADDED: State mapping for the drawer navigation
export const STATE_MAPPING: Record<DrawerState, string> = {
  'pending': 'pending_unpaid',
  'paid': 'pending', 
  'submitted': 'submitted',
  'in-transit': 'in_transit',
  'delivered': 'delivered',
  'collected': 'collected',
  'rejected': 'rejected'
};

// ADDED: API response interfaces your track screen expects
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
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * ADDED: Get detailed package information by package code
 * This is what your tracking screen is calling
 */
export const getPackageDetails = async (packageCode: string): Promise<Package> => {
  try {
    console.log('📦 Fetching package details for code:', packageCode);
    
    if (!packageCode || typeof packageCode !== 'string') {
      throw new Error('Package code is required');
    }
    
    const response = await api.get(`/api/v1/packages/${encodeURIComponent(packageCode)}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Package details API response:', {
      success: response.data.success !== false,
      hasData: !!response.data.data,
      packageId: response.data.data?.id
    });
    
    let packageData: any;
    
    // Handle different response formats
    if (response.data.data) {
      packageData = response.data.data;
    } else if (response.data.id) {
      packageData = response.data;
    } else {
      throw new Error('Package not found');
    }
    
    // Transform the package data
    const transformedPackage = transformPackageData(packageData, response.data.included || []);
    
    console.log('✅ Package details loaded:', transformedPackage.code);
    return transformedPackage;
    
  } catch (error: any) {
    console.error('❌ Failed to fetch package details:', error);
    
    if (error.response?.status === 404) {
      throw new Error(`Package ${packageCode} not found`);
    } else if (error.response?.status === 403) {
      throw new Error('You do not have permission to view this package');
    } else if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      throw new Error('Network error - please check your connection');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out - please try again');
    }
    
    throw new Error(error.message || 'Failed to load package details');
  }
};

/**
 * ADDED: Get QR code for package tracking
 * This is what your tracking screen is calling
 */
export const getPackageQRCode = async (packageCode: string): Promise<QRCodeResponse> => {
  try {
    console.log('🔗 Fetching QR code for package:', packageCode);
    
    if (!packageCode || typeof packageCode !== 'string') {
      throw new Error('Package code is required');
    }
    
    const response = await api.get(`/api/v1/packages/${encodeURIComponent(packageCode)}/qr_code`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ QR code API response:', {
      success: response.data.success !== false,
      hasQRCode: !!response.data.data?.qr_code_base64,
      hasTrackingUrl: !!response.data.data?.tracking_url
    });
    
    // Handle the response
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
    console.error('❌ Failed to fetch QR code:', error);
    
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

/**
 * ADDED: Transform package data from API response
 */
const transformPackageData = (rawData: any, included: any[] = []): Package => {
  try {
    let packageData = rawData;
    
    // Handle JSON:API format
    if (rawData.attributes) {
      packageData = {
        id: rawData.id,
        ...rawData.attributes
      };
      
      // Handle relationships
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
    
    // Ensure required fields exist
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
      business_name: packageData.business_name,
      // Additional fields for compatibility
      recipient_name: packageData.recipient_name || packageData.receiver_name,
      receiver: packageData.receiver || { name: packageData.receiver_name },
      recipient: packageData.recipient || { name: packageData.receiver_name },
      to_name: packageData.to_name || packageData.receiver_name,
      from_location: packageData.from_location || packageData.origin_area?.name,
      to_location: packageData.to_location || packageData.destination_area?.name,
    };
    
  } catch (error) {
    console.error('Error transforming package data:', error, rawData);
    throw new Error('Failed to transform package data');
  }
};

/**
 * ADDED: Get packages with optional filtering - the main missing function
 * This is what your track screen is calling
 */
export const getPackages = async (filters?: PackageFilters): Promise<PackageResponse> => {
  try {
    console.log('📦 Fetching packages with filters:', filters);
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters?.state) {
      // Map drawer state to API state
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
    
    console.log('🔗 API call URL:', url);
    
    const response = await api.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Packages API response:', {
      success: response.data.success,
      dataCount: response.data.data?.length || 0,
      totalCount: response.data.pagination?.total_count || 0
    });
    
    // Handle different response formats
    if (response.data.success !== false) {
      const packagesData = response.data.data || response.data || [];
      const included = response.data.included || [];
      
      // Transform each package
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
    console.error('❌ Failed to fetch packages:', error);
    
    // Return empty result on error to prevent component crashes
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

/**
 * IMPROVED: Data transformation with better error handling
 */
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
      location: areaData.location ? {
        id: String(areaData.location.id),
        name: areaData.location.name || 'Unknown Location'
      } : undefined
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
            location
          };
        }
      }
    }
    
    return {
      id: String(agentData.id),
      name: agentData.name || 'Unknown Agent',
      phone: agentData.phone || 'No phone',
      area: agentData.area ? {
        id: String(agentData.area.id),
        name: agentData.area.name || 'Unknown Area',
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

/**
 * Get all areas with improved error handling and fallbacks
 */
export const getAreas = async (): Promise<Area[]> => {
  try {
    const now = Date.now();
    if (areasCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📋 Returning cached areas:', areasCache.length);
      return areasCache;
    }

    console.log('🔄 Fetching areas from API...');
    
    const response = await api.get('/api/v1/areas', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    let transformedAreas: Area[] = [];

    if (response.data.data) {
      const areasData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      const included = response.data.included || [];
      transformedAreas = areasData.map((item: any) => transformAreaData(item, included));
    } else if (Array.isArray(response.data)) {
      transformedAreas = response.data.map((item: any) => transformAreaData(item, []));
    } else {
      console.warn('⚠️ Unexpected API response format:', response.data);
      throw new Error('Unexpected API response format');
    }

    areasCache = transformedAreas;
    cacheTimestamp = now;

    console.log('✅ Areas loaded and cached:', transformedAreas.length);
    return transformedAreas;
  } catch (error: any) {
    console.error('❌ Failed to fetch areas:', error);
    
    if (areasCache) {
      console.log('⚠️ API failed, returning stale cached areas:', areasCache.length);
      return areasCache;
    }
    
    console.log('⚠️ No cached data available, returning empty array');
    return [];
  }
};

/**
 * Get all agents with improved error handling and fallbacks
 */
export const getAgents = async (): Promise<Agent[]> => {
  try {
    const now = Date.now();
    if (agentsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📋 Returning cached agents:', agentsCache.length);
      return agentsCache;
    }

    console.log('🔄 Fetching agents from API...');
    
    const response = await api.get('/api/v1/agents', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    let transformedAgents: Agent[] = [];

    if (response.data.data) {
      const agentsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      const included = response.data.included || [];
      transformedAgents = agentsData.map((item: any) => transformAgentData(item, included));
    } else if (Array.isArray(response.data)) {
      transformedAgents = response.data.map((item: any) => transformAgentData(item, []));
    } else {
      console.warn('⚠️ Unexpected API response format:', response.data);
      throw new Error('Unexpected API response format');
    }

    agentsCache = transformedAgents;
    cacheTimestamp = now;

    console.log('✅ Agents loaded and cached:', transformedAgents.length);
    return transformedAgents;
  } catch (error: any) {
    console.error('❌ Failed to fetch agents:', error);
    
    if (agentsCache) {
      console.log('⚠️ API failed, returning stale cached agents:', agentsCache.length);
      return agentsCache;
    }
    
    console.log('⚠️ No cached data available, returning empty array');
    return [];
  }
};

// ADDED: Additional helper functions for package management
export const getPackagesByState = async (state: DrawerState): Promise<Package[]> => {
  try {
    const response = await getPackages({ state });
    return response.data;
  } catch (error: any) {
    console.error(`❌ Failed to get packages for state ${state}:`, error);
    return [];
  }
};

export const searchPackages = async (query: string, state?: DrawerState): Promise<Package[]> => {
  try {
    const response = await getPackages({ search: query, state });
    return response.data;
  } catch (error: any) {
    console.error('❌ Failed to search packages:', error);
    return [];
  }
};

// Existing helper functions...
export const getAgentsForArea = async (areaId: string): Promise<Agent[]> => {
  try {
    const allAgents = await getAgents();
    return allAgents.filter(agent => agent.area?.id === areaId);
  } catch (error: any) {
    console.error('❌ Failed to get agents for area:', error);
    return [];
  }
};

export const searchAreas = async (query: string): Promise<Area[]> => {
  try {
    const allAreas = await getAreas();
    const searchQuery = query.toLowerCase().trim();
    
    if (!searchQuery) return allAreas;
    
    return allAreas.filter(area => 
      area.name.toLowerCase().includes(searchQuery) ||
      area.location?.name.toLowerCase().includes(searchQuery)
    );
  } catch (error: any) {
    console.error('❌ Failed to search areas:', error);
    return [];
  }
};

export const searchAgents = async (query: string): Promise<Agent[]> => {
  try {
    const allAgents = await getAgents();
    const searchQuery = query.toLowerCase().trim();
    
    if (!searchQuery) return allAgents;
    
    return allAgents.filter(agent => 
      agent.name.toLowerCase().includes(searchQuery) ||
      agent.phone.toLowerCase().includes(searchQuery) ||
      agent.area?.name.toLowerCase().includes(searchQuery) ||
      agent.area?.location?.name.toLowerCase().includes(searchQuery)
    );
  } catch (error: any) {
    console.error('❌ Failed to search agents:', error);
    return [];
  }
};

export const clearCache = (): void => {
  areasCache = null;
  agentsCache = null;
  cacheTimestamp = 0;
  console.log('🧹 Package helpers cache cleared');
};

export const getAreaById = async (areaId: string): Promise<Area | null> => {
  try {
    const areas = await getAreas();
    return areas.find(area => area.id === areaId) || null;
  } catch (error: any) {
    console.error('❌ Failed to get area by ID:', error);
    return null;
  }
};

export const getAgentById = async (agentId: string): Promise<Agent | null> => {
  try {
    const agents = await getAgents();
    return agents.find(agent => agent.id === agentId) || null;
  } catch (error: any) {
    console.error('❌ Failed to get agent by ID:', error);
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
    'collected': '#34C759',
    'rejected': '#FF3B30'
  };
  
  return colorMap[state] || '#a0aec0';
};

export const canEditPackage = (packageData: Package, userRole: string): boolean => {
  switch (userRole) {
    case 'admin':
      return true;
    case 'client':
      return ['pending_unpaid', 'pending'].includes(packageData.state);
    case 'agent':
    case 'rider':
    case 'warehouse':
      return true;
    default:
      return false;
  }
};

export const getNextValidStates = (currentState: string, userRole: string): string[] => {
  const stateTransitions: Record<string, string[]> = {
    'pending_unpaid': ['pending', 'rejected'],
    'pending': ['submitted', 'rejected'],
    'submitted': ['in_transit', 'rejected'],
    'in_transit': ['delivered', 'rejected'],
    'delivered': ['collected'],
    'collected': [],
    'rejected': ['pending']
  };
  
  if (userRole === 'admin') {
    return stateTransitions[currentState] || [];
  }
  
  const limitedTransitions: Record<string, string[]> = {
    'agent': ['submitted', 'in_transit', 'delivered'],
    'rider': ['in_transit', 'delivered', 'collected'],
    'warehouse': ['submitted', 'in_transit']
  };
  
  const allowedStates = limitedTransitions[userRole] || [];
  const nextStates = stateTransitions[currentState] || [];
  
  return nextStates.filter(state => allowedStates.includes(state));
};

export const formatRouteDescription = (
  originArea?: Area,
  destinationArea?: Area
): string => {
  if (!originArea || !destinationArea) {
    return 'Route information unavailable';
  }
  
  const originLocation = originArea.location?.name || 'Unknown Origin';
  const destinationLocation = destinationArea.location?.name || 'Unknown Destination';
  
  if (originArea.location?.id === destinationArea.location?.id) {
    return `${originLocation} (${originArea.name} → ${destinationArea.name})`;
  } else {
    return `${originLocation} → ${destinationLocation}`;
  }
};

export const refreshData = async (): Promise<void> => {
  try {
    clearCache();
    const [areas, agents] = await Promise.allSettled([
      getAreas(),
      getAgents()
    ]);
    
    console.log('✅ Package helpers data refresh complete:', {
      areas: areas.status === 'fulfilled' ? areas.value.length : 'failed',
      agents: agents.status === 'fulfilled' ? agents.value.length : 'failed'
    });
  } catch (error: any) {
    console.error('❌ Failed to refresh package helpers data:', error);
    throw error;
  }
};

// Updated default export with all functions
export default {
  getAreas,
  getAgents,
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
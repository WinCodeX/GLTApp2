// lib/helpers/packageHelpers.ts - Helper functions for package operations
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

// Cache for areas and agents to avoid repeated API calls
let areasCache: Area[] | null = null;
let agentsCache: Agent[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all areas with location information
 */
export const getAreas = async (): Promise<Area[]> => {
  try {
    // Check cache first
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
      timeout: 10000
    });

    console.log('📋 Areas API response:', response.data);

    if (response.data.success) {
      const areas = response.data.data || [];
      
      // Transform the data to ensure consistent structure
      const transformedAreas: Area[] = areas.map((area: any) => ({
        id: String(area.id),
        name: area.name || 'Unknown Area',
        location: area.location ? {
          id: String(area.location.id),
          name: area.location.name || 'Unknown Location'
        } : undefined
      }));

      // Update cache
      areasCache = transformedAreas;
      cacheTimestamp = now;

      console.log('✅ Areas loaded and cached:', transformedAreas.length);
      return transformedAreas;
    } else {
      throw new Error(response.data.message || 'Failed to load areas');
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch areas:', error);
    
    // Return cached data if available, even if stale
    if (areasCache) {
      console.log('⚠️ Returning stale cached areas due to error');
      return areasCache;
    }
    
    throw new Error(`Failed to load areas: ${error.message}`);
  }
};

/**
 * Get all agents with area information
 */
export const getAgents = async (): Promise<Agent[]> => {
  try {
    // Check cache first
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
      timeout: 10000
    });

    console.log('📋 Agents API response:', response.data);

    if (response.data.success) {
      const agents = response.data.data || [];
      
      // Transform the data to ensure consistent structure
      const transformedAgents: Agent[] = agents.map((agent: any) => ({
        id: String(agent.id),
        name: agent.name || 'Unknown Agent',
        phone: agent.phone || 'No phone',
        area: agent.area ? {
          id: String(agent.area.id),
          name: agent.area.name || 'Unknown Area',
          location: agent.area.location ? {
            id: String(agent.area.location.id),
            name: agent.area.location.name || 'Unknown Location'
          } : undefined
        } : undefined
      }));

      // Update cache
      agentsCache = transformedAgents;
      cacheTimestamp = now;

      console.log('✅ Agents loaded and cached:', transformedAgents.length);
      return transformedAgents;
    } else {
      throw new Error(response.data.message || 'Failed to load agents');
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch agents:', error);
    
    // Return cached data if available, even if stale
    if (agentsCache) {
      console.log('⚠️ Returning stale cached agents due to error');
      return agentsCache;
    }
    
    throw new Error(`Failed to load agents: ${error.message}`);
  }
};

/**
 * Get agents for a specific area
 */
export const getAgentsForArea = async (areaId: string): Promise<Agent[]> => {
  try {
    const allAgents = await getAgents();
    return allAgents.filter(agent => agent.area?.id === areaId);
  } catch (error: any) {
    console.error('❌ Failed to get agents for area:', error);
    throw error;
  }
};

/**
 * Search areas by name or location
 */
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
    throw error;
  }
};

/**
 * Search agents by name, area, or phone
 */
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
    throw error;
  }
};

/**
 * Clear the cache (useful for forcing refresh)
 */
export const clearCache = (): void => {
  areasCache = null;
  agentsCache = null;
  cacheTimestamp = 0;
  console.log('🧹 Package helpers cache cleared');
};

/**
 * Get area by ID
 */
export const getAreaById = async (areaId: string): Promise<Area | null> => {
  try {
    const areas = await getAreas();
    return areas.find(area => area.id === areaId) || null;
  } catch (error: any) {
    console.error('❌ Failed to get area by ID:', error);
    return null;
  }
};

/**
 * Get agent by ID
 */
export const getAgentById = async (agentId: string): Promise<Agent | null> => {
  try {
    const agents = await getAgents();
    return agents.find(agent => agent.id === agentId) || null;
  } catch (error: any) {
    console.error('❌ Failed to get agent by ID:', error);
    return null;
  }
};

/**
 * Validate package state
 */
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

/**
 * Get human-readable state display
 */
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

/**
 * Get state color for UI
 */
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

/**
 * Check if package can be edited based on state and user role
 */
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

/**
 * Get next valid states for a package
 */
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
  
  // Admin can make any valid transition
  if (userRole === 'admin') {
    return stateTransitions[currentState] || [];
  }
  
  // Other roles have limited transitions
  const limitedTransitions: Record<string, string[]> = {
    'agent': ['submitted', 'in_transit', 'delivered'],
    'rider': ['in_transit', 'delivered', 'collected'],
    'warehouse': ['submitted', 'in_transit']
  };
  
  const allowedStates = limitedTransitions[userRole] || [];
  const nextStates = stateTransitions[currentState] || [];
  
  return nextStates.filter(state => allowedStates.includes(state));
};

/**
 * Format route description
 */
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
    // Same location, different areas
    return `${originLocation} (${originArea.name} → ${destinationArea.name})`;
  } else {
    // Different locations
    return `${originLocation} → ${destinationLocation}`;
  }
};

/**
 * Refresh cache data
 */
export const refreshData = async (): Promise<void> => {
  try {
    clearCache();
    await Promise.all([
      getAreas(),
      getAgents()
    ]);
    console.log('✅ Package helpers data refreshed');
  } catch (error: any) {
    console.error('❌ Failed to refresh package helpers data:', error);
    throw error;
  }
};
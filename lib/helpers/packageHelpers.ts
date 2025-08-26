// lib/helpers/packageHelpers.ts - Enhanced for new delivery types and backend alignment
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==========================================
// ENHANCED TYPE DEFINITIONS
// ==========================================

export type DeliveryType = 'doorstep' | 'agent' | 'fragile' | 'collection' | 'express' | 'bulk';
export type PaymentMethod = 'mpesa' | 'card' | 'cash';
export type CollectionType = 'shop_pickup' | 'office_pickup' | 'custom_location';

export interface Location {
  id: string;
  name: string;
  initials?: string;
  code?: string;
  abbreviation?: string;
}

export interface Area {
  id: string;
  name: string;
  location_id?: string;
  location?: Location;
}

export interface Agent {
  id: string;
  name: string;
  phone?: string;
  area_id?: string;
  area?: Area;
}

// ENHANCED: Comprehensive PackageData interface supporting all delivery types
export interface PackageData {
  // Core package information
  sender_name?: string;
  sender_phone?: string;
  sender_email?: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_email?: string;
  business_name?: string;
  
  // Location and routing
  origin_area_id?: string;
  destination_area_id?: string;
  origin_agent_id?: string;
  destination_agent_id?: string;
  delivery_location?: string;
  
  // Enhanced delivery type with all supported types
  delivery_type: DeliveryType;
  
  // Special handling
  special_instructions?: string;
  special_handling?: boolean;
  priority_level?: 'normal' | 'high' | 'urgent';
  
  // Collection-specific fields (for collection delivery type)
  shop_name?: string;
  shop_contact?: string;
  collection_address?: string;
  items_to_collect?: string;
  item_value?: number;
  item_description?: string;
  collection_type?: CollectionType;
  
  // Payment and scheduling
  payment_method?: PaymentMethod;
  requires_payment_advance?: boolean;
  payment_deadline?: string;
  collection_scheduled_at?: string;
  
  // Coordinates for mapping
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  
  // Legacy/compatibility fields
  pickup_location?: string;
  package_description?: string;
  coordinates?: {
    pickup?: { latitude: number; longitude: number; };
    delivery?: { latitude: number; longitude: number; };
  };
  collection_details?: {
    shop_name?: string;
    shop_contact?: string;
    items_to_collect?: string;
    estimated_value?: string;
    payment_method?: PaymentMethod;
  };
}

// Enhanced package response type
export interface PackageResponse {
  success: boolean;
  data: PackageInfo[];
  meta?: {
    total_count: number;
    current_user_role: string;
    delivery_types_supported?: string[];
  };
}

export interface PackageInfo {
  id: string;
  code: string;
  tracking_code?: string;
  state: string;
  state_display?: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone?: string;
  route_description: string;
  cost: number;
  delivery_type: DeliveryType;
  delivery_type_display?: string;
  priority_level?: string;
  created_at: string;
  updated_at: string;
  
  // Location information
  origin_area?: Area;
  destination_area?: Area;
  origin_agent?: Agent;
  destination_agent?: Agent;
  delivery_location?: string;
  
  // Enhanced flags
  is_fragile?: boolean;
  is_collection?: boolean;
  requires_special_handling?: boolean;
  
  // Collection details
  collection_details?: {
    shop_name?: string;
    shop_contact?: string;
    collection_address?: string;
    items_to_collect?: string;
    item_value?: number;
    item_description?: string;
    collection_type?: string;
  };
  
  // Handling information
  handling_instructions?: string[];
  special_instructions?: string;
  
  // Coordinates
  pickup_coordinates?: { latitude: number; longitude: number; };
  delivery_coordinates?: { latitude: number; longitude: number; };
  
  // Additional fields for compatibility
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
  business_name?: string;
  route_description?: string;
  display_identifier?: string;
  tracking_url?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

export interface PackageFilters {
  state?: string;
  delivery_type?: DeliveryType;
  search?: string;
  page?: number;
  per_page?: number;
}

// ==========================================
// ENHANCED DELIVERY TYPE INFORMATION
// ==========================================

export const DELIVERY_TYPE_INFO = {
  doorstep: {
    name: 'Door-to-Door Delivery',
    description: 'Package delivered directly to the recipient\'s location',
    icon: '🏠',
    requires_location: true,
    base_cost: 150
  },
  agent: {
    name: 'Agent Collection',
    description: 'Package delivered to an agent for recipient collection',
    icon: '🏢',
    requires_agent: true,
    base_cost: 100
  },
  fragile: {
    name: 'Fragile Handling',
    description: 'Special care handling for delicate items with priority delivery',
    icon: '⚠️',
    requires_location: true,
    base_cost: 200,
    priority: 'high'
  },
  collection: {
    name: 'Collection & Delivery',
    description: 'We collect items from shops/locations and deliver them to you',
    icon: '📦',
    requires_location: true,
    requires_collection_details: true,
    base_cost: 250,
    priority: 'medium'
  },
  express: {
    name: 'Express Delivery',
    description: 'Same-day priority delivery service',
    icon: '⚡',
    requires_location: true,
    base_cost: 300,
    priority: 'high'
  },
  bulk: {
    name: 'Bulk Package',
    description: 'Cost-effective solution for multiple items',
    icon: '📚',
    base_cost: 80
  }
} as const;

// State mapping for backward compatibility
export const STATE_MAPPING = {
  'All': '',
  'Pending Payment': 'pending_unpaid',
  'Processing': 'pending',
  'Ready for Pickup': 'submitted',
  'In Transit': 'in_transit',
  'Delivered': 'delivered',
  'Collected': 'collected',
  'Cancelled': 'rejected'
} as const;

// ==========================================
// ENHANCED API FUNCTIONS
// ==========================================

/**
 * Get comprehensive package form data including locations, areas, and agents
 */
export const getPackageFormData = async (): Promise<{
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}> => {
  try {
    console.log('📋 Loading package form data...');
    
    // Fetch all required data in parallel
    const [locationsResult, areasResult, agentsResult] = await Promise.allSettled([
      getLocations(),
      getAreas(),
      getAgents()
    ]);
    
    const locations = locationsResult.status === 'fulfilled' ? locationsResult.value : [];
    const areas = areasResult.status === 'fulfilled' ? areasResult.value : [];
    const agents = agentsResult.status === 'fulfilled' ? agentsResult.value : [];
    
    console.log('✅ Package form data loaded:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length
    });
    
    return { locations, areas, agents };
    
  } catch (error: any) {
    console.error('❌ Failed to get package form data:', error);
    throw new Error(`Failed to load form data: ${error.message}`);
  }
};

/**
 * Enhanced package creation with support for all delivery types
 */
export const createPackage = async (packageData: PackageData): Promise<any> => {
  try {
    console.log('📦 Creating package with delivery type:', packageData.delivery_type);
    console.log('📦 Package data:', JSON.stringify(packageData, null, 2));
    
    // Enhanced validation for different delivery types
    validatePackageData(packageData);
    
    // Prepare comprehensive API payload
    const payload = {
      package: buildPackagePayload(packageData)
    };
    
    console.log('🚀 Sending package creation request:', JSON.stringify(payload, null, 2));
    
    const response = await api.post('/api/v1/packages', payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000 // Increased timeout for collection/fragile packages
    });
    
    console.log('✅ Package creation response:', response.data);
    
    if (response.data.success !== false) {
      const packageResponse = response.data.data || response.data;
      
      return {
        id: packageResponse.id,
        code: packageResponse.code,
        tracking_code: packageResponse.code || packageResponse.tracking_code,
        delivery_type: packageResponse.delivery_type,
        cost: packageResponse.cost,
        state: packageResponse.state,
        message: response.data.message || `${packageData.delivery_type.charAt(0).toUpperCase() + packageData.delivery_type.slice(1)} package created successfully`,
        package: packageResponse
      };
    } else {
      throw new Error(response.data.message || 'Failed to create package');
    }
    
  } catch (error: any) {
    console.error('❌ Package creation failed:', error);
    console.error('❌ Error response:', error.response?.data);
    
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        (error.response?.data?.errors ? error.response.data.errors.join(', ') : null) ||
                        error.message || 
                        'Failed to create package';
    throw new Error(errorMessage);
  }
};

/**
 * Enhanced package data validation for all delivery types
 */
function validatePackageData(packageData: PackageData): void {
  const errors: string[] = [];
  
  // Core validations
  if (!packageData.receiver_name?.trim()) {
    errors.push('Receiver name is required');
  }
  
  if (!packageData.receiver_phone?.trim()) {
    errors.push('Receiver phone is required');
  }
  
  if (!packageData.delivery_type) {
    errors.push('Delivery type is required');
  }
  
  // Delivery type-specific validations
  switch (packageData.delivery_type) {
    case 'agent':
      if (!packageData.destination_agent_id) {
        errors.push('Destination agent is required for agent delivery');
      }
      break;
      
    case 'doorstep':
      if (!packageData.delivery_location?.trim()) {
        errors.push('Delivery location is required for doorstep delivery');
      }
      break;
      
    case 'fragile':
      if (!packageData.delivery_location?.trim()) {
        errors.push('Delivery location is required for fragile delivery');
      }
      // Fragile packages should have special handling enabled
      packageData.special_handling = true;
      break;
      
    case 'collection':
      if (!packageData.shop_name?.trim()) {
        errors.push('Shop name is required for collection service');
      }
      if (!packageData.collection_address?.trim()) {
        errors.push('Collection address is required for collection service');
      }
      if (!packageData.items_to_collect?.trim()) {
        errors.push('Items to collect description is required');
      }
      if (!packageData.delivery_location?.trim()) {
        errors.push('Delivery location is required for collection service');
      }
      break;
      
    case 'express':
      if (!packageData.delivery_location?.trim()) {
        errors.push('Delivery location is required for express delivery');
      }
      // Express packages get high priority
      packageData.priority_level = 'high';
      break;
      
    case 'bulk':
      // Bulk packages have fewer requirements
      if (!packageData.destination_agent_id && !packageData.delivery_location?.trim()) {
        errors.push('Either destination agent or delivery location is required for bulk packages');
      }
      break;
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
}

/**
 * Build comprehensive package payload for API
 */
function buildPackagePayload(packageData: PackageData): any {
  const payload: any = {
    // Core package information
    sender_name: packageData.sender_name || 'Current User',
    sender_phone: packageData.sender_phone || '+254700000000',
    receiver_name: packageData.receiver_name.trim(),
    receiver_phone: packageData.receiver_phone.trim(),
    delivery_type: packageData.delivery_type,
    
    // Location information
    origin_agent_id: packageData.origin_agent_id || null,
    destination_agent_id: packageData.destination_agent_id || null,
    destination_area_id: packageData.destination_area_id || null,
    delivery_location: packageData.delivery_location?.trim() || null,
    
    // Enhanced fields
    special_instructions: packageData.special_instructions?.trim() || null,
    special_handling: packageData.special_handling || false,
    payment_method: packageData.payment_method || 'mpesa',
    requires_payment_advance: packageData.requires_payment_advance || false,
  };
  
  // Add optional contact information
  if (packageData.sender_email?.trim()) {
    payload.sender_email = packageData.sender_email.trim();
  }
  
  if (packageData.receiver_email?.trim()) {
    payload.receiver_email = packageData.receiver_email.trim();
  }
  
  if (packageData.business_name?.trim()) {
    payload.business_name = packageData.business_name.trim();
  }
  
  // Add collection-specific fields for collection delivery type
  if (packageData.delivery_type === 'collection') {
    payload.shop_name = packageData.shop_name?.trim();
    payload.shop_contact = packageData.shop_contact?.trim() || null;
    payload.collection_address = packageData.collection_address?.trim();
    payload.items_to_collect = packageData.items_to_collect?.trim();
    payload.item_value = packageData.item_value || 0;
    payload.item_description = packageData.item_description?.trim() || packageData.items_to_collect?.trim();
    payload.collection_type = packageData.collection_type || 'shop_pickup';
  }
  
  // Add coordinates if available
  if (packageData.pickup_latitude && packageData.pickup_longitude) {
    payload.pickup_latitude = packageData.pickup_latitude;
    payload.pickup_longitude = packageData.pickup_longitude;
  }
  
  if (packageData.delivery_latitude && packageData.delivery_longitude) {
    payload.delivery_latitude = packageData.delivery_latitude;
    payload.delivery_longitude = packageData.delivery_longitude;
  }
  
  // Handle legacy coordinate format
  if (packageData.coordinates?.pickup) {
    payload.pickup_latitude = packageData.coordinates.pickup.latitude;
    payload.pickup_longitude = packageData.coordinates.pickup.longitude;
  }
  
  if (packageData.coordinates?.delivery) {
    payload.delivery_latitude = packageData.coordinates.delivery.latitude;
    payload.delivery_longitude = packageData.coordinates.delivery.longitude;
  }
  
  // Add timing fields if provided
  if (packageData.payment_deadline) {
    payload.payment_deadline = packageData.payment_deadline;
  }
  
  if (packageData.collection_scheduled_at) {
    payload.collection_scheduled_at = packageData.collection_scheduled_at;
  }
  
  return payload;
}

/**
 * Get package pricing with delivery type support
 */
export const getPackagePricing = async (
  originId: string, 
  destinationId: string, 
  deliveryType: DeliveryType = 'agent'
): Promise<{ cost: number; breakdown?: any }> => {
  try {
    const response = await api.get(`/api/v1/packages/pricing`, {
      params: {
        origin_area_id: originId,
        destination_area_id: destinationId,
        delivery_type: deliveryType
      }
    });
    
    return response.data.data || { cost: DELIVERY_TYPE_INFO[deliveryType].base_cost };
    
  } catch (error: any) {
    console.warn('Failed to get pricing, using base cost:', error.message);
    // Return base cost from delivery type info as fallback
    return { cost: DELIVERY_TYPE_INFO[deliveryType].base_cost };
  }
};

/**
 * Get available delivery types from API
 */
export const getDeliveryTypes = async (): Promise<any[]> => {
  try {
    const response = await api.get('/api/v1/packages/delivery_types');
    return response.data.data || Object.entries(DELIVERY_TYPE_INFO).map(([key, info]) => ({
      delivery_type: key,
      prefix: key.toUpperCase().substring(0, 3),
      ...info
    }));
  } catch (error) {
    console.warn('Failed to fetch delivery types from API, using local data');
    return Object.entries(DELIVERY_TYPE_INFO).map(([key, info]) => ({
      delivery_type: key,
      prefix: key.toUpperCase().substring(0, 3),
      ...info
    }));
  }
};

// ==========================================
// EXISTING FUNCTIONS (Updated for compatibility)
// ==========================================

/**
 * Get locations from API
 */
export const getLocations = async (): Promise<Location[]> => {
  try {
    console.log('📍 Fetching locations...');
    const response = await api.get('/api/v1/locations');
    
    let transformedLocations: Location[] = [];
    
    if (response.data.success && response.data.data) {
      const locationsData = Array.isArray(response.data.data) ? 
        response.data.data : [response.data.data];
      transformedLocations = locationsData.map((item: any) => transformLocationData(item));
    } else if (Array.isArray(response.data)) {
      transformedLocations = response.data.map((item: any) => transformLocationData(item));
    } else {
      console.warn('⚠️ Unexpected locations API response format:', response.data);
    }
    
    console.log('✅ Locations loaded:', transformedLocations.length);
    return transformedLocations;
    
  } catch (error: any) {
    console.error('❌ Failed to fetch locations:', error);
    console.log('⚠️ Continuing without locations data');
    return [];
  }
};

/**
 * Get areas from API
 */
export const getAreas = async (): Promise<Area[]> => {
  try {
    console.log('🏢 Fetching areas...');
    const response = await api.get('/api/v1/areas');
    
    let transformedAreas: Area[] = [];
    
    if (response.data.success && response.data.data) {
      const areasData = Array.isArray(response.data.data) ? 
        response.data.data : [response.data.data];
      transformedAreas = areasData.map((item: any) => transformAreaData(item));
    } else if (Array.isArray(response.data)) {
      transformedAreas = response.data.map((item: any) => transformAreaData(item));
    } else {
      console.warn('⚠️ Unexpected areas API response format:', response.data);
      return [];
    }
    
    console.log('✅ Areas loaded:', transformedAreas.length);
    return transformedAreas;
    
  } catch (error: any) {
    console.error('❌ Failed to fetch areas:', error);
    throw new Error(`Failed to load areas: ${error.message}`);
  }
};

/**
 * Get agents from API
 */
export const getAgents = async (): Promise<Agent[]> => {
  try {
    console.log('👥 Fetching agents...');
    const response = await api.get('/api/v1/agents');
    
    let transformedAgents: Agent[] = [];
    
    if (response.data.success && response.data.data) {
      const agentsData = Array.isArray(response.data.data) ? 
        response.data.data : [response.data.data];
      transformedAgents = agentsData.map((item: any) => transformAgentData(item));
    } else if (Array.isArray(response.data)) {
      transformedAgents = response.data.map((item: any) => transformAgentData(item));
    } else {
      console.warn('⚠️ Unexpected agents API response format:', response.data);
      return [];
    }
    
    console.log('✅ Agents loaded:', transformedAgents.length);
    return transformedAgents;
    
  } catch (error: any) {
    console.error('❌ Failed to fetch agents:', error);
    throw new Error(`Failed to load agents: ${error.message}`);
  }
};

// ==========================================
// TRANSFORMATION FUNCTIONS
// ==========================================

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
      name: locationData.name || 'Unknown Location',
      initials: locationData.initials || undefined,
      code: locationData.code || undefined,
      abbreviation: locationData.abbreviation || undefined
    };
    
  } catch (error) {
    console.error('Error transforming location data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || rawData.attributes?.name || 'Unknown Location'
    };
  }
};

const transformAreaData = (rawData: any): Area => {
  try {
    let areaData = rawData;
    
    // Handle JSON:API format
    if (rawData.attributes) {
      areaData = {
        id: rawData.id,
        ...rawData.attributes
      };
    }
    
    return {
      id: String(areaData.id || ''),
      name: areaData.name || 'Unknown Area',
      location_id: areaData.location_id ? String(areaData.location_id) : undefined,
      location: areaData.location ? transformLocationData(areaData.location) : undefined
    };
    
  } catch (error) {
    console.error('Error transforming area data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || rawData.attributes?.name || 'Unknown Area'
    };
  }
};

const transformAgentData = (rawData: any): Agent => {
  try {
    let agentData = rawData;
    
    // Handle JSON:API format
    if (rawData.attributes) {
      agentData = {
        id: rawData.id,
        ...rawData.attributes
      };
    }
    
    return {
      id: String(agentData.id || ''),
      name: agentData.name || 'Unknown Agent',
      phone: agentData.phone || undefined,
      area_id: agentData.area_id ? String(agentData.area_id) : undefined,
      area: agentData.area ? transformAreaData(agentData.area) : undefined
    };
    
  } catch (error) {
    console.error('Error transforming agent data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || rawData.attributes?.name || 'Unknown Agent'
    };
  }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export const validatePackageFormData = (data: any): ValidationResult => {
  const issues: string[] = [];
  
  try {
    if (!data || typeof data !== 'object') {
      issues.push('Data is not a valid object');
      return { isValid: false, issues };
    }
    
    // Check areas (required)
    if (!data.areas || !Array.isArray(data.areas)) {
      issues.push('Areas must be a non-empty array');
    } else if (data.areas.length === 0) {
      issues.push('At least one area is required');
    }
    
    // Check agents (required)
    if (!data.agents || !Array.isArray(data.agents)) {
      issues.push('Agents must be a non-empty array');
    } else if (data.agents.length === 0) {
      issues.push('At least one agent is required');
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
 * Get packages with enhanced filtering
 */
export const getPackages = async (filters?: PackageFilters): Promise<PackageResponse> => {
  try {
    console.log('📦 Fetching packages with filters:', filters);
    
    const params = new URLSearchParams();
    
    if (filters?.state) {
      const apiState = STATE_MAPPING[filters.state as keyof typeof STATE_MAPPING];
      if (apiState) params.append('state', apiState);
    }
    
    if (filters?.delivery_type) {
      params.append('delivery_type', filters.delivery_type);
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
    
    const response = await api.get(url);
    
    if (response.data.success !== false) {
      const packagesData = response.data.data || [];
      const transformedPackages = packagesData.map((pkg: any) => transformPackageData(pkg));
      
      return {
        success: true,
        data: transformedPackages,
        meta: response.data.meta
      };
    } else {
      throw new Error(response.data.message || 'Failed to fetch packages');
    }
    
  } catch (error: any) {
    console.error('❌ Failed to fetch packages:', error);
    throw new Error(`Failed to load packages: ${error.message}`);
  }
};

const transformPackageData = (rawData: any): PackageInfo => {
  try {
    return {
      id: String(rawData.id || ''),
      code: rawData.code || rawData.tracking_code || '',
      tracking_code: rawData.code || rawData.tracking_code || '',
      state: rawData.state || 'unknown',
      state_display: rawData.state_display || getStateDisplay(rawData.state || ''),
      sender_name: rawData.sender_name || 'Unknown Sender',
      receiver_name: rawData.receiver_name || 'Unknown Receiver',
      receiver_phone: rawData.receiver_phone || '',
      route_description: rawData.route_description || 'Route information unavailable',
      cost: Number(rawData.cost) || 0,
      delivery_type: rawData.delivery_type || 'agent',
      delivery_type_display: rawData.delivery_type_display || DELIVERY_TYPE_INFO[rawData.delivery_type as DeliveryType]?.name || rawData.delivery_type,
      priority_level: rawData.priority_level || 'normal',
      created_at: rawData.created_at || new Date().toISOString(),
      updated_at: rawData.updated_at || rawData.created_at || new Date().toISOString(),
      
      // Enhanced fields
      origin_area: rawData.origin_area,
      destination_area: rawData.destination_area,
      origin_agent: rawData.origin_agent,
      destination_agent: rawData.destination_agent,
      delivery_location: rawData.delivery_location,
      is_fragile: rawData.is_fragile || rawData.delivery_type === 'fragile',
      is_collection: rawData.is_collection || rawData.delivery_type === 'collection',
      requires_special_handling: rawData.requires_special_handling || false,
      collection_details: rawData.collection_details,
      handling_instructions: rawData.handling_instructions || [],
      special_instructions: rawData.special_instructions,
      pickup_coordinates: rawData.pickup_coordinates,
      delivery_coordinates: rawData.delivery_coordinates,
      
      // Additional compatibility fields
      sender_phone: rawData.sender_phone,
      sender_email: rawData.sender_email,
      receiver_email: rawData.receiver_email,
      business_name: rawData.business_name,
      display_identifier: rawData.display_identifier,
      tracking_url: rawData.tracking_url
    };
    
  } catch (error) {
    console.error('Error transforming package data:', error, rawData);
    throw new Error('Failed to transform package data');
  }
};

// State display helpers
export const getStateDisplay = (state: string): string => {
  const stateMap = {
    'pending_unpaid': 'Pending Payment',
    'pending': 'Processing',
    'submitted': 'Ready for Pickup',
    'in_transit': 'In Transit',
    'delivered': 'Delivered',
    'collected': 'Collected',
    'rejected': 'Cancelled'
  };
  
  return stateMap[state as keyof typeof stateMap] || state;
};

export const getStateColor = (state: string): string => {
  const colorMap = {
    'pending_unpaid': '#f59e0b',
    'pending': '#3b82f6',
    'submitted': '#8b5cf6',
    'in_transit': '#06b6d4',
    'delivered': '#10b981',
    'collected': '#059669',
    'rejected': '#ef4444'
  };
  
  return colorMap[state as keyof typeof colorMap] || '#6b7280';
};

// Additional utility functions for compatibility
export const getAgentsForArea = (agents: Agent[], areaId: string): Agent[] => {
  return agents.filter(agent => agent.area_id === areaId);
};

export const searchAreas = (areas: Area[], query: string): Area[] => {
  if (!query.trim()) return areas;
  const lowercaseQuery = query.toLowerCase();
  return areas.filter(area => 
    area.name.toLowerCase().includes(lowercaseQuery) ||
    area.location?.name.toLowerCase().includes(lowercaseQuery)
  );
};

export const searchAgents = (agents: Agent[], query: string): Agent[] => {
  if (!query.trim()) return agents;
  const lowercaseQuery = query.toLowerCase();
  return agents.filter(agent => 
    agent.name.toLowerCase().includes(lowercaseQuery) ||
    agent.area?.name.toLowerCase().includes(lowercaseQuery)
  );
};

// Cache management (placeholder functions for future implementation)
export const clearCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      'package_modal_locations',
      'package_modal_areas', 
      'package_modal_agents',
      'package_modal_last_updated'
    ]);
    console.log('✅ Package helpers cache cleared');
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
  }
};

// Default export with all functions
export default {
  // Enhanced main functions
  getPackageFormData,
  validatePackageFormData,
  createPackage,
  getPackagePricing,
  getDeliveryTypes,
  
  // Core data functions
  getLocations,
  getAreas,
  getAgents,
  
  // Package functions
  getPackages,
  
  // Utility functions
  getAgentsForArea,
  searchAreas,
  searchAgents,
  clearCache,
  getStateDisplay,
  getStateColor,
  
  // Constants
  DELIVERY_TYPE_INFO,
  STATE_MAPPING
};
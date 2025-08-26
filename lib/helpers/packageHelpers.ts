// lib/helpers/packageHelpers.ts - Complete alignment with PackageCreationModal requirements
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==========================================
// TYPE DEFINITIONS FOR PACKAGE CREATION MODAL
// ==========================================

// Core data types expected by PackageCreationModal
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
  initials?: string;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  area_id?: string;
  area?: Area;
}

// CRITICAL: PackageData interface exactly as expected by PackageCreationModal
export interface PackageData {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_agent_id: string;
  destination_agent_id?: string; // Optional for doorstep delivery
  destination_area_id?: string;  // Optional, can be derived from agent
  delivery_type: 'doorstep' | 'agent'; // Only these two types for standard modal
  delivery_location?: string; // Required for doorstep delivery
  
  // Optional extended fields for enhanced delivery types (fragile, collection)
  sender_email?: string;
  receiver_email?: string;
  business_name?: string;
  special_instructions?: string;
  special_handling?: boolean;
  priority_level?: 'normal' | 'high' | 'urgent';
  payment_method?: 'mpesa' | 'card' | 'cash';
  requires_payment_advance?: boolean;
  
  // Collection-specific fields (for CollectDeliverModal)
  shop_name?: string;
  shop_contact?: string;
  collection_address?: string;
  items_to_collect?: string;
  item_value?: number;
  item_description?: string;
  collection_type?: 'shop_pickup' | 'office_pickup' | 'custom_location';
  
  // Coordinates for mapping
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  
  // Timing fields
  payment_deadline?: string;
  collection_scheduled_at?: string;
  
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
    payment_method?: string;
  };
}

// Form data structure expected by PackageCreationModal
export interface PackageFormData {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}

// Validation result for form data validation
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

// Extended delivery types for all modals
export type DeliveryType = 'doorstep' | 'agent' | 'fragile' | 'collection' | 'express' | 'bulk';
export type PaymentMethod = 'mpesa' | 'card' | 'cash';

// Package interface for tracking and display
export interface Package {
  id: string | number;
  code: string;
  tracking_code?: string;
  state: string;
  state_display: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone: string;
  route_description: string;
  cost: number;
  delivery_type: string;
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
  
  // Contact information
  sender_phone?: string;
  sender_email?: string;
  receiver_email?: string;
  business_name?: string;
  
  // Enhanced flags
  is_fragile?: boolean;
  is_collection?: boolean;
  requires_special_handling?: boolean;
  
  // Collection details (for collection delivery type)
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
  handling_instructions?: string[] | string;
  special_instructions?: string;
  
  // Coordinates
  pickup_coordinates?: { latitude: number; longitude: number; };
  delivery_coordinates?: { latitude: number; longitude: number; };
  
  // Compatibility fields for track.tsx getReceiverName function
  recipient_name?: string;
  receiver?: { name: string };
  recipient?: { name: string };
  to_name?: string;
  from_location?: string;
  to_location?: string;
  
  // Additional tracking fields
  display_identifier?: string;
  tracking_url?: string;
}

// QR Code response interface
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

// Package response interfaces
export interface PackageResponse {
  data: Package[];
  pagination?: {
    total_count: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  success: boolean;
  message?: string;
}

export interface PackageFilters {
  state?: string;
  delivery_type?: DeliveryType;
  search?: string;
  page?: number;
  per_page?: number;
}

// Drawer state types for track.tsx
export type DrawerState = 
  | 'pending' 
  | 'paid' 
  | 'submitted' 
  | 'in-transit' 
  | 'delivered' 
  | 'collected' 
  | 'rejected';

// ==========================================
// CONSTANTS AND MAPPINGS
// ==========================================

// State mapping for drawer navigation
export const STATE_MAPPING: Record<DrawerState, string> = {
  'pending': 'pending_unpaid',
  'paid': 'pending', 
  'submitted': 'submitted',
  'in-transit': 'in_transit',
  'delivered': 'delivered',
  'collected': 'collected',
  'rejected': 'rejected'
};

// Enhanced delivery type information
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

// ==========================================
// CORE DATA LOADING FUNCTIONS (Required by PackageCreationModal)
// ==========================================

// Cache variables for performance
let areasCache: Area[] | null = null;
let agentsCache: Agent[] | null = null;
let locationsCache: Location[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * CRITICAL: Get all package form data - Main function used by PackageCreationModal
 */
export const getPackageFormData = async (): Promise<PackageFormData> => {
  try {
    console.log('📦 Starting getPackageFormData for PackageCreationModal...');
    
    // Check if we have valid cached data
    const now = Date.now();
    const isCacheValid = cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION;
    
    if (isCacheValid && locationsCache && areasCache && agentsCache) {
      console.log('✅ Returning cached package form data:', {
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
    
    console.log('🌐 Fetching fresh package form data from API...');
    
    // Fetch all required data in parallel
    const [locationsResult, areasResult, agentsResult] = await Promise.allSettled([
      getLocations(),
      getAreas(),
      getAgents()
    ]);
    
    // Handle locations (optional)
    let locations: Location[] = [];
    if (locationsResult.status === 'fulfilled') {
      locations = locationsResult.value;
      console.log('✅ Locations loaded:', locations.length);
    } else {
      console.warn('⚠️ Locations failed to load, continuing without:', locationsResult.reason?.message);
      locations = [];
    }
    
    // Handle areas (required)
    let areas: Area[] = [];
    if (areasResult.status === 'fulfilled') {
      areas = areasResult.value;
      console.log('✅ Areas loaded:', areas.length);
    } else {
      console.error('❌ Areas failed to load:', areasResult.reason?.message);
      throw new Error(`Failed to load areas: ${areasResult.reason?.message || 'Unknown error'}`);
    }
    
    // Handle agents (required)
    let agents: Agent[] = [];
    if (agentsResult.status === 'fulfilled') {
      agents = agentsResult.value;
      console.log('✅ Agents loaded:', agents.length);
    } else {
      console.error('❌ Agents failed to load:', agentsResult.reason?.message);
      throw new Error(`Failed to load agents: ${agentsResult.reason?.message || 'Unknown error'}`);
    }
    
    // Validate we have the minimum required data
    if (areas.length === 0) {
      throw new Error('No areas available - cannot create packages without areas');
    }
    
    if (agents.length === 0) {
      throw new Error('No agents available - cannot create packages without agents');
    }
    
    // Update cache
    locationsCache = locations;
    areasCache = areas;
    agentsCache = agents;
    cacheTimestamp = now;
    
    const formData = {
      locations,
      areas,
      agents
    };
    
    console.log('✅ Package form data loaded successfully:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length
    });
    
    return formData;
    
  } catch (error: any) {
    console.error('❌ Failed to get package form data:', error);
    throw new Error(`Failed to load form data: ${error.message}`);
  }
};

/**
 * Validate package form data structure - Used by PackageCreationModal
 */
export const validatePackageFormData = (data: any): ValidationResult => {
  const issues: string[] = [];
  
  try {
    if (!data || typeof data !== 'object') {
      issues.push('Data is not a valid object');
      return { isValid: false, issues };
    }
    
    // Check locations (optional but should be array if present)
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
    
    // Check areas (required)
    if (!data.areas || !Array.isArray(data.areas)) {
      issues.push('Areas must be a non-empty array');
    } else if (data.areas.length === 0) {
      issues.push('At least one area is required');
    } else {
      data.areas.forEach((area: any, index: number) => {
        if (!area.id || !area.name) {
          issues.push(`Area ${index} missing required fields (id, name)`);
        }
      });
    }
    
    // Check agents (required)
    if (!data.agents || !Array.isArray(data.agents)) {
      issues.push('Agents must be a non-empty array');
    } else if (data.agents.length === 0) {
      issues.push('At least one agent is required');
    } else {
      data.agents.forEach((agent: any, index: number) => {
        if (!agent.id || !agent.name) {
          issues.push(`Agent ${index} missing required fields (id, name)`);
        }
      });
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
 * Get package pricing - Used by PackageCreationModal for cost calculation
 */
export const getPackagePricing = async (
  originId: string, 
  destinationId: string, 
  deliveryType: string = 'agent'
): Promise<{ cost: number; breakdown?: any }> => {
  try {
    console.log('💰 Getting package pricing:', { originId, destinationId, deliveryType });
    
    const response = await api.get(`/api/v1/packages/pricing`, {
      params: {
        origin_area_id: originId,
        destination_area_id: destinationId,
        delivery_type: deliveryType
      },
      timeout: 10000
    });
    
    if (response.data.success !== false) {
      const pricingData = response.data.data || response.data;
      console.log('✅ Pricing loaded:', pricingData);
      return pricingData;
    } else {
      throw new Error(response.data.message || 'Failed to get pricing');
    }
    
  } catch (error: any) {
    console.warn('⚠️ Failed to get pricing from API, using base cost:', error.message);
    
    // Return base cost from delivery type info as fallback
    const typeInfo = DELIVERY_TYPE_INFO[deliveryType as keyof typeof DELIVERY_TYPE_INFO];
    const baseCost = typeInfo?.base_cost || 150;
    
    return { 
      cost: baseCost,
      breakdown: {
        base_cost: baseCost,
        delivery_type: deliveryType,
        note: 'Fallback pricing due to API error'
      }
    };
  }
};

/**
 * Create package - Main function used by PackageCreationModal
 */
export const createPackage = async (packageData: PackageData): Promise<any> => {
  try {
    console.log('📦 Creating package via PackageCreationModal:', packageData.delivery_type);
    console.log('📦 Package data:', JSON.stringify(packageData, null, 2));
    
    // Validate package data
    validatePackageCreationData(packageData);
    
    // Build API payload
    const payload = {
      package: buildPackagePayload(packageData)
    };
    
    console.log('🚀 Sending package creation request:', JSON.stringify(payload, null, 2));
    
    const response = await api.post('/api/v1/packages', payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
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
        package: transformPackageData(packageResponse)
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

// ==========================================
// DATA LOADING FUNCTIONS
// ==========================================

/**
 * Get locations from API
 */
export const getLocations = async (): Promise<Location[]> => {
  try {
    console.log('📍 Fetching locations...');
    const response = await api.get('/api/v1/locations', {
      timeout: 15000
    });
    
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
    // Return empty array instead of throwing - locations are optional
    return [];
  }
};

/**
 * Get areas from API
 */
export const getAreas = async (): Promise<Area[]> => {
  try {
    console.log('🏢 Fetching areas...');
    const response = await api.get('/api/v1/areas', {
      timeout: 15000
    });
    
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
    const response = await api.get('/api/v1/agents', {
      timeout: 15000
    });
    
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
// PACKAGE TRACKING FUNCTIONS (For track.tsx compatibility)
// ==========================================

/**
 * Get package details by code
 */
export const getPackageDetails = async (packageCode: string): Promise<Package> => {
  try {
    console.log('📦 Fetching package details for code:', packageCode);
    
    const response = await api.get(`/api/v1/packages/${packageCode}`, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data.success !== false) {
      const packageData = response.data.data || response.data;
      const transformedPackage = transformPackageData(packageData);
      
      console.log('✅ Package details loaded:', transformedPackage.code);
      return transformedPackage;
    } else {
      throw new Error(response.data.message || 'Package not found');
    }
    
  } catch (error: any) {
    console.error('❌ Failed to fetch package details:', error);
    
    if (error.response?.status === 404) {
      throw new Error(`Package ${packageCode} not found`);
    }
    
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        'Failed to load package details';
    throw new Error(errorMessage);
  }
};

/**
 * Get package QR code
 */
export const getPackageQRCode = async (packageCode: string): Promise<QRCodeResponse> => {
  try {
    console.log('📱 Fetching QR code for package:', packageCode);
    
    const response = await api.get(`/api/v1/packages/${packageCode}/qr_code`, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.data.success !== false) {
      console.log('✅ QR code loaded for package:', packageCode);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } else {
      throw new Error(response.data.message || 'Failed to generate QR code');
    }
    
  } catch (error: any) {
    console.warn('⚠️ Failed to fetch QR code:', error);
    
    // Return fallback QR data structure
    return {
      success: false,
      data: {
        qr_code_base64: null,
        tracking_url: `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/track/${packageCode}`,
        package_code: packageCode,
        package_state: 'unknown',
        route_description: 'Unable to load route information'
      },
      message: error.response?.data?.message || error.message || 'Failed to load QR code'
    };
  }
};

/**
 * Get packages with filtering
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
    
    const response = await api.get(url, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data.success !== false) {
      const packagesData = response.data.data || [];
      const transformedPackages = packagesData.map((pkg: any) => transformPackageData(pkg));
      
      console.log('✅ Packages loaded:', transformedPackages.length);
      
      return {
        success: true,
        data: transformedPackages,
        pagination: response.data.meta || response.data.pagination
      };
    } else {
      throw new Error(response.data.message || 'Failed to fetch packages');
    }
    
  } catch (error: any) {
    console.error('❌ Failed to fetch packages:', error);
    throw new Error(`Failed to load packages: ${error.message}`);
  }
};

// ==========================================
// DATA TRANSFORMATION FUNCTIONS
// ==========================================

const transformLocationData = (rawData: any): Location => {
  try {
    let locationData = rawData;
    
    if (rawData.attributes) {
      locationData = { id: rawData.id, ...rawData.attributes };
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
      name: rawData.name || 'Unknown Location'
    };
  }
};

const transformAreaData = (rawData: any): Area => {
  try {
    let areaData = rawData;
    
    if (rawData.attributes) {
      areaData = { id: rawData.id, ...rawData.attributes };
    }
    
    return {
      id: String(areaData.id || ''),
      name: areaData.name || 'Unknown Area',
      location_id: areaData.location_id ? String(areaData.location_id) : undefined,
      location: areaData.location ? transformLocationData(areaData.location) : undefined,
      initials: areaData.initials || undefined
    };
    
  } catch (error) {
    console.error('Error transforming area data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || 'Unknown Area'
    };
  }
};

const transformAgentData = (rawData: any): Agent => {
  try {
    let agentData = rawData;
    
    if (rawData.attributes) {
      agentData = { id: rawData.id, ...rawData.attributes };
    }
    
    return {
      id: String(agentData.id || ''),
      name: agentData.name || 'Unknown Agent',
      phone: agentData.phone || '',
      area_id: agentData.area_id ? String(agentData.area_id) : undefined,
      area: agentData.area ? transformAreaData(agentData.area) : undefined
    };
    
  } catch (error) {
    console.error('Error transforming agent data:', error, rawData);
    return {
      id: String(rawData.id || 'unknown'),
      name: rawData.name || 'Unknown Agent',
      phone: ''
    };
  }
};

const transformPackageData = (rawData: any): Package => {
  try {
    const pkg: Package = {
      id: rawData.id || '',
      code: rawData.code || rawData.tracking_code || '',
      tracking_code: rawData.code || rawData.tracking_code || '',
      state: rawData.state || 'unknown',
      state_display: rawData.state_display || getStateDisplay(rawData.state || ''),
      sender_name: rawData.sender_name || 'Unknown Sender',
      receiver_name: rawData.receiver_name || 'Unknown Receiver',
      receiver_phone: rawData.receiver_phone || '',
      route_description: rawData.route_description || formatRouteDescription(rawData.origin_area, rawData.destination_area),
      cost: Number(rawData.cost) || 0,
      delivery_type: rawData.delivery_type || 'agent',
      delivery_type_display: rawData.delivery_type_display || DELIVERY_TYPE_INFO[rawData.delivery_type as keyof typeof DELIVERY_TYPE_INFO]?.name || rawData.delivery_type,
      priority_level: rawData.priority_level || 'normal',
      created_at: rawData.created_at || new Date().toISOString(),
      updated_at: rawData.updated_at || rawData.created_at || new Date().toISOString(),
      
      // Location information
      origin_area: rawData.origin_area,
      destination_area: rawData.destination_area,
      origin_agent: rawData.origin_agent,
      destination_agent: rawData.destination_agent,
      delivery_location: rawData.delivery_location,
      
      // Contact information
      sender_phone: rawData.sender_phone,
      sender_email: rawData.sender_email,
      receiver_email: rawData.receiver_email,
      business_name: rawData.business_name,
      
      // Enhanced flags
      is_fragile: rawData.is_fragile || rawData.delivery_type === 'fragile',
      is_collection: rawData.is_collection || rawData.delivery_type === 'collection',
      requires_special_handling: rawData.requires_special_handling || false,
      
      // Collection details
      collection_details: rawData.collection_details,
      
      // Handling information
      handling_instructions: rawData.handling_instructions || [],
      special_instructions: rawData.special_instructions,
      
      // Coordinates
      pickup_coordinates: rawData.pickup_coordinates,
      delivery_coordinates: rawData.delivery_coordinates,
      
      // Compatibility fields for track.tsx getReceiverName function
      recipient_name: rawData.receiver_name || rawData.recipient_name,
      receiver: rawData.receiver || (rawData.receiver_name ? { name: rawData.receiver_name } : undefined),
      recipient: rawData.recipient || (rawData.receiver_name ? { name: rawData.receiver_name } : undefined),
      to_name: rawData.to_name || rawData.receiver_name,
      from_location: rawData.from_location || rawData.origin_area?.name,
      to_location: rawData.to_location || rawData.destination_area?.name,
      
      // Additional tracking fields
      display_identifier: rawData.display_identifier,
      tracking_url: rawData.tracking_url
    };
    
    return pkg;
    
  } catch (error) {
    console.error('Error transforming package data:', error, rawData);
    throw new Error('Failed to transform package data');
  }
};

// ==========================================
// VALIDATION AND PAYLOAD BUILDING
// ==========================================

function validatePackageCreationData(packageData: PackageData): void {
  const errors: string[] = [];
  
  // Core validations for PackageCreationModal
  if (!packageData.receiver_name?.trim()) {
    errors.push('Receiver name is required');
  }
  
  if (!packageData.receiver_phone?.trim()) {
    errors.push('Receiver phone is required');
  }
  
  if (!packageData.delivery_type) {
    errors.push('Delivery type is required');
  }
  
  if (!packageData.origin_agent_id?.trim()) {
    errors.push('Origin agent is required');
  }
  
  // Delivery type-specific validations for PackageCreationModal
  if (packageData.delivery_type === 'agent') {
    if (!packageData.destination_agent_id?.trim()) {
      errors.push('Destination agent is required for agent delivery');
    }
  } else if (packageData.delivery_type === 'doorstep') {
    if (!packageData.delivery_location?.trim()) {
      errors.push('Delivery location is required for doorstep delivery');
    }
  }
  
  // Extended validation for other delivery types
  if (packageData.delivery_type === 'fragile') {
    if (!packageData.delivery_location?.trim()) {
      errors.push('Delivery location is required for fragile delivery');
    }
    packageData.special_handling = true;
  }
  
  if (packageData.delivery_type === 'collection') {
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
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
}

function buildPackagePayload(packageData: PackageData): any {
  const payload: any = {
    sender_name: packageData.sender_name || 'Current User',
    sender_phone: packageData.sender_phone || '+254700000000',
    receiver_name: packageData.receiver_name.trim(),
    receiver_phone: packageData.receiver_phone.trim(),
    delivery_type: packageData.delivery_type,
    origin_agent_id: packageData.origin_agent_id,
    destination_agent_id: packageData.destination_agent_id || null,
    destination_area_id: packageData.destination_area_id || null,
    delivery_location: packageData.delivery_location?.trim() || null,
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
  
  // Add collection-specific fields
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

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

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
  
  return stateMap[state as keyof typeof stateMap] || state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const getStateColor = (state: string): string => {
  const colorMap = {
    'pending_unpaid': '#f59e0b',
    'pending': '#10b981',
    'submitted': '#3b82f6',
    'in_transit': '#8b5cf6',
    'delivered': '#059669',
    'collected': '#0d9488',
    'rejected': '#ef4444'
  };
  
  return colorMap[state as keyof typeof colorMap] || '#6b7280';
};

export const formatRouteDescription = (originArea?: Area, destinationArea?: Area): string => {
  if (!originArea && !destinationArea) return 'Route information unavailable';
  
  const origin = originArea ? `${originArea.name}${originArea.location?.name ? `, ${originArea.location.name}` : ''}` : 'Unknown Origin';
  const destination = destinationArea ? `${destinationArea.name}${destinationArea.location?.name ? `, ${destinationArea.location.name}` : ''}` : 'Unknown Destination';
  
  return `${origin} → ${destination}`;
};

// Package state utility functions for track.tsx
export const canEditPackage = (state: string): boolean => {
  return ['pending_unpaid', 'pending'].includes(state);
};

export const needsPayment = (state: string): boolean => {
  return state === 'pending_unpaid';
};

export const isValidPackageState = (state: string): boolean => {
  const validStates = ['pending_unpaid', 'pending', 'submitted', 'in_transit', 'delivered', 'collected', 'rejected'];
  return validStates.includes(state);
};

export const getNextValidStates = (currentState: string): string[] => {
  const stateTransitions = {
    'pending_unpaid': ['pending'],
    'pending': ['submitted'],
    'submitted': ['in_transit'],
    'in_transit': ['delivered'],
    'delivered': ['collected'],
    'collected': [],
    'rejected': []
  };
  
  return stateTransitions[currentState as keyof typeof stateTransitions] || [];
};

// Additional helper functions for modal compatibility
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

export const getAreaById = (areas: Area[], id: string): Area | undefined => {
  return areas.find(area => area.id === id);
};

export const getAgentById = (agents: Agent[], id: string): Agent | undefined => {
  return agents.find(agent => agent.id === id);
};

export const getPackagesByState = async (state: DrawerState): Promise<PackageResponse> => {
  return getPackages({ state });
};

export const searchPackages = async (searchQuery: string): Promise<PackageResponse> => {
  return getPackages({ search: searchQuery });
};

export const clearCache = async (): Promise<void> => {
  try {
    // Clear memory cache
    areasCache = null;
    agentsCache = null;
    locationsCache = null;
    cacheTimestamp = 0;
    
    // Clear AsyncStorage cache
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

// Default export with all functions for compatibility
export default {
  // Core functions required by PackageCreationModal
  getPackageFormData,
  validatePackageFormData,
  getPackagePricing,
  createPackage,
  
  // Data loading functions
  getLocations,
  getAreas,
  getAgents,
  
  // Package tracking functions for track.tsx
  getPackageDetails,
  getPackageQRCode,
  getPackages,
  getPackagesByState,
  searchPackages,
  
  // Utility functions
  canEditPackage,
  needsPayment,
  isValidPackageState,
  getStateDisplay,
  getStateColor,
  getNextValidStates,
  formatRouteDescription,
  getAgentsForArea,
  searchAreas,
  searchAgents,
  getAreaById,
  getAgentById,
  clearCache,
  
  // Constants
  DELIVERY_TYPE_INFO,
  STATE_MAPPING
};
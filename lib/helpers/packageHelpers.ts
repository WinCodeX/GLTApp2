import api from '../api';

export interface PackageData {
  // Core package fields
  sender_name?: string;
  sender_phone?: string;
  receiver_name: string;
  receiver_phone: string;
  delivery_type: 'doorstep' | 'agent' | 'fragile' | 'collection';
  delivery_location?: string;
  
  // Optional agent fields
  origin_agent_id?: string | number; // Optional origin agent
  destination_agent_id?: string | number;
  destination_area_id?: string | number;
  
  // Collection service specific fields
  shop_name?: string;
  shop_contact?: string;
  collection_address?: string;
  items_to_collect?: string;
  item_value?: number;
  
  // Additional optional fields
  item_description?: string;
  special_instructions?: string;
  payment_method?: 'mpesa' | 'card' | 'cash' | 'bank_transfer';
  payment_status?: string;
  payment_reference?: string;
  priority_level?: 'low' | 'normal' | 'high' | 'urgent';
  special_handling?: boolean;
  requires_payment_advance?: boolean;
  collection_type?: 'pickup_only' | 'pickup_and_deliver' | 'express_collection';
  
  // Location coordinates
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  
  // Timestamps
  payment_deadline?: string;
  collection_scheduled_at?: string;
  collected_at?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

export interface AppDataResponse {
  success: boolean;
  data?: {
    locations?: any[];
    areas?: any[];
    agents?: any[];
  };
  message?: string;
  error?: string;
}

/**
 * Validate app initialization data
 */
export const validateAppData = (data: any): ValidationResult => {
  const issues: string[] = [];
  
  try {
    if (!data) {
      issues.push('No data provided');
      return { isValid: false, issues };
    }
    
    // Check locations (optional now)
    if (data.locations && Array.isArray(data.locations)) {
      if (data.locations.length === 0) {
        issues.push('No locations available');
      } else {
        data.locations.forEach((location: any, index: number) => {
          if (!location.id || !location.name) {
            issues.push(`Location ${index} missing required fields (id, name)`);
          }
        });
      }
    }
    
    // Check areas (optional now)
    if (data.areas && Array.isArray(data.areas)) {
      if (data.areas.length === 0) {
        issues.push('No areas available');
      } else {
        data.areas.forEach((area: any, index: number) => {
          if (!area.id || !area.name) {
            issues.push(`Area ${index} missing required fields (id, name)`);
          }
        });
      }
    }
    
    // Check agents (optional now)
    if (data.agents && Array.isArray(data.agents)) {
      if (data.agents.length === 0) {
        issues.push('No agents available');
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
 * Create a new package - UPDATED: Origin agent is optional
 */
export const createPackage = async (packageData: PackageData): Promise<any> => {
  try {
    console.log('📦 Creating package with data:', packageData);
    
    // Validate required fields
    if (!packageData.receiver_name?.trim()) {
      throw new Error('Receiver name is required');
    }
    
    if (!packageData.receiver_phone?.trim()) {
      throw new Error('Receiver phone is required');
    }
    
    if (!packageData.delivery_type) {
      throw new Error('Delivery type is required');
    }
    
    // Validate delivery-specific requirements
    if (packageData.delivery_type === 'agent' && !packageData.destination_agent_id) {
      throw new Error('Destination agent is required for agent delivery');
    }
    
    if ((packageData.delivery_type === 'doorstep' || packageData.delivery_type === 'fragile' || packageData.delivery_type === 'collection') && !packageData.delivery_location?.trim()) {
      throw new Error('Delivery location is required for doorstep/fragile/collection delivery');
    }
    
    // Validate collection-specific requirements
    if (packageData.delivery_type === 'collection') {
      if (!packageData.shop_name?.trim()) {
        throw new Error('Shop name is required for collection services');
      }
      if (!packageData.collection_address?.trim()) {
        throw new Error('Collection address is required for collection services');
      }
      if (!packageData.items_to_collect?.trim()) {
        throw new Error('Items to collect must be specified for collection services');
      }
      if (!packageData.item_value || packageData.item_value <= 0) {
        throw new Error('Item value must be specified and greater than 0 for collection services');
      }
    }
    
    // Prepare API payload - UPDATED: Origin agent is optional
    const payload = {
      package: {
        sender_name: packageData.sender_name || 'GLT Customer',
        sender_phone: packageData.sender_phone || '+254700000000',
        receiver_name: packageData.receiver_name.trim(),
        receiver_phone: packageData.receiver_phone.trim(),
        origin_agent_id: packageData.origin_agent_id || null, // Optional
        destination_agent_id: packageData.destination_agent_id || null,
        destination_area_id: packageData.destination_area_id || null,
        delivery_type: packageData.delivery_type,
        delivery_location: packageData.delivery_location?.trim() || null,
        
        // Collection service fields
        shop_name: packageData.shop_name?.trim() || null,
        shop_contact: packageData.shop_contact?.trim() || null,
        collection_address: packageData.collection_address?.trim() || null,
        items_to_collect: packageData.items_to_collect?.trim() || null,
        item_value: packageData.item_value || null,
        
        // Additional optional fields
        item_description: packageData.item_description?.trim() || null,
        special_instructions: packageData.special_instructions?.trim() || null,
        payment_method: packageData.payment_method || 'mpesa',
        priority_level: packageData.priority_level || 'normal',
        special_handling: packageData.special_handling || false,
        requires_payment_advance: packageData.requires_payment_advance || false,
        collection_type: packageData.collection_type || null,
        
        // Location coordinates
        pickup_latitude: packageData.pickup_latitude || null,
        pickup_longitude: packageData.pickup_longitude || null,
        delivery_latitude: packageData.delivery_latitude || null,
        delivery_longitude: packageData.delivery_longitude || null,
        
        // Timestamps
        payment_deadline: packageData.payment_deadline || null,
        collection_scheduled_at: packageData.collection_scheduled_at || null,
      }
    };
    
    console.log('🚀 Sending package creation request:', payload);
    
    const response = await api.post('/api/v1/packages', payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    
    console.log('✅ Package creation response:', response.data);
    
    if (response.data.success !== false) {
      const packageResponse = response.data.data || response.data;
      
      return {
        id: packageResponse.id,
        tracking_code: packageResponse.code || packageResponse.tracking_code,
        message: response.data.message || 'Package created successfully'
      };
    } else {
      throw new Error(response.data.message || 'Failed to create package');
    }
  } catch (error: any) {
    console.error('❌ Package creation failed:', error);
    
    if (error.response?.data) {
      const errorData = error.response.data;
      const errorMessage = errorData.message || 'Package creation failed';
      const validationErrors = errorData.errors || [];
      
      console.error('Server error details:', {
        message: errorMessage,
        errors: validationErrors,
        status: error.response.status
      });
      
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      } else {
        throw new Error(errorMessage);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your internet connection and try again.');
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('Network error. Please try again.');
    }
  }
};

/**
 * Fetch app initialization data
 */
export const fetchAppData = async (): Promise<AppDataResponse> => {
  try {
    console.log('🔄 Fetching app data...');
    
    const response = await api.get('/api/v1/app_data', {
      headers: {
        'Accept': 'application/json',
      },
      timeout: 15000
    });
    
    console.log('✅ App data response:', response.data);
    
    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message || 'Failed to fetch app data');
    }
    
  } catch (error: any) {
    console.error('❌ App data fetch failed:', error);
    
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your internet connection.');
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('Network error while fetching app data');
    }
  }
};

/**
 * Get package tracking information
 */
export const getPackageTracking = async (trackingCode: string): Promise<any> => {
  try {
    console.log('📍 Fetching tracking for:', trackingCode);
    
    const response = await api.get(`/api/v1/packages/${trackingCode}/tracking`, {
      headers: {
        'Accept': 'application/json',
      },
      timeout: 10000
    });
    
    console.log('✅ Tracking response:', response.data);
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Failed to get tracking information');
    }
    
  } catch (error: any) {
    console.error('❌ Tracking fetch failed:', error);
    
    if (error.response?.status === 404) {
      throw new Error('Package not found. Please check the tracking code.');
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please try again.');
    } else {
      throw new Error('Failed to get tracking information');
    }
  }
};

/**
 * Calculate estimated delivery cost - UPDATED: Works without origin agent
 */
export const calculateDeliveryCost = (packageData: Partial<PackageData>): number => {
  let baseCost = 0;
  
  // Base cost by delivery type
  switch (packageData.delivery_type) {
    case 'fragile':
      baseCost = 300; // Premium for fragile handling
      break;
    case 'collection':
      baseCost = 250; // Collection service base cost
      break;
    case 'agent':
      baseCost = 150; // Standard agent delivery
      break;
    case 'doorstep':
    default:
      baseCost = 200; // Standard doorstep delivery
      break;
  }
  
  // Add collection service cost
  if (packageData.delivery_type === 'collection' || packageData.collection_type === 'pickup_and_deliver') {
    baseCost += 150; // Additional cost for collection service
  }
  
  // Priority level surcharge
  switch (packageData.priority_level) {
    case 'high':
      baseCost += 50;
      break;
    case 'urgent':
      baseCost += 100;
      break;
  }
  
  // Special handling surcharge
  if (packageData.special_handling) {
    baseCost += 75;
  }
  
  // Value-based surcharge for high-value items
  if (packageData.item_value && packageData.item_value > 10000) {
    baseCost += Math.min(packageData.item_value * 0.01, 200); // 1% of value, max 200 KSH
  }
  
  return baseCost;
};

/**
 * Format phone number to standard Kenyan format
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('254')) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0')) {
    return `+254${cleaned.slice(1)}`;
  } else if (cleaned.length === 9) {
    return `+254${cleaned}`;
  }
  
  return phone; // Return as-is if format not recognized
};

/**
 * Validate phone number format
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const formatted = formatPhoneNumber(phone);
  return /^\+254[7][0-9]{8}$/.test(formatted);
};

/**
 * Generate a unique package reference for client-side tracking
 */
export const generatePackageReference = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `PKG-${timestamp}-${random}`.toUpperCase();
};



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
  // Additional fields your track screen might expect
  recipient_name?: string;
  receiver?: { name: string };
  recipient?: { name: string };
  to_name?: string;
  from_location?: string;
  to_location?: string;
}

// ADDED: Package creation data interface
export interface PackageData {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_area_id: string;
  destination_area_id: string;
  origin_agent_id: string;
  destination_agent_id: string;
  delivery_type: string;
  delivery_location?: string;
}

// ADDED: Form data interface for the modal
export interface PackageFormData {
  locations: Location[];
  areas: Area[];
  agents: Agent[];
}

// ADDED: Validation result interface
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
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
let locationsCache: Location[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * MAIN MISSING FUNCTION: Get all package form data required by the modal
 * This is the function your modal is looking for!
 */
export const getPackageFormData = async (): Promise<PackageFormData> => {
  try {
    console.log('📦 Starting getPackageFormData...');
    
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
    
    // Handle locations
    let locations: Location[] = [];
    if (locationsResult.status === 'fulfilled') {
      locations = locationsResult.value;
      console.log('✅ Locations loaded:', locations.length);
    } else {
      console.error('❌ Failed to load locations:', locationsResult.reason);
      // Don't throw here, continue with empty array
    }
    
    // Handle areas
    let areas: Area[] = [];
    if (areasResult.status === 'fulfilled') {
      areas = areasResult.value;
      console.log('✅ Areas loaded:', areas.length);
    } else {
      console.error('❌ Failed to load areas:', areasResult.reason);
      throw new Error('Failed to load areas - required for package creation');
    }
    
    // Handle agents
    let agents: Agent[] = [];
    if (agentsResult.status === 'fulfilled') {
      agents = agentsResult.value;
      console.log('✅ Agents loaded:', agents.length);
    } else {
      console.error('❌ Failed to load agents:', agentsResult.reason);
      throw new Error('Failed to load agents - required for package creation');
    }
    
    // Validate minimum required data
    if (areas.length === 0) {
      throw new Error('No areas available - cannot create packages');
    }
    
    if (agents.length === 0) {
      throw new Error('No agents available - cannot create packages');
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
    
    console.log('✅ Package form data assembled successfully:', {
      locations: locations.length,
      areas: areas.length,
      agents: agents.length
    });
    
    return formData;
    
  } catch (error: any) {
    console.error('❌ getPackageFormData failed:', error);
    
    // Try to return cached data if available, even if stale
    if (locationsCache && areasCache && agentsCache) {
      console.log('📋 Returning stale cached data as fallback...');
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
 * ADDED: Get all locations (this might be missing too)
 */
export const getLocations = async (): Promise<Location[]> => {
  try {
    console.log('🌍 Fetching locations from API...');
    
    const response = await api.get('/api/v1/locations', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    let transformedLocations: Location[] = [];
    
    if (response.data.data) {
      const locationsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
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
    console.log('⚠️ Continuing without locations data');
    return [];
  }
};

/**
 * ADDED: Transform location data from API response
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
 * ADDED: Validate package form data structure
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
 * ADDED: Create a new package
 */


/**
 * ADDED: Get package pricing estimation
 */
export const getPackagePricing = async (originAreaId: string, destinationAreaId: string, deliveryType: string): Promise<number> => {
  try {
    console.log('💰 Calculating package pricing...');
    
    const params = new URLSearchParams({
      origin_area_id: originAreaId,
      destination_area_id: destinationAreaId,
      delivery_type: deliveryType
    });
    
    const response = await api.get(`/api/v1/packages/pricing?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.data.success !== false && response.data.cost) {
      return Number(response.data.cost);
    } else {
      throw new Error('Pricing not available');
    }
    
  } catch (error: any) {
    console.warn('⚠️ API pricing failed, using fallback calculation:', error.message);
    
    // Fallback to client-side calculation
    return calculateFallbackPricing(originAreaId, destinationAreaId, deliveryType);
  }
};

/**
 * ADDED: Fallback pricing calculation
 */
const calculateFallbackPricing = (originAreaId: string, destinationAreaId: string, deliveryType: string): number => {
  // Simple fallback pricing logic
  const isSameArea = originAreaId === destinationAreaId;
  
  if (deliveryType === 'fragile') {
    return isSameArea ? 350 : 580;
  } else if (deliveryType === 'agent') {
    return isSameArea ? 120 : 180;
  } else {
    return isSameArea ? 250 : 380;
  }
};

/**
 * EXISTING FUNCTIONS (keeping all your current functions)
 */

/**
 * Get detailed package information by package code
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
 * Get QR code for package tracking
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
 * Transform package data from API response
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
 * Get packages with optional filtering
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
 * Data transformation with better error handling
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

// Additional helper functions for package management
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
  locationsCache = null;
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
    const [locations, areas, agents] = await Promise.allSettled([
      getLocations(),
      getAreas(),
      getAgents()
    ]);
    
    console.log('✅ Package helpers data refresh complete:', {
      locations: locations.status === 'fulfilled' ? locations.value.length : 'failed',
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
  // NEW MAIN FUNCTIONS
  getPackageFormData,
  validatePackageFormData,
  getPackagePricing,
  getLocations,
  
  // EXISTING FUNCTIONS
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
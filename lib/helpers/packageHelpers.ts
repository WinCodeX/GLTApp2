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
import api from '../api';

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
  business_id?: string | null;
  package_size?: string;
  special_instructions?: string;
  delivery_location?: string;
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
  business_id?: string | null;
}

export async function createPackage(packageData: PackageData): Promise<PackageResponse> {
  try {
    console.log('📦 Creating package...');
    console.log('📦 Package data:', packageData);
    
    const response = await api.post('/api/v1/packages', {
      package: {
        ...packageData,
        // Ensure business_id is included if provided
        ...(packageData.business_id && { business_id: packageData.business_id }),
        ...(packageData.package_size && { package_size: packageData.package_size }),
        ...(packageData.special_instructions && { special_instructions: packageData.special_instructions }),
        ...(packageData.delivery_location && { delivery_location: packageData.delivery_location })
      }
    });
    
    console.log('📦 Package creation response:', response.data);
    
    const packageResponse = response.data.package || response.data;
    return packageResponse;
  } catch (error: any) {
    console.error('❌ Error creating package:', error);
    console.error('❌ Error response:', error.response?.data);
    
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        'Failed to create package';
    throw new Error(errorMessage);
  }
}
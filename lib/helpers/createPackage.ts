// lib/helpers/createPackage.ts
import { getBaseUrl } from './getBaseUrl';

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
}

export interface PackageResponse {
  id: string;
  tracking_code: string;
  cost: number;
  state: string;
  created_at: string;
  // Add other fields as needed
}

export async function createPackage(packageData: PackageData): Promise<PackageResponse> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        package: packageData
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.package || data;
  } catch (error) {
    console.error('Error creating package:', error);
    throw error;
  }
}

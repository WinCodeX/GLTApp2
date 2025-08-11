import api from '../api';

export interface Location {
  id: string;
  name: string;
  initials: string;
  created_at: string;
  updated_at: string;
}

export async function getLocations(): Promise<Location[]> {
  try {
    console.log('📍 Fetching locations...');
    const response = await api.get('/api/v1/locations');
    console.log('📍 Locations response:', response.data);
    
    // Handle different response formats
    const locations = response.data.locations || response.data || [];
    console.log('📍 Parsed locations:', locations);
    
    return locations;
  } catch (error: any) {
    console.error('❌ Error fetching locations:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch locations: ${error.message}`);
  }
}
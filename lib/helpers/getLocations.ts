// lib/helpers/getLocations.ts - FIXED
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
    console.log('📍 Raw locations response:', response.data);
    
    // Handle the new response structure with serializers
    if (response.data.success && response.data.locations) {
      const locations = response.data.locations;
      console.log('📍 Parsed locations:', locations.length, 'items');
      
      if (locations.length > 0) {
        console.log('📍 Sample location:', locations[0]);
      }
      
      return locations;
    }
    
    // Fallback for old response format
    const locations = response.data.locations || response.data || [];
    console.log('📍 Fallback parsed locations:', locations.length, 'items');
    
    return locations;
  } catch (error: any) {
    console.error('❌ Error fetching locations:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch locations: ${error.message}`);
  }
}
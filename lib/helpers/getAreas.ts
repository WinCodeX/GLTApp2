// lib/helpers/getAreas.ts - FIXED
import api from '../api';

export interface Area {
  id: string;
  name: string;
  initials: string;
  location_id: string;
  location: {
    id: string;
    name: string;
    initials: string;
  };
  created_at: string;
  updated_at: string;
}

export async function getAreas(): Promise<Area[]> {
  try {
    console.log('🏢 Fetching areas...');
    const response = await api.get('/api/v1/areas');
    console.log('🏢 Raw areas response:', response.data);
    
    // Handle the new response structure with serializers
    if (response.data.success && response.data.areas) {
      const areas = response.data.areas;
      console.log('🏢 Parsed areas:', areas.length, 'items');
      
      if (areas.length > 0) {
        console.log('🏢 Sample area:', areas[0]);
      }
      
      return areas;
    }
    
    // Fallback for old response format
    const areas = response.data.areas || response.data || [];
    console.log('🏢 Fallback parsed areas:', areas.length, 'items');
    
    return areas;
  } catch (error: any) {
    console.error('❌ Error fetching areas:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch areas: ${error.message}`);
  }
}
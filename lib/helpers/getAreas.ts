import { api } from '../api';

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
    console.log('🏢 Areas response:', response.data);
    
    // Handle different response formats
    const areas = response.data.areas || response.data || [];
    console.log('🏢 Parsed areas:', areas);
    
    return areas;
  } catch (error: any) {
    console.error('❌ Error fetching areas:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch areas: ${error.message}`);
  }
}
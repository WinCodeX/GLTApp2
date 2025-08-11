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
    console.log('🏢 Raw FastJSON response:', response.data);
    
    // Parse FastJSON API format
    if (response.data.data) {
      const areasData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      const included = response.data.included || [];
      
      const areas = areasData.map(item => {
        // Find the related location from included data
        let location = null;
        if (item.relationships?.location?.data) {
          const locationRef = item.relationships.location.data;
          const includedLocation = included.find(inc => 
            inc.type === 'location' && inc.id === locationRef.id
          );
          
          if (includedLocation) {
            location = {
              id: includedLocation.id,
              name: includedLocation.attributes.name,
              initials: includedLocation.attributes.initials
            };
          }
        }
        
        return {
          id: item.id,
          name: item.attributes.name,
          initials: item.attributes.initials,
          location_id: item.attributes.location_id,
          location: location || { id: '', name: '', initials: '' },
          created_at: item.attributes.created_at,
          updated_at: item.attributes.updated_at
        };
      });
      
      console.log('🏢 Parsed areas:', areas.length, 'items');
      if (areas.length > 0) {
        console.log('🏢 Sample area:', areas[0]);
      }
      
      return areas;
    }
    
    console.warn('🏢 Unexpected response format:', response.data);
    return [];
    
  } catch (error: any) {
    console.error('❌ Error fetching areas:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch areas: ${error.message}`);
  }
}

// lib/helpers/getLocations.ts - UPDATED for FastJSON
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
    console.log('📍 Raw FastJSON response:', response.data);
    
    // Parse FastJSON API format
    if (response.data.data) {
      const locationsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      
      const locations = locationsData.map(item => ({
        id: item.id,
        name: item.attributes.name,
        initials: item.attributes.initials,
        created_at: item.attributes.created_at,
        updated_at: item.attributes.updated_at
      }));
      
      console.log('📍 Parsed locations:', locations.length, 'items');
      if (locations.length > 0) {
        console.log('📍 Sample location:', locations[0]);
      }
      
      return locations;
    }
    
    console.warn('📍 Unexpected response format:', response.data);
    return [];
    
  } catch (error: any) {
    console.error('❌ Error fetching locations:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch locations: ${error.message}`);
  }
}

// lib/helpers/getAreas.ts - UPDATED for FastJSON
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

// lib/helpers/getAgents.ts - UPDATED for FastJSON
import api from '../api';

export interface Agent {
  id: string;
  name: string;
  phone: string;
  area_id: string;
  user_id: string;
  active: boolean;
  area: {
    id: string;
    name: string;
    initials: string;
    location_id: string;
    location: {
      id: string;
      name: string;
      initials: string;
    };
  };
  created_at: string;
  updated_at: string;
}

export async function getAgents(): Promise<Agent[]> {
  try {
    console.log('👥 Fetching agents...');
    const response = await api.get('/api/v1/agents');
    console.log('👥 Raw FastJSON response:', response.data);
    
    // Parse FastJSON API format
    if (response.data.data) {
      const agentsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      const included = response.data.included || [];
      
      const agents = agentsData.map(item => {
        // Find the related area from included data
        let area = null;
        if (item.relationships?.area?.data) {
          const areaRef = item.relationships.area.data;
          const includedArea = included.find(inc => 
            inc.type === 'area' && inc.id === areaRef.id
          );
          
          if (includedArea) {
            // Find the location for this area
            let location = null;
            if (includedArea.relationships?.location?.data) {
              const locationRef = includedArea.relationships.location.data;
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
            
            area = {
              id: includedArea.id,
              name: includedArea.attributes.name,
              initials: includedArea.attributes.initials,
              location_id: includedArea.attributes.location_id,
              location: location || { id: '', name: '', initials: '' }
            };
          }
        }
        
        return {
          id: item.id,
          name: item.attributes.name,
          phone: item.attributes.phone,
          area_id: item.attributes.area_id,
          user_id: item.attributes.user_id || '',
          active: item.attributes.active !== undefined ? item.attributes.active : true,
          area: area || {
            id: '',
            name: '',
            initials: '',
            location_id: '',
            location: { id: '', name: '', initials: '' }
          },
          created_at: item.attributes.created_at,
          updated_at: item.attributes.updated_at
        };
      });
      
      console.log('👥 Parsed agents:', agents.length, 'items');
      if (agents.length > 0) {
        console.log('👥 Sample agent:', agents[0]);
      }
      
      return agents;
    }
    
    console.warn('👥 Unexpected response format:', response.data);
    return [];
    
  } catch (error: any) {
    console.error('❌ Error fetching agents:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }
}

// lib/helpers/getPackagePricing.ts - NO CHANGES NEEDED (already works)
import api from '../api';

export interface PricingRequest {
  origin_area_id: string;
  destination_area_id: string;
  delivery_type: 'doorstep' | 'agent' | 'mixed';
}

export interface PricingResponse {
  cost: number;
  delivery_type: string;
  route_type: 'intra_area' | 'intra_location' | 'inter_location';
  origin_area: string;
  destination_area: string;
}

export async function getPackagePricing(request: PricingRequest): Promise<PricingResponse> {
  try {
    console.log('💰 Fetching pricing...');
    console.log('💰 Pricing request:', request);
    
    const response = await api.get('/api/v1/pricing', {
      params: {
        origin_area_id: request.origin_area_id,
        destination_area_id: request.destination_area_id,
        delivery_type: request.delivery_type,
      }
    });
    
    console.log('💰 Pricing response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Error fetching pricing:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch pricing: ${error.message}`);
  }
}
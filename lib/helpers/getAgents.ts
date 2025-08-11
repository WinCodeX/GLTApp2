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
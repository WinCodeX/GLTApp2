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
    console.log('👥 Agents response:', response.data);
    
    // Handle different response formats
    const agents = response.data.agents || response.data || [];
    console.log('👥 Parsed agents:', agents);
    
    return agents;
  } catch (error: any) {
    console.error('❌ Error fetching agents:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }
}
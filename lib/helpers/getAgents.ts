// lib/helpers/getAgents.ts - FIXED
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
    console.log('👥 Raw agents response:', response.data);
    
    // Handle the new response structure with serializers
    if (response.data.success && response.data.agents) {
      const agents = response.data.agents;
      console.log('👥 Parsed agents:', agents.length, 'items');
      
      if (agents.length > 0) {
        console.log('👥 Sample agent:', agents[0]);
      }
      
      return agents;
    }
    
    // Fallback for old response format
    const agents = response.data.agents || response.data || [];
    console.log('👥 Fallback parsed agents:', agents.length, 'items');
    
    return agents;
  } catch (error: any) {
    console.error('❌ Error fetching agents:', error);
    console.error('❌ Error response:', error.response?.data);
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }
}
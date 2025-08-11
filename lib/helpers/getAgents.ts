// lib/helpers/getAgents.ts
import { getBaseUrl } from './getBaseUrl';

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
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/agents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.agents || data; // Handle different response formats
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw new Error('Failed to fetch agents');
  }
}
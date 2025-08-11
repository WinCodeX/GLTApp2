import { getBaseUrl } from './getBaseUrl';

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
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/areas`, {
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
    return data.areas || data; // Handle different response formats
  } catch (error) {
    console.error('Error fetching areas:', error);
    throw new Error('Failed to fetch areas');
  }
}

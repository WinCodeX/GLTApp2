// lib/helpers/getLocations.ts
import { getBaseUrl } from './getBaseUrl';

export interface Location {
  id: string;
  name: string;
  initials: string;
  created_at: string;
  updated_at: string;
}

export async function getLocations(): Promise<Location[]> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/locations`, {
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
    return data.locations || data; // Handle different response formats
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw new Error('Failed to fetch locations');
  }
}
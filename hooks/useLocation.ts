import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { apiService } from '../services/api';

export const useLocation = () => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address[0] 
          ? `${address[0].street}, ${address[0].city}, ${address[0].region}` 
          : 'Current Location',
        name: 'Current Location',
        description: 'Your current position',
      };

      setCurrentLocation(locationData);
      return locationData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation().catch(console.error);
  }, [getCurrentLocation]);

  return {
    currentLocation,
    isLoading,
    error,
    refreshLocation: getCurrentLocation,
  };
};
import { useState, useCallback, useRef } from 'react';

export const useLocationSearch = (currentLocation?: LocationData | null) => {
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Debounce search
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await apiService.searchLocations(query, currentLocation || undefined);
        setSearchResults(results);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        setSearchError(errorMessage);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, [currentLocation]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    searchLocations,
    clearSearch,
  };
};
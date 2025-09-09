// app/(drawer)/findus.tsx - Find Us screen with real agent API integration
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import colors from '../../theme/colors';
import { getFullAvatarUrl } from '../../lib/api';
import { getAgents, type Agent } from '../../lib/helpers/packageHelpers';

// Storage keys for caching
const STORAGE_KEYS = {
  AGENTS: 'findus_agents_cache',
  LAST_UPDATED: 'findus_cache_last_updated'
} as const;

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

// Extended Agent interface for future description support
interface ExtendedAgent extends Agent {
  description?: string;
  email?: string;
  avatar_url?: string;
  specialties?: string[];
}

type SortDirection = 'asc' | 'desc';

const FindUs: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [agents, setAgents] = useState<ExtendedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<ExtendedAgent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Sort configuration
  const [sortConfig, setSortConfig] = useState<{
    field: 'name' | 'location';
    direction: SortDirection;
  }>({
    field: 'name',
    direction: 'asc'
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  // Cache management
  const isCacheValid = useCallback(async (): Promise<boolean> => {
    try {
      const lastUpdated = await AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
      if (!lastUpdated) return false;
      
      const timeDiff = Date.now() - parseInt(lastUpdated);
      return timeDiff < CACHE_DURATION;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }, []);

  const loadFromCache = useCallback(async (): Promise<ExtendedAgent[] | null> => {
    try {
      const cachedAgents = await AsyncStorage.getItem(STORAGE_KEYS.AGENTS);
      if (!cachedAgents) return null;
      
      return JSON.parse(cachedAgents);
    } catch (error) {
      console.error('Error loading agents from cache:', error);
      return null;
    }
  }, []);

  const saveToCache = useCallback(async (agentsData: ExtendedAgent[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(agentsData)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString())
      ]);
      console.log('✅ FindUs agents cached successfully');
    } catch (error) {
      console.error('Error saving agents to cache:', error);
    }
  }, []);

  const fetchAgents = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setError(null);
      
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cacheValid = await isCacheValid();
        if (cacheValid) {
          const cachedAgents = await loadFromCache();
          if (cachedAgents && cachedAgents.length > 0) {
            console.log('📋 FindUs: Loading agents from cache');
            setAgents(cachedAgents);
            setLoading(false);
            return;
          }
        }
      }
      
      console.log('🌐 FindUs: Fetching agents from API...');
      
      // Fetch fresh data using the package helper
      const agentsData = await getAgents();
      
      console.log('📦 FindUs: Received agents:', {
        count: agentsData.length,
        sample: agentsData.length > 0 ? {
          id: agentsData[0].id,
          name: agentsData[0].name,
          active: agentsData[0].active,
          hasArea: !!agentsData[0].area,
          areaName: agentsData[0].area?.name,
          locationName: agentsData[0].area?.location?.name
        } : null
      });
      
      // Convert to ExtendedAgent format (add fields that might come from API in future)
      const extendedAgents: ExtendedAgent[] = agentsData.map(agent => ({
        ...agent,
        // Future fields - these would come from API when description is added to backend
        description: undefined,
        email: undefined, 
        avatar_url: undefined,
        specialties: undefined
      }));
      
      setAgents(extendedAgents);
      await saveToCache(extendedAgents);
      
      console.log('✅ FindUs: Agents loaded and cached successfully');
      
    } catch (error: any) {
      console.error('❌ FindUs: Error fetching agents:', error);
      setError(error.message || 'Failed to load agents');
      
      // Try to load from cache as fallback
      const cachedAgents = await loadFromCache();
      if (cachedAgents && cachedAgents.length > 0) {
        console.log('📋 FindUs: Using cached agents as fallback');
        setAgents(cachedAgents);
        setError(null);
        Toast.show({
          type: 'info',
          text1: 'Using Cached Data',
          text2: 'Showing previously loaded agents',
          position: 'top'
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to Load Agents',
          text2: error.message || 'Please check your connection',
          position: 'top'
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isCacheValid, loadFromCache, saveToCache]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAgents(true); // Force refresh
  }, [fetchAgents]);

  const handleAgentPress = useCallback((agent: ExtendedAgent) => {
    setSelectedAgent(agent);
    setModalVisible(true);
  }, []);

  const handleSortChange = useCallback((field: 'name' | 'location') => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Format location string from agent data
  const formatLocation = useCallback((agent: ExtendedAgent): string => {
    if (!agent.area) return 'Location not available';
    
    const parts = [];
    if (agent.area.name) parts.push(agent.area.name);
    if (agent.area.location?.name) parts.push(agent.area.location.name);
    
    return parts.length > 0 ? parts.join(', ') : 'Location not specified';
  }, []);

  // Filter and sort agents
  const filteredAndSortedAgents = React.useMemo(() => {
    let filtered = agents.filter(agent => {
      const searchLower = searchQuery.toLowerCase();
      const name = agent.name?.toLowerCase() || '';
      const areaName = agent.area?.name?.toLowerCase() || '';
      const locationName = agent.area?.location?.name?.toLowerCase() || '';
      
      return name.includes(searchLower) || 
             areaName.includes(searchLower) || 
             locationName.includes(searchLower);
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortConfig.field === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' });
      } else {
        const aLocation = a.area?.location?.name || '';
        const bLocation = b.area?.location?.name || '';
        comparison = aLocation.localeCompare(bLocation, 'en', { sensitivity: 'base' });
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [agents, searchQuery, sortConfig]);

  // Group agents by location for display
  const groupedAgents = React.useMemo(() => {
    if (sortConfig.field === 'name') {
      return [{
        locationName: 'All Agents',
        agents: filteredAndSortedAgents
      }];
    }
    
    const grouped = filteredAndSortedAgents.reduce((acc, agent) => {
      const locationName = agent.area?.location?.name || 'Unknown Location';
      
      if (!acc[locationName]) {
        acc[locationName] = [];
      }
      acc[locationName].push(agent);
      return acc;
    }, {} as Record<string, ExtendedAgent[]>);

    // Sort locations with "Unknown Location" at the end
    return Object.entries(grouped)
      .sort(([a], [b]) => {
        if (a === 'Unknown Location') return 1;
        if (b === 'Unknown Location') return -1;
        const comparison = a.localeCompare(b, 'en', { sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      })
      .map(([locationName, agents]) => ({
        locationName,
        agents: agents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' }))
      }));
  }, [filteredAndSortedAgents, sortConfig]);

  const renderSearchAndSortHeader = useCallback(() => (
    <View style={styles.searchAndSortContainer}>
      <View style={styles.searchInputContainer}>
        <Feather name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search agents by name, area, or location..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={16} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <View style={styles.sortButtons}>
          {(['name', 'location'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.sortButton,
                sortConfig.field === option && styles.activeSortButton
              ]}
              onPress={() => handleSortChange(option)}
            >
              <Text style={[
                styles.sortButtonText,
                sortConfig.field === option && styles.activeSortButtonText
              ]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
              {sortConfig.field === option && (
                <Feather 
                  name={sortConfig.direction === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={12} 
                  color="#7c3aed" 
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  ), [searchQuery, sortConfig, handleSortChange]);

  const renderAgentItem = useCallback(({ item }: { item: ExtendedAgent }) => {
    const locationText = formatLocation(item);
    const hasLocation = item.area && (item.area.name || item.area.location?.name);
    
    return (
      <TouchableOpacity
        style={[
          styles.agentCard,
          !item.active && styles.inactiveCard
        ]}
        onPress={() => handleAgentPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.agentHeader}>
          <View style={styles.avatarContainer}>
            {item.avatar_url ? (
              <Image
                source={{ uri: getFullAvatarUrl(item.avatar_url) }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {item.name?.substring(0, 2).toUpperCase() || 'AG'}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.agentInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.agentName}>{item.name || 'Unknown Agent'}</Text>
              {item.active ? (
                <View style={styles.activeIndicator}>
                  <Text style={styles.activeText}>Active</Text>
                </View>
              ) : (
                <View style={styles.inactiveIndicator}>
                  <Text style={styles.inactiveText}>Offline</Text>
                </View>
              )}
            </View>
            
            <View style={styles.locationRow}>
              <MaterialIcons 
                name="location-on" 
                size={16} 
                color={hasLocation ? '#7c3aed' : '#888'} 
              />
              <Text style={[
                styles.locationText,
                !hasLocation && styles.noLocationText
              ]}>
                {locationText}
              </Text>
            </View>
          </View>
          
          <Feather name="chevron-right" size={20} color="#888" />
        </View>
      </TouchableOpacity>
    );
  }, [formatLocation, handleAgentPress]);

  const renderGroupedAgents = useCallback(() => (
    <FlatList
      data={groupedAgents}
      keyExtractor={(item) => item.locationName}
      contentContainerStyle={styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
      renderItem={({ item: group }) => (
        <View>
          {/* Only show location header when sorting by location */}
          {sortConfig.field === 'location' && group.locationName !== 'All Agents' && (
            <View style={styles.locationHeader}>
              <Text style={styles.locationHeaderText}>{group.locationName}</Text>
              <Text style={styles.locationHeaderCount}>({group.agents.length})</Text>
            </View>
          )}
          
          <FlatList
            data={group.agents}
            keyExtractor={(agent) => agent.id}
            renderItem={renderAgentItem}
            scrollEnabled={false}
          />
        </View>
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="location-off" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No agents found' : 'No agents available'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? 'Try a different search term or clear the search'
                : 'We\'ll notify you when agents become available in your area'
              }
            </Text>
            {searchQuery && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearSearchButtonText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null
      }
    />
  ), [groupedAgents, sortConfig.field, refreshing, onRefresh, renderAgentItem, loading, error, searchQuery]);

  const renderErrorState = useCallback(() => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={64} color="#ef4444" />
      <Text style={styles.errorTitle}>Failed to Load Agents</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity onPress={() => fetchAgents(true)} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  ), [error, fetchAgents]);

  const renderLoadingState = useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading agents...</Text>
    </View>
  ), []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Header with back navigation */}
      <View style={[styles.navigationHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Us</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Our Agents</Text>
        <Text style={styles.subtitle}>
          {loading ? 'Loading...' : `${agents.length} agent${agents.length !== 1 ? 's' : ''} available`}
        </Text>
      </View>

      {loading ? renderLoadingState() : error ? renderErrorState() : (
        <>
          {renderSearchAndSortHeader()}
          {renderGroupedAgents()}
        </>
      )}

      {/* Agent Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agent Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedAgent && (
                <>
                  <View style={styles.modalAgentHeader}>
                    <View style={styles.modalAvatarContainer}>
                      {selectedAgent.avatar_url ? (
                        <Image
                          source={{ uri: getFullAvatarUrl(selectedAgent.avatar_url) }}
                          style={styles.modalAvatar}
                        />
                      ) : (
                        <View style={styles.modalAvatarPlaceholder}>
                          <Text style={styles.modalAvatarInitials}>
                            {selectedAgent.name?.substring(0, 2).toUpperCase() || 'AG'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalAgentName}>{selectedAgent.name || 'Unknown Agent'}</Text>
                    <View style={[
                      styles.statusBadge,
                      selectedAgent.active ? styles.activeBadge : styles.inactiveBadge
                    ]}>
                      <Text style={[
                        styles.statusText,
                        selectedAgent.active ? styles.activeStatusText : styles.inactiveStatusText
                      ]}>
                        {selectedAgent.active ? 'Active' : 'Offline'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Contact Information</Text>
                    {selectedAgent.email ? (
                      <View style={styles.contactItem}>
                        <Feather name="mail" size={18} color="#7c3aed" />
                        <Text style={styles.contactText}>{selectedAgent.email}</Text>
                      </View>
                    ) : (
                      <Text style={styles.noContactText}>No contact information available</Text>
                    )}
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Location & Area</Text>
                    <View style={styles.locationItem}>
                      <MaterialIcons name="location-on" size={18} color={colors.primary} />
                      <Text style={styles.locationDetailText}>
                        {formatLocation(selectedAgent)}
                      </Text>
                    </View>
                    {selectedAgent.area && (
                      <View style={styles.areaDetails}>
                        <Text style={styles.areaDetailLabel}>Area:</Text>
                        <Text style={styles.areaDetailText}>
                          {selectedAgent.area.name} ({selectedAgent.area.initials})
                        </Text>
                      </View>
                    )}
                  </View>

                  {selectedAgent.description && (
                    <View style={styles.modalSection}>
                      <Text style={styles.sectionTitle}>Description</Text>
                      <Text style={styles.descriptionText}>{selectedAgent.description}</Text>
                    </View>
                  )}

                  {selectedAgent.specialties && selectedAgent.specialties.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.sectionTitle}>Specialties</Text>
                      <View style={styles.modalSpecialties}>
                        {selectedAgent.specialties.map((specialty, index) => (
                          <View key={index} style={styles.modalSpecialtyTag}>
                            <Text style={styles.modalSpecialtyText}>{specialty}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Note about missing description */}
                  {!selectedAgent.description && (
                    <View style={styles.noDescriptionNote}>
                      <Feather name="info" size={16} color={colors.textSecondary} />
                      <Text style={styles.noDescriptionText}>
                        Agent description not available. Contact them directly for more information.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  // Navigation Header
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: colors.header,
    justifyContent: 'space-between',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 16,
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'System',
  },
  headerSpacer: {
    width: 28,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
  },
  
  // Search and Sort
  searchAndSortContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    minHeight: 44,
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 10,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortLabel: {
    fontSize: 14,
    color: '#ccc',
    fontWeight: '500',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  activeSortButton: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '500',
  },
  activeSortButtonText: {
    color: '#7c3aed',
    fontWeight: '600',
  },
  
  // Location Header
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  locationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
  },
  locationHeaderCount: {
    fontSize: 12,
    color: '#ccc',
  },
  
  // List
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  agentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inactiveCard: {
    opacity: 0.7,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  agentInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  activeIndicator: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  activeText: {
    fontSize: 10,
    color: '#22c55e',
    fontWeight: '600',
  },
  inactiveIndicator: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  inactiveText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 4,
    flex: 1,
  },
  noLocationText: {
    fontStyle: 'italic',
    color: '#888',
  },
  
  // Empty States
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ccc',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  clearSearchButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  clearSearchButtonText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
  },
  
  // Loading State
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 16,
  },
  
  // Error State
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalAgentHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalAvatarContainer: {
    marginBottom: 12,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  modalAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarInitials: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  modalAgentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  activeBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  inactiveBadge: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeStatusText: {
    color: '#22c55e',
  },
  inactiveStatusText: {
    color: '#9ca3af',
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 16,
    color: '#ccc',
    marginLeft: 12,
  },
  noContactText: {
    fontSize: 16,
    color: '#888',
    fontStyle: 'italic',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  locationDetailText: {
    fontSize: 16,
    color: '#ccc',
    marginLeft: 12,
    flex: 1,
  },
  areaDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  areaDetailLabel: {
    fontSize: 14,
    color: '#888',
    marginRight: 8,
  },
  areaDetailText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
  },
  modalSpecialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modalSpecialtyTag: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  modalSpecialtyText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '500',
  },
  noDescriptionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  noDescriptionText: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
});

export default FindUs;
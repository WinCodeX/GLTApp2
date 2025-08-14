// app/admin/PackageSearchScreen.tsx - Updated with proper API integration and role support
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import QRScanner from '../../components/QRScanner';
import AdminLayout from '../../components/AdminLayout';
import api from '../../lib/api';

const { width } = Dimensions.get('window');

interface Package {
  id: string;
  code: string;
  state: string;
  state_display: string;
  sender_name: string;
  receiver_name: string;
  receiver_phone: string;
  route_description: string;
  cost: number;
  delivery_type: string;
  created_at: string;
  available_actions?: AvailableAction[];
}

interface AvailableAction {
  action: string;
  label: string;
  description: string;
}

interface PackageSearchScreenProps {
  userRole?: 'client' | 'agent' | 'rider' | 'warehouse' | 'admin';
}

const PackageSearchScreen: React.FC<PackageSearchScreenProps> = ({
  userRole = 'agent',
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>(userRole);
  const [isOnline, setIsOnline] = useState(true);
  
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadUserRole();
    loadRecentSearches();
  }, []);

  const loadUserRole = async () => {
    try {
      const storedRole = await SecureStore.getItemAsync('user_role');
      if (storedRole) {
        setCurrentUserRole(storedRole);
      }
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const recent = await SecureStore.getItemAsync('recent_package_searches');
      if (recent) {
        setRecentSearches(JSON.parse(recent));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      setRecentSearches(updated);
      await SecureStore.setItemAsync('recent_package_searches', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  };

  const handleSearch = async (query: string = searchQuery) => {
    if (!query.trim()) {
      Toast.show({
        type: 'info', // Changed from 'warning' to 'info'
        text1: 'Search Required',
        text2: 'Please enter a package code to search',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    Keyboard.dismiss();

    try {
      console.log('🔍 Searching for packages with query:', query);
      
      // Check connectivity
      const response = await api.get('/api/v1/ping');
      setIsOnline(true);
      
      // Search packages using the API
      const searchResponse = await api.get(`/api/v1/packages/search?query=${encodeURIComponent(query.trim())}`);

      if (searchResponse.data.success) {
        const packages = searchResponse.data.data || [];
        setSearchResults(packages);
        
        // Save to recent searches
        await saveRecentSearch(query.trim());
        
        Toast.show({
          type: 'success',
          text1: 'Search Complete',
          text2: `Found ${packages.length} package${packages.length !== 1 ? 's' : ''}`,
          position: 'top',
          visibilityTime: 2000,
        });
      } else {
        setSearchResults([]);
        Toast.show({
          type: 'info', // Changed from 'warning' to 'info'
          text1: 'No Results',
          text2: searchResponse.data.message || 'No packages found matching your search',
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error: any) {
      console.error('❌ Search error:', error);
      setIsOnline(false);
      setSearchResults([]);
      
      let errorMessage = 'Search failed. Please try again.';
      if (error.message?.includes('Network Error') || error.message?.includes('timeout')) {
        errorMessage = 'Network error. Check your connection and try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Toast.show({
        type: 'error',
        text1: 'Search Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (result: any) => {
    const packageCode = result.package?.code || result.code || 'PKG-SCANNED-20240814';
    setSearchQuery(packageCode);
    setShowScanner(false);
    
    // Automatically search for the scanned package
    await handleSearch(packageCode);
  };

  const performPackageAction = async (packageObj: Package, action: string) => {
    try {
      Toast.show({
        type: 'info',
        text1: 'Processing Action',
        text2: `${action} for ${packageObj.code}...`,
        position: 'top',
        visibilityTime: 2000,
      });

      const response = await api.post('/api/v1/scanning/scan_action', {
        package_code: packageObj.code,
        action_type: action,
        metadata: {
          source: 'package_search',
          timestamp: new Date().toISOString()
        }
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Action Successful',
          text2: response.data.message,
          position: 'top',
          visibilityTime: 3000,
        });
        
        // Refresh the search results
        await handleSearch(searchQuery);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Action Failed',
          text2: response.data.message,
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error: any) {
      console.error('Action error:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to perform action. Please try again.';
      
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  const navigateToPackageDetails = (packageCode: string) => {
    router.push(`/admin/PackageDetailsScreen?code=${packageCode}`);
  };

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'pending_unpaid':
        return '#FF3B30';
      case 'pending':
        return '#FF9500';
      case 'submitted':
        return '#667eea';
      case 'in_transit':
        return '#764ba2';
      case 'delivered':
        return '#34C759';
      case 'collected':
        return '#34C759';
      default:
        return '#a0aec0';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'collect':
        return '#667eea';
      case 'deliver':
        return '#34C759';
      case 'print':
        return '#FF9500';
      case 'confirm_receipt':
        return '#764ba2';
      case 'process':
        return '#9C27B0';
      default:
        return '#667eea';
    }
  };

  const getActionIcon = (action: string): keyof typeof MaterialIcons.glyphMap => {
    switch (action) {
      case 'collect':
        return 'local-shipping';
      case 'deliver':
        return 'check-circle';
      case 'print':
        return 'print';
      case 'confirm_receipt':
        return 'done-all';
      case 'process':
        return 'inventory';
      default:
        return 'check';
    }
  };

  const canPerformActions = (): boolean => {
    return ['agent', 'rider', 'warehouse', 'admin'].includes(currentUserRole);
  };

  const renderPackageItem = ({ item }: { item: Package }) => (
    <View style={styles.packageItem}>
      <TouchableOpacity
        style={styles.packageHeader}
        onPress={() => navigateToPackageDetails(item.code)}
      >
        <View style={styles.packageInfo}>
          <Text style={styles.packageCode}>{item.code}</Text>
          <LinearGradient
            colors={[getStateColor(item.state), getStateColor(item.state) + '80']}
            style={styles.stateBadge}
          >
            <Text style={styles.stateText}>{item.state_display}</Text>
          </LinearGradient>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />
      </TouchableOpacity>

      <View style={styles.packageDetails}>
        <Text style={styles.routeText}>{item.route_description}</Text>
        <Text style={styles.detailText}>From: {item.sender_name}</Text>
        <Text style={styles.detailText}>To: {item.receiver_name}</Text>
        <Text style={styles.detailText}>Cost: KES {item.cost}</Text>
        <Text style={styles.detailText}>
          Created: {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      {canPerformActions() && item.available_actions && item.available_actions.length > 0 && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Available Actions:</Text>
          <View style={styles.actionButtons}>
            {item.available_actions.map((action) => (
              <TouchableOpacity
                key={action.action}
                style={[
                  styles.actionButton,
                  { backgroundColor: getActionColor(action.action) },
                ]}
                onPress={() => performPackageAction(item, action.action)}
              >
                <MaterialIcons
                  name={getActionIcon(action.action)}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderRecentSearchItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.recentSearchItem}
      onPress={() => {
        setSearchQuery(item);
        handleSearch(item);
      }}
    >
      <MaterialIcons name="history" size={16} color="#a0aec0" />
      <Text style={styles.recentSearchText}>{item}</Text>
      <TouchableOpacity
        onPress={() => {
          const updated = recentSearches.filter(s => s !== item);
          setRecentSearches(updated);
          SecureStore.setItemAsync('recent_package_searches', JSON.stringify(updated));
        }}
        style={styles.removeRecentButton}
      >
        <MaterialIcons name="close" size={14} color="#718096" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.emptyIconContainer}
          >
            <MaterialIcons name="search" size={48} color="#fff" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Search for Packages</Text>
          <Text style={styles.emptySubtitle}>
            Enter a package code or scan a QR code to find packages
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={['#FF9500', '#FF8C00']}
          style={styles.emptyIconContainer}
        >
          <MaterialIcons name="inbox" size={48} color="#fff" />
        </LinearGradient>
        <Text style={styles.emptyTitle}>No Packages Found</Text>
        <Text style={styles.emptySubtitle}>
          No packages match your search query "{searchQuery}"
        </Text>
        {!isOnline && (
          <Text style={styles.offlineNote}>
            You are offline. Some packages may not appear in search results.
          </Text>
        )}
      </View>
    );
  };

  const renderContent = () => (
    <View style={styles.container}>
      {/* Connection Status */}
      {!isOnline && (
        <View style={styles.offlineBar}>
          <MaterialIcons name="cloud-off" size={16} color="#FFB000" />
          <Text style={styles.offlineText}>Offline - Limited functionality</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#a0aec0" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Enter package code (PKG-XXXX-YYYYMMDD)"
            placeholderTextColor="#718096"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch()}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setHasSearched(false);
              }}
              style={styles.clearButton}
            >
              <MaterialIcons name="close" size={20} color="#a0aec0" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearch()}
            disabled={loading}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.searchButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="search" size={20} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <MaterialIcons name="qr-code-scanner" size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Searches */}
      {!hasSearched && recentSearches.length > 0 && (
        <View style={styles.recentSearchesContainer}>
          <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
          <FlatList
            data={recentSearches}
            keyExtractor={(item) => item}
            renderItem={renderRecentSearchItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentSearchesList}
          />
        </View>
      )}

      {/* Search Results */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Searching packages...</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderPackageItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={searchResults.length === 0 ? styles.emptyContainer : styles.listContainer}
          />
        )}
      </View>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        userRole={currentUserRole as any}
        onScanSuccess={handleScanSuccess}
      />
    </View>
  );

  return (
    <AdminLayout activePanel="packages">
      {renderContent()}
    </AdminLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBar: {
    backgroundColor: '#2A1F3D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB000',
  },
  offlineText: {
    color: '#FFB000',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: '#fff',
    includeFontPadding: false,
  },
  clearButton: {
    padding: 4,
  },
  searchActions: {
    flexDirection: 'row',
    gap: 12,
  },
  searchButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSearchesContainer: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0aec0',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  recentSearchesList: {
    paddingHorizontal: 16,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  recentSearchText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  removeRecentButton: {
    padding: 2,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#a0aec0',
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 100,
  },
  packageItem: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  packageInfo: {
    flex: 1,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  packageDetails: {
    padding: 20,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#a0aec0',
    marginBottom: 6,
    fontWeight: '500',
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    padding: 20,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  offlineNote: {
    fontSize: 14,
    color: '#FFB000',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
});

export default PackageSearchScreen;
// screens/PackageSearchScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import QRScanner from '../../components/QRScanner';

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
  navigation: any;
  userRole: 'agent' | 'rider' | 'customer';
}

const PackageSearchScreen: React.FC<PackageSearchScreenProps> = ({
  navigation,
  userRole,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const searchInputRef = useRef<TextInput>(null);

  const handleSearch = async (query: string = searchQuery) => {
    if (!query.trim()) {
      Toast.show({
        type: 'warning',
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
      const response = await fetch(`/api/v1/packages/search?query=${encodeURIComponent(query.trim())}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        // Get detailed info for each package including available actions
        const detailedResults = await Promise.all(
          result.data.map(async (pkg: Package) => {
            try {
              const detailResponse = await fetch(`/api/v1/scanning/package_details?package_code=${pkg.code}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getAuthToken()}`,
                },
              });
              
              const detailResult = await detailResponse.json();
              
              if (detailResult.success) {
                return {
                  ...pkg,
                  available_actions: detailResult.data.available_actions || [],
                };
              }
              
              return pkg;
            } catch (error) {
              return pkg;
            }
          })
        );

        setSearchResults(detailedResults);
        
        // Add to recent searches
        if (query.trim() && !recentSearches.includes(query.trim())) {
          setRecentSearches(prev => [query.trim(), ...prev.slice(0, 4)]);
        }

        // Show success toast if packages found
        if (detailedResults.length > 0) {
          Toast.show({
            type: 'success',
            text1: 'Search Complete',
            text2: `Found ${detailedResults.length} package${detailedResults.length > 1 ? 's' : ''}`,
            position: 'top',
            visibilityTime: 2000,
          });
        }
      } else {
        setSearchResults([]);
        Toast.show({
          type: 'error',
          text1: 'Search Failed',
          text2: result.message || 'No packages found',
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error) {
      setSearchResults([]);
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Failed to search packages. Please check your connection.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (result: any) => {
    const packageCode = result.package.code;
    setSearchQuery(packageCode);
    setShowScanner(false);
    
    // Automatically search for the scanned package
    await handleSearch(packageCode);
  };

  const performPackageAction = async (packageObj: Package, action: string) => {
    try {
      const response = await fetch('/api/v1/scanning/scan_action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          package_code: packageObj.code,
          action_type: action,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Action Successful',
          text2: result.message,
          position: 'top',
          visibilityTime: 3000,
        });
        
        // Refresh the search results to show updated package state
        await handleSearch(searchQuery);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Action Failed',
          text2: result.message,
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Failed to perform action. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  const getAuthToken = (): string => {
    // Implement your auth token retrieval logic
    return 'your-auth-token';
  };

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'pending_unpaid':
        return '#FF3B30';
      case 'pending':
        return '#FF9500';
      case 'submitted':
        return '#007AFF';
      case 'in_transit':
        return '#5856D6';
      case 'delivered':
        return '#34C759';
      case 'collected':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'collect':
        return '#007AFF';
      case 'deliver':
        return '#34C759';
      case 'print':
        return '#FF9500';
      case 'confirm_receipt':
        return '#5856D6';
      default:
        return '#007AFF';
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
      default:
        return 'check';
    }
  };

  const renderPackageItem = ({ item }: { item: Package }) => (
    <View style={styles.packageItem}>
      <TouchableOpacity
        style={styles.packageHeader}
        onPress={() => navigation.navigate('PackageDetails', { packageCode: item.code })}
      >
        <View style={styles.packageInfo}>
          <Text style={styles.packageCode}>{item.code}</Text>
          <View style={[styles.stateBadge, { backgroundColor: getStateColor(item.state) }]}>
            <Text style={styles.stateText}>{item.state_display}</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#666" />
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

      {item.available_actions && item.available_actions.length > 0 && (
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
      <MaterialIcons name="history" size={16} color="#666" />
      <Text style={styles.recentSearchText}>{item}</Text>
      <TouchableOpacity
        onPress={() => setRecentSearches(prev => prev.filter(s => s !== item))}
        style={styles.removeRecentButton}
      >
        <MaterialIcons name="close" size={14} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="search" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Search for Packages</Text>
          <Text style={styles.emptySubtitle}>
            Enter a package code or scan a QR code to find packages
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="inbox" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Packages Found</Text>
        <Text style={styles.emptySubtitle}>
          No packages match your search query "{searchQuery}"
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Search</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#666" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Enter package code (PKG-XXXX-YYYYMMDD)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch()}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <MaterialIcons name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearch()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <MaterialIcons name="qr-code-scanner" size={20} color="#007AFF" />
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
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Searching packages...</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderPackageItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={searchResults.length === 0 ? styles.emptyContainer : {}}
          />
        )}
      </View>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        userRole={userRole}
        onScanSuccess={handleScanSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
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
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSearchesContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  recentSearchesList: {
    paddingHorizontal: 16,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  recentSearchText: {
    fontSize: 12,
    color: '#333',
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
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  packageItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  packageInfo: {
    flex: 1,
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  packageDetails: {
    padding: 16,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PackageSearchScreen;
// app/admin/PackageSearchScreen.tsx - Styled with dark theme and toasts
import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import QRScanner from '../../components/QRScanner';
import AdminLayout from '../../components/AdminLayout';

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
  userRole?: 'agent' | 'rider' | 'customer';
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
  const [recentSearches, setRecentSearches] = useState<string[]>(['PKG-DEMO-20240814', 'PKG-TEST-20240813']);
  
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
      // Mock data for demo - replace with actual API call
      setTimeout(() => {
        const mockResults: Package[] = [
          {
            id: '1',
            code: query.trim(),
            state: 'in_transit',
            state_display: 'In Transit',
            sender_name: 'John Doe',
            receiver_name: 'Jane Smith',
            receiver_phone: '+254700000000',
            route_description: 'Nairobi → Mombasa',
            cost: 500,
            delivery_type: 'standard',
            created_at: new Date().toISOString(),
            available_actions: [
              { action: 'collect', label: 'Collect Package', description: 'Mark as collected' },
              { action: 'deliver', label: 'Mark Delivered', description: 'Mark as delivered' }
            ]
          }
        ];

        setSearchResults(mockResults);
        
        // Add to recent searches
        if (query.trim() && !recentSearches.includes(query.trim())) {
          setRecentSearches(prev => [query.trim(), ...prev.slice(0, 4)]);
        }

        Toast.show({
          type: 'success',
          text1: 'Search Complete',
          text2: `Found ${mockResults.length} package${mockResults.length > 1 ? 's' : ''}`,
          position: 'top',
          visibilityTime: 2000,
        });
        
        setLoading(false);
      }, 1500);

      /* Actual API call:
      const response = await fetch(`/api/v1/packages/search?query=${encodeURIComponent(query.trim())}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        // Process results...
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
      */
    } catch (error) {
      setSearchResults([]);
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Failed to search packages. Please check your connection.',
        position: 'top',
        visibilityTime: 4000,
      });
      setLoading(false);
    }
  };

  const handleScanSuccess = async (result: any) => {
    const packageCode = result.package?.code || 'PKG-SCANNED-20240814';
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

      // Mock API call
      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: 'Action Successful',
          text2: `Package ${packageObj.code} has been ${action}ed`,
          position: 'top',
          visibilityTime: 3000,
        });
        
        // Refresh the search results
        handleSearch(searchQuery);
      }, 1000);

      /* Actual API call:
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
      */
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
    return 'your-auth-token';
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
      default:
        return 'check';
    }
  };

  const renderPackageItem = ({ item }: { item: Package }) => (
    <View style={styles.packageItem}>
      <TouchableOpacity
        style={styles.packageHeader}
        onPress={() => router.push(`/admin/PackageDetailsScreen?code=${item.code}`)}
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
      <MaterialIcons name="history" size={16} color="#a0aec0" />
      <Text style={styles.recentSearchText}>{item}</Text>
      <TouchableOpacity
        onPress={() => setRecentSearches(prev => prev.filter(s => s !== item))}
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
      </View>
    );
  };

  const renderContent = () => (
    <View style={styles.container}>
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
              onPress={() => setSearchQuery('')}
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
        userRole={userRole}
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
});

export default PackageSearchScreen;
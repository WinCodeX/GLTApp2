// app/(agent)/packages.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../lib/api';

interface Package {
  id: number;
  code: string;
  state: string;
  state_display: string;
  delivery_type_display: string;
  receiver: {
    name: string;
    phone: string;
  };
  route: {
    origin: string;
    destination: string;
    description: string;
  };
  created_at: string;
  can_be_rejected: boolean;
}

export default function ViewPackagesScreen() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string>('pending');
  
  // Rejection modal state
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  const stateFilters = [
    { value: 'pending', label: 'Pending', color: '#FF9500' },
    { value: 'submitted', label: 'Submitted', color: '#007AFF' },
    { value: 'all', label: 'All States', color: '#8E8E93' },
  ];

  const fetchPackages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params: any = { limit: 100 };
      if (selectedState !== 'all') {
        params.state = selectedState;
      }

      const response = await api.get('/api/v1/staff/packages', { params });

      if (response.data.success) {
        const pkgs = response.data.data.packages || [];
        setPackages(pkgs);
        filterPackages(pkgs, searchQuery);
      }
    } catch (error: any) {
      console.error('Failed to fetch packages:', error);
      Alert.alert('Error', 'Failed to load packages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedState, searchQuery]);

  useEffect(() => {
    fetchPackages();
  }, [selectedState]);

  const filterPackages = (pkgs: Package[], query: string) => {
    if (!query.trim()) {
      setFilteredPackages(pkgs);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = pkgs.filter(
      (pkg) =>
        pkg.code.toLowerCase().includes(lowerQuery) ||
        pkg.receiver.name.toLowerCase().includes(lowerQuery) ||
        pkg.receiver.phone.includes(query)
    );
    setFilteredPackages(filtered);
  };

  useEffect(() => {
    filterPackages(packages, searchQuery);
  }, [searchQuery, packages]);

  const handleTrackPackage = (pkg: Package) => {
    router.replace({
      pathname: '/(agent)/track',
      params: { 
        code: pkg.code,
        packageId: pkg.id.toString() 
      }
    });
  };

  const handleCollectPackage = async (pkg: Package) => {
    Alert.alert(
      'Collect Package',
      `Mark package ${pkg.code} as collected?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Collect',
          onPress: async () => {
            try {
              const response = await api.post('/api/v1/staff/scan_events', {
                package_code: pkg.code,
                event_type: 'collected_by_rider',
                location: 'Agent Office',
              });

              if (response.data.success) {
                Alert.alert('Success', 'Package marked as collected');
                fetchPackages(true);
              } else {
                Alert.alert('Error', response.data.message);
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to collect package');
            }
          },
        },
      ]
    );
  };

  const handleRejectPackage = (pkg: Package) => {
    setSelectedPackage(pkg);
    setRejectionReason('');
    setRejectionModalVisible(true);
  };

  const submitRejection = async () => {
    if (!selectedPackage || !rejectionReason.trim()) {
      Alert.alert('Error', 'Please enter a rejection reason');
      return;
    }

    setSubmittingRejection(true);
    try {
      const response = await api.post(`/api/v1/staff/packages/${selectedPackage.id}/reject`, {
        reason: rejectionReason.trim(),
        rejection_type: 'manual',
      });

      if (response.data.success) {
        Alert.alert('Success', 'Package rejected successfully');
        setRejectionModalVisible(false);
        setSelectedPackage(null);
        setRejectionReason('');
        fetchPackages(true);
      } else {
        Alert.alert('Error', response.data.message);
      }
    } catch (error: any) {
      console.error('Rejection error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to reject package');
    } finally {
      setSubmittingRejection(false);
    }
  };

  const renderPackageItem = ({ item }: { item: Package }) => (
    <View style={styles.packageCard}>
      <View style={styles.packageHeader}>
        <View style={styles.packageCodeContainer}>
          <Text style={styles.packageCode}>{item.code}</Text>
          <View style={[styles.stateBadge, { backgroundColor: getStateColor(item.state) }]}>
            <Text style={styles.stateBadgeText}>{item.state_display}</Text>
          </View>
        </View>
      </View>

      <View style={styles.packageInfo}>
        <View style={styles.infoRow}>
          <Feather name="user" size={14} color="#8E8E93" />
          <Text style={styles.infoLabel}>Receiver:</Text>
          <Text style={styles.infoValue}>{item.receiver.name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Feather name="phone" size={14} color="#8E8E93" />
          <Text style={styles.infoLabel}>Phone:</Text>
          <Text style={styles.infoValue}>{item.receiver.phone}</Text>
        </View>

        <View style={styles.infoRow}>
          <Feather name="map-pin" size={14} color="#8E8E93" />
          <Text style={styles.infoLabel}>Route:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {item.route.description}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Feather name="package" size={14} color="#8E8E93" />
          <Text style={styles.infoLabel}>Type:</Text>
          <Text style={styles.infoValue}>{item.delivery_type_display}</Text>
        </View>
      </View>

      <View style={styles.packageActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.trackButton]}
          onPress={() => handleTrackPackage(item)}
        >
          <Feather name="search" size={16} color="#007AFF" />
          <Text style={[styles.actionButtonText, { color: '#007AFF' }]}>Track</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.collectButton]}
          onPress={() => handleCollectPackage(item)}
        >
          <Feather name="check-circle" size={16} color="#34C759" />
          <Text style={[styles.actionButtonText, { color: '#34C759' }]}>Collect</Text>
        </TouchableOpacity>

        {item.can_be_rejected && (
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectPackage(item)}
          >
            <Feather name="x-circle" size={16} color="#FF3B30" />
            <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Reject</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const getStateColor = (state: string) => {
    switch (state) {
      case 'pending':
        return '#FF9500';
      case 'submitted':
        return '#007AFF';
      case 'in_transit':
        return '#5856D6';
      case 'delivered':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.replace('/(agent)')} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Packages</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by code, name, or phone"
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
        {stateFilters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterChip,
              selectedState === filter.value && {
                backgroundColor: filter.color,
              },
            ]}
            onPress={() => setSelectedState(filter.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedState === filter.value && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPackages}
          renderItem={renderPackageItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPackages(true)}
              colors={['#7B3F98']}
              tintColor="#7B3F98"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={64} color="#8E8E93" />
              <Text style={styles.emptyStateText}>No packages found</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery ? 'Try a different search term' : 'Packages will appear here'}
              </Text>
            </View>
          }
        />
      )}

      {/* Rejection Modal */}
      <Modal
        visible={rejectionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRejectionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Package</Text>
              <TouchableOpacity onPress={() => setRejectionModalVisible(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedPackage && (
              <View style={styles.modalPackageInfo}>
                <Text style={styles.modalPackageCode}>{selectedPackage.code}</Text>
                <Text style={styles.modalPackageReceiver}>{selectedPackage.receiver.name}</Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Rejection Reason *</Text>
            <TextInput
              style={styles.modalTextArea}
              placeholder="Enter reason for rejection..."
              placeholderTextColor="#8E8E93"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setRejectionModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={submitRejection}
                disabled={submittingRejection || !rejectionReason.trim()}
              >
                {submittingRejection ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="x-circle" size={16} color="#fff" />
                    <Text style={styles.modalRejectButtonText}>Reject Package</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchSection: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1F2C34',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#B8B8B8',
  },
  listContent: {
    padding: 16,
  },
  packageCard: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  packageHeader: {
    marginBottom: 12,
  },
  packageCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stateBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  packageInfo: {
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#8E8E93',
    width: 60,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
  },
  packageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  trackButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  collectButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalPackageInfo: {
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalPackageCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modalPackageReceiver: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  modalTextArea: {
    backgroundColor: '#111B21',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  modalCancelButton: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  modalRejectButton: {
    backgroundColor: '#FF3B30',
  },
  modalRejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
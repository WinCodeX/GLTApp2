// components/BulkScanner.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import QRScanner from './QRScanner';

interface ScannedPackage {
  code: string;
  sender_name: string;
  receiver_name: string;
  route_description: string;
  state: string;
  scanned_at: Date;
  processed: boolean;
  error?: string;
}

interface BulkScanResult {
  package_code: string;
  success: boolean;
  message: string;
  new_state?: string;
}

interface BulkScannerProps {
  visible: boolean;
  onClose: () => void;
  actionType: 'print' | 'collect' | 'deliver';
  userRole: 'agent' | 'rider';
  onBulkComplete?: (results: BulkScanResult[]) => void;
}

const BulkScanner: React.FC<BulkScannerProps> = ({
  visible,
  onClose,
  actionType,
  userRole,
  onBulkComplete,
}) => {
  const [scannedPackages, setScannedPackages] = useState<ScannedPackage[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  useEffect(() => {
    if (visible) {
      setScannedPackages([]);
      setManualCode('');
    }
  }, [visible]);

  const handleScanSuccess = async (result: any) => {
    const packageData = result.package;
    const packageCode = packageData.code;

    // Check if already scanned
    if (scannedPackages.some(pkg => pkg.code === packageCode)) {
      Alert.alert('Already Scanned', 'This package has already been scanned.');
      return;
    }

    // Validate action availability
    const availableActions = result.available_actions || [];
    const canPerformAction = availableActions.some((action: any) => action.action === actionType);

    const newPackage: ScannedPackage = {
      code: packageCode,
      sender_name: packageData.sender_name,
      receiver_name: packageData.receiver_name,
      route_description: packageData.route_description,
      state: packageData.state,
      scanned_at: new Date(),
      processed: false,
      error: canPerformAction ? undefined : `Cannot ${actionType} package in ${packageData.state} state`,
    };

    setScannedPackages(prev => [newPackage, ...prev]);
    setShowScanner(false);
  };

  const handleManualEntry = async () => {
    if (!manualCode.trim()) {
      Alert.alert('Error', 'Please enter a package code');
      return;
    }

    try {
      const response = await fetch(`/api/v1/scanning/package_details?package_code=${manualCode.trim()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        await handleScanSuccess(result.data);
        setManualCode('');
        setShowManualEntry(false);
      } else {
        Alert.alert('Error', result.message || 'Package not found');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Failed to fetch package details');
    }
  };

  const removePackage = (packageCode: string) => {
    setScannedPackages(prev => prev.filter(pkg => pkg.code !== packageCode));
  };

  const processAllPackages = async () => {
    const validPackages = scannedPackages.filter(pkg => !pkg.error);
    
    if (validPackages.length === 0) {
      Alert.alert('No Valid Packages', 'Please scan valid packages before processing.');
      return;
    }

    Alert.alert(
      'Confirm Bulk Action',
      `${getActionLabel(actionType)} ${validPackages.length} packages?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: performBulkAction },
      ]
    );
  };

  const performBulkAction = async () => {
    setProcessing(true);
    
    const validPackages = scannedPackages.filter(pkg => !pkg.error);
    const packageCodes = validPackages.map(pkg => pkg.code);

    try {
      const response = await fetch('/api/v1/scanning/bulk_scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          package_codes: packageCodes,
          action_type: actionType,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update package statuses based on results
        const updatedPackages = scannedPackages.map(pkg => {
          const processResult = result.data.results.find((r: BulkScanResult) => r.package_code === pkg.code);
          if (processResult) {
            return {
              ...pkg,
              processed: processResult.success,
              error: processResult.success ? undefined : processResult.message,
              state: processResult.new_state || pkg.state,
            };
          }
          return pkg;
        });

        setScannedPackages(updatedPackages);

        const summary = result.data.summary;
        Alert.alert(
          'Bulk Action Complete',
          `Successfully processed ${summary.successful} of ${summary.total} packages.`,
          [
            {
              text: 'OK',
              onPress: () => {
                onBulkComplete?.(result.data.results);
                if (summary.successful === summary.total) {
                  onClose();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Bulk action failed');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Failed to process bulk action');
    } finally {
      setProcessing(false);
    }
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'print': return 'Print';
      case 'collect': return 'Collect';
      case 'deliver': return 'Mark as Delivered';
      default: return action;
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'print': return '#FF9500';
      case 'collect': return '#007AFF';
      case 'deliver': return '#34C759';
      default: return '#007AFF';
    }
  };

  const getAuthToken = (): string => {
    // Implement your auth token retrieval logic
    return 'your-auth-token';
  };

  const renderPackageItem = ({ item }: { item: ScannedPackage }) => (
    <View style={[styles.packageItem, item.error && styles.packageItemError]}>
      <View style={styles.packageHeader}>
        <Text style={styles.packageCode}>{item.code}</Text>
        <TouchableOpacity onPress={() => removePackage(item.code)} style={styles.removeButton}>
          <MaterialIcons name="close" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.packageRoute}>{item.route_description}</Text>
      <Text style={styles.packageDetails}>
        From: {item.sender_name} → To: {item.receiver_name}
      </Text>
      
      <View style={styles.packageFooter}>
        <View style={[styles.statusBadge, { backgroundColor: item.processed ? '#34C759' : '#FF9500' }]}>
          <Text style={styles.statusText}>
            {item.processed ? 'Processed' : item.error ? 'Error' : 'Ready'}
          </Text>
        </View>
        {item.error && <Text style={styles.errorText}>{item.error}</Text>}
        <Text style={styles.scanTime}>
          Scanned: {item.scanned_at.toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: getActionColor(actionType) }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Bulk {getActionLabel(actionType)}
          </Text>
          <View style={styles.headerButton} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.scanButton]}
              onPress={() => setShowScanner(true)}
            >
              <MaterialIcons name="qr-code-scanner" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Scan QR Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.manualButton]}
              onPress={() => setShowManualEntry(true)}
            >
              <MaterialIcons name="keyboard" size={20} color="#007AFF" />
              <Text style={[styles.actionButtonText, { color: '#007AFF' }]}>Manual Entry</Text>
            </TouchableOpacity>
          </View>

          {/* Package Count */}
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {scannedPackages.length} packages scanned
            </Text>
            {scannedPackages.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={() => setScannedPackages([])}
              >
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Package List */}
          <FlatList
            data={scannedPackages}
            keyExtractor={(item) => item.code}
            renderItem={renderPackageItem}
            style={styles.packageList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="qr-code-2" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No packages scanned yet</Text>
                <Text style={styles.emptySubtext}>
                  Scan QR codes to add packages for bulk {actionType}
                </Text>
              </View>
            }
          />

          {/* Process Button */}
          {scannedPackages.length > 0 && (
            <View style={styles.processContainer}>
              <TouchableOpacity
                style={[
                  styles.processButton,
                  { backgroundColor: getActionColor(actionType) },
                  processing && styles.processButtonDisabled,
                ]}
                onPress={processAllPackages}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.processButtonText}>
                      {getActionLabel(actionType)} All Packages
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* QR Scanner Modal */}
        <QRScanner
          visible={showScanner}
          onClose={() => setShowScanner(false)}
          userRole={userRole}
          onScanSuccess={handleScanSuccess}
          defaultAction={actionType}
        />

        {/* Manual Entry Modal */}
        <Modal visible={showManualEntry} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.manualEntryModal}>
              <Text style={styles.modalTitle}>Enter Package Code</Text>
              <TextInput
                style={styles.manualInput}
                placeholder="PKG-XXXX-YYYYMMDD"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowManualEntry(false);
                    setManualCode('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleManualEntry}
                >
                  <Text style={styles.modalConfirmText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  scanButton: {
    backgroundColor: '#007AFF',
  },
  manualButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearAllText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  packageList: {
    flex: 1,
  },
  packageItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  packageItemError: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  removeButton: {
    padding: 4,
  },
  packageRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  packageDetails: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  packageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
  },
  scanTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  processContainer: {
    paddingTop: 16,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  processButtonDisabled: {
    opacity: 0.6,
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  manualEntryModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#666',
    fontSize: 16,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BulkScanner;
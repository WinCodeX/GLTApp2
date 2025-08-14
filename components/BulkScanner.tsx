// components/BulkScanner.tsx - Updated with all roles and proper API integration
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import QRScanner from './QRScanner';
import api from '../lib/api';
import OfflineScanningService from '../services/OfflineScanningService';

interface ScannedPackage {
  code: string;
  sender_name: string;
  receiver_name: string;
  route_description: string;
  state: string;
  scanned_at: Date;
  processed: boolean;
  error?: string;
  offline?: boolean;
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
  actionType: 'print' | 'collect' | 'deliver' | 'process';
  userRole: 'client' | 'agent' | 'rider' | 'warehouse' | 'admin';
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
  const [isOnline, setIsOnline] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const offlineService = OfflineScanningService.getInstance();

  useEffect(() => {
    if (visible) {
      setScannedPackages([]);
      setManualCode('');
      loadCurrentUser();
      checkConnectivity();
    }
  }, [visible]);

  const loadCurrentUser = async () => {
    try {
      const userId = await SecureStore.getItemAsync('user_id');
      const userName = await SecureStore.getItemAsync('user_name') || 'Unknown User';
      const userRole = await SecureStore.getItemAsync('user_role') || 'client';
      
      setCurrentUser({
        id: userId || 'unknown',
        name: userName,
        role: userRole
      });
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const checkConnectivity = async () => {
    try {
      const online = await offlineService.isOnline();
      setIsOnline(online);
    } catch (error) {
      setIsOnline(false);
    }
  };

  const handleScanSuccess = async (result: any) => {
    const packageData = result.package || result;
    const packageCode = packageData.code || result.code || 'PKG-DEMO-20240814';

    // Check if already scanned
    if (scannedPackages.some(pkg => pkg.code === packageCode)) {
      Toast.show({
        type: 'warning',
        text1: 'Already Scanned',
        text2: 'This package has already been scanned.',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      const online = await offlineService.isOnline();
      let packageInfo = packageData;

      if (!online) {
        // Try to get from cache
        const cached = await offlineService.getCachedPackage(packageCode);
        if (cached) {
          packageInfo = cached.package;
        }
      } else {
        // Fetch fresh package details
        try {
          const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`);
          if (response.data.success) {
            packageInfo = response.data.data.package;
            // Cache for offline use
            await offlineService.cachePackage(
              packageCode,
              packageInfo,
              response.data.data.available_actions
            );
          }
        } catch (error) {
          console.warn('Failed to fetch package details, using provided data:', error);
        }
      }

      // Validate if action can be performed
      const canPerformAction = await validatePackageAction(packageInfo, actionType);

      const newPackage: ScannedPackage = {
        code: packageCode,
        sender_name: packageInfo.sender_name || 'Unknown Sender',
        receiver_name: packageInfo.receiver_name || 'Unknown Receiver',
        route_description: packageInfo.route_description || 'Unknown Route',
        state: packageInfo.state || 'unknown',
        scanned_at: new Date(),
        processed: false,
        error: canPerformAction.canPerform ? undefined : canPerformAction.reason,
        offline: !online
      };

      setScannedPackages(prev => [newPackage, ...prev]);
      setShowScanner(false);
      
      Toast.show({
        type: canPerformAction.canPerform ? 'success' : 'warning',
        text1: 'Package Scanned',
        text2: canPerformAction.canPerform 
          ? `${packageCode} added to batch${!online ? ' (offline)' : ''}` 
          : `${packageCode} has validation errors`,
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error processing scanned package:', error);
      Toast.show({
        type: 'error',
        text1: 'Scan Error',
        text2: 'Failed to process scanned package',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const validatePackageAction = async (packageInfo: any, action: string): Promise<{canPerform: boolean, reason?: string}> => {
    try {
      const online = await offlineService.isOnline();
      
      if (online) {
        // Use API validation
        const response = await api.post(`/api/v1/scanning/package/${packageInfo.code}/validate`, {
          action_type: action
        });
        
        if (response.data.success) {
          return {
            canPerform: response.data.data.can_execute,
            reason: response.data.data.can_execute ? undefined : 'Action not allowed in current state'
          };
        }
      }
      
      // Fallback validation
      return validatePackageActionLocally(packageInfo, action);
    } catch (error) {
      // Fallback to local validation
      return validatePackageActionLocally(packageInfo, action);
    }
  };

  const validatePackageActionLocally = (packageInfo: any, action: string): {canPerform: boolean, reason?: string} => {
    const state = packageInfo.state;
    
    switch (action) {
      case 'print':
        return {
          canPerform: ['pending', 'submitted', 'in_transit', 'delivered'].includes(state),
          reason: !['pending', 'submitted', 'in_transit', 'delivered'].includes(state) 
            ? `Cannot print package in ${state} state` 
            : undefined
        };
      case 'collect':
        return {
          canPerform: state === 'submitted',
          reason: state !== 'submitted' ? `Cannot collect package in ${state} state` : undefined
        };
      case 'deliver':
        return {
          canPerform: state === 'in_transit',
          reason: state !== 'in_transit' ? `Cannot deliver package in ${state} state` : undefined
        };
      case 'process':
        return {
          canPerform: ['submitted', 'in_transit'].includes(state),
          reason: !['submitted', 'in_transit'].includes(state) 
            ? `Cannot process package in ${state} state` 
            : undefined
        };
      default:
        return { canPerform: false, reason: 'Unknown action type' };
    }
  };

  const handleManualEntry = async () => {
    if (!manualCode.trim()) {
      Toast.show({
        type: 'warning',
        text1: 'Code Required',
        text2: 'Please enter a package code',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      const online = await offlineService.isOnline();
      
      if (online) {
        // Try API call
        const response = await api.get(`/api/v1/scanning/package_details?package_code=${manualCode.trim()}`);
        
        if (response.data.success) {
          await handleScanSuccess({ package: response.data.data.package });
          setManualCode('');
          setShowManualEntry(false);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Package Not Found',
            text2: response.data.message || 'Package not found',
            position: 'top',
            visibilityTime: 4000,
          });
        }
      } else {
        // Try cached data
        const cached = await offlineService.getCachedPackage(manualCode.trim());
        if (cached) {
          await handleScanSuccess({ package: cached.package });
          setManualCode('');
          setShowManualEntry(false);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Offline Error',
            text2: 'Package not found in cache',
            position: 'top',
            visibilityTime: 4000,
          });
        }
      }
    } catch (error) {
      console.error('Manual entry error:', error);
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Failed to fetch package details',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  const removePackage = (packageCode: string) => {
    setScannedPackages(prev => prev.filter(pkg => pkg.code !== packageCode));
    Toast.show({
      type: 'info',
      text1: 'Package Removed',
      text2: `${packageCode} removed from batch`,
      position: 'top',
      visibilityTime: 2000,
    });
  };

  const processAllPackages = async () => {
    const validPackages = scannedPackages.filter(pkg => !pkg.error);
    
    if (validPackages.length === 0) {
      Toast.show({
        type: 'warning',
        text1: 'No Valid Packages',
        text2: 'Please scan valid packages before processing.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    Alert.alert(
      'Confirm Bulk Action',
      `${getActionLabel(actionType)} ${validPackages.length} packages?${!isOnline ? '\n\nNote: You are offline. Actions will be queued for sync.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: performBulkAction, style: 'default' }
      ]
    );
  };

  const performBulkAction = async () => {
    setProcessing(true);
    
    const validPackages = scannedPackages.filter(pkg => !pkg.error);
    const packageCodes = validPackages.map(pkg => pkg.code);

    try {
      const online = await offlineService.isOnline();
      
      if (!online) {
        // Process offline
        await processBulkOffline(packageCodes);
      } else {
        // Process online
        await processBulkOnline(packageCodes);
      }
    } catch (error) {
      console.error('Bulk processing error:', error);
      Toast.show({
        type: 'error',
        text1: 'Processing Failed',
        text2: 'Failed to process packages',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setProcessing(false);
    }
  };

  const processBulkOffline = async (packageCodes: string[]) => {
    const results: BulkScanResult[] = [];

    for (const code of packageCodes) {
      try {
        const result = await offlineService.storeScanAction(
          code,
          actionType,
          currentUser,
          {
            bulk_operation: true,
            location: await getCurrentLocation(),
            device_info: getDeviceInfo()
          }
        );

        results.push({
          package_code: code,
          success: result.success,
          message: result.success ? 'Queued for sync' : result.message
        });

        // Update package status locally
        if (result.success) {
          setScannedPackages(prev => prev.map(pkg => 
            pkg.code === code ? { ...pkg, processed: true, offline: true } : pkg
          ));
        }
      } catch (error) {
        results.push({
          package_code: code,
          success: false,
          message: 'Failed to queue offline'
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    
    Toast.show({
      type: 'success',
      text1: 'Queued for Sync',
      text2: `${successful} of ${results.length} packages queued for sync when online`,
      position: 'top',
      visibilityTime: 5000,
    });

    onBulkComplete?.(results);
    
    // Close after a delay to show results
    setTimeout(() => onClose(), 2000);
  };

  const processBulkOnline = async (packageCodes: string[]) => {
    try {
      const response = await api.post('/api/v1/scanning/bulk_scan', {
        package_codes: packageCodes,
        action_type: actionType,
        metadata: {
          bulk_operation: true,
          location: await getCurrentLocation(),
          device_info: getDeviceInfo()
        }
      });

      if (response.data.success) {
        const results = response.data.data.results;
        
        // Update package statuses based on results
        const updatedPackages = scannedPackages.map(pkg => {
          const processResult = results.find((r: any) => r.package_code === pkg.code);
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

        const successful = response.data.data.summary.successful;
        const total = response.data.data.summary.total;

        if (successful === total) {
          Toast.show({
            type: 'success',
            text1: 'Bulk Action Complete',
            text2: `Successfully processed all ${total} packages.`,
            position: 'top',
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'warning',
            text1: 'Bulk Action Partial',
            text2: `${successful} of ${total} packages processed successfully.`,
            position: 'top',
            visibilityTime: 5000,
          });
        }

        onBulkComplete?.(results);

        if (successful === total) {
          setTimeout(() => onClose(), 2000);
        }
      } else {
        throw new Error(response.data.message || 'Bulk action failed');
      }
    } catch (error: any) {
      throw error;
    }
  };

  const getCurrentLocation = async () => {
    // Implement location services if needed
    return null;
  };

  const getDeviceInfo = () => {
    return {
      platform: 'react-native',
      timestamp: new Date().toISOString()
    };
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'print': return 'Print';
      case 'collect': return 'Collect';
      case 'deliver': return 'Mark as Delivered';
      case 'process': return 'Process';
      default: return action;
    }
  };

  const getActionColor = (action: string): string[] => {
    switch (action) {
      case 'print': return ['#FF9500', '#FF8C00'];
      case 'collect': return ['#667eea', '#764ba2'];
      case 'deliver': return ['#34C759', '#30A46C'];
      case 'process': return ['#9C27B0', '#673AB7'];
      default: return ['#667eea', '#764ba2'];
    }
  };

  const renderPackageItem = ({ item }: { item: ScannedPackage }) => (
    <View style={[
      styles.packageItem, 
      item.error && styles.packageItemError,
      item.offline && styles.packageItemOffline
    ]}>
      <View style={styles.packageHeader}>
        <View style={styles.packageCodeContainer}>
          <Text style={styles.packageCode}>{item.code}</Text>
          {item.offline && (
            <MaterialIcons name="cloud-off" size={16} color="#FFB000" />
          )}
        </View>
        <TouchableOpacity onPress={() => removePackage(item.code)} style={styles.removeButton}>
          <MaterialIcons name="close" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.packageRoute}>{item.route_description}</Text>
      <Text style={styles.packageDetails}>
        From: {item.sender_name} → To: {item.receiver_name}
      </Text>
      
      <View style={styles.packageFooter}>
        <LinearGradient
          colors={item.processed 
            ? ['#34C759', '#30A46C'] 
            : item.error 
              ? ['#FF6B6B', '#FF5252'] 
              : item.offline
                ? ['#FFB000', '#FF8C00']
                : ['#FF9500', '#FF8C00']
          }
          style={styles.statusBadge}
        >
          <Text style={styles.statusText}>
            {item.processed 
              ? 'Processed' 
              : item.error 
                ? 'Error' 
                : item.offline
                  ? 'Offline'
                  : 'Ready'
            }
          </Text>
        </LinearGradient>
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
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.container}
      >
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <LinearGradient
            colors={getActionColor(actionType)}
            style={styles.header}
          >
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                Bulk {getActionLabel(actionType)}
              </Text>
              {!isOnline && (
                <Text style={styles.offlineHeaderIndicator}>OFFLINE MODE</Text>
              )}
            </View>
            <View style={styles.headerButton} />
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => setShowScanner(true)}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.scanButtonGradient}
                >
                  <MaterialIcons name="qr-code-scanner" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Scan QR Code</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => setShowManualEntry(true)}
              >
                <MaterialIcons name="keyboard" size={20} color="#667eea" />
                <Text style={[styles.actionButtonText, { color: '#667eea' }]}>Manual Entry</Text>
              </TouchableOpacity>
            </View>

            {/* Package Count */}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {scannedPackages.length} packages scanned
                {!isOnline && ' (offline mode)'}
              </Text>
              {scannedPackages.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={() => {
                    setScannedPackages([]);
                    Toast.show({
                      type: 'info',
                      text1: 'Batch Cleared',
                      text2: 'All packages removed from batch',
                      position: 'top',
                      visibilityTime: 2000,
                    });
                  }}
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
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.emptyIconContainer}
                  >
                    <MaterialIcons name="qr-code-2" size={48} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.emptyText}>No packages scanned yet</Text>
                  <Text style={styles.emptySubtext}>
                    Scan QR codes to add packages for bulk {actionType}
                    {!isOnline && ' (offline mode active)'}
                  </Text>
                </View>
              }
            />

            {/* Process Button */}
            {scannedPackages.length > 0 && (
              <View style={styles.processContainer}>
                <TouchableOpacity
                  style={[styles.processButton, processing && styles.processButtonDisabled]}
                  onPress={processAllPackages}
                  disabled={processing}
                >
                  <LinearGradient
                    colors={processing ? ['#718096', '#a0aec0'] : getActionColor(actionType)}
                    style={styles.processButtonGradient}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons 
                          name={!isOnline ? "cloud-queue" : "check-circle"} 
                          size={20} 
                          color="#fff" 
                        />
                        <Text style={styles.processButtonText}>
                          {!isOnline 
                            ? `Queue All for Sync` 
                            : `${getActionLabel(actionType)} All Packages`
                          }
                        </Text>
                      </>
                    )}
                  </LinearGradient>
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
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.modalHeader}
                >
                  <Text style={styles.modalTitle}>Enter Package Code</Text>
                </LinearGradient>
                
                <View style={styles.modalContent}>
                  <TextInput
                    style={styles.manualInput}
                    placeholder="PKG-XXXX-YYYYMMDD"
                    placeholderTextColor="#718096"
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
                      <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        style={styles.modalConfirmGradient}
                      >
                        <Text style={styles.modalConfirmText}>Add</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  offlineHeaderIndicator: {
    color: '#FFB000',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
  scanButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  manualButton: {
    flex: 1,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2d3748',
  },
  clearAllText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  packageList: {
    flex: 1,
  },
  packageItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3748',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  packageItemError: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  packageItemOffline: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFB000',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  removeButton: {
    padding: 4,
  },
  packageRoute: {
    fontSize: 14,
    color: '#a0aec0',
    marginBottom: 4,
    fontWeight: '600',
  },
  packageDetails: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 8,
    fontWeight: '500',
  },
  packageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
    fontWeight: '500',
  },
  scanTime: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    paddingHorizontal: 40,
    fontWeight: '500',
  },
  processContainer: {
    paddingTop: 16,
  },
  processButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  processButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  processButtonDisabled: {
    opacity: 0.6,
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  manualEntryModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d3748',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#fff',
  },
  modalContent: {
    padding: 20,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#2d3748',
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
    color: '#fff',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3748',
    backgroundColor: '#16213e',
    borderRadius: 12,
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#a0aec0',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default BulkScanner;
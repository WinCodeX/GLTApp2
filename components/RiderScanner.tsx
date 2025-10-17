// components/RiderScanner.tsx - Compact scanner for riders
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Vibration,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, Camera } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import api from '../lib/api';

interface ScannedPackage {
  code: string;
  route: string;
  status: 'success' | 'error';
  message: string;
  timestamp: Date;
  action: 'collect' | 'deliver' | 'give_to_receiver';
}

interface RiderScannerProps {
  visible: boolean;
  onClose: () => void;
  action: 'collect' | 'deliver' | 'give_to_receiver';
  onComplete?: (packages: ScannedPackage[]) => void;
}

const RiderScanner: React.FC<RiderScannerProps> = ({
  visible,
  onClose,
  action,
  onComplete
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedPackages, setScannedPackages] = useState<ScannedPackage[]>([]);
  const [currentPackage, setCurrentPackage] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    requestCameraPermission();
  }, []);

  useEffect(() => {
    if (visible) {
      setScannedPackages([]);
      setCurrentPackage(null);
      setScanned(false);
      startPulseAnimation();
    }
  }, [visible]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const extractPackageCode = (data: string): string | null => {
    if (data.match(/^PKG-[A-Z0-9]+-\d{8}$/)) return data;
    const urlMatch = data.match(/\/track\/([A-Z0-9-]+)$/);
    if (urlMatch) return urlMatch[1];
    return data;
  };

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    Vibration.vibrate(100);
    
    const packageCode = extractPackageCode(data);
    if (!packageCode) {
      setScanned(false);
      return;
    }

    // Check if already scanned
    if (scannedPackages.some(pkg => pkg.code === packageCode)) {
      setScanned(false);
      return;
    }

    await processPackage(packageCode);
  };

  const processPackage = async (packageCode: string) => {
    setProcessing(true);

    try {
      // Fetch package details
      const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`);
      
      if (response.data.success) {
        const packageData = response.data.data.package;
        setCurrentPackage(packageData);

        // Auto-execute for collect and deliver actions
        if (action === 'collect' || action === 'deliver') {
          await executeAction(packageData);
        } else if (action === 'give_to_receiver') {
          // Show confirmation for give_to_receiver
          setShowConfirmation(true);
        }
      } else {
        addScannedPackage(
          packageCode,
          'Unknown Route',
          'error',
          response.data.message || 'Package not found'
        );
        setScanned(false);
      }
    } catch (error) {
      console.error('Failed to process package:', error);
      addScannedPackage(packageCode, 'Unknown Route', 'error', 'Failed to fetch package details');
      setScanned(false);
    } finally {
      setProcessing(false);
    }
  };

  const executeAction = async (packageData: any) => {
    try {
      const response = await api.post('/api/v1/scanning/scan_action', {
        package_code: packageData.code,
        action_type: action,
        metadata: {
          location: await getCurrentLocation(),
          device_info: getDeviceInfo()
        }
      });

      if (response.data.success) {
        addScannedPackage(
          packageData.code,
          packageData.route_description,
          'success',
          getSuccessMessage(action)
        );
      } else {
        addScannedPackage(
          packageData.code,
          packageData.route_description,
          'error',
          response.data.message || 'Action failed'
        );
      }
    } catch (error: any) {
      console.error('Action failed:', error);
      addScannedPackage(
        packageData.code,
        packageData.route_description,
        'error',
        'Network error'
      );
    }

    setCurrentPackage(null);
    setScanned(false);
  };

  const handleConfirmGiveToReceiver = async () => {
    if (!currentPackage) return;
    
    setShowConfirmation(false);
    await executeAction(currentPackage);
  };

  const addScannedPackage = (
    code: string,
    route: string,
    status: 'success' | 'error',
    message: string
  ) => {
    const newPackage: ScannedPackage = {
      code,
      route,
      status,
      message,
      timestamp: new Date(),
      action,
    };
    setScannedPackages(prev => [newPackage, ...prev]);
  };

  const getCurrentLocation = async () => {
    return null;
  };

  const getDeviceInfo = () => {
    return {
      platform: 'react-native',
      timestamp: new Date().toISOString()
    };
  };

  const getSuccessMessage = (actionType: string): string => {
    switch (actionType) {
      case 'collect': return 'Collected from agent';
      case 'deliver': return 'Marked as delivered';
      case 'give_to_receiver': return 'Given to customer';
      default: return 'Action completed';
    }
  };

  const handleComplete = () => {
    onComplete?.(scannedPackages);
    onClose();
  };

  const getActionTitle = (): string => {
    switch (action) {
      case 'collect': return 'Collect from Agent';
      case 'deliver': return 'Deliver Package';
      case 'give_to_receiver': return 'Give to Customer';
      default: return 'Scan Package';
    }
  };

  const getActionColor = (): string[] => {
    switch (action) {
      case 'collect': return ['#9C27B0', '#7B1FA2'];
      case 'deliver': return ['#34C759', '#28A745'];
      case 'give_to_receiver': return ['#FF6B35', '#E85D2F'];
      default: return ['#7B3F98', '#5A2D82'];
    }
  };

  const renderPackageItem = ({ item }: { item: ScannedPackage }) => (
    <View style={[
      styles.packageItem,
      item.status === 'error' && styles.packageItemError
    ]}>
      <View style={styles.packageHeader}>
        <View style={[
          styles.statusDot,
          { backgroundColor: item.status === 'success' ? '#34C759' : '#FF3B30' }
        ]} />
        <Text style={styles.packageCode}>{item.code}</Text>
      </View>
      <Text style={styles.packageRoute}>{item.route}</Text>
      <Text style={[
        styles.packageMessage,
        item.status === 'error' && styles.packageMessageError
      ]}>
        {item.message}
      </Text>
    </View>
  );

  if (hasPermission === null) {
    return null;
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Feather name="camera-off" size={64} color="#8E8E93" />
          <Text style={styles.permissionText}>Camera permission required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={getActionColor()}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getActionTitle()}</Text>
          <View style={styles.closeButton} />
        </LinearGradient>

        <View style={styles.content}>
          {/* Compact Scanner Area */}
          <View style={styles.scannerSection}>
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />
              <Animated.View style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </Animated.View>
            </View>

            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.processingText}>Processing...</Text>
              </View>
            )}

            <View style={styles.scanInfo}>
              <Feather name="camera" size={20} color="#7B3F98" />
              <Text style={styles.scanInfoText}>
                {scannedPackages.length === 0 
                  ? 'Position QR code in frame'
                  : `${scannedPackages.length} scanned`
                }
              </Text>
            </View>
          </View>

          {/* Scanned Packages List */}
          <View style={styles.packagesSection}>
            <View style={styles.packagesSectionHeader}>
              <Text style={styles.sectionTitle}>Scanned Packages</Text>
              {scannedPackages.length > 0 && action === 'deliver' && (
                <TouchableOpacity 
                  style={styles.deliverAllButton}
                  onPress={handleComplete}
                  disabled={batchProcessing}
                >
                  <LinearGradient
                    colors={['#34C759', '#28A745']}
                    style={styles.deliverAllGradient}
                  >
                    {batchProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="check-circle" size={16} color="#fff" />
                        <Text style={styles.deliverAllText}>
                          Deliver All ({scannedPackages.length})
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {scannedPackages.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="package" size={48} color="#4A5568" />
                <Text style={styles.emptyText}>No packages scanned</Text>
                <Text style={styles.emptySubtext}>
                  Scan QR codes to {action === 'collect' ? 'collect' : action === 'deliver' ? 'deliver' : 'give to customer'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={scannedPackages}
                keyExtractor={(item, index) => `${item.code}-${index}`}
                renderItem={renderPackageItem}
                style={styles.packagesList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>

        {/* Give to Receiver Confirmation Modal */}
        <Modal
          visible={showConfirmation}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmation(false)}
        >
          <View style={styles.confirmationOverlay}>
            <View style={styles.confirmationModal}>
              <LinearGradient
                colors={['#FF6B35', '#E85D2F']}
                style={styles.confirmationHeader}
              >
                <Feather name="user-check" size={32} color="#fff" />
                <Text style={styles.confirmationTitle}>Give to Customer?</Text>
              </LinearGradient>

              {currentPackage && (
                <View style={styles.confirmationBody}>
                  <Text style={styles.confirmationCode}>{currentPackage.code}</Text>
                  <Text style={styles.confirmationRoute}>{currentPackage.route_description}</Text>
                  <Text style={styles.confirmationReceiver}>To: {currentPackage.receiver_name}</Text>
                </View>
              )}

              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirmGiveToReceiver}
                >
                  <LinearGradient
                    colors={['#FF6B35', '#E85D2F']}
                    style={styles.confirmButtonGradient}
                  >
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowConfirmation(false);
                    setCurrentPackage(null);
                    setScanned(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scannerSection: {
    height: 200,
    backgroundColor: '#1F2C34',
    position: 'relative',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 150,
    height: 150,
    marginLeft: -75,
    marginTop: -75,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
    borderColor: '#7B3F98',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  scanInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 12,
    gap: 8,
  },
  scanInfoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  packagesSection: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  packagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  deliverAllButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  deliverAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  deliverAllText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  packagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  packageItem: {
    backgroundColor: '#1F2C34',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#34C759',
  },
  packageItemError: {
    borderLeftColor: '#FF3B30',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  packageCode: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  packageRoute: {
    color: '#B8B8B8',
    fontSize: 13,
    marginLeft: 16,
    marginBottom: 2,
  },
  packageMessage: {
    color: '#34C759',
    fontSize: 12,
    marginLeft: 16,
    fontWeight: '500',
  },
  packageMessageError: {
    color: '#FF3B30',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#B8B8B8',
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Confirmation Modal
  confirmationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmationModal: {
    backgroundColor: '#1F2C34',
    borderRadius: 16,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  confirmationHeader: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  confirmationTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  confirmationBody: {
    padding: 20,
    alignItems: 'center',
  },
  confirmationCode: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  confirmationRoute: {
    color: '#B8B8B8',
    fontSize: 14,
    marginBottom: 4,
  },
  confirmationReceiver: {
    color: '#8E8E93',
    fontSize: 13,
  },
  confirmationButtons: {
    padding: 20,
    gap: 12,
  },
  confirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#2D3748',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#B8B8B8',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Permission Screen
  permissionContainer: {
    flex: 1,
    backgroundColor: '#111B21',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#7B3F98',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default RiderScanner;
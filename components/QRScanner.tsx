// components/QRScanner.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Vibration,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

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
}

interface AvailableAction {
  action: string;
  label: string;
  description: string;
}

interface UserContext {
  role: string;
  can_collect: boolean;
  can_deliver: boolean;
  can_print: boolean;
  can_confirm: boolean;
}

interface ScanResult {
  package: Package;
  available_actions: AvailableAction[];
  user_context: UserContext;
}

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  userRole: 'agent' | 'rider' | 'customer';
  onScanSuccess?: (result: any) => void;
  defaultAction?: string; // 'collect', 'deliver', 'print', 'confirm_receipt'
}

const QRScanner: React.FC<QRScannerProps> = ({
  visible,
  onClose,
  userRole,
  onScanSuccess,
  defaultAction,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const scannerRef = useRef<any>(null);

  // Request camera permissions
  useEffect(() => {
    requestCameraPermission();
  }, []);

  // Reset scanner when modal becomes visible
  useFocusEffect(
    React.useCallback(() => {
      if (visible) {
        setScanned(false);
        setScanResult(null);
        setShowActionModal(false);
      }
    }, [visible])
  );

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    Vibration.vibrate(100);
    
    // Extract package code from QR data
    const packageCode = extractPackageCode(data);
    
    if (!packageCode) {
      Alert.alert('Invalid QR Code', 'This QR code does not contain valid package information.');
      setScanned(false);
      return;
    }

    await fetchPackageDetails(packageCode);
  };

  const extractPackageCode = (qrData: string): string | null => {
    // Handle different QR code formats
    // Format 1: Direct package code (PKG-XXXX-YYYYMMDD)
    if (qrData.match(/^PKG-[A-Z0-9]+-\d{8}$/)) {
      return qrData;
    }
    
    // Format 2: Tracking URL (https://domain.com/track/PKG-XXXX-YYYYMMDD)
    const urlMatch = qrData.match(/\/track\/([A-Z0-9-]+)$/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Format 3: JSON data containing package code
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.package_code) {
        return parsed.package_code;
      }
    } catch (e) {
      // Not JSON, continue
    }
    
    return null;
  };

  const fetchPackageDetails = async (packageCode: string) => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/v1/scanning/package_details?package_code=${packageCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`, // Implement your auth token retrieval
        },
      });

      const result = await response.json();

      if (result.success) {
        setScanResult(result.data);
        
        // If there's a default action and user can perform it, execute immediately
        if (defaultAction && result.data.available_actions.some((a: AvailableAction) => a.action === defaultAction)) {
          await performAction(defaultAction, packageCode);
        } else if (result.data.available_actions.length === 1) {
          // If only one action available, show confirmation
          setShowActionModal(true);
        } else if (result.data.available_actions.length > 1) {
          // Multiple actions, let user choose
          setShowActionModal(true);
        } else {
          // No actions available
          Alert.alert(
            'No Actions Available',
            `Package ${packageCode} is in ${result.data.package.state_display} state. No actions available for your role.`,
            [{ text: 'OK', onPress: () => setScanned(false) }]
          );
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to fetch package details');
        setScanned(false);
      }
    } catch (error) {
      Alert.alert('Network Error', 'Failed to connect to server. Please check your internet connection.');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (actionType: string, packageCode?: string) => {
    const code = packageCode || scanResult?.package.code;
    if (!code) return;

    setProcessingAction(true);

    try {
      const response = await fetch('/api/v1/scanning/scan_action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          package_code: code,
          action_type: actionType,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Vibration.vibrate([100, 50, 100]);
        
        Alert.alert(
          'Success',
          result.message,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowActionModal(false);
                setScanned(false);
                setScanResult(null);
                onScanSuccess?.(result.data);
              },
            },
          ]
        );

        // Handle special actions
        if (actionType === 'print') {
          handlePrintAction(result.data);
        }
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Network Error', 'Failed to perform action. Please try again.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePrintAction = (actionData: any) => {
    // Implement print functionality
    // This could open a print dialog or send to a thermal printer
    console.log('Print data:', actionData.print_data);
    
    // Example: Open system print dialog or send to thermal printer
    // printPackageLabel(actionData.print_data);
  };

  const getAuthToken = (): string => {
    // Implement your auth token retrieval logic
    // This could be from AsyncStorage, Redux store, etc.
    return 'your-auth-token';
  };

  const resetScanner = () => {
    setScanned(false);
    setScanResult(null);
    setShowActionModal(false);
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
  };

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.centeredContainer}>
          <MaterialIcons name="camera-alt" size={64} color="#999" />
          <Text style={styles.permissionText}>Camera permission is required to scan QR codes</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Package QR Code</Text>
          <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
            <MaterialIcons 
              name={flashEnabled ? "flash-on" : "flash-off"} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>

        {/* Scanner */}
        <View style={styles.scannerContainer}>
          <BarCodeScanner
            ref={scannerRef}
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={styles.scanner}
            flashMode={flashEnabled ? 'torch' : 'off'}
            barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
          />
          
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Reading package...</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            {userRole === 'agent' && 'Scan to print package labels'}
            {userRole === 'rider' && 'Scan to collect or deliver packages'}
            {userRole === 'customer' && 'Scan to confirm package receipt'}
          </Text>
          {scanned && (
            <TouchableOpacity style={styles.retryButton} onPress={resetScanner}>
              <MaterialIcons name="refresh" size={20} color="#007AFF" />
              <Text style={styles.retryText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Selection Modal */}
        <Modal
          visible={showActionModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.actionModal}>
              <Text style={styles.modalTitle}>Package Found</Text>
              
              {scanResult && (
                <ScrollView style={styles.packageInfo}>
                  <Text style={styles.packageCode}>{scanResult.package.code}</Text>
                  <Text style={styles.packageDetail}>
                    From: {scanResult.package.sender_name}
                  </Text>
                  <Text style={styles.packageDetail}>
                    To: {scanResult.package.receiver_name}
                  </Text>
                  <Text style={styles.packageDetail}>
                    Route: {scanResult.package.route_description}
                  </Text>
                  <Text style={styles.packageStatus}>
                    Status: {scanResult.package.state_display}
                  </Text>
                </ScrollView>
              )}

              <View style={styles.actionButtons}>
                {scanResult?.available_actions.map((action) => (
                  <TouchableOpacity
                    key={action.action}
                    style={[
                      styles.actionButton,
                      getActionButtonStyle(action.action),
                    ]}
                    onPress={() => performAction(action.action)}
                    disabled={processingAction}
                  >
                    {processingAction ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons 
                          name={getActionIcon(action.action)} 
                          size={20} 
                          color="#fff" 
                        />
                        <Text style={styles.actionButtonText}>{action.label}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowActionModal(false)}
                  disabled={processingAction}
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

const getActionButtonStyle = (action: string) => {
  switch (action) {
    case 'collect':
      return { backgroundColor: '#007AFF' };
    case 'deliver':
      return { backgroundColor: '#34C759' };
    case 'print':
      return { backgroundColor: '#FF9500' };
    case 'confirm_receipt':
      return { backgroundColor: '#5856D6' };
    default:
      return { backgroundColor: '#007AFF' };
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  instructions: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryText: {
    color: '#007AFF',
    fontSize: 14,
    marginLeft: 4,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  actionModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.7,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  packageInfo: {
    maxHeight: 200,
    marginBottom: 20,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  packageDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  packageStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default QRScanner;
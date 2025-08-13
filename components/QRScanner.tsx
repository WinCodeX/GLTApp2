// components/QRScanner.tsx - Styled with animated frame and purple theme
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Vibration,
  Dimensions,
  SafeAreaView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, Camera } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

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
  const cameraRef = useRef<CameraView>(null);
  
  // Animation values
  const cornerAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Request camera permissions
  useEffect(() => {
    requestCameraPermission();
  }, []);

  // Start animations when visible
  useEffect(() => {
    if (visible) {
      startAnimations();
    } else {
      stopAnimations();
    }
  }, [visible]);

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

  const startAnimations = () => {
    // Corner animation - rotate colors
    Animated.loop(
      Animated.sequence([
        Animated.timing(cornerAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(cornerAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopAnimations = () => {
    cornerAnimation.stopAnimation();
    pulseAnimation.stopAnimation();
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    Vibration.vibrate(100);
    
    // Extract package code from QR data
    const packageCode = extractPackageCode(data);
    
    if (!packageCode) {
      Toast.show({
        type: 'error',
        text1: 'Invalid QR Code',
        text2: 'This QR code does not contain valid package information.',
        position: 'top',
        visibilityTime: 3000,
      });
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
    
    return qrData; // Return as-is for demo
  };

  const fetchPackageDetails = async (packageCode: string) => {
    setLoading(true);
    
    try {
      // Mock data for demo
      setTimeout(() => {
        const mockResult = {
          package: {
            id: '1',
            code: packageCode,
            state: 'in_transit',
            state_display: 'In Transit',
            sender_name: 'John Doe',
            receiver_name: 'Jane Smith',
            receiver_phone: '+254700000000',
            route_description: 'Nairobi → Mombasa',
            cost: 500,
            delivery_type: 'standard',
            created_at: new Date().toISOString(),
          },
          available_actions: [
            { action: 'collect', label: 'Collect Package', description: 'Mark as collected' },
            { action: 'deliver', label: 'Mark Delivered', description: 'Mark as delivered' }
          ],
          user_context: {
            role: userRole,
            can_collect: true,
            can_deliver: true,
            can_print: true,
            can_confirm: true,
          }
        };

        setScanResult(mockResult);
        
        // If there's a default action and user can perform it, execute immediately
        if (defaultAction && mockResult.available_actions.some((a: AvailableAction) => a.action === defaultAction)) {
          performAction(defaultAction, packageCode);
        } else if (mockResult.available_actions.length === 1) {
          // If only one action available, show confirmation
          setShowActionModal(true);
        } else if (mockResult.available_actions.length > 1) {
          // Multiple actions, let user choose
          setShowActionModal(true);
        } else {
          // No actions available
          Toast.show({
            type: 'warning',
            text1: 'No Actions Available',
            text2: `Package ${packageCode} is in ${mockResult.package.state_display} state. No actions available for your role.`,
            position: 'top',
            visibilityTime: 4000,
          });
          setScanned(false);
        }
        
        setLoading(false);
      }, 1500);

      /* Actual API call:
      const response = await fetch(`/api/v1/scanning/package_details?package_code=${packageCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setScanResult(result.data);
        // ... rest of logic
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: result.message || 'Failed to fetch package details',
          position: 'top',
          visibilityTime: 4000,
        });
        setScanned(false);
      }
      */
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Failed to connect to server. Please check your internet connection.',
        position: 'top',
        visibilityTime: 4000,
      });
      setScanned(false);
      setLoading(false);
    }
  };

  const performAction = async (actionType: string, packageCode?: string) => {
    const code = packageCode || scanResult?.package.code;
    if (!code) return;

    setProcessingAction(true);

    try {
      // Mock API call
      setTimeout(() => {
        Vibration.vibrate([100, 50, 100]);
        
        Toast.show({
          type: 'success',
          text1: 'Action Successful',
          text2: `Package ${code} has been ${actionType}ed successfully`,
          position: 'top',
          visibilityTime: 3000,
        });

        setShowActionModal(false);
        setScanned(false);
        setScanResult(null);
        setProcessingAction(false);
        onScanSuccess?.({ package: { code }, action: actionType });
      }, 1000);

      /* Actual API call:
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
        
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: result.message,
          position: 'top',
          visibilityTime: 3000,
        });

        setShowActionModal(false);
        setScanned(false);
        setScanResult(null);
        onScanSuccess?.(result.data);

        if (actionType === 'print') {
          handlePrintAction(result.data);
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
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
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePrintAction = (actionData: any) => {
    console.log('Print data:', actionData.print_data);
  };

  const getAuthToken = (): string => {
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

  // Animated corner colors
  const cornerColor = cornerAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#667eea', '#764ba2', '#667eea'],
  });

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.centeredContainer}
        >
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </LinearGradient>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.centeredContainer}
        >
          <SafeAreaView style={styles.permissionContainer}>
            <MaterialIcons name="camera-alt" size={64} color="#a0aec0" />
            <Text style={styles.permissionText}>Camera permission is required to scan QR codes</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.permissionButtonGradient}
              >
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
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
        </LinearGradient>

        {/* Camera Scanner */}
        <View style={styles.scannerContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            flash={flashEnabled ? 'on' : 'off'}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
          
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            <Animated.View style={[styles.scanArea, { transform: [{ scale: pulseAnimation }] }]}>
              {/* Animated Corners */}
              <Animated.View style={[styles.corner, styles.topLeft, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.topRight, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.bottomLeft, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.bottomRight, { borderColor: cornerColor }]} />
            </Animated.View>
            
            {/* Scan instruction */}
            <Text style={styles.scanInstruction}>
              Position QR code within the frame
            </Text>
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
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.instructions}
        >
          <Text style={styles.instructionText}>
            {userRole === 'agent' && 'Scan to print package labels'}
            {userRole === 'rider' && 'Scan to collect or deliver packages'}
            {userRole === 'customer' && 'Scan to confirm package receipt'}
          </Text>
          {scanned && (
            <TouchableOpacity style={styles.retryButton} onPress={resetScanner}>
              <MaterialIcons name="refresh" size={20} color="#667eea" />
              <Text style={styles.retryText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Action Selection Modal */}
        <Modal
          visible={showActionModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.actionModal}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.modalHeader}
              >
                <Text style={styles.modalTitle}>Package Found</Text>
              </LinearGradient>
              
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
                    <LinearGradient
                      colors={getActionGradient(action.action)}
                      style={styles.actionButtonGradient}
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
                    </LinearGradient>
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
  return { borderRadius: 12, overflow: 'hidden' };
};

const getActionGradient = (action: string): string[] => {
  switch (action) {
    case 'collect':
      return ['#667eea', '#764ba2'];
    case 'deliver':
      return ['#34C759', '#30A46C'];
    case 'print':
      return ['#FF9500', '#FF8C00'];
    case 'confirm_receipt':
      return ['#764ba2', '#667eea'];
    default:
      return ['#667eea', '#764ba2'];
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
    padding: 20,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
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
    width: 300,
    height: 300,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderWidth: 5,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanInstruction: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  instructions: {
    padding: 24,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d3748',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  retryText: {
    color: '#667eea',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#a0aec0',
    marginVertical: 24,
    fontWeight: '500',
  },
  permissionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  permissionButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  actionModal: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.7,
    borderWidth: 1,
    borderTopColor: '#2d3748',
    borderLeftColor: '#2d3748',
    borderRightColor: '#2d3748',
  },
  modalHeader: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#fff',
  },
  packageInfo: {
    maxHeight: 200,
    padding: 20,
  },
  packageCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
    textAlign: 'center',
    marginBottom: 16,
  },
  packageDetail: {
    fontSize: 14,
    color: '#a0aec0',
    marginBottom: 6,
    fontWeight: '500',
  },
  packageStatus: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
  },
  actionButtons: {
    padding: 20,
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2d3748',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a5568',
  },
  cancelButtonText: {
    color: '#a0aec0',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QRScanner;
// components/QRScanner.tsx - Updated with proper rider actions

import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../lib/api';

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

interface ScanResult {
  package: Package;
  available_actions: AvailableAction[];
}

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  userRole: 'client' | 'agent' | 'rider' | 'warehouse' | 'admin';
  onScanSuccess?: (result: any) => void;
  defaultAction?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({
  visible,
  onClose,
  userRole,
  onScanSuccess,
  defaultAction,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  
  // Animation values
  const cornerAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      startAnimations();
    } else {
      stopAnimations();
    }
  }, [visible]);

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

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    Vibration.vibrate(100);
    
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
    if (qrData.match(/^PKG-[A-Z0-9]+-\d{8}$/)) {
      return qrData;
    }
    
    const urlMatch = qrData.match(/\/track\/([A-Z0-9-]+)$/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.package_code) {
        return parsed.package_code;
      }
    } catch (e) {
      // Not JSON, continue
    }
    
    return qrData;
  };

  const fetchPackageDetails = async (packageCode: string) => {
    setLoading(true);
    
    try {
      const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`);

      if (response.data.success) {
        const packageData = response.data.data;
        setScanResult(packageData);
        
        // For rider with defaultAction, automatically show the action modal
        if (userRole === 'rider' && defaultAction) {
          setShowActionModal(true);
        } else {
          setShowActionModal(true);
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Package Not Found',
          text2: response.data.message || 'Package not found in system',
          position: 'top',
          visibilityTime: 4000,
        });
        setScanned(false);
      }
      
      setLoading(false);
      
    } catch (error: any) {
      console.error('Failed to fetch package details:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Failed to connect to server. Check your internet connection.',
        position: 'top',
        visibilityTime: 4000,
      });
      setScanned(false);
      setLoading(false);
    }
  };

  const performAction = async (actionType: string) => {
    if (!scanResult) return;

    setProcessingAction(true);

    try {
      const response = await api.post('/api/v1/scanning/scan_action', {
        package_code: scanResult.package.code,
        action_type: actionType,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

      if (response.data.success) {
        Vibration.vibrate([100, 50, 100]);
        
        Toast.show({
          type: 'success',
          text1: getActionSuccessTitle(actionType),
          text2: response.data.message || getActionSuccessMessage(actionType, scanResult.package.code),
          position: 'top',
          visibilityTime: 3000,
        });

        onScanSuccess?.(response.data.data);

        setTimeout(() => {
          setShowActionModal(false);
          setScanned(false);
          setScanResult(null);
          onClose();
        }, 1500);
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
      console.error('Action failed:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Action Failed',
        text2: error.response?.data?.message || 'Failed to perform action',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const getActionSuccessTitle = (action: string): string => {
    switch (action) {
      case 'collect': return 'Package Collected';
      case 'deliver': return 'Marked as Delivered';
      case 'give_to_receiver': return 'Given to Customer';
      default: return 'Action Complete';
    }
  };

  const getActionSuccessMessage = (action: string, packageCode: string): string => {
    switch (action) {
      case 'collect': return `${packageCode} collected from agent successfully`;
      case 'deliver': return `${packageCode} marked as delivered successfully`;
      case 'give_to_receiver': return `${packageCode} handed over to customer successfully`;
      default: return `Action completed for ${packageCode}`;
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setScanResult(null);
    setShowActionModal(false);
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
  };

  const cornerColor = cornerAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#7B3F98', '#9C27B0', '#7B3F98'],
  });

  const renderRiderActions = () => {
    if (!scanResult) return null;

    return (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
          onPress={() => performAction('collect')}
          disabled={processingAction}
        >
          {processingAction ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="local-shipping" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Collect from Agent</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#34C759' }]}
          onPress={() => performAction('deliver')}
          disabled={processingAction}
        >
          {processingAction ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="check-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Mark as Delivered</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF6B35' }]}
          onPress={() => performAction('give_to_receiver')}
          disabled={processingAction}
        >
          {processingAction ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="person-pin" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Give to Customer</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setShowActionModal(false)}
          disabled={processingAction}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide">
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.centeredContainer}
        >
          <ActivityIndicator size="large" color="#7B3F98" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </LinearGradient>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.centeredContainer}
        >
          <SafeAreaView style={styles.permissionContainer}>
            <MaterialIcons name="camera-alt" size={64} color="#a0aec0" />
            <Text style={styles.permissionText}>Camera permission is required to scan QR codes</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <LinearGradient
                colors={['#7B3F98', '#9C27B0']}
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
        <LinearGradient
          colors={['#7B3F98', '#9C27B0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              Scan Package QR Code
            </Text>
          </View>
          <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
            <MaterialIcons 
              name={flashEnabled ? "flash-on" : "flash-off"} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            enableTorch={flashEnabled}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
          
          <View style={styles.overlay}>
            <Animated.View style={[styles.scanArea, { transform: [{ scale: pulseAnimation }] }]}>
              <Animated.View style={[styles.corner, styles.topLeft, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.topRight, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.bottomLeft, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.bottomRight, { borderColor: cornerColor }]} />
            </Animated.View>
            
            <Text style={styles.scanInstruction}>
              Position QR code within the frame
            </Text>
          </View>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Reading package...</Text>
            </View>
          )}
        </View>

        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.instructions}
        >
          <Text style={styles.instructionText}>
            {userRole === 'rider' 
              ? 'Scan to collect, deliver, or hand over packages'
              : 'Scan QR codes to manage packages'}
          </Text>
          {scanned && (
            <TouchableOpacity style={styles.retryButton} onPress={resetScanner}>
              <MaterialIcons name="refresh" size={20} color="#7B3F98" />
              <Text style={styles.retryText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        <Modal
          visible={showActionModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.actionModal}>
              <LinearGradient
                colors={['#7B3F98', '#9C27B0']}
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

              {renderRiderActions()}
            </View>
          </View>
        </Modal>

        <Toast />
      </SafeAreaView>
    </Modal>
  );
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
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
    borderColor: '#7B3F98',
  },
  retryText: {
    color: '#7B3F98',
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
    color: '#7B3F98',
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
    alignItems: 'center',
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
    color: '#7B3F98',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
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
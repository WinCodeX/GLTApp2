// components/agent/AgentQRScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useBluetooth } from '../../contexts/BluetoothContext';
import api from '../../lib/api';
import GlobalPrintService from '../../services/GlobalPrintService';
import OfflineScanningService from '../../services/OfflineScanningService';

const { width } = Dimensions.get('window');

interface AgentQRScannerProps {
  visible: boolean;
  onClose: () => void;
  actionType: 'collect_from_sender' | 'print';
  onScanSuccess?: (result: any) => void;
  autoPrint?: boolean;
}

const AgentQRScanner: React.FC<AgentQRScannerProps> = ({
  visible,
  onClose,
  actionType,
  onScanSuccess,
  autoPrint = true,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  const cameraRef = useRef<CameraView>(null);
  const cornerAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  const bluetoothContext = useBluetooth();
  const printService = GlobalPrintService.getInstance();
  const offlineService = OfflineScanningService.getInstance();

  useEffect(() => {
    requestCameraPermission();
  }, []);

  useEffect(() => {
    if (visible) {
      startAnimations();
      setScanned(false);
      setScanResult(null);
      setShowResultModal(false);
      setIsPrinting(false);
      checkConnectivity();
    } else {
      stopAnimations();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const checkConnectivity = async () => {
    try {
      const online = await offlineService.isOnline();
      setIsOnline(online);
    } catch (error) {
      setIsOnline(false);
    }
  };

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

    await processPackage(packageCode);
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
      // Not JSON
    }
    
    return qrData;
  };

  const processPackage = async (packageCode: string) => {
    setLoading(true);

    try {
      const online = await offlineService.isOnline();
      setIsOnline(online);

      let packageData: any;

      if (!online) {
        const cached = await offlineService.getCachedPackage(packageCode);
        if (cached) {
          packageData = cached.package;
        } else {
          throw new Error('Package not found in offline cache');
        }
      } else {
        const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`);
        
        if (response.data.success) {
          packageData = response.data.data.package;
          
          // Cache for offline use
          await offlineService.cachePackage(
            packageCode,
            packageData,
            response.data.data.available_actions
          );
        } else {
          throw new Error(response.data.message || 'Package not found');
        }
      }

      // Process based on action type
      if (actionType === 'collect_from_sender') {
        await performCollectFromSender(packageData);
      } else if (actionType === 'print') {
        await performPrint(packageData);
      }

    } catch (error: any) {
      console.error('Failed to process package:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to process package',
        position: 'top',
        visibilityTime: 3000,
      });
      
      setScanned(false);
      setLoading(false);
    }
  };

  const performCollectFromSender = async (packageData: any) => {
    try {
      const online = await offlineService.isOnline();
      
      if (!online) {
        // Store for offline sync
        const result = await offlineService.storeScanAction(
          packageData.code,
          'collect_from_sender',
          { id: 'agent', name: 'Agent', role: 'agent' },
          {
            location: null,
            device_info: { platform: 'react-native', timestamp: new Date().toISOString() }
          }
        );
        
        if (!result.success) {
          throw new Error(result.message);
        }
      } else {
        const response = await api.post('/api/v1/scanning/scan_action', {
          package_code: packageData.code,
          action_type: 'collect_from_sender',
          metadata: {
            location: null,
            device_info: { platform: 'react-native', timestamp: new Date().toISOString() }
          }
        });
        
        if (!response.data.success) {
          throw new Error(response.data.message || 'Collection failed');
        }
      }

      // Auto-print if enabled
      if (autoPrint) {
        await performPrint(packageData);
      } else {
        showSuccessResult(packageData, 'collected');
      }

    } catch (error: any) {
      throw error;
    }
  };

  const performPrint = async (packageData: any) => {
    setIsPrinting(true);

    try {
      // Check printer availability
      const availability = await printService.isPrintingAvailable(bluetoothContext);
      
      if (!availability.available) {
        throw new Error(availability.reason || 'Printer not available');
      }

      // Print the package
      const result = await printService.printPackage(bluetoothContext, {
        code: packageData.code,
        receiver_name: packageData.receiver_name,
        route_description: packageData.route_description,
        sender_name: packageData.sender_name,
        state_display: packageData.state_display,
      });

      if (!result.success) {
        throw new Error(result.message || 'Print failed');
      }

      showSuccessResult(packageData, 'printed');

    } catch (error: any) {
      console.error('Print failed:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('Bluetooth not available')) {
        errorMessage = 'Printing not available in Expo Go. Use development build.';
      } else if (error.message.includes('No printer connected')) {
        errorMessage = 'No printer connected. Connect printer in settings.';
      }
      
      Toast.show({
        type: 'error',
        text1: 'Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
      
      // Still show success for collection even if print fails
      if (actionType === 'collect_from_sender') {
        showSuccessResult(packageData, 'collected_no_print');
      } else {
        setScanned(false);
        setLoading(false);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const showSuccessResult = (packageData: any, action: string) => {
    setScanResult({
      package: packageData,
      success: true,
      action,
    });
    
    setShowResultModal(true);
    setLoading(false);
    
    Vibration.vibrate([100, 50, 100]);
    
    setTimeout(() => {
      setShowResultModal(false);
      setScanned(false);
      onScanSuccess?.(packageData);
    }, 2000);
  };

  const getActionColor = () => {
    if (actionType === 'collect_from_sender') return ['#667eea', '#764ba2'];
    if (actionType === 'print') return ['#FF9500', '#FF8C00'];
    return ['#667eea', '#764ba2'];
  };

  const getActionLabel = () => {
    if (actionType === 'collect_from_sender') return 'Collect from Sender';
    if (actionType === 'print') return 'Print Label';
    return 'Scan Package';
  };

  const cornerColor = cornerAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#667eea', '#764ba2', '#667eea'],
  });

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </LinearGradient>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.centeredContainer}>
          <SafeAreaView style={styles.permissionContainer}>
            <MaterialIcons name="camera-alt" size={64} color="#a0aec0" />
            <Text style={styles.permissionText}>Camera permission is required</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.permissionButtonGradient}>
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
          colors={getActionColor()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{getActionLabel()}</Text>
            {!isOnline && (
              <Text style={styles.offlineIndicator}>OFFLINE MODE</Text>
            )}
            {actionType !== 'print' && autoPrint && (
              <Text style={styles.autoPrintIndicator}>
                {bluetoothContext.isPrintReady 
                  ? `Auto-Print: ${bluetoothContext.connectedPrinter?.name}` 
                  : 'Auto-Print: No Printer'
                }
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setFlashEnabled(!flashEnabled)} style={styles.headerButton}>
            <MaterialIcons name={flashEnabled ? "flash-on" : "flash-off"} size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

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
          
          <View style={styles.overlay}>
            <Animated.View style={[styles.scanArea, { transform: [{ scale: pulseAnimation }] }]}>
              <Animated.View style={[styles.corner, styles.topLeft, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.topRight, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.bottomLeft, { borderColor: cornerColor }]} />
              <Animated.View style={[styles.corner, styles.bottomRight, { borderColor: cornerColor }]} />
            </Animated.View>
            
            <Text style={styles.scanInstruction}>
              Position QR code within frame
            </Text>
          </View>

          {(loading || isPrinting) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>
                {isPrinting ? 'Printing...' : 'Processing...'}
              </Text>
            </View>
          )}
        </View>

        {/* Compact Result Modal */}
        <Modal visible={showResultModal} transparent animationType="fade">
          <View style={styles.resultOverlay}>
            <View style={styles.compactResult}>
              <LinearGradient
                colors={scanResult?.success ? ['#34C759', '#28A745'] : ['#FF6B6B', '#FF5252']}
                style={styles.compactResultGradient}
              >
                <View style={styles.compactResultIcon}>
                  <MaterialIcons 
                    name={scanResult?.success ? "check-circle" : "error"} 
                    size={32} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.compactResultContent}>
                  <Text style={styles.compactResultCode}>{scanResult?.package?.code}</Text>
                  <Text style={styles.compactResultRoute}>{scanResult?.package?.route_description}</Text>
                  <Text style={styles.compactResultStatus}>
                    {scanResult?.action === 'collected' ? '✓ Collected & Printed' : 
                     scanResult?.action === 'collected_no_print' ? '✓ Collected (Print Failed)' :
                     scanResult?.action === 'printed' ? '✓ Label Printed' :
                     scanResult?.success ? '✓ Success' : '✗ Failed'}
                  </Text>
                </View>
              </LinearGradient>
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
  offlineIndicator: {
    color: '#FFB000',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  autoPrintIndicator: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
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
  resultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  compactResult: {
    width: width * 0.85,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  compactResultGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  compactResultIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactResultContent: {
    flex: 1,
  },
  compactResultCode: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  compactResultRoute: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginBottom: 6,
  },
  compactResultStatus: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default AgentQRScanner;
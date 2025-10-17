// components/RiderQRScanner.tsx - Compact rider-specific scanner

import { MaterialIcons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
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
import Toast from 'react-native-toast-message';
import api from '../lib/api';

const { width } = Dimensions.get('window');

interface RiderQRScannerProps {
  visible: boolean;
  onClose: () => void;
  actionType: 'collect' | 'deliver' | 'give_to_receiver';
  onScanSuccess?: (result: any) => void;
}

const RiderQRScanner: React.FC<RiderQRScannerProps> = ({
  visible,
  onClose,
  actionType,
  onScanSuccess,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);
  const cornerAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    requestCameraPermission();
  }, []);

  useEffect(() => {
    if (visible) {
      startAnimations();
      setScanned(false);
      setScanResult(null);
      setShowResultModal(false);
      setShowConfirmModal(false);
    } else {
      stopAnimations();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
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
      const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`);

      if (response.data.success) {
        const packageData = response.data.data.package;
        
        setScanResult({
          package: packageData,
          success: true,
        });

        // Auto-collect for collect action
        if (actionType === 'collect') {
          await performAutoCollect(packageData);
        } else if (actionType === 'give_to_receiver') {
          // Show confirmation for give to receiver
          setShowConfirmModal(true);
        } else {
          // For deliver, just show result and let parent handle batching
          setShowResultModal(true);
          setTimeout(() => {
            setShowResultModal(false);
            setScanned(false);
            onScanSuccess?.(packageData);
          }, 2000);
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

    } catch (error: any) {
      console.error('Failed to process package:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process package',
        position: 'top',
        visibilityTime: 3000,
      });
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const performAutoCollect = async (packageData: any) => {
    try {
      const response = await api.post('/api/v1/scanning/scan_action', {
        package_code: packageData.code,
        action_type: 'collect',
        metadata: {
          location: null,
          device_info: {
            platform: 'react-native',
            timestamp: new Date().toISOString()
          }
        }
      });
      
      if (response.data.success) {
        setScanResult({
          package: packageData,
          success: true,
          action: 'collected',
        });
        
        setShowResultModal(true);
        
        Vibration.vibrate([100, 50, 100]);
        
        setTimeout(() => {
          setShowResultModal(false);
          setScanned(false);
          onScanSuccess?.(packageData);
        }, 2000);
      } else {
        throw new Error(response.data.message || 'Collection failed');
      }

    } catch (error: any) {
      console.error('Auto-collect failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Collection Failed',
        text2: error.response?.data?.message || 'Failed to collect package',
        position: 'top',
        visibilityTime: 3000,
      });
      setScanned(false);
    }
  };

  const handleConfirmGiveToReceiver = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      const response = await api.post('/api/v1/scanning/scan_action', {
        package_code: scanResult.package.code,
        action_type: 'give_to_receiver',
        metadata: {
          location: null,
          device_info: {
            platform: 'react-native',
            timestamp: new Date().toISOString()
          }
        }
      });
      
      if (response.data.success) {
        setScanResult((prev: any) => ({
          ...prev,
          success: true,
          action: 'given_to_receiver',
        }));
        
        setShowResultModal(true);
        
        Vibration.vibrate([100, 50, 100]);
        
        setTimeout(() => {
          setShowResultModal(false);
          setScanned(false);
          onScanSuccess?.(scanResult.package);
        }, 2000);
      } else {
        throw new Error(response.data.message || 'Handover failed');
      }

    } catch (error: any) {
      console.error('Handover failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Handover Failed',
        text2: error.response?.data?.message || 'Failed to complete handover',
        position: 'top',
        visibilityTime: 3000,
      });
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = () => {
    switch (actionType) {
      case 'collect': return ['#9C27B0', '#7B1FA2'];
      case 'deliver': return ['#34C759', '#28A745'];
      case 'give_to_receiver': return ['#FF6B35', '#E85D2F'];
      default: return ['#667eea', '#764ba2'];
    }
  };

  const getActionLabel = () => {
    switch (actionType) {
      case 'collect': return 'Collect from Agent';
      case 'deliver': return 'Scan for Delivery';
      case 'give_to_receiver': return 'Give to Customer';
      default: return 'Scan Package';
    }
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

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Processing...</Text>
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
                    {scanResult?.action === 'collected' ? '✓ Collected Successfully' : 
                     scanResult?.action === 'given_to_receiver' ? '✓ Handed Over' :
                     scanResult?.success ? '✓ Added to Batch' : '✗ Failed'}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* Confirmation Modal for Give to Receiver */}
        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmModal}>
              <LinearGradient
                colors={['#FF6B35', '#E85D2F']}
                style={styles.confirmHeader}
              >
                <MaterialIcons name="person-pin" size={32} color="#fff" />
                <Text style={styles.confirmTitle}>Confirm Handover</Text>
              </LinearGradient>
              
              <View style={styles.confirmContent}>
                <Text style={styles.confirmCode}>{scanResult?.package?.code}</Text>
                <Text style={styles.confirmRoute}>{scanResult?.package?.route_description}</Text>
                <Text style={styles.confirmReceiver}>To: {scanResult?.package?.receiver_name}</Text>
                
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.confirmButtonPrimary]}
                    onPress={handleConfirmGiveToReceiver}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#FF6B35', '#E85D2F']}
                      style={styles.confirmButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <MaterialIcons name="check" size={18} color="#fff" />
                          <Text style={styles.confirmButtonText}>Confirm Handover</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => {
                      setShowConfirmModal(false);
                      setScanned(false);
                    }}
                    disabled={loading}
                  >
                    <View style={[styles.confirmButtonGradient, styles.cancelButton]}>
                      <MaterialIcons name="close" size={18} color="#a0aec0" />
                      <Text style={[styles.confirmButtonText, { color: '#a0aec0' }]}>Cancel</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
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
  // Compact Result Modal Styles
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
  // Confirmation Modal Styles
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d3748',
    overflow: 'hidden',
  },
  confirmHeader: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  confirmContent: {
    padding: 24,
  },
  confirmCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmRoute: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    marginBottom: 4,
  },
  confirmReceiver: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButtons: {
    gap: 12,
  },
  confirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonPrimary: {},
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#2d3748',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default RiderQRScanner;
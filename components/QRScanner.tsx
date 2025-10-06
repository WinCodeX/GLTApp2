// components/QRScanner.tsx - Updated with new action flows

import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Camera, CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
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
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useBluetooth } from '../contexts/BluetoothContext';
import api from '../lib/api';
import GlobalPrintService from '../services/GlobalPrintService';
import OfflineScanningService from '../services/OfflineScanningService';

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
  can_process: boolean;
}

interface ScanResult {
  package: Package;
  available_actions: AvailableAction[];
  user_context: UserContext;
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const cameraRef = useRef<CameraView>(null);
  
  const bluetoothContext = useBluetooth();
  
  // Animation values
  const cornerAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  const offlineService = OfflineScanningService.getInstance();
  const printService = GlobalPrintService.getInstance();

  useEffect(() => {
    requestCameraPermission();
    initializeOfflineService();
  }, []);

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
        checkConnectivity();
      }
    }, [visible])
  );

  const initializeOfflineService = async () => {
    try {
      await offlineService.initialize();
    } catch (error) {
      console.error('Failed to initialize offline service:', error);
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

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
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
    
    return qrData; // Return as-is for demo
  };

  const fetchPackageDetails = async (packageCode: string) => {
    setLoading(true);
    
    try {
      const online = await offlineService.isOnline();
      setIsOnline(online);

      if (!online) {
        const cached = await offlineService.getCachedPackage(packageCode);
        if (cached) {
          processCachedPackage(cached, packageCode);
        } else {
          showOfflineError();
        }
        return;
      }

      const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`);

      if (response.data.success) {
        const packageData = response.data.data;
        
        await offlineService.cachePackage(
          packageCode,
          packageData.package,
          packageData.available_actions
        );

        setScanResult(packageData);
        
        // Handle different action flows based on defaultAction and userRole
        if (defaultAction === 'print') {
          // For print action, automatically print after successful scan
          await handlePrintAction(packageData.package);
          setTimeout(() => {
            setScanned(false);
            setScanResult(null);
            onClose();
          }, 2000);
        } else {
          // Show action modal for user to choose
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
      
      if (error.message.includes('Network Error') || error.message.includes('timeout')) {
        const cached = await offlineService.getCachedPackage(packageCode);
        if (cached) {
          processCachedPackage(cached, packageCode);
        } else {
          showOfflineError();
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Network Error',
          text2: 'Failed to connect to server. Check your internet connection.',
          position: 'top',
          visibilityTime: 4000,
        });
        setScanned(false);
      }
      
      setLoading(false);
    }
  };

  const processCachedPackage = (cached: any, packageCode: string) => {
    setScanResult(cached);
    
    if (defaultAction === 'print') {
      handlePrintAction(cached.package);
      setTimeout(() => {
        setScanned(false);
        setScanResult(null);
        onClose();
      }, 2000);
    } else {
      setShowActionModal(true);
    }
    
    Toast.show({
      type: 'info',
      text1: 'Offline Mode',
      text2: 'Using cached data. Action will sync when online.',
      position: 'top',
      visibilityTime: 3000,
    });
    
    setLoading(false);
  };

  const showOfflineError = () => {
    Toast.show({
      type: 'error',
      text1: 'Offline Error',
      text2: 'No cached data available. Connect to internet.',
      position: 'top',
      visibilityTime: 4000,
    });
    setScanned(false);
    setLoading(false);
  };

  const performAction = async (actionType: string, packageCode?: string) => {
    const code = packageCode || scanResult?.package.code;
    if (!code) return;

    setProcessingAction(true);

    try {
      const online = await offlineService.isOnline();
      
      if (!online) {
        const user = await getCurrentUser();
        const result = await offlineService.storeScanAction(
          code,
          actionType,
          user,
          {
            location: await getCurrentLocation(),
            device_info: getDeviceInfo()
          }
        );
        
        if (result.success) {
          Toast.show({
            type: 'success',
            text1: getActionSuccessTitle(actionType),
            text2: `${getActionSuccessMessage(actionType, code)} (queued for sync)`,
            position: 'top',
            visibilityTime: 3000,
          });
          
          onScanSuccess?.({ package: { code }, action: actionType, offline: true });
          
          setTimeout(() => {
            setShowActionModal(false);
            setScanned(false);
            setScanResult(null);
            onClose();
          }, 1500);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Storage Failed',
            text2: result.message,
            position: 'top',
            visibilityTime: 4000,
          });
        }
        
        setProcessingAction(false);
        return;
      }

      // Online - make API call
      const response = await api.post('/api/v1/scanning/scan_action', {
        package_code: code,
        action_type: actionType,
        metadata: {
          location: await getCurrentLocation(),
          device_info: getDeviceInfo()
        }
      });

      if (response.data.success) {
        Vibration.vibrate([100, 50, 100]);
        
        Toast.show({
          type: 'success',
          text1: getActionSuccessTitle(actionType),
          text2: response.data.message || getActionSuccessMessage(actionType, code),
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
      
      if (error.message.includes('Network Error')) {
        const user = await getCurrentUser();
        const result = await offlineService.storeScanAction(
          code,
          actionType,
          user,
          {
            location: await getCurrentLocation(),
            device_info: getDeviceInfo()
          }
        );
        
        if (result.success) {
          Toast.show({
            type: 'info',
            text1: 'Saved Offline',
            text2: 'Action will sync when connection is restored',
            position: 'top',
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Network Error',
            text2: 'Failed to save action offline',
            position: 'top',
            visibilityTime: 4000,
          });
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Action Failed',
          text2: error.response?.data?.message || 'Failed to perform action',
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } finally {
      setProcessingAction(false);
    }
  };

  const performActionWithPrint = async (actionType: string) => {
    if (!scanResult) return;
    
    setProcessingAction(true);
    
    try {
      // First perform the action
      await performAction(actionType);
      
      // Then print the receipt
      await handlePrintAction(scanResult.package);
      
    } catch (error) {
      console.error('Action with print failed:', error);
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePrintAction = async (packageData: Package) => {
    try {
      console.log('Printing receipt for package:', packageData.code);
      
      const result = await printService.printPackage(bluetoothContext, {
        code: packageData.code,
        receiver_name: packageData.receiver_name,
        route_description: packageData.route_description,
        sender_name: packageData.sender_name,
        state_display: packageData.state_display,
      });
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      Toast.show({
        type: 'success',
        text1: 'Receipt Printed',
        text2: `Receipt printed for ${packageData.code}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
    } catch (error: any) {
      console.error('Print failed:', error);
      
      let errorMessage = 'Failed to print receipt';
      if (error.message.includes('Bluetooth not available')) {
        errorMessage = 'Printing not available in Expo Go. Use development build.';
      } else if (error.message.includes('No printer connected')) {
        errorMessage = 'No printer connected. Check Bluetooth settings.';
      } else if (error.message.includes('not connected')) {
        errorMessage = 'Printer disconnected. Reconnect and try again.';
      }
      
      Toast.show({
        type: 'error',
        text1: 'Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  const getActionSuccessTitle = (action: string): string => {
    switch (action) {
      case 'collect_from_sender': return 'Package Collected';
      case 'collect': return 'Package Collected';
      case 'deliver': return 'Delivery Confirmed';
      case 'give_to_receiver': return 'Handover Complete';
      case 'print': return 'Receipt Printed';
      case 'process': return 'Package Processed';
      case 'confirm_receipt': return 'Receipt Confirmed';
      default: return 'Action Complete';
    }
  };

  const getActionSuccessMessage = (action: string, packageCode: string): string => {
    switch (action) {
      case 'collect_from_sender': return `${packageCode} collected from sender successfully`;
      case 'collect': return `${packageCode} collected from agent successfully`;
      case 'deliver': return `${packageCode} marked as delivered successfully`;
      case 'give_to_receiver': return `${packageCode} handed over to receiver successfully`;
      case 'print': return `Receipt for ${packageCode} printed successfully`;
      case 'process': return `${packageCode} processed successfully`;
      case 'confirm_receipt': return `Receipt for ${packageCode} confirmed`;
      default: return `Action completed for ${packageCode}`;
    }
  };

  const getCurrentUser = async () => {
    try {
      const userId = await SecureStore.getItemAsync('user_id');
      const userName = await SecureStore.getItemAsync('user_name') || 'Unknown User';
      const userRole = await SecureStore.getItemAsync('user_role') || 'client';
      
      return {
        id: userId || 'unknown',
        name: userName,
        role: userRole
      };
    } catch (error) {
      return {
        id: 'unknown',
        name: 'Unknown User',
        role: userRole
      };
    }
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
    outputRange: ['#667eea', '#764ba2', '#667eea'],
  });

  const renderActionButtons = () => {
    if (!scanResult || !defaultAction) return null;

    switch (defaultAction) {
      case 'collect_from_sender':
        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#667eea' }]}
              onPress={() => performAction('collect_from_sender')}
              disabled={processingAction}
            >
              {processingAction ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="how-to-reg" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Collect Package</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#FF9500' }]}
              onPress={() => performActionWithPrint('collect_from_sender')}
              disabled={processingAction}
            >
              {processingAction ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="print" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Collect and Print</Text>
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

      case 'collect':
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
              style={[styles.actionButton, { backgroundColor: '#FF9500' }]}
              onPress={() => handlePrintAction(scanResult.package)}
              disabled={processingAction}
            >
              {processingAction ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="print" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Print</Text>
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

      case 'deliver':
        return (
          <View style={styles.actionButtons}>
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
                  <Text style={styles.actionButtonText}>Deliver Package</Text>
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

      case 'give_to_receiver':
        return (
          <View style={styles.actionButtons}>
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
                  <Text style={styles.actionButtonText}>Give to Client</Text>
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

      case 'confirm_receipt':
        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#34C759' }]}
              onPress={() => performAction('confirm_receipt')}
              disabled={processingAction}
            >
              {processingAction ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="done-all" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Confirm Receipt</Text>
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

      default:
        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowActionModal(false)}
              disabled={processingAction}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

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
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {defaultAction ? `Scan to ${getActionLabel(defaultAction)}` : 'Scan Package QR Code'}
            </Text>
            {!isOnline && (
              <Text style={styles.offlineIndicator}>OFFLINE MODE</Text>
            )}
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
            {getRoleInstructions(userRole, defaultAction)}
          </Text>
          {scanned && (
            <TouchableOpacity style={styles.retryButton} onPress={resetScanner}>
              <MaterialIcons name="refresh" size={20} color="#667eea" />
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
                colors={['#667eea', '#764ba2']}
                style={styles.modalHeader}
              >
                <Text style={styles.modalTitle}>Package Found</Text>
                {!isOnline && (
                  <Text style={styles.offlineModalIndicator}>OFFLINE MODE</Text>
                )}
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

              {renderActionButtons()}
            </View>
          </View>
        </Modal>

        <Toast />
      </SafeAreaView>
    </Modal>
  );
};

const getRoleInstructions = (role: string, defaultAction?: string): string => {
  if (defaultAction) {
    return `Scan to ${getActionLabel(defaultAction).toLowerCase()}`;
  }
  
  switch (role) {
    case 'agent': return 'Scan to collect from sender or print labels';
    case 'rider': return 'Scan to collect from agent, deliver, or give to receiver';
    case 'warehouse': return 'Scan to process packages in warehouse';
    case 'client': return 'Scan to confirm package receipt';
    case 'admin': return 'Scan to perform any package action';
    default: return 'Scan QR codes to manage packages';
  }
};

const getActionLabel = (action: string): string => {
  switch (action) {
    case 'collect_from_sender': return 'Collect from Sender';
    case 'collect': return 'Collect from Agent';
    case 'deliver': return 'Mark as Delivered';
    case 'give_to_receiver': return 'Give to Receiver';
    case 'print': return 'Print Receipt';
    case 'process': return 'Process Package';
    case 'confirm_receipt': return 'Confirm Receipt';
    default: return action;
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
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#fff',
  },
  offlineModalIndicator: {
    color: '#FFB000',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
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
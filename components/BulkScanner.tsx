// components/BulkScanner.tsx - Updated with styled confirmation modal

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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as SecureStore from 'expo-secure-store';
import QRScanner from './QRScanner';
import api from '../lib/api';
import OfflineScanningService from '../services/OfflineScanningService';
import GlobalPrintService from '../services/GlobalPrintService';
import { useBluetooth } from '../contexts/BluetoothContext';

interface ScannedPackage {
  code: string;
  sender_name: string;
  receiver_name: string;
  route_description: string;
  state: string;
  scanned_at: Date;
  processed: boolean;
  printed?: boolean;
  error?: string;
  offline?: boolean;
}

interface BulkScanResult {
  package_code: string;
  success: boolean;
  message: string;
  new_state?: string;
  printed?: boolean;
}

interface BulkScannerProps {
  visible: boolean;
  onClose: () => void;
  actionType: 'print' | 'collect' | 'collect_from_sender' | 'deliver' | 'give_to_receiver' | 'process' | 'confirm_receipt';
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
  const [printingProgress, setPrintingProgress] = useState<string>('');
  
  // Styled confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const bluetoothContext = useBluetooth();
  const offlineService = OfflineScanningService.getInstance();
  const printService = GlobalPrintService.getInstance();

  useEffect(() => {
    if (visible) {
      setScannedPackages([]);
      setManualCode('');
      setPrintingProgress('');
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
        const cached = await offlineService.getCachedPackage(packageCode);
        if (cached) {
          packageInfo = cached.package;
        }
      } else {
        try {
          const response = await api.get(`/api/v1/scanning/package_details?package_code=${packageCode}`);
          if (response.data.success) {
            packageInfo = response.data.data.package;
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

      const canPerformAction = await validatePackageAction(packageInfo, actionType);

      const newPackage: ScannedPackage = {
        code: packageCode,
        sender_name: packageInfo.sender_name || 'Unknown Sender',
        receiver_name: packageInfo.receiver_name || 'Unknown Receiver',
        route_description: packageInfo.route_description || 'Unknown Route',
        state: packageInfo.state || 'unknown',
        scanned_at: new Date(),
        processed: false,
        printed: false,
        error: canPerformAction.canPerform ? undefined : canPerformAction.reason,
        offline: !online
      };

      setScannedPackages(prev => [newPackage, ...prev]);
      setShowScanner(false);
      
      if (canPerformAction.canPerform) {
        Toast.show({
          type: 'success',
          text1: 'Package Added',
          text2: `${packageCode} added to batch${!online ? ' (offline)' : ''}`,
          position: 'top',
          visibilityTime: 2000,
        });
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Package Has Issues',
          text2: `${packageCode} added but cannot be processed: ${canPerformAction.reason}`,
          position: 'top',
          visibilityTime: 4000,
        });
      }
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
        try {
          const response = await api.post(`/api/v1/scanning/package/${packageInfo.code}/validate`, {
            action_type: action
          });
          
          if (response.data.success) {
            return {
              canPerform: response.data.data.can_execute,
              reason: response.data.data.can_execute ? undefined : 'Action not allowed in current state'
            };
          }
        } catch (error) {
          // Fall back to local validation
        }
      }
      
      return validatePackageActionLocally(packageInfo, action);
    } catch (error) {
      return validatePackageActionLocally(packageInfo, action);
    }
  };

  const validatePackageActionLocally = (packageInfo: any, action: string): {canPerform: boolean, reason?: string} => {
    const state = packageInfo.state;
    
    switch (action) {
      case 'collect_from_sender':
        return {
          canPerform: state === 'pending',
          reason: state !== 'pending' ? `Cannot collect from sender - package is ${state}` : undefined
        };
      case 'collect':
        return {
          canPerform: state === 'submitted',
          reason: state !== 'submitted' ? `Cannot collect from agent - package is ${state}` : undefined
        };
      case 'deliver':
        return {
          canPerform: state === 'in_transit',
          reason: state !== 'in_transit' ? `Cannot mark as delivered - package is ${state}` : undefined
        };
      case 'give_to_receiver':
        return {
          canPerform: ['in_transit', 'delivered'].includes(state),
          reason: !['in_transit', 'delivered'].includes(state) 
            ? `Cannot give to receiver - package is ${state}` 
            : undefined
        };
      case 'confirm_receipt':
        return {
          canPerform: state === 'delivered',
          reason: state !== 'delivered' ? `Cannot confirm receipt - package is ${state}` : undefined
        };
      case 'print':
        return {
          canPerform: ['pending', 'submitted', 'in_transit', 'delivered'].includes(state),
          reason: !['pending', 'submitted', 'in_transit', 'delivered'].includes(state) 
            ? `Cannot print package in ${state} state` 
            : undefined
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

    const confirmationMessage = getConfirmationMessage(actionType, validPackages.length);
    const offlineNote = !isOnline ? '\n\nNote: You are offline. Actions will be queued for sync.' : '';
    const printerNote = actionType === 'print' && !bluetoothContext.isPrintReady 
      ? '\n\nWarning: No printer connected. Print operations will be queued but not printed.' 
      : '';

    // Use styled modal instead of Alert.alert
    setConfirmationConfig({
      title: 'Confirm Bulk Action',
      message: `${confirmationMessage}${offlineNote}${printerNote}`,
      onConfirm: performBulkAction,
    });
    setShowConfirmationModal(true);
  };

  const getConfirmationMessage = (action: string, count: number): string => {
    switch (action) {
      case 'collect_from_sender':
        return `Collect ${count} package${count !== 1 ? 's' : ''} from sender${count !== 1 ? 's' : ''}?`;
      case 'collect':
        return `Collect ${count} package${count !== 1 ? 's' : ''} from agent${count !== 1 ? 's' : ''}?`;
      case 'deliver':
        return `Mark ${count} package${count !== 1 ? 's' : ''} as delivered?`;
      case 'give_to_receiver':
        return `Give ${count} package${count !== 1 ? 's' : ''} to receiver${count !== 1 ? 's' : ''}?`;
      case 'print':
        return `Print receipt${count !== 1 ? 's' : ''} for ${count} package${count !== 1 ? 's' : ''}?`;
      case 'process':
        return `Process ${count} package${count !== 1 ? 's' : ''} in warehouse?`;
      case 'confirm_receipt':
        return `Confirm receipt of ${count} package${count !== 1 ? 's' : ''}?`;
      default:
        return `Process ${count} package${count !== 1 ? 's' : ''}?`;
    }
  };

  const performBulkAction = async () => {
    setShowConfirmationModal(false);
    setProcessing(true);
    setPrintingProgress('');
    
    const validPackages = scannedPackages.filter(pkg => !pkg.error);
    const packageCodes = validPackages.map(pkg => pkg.code);

    try {
      const online = await offlineService.isOnline();
      
      if (!online) {
        await processBulkOffline(packageCodes, validPackages);
      } else {
        await processBulkOnline(packageCodes, validPackages);
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
      setPrintingProgress('');
    }
  };

  const processBulkPrint = async (packages: ScannedPackage[]): Promise<{successCount: number, failCount: number}> => {
    let successCount = 0;
    let failCount = 0;
    
    // Check if printing is available before starting
    const availability = await printService.isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      console.warn('Printing not available:', availability.reason);
      
      // Set all packages as failed to print
      packages.forEach(pkg => {
        setScannedPackages(prev => prev.map(p => 
          p.code === pkg.code 
            ? { ...p, error: `Print not available: ${availability.reason}` } 
            : p
        ));
      });
      
      return { successCount: 0, failCount: packages.length };
    }
    
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      
      try {
        setPrintingProgress(`Printing ${i + 1} of ${packages.length}: ${pkg.code}`);
        
        const result = await printService.printPackage(bluetoothContext, {
          code: pkg.code,
          receiver_name: pkg.receiver_name,
          route_description: pkg.route_description,
          sender_name: pkg.sender_name,
        });
        
        if (result.success) {
          successCount++;
          
          setScannedPackages(prev => prev.map(p => 
            p.code === pkg.code ? { ...p, printed: true } : p
          ));
        } else {
          throw new Error(result.message);
        }
        
        // Small delay between prints
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`Failed to print ${pkg.code}:`, error);
        failCount++;
        
        setScannedPackages(prev => prev.map(p => 
          p.code === pkg.code 
            ? { ...p, error: `Print failed: ${error.message || 'Unknown error'}` } 
            : p
        ));
      }
    }
    
    return { successCount, failCount };
  };

  const processBulkOffline = async (packageCodes: string[], packages: ScannedPackage[]) => {
    const results: BulkScanResult[] = [];
    let printResults = { successCount: 0, failCount: 0 };

    if (actionType === 'print') {
      setPrintingProgress('Starting bulk print...');
      printResults = await processBulkPrint(packages);
    }

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

        const packagePrinted = actionType === 'print' ? 
          packages.find(p => p.code === code)?.printed || false : false;

        results.push({
          package_code: code,
          success: result.success,
          message: result.success ? 'Queued for sync' : result.message,
          printed: packagePrinted
        });

        if (result.success) {
          setScannedPackages(prev => prev.map(pkg => 
            pkg.code === code ? { ...pkg, processed: true, offline: true } : pkg
          ));
        }
      } catch (error) {
        results.push({
          package_code: code,
          success: false,
          message: 'Failed to queue offline',
          printed: false
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    
    if (actionType === 'print') {
      if (printResults.failCount === 0 && successful === packageCodes.length) {
        Toast.show({
          type: 'success',
          text1: 'Bulk Print Complete',
          text2: `Successfully printed all ${printResults.successCount} receipts and queued for sync`,
          position: 'top',
          visibilityTime: 5000,
        });
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Bulk Print Partial',
          text2: `${printResults.successCount} printed, ${printResults.failCount} failed. ${successful} queued for sync.`,
          position: 'top',
          visibilityTime: 6000,
        });
      }
    } else {
      if (successful === packageCodes.length) {
        Toast.show({
          type: 'success',
          text1: 'Queued for Sync',
          text2: `All ${successful} ${getActionLabel(actionType).toLowerCase()} actions queued for sync`,
          position: 'top',
          visibilityTime: 4000,
        });
      } else {
        Toast.show({
          type: 'warning',
          text1: 'Partially Queued',
          text2: `${successful} of ${packageCodes.length} actions queued for sync`,
          position: 'top',
          visibilityTime: 5000,
        });
      }
    }

    onBulkComplete?.(results);
    setTimeout(() => onClose(), 2000);
  };

  const processBulkOnline = async (packageCodes: string[], packages: ScannedPackage[]) => {
    try {
      let printResults = { successCount: 0, failCount: 0 };

      if (actionType === 'print') {
        setPrintingProgress('Starting bulk print...');
        printResults = await processBulkPrint(packages);
      }

      setPrintingProgress('Syncing with server...');
      
      const response = await api.post('/api/v1/scanning/bulk_scan', {
        package_codes: packageCodes,
        action_type: actionType,
        metadata: {
          bulk_operation: true,
          location: await getCurrentLocation(),
          device_info: getDeviceInfo(),
          print_results: actionType === 'print' ? printResults : undefined
        }
      });

      if (response.data.success) {
        const results = response.data.data.results;
        
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

        if (actionType === 'print') {
          if (printResults.failCount === 0 && successful === total) {
            Toast.show({
              type: 'success',
              text1: 'Bulk Print Complete',
              text2: `Successfully printed and processed all ${total} packages`,
              position: 'top',
              visibilityTime: 4000,
            });
          } else {
            Toast.show({
              type: 'warning',
              text1: 'Bulk Print Issues',
              text2: `${printResults.successCount} printed, ${printResults.failCount} print failures. ${successful}/${total} processed.`,
              position: 'top',
              visibilityTime: 6000,
            });
          }
        } else {
          if (successful === total) {
            Toast.show({
              type: 'success',
              text1: `Bulk ${getActionLabel(actionType)} Complete`,
              text2: `Successfully processed all ${total} packages`,
              position: 'top',
              visibilityTime: 4000,
            });
          } else {
            Toast.show({
              type: 'warning',
              text1: `Bulk ${getActionLabel(actionType)} Partial`,
              text2: `${successful} of ${total} packages processed successfully`,
              position: 'top',
              visibilityTime: 5000,
            });
          }
        }

        onBulkComplete?.(results);

        if (successful === total && (actionType !== 'print' || printResults.failCount === 0)) {
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
      case 'collect_from_sender': return 'Collection from Sender';
      case 'collect': return 'Collection from Agent';
      case 'deliver': return 'Delivery';
      case 'give_to_receiver': return 'Handover to Receiver';
      case 'print': return 'Print';
      case 'process': return 'Processing';
      case 'confirm_receipt': return 'Receipt Confirmation';
      default: return action;
    }
  };

  const getActionColor = (action: string): string[] => {
    switch (action) {
      case 'collect_from_sender':
      case 'collect': return ['#667eea', '#764ba2'];
      case 'deliver': return ['#34C759', '#30A46C'];
      case 'give_to_receiver': return ['#FF6B35', '#FF5722'];
      case 'print': return ['#FF9500', '#FF8C00'];
      case 'process': return ['#9C27B0', '#673AB7'];
      case 'confirm_receipt': return ['#764ba2', '#667eea'];
      default: return ['#667eea', '#764ba2'];
    }
  };

  const getActionIcon = (action: string): keyof typeof MaterialIcons.glyphMap => {
    switch (action) {
      case 'collect_from_sender': return 'how-to-reg';
      case 'collect': return 'local-shipping';
      case 'deliver': return 'check-circle';
      case 'give_to_receiver': return 'person-pin';
      case 'print': return 'print';
      case 'process': return 'inventory';
      case 'confirm_receipt': return 'done-all';
      default: return 'check';
    }
  };

  const renderPackageItem = ({ item }: { item: ScannedPackage }) => (
    <View style={[
      styles.packageItem, 
      item.error && styles.packageItemError,
      item.offline && styles.packageItemOffline,
      item.printed && styles.packageItemPrinted
    ]}>
      <View style={styles.packageHeader}>
        <View style={styles.packageCodeContainer}>
          <Text style={styles.packageCode}>{item.code}</Text>
          <View style={styles.packageIcons}>
            {item.printed && (
              <MaterialIcons name="print" size={16} color="#34C759" />
            )}
            {item.offline && (
              <MaterialIcons name="cloud-off" size={16} color="#FFB000" />
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => removePackage(item.code)} style={styles.removeButton}>
          <MaterialIcons name="close" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.packageRoute}>{item.route_description}</Text>
      <Text style={styles.packageDetails}>
        From: {item.sender_name} → To: {item.receiver_name}
      </Text>
      <Text style={styles.packageState}>
        Current State: {item.state.replace('_', ' ').toUpperCase()}
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
              {actionType === 'print' && (
                <Text style={styles.printerHeaderIndicator}>
                  {bluetoothContext.isPrintReady 
                    ? `Printer: ${bluetoothContext.connectedPrinter?.name}` 
                    : 'No Printer Connected'
                  }
                </Text>
              )}
            </View>
            <View style={styles.headerButton} />
          </LinearGradient>

          <View style={styles.content}>
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

            {processing && printingProgress && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color="#667eea" />
                <Text style={styles.progressText}>{printingProgress}</Text>
              </View>
            )}

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
                    Scan QR codes to add packages for bulk {getActionLabel(actionType).toLowerCase()}
                    {!isOnline && ' (offline mode active)'}
                  </Text>
                </View>
              }
            />

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
                          name={!isOnline ? "cloud-queue" : getActionIcon(actionType)} 
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

          {/* Styled Confirmation Modal */}
          <Modal visible={showConfirmationModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.confirmationModal}>
                <LinearGradient
                  colors={getActionColor(actionType)}
                  style={styles.confirmationHeader}
                >
                  <MaterialIcons name={getActionIcon(actionType)} size={32} color="#fff" />
                  <Text style={styles.confirmationTitle}>{confirmationConfig.title}</Text>
                </LinearGradient>
                
                <View style={styles.confirmationContent}>
                  <Text style={styles.confirmationMessage}>{confirmationConfig.message}</Text>
                  
                  <View style={styles.confirmationButtons}>
                    <TouchableOpacity
                      style={styles.confirmationButton}
                      onPress={confirmationConfig.onConfirm}
                    >
                      <LinearGradient
                        colors={getActionColor(actionType)}
                        style={styles.confirmationButtonGradient}
                      >
                        <MaterialIcons name="check" size={18} color="#fff" />
                        <Text style={styles.confirmationButtonText}>Proceed</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.confirmationButton}
                      onPress={() => setShowConfirmationModal(false)}
                    >
                      <View style={[styles.confirmationButtonGradient, styles.cancelConfirmationButton]}>
                        <MaterialIcons name="close" size={18} color="#a0aec0" />
                        <Text style={[styles.confirmationButtonText, { color: '#a0aec0' }]}>
                          Cancel
                        </Text>
                      </View>
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
  printerHeaderIndicator: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  progressText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
  packageItemPrinted: {
    borderRightWidth: 4,
    borderRightColor: '#34C759',
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
  packageIcons: {
    flexDirection: 'row',
    gap: 4,
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
    marginBottom: 4,
    fontWeight: '500',
  },
  packageState: {
    fontSize: 12,
    color: '#34C759',
    marginBottom: 8,
    fontWeight: '600',
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
  
  // Styled confirmation modal styles
  confirmationModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d3748',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmationHeader: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  confirmationContent: {
    padding: 24,
  },
  confirmationMessage: {
    fontSize: 16,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  confirmationButtons: {
    gap: 12,
  },
  confirmationButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  cancelConfirmationButton: {
    backgroundColor: '#2d3748',
  },
  confirmationButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default BulkScanner;
// app/admin/settings.tsx - Updated with new Bluetooth Store integration
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminLayout from '../../components/AdminLayout';

// NEW: Import the new Bluetooth store and print hooks
import { 
  useBluetoothStore, 
  useBluetoothInitialization, 
  usePrinterConnection,
  BluetoothDevice 
} from '../../stores/BluetoothStore';
import { usePrintService, useQuickPrint } from '../../hooks/usePrintService';

interface AppInfo {
  version: string;
  buildNumber: string;
  lastUpdate: string;
}

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  
  // NEW: Use the centralized Bluetooth store
  const {
    isInitialized,
    classicEnabled,
    bleEnabled,
    permissionsGranted,
    isScanning,
    devices,
    connectedDevices,
    startDeviceScan,
    stopDeviceScan,
    connectToDevice,
    disconnectDevice,
    disconnectAllDevices,
    refreshConnections,
    requestPermissions,
  } = useBluetoothStore();

  const { printer, connect: connectPrinter, disconnect: disconnectPrinter } = usePrinterConnection();
  const { printStatus, refreshPrinterStatus } = usePrintService();
  const { quickTestPrint } = useQuickPrint();
  
  // Initialize Bluetooth on mount
  const bluetoothInitialized = useBluetoothInitialization();

  // Local state for UI
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [checkingConnection, setCheckingConnection] = useState(false);

  const appInfo: AppInfo = {
    version: '2.1.0',
    buildNumber: '2024.08.14',
    lastUpdate: 'August 14, 2024',
  };

  useEffect(() => {
    loadStoredSettings();
  }, []);

  useEffect(() => {
    // Refresh printer status when connections change
    if (isInitialized) {
      refreshPrinterStatus();
    }
  }, [isInitialized, connectedDevices, refreshPrinterStatus]);

  const loadStoredSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('app_settings');
      if (storedSettings) {
        const settings = JSON.parse(storedSettings);
        setNotifications(settings.notifications ?? true);
        setAutoSync(settings.autoSync ?? true);
        setDarkMode(settings.darkMode ?? true);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const settings = {
        notifications,
        autoSync,
        darkMode,
      };
      await AsyncStorage.setItem('app_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // NEW: Enhanced Bluetooth toggle using the store
  const handleBluetoothToggle = async (value: boolean) => {
    if (!permissionsGranted) {
      const granted = await requestPermissions();
      if (!granted) {
        Toast.show({
          type: 'error',
          text1: 'Permissions Required',
          text2: 'Bluetooth permissions are required to enable Bluetooth',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }
    }

    if (value && (!classicEnabled && !bleEnabled)) {
      Toast.show({
        type: 'info',
        text1: 'Enable Bluetooth',
        text2: 'Please enable Bluetooth in your device settings',
        position: 'top',
        visibilityTime: 4000,
      });
    } else if (!value) {
      // Disconnect all devices when disabling
      await disconnectAllDevices();
      Toast.show({
        type: 'info',
        text1: 'Bluetooth Disabled',
        text2: 'All Bluetooth connections have been closed',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // NEW: Enhanced printer connection using the store
  const handlePrinterConnect = async () => {
    if (!isInitialized) {
      Toast.show({
        type: 'warning',
        text1: 'Bluetooth Not Ready',
        text2: 'Please wait for Bluetooth initialization',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    if (!classicEnabled && !bleEnabled) {
      Toast.show({
        type: 'warning',
        text1: 'Bluetooth Required',
        text2: 'Please enable Bluetooth first',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    if (!permissionsGranted) {
      const granted = await requestPermissions();
      if (!granted) {
        Toast.show({
          type: 'error',
          text1: 'Permissions Required',
          text2: 'Bluetooth permissions are required to scan for devices',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }
    }

    setShowDeviceModal(true);
    await scanForDevices();
  };

  // NEW: Enhanced printer disconnection
  const handlePrinterDisconnect = async () => {
    if (!printer.device) {
      Toast.show({
        type: 'warning',
        text1: 'No Printer Connected',
        text2: 'No printer to disconnect',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      console.log('🔌 Disconnecting printer:', printer.device.name);
      await disconnectPrinter();
      
      Toast.show({
        type: 'success',
        text1: 'Printer Disconnected',
        text2: 'Printer has been disconnected successfully',
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      console.error('Failed to disconnect printer:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Disconnect Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // NEW: Use the store's scanning functionality
  const scanForDevices = async () => {
    if (!permissionsGranted) {
      await requestPermissions();
      return;
    }

    try {
      await startDeviceScan();
      
      Toast.show({
        type: 'info',
        text1: 'Scanning Complete',
        text2: `Found ${devices.length} devices`,
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error: any) {
      console.error('Failed to scan for devices:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Scan Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // NEW: Enhanced device connection using the store
  const connectToDeviceHandler = async (device: BluetoothDevice) => {
    try {
      console.log('🔌 Connecting to device:', device.name, device.type);
      
      Toast.show({
        type: 'info',
        text1: 'Connecting...',
        text2: `Connecting to ${device.name}`,
        position: 'top',
        visibilityTime: 2000,
      });

      const connected = await connectToDevice(device);
      
      if (connected) {
        // If it's a printer, also set it as the active printer
        if (device.deviceType === 'printer') {
          await connectPrinter(device);
        }

        setShowDeviceModal(false);

        Toast.show({
          type: 'success',
          text1: 'Device Connected',
          text2: `Successfully connected to ${device.name}`,
          position: 'top',
          visibilityTime: 3000,
        });
      } else {
        throw new Error('Connection failed');
      }
    } catch (error: any) {
      console.error('Failed to connect to device:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: `Failed to connect to ${device.name}: ${error.message}`,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // NEW: Enhanced device disconnection
  const disconnectDeviceHandler = async (device: BluetoothDevice) => {
    try {
      await disconnectDevice(device);

      Toast.show({
        type: 'info',
        text1: 'Device Disconnected',
        text2: `Disconnected from ${device.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      console.error('Failed to disconnect device:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Disconnection Failed',
        text2: `Failed to disconnect from ${device.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // NEW: Enhanced test print using the new service
  const testPrinterConnection = async () => {
    try {
      await quickTestPrint();
    } catch (error: any) {
      // Error handling is done in the hook
      console.error('Test print failed:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await disconnectAllDevices();
            
            Toast.show({
              type: 'success',
              text1: 'Logged Out',
              text2: 'You have been successfully logged out',
              position: 'top',
              visibilityTime: 3000,
            });
            router.replace('/login');
          },
        },
      ]
    );
  };

  // NEW: Enhanced troubleshooting with store cleanup
  const handleTroubleshoot = async () => {
    Toast.show({
      type: 'info',
      text1: 'Running Diagnostics',
      text2: 'Checking app performance and connectivity...',
      position: 'top',
      visibilityTime: 4000,
    });

    try {
      // Disconnect all devices
      await disconnectAllDevices();
      
      // Clear stored data
      await AsyncStorage.multiRemove(['connected_printer', 'bluetooth_cache', 'bluetooth_stored_printer']);
      
      // Refresh connections
      await refreshConnections();
      
      Toast.show({
        type: 'success',
        text1: 'Diagnostics Complete',
        text2: 'Cache cleared and connections reset',
        position: 'top',
        visibilityTime: 4000,
      });
    } catch (error: any) {
      console.error('Troubleshoot failed:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Diagnostics Failed',
        text2: 'Failed to complete diagnostic checks',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  useEffect(() => {
    saveSettings();
  }, [notifications, autoSync, darkMode]);

  const renderSettingItem = (
    icon: keyof typeof MaterialIcons.glyphMap,
    title: string,
    subtitle: string,
    rightComponent: React.ReactNode,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={icon} size={24} color="#667eea" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {rightComponent}
    </TouchableOpacity>
  );

  // NEW: Enhanced printer connection display
  const renderPrinterConnectionSetting = () => {
    const hasValidConnection = printer.isConnected && printer.device;
    
    let statusText = 'No printer connected';
    if (hasValidConnection) {
      statusText = `Connected to ${printer.device.name} (${printer.device.type.toUpperCase()})`;
    } else if (!isInitialized) {
      statusText = 'Initializing Bluetooth...';
    } else if (!classicEnabled && !bleEnabled) {
      statusText = 'Bluetooth disabled';
    } else if (!permissionsGranted) {
      statusText = 'Permissions required';
    }
    
    return renderSettingItem(
      'print',
      'Printer Connection',
      statusText,
      <View style={styles.printerActions}>
        {hasValidConnection ? (
          // When printer is connected, show Test and Disconnect buttons
          <>
            <TouchableOpacity
              style={styles.testButton}
              onPress={testPrinterConnection}
              disabled={checkingConnection || printStatus.isPrinting}
            >
              <LinearGradient
                colors={['#34C759', '#30A46C']}
                style={styles.testButtonGradient}
              >
                <Text style={styles.testButtonText}>
                  {printStatus.isPrinting ? 'Printing...' : 'Test'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handlePrinterDisconnect}
              disabled={checkingConnection || printStatus.isPrinting}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF5252']}
                style={styles.disconnectButtonGradient}
              >
                <Text style={styles.disconnectButtonText}>
                  Disconnect
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          // When no printer is connected, show Connect button
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handlePrinterConnect}
            disabled={!isInitialized || (!classicEnabled && !bleEnabled) || checkingConnection}
          >
            <LinearGradient
              colors={(!isInitialized || (!classicEnabled && !bleEnabled)) ? ['#718096', '#a0aec0'] : ['#667eea', '#764ba2']}
              style={styles.connectButtonGradient}
            >
              <Text style={styles.connectButtonText}>
                {!isInitialized ? 'Loading...' : checkingConnection ? 'Checking...' : 'Connect'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // NEW: Enhanced refresh function
  const refreshConnectionStatus = async () => {
    if (!isInitialized) return;
    
    setCheckingConnection(true);
    
    try {
      console.log('🔄 Manual refresh of connection status...');
      
      await refreshConnections();
      await refreshPrinterStatus();
      
      Toast.show({
        type: 'info',
        text1: 'Status Refreshed',
        text2: 'Connection status updated',
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error: any) {
      console.error('Failed to refresh connection status:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Refresh Failed',
        text2: 'Could not refresh connection status',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setCheckingConnection(false);
    }
  };

  // NEW: Enhanced device item rendering
  const renderDeviceItem = ({ item }: { item: BluetoothDevice }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => item.connected ? disconnectDeviceHandler(item) : connectToDeviceHandler(item)}
    >
      <View style={styles.deviceInfo}>
        <MaterialIcons
          name={
            item.deviceType === 'printer' ? 'print' : 
            item.deviceType === 'scanner' ? 'qr-code-scanner' : 
            item.type === 'ble' ? 'bluetooth' : 'bluetooth-connected'
          }
          size={24}
          color={item.connected ? '#34C759' : '#a0aec0'}
        />
        <View style={styles.deviceText}>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={styles.deviceStatus}>
            {item.connected ? 'Connected' : 
             item.bondState === 'bonded' ? 'Paired' : 'Available'} • 
            {item.type.toUpperCase()} • {item.deviceType}
          </Text>
          <Text style={styles.deviceAddress}>{item.address}</Text>
          {item.rssi && (
            <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
          )}
          {item.services && item.services.length > 0 && (
            <Text style={styles.deviceServices}>
              Services: {item.services.length}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.deviceStatusBadge, { backgroundColor: item.connected ? '#34C759' : '#718096' }]}>
        <Text style={styles.deviceStatusText}>
          {item.connected ? 'Connected' : 'Connect'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Bluetooth Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bluetooth System</Text>
          {isInitialized && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshConnectionStatus}
              disabled={checkingConnection}
            >
              <MaterialIcons 
                name="refresh" 
                size={20} 
                color={checkingConnection ? '#718096' : '#667eea'} 
              />
            </TouchableOpacity>
          )}
        </View>

        {/* NEW: System status display */}
        {renderSettingItem(
          'bluetooth',
          'Bluetooth Status',
          !isInitialized ? 'Initializing...' :
          !permissionsGranted ? 'Permissions required' :
          (classicEnabled || bleEnabled) ? `Classic: ${classicEnabled ? 'ON' : 'OFF'} • BLE: ${bleEnabled ? 'ON' : 'OFF'}` :
          'Bluetooth disabled',
          <View style={styles.bluetoothStatus}>
            {isInitialized && (
              <>
                {classicEnabled && (
                  <View style={[styles.statusBadge, { backgroundColor: '#34C759' }]}>
                    <Text style={styles.statusBadgeText}>Classic</Text>
                  </View>
                )}
                {bleEnabled && (
                  <View style={[styles.statusBadge, { backgroundColor: '#667eea' }]}>
                    <Text style={styles.statusBadgeText}>BLE</Text>
                  </View>
                )}
                {!classicEnabled && !bleEnabled && (
                  <View style={[styles.statusBadge, { backgroundColor: '#FF6B6B' }]}>
                    <Text style={styles.statusBadgeText}>Disabled</Text>
                  </View>
                )}
              </>
            )}
          </View>,
          () => handleBluetoothToggle(!classicEnabled && !bleEnabled)
        )}

        {/* NEW: Connection summary */}
        {isInitialized && (
          renderSettingItem(
            'devices',
            'Connected Devices',
            `${connectedDevices.length} device${connectedDevices.length !== 1 ? 's' : ''} connected`,
            <Text style={styles.deviceCountText}>{connectedDevices.length}</Text>
          )
        )}

        {/* Enhanced printer connection setting */}
        {renderPrinterConnectionSetting()}
      </View>

      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>

        {renderSettingItem(
          'notifications',
          'Push Notifications',
          notifications ? 'Notifications are enabled' : 'Notifications are disabled',
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#2d3748', true: '#667eea' }}
            thumbColor={notifications ? '#764ba2' : '#a0aec0'}
            ios_backgroundColor="#2d3748"
          />
        )}

        {renderSettingItem(
          'sync',
          'Auto Sync',
          autoSync ? 'Data syncs automatically' : 'Manual sync required',
          <Switch
            value={autoSync}
            onValueChange={setAutoSync}
            trackColor={{ false: '#2d3748', true: '#667eea' }}
            thumbColor={autoSync ? '#764ba2' : '#a0aec0'}
            ios_backgroundColor="#2d3748"
          />
        )}

        {renderSettingItem(
          'palette',
          'Dark Mode',
          darkMode ? 'Dark theme enabled' : 'Light theme enabled',
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: '#2d3748', true: '#667eea' }}
            thumbColor={darkMode ? '#764ba2' : '#a0aec0'}
            ios_backgroundColor="#2d3748"
          />
        )}
      </View>

      {/* Admin Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin</Text>

        {renderSettingItem(
          'people',
          'User Management',
          'Manage users and permissions',
          <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />,
          () => router.push('/admin/user-management')
        )}

        {renderSettingItem(
          'security',
          'Security Settings',
          'Password and security options',
          <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />,
          () => router.push('/admin/security-settings')
        )}

        {renderSettingItem(
          'backup',
          'Backup & Restore',
          'Data backup and recovery options',
          <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />,
          () => router.push('/admin/backup-settings')
        )}
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        {renderSettingItem(
          'logout',
          'Logout',
          'Sign out of the account',
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF5252']}
              style={styles.logoutButtonGradient}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* About App Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About App</Text>

        {renderSettingItem(
          'info',
          'App Version',
          `Current app version: ${appInfo.version}`,
          <Text style={styles.versionText}>{appInfo.version}</Text>
        )}

        {renderSettingItem(
          'build',
          'Build Number',
          `Build: ${appInfo.buildNumber}`,
          <Text style={styles.versionText}>{appInfo.buildNumber}</Text>
        )}

        {renderSettingItem(
          'refresh',
          'Troubleshoot App',
          'Run diagnostics and clear cache',
          <TouchableOpacity
            style={styles.troubleshootButton}
            onPress={handleTroubleshoot}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.troubleshootButtonGradient}
            >
              <Text style={styles.troubleshootButtonText}>Run</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {renderSettingItem(
          'help',
          'Help & Support',
          'Get help and contact support',
          <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />,
          () => router.push('/admin/help-support')
        )}
      </View>

      {/* Device Modal */}
      <Modal
        visible={showDeviceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeviceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deviceModal}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Available Devices</Text>
              <TouchableOpacity
                onPress={() => setShowDeviceModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalContent}>
              {!permissionsGranted && (
                <View style={styles.permissionWarning}>
                  <MaterialIcons name="warning" size={24} color="#FF9500" />
                  <Text style={styles.permissionWarningText}>
                    Bluetooth permissions required to scan for devices
                  </Text>
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={requestPermissions}
                  >
                    <Text style={styles.permissionButtonText}>Grant Permissions</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isScanning ? (
                <View style={styles.scanningContainer}>
                  <ActivityIndicator size="large" color="#667eea" />
                  <Text style={styles.scanningText}>Scanning for devices...</Text>
                </View>
              ) : (
                <FlatList
                  data={devices}
                  keyExtractor={(item) => item.id}
                  renderItem={renderDeviceItem}
                  style={styles.deviceList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyDeviceList}>
                      <MaterialIcons name="bluetooth-disabled" size={48} color="#a0aec0" />
                      <Text style={styles.emptyDeviceText}>No devices found</Text>
                      <Text style={styles.emptyDeviceSubtext}>
                        Make sure your devices are discoverable and try scanning again
                      </Text>
                    </View>
                  }
                />
              )}

              <TouchableOpacity
                style={styles.rescanButton}
                onPress={scanForDevices}
                disabled={isScanning || !permissionsGranted}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.rescanButtonGradient}
                >
                  <MaterialIcons name="refresh" size={20} color="#fff" />
                  <Text style={styles.rescanButtonText}>
                    {isScanning ? 'Scanning...' : 'Rescan'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  return (
    <AdminLayout activePanel="settings">
      {renderContent()}
    </AdminLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  settingItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2d3748',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16213e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#a0aec0',
    fontWeight: '500',
  },
  
  // NEW: Enhanced status display
  bluetoothStatus: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  deviceCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  
  printerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  testButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  testButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  connectButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  connectButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  disconnectButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  disconnectButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  troubleshootButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  troubleshootButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  troubleshootButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  deviceModal: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    borderWidth: 1,
    borderTopColor: '#2d3748',
    borderLeftColor: '#2d3748',
    borderRightColor: '#2d3748',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  permissionWarning: {
    backgroundColor: '#2d1810',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    marginVertical: 12,
    fontWeight: '500',
  },
  permissionButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanningText: {
    fontSize: 16,
    color: '#a0aec0',
    marginTop: 16,
    fontWeight: '500',
  },
  deviceList: {
    maxHeight: 300,
  },
  deviceItem: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceText: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 12,
    color: '#a0aec0',
    fontWeight: '500',
  },
  deviceAddress: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '500',
    marginTop: 2,
  },
  deviceRssi: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '500',
    marginTop: 2,
  },
  deviceServices: {
    fontSize: 11,
    color: '#667eea',
    fontWeight: '500',
    marginTop: 2,
  },
  deviceStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deviceStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyDeviceList: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDeviceText: {
    fontSize: 16,
    color: '#a0aec0',
    fontWeight: '600',
    marginTop: 16,
  },
  emptyDeviceSubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  rescanButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  rescanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  rescanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SettingsScreen;
// app/admin/settings.tsx - Admin Settings Screen with Real Bluetooth Integration
import React, { useState, useEffect } from 'react';
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
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminLayout from '../../components/AdminLayout';

// Real Bluetooth libraries
import RNBluetoothClassic, { BluetoothDevice as RNBluetoothDevice } from 'react-native-bluetooth-classic';
// import { BleManager, Device as BleDevice } from 'react-native-ble-plx';

interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  connected: boolean;
  type: 'printer' | 'scanner' | 'other';
  rssi?: number;
  bondState?: 'bonded' | 'bonding' | 'none';
  isClassic?: boolean;
}

interface AppInfo {
  version: string;
  buildNumber: string;
  lastUpdate: string;
}

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  // const [bleManager] = useState(() => new BleManager());
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<string | null>(null);
  const [connectedPrinterAddress, setConnectedPrinterAddress] = useState<string | null>(null);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [scanningDevices, setScanningDevices] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [bluetoothPermissions, setBluetoothPermissions] = useState(false);

  const appInfo: AppInfo = {
    version: '2.1.0',
    buildNumber: '2024.08.14',
    lastUpdate: 'August 14, 2024',
  };

  useEffect(() => {
    initializeBluetooth();
    loadStoredSettings();

    // BLE manager setup commented out until proper development build
    // const subscription = bleManager.onStateChange((state) => {
    //   console.log('BLE State changed:', state);
    //   setBluetoothEnabled(state === 'PoweredOn');
    // }, true);

    // return () => {
    //   subscription.remove();
    //   bleManager.destroy();
    // };
  }, []);

  const loadStoredSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('app_settings');
      if (storedSettings) {
        const settings = JSON.parse(storedSettings);
        setNotifications(settings.notifications ?? true);
        setAutoSync(settings.autoSync ?? true);
        setDarkMode(settings.darkMode ?? true);
      }

      const storedPrinter = await AsyncStorage.getItem('connected_printer');
      if (storedPrinter) {
        const printer = JSON.parse(storedPrinter);
        setConnectedPrinter(printer.name);
        setConnectedPrinterAddress(printer.address);
        setPrinterConnected(true);
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

  const initializeBluetooth = async () => {
    try {
      // Request Bluetooth permissions
      await requestBluetoothPermissions();
      
      // Check if Bluetooth is enabled
      await checkBluetoothState();
      
      // Load paired devices
      await loadPairedDevices();
    } catch (error) {
      console.error('Failed to initialize Bluetooth:', error);
      Toast.show({
        type: 'error',
        text1: 'Bluetooth Initialization Failed',
        text2: 'Please check your device Bluetooth settings',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // Base permissions that are always available
        let permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
        ];

        // Add Android 12+ permissions if they exist
        const androidApiLevel = Platform.Version;
        if (androidApiLevel >= 31) {
          // Only add if the permission constants exist
          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
          }
          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          }
          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
          }
        }

        // Filter out any undefined permissions
        const validPermissions = permissions.filter(permission => 
          permission && typeof permission === 'string'
        );

        console.log('Requesting permissions:', validPermissions);

        const granted = await PermissionsAndroid.requestMultiple(validPermissions);

        const allPermissionsGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        setBluetoothPermissions(allPermissionsGranted);

        if (!allPermissionsGranted) {
          Toast.show({
            type: 'warning',
            text1: 'Bluetooth Permissions Required',
            text2: 'Please grant all Bluetooth permissions to use this feature',
            position: 'top',
            visibilityTime: 4000,
          });
        }

        return allPermissionsGranted;
      } catch (error) {
        console.error('Permission request failed:', error);
        setBluetoothPermissions(false);
        return false;
      }
    } else {
      // iOS permissions are handled automatically
      setBluetoothPermissions(true);
      return true;
    }
  };

  const checkBluetoothState = async () => {
    try {
      const isEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      setBluetoothEnabled(isEnabled);
      
      if (!isEnabled) {
        Toast.show({
          type: 'info',
          text1: 'Bluetooth Disabled',
          text2: 'Please enable Bluetooth in your device settings',
          position: 'top',
          visibilityTime: 3000,
        });
      }
      
      return isEnabled;
    } catch (error) {
      console.error('Failed to check Bluetooth state:', error);
      setBluetoothEnabled(false);
      return false;
    }
  };

  const loadPairedDevices = async () => {
    try {
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      const formattedDevices: BluetoothDevice[] = pairedDevices.map((device: RNBluetoothDevice) => ({
        id: device.address,
        name: device.name || 'Unknown Device',
        address: device.address,
        connected: false,
        type: detectDeviceType(device.name || ''),
        bondState: device.bonded ? 'bonded' : 'none',
        isClassic: true,
      }));
      
      setBluetoothDevices(formattedDevices);
      console.log('Loaded paired devices:', formattedDevices.length);
    } catch (error) {
      console.error('Failed to load paired devices:', error);
    }
  };

  const detectDeviceType = (deviceName: string): 'printer' | 'scanner' | 'other' => {
    const name = deviceName?.toLowerCase() || '';
    if (name.includes('print') || name.includes('hp') || name.includes('zebra') || 
        name.includes('epson') || name.includes('brother') || name.includes('canon')) {
      return 'printer';
    }
    if (name.includes('scan') || name.includes('honeywell') || name.includes('symbol') || 
        name.includes('datalogic') || name.includes('intermec')) {
      return 'scanner';
    }
    return 'other';
  };

  const handleBluetoothToggle = async (value: boolean) => {
    if (!bluetoothPermissions) {
      const granted = await requestBluetoothPermissions();
      if (!granted) return;
    }

    try {
      if (value) {
        const result = await RNBluetoothClassic.requestBluetoothEnabled();
        if (result) {
          setBluetoothEnabled(true);
          await loadPairedDevices();
          
          Toast.show({
            type: 'success',
            text1: 'Bluetooth Enabled',
            text2: 'Bluetooth is now available for connections',
            position: 'top',
            visibilityTime: 3000,
          });
        }
      } else {
        // Disconnect all devices first
        await disconnectAllDevices();
        setBluetoothEnabled(false);
        
        Toast.show({
          type: 'info',
          text1: 'Bluetooth Disabled',
          text2: 'All Bluetooth connections have been disconnected',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to toggle Bluetooth:', error);
      Toast.show({
        type: 'error',
        text1: 'Bluetooth Error',
        text2: 'Failed to change Bluetooth state',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const disconnectAllDevices = async () => {
    try {
      // Disconnect Classic Bluetooth devices
      const connectedDevices = await RNBluetoothClassic.getConnectedDevices();
      for (const device of connectedDevices) {
        try {
          await RNBluetoothClassic.disconnectFromDevice(device.address);
          console.log('Disconnected from:', device.name);
        } catch (error) {
          console.error('Failed to disconnect from device:', device.name, error);
        }
      }

      // Update UI state
      setBluetoothDevices(prev => prev.map(d => ({ ...d, connected: false })));
      setPrinterConnected(false);
      setConnectedPrinter(null);
      setConnectedPrinterAddress(null);
      await AsyncStorage.removeItem('connected_printer');
    } catch (error) {
      console.error('Failed to disconnect all devices:', error);
    }
  };

  const handlePrinterConnect = async () => {
    if (!bluetoothEnabled) {
      Toast.show({
        type: 'warning',
        text1: 'Bluetooth Required',
        text2: 'Please enable Bluetooth first',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    if (!bluetoothPermissions) {
      const granted = await requestBluetoothPermissions();
      if (!granted) return;
    }

    setShowDeviceModal(true);
    await scanForDevices();
  };

  const scanForDevices = async () => {
    if (!bluetoothPermissions) {
      await requestBluetoothPermissions();
      return;
    }

    setScanningDevices(true);
    
    try {
      // Get bonded devices first
      await loadPairedDevices();

      // Start Classic Bluetooth discovery
      const isDiscovering = await RNBluetoothClassic.isDiscovering();
      if (isDiscovering) {
        await RNBluetoothClassic.cancelDiscovery();
      }

      const discoveredDevices = await RNBluetoothClassic.startDiscovery();
      
      const newDevices: BluetoothDevice[] = discoveredDevices.map((device: RNBluetoothDevice) => ({
        id: device.address,
        name: device.name || 'Unknown Device',
        address: device.address,
        connected: false,
        type: detectDeviceType(device.name || ''),
        rssi: device.rssi || undefined,
        bondState: device.bonded ? 'bonded' : 'none',
        isClassic: true,
      }));

      // Combine with existing devices, avoiding duplicates
      setBluetoothDevices(prev => {
        const combined = [...prev];
        newDevices.forEach(newDevice => {
          const existingIndex = combined.findIndex(d => d.address === newDevice.address);
          if (existingIndex >= 0) {
            combined[existingIndex] = { ...combined[existingIndex], ...newDevice };
          } else {
            combined.push(newDevice);
          }
        });
        return combined;
      });

      Toast.show({
        type: 'info',
        text1: 'Device Scan Complete',
        text2: `Found ${discoveredDevices.length} new devices`,
        position: 'top',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Failed to scan for devices:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Scan Failed',
        text2: 'Failed to scan for Bluetooth devices',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setScanningDevices(false);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    try {
      Toast.show({
        type: 'info',
        text1: 'Connecting...',
        text2: `Connecting to ${device.name}`,
        position: 'top',
        visibilityTime: 2000,
      });

      // If device is not bonded, try to pair first
      if (device.bondState !== 'bonded') {
        try {
          const paired = await RNBluetoothClassic.pairDevice(device.address);
          if (!paired) {
            throw new Error('Failed to pair device');
          }
        } catch (pairError) {
          console.error('Failed to pair device:', pairError);
          Toast.show({
            type: 'warning',
            text1: 'Pairing Required',
            text2: 'Please pair the device manually in system settings',
            position: 'top',
            visibilityTime: 4000,
          });
          return;
        }
      }

      // Connect to the device
      const connection = await RNBluetoothClassic.connectToDevice(device.address);
      
      if (connection) {
        // Update device connection status
        setBluetoothDevices(prev =>
          prev.map(d => ({
            ...d,
            connected: d.address === device.address ? true : d.type === 'printer' ? false : d.connected,
          }))
        );

        if (device.type === 'printer') {
          setPrinterConnected(true);
          setConnectedPrinter(device.name);
          setConnectedPrinterAddress(device.address);
          
          // Store connected printer
          await AsyncStorage.setItem('connected_printer', JSON.stringify({
            name: device.name,
            address: device.address,
          }));
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
    } catch (error) {
      console.error('Failed to connect to device:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: `Failed to connect to ${device.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const disconnectDevice = async (device: BluetoothDevice) => {
    try {
      await RNBluetoothClassic.disconnectFromDevice(device.address);

      setBluetoothDevices(prev =>
        prev.map(d => ({
          ...d,
          connected: d.address === device.address ? false : d.connected,
        }))
      );

      if (device.type === 'printer') {
        setPrinterConnected(false);
        setConnectedPrinter(null);
        setConnectedPrinterAddress(null);
        await AsyncStorage.removeItem('connected_printer');
      }

      Toast.show({
        type: 'info',
        text1: 'Device Disconnected',
        text2: `Disconnected from ${device.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error) {
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

  const testPrinterConnection = async () => {
    if (!printerConnected || !connectedPrinterAddress) {
      Toast.show({
        type: 'warning',
        text1: 'No Printer Connected',
        text2: 'Please connect a printer first',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      const testData = "\n--- TEST PRINT ---\n\nThis is a test print from the admin app.\n\nTimestamp: " + new Date().toLocaleString() + "\n\n--- END TEST ---\n\n\n";
      
      const isConnected = await RNBluetoothClassic.isDeviceConnected(connectedPrinterAddress);
      if (!isConnected) {
        throw new Error('Printer is not connected');
      }

      await RNBluetoothClassic.writeToDevice(connectedPrinterAddress, testData);

      Toast.show({
        type: 'success',
        text1: 'Test Print Sent',
        text2: `Test print sent to ${connectedPrinter}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Failed to test printer:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Test Print Failed',
        text2: 'Failed to send test print. Check connection.',
        position: 'top',
        visibilityTime: 3000,
      });
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

  const handleTroubleshoot = async () => {
    Toast.show({
      type: 'info',
      text1: 'Running Diagnostics',
      text2: 'Checking app performance and connectivity...',
      position: 'top',
      visibilityTime: 4000,
    });

    try {
      // Clear cache and reset connections
      await AsyncStorage.multiRemove(['connected_printer', 'bluetooth_cache']);
      
      // Disconnect all devices
      await disconnectAllDevices();
      
      // Reinitialize Bluetooth
      setTimeout(async () => {
        await initializeBluetooth();
        
        Toast.show({
          type: 'success',
          text1: 'Diagnostics Complete',
          text2: 'Cache cleared and connections reset',
          position: 'top',
          visibilityTime: 4000,
        });
      }, 3000);
    } catch (error) {
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

  // Save settings when they change
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

  const renderDeviceItem = ({ item }: { item: BluetoothDevice }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => item.connected ? disconnectDevice(item) : connectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <MaterialIcons
          name={item.type === 'printer' ? 'print' : item.type === 'scanner' ? 'qr-code-scanner' : 'bluetooth'}
          size={24}
          color={item.connected ? '#34C759' : '#a0aec0'}
        />
        <View style={styles.deviceText}>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={styles.deviceStatus}>
            {item.connected ? 'Connected' : item.bondState === 'bonded' ? 'Paired' : 'Available'} • {item.address}
          </Text>
          {item.rssi && (
            <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
          )}
          <Text style={styles.deviceType}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)} • {item.isClassic ? 'Classic' : 'BLE'}
          </Text>
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
        <Text style={styles.sectionTitle}>Bluetooth</Text>

        {renderSettingItem(
          'bluetooth',
          'Bluetooth',
          bluetoothEnabled ? 'Bluetooth is enabled' : 'Bluetooth is disabled',
          <Switch
            value={bluetoothEnabled}
            onValueChange={handleBluetoothToggle}
            trackColor={{ false: '#2d3748', true: '#667eea' }}
            thumbColor={bluetoothEnabled ? '#764ba2' : '#a0aec0'}
            ios_backgroundColor="#2d3748"
          />
        )}

        {renderSettingItem(
          'print',
          'Printer Connection',
          printerConnected ? `Connected to ${connectedPrinter}` : 'Printer not connected',
          <View style={styles.printerActions}>
            {printerConnected && (
              <TouchableOpacity
                style={styles.testButton}
                onPress={testPrinterConnection}
              >
                <LinearGradient
                  colors={['#34C759', '#30A46C']}
                  style={styles.testButtonGradient}
                >
                  <Text style={styles.testButtonText}>Test</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handlePrinterConnect}
            >
              <LinearGradient
                colors={printerConnected ? ['#34C759', '#30A46C'] : ['#FF9500', '#FF8C00']}
                style={styles.connectButtonGradient}
              >
                <Text style={styles.connectButtonText}>
                  {printerConnected ? 'Change' : 'Connect'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
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
              {!bluetoothPermissions && (
                <View style={styles.permissionWarning}>
                  <MaterialIcons name="warning" size={24} color="#FF9500" />
                  <Text style={styles.permissionWarningText}>
                    Bluetooth permissions required to scan for devices
                  </Text>
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={requestBluetoothPermissions}
                  >
                    <Text style={styles.permissionButtonText}>Grant Permissions</Text>
                  </TouchableOpacity>
                </View>
              )}

              {scanningDevices ? (
                <View style={styles.scanningContainer}>
                  <ActivityIndicator size="large" color="#667eea" />
                  <Text style={styles.scanningText}>Scanning for devices...</Text>
                </View>
              ) : (
                <FlatList
                  data={bluetoothDevices}
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
                disabled={scanningDevices || !bluetoothPermissions}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.rescanButtonGradient}
                >
                  <MaterialIcons name="refresh" size={20} color="#fff" />
                  <Text style={styles.rescanButtonText}>Rescan</Text>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 4,
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
  printerActions: {
    flexDirection: 'row',
    gap: 8,
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
  deviceRssi: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '500',
    marginTop: 2,
  },
  deviceType: {
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
// app/admin/settings.tsx - Admin Settings Screen
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AdminLayout from '../../components/AdminLayout';

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  type: 'printer' | 'scanner' | 'other';
}

interface AppInfo {
  version: string;
  buildNumber: string;
  lastUpdate: string;
}

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<string | null>('HP LaserJet Pro');
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [scanningDevices, setScanningDevices] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const appInfo: AppInfo = {
    version: '2.1.0',
    buildNumber: '2024.08.14',
    lastUpdate: 'August 14, 2024',
  };

  useEffect(() => {
    // Mock Bluetooth devices
    setBluetoothDevices([
      { id: '1', name: 'HP LaserJet Pro', connected: true, type: 'printer' },
      { id: '2', name: 'Zebra ZD220', connected: false, type: 'printer' },
      { id: '3', name: 'Honeywell Scanner', connected: false, type: 'scanner' },
    ]);
  }, []);

  const handleBluetoothToggle = (value: boolean) => {
    setBluetoothEnabled(value);
    if (!value) {
      setPrinterConnected(false);
      setConnectedPrinter(null);
      Toast.show({
        type: 'info',
        text1: 'Bluetooth Disabled',
        text2: 'All Bluetooth connections have been disconnected',
        position: 'top',
        visibilityTime: 3000,
      });
    } else {
      Toast.show({
        type: 'success',
        text1: 'Bluetooth Enabled',
        text2: 'Bluetooth is now available for connections',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handlePrinterConnect = () => {
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
    setShowDeviceModal(true);
    scanForDevices();
  };

  const scanForDevices = () => {
    setScanningDevices(true);
    // Mock scanning process
    setTimeout(() => {
      setScanningDevices(false);
      Toast.show({
        type: 'info',
        text1: 'Device Scan Complete',
        text2: `Found ${bluetoothDevices.length} available devices`,
        position: 'top',
        visibilityTime: 2000,
      });
    }, 3000);
  };

  const connectToDevice = (device: BluetoothDevice) => {
    // Update device connection status
    setBluetoothDevices(prev =>
      prev.map(d => ({
        ...d,
        connected: d.id === device.id ? true : d.type === 'printer' ? false : d.connected,
      }))
    );

    if (device.type === 'printer') {
      setPrinterConnected(true);
      setConnectedPrinter(device.name);
    }

    setShowDeviceModal(false);

    Toast.show({
      type: 'success',
      text1: 'Device Connected',
      text2: `Successfully connected to ${device.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  const disconnectDevice = (device: BluetoothDevice) => {
    setBluetoothDevices(prev =>
      prev.map(d => ({
        ...d,
        connected: d.id === device.id ? false : d.connected,
      }))
    );

    if (device.type === 'printer') {
      setPrinterConnected(false);
      setConnectedPrinter(null);
    }

    Toast.show({
      type: 'info',
      text1: 'Device Disconnected',
      text2: `Disconnected from ${device.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
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
          onPress: () => {
            Toast.show({
              type: 'success',
              text1: 'Logged Out',
              text2: 'You have been successfully logged out',
              position: 'top',
              visibilityTime: 3000,
            });
            // Navigate to login screen
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleTroubleshoot = () => {
    Toast.show({
      type: 'info',
      text1: 'Running Diagnostics',
      text2: 'Checking app performance and connectivity...',
      position: 'top',
      visibilityTime: 4000,
    });

    // Mock troubleshoot process
    setTimeout(() => {
      Toast.show({
        type: 'success',
        text1: 'Diagnostics Complete',
        text2: 'All systems are functioning normally',
        position: 'top',
        visibilityTime: 4000,
      });
    }, 3000);
  };

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
            {item.connected ? 'Connected' : 'Available'}
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
                />
              )}

              <TouchableOpacity
                style={styles.rescanButton}
                onPress={scanForDevices}
                disabled={scanningDevices}
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
    fontSize: 14,
    color: '#a0aec0',
    fontWeight: '500',
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
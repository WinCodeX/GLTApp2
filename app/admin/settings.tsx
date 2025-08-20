// app/admin/settings.tsx - Updated to use global Bluetooth context
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminLayout from '../../components/AdminLayout';
import DeviceModal from '../../components/DeviceModal';
import { useBluetooth, BluetoothDevice } from '../../contexts/BluetoothContext';

interface AppInfo {
  version: string;
  buildNumber: string;
  lastUpdate: string;
}

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  
  // Use global Bluetooth context
  const {
    requestPermissions,
    scanForDevices,
    connectToDevice,
    disconnectFromDevice,
    testPrint,
    printText,
    printReceipt,
    connectedPrinter,
    allDevices,
    isScanning,
    isPrintReady,
    isBluetoothAvailable,
  } = useBluetooth();
  
  // Local state for UI
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const appInfo: AppInfo = {
    version: '2.1.0',
    buildNumber: '2024.08.20',
    lastUpdate: 'August 20, 2024',
  };

  // Load settings on mount
  useEffect(() => {
    loadStoredSettings();
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

  const handlePrinterConnect = async () => {
    if (!isBluetoothAvailable) {
      Alert.alert(
        'Bluetooth Not Available',
        'Bluetooth is not available in this environment (Expo Go doesn\'t support native Bluetooth). Please use a development build or production build.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const hasPermissions = await requestPermissions();
    if (hasPermissions) {
      setShowDeviceModal(true);
      try {
        scanForDevices();
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'Scan Failed',
          text2: error.message,
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } else {
      Alert.alert(
        'Permissions Required',
        'Bluetooth permissions are required to scan for devices. Please grant permissions in your device settings.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const handlePrinterDisconnect = async () => {
    if (!connectedPrinter) {
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
      await disconnectFromDevice();
      Toast.show({
        type: 'success',
        text1: 'Printer Disconnected',
        text2: 'Printer has been disconnected successfully',
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Disconnect Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const connectToDeviceHandler = async (device: BluetoothDevice) => {
    try {
      Toast.show({
        type: 'info',
        text1: 'Connecting...',
        text2: `Connecting to ${device.name}`,
        position: 'top',
        visibilityTime: 2000,
      });

      await connectToDevice(device);
      setShowDeviceModal(false);

      Toast.show({
        type: 'success',
        text1: 'Device Connected',
        text2: `Successfully connected to ${device.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: `Failed to connect to ${device.name}: ${error.message}`,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const testPrinterConnection = async () => {
    try {
      await testPrint();
      Toast.show({
        type: 'success',
        text1: 'Test Print Successful',
        text2: `Test sent to ${connectedPrinter?.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Test Print Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handleAdvancedPrintTest = async () => {
    if (!isPrintReady) {
      Toast.show({
        type: 'warning',
        text1: 'No Printer Ready',
        text2: 'Please connect a printer first',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    Alert.alert(
      'Print Test Options',
      'Choose what to print:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simple Text',
          onPress: async () => {
            try {
              await printText('Hello from the app!\nThis is a test print.\nPrinter: ' + connectedPrinter?.name);
              Toast.show({
                type: 'success',
                text1: 'Text Printed',
                text2: 'Simple text sent to printer',
                position: 'top',
                visibilityTime: 3000,
              });
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Print Failed',
                text2: error.message,
                position: 'top',
                visibilityTime: 3000,
              });
            }
          }
        },
        {
          text: 'Sample Receipt',
          onPress: async () => {
            try {
              await printReceipt({
                packageCode: 'PKG-123456',
                customerName: 'John Doe',
                status: 'Delivered',
                location: 'Main Office'
              });
              Toast.show({
                type: 'success',
                text1: 'Receipt Printed',
                text2: 'Sample receipt sent to printer',
                position: 'top',
                visibilityTime: 3000,
              });
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Print Failed',
                text2: error.message,
                position: 'top',
                visibilityTime: 3000,
              });
            }
          }
        }
      ]
    );
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
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleTroubleshoot = async () => {
    Alert.alert(
      'Troubleshoot Bluetooth',
      'This will disconnect the current printer and clear cache. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            Toast.show({
              type: 'info',
              text1: 'Resetting',
              text2: 'Clearing Bluetooth cache...',
              position: 'top',
              visibilityTime: 3000,
            });

            try {
              await disconnectFromDevice();
              await AsyncStorage.multiRemove([
                'bluetooth_connected_printer', 
                'bluetooth_cache',
                'app_settings'
              ]);
              
              Toast.show({
                type: 'success',
                text1: 'Reset Complete',
                text2: 'Bluetooth has been reset',
                position: 'top',
                visibilityTime: 3000,
              });
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Reset Failed',
                text2: 'Failed to complete reset',
                position: 'top',
                visibilityTime: 3000,
              });
            }
          }
        }
      ]
    );
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

  const renderPrinterConnectionSetting = () => {
    const statusText = connectedPrinter 
      ? `Connected to ${connectedPrinter.name} (${connectedPrinter.type.toUpperCase()})`
      : isBluetoothAvailable 
        ? 'No printer connected' 
        : 'Bluetooth not available (Expo Go)';
    
    return renderSettingItem(
      'print',
      'Printer Connection',
      statusText,
      <View style={styles.printerActions}>
        {connectedPrinter ? (
          // When printer is connected, show Test and Disconnect buttons
          <>
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
            
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handlePrinterDisconnect}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF5252']}
                style={styles.disconnectButtonGradient}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          // When no printer is connected, show Connect button
          <TouchableOpacity
            style={[styles.connectButton, !isBluetoothAvailable && styles.disabledButton]}
            onPress={handlePrinterConnect}
            disabled={!isBluetoothAvailable}
          >
            <LinearGradient
              colors={!isBluetoothAvailable ? ['#666', '#777'] : ['#667eea', '#764ba2']}
              style={styles.connectButtonGradient}
            >
              <Text style={styles.connectButtonText}>
                {!isBluetoothAvailable ? 'Not Available' : 'Connect'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderContent = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Printer Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Printer</Text>
        {renderPrinterConnectionSetting()}
        
        {/* Advanced Print Test when connected */}
        {isPrintReady && (
          <TouchableOpacity
            style={styles.advancedTestCard}
            onPress={handleAdvancedPrintTest}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.advancedTestGradient}
            >
              <MaterialIcons name="receipt" size={24} color="#fff" />
              <View style={styles.advancedTestText}>
                <Text style={styles.advancedTestTitle}>Advanced Print Test</Text>
                <Text style={styles.advancedTestSubtitle}>Test different print formats</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#fff" />
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
          'Troubleshoot Bluetooth',
          'Reset Bluetooth connections and clear cache',
          <TouchableOpacity
            style={styles.troubleshootButton}
            onPress={handleTroubleshoot}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.troubleshootButtonGradient}
            >
              <Text style={styles.troubleshootButtonText}>Reset</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Device Modal */}
      <DeviceModal
        visible={showDeviceModal}
        devices={allDevices}
        isScanning={isScanning}
        connectToDevice={connectToDeviceHandler}
        closeModal={() => setShowDeviceModal(false)}
        onRescan={() => {
          try {
            scanForDevices();
          } catch (error: any) {
            Toast.show({
              type: 'error',
              text1: 'Rescan Failed',
              text2: error.message,
              position: 'top',
              visibilityTime: 3000,
            });
          }
        }}
      />
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
  disabledButton: {
    opacity: 0.5,
  },
  
  advancedTestCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
  },
  advancedTestGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  advancedTestText: {
    flex: 1,
    marginLeft: 16,
  },
  advancedTestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  advancedTestSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
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
});

export default SettingsScreen;
// app/(agent)/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceModal from '../../components/DeviceModal';
import { useBluetooth, BluetoothDevice } from '../../contexts/BluetoothContext';

interface AppSettings {
  notifications: boolean;
  autoSync: boolean;
  soundEnabled: boolean;
  autoPrint: boolean;
}

const AgentSettingsScreen: React.FC = () => {
  // Bluetooth context
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

  // Settings state
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadStoredSettings();
  }, []);

  // Save settings when they change
  useEffect(() => {
    saveSettings();
  }, [notifications, autoSync, soundEnabled, autoPrint]);

  const loadStoredSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('agent_app_settings');
      if (storedSettings) {
        const settings: AppSettings = JSON.parse(storedSettings);
        setNotifications(settings.notifications ?? true);
        setAutoSync(settings.autoSync ?? true);
        setSoundEnabled(settings.soundEnabled ?? true);
        setAutoPrint(settings.autoPrint ?? true);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const settings: AppSettings = {
        notifications,
        autoSync,
        soundEnabled,
        autoPrint,
      };
      await AsyncStorage.setItem('agent_app_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handlePrinterConnect = async () => {
    if (!isBluetoothAvailable) {
      Alert.alert(
        'Bluetooth Not Available',
        'Bluetooth is not available in this environment (Expo Go doesn\'t support native Bluetooth). Please use a development build or production build to use printer features.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const hasPermissions = await requestPermissions();
    if (hasPermissions) {
      setShowDeviceModal(true);
      try {
        await scanForDevices();
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
        'Bluetooth permissions are required to scan for printers. Please grant permissions in your device settings.',
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
        text2: `${connectedPrinter.name} has been disconnected`,
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
        text1: 'Printer Connected',
        text2: `Successfully connected to ${device.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: `Failed to connect: ${error.message}`,
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
              await printText(
                '=== Test Print ===\n' +
                'Agent Delivery Receipt\n' +
                `Printer: ${connectedPrinter?.name}\n` +
                `Time: ${new Date().toLocaleString()}\n` +
                '==================\n'
              );
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
                packageCode: 'PKG-TEST-' + Date.now(),
                customerName: 'Test Customer',
                status: 'Collected',
                location: 'Agent Office'
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

  const handleTroubleshoot = async () => {
    Alert.alert(
      'Troubleshoot Bluetooth',
      'This will disconnect the current printer and clear Bluetooth cache. Continue?',
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
              ]);

              Toast.show({
                type: 'success',
                text1: 'Reset Complete',
                text2: 'Bluetooth has been reset successfully',
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
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={icon} size={22} color="#7B3F98" />
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
      ? `Connected: ${connectedPrinter.name}`
      : isBluetoothAvailable
        ? 'No printer connected'
        : 'Bluetooth not available';

    return renderSettingItem(
      'print',
      'Printer Connection',
      statusText,
      <View style={styles.printerActions}>
        {connectedPrinter ? (
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
          <TouchableOpacity
            style={[styles.connectButton, !isBluetoothAvailable && styles.disabledButton]}
            onPress={handlePrinterConnect}
            disabled={!isBluetoothAvailable}
          >
            <LinearGradient
              colors={!isBluetoothAvailable ? ['#666', '#777'] : ['#7B3F98', '#9B5FB8']}
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerButton} />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                colors={['#7B3F98', '#9B5FB8']}
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

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>

          {renderSettingItem(
            'notifications',
            'Push Notifications',
            notifications ? 'Receive delivery notifications' : 'Notifications are disabled',
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#2d3748', true: '#7B3F98' }}
              thumbColor={notifications ? '#9B5FB8' : '#a0aec0'}
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
              trackColor={{ false: '#2d3748', true: '#7B3F98' }}
              thumbColor={autoSync ? '#9B5FB8' : '#a0aec0'}
              ios_backgroundColor="#2d3748"
            />
          )}

          {renderSettingItem(
            'volume-up',
            'Sound Effects',
            soundEnabled ? 'Scan sounds enabled' : 'Sound effects disabled',
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: '#2d3748', true: '#7B3F98' }}
              thumbColor={soundEnabled ? '#9B5FB8' : '#a0aec0'}
              ios_backgroundColor="#2d3748"
            />
          )}

          {renderSettingItem(
            'print',
            'Auto-Print on Collection',
            autoPrint ? 'Prints receipt after collection' : 'Manual printing only',
            <Switch
              value={autoPrint}
              onValueChange={setAutoPrint}
              trackColor={{ false: '#2d3748', true: '#7B3F98' }}
              thumbColor={autoPrint ? '#9B5FB8' : '#a0aec0'}
              ios_backgroundColor="#2d3748"
            />
          )}
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          {renderSettingItem(
            'help-circle',
            'Help Center',
            'Get help and support',
            <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />,
            () => {
              Toast.show({
                type: 'info',
                text1: 'Help Center',
                text2: 'Opening help center...',
                position: 'top',
                visibilityTime: 2000,
              });
            }
          )}

          {renderSettingItem(
            'phone',
            'Contact Support',
            'Get in touch with support team',
            <MaterialIcons name="chevron-right" size={20} color="#a0aec0" />,
            () => {
              Toast.show({
                type: 'info',
                text1: 'Contact Support',
                text2: 'Opening support contact...',
                position: 'top',
                visibilityTime: 2000,
              });
            }
          )}

          {renderSettingItem(
            'refresh',
            'Troubleshoot Bluetooth',
            'Reset Bluetooth and clear cache',
            <TouchableOpacity
              style={styles.troubleshootButton}
              onPress={handleTroubleshoot}
            >
              <LinearGradient
                colors={['#7B3F98', '#9B5FB8']}
                style={styles.troubleshootButtonGradient}
              >
                <Text style={styles.troubleshootButtonText}>Reset</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          {renderSettingItem(
            'info',
            'App Version',
            'Current version',
            <Text style={styles.versionText}>2.1.0</Text>
          )}

          {renderSettingItem(
            'code',
            'Build Number',
            'Build identifier',
            <Text style={styles.versionText}>2024.08.20</Text>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

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

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButton: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingItem: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(123, 63, 152, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#a0aec0',
  },
  printerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  testButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  testButtonGradient: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  connectButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  connectButtonGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  disconnectButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  disconnectButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  advancedTestGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  advancedTestText: {
    flex: 1,
    marginLeft: 12,
  },
  advancedTestTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  advancedTestSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  troubleshootButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  troubleshootButtonGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  troubleshootButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B3F98',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default AgentSettingsScreen;
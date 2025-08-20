// contexts/BluetoothContext.tsx - Global Bluetooth state management
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

// Conditional imports to handle Expo Go
let BleManager: any = null;
let RNBluetoothClassic: any = null;
let ThermalPrinter: any = null;

try {
  const { BleManager: BleManagerClass } = require("react-native-ble-plx");
  BleManager = BleManagerClass;
} catch (error) {
  console.warn('BLE not available in this environment (likely Expo Go)');
}

try {
  RNBluetoothClassic = require("react-native-bluetooth-classic").default;
} catch (error) {
  console.warn('Bluetooth Classic not available in this environment (likely Expo Go)');
}

try {
  ThermalPrinter = require("react-native-thermal-printer").default;
} catch (error) {
  console.warn('Thermal Printer not available in this environment (likely Expo Go)');
}

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  type: 'classic' | 'ble';
  deviceType: 'printer' | 'scanner' | 'unknown';
  connected?: boolean;
  rssi?: number;
  services?: string[];
}

interface BluetoothContextType {
  // State
  allDevices: BluetoothDevice[];
  connectedPrinter: BluetoothDevice | null;
  isScanning: boolean;
  isPrintReady: boolean;
  isBluetoothAvailable: boolean;
  
  // Actions
  requestPermissions(): Promise<boolean>;
  scanForDevices(): void;
  connectToDevice: (device: BluetoothDevice) => Promise<void>;
  disconnectFromDevice: () => Promise<void>;
  testPrint: () => Promise<void>;
  printText: (text: string) => Promise<void>;
  printReceipt: (data: any) => Promise<void>;
}

const BluetoothContext = createContext<BluetoothContextType | null>(null);

// Singleton BLE Manager instance
let bleManagerInstance: any = null;

function getBleManager() {
  if (!bleManagerInstance && BleManager) {
    try {
      bleManagerInstance = new BleManager();
    } catch (error) {
      console.warn('Failed to create BLE manager:', error);
    }
  }
  return bleManagerInstance;
}

function detectDeviceType(deviceName: string): 'printer' | 'scanner' | 'unknown' {
  const name = deviceName?.toLowerCase() || '';
  
  if (name.includes('print') || name.includes('hp') || name.includes('zebra') || 
      name.includes('epson') || name.includes('brother') || name.includes('canon') ||
      name.includes('receipt') || name.includes('thermal') || name.includes('pos')) {
    return 'printer';
  }
  
  if (name.includes('scan') || name.includes('honeywell') || name.includes('symbol') || 
      name.includes('datalogic') || name.includes('intermec') || name.includes('qr') ||
      name.includes('barcode')) {
    return 'scanner';
  }
  
  return 'unknown';
}

interface BluetoothProviderProps {
  children: ReactNode;
}

export const BluetoothProvider: React.FC<BluetoothProviderProps> = ({ children }) => {
  const [allDevices, setAllDevices] = useState<BluetoothDevice[]>([]);
  const [connectedPrinter, setConnectedPrinter] = useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const isBluetoothAvailable = BleManager !== null || RNBluetoothClassic !== null;
  const isPrintReady = !!connectedPrinter;

  // Load persisted connection on app start
  useEffect(() => {
    loadPersistedConnection();
  }, []);

  // Persist connection state when it changes
  useEffect(() => {
    if (connectedPrinter) {
      persistConnection(connectedPrinter);
    } else {
      clearPersistedConnection();
    }
  }, [connectedPrinter]);

  const loadPersistedConnection = async () => {
    try {
      const stored = await AsyncStorage.getItem('bluetooth_connected_printer');
      if (stored) {
        const device: BluetoothDevice = JSON.parse(stored);
        console.log('Loading persisted connection:', device.name);
        
        // Verify the connection is still active
        if (device.type === 'classic' && RNBluetoothClassic) {
          try {
            const isConnected = await RNBluetoothClassic.isConnected(device.address);
            if (isConnected) {
              setConnectedPrinter(device);
              console.log('Restored classic connection:', device.name);
            }
          } catch (error) {
            console.log('Failed to verify classic connection:', error);
            clearPersistedConnection();
          }
        } else if (device.type === 'ble') {
          const bleManager = getBleManager();
          if (bleManager) {
            try {
              const bleDevice = await bleManager.isDeviceConnected(device.id);
              if (bleDevice) {
                setConnectedPrinter(device);
                console.log('Restored BLE connection:', device.name);
              }
            } catch (error) {
              console.log('Failed to verify BLE connection:', error);
              clearPersistedConnection();
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load persisted connection:', error);
    }
  };

  const persistConnection = async (device: BluetoothDevice) => {
    try {
      await AsyncStorage.setItem('bluetooth_connected_printer', JSON.stringify(device));
    } catch (error) {
      console.error('Failed to persist connection:', error);
    }
  };

  const clearPersistedConnection = async () => {
    try {
      await AsyncStorage.removeItem('bluetooth_connected_printer');
    } catch (error) {
      console.error('Failed to clear persisted connection:', error);
    }
  };

  const requestAndroid31Permissions = async () => {
    const bluetoothScanPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Bluetooth Permission",
        message: "This app needs Bluetooth access to connect to printers",
        buttonPositive: "OK",
      }
    );
    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Bluetooth Permission", 
        message: "This app needs Bluetooth access to connect to printers",
        buttonPositive: "OK",
      }
    );
    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Bluetooth requires location permission",
        buttonPositive: "OK",
      }
    );

    return (
      bluetoothScanPermission === "granted" &&
      bluetoothConnectPermission === "granted" &&
      fineLocationPermission === "granted"
    );
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (!isBluetoothAvailable) {
      console.warn('Bluetooth not available in this environment');
      return false;
    }

    if (Platform.OS === "android") {
      if ((Platform.Version) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth requires location permission",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const isAndroid31PermissionsGranted = await requestAndroid31Permissions();
        return isAndroid31PermissionsGranted;
      }
    } else {
      return true;
    }
  };

  const isDuplicateDevice = (devices: BluetoothDevice[], nextDevice: BluetoothDevice) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const scanForDevices = () => {
    if (!isBluetoothAvailable) {
      throw new Error('Bluetooth not available in this environment (Expo Go doesn\'t support native Bluetooth)');
    }

    setIsScanning(true);
    setAllDevices([]);

    // Scan for Bluetooth Classic devices (printers are usually classic)
    if (RNBluetoothClassic) {
      RNBluetoothClassic.getBondedDevices()
        .then((bondedDevices: any[]) => {
          console.log('Found bonded classic devices:', bondedDevices.length);
          
          const classicDevices: BluetoothDevice[] = bondedDevices.map((device) => ({
            id: device.address,
            name: device.name || 'Unknown Device',
            address: device.address,
            type: 'classic',
            deviceType: detectDeviceType(device.name || ''),
          }));

          setAllDevices(prevState => {
            const newDevices = [...prevState];
            classicDevices.forEach(device => {
              if (!isDuplicateDevice(newDevices, device)) {
                newDevices.push(device);
              }
            });
            return newDevices;
          });
        })
        .catch(error => {
          console.warn('Failed to get bonded devices:', error);
        });
    }

    // Also scan for BLE devices
    const bleManager = getBleManager();
    if (bleManager) {
      bleManager.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          console.log('BLE scan error:', error);
          return;
        }
        
        if (device && device.name) {
          const bleDevice: BluetoothDevice = {
            id: device.id,
            name: device.name,
            address: device.id,
            type: 'ble',
            deviceType: detectDeviceType(device.name),
            rssi: device.rssi || undefined,
            services: device.serviceUUIDs || [],
          };

          setAllDevices((prevState: BluetoothDevice[]) => {
            if (!isDuplicateDevice(prevState, bleDevice)) {
              return [...prevState, bleDevice];
            }
            return prevState;
          });
        }
      });
    }

    // Stop scanning after 10 seconds
    setTimeout(() => {
      const bleManager = getBleManager();
      if (bleManager) {
        bleManager.stopDeviceScan();
      }
      setIsScanning(false);
    }, 10000);
  };

  const connectToDevice = async (device: BluetoothDevice): Promise<void> => {
    if (!isBluetoothAvailable) {
      throw new Error('Bluetooth not available in this environment (Expo Go doesn\'t support native Bluetooth)');
    }

    try {
      console.log('Connecting to device:', device.name, device.type);
      
      if (device.type === 'classic' && RNBluetoothClassic) {
        // Connect using Bluetooth Classic
        const deviceConnection = await RNBluetoothClassic.connectToDevice(device.address);
        console.log('Classic connection successful:', deviceConnection);
        
        // Initialize thermal printer for classic devices
        if (ThermalPrinter && device.deviceType === 'printer') {
          try {
            await ThermalPrinter.init({
              type: 'bluetooth',
              id: device.address,
            });
            console.log('Thermal printer initialized');
          } catch (thermalError) {
            console.warn('Failed to initialize thermal printer:', thermalError);
          }
        }
        
        setConnectedPrinter({
          ...device,
          connected: true
        });
      } else if (device.type === 'ble') {
        const bleManager = getBleManager();
        if (bleManager) {
          // Connect using BLE
          const deviceConnection = await bleManager.connectToDevice(device.id);
          await deviceConnection.discoverAllServicesAndCharacteristics();
          console.log('BLE connection successful');
          
          setConnectedPrinter({
            ...device,
            connected: true
          });
        } else {
          throw new Error('BLE manager not available');
        }
      } else {
        throw new Error('Bluetooth manager not available for this device type');
      }
      
      const bleManager = getBleManager();
      if (bleManager) {
        bleManager.stopDeviceScan();
      }
      setIsScanning(false);
      
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
      throw e;
    }
  };

  const disconnectFromDevice = async (): Promise<void> => {
    if (!connectedPrinter) return;

    console.log('Disconnecting from:', connectedPrinter.name);
    
    try {
      if (connectedPrinter.type === 'classic' && RNBluetoothClassic) {
        await RNBluetoothClassic.disconnectFromDevice(connectedPrinter.address);
        console.log('Classic disconnect successful');
      } else if (connectedPrinter.type === 'ble') {
        const bleManager = getBleManager();
        if (bleManager) {
          await bleManager.cancelDeviceConnection(connectedPrinter.id);
          console.log('BLE disconnect successful');
        }
      }
      
      setConnectedPrinter(null);
    } catch (error) {
      console.error('Disconnect error:', error);
      // Still clear the connection state even if disconnect fails
      setConnectedPrinter(null);
      throw error;
    }
  };

  const testPrint = async (): Promise<void> => {
    if (!connectedPrinter) {
      throw new Error('No printer connected');
    }

    if (!isBluetoothAvailable) {
      throw new Error('Bluetooth not available in this environment');
    }

    try {
      if (ThermalPrinter && connectedPrinter.deviceType === 'printer') {
        // Use thermal printer for actual printing
        await ThermalPrinter.printText('=== TEST PRINT ===\n');
        await ThermalPrinter.printText('Printer: ' + connectedPrinter.name + '\n');
        await ThermalPrinter.printText('Type: ' + connectedPrinter.type.toUpperCase() + '\n');
        await ThermalPrinter.printText('Time: ' + new Date().toLocaleString() + '\n');
        await ThermalPrinter.printText('==================\n\n\n');
        console.log('Test print sent successfully');
      } else {
        // Fallback for devices without thermal printer support
        console.log('Sending basic test print to:', connectedPrinter.name);
        
        if (connectedPrinter.type === 'classic' && RNBluetoothClassic) {
          // Send basic ESC/POS commands for thermal printers
          const testCommands = [
            '\x1B\x40', // Initialize printer
            '=== TEST PRINT ===\n',
            'Printer: ' + connectedPrinter.name + '\n',
            'Time: ' + new Date().toLocaleString() + '\n',
            '==================\n\n\n',
            '\x1D\x56\x42\x00' // Cut paper command
          ].join('');
          
          await RNBluetoothClassic.writeToDevice(connectedPrinter.address, testCommands);
          console.log('Basic test print sent');
        }
      }
    } catch (error) {
      console.error('Test print failed:', error);
      throw new Error(`Test print failed: ${error}`);
    }
  };

  const printText = async (text: string): Promise<void> => {
    if (!connectedPrinter) {
      throw new Error('No printer connected');
    }

    try {
      if (ThermalPrinter && connectedPrinter.deviceType === 'printer') {
        await ThermalPrinter.printText(text + '\n\n');
      } else if (connectedPrinter.type === 'classic' && RNBluetoothClassic) {
        const printData = '\x1B\x40' + text + '\n\n' + '\x1D\x56\x42\x00';
        await RNBluetoothClassic.writeToDevice(connectedPrinter.address, printData);
      }
      console.log('Text printed successfully');
    } catch (error) {
      console.error('Print text failed:', error);
      throw new Error(`Print failed: ${error}`);
    }
  };

  const printReceipt = async (data: any): Promise<void> => {
    if (!connectedPrinter) {
      throw new Error('No printer connected');
    }

    try {
      if (ThermalPrinter && connectedPrinter.deviceType === 'printer') {
        // Format receipt data
        await ThermalPrinter.printText('===== RECEIPT =====\n');
        if (data.packageCode) {
          await ThermalPrinter.printText(`Package: ${data.packageCode}\n`);
        }
        if (data.customerName) {
          await ThermalPrinter.printText(`Customer: ${data.customerName}\n`);
        }
        if (data.status) {
          await ThermalPrinter.printText(`Status: ${data.status}\n`);
        }
        await ThermalPrinter.printText(`Time: ${new Date().toLocaleString()}\n`);
        await ThermalPrinter.printText('==================\n\n\n');
      } else {
        // Fallback for basic printers
        const receiptText = [
          '===== RECEIPT =====',
          data.packageCode ? `Package: ${data.packageCode}` : '',
          data.customerName ? `Customer: ${data.customerName}` : '',
          data.status ? `Status: ${data.status}` : '',
          `Time: ${new Date().toLocaleString()}`,
          '==================\n\n'
        ].filter(Boolean).join('\n') + '\n';
        
        await printText(receiptText);
      }
      console.log('Receipt printed successfully');
    } catch (error) {
      console.error('Print receipt failed:', error);
      throw new Error(`Receipt print failed: ${error}`);
    }
  };

  const contextValue: BluetoothContextType = {
    allDevices,
    connectedPrinter,
    isScanning,
    isPrintReady,
    isBluetoothAvailable,
    requestPermissions,
    scanForDevices,
    connectToDevice,
    disconnectFromDevice,
    testPrint,
    printText,
    printReceipt,
  };

  return (
    <BluetoothContext.Provider value={contextValue}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = (): BluetoothContextType => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return context;
};
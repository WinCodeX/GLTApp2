// hooks/useBluetooth.ts - Fixed version with Expo Go compatibility
import { useMemo, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

// Conditional imports to handle Expo Go
let BleManager: any = null;
let RNBluetoothClassic: any = null;

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

interface BluetoothApi {
  requestPermissions(): Promise<boolean>;
  scanForDevices(): void;
  connectToDevice: (device: BluetoothDevice) => Promise<void>;
  disconnectFromDevice: () => void;
  testPrint: () => Promise<void>;
  allDevices: BluetoothDevice[];
  connectedPrinter: BluetoothDevice | null;
  isScanning: boolean;
  isPrintReady: boolean;
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

function useBluetooth(): BluetoothApi {
  // Lazy initialization of BLE manager
  const bleManager = useMemo(() => {
    if (BleManager) {
      try {
        return new BleManager();
      } catch (error) {
        console.warn('Failed to create BLE manager:', error);
        return null;
      }
    }
    return null;
  }, []);

  const [allDevices, setAllDevices] = useState<BluetoothDevice[]>([]);
  const [connectedPrinter, setConnectedPrinter] = useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Check if Bluetooth features are available
  const isBluetoothAvailable = useMemo(() => {
    return BleManager !== null || RNBluetoothClassic !== null;
  }, []);

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

  const requestPermissions = async () => {
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
      if (bleManager) {
        bleManager.stopDeviceScan();
      }
      setIsScanning(false);
    }, 10000);
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    if (!isBluetoothAvailable) {
      throw new Error('Bluetooth not available in this environment (Expo Go doesn\'t support native Bluetooth)');
    }

    try {
      console.log('Connecting to device:', device.name, device.type);
      
      if (device.type === 'classic' && RNBluetoothClassic) {
        // Connect using Bluetooth Classic
        const deviceConnection = await RNBluetoothClassic.connectToDevice(device.address);
        console.log('Classic connection successful:', deviceConnection);
        
        setConnectedPrinter({
          ...device,
          connected: true
        });
      } else if (device.type === 'ble' && bleManager) {
        // Connect using BLE
        const deviceConnection = await bleManager.connectToDevice(device.id);
        await deviceConnection.discoverAllServicesAndCharacteristics();
        console.log('BLE connection successful');
        
        setConnectedPrinter({
          ...device,
          connected: true
        });
      } else {
        throw new Error('Bluetooth manager not available for this device type');
      }
      
      if (bleManager) {
        bleManager.stopDeviceScan();
      }
      setIsScanning(false);
      
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
      throw e;
    }
  };

  const disconnectFromDevice = () => {
    if (!connectedPrinter) return;

    console.log('Disconnecting from:', connectedPrinter.name);
    
    if (connectedPrinter.type === 'classic' && RNBluetoothClassic) {
      RNBluetoothClassic.disconnectFromDevice(connectedPrinter.address)
        .then(() => console.log('Classic disconnect successful'))
        .catch((error: any) => console.log('Classic disconnect error:', error));
    } else if (connectedPrinter.type === 'ble' && bleManager) {
      bleManager.cancelDeviceConnection(connectedPrinter.id)
        .then(() => console.log('BLE disconnect successful'))
        .catch((error: any) => console.log('BLE disconnect error:', error));
    }
    
    setConnectedPrinter(null);
  };

  const testPrint = async () => {
    if (!connectedPrinter) {
      throw new Error('No printer connected');
    }

    if (!isBluetoothAvailable) {
      throw new Error('Bluetooth not available in this environment');
    }

    // Mock test print for demonstration
    console.log('Sending test print to:', connectedPrinter.name);
    
    // In a real implementation, you would send actual print commands here
    // For now, just simulate a successful test
    return Promise.resolve();
  };

  return {
    scanForDevices,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedPrinter,
    disconnectFromDevice,
    testPrint,
    isScanning,
    isPrintReady: !!connectedPrinter,
  };
}

export default useBluetooth;
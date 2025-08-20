// hooks/useBluetooth.ts - Simple approach based on working heart rate monitor
import { useMemo, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";
import RNBluetoothClassic, { BluetoothDevice as ClassicDevice } from "react-native-bluetooth-classic";

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
  allDevices: BluetoothDevice[];
  connectedPrinter: BluetoothDevice | null;
  isScanning: boolean;
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
  const bleManager = useMemo(() => new BleManager(), []);
  const [allDevices, setAllDevices] = useState<BluetoothDevice[]>([]);
  const [connectedPrinter, setConnectedPrinter] = useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

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
    setIsScanning(true);
    setAllDevices([]);

    // Scan for Bluetooth Classic devices (printers are usually classic)
    RNBluetoothClassic.getBondedDevices()
      .then((bondedDevices: ClassicDevice[]) => {
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

    // Also scan for BLE devices
    bleManager.startDeviceScan(null, null, (error, device) => {
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

    // Stop scanning after 10 seconds
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    try {
      console.log('Connecting to device:', device.name, device.type);
      
      if (device.type === 'classic') {
        // Connect using Bluetooth Classic
        const deviceConnection = await RNBluetoothClassic.connectToDevice(device.address);
        console.log('Classic connection successful:', deviceConnection);
        
        setConnectedPrinter({
          ...device,
          connected: true
        });
      } else if (device.type === 'ble') {
        // Connect using BLE
        const deviceConnection = await bleManager.connectToDevice(device.id);
        await deviceConnection.discoverAllServicesAndCharacteristics();
        console.log('BLE connection successful');
        
        setConnectedPrinter({
          ...device,
          connected: true
        });
      }
      
      bleManager.stopDeviceScan();
      setIsScanning(false);
      
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
      throw e;
    }
  };

  const disconnectFromDevice = () => {
    if (connectedPrinter) {
      console.log('Disconnecting from:', connectedPrinter.name);
      
      if (connectedPrinter.type === 'classic') {
        RNBluetoothClassic.disconnectFromDevice(connectedPrinter.address)
          .then(() => console.log('Classic disconnect successful'))
          .catch(error => console.log('Classic disconnect error:', error));
      } else if (connectedPrinter.type === 'ble') {
        bleManager.cancelDeviceConnection(connectedPrinter.id)
          .then(() => console.log('BLE disconnect successful'))
          .catch(error => console.log('BLE disconnect error:', error));
      }
      
      setConnectedPrinter(null);
    }
  };

  return {
    scanForDevices,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedPrinter,
    disconnectFromDevice,
    isScanning,
  };
}

export default useBluetooth;
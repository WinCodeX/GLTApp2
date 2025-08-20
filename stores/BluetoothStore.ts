// stores/BluetoothStore.ts - Centralized Bluetooth State Management
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';
import RNBluetoothClassic, { BluetoothDevice as RNClassicDevice } from 'react-native-bluetooth-classic';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useEffect } from 'react';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  type: 'classic' | 'ble';
  deviceType: 'printer' | 'scanner' | 'unknown';
  connected: boolean;
  rssi?: number;
  services?: string[];
  manufacturer?: string;
  bondState?: 'bonded' | 'bonding' | 'none';
}

export interface PrinterConnection {
  device: BluetoothDevice | null;
  isConnected: boolean;
  lastConnected?: Date;
  connectionType: 'classic' | 'ble' | null;
}

export interface BluetoothState {
  // Core state
  isInitialized: boolean;
  classicEnabled: boolean;
  bleEnabled: boolean;
  permissionsGranted: boolean;
  isScanning: boolean;
  
  // Device management
  devices: BluetoothDevice[];
  connectedDevices: BluetoothDevice[];
  
  // Printer specific
  printerConnection: PrinterConnection;
  
  // Managers
  bleManager: BleManager | null;
  
  // Actions
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  
  // Scanning
  startDeviceScan: () => Promise<void>;
  stopDeviceScan: () => void;
  
  // Connection management
  connectToDevice: (device: BluetoothDevice) => Promise<boolean>;
  disconnectDevice: (device: BluetoothDevice) => Promise<void>;
  disconnectAllDevices: () => Promise<void>;
  
  // Printer specific
  connectPrinter: (device: BluetoothDevice) => Promise<boolean>;
  disconnectPrinter: () => Promise<void>;
  testPrinterConnection: () => Promise<boolean>;
  
  // State management
  refreshConnections: () => Promise<void>;
  loadStoredPrinter: () => Promise<void>;
  saveStoredPrinter: (device: BluetoothDevice) => Promise<void>;
  clearStoredPrinter: () => Promise<void>;
}

export const useBluetoothStore = create<BluetoothState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isInitialized: false,
    classicEnabled: false,
    bleEnabled: false,
    permissionsGranted: false,
    isScanning: false,
    devices: [],
    connectedDevices: [],
    printerConnection: {
      device: null,
      isConnected: false,
      connectionType: null,
    },
    bleManager: null,

    // Initialize both Bluetooth systems
    initialize: async () => {
      console.log('🔄 [BLUETOOTH] Initializing Bluetooth systems...');
      
      try {
        const state = get();
        if (state.isInitialized) {
          console.log('ℹ️ [BLUETOOTH] Already initialized');
          return;
        }

        // Request permissions first
        const permissionsGranted = await get().requestPermissions();
        if (!permissionsGranted) {
          throw new Error('Bluetooth permissions not granted');
        }

        // Initialize BLE Manager
        const bleManager = new BleManager();
        set({ bleManager });

        // Check Classic Bluetooth
        let classicEnabled = false;
        try {
          classicEnabled = await RNBluetoothClassic.isBluetoothEnabled();
          console.log('🔵 [CLASSIC] Bluetooth Classic enabled:', classicEnabled);
        } catch (error) {
          console.warn('⚠️ [CLASSIC] Failed to check classic Bluetooth:', error);
        }

        // Check BLE state
        const bleState = await bleManager.state();
        const bleEnabled = bleState === State.PoweredOn;
        console.log('🔵 [BLE] BLE state:', bleState, 'enabled:', bleEnabled);

        set({
          isInitialized: true,
          classicEnabled,
          bleEnabled,
          permissionsGranted: true,
        });

        // Load stored printer
        await get().loadStoredPrinter();

        // Set up BLE state monitoring
        bleManager.onStateChange((state) => {
          console.log('🔵 [BLE] State changed to:', state);
          set({ bleEnabled: state === State.PoweredOn });
        }, true);

        console.log('✅ [BLUETOOTH] Initialization complete');
      } catch (error) {
        console.error('❌ [BLUETOOTH] Initialization failed:', error);
        set({
          isInitialized: true, // Set to true to prevent infinite loading
          permissionsGranted: false,
        });
        throw error;
      }
    },

    // Cleanup resources
    cleanup: async () => {
      console.log('🧹 [BLUETOOTH] Cleaning up...');
      
      const state = get();
      
      // Stop scanning
      if (state.isScanning) {
        get().stopDeviceScan();
      }

      // Disconnect all devices
      await get().disconnectAllDevices();

      // Destroy BLE manager
      if (state.bleManager) {
        state.bleManager.destroy();
      }

      set({
        isInitialized: false,
        bleManager: null,
        devices: [],
        connectedDevices: [],
        isScanning: false,
      });
    },

    // Request all required permissions
    requestPermissions: async (): Promise<boolean> => {
      if (Platform.OS !== 'android') {
        return true; // iOS handles permissions automatically
      }

      try {
        console.log('🔐 [PERMISSIONS] Requesting Bluetooth permissions...');

        const permissions = [];
        
        // Base permissions
        permissions.push(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );

        // Android 12+ permissions
        if (Platform.Version >= 31) {
          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
          }
          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          }
          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
          }
        } else {
          // Legacy permissions
          permissions.push(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN
          );
        }

        const results = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        console.log('🔐 [PERMISSIONS] Results:', results);
        console.log('🔐 [PERMISSIONS] All granted:', allGranted);

        set({ permissionsGranted: allGranted });
        return allGranted;
      } catch (error) {
        console.error('🔐 [PERMISSIONS] Request failed:', error);
        set({ permissionsGranted: false });
        return false;
      }
    },

    // Start scanning for devices (both Classic and BLE)
    startDeviceScan: async () => {
      console.log('🔍 [SCAN] Starting device scan...');
      
      const state = get();
      if (!state.isInitialized || !state.permissionsGranted) {
        throw new Error('Bluetooth not initialized or permissions not granted');
      }

      if (state.isScanning) {
        console.log('ℹ️ [SCAN] Already scanning');
        return;
      }

      set({ isScanning: true, devices: [] });

      try {
        // Scan Classic Bluetooth devices
        if (state.classicEnabled) {
          console.log('🔍 [CLASSIC] Scanning classic devices...');
          
          try {
            // Get bonded devices
            const bondedDevices = await RNBluetoothClassic.getBondedDevices();
            console.log('🔍 [CLASSIC] Found', bondedDevices.length, 'bonded devices');
            
            const classicDevices: BluetoothDevice[] = bondedDevices.map((device: RNClassicDevice) => ({
              id: device.address,
              name: device.name || 'Unknown Classic Device',
              address: device.address,
              type: 'classic',
              deviceType: detectDeviceType(device.name || ''),
              connected: false,
              bondState: device.bonded ? 'bonded' : 'none',
            }));

            // Discover new devices
            try {
              const discoveredDevices = await RNBluetoothClassic.startDiscovery();
              console.log('🔍 [CLASSIC] Discovered', discoveredDevices.length, 'new devices');
              
              const newClassicDevices: BluetoothDevice[] = discoveredDevices.map((device: RNClassicDevice) => ({
                id: device.address,
                name: device.name || 'Unknown Discovered Device',
                address: device.address,
                type: 'classic',
                deviceType: detectDeviceType(device.name || ''),
                connected: false,
                rssi: device.rssi,
                bondState: device.bonded ? 'bonded' : 'none',
              }));

              // Merge devices (avoid duplicates)
              const allClassicDevices = [...classicDevices];
              newClassicDevices.forEach(newDevice => {
                if (!allClassicDevices.find(d => d.address === newDevice.address)) {
                  allClassicDevices.push(newDevice);
                }
              });

              set(state => ({ devices: [...state.devices, ...allClassicDevices] }));
            } catch (discoveryError) {
              console.warn('⚠️ [CLASSIC] Discovery failed:', discoveryError);
              // Still add bonded devices
              set(state => ({ devices: [...state.devices, ...classicDevices] }));
            }
          } catch (classicError) {
            console.warn('⚠️ [CLASSIC] Classic scan failed:', classicError);
          }
        }

        // Scan BLE devices
        if (state.bleEnabled && state.bleManager) {
          console.log('🔍 [BLE] Scanning BLE devices...');
          
          const bleDevices: BluetoothDevice[] = [];
          
          state.bleManager.startDeviceScan(null, null, (error, device) => {
            if (error) {
              console.warn('⚠️ [BLE] Scan error:', error);
              return;
            }

            if (device && device.name) {
              const bleDevice: BluetoothDevice = {
                id: device.id,
                name: device.name,
                address: device.id, // BLE uses UUID as address
                type: 'ble',
                deviceType: detectDeviceType(device.name),
                connected: false,
                rssi: device.rssi || undefined,
                services: device.serviceUUIDs || [],
                manufacturer: device.manufacturerData ? 'Has manufacturer data' : undefined,
              };

              // Avoid duplicates
              const exists = bleDevices.find(d => d.id === device.id);
              if (!exists) {
                bleDevices.push(bleDevice);
                set(state => {
                  const existingIndex = state.devices.findIndex(d => d.id === device.id);
                  if (existingIndex >= 0) {
                    const updated = [...state.devices];
                    updated[existingIndex] = bleDevice;
                    return { devices: updated };
                  } else {
                    return { devices: [...state.devices, bleDevice] };
                  }
                });
              }
            }
          });

          // Stop BLE scan after 10 seconds
          setTimeout(() => {
            if (state.bleManager) {
              state.bleManager.stopDeviceScan();
              console.log('🔍 [BLE] BLE scan stopped after timeout');
            }
          }, 10000);
        }

        // Refresh connection states
        await get().refreshConnections();

      } catch (error) {
        console.error('❌ [SCAN] Scan failed:', error);
        throw error;
      } finally {
        setTimeout(() => {
          set({ isScanning: false });
          console.log('✅ [SCAN] Scan completed');
        }, 10000);
      }
    },

    // Stop scanning
    stopDeviceScan: () => {
      console.log('🛑 [SCAN] Stopping device scan...');
      
      const state = get();
      
      // Stop Classic discovery
      if (state.classicEnabled) {
        RNBluetoothClassic.cancelDiscovery().catch(error => {
          console.warn('⚠️ [CLASSIC] Failed to cancel discovery:', error);
        });
      }

      // Stop BLE scan
      if (state.bleManager) {
        state.bleManager.stopDeviceScan();
      }

      set({ isScanning: false });
    },

    // Connect to a device
    connectToDevice: async (device: BluetoothDevice): Promise<boolean> => {
      console.log('🔌 [CONNECT] Connecting to:', device.name, device.type);
      
      try {
        let connected = false;

        if (device.type === 'classic') {
          // Connect using Bluetooth Classic
          const connection = await RNBluetoothClassic.connectToDevice(device.address);
          connected = !!connection;
        } else if (device.type === 'ble') {
          // Connect using BLE
          const state = get();
          if (!state.bleManager) {
            throw new Error('BLE Manager not initialized');
          }

          const bleDevice = await state.bleManager.connectToDevice(device.id);
          await bleDevice.discoverAllServicesAndCharacteristics();
          connected = true;
        }

        if (connected) {
          // Update device state
          set(state => ({
            devices: state.devices.map(d => 
              d.id === device.id ? { ...d, connected: true } : d
            ),
            connectedDevices: [
              ...state.connectedDevices.filter(d => d.id !== device.id),
              { ...device, connected: true }
            ]
          }));

          console.log('✅ [CONNECT] Connected to:', device.name);
          return true;
        }

        return false;
      } catch (error) {
        console.error('❌ [CONNECT] Connection failed:', error);
        throw error;
      }
    },

    // Disconnect from a device
    disconnectDevice: async (device: BluetoothDevice) => {
      console.log('🔌 [DISCONNECT] Disconnecting from:', device.name);
      
      try {
        if (device.type === 'classic') {
          await RNBluetoothClassic.disconnectFromDevice(device.address);
        } else if (device.type === 'ble') {
          const state = get();
          if (state.bleManager) {
            await state.bleManager.cancelDeviceConnection(device.id);
          }
        }

        // Update state
        set(state => ({
          devices: state.devices.map(d => 
            d.id === device.id ? { ...d, connected: false } : d
          ),
          connectedDevices: state.connectedDevices.filter(d => d.id !== device.id)
        }));

        // Clear printer connection if this was the printer
        const state = get();
        if (state.printerConnection.device?.id === device.id) {
          set({
            printerConnection: {
              device: null,
              isConnected: false,
              connectionType: null,
            }
          });
          await get().clearStoredPrinter();
        }

        console.log('✅ [DISCONNECT] Disconnected from:', device.name);
      } catch (error) {
        console.error('❌ [DISCONNECT] Disconnection failed:', error);
        throw error;
      }
    },

    // Disconnect all devices
    disconnectAllDevices: async () => {
      console.log('🔌 [DISCONNECT] Disconnecting all devices...');
      
      const state = get();
      const promises = state.connectedDevices.map(device => 
        get().disconnectDevice(device).catch(error => {
          console.warn(`Failed to disconnect ${device.name}:`, error);
        })
      );

      await Promise.all(promises);
      console.log('✅ [DISCONNECT] All devices disconnected');
    },

    // Connect printer (specialized)
    connectPrinter: async (device: BluetoothDevice): Promise<boolean> => {
      console.log('🖨️ [PRINTER] Connecting printer:', device.name);
      
      try {
        // First, disconnect current printer if any
        const currentPrinter = get().printerConnection.device;
        if (currentPrinter && currentPrinter.id !== device.id) {
          await get().disconnectDevice(currentPrinter);
        }

        // Connect to the new printer
        const connected = await get().connectToDevice(device);
        
        if (connected) {
          set({
            printerConnection: {
              device: { ...device, connected: true },
              isConnected: true,
              lastConnected: new Date(),
              connectionType: device.type,
            }
          });

          await get().saveStoredPrinter(device);
          console.log('✅ [PRINTER] Printer connected and saved');
          return true;
        }

        return false;
      } catch (error) {
        console.error('❌ [PRINTER] Printer connection failed:', error);
        throw error;
      }
    },

    // Disconnect printer
    disconnectPrinter: async () => {
      console.log('🖨️ [PRINTER] Disconnecting printer...');
      
      const state = get();
      if (state.printerConnection.device) {
        await get().disconnectDevice(state.printerConnection.device);
      }

      set({
        printerConnection: {
          device: null,
          isConnected: false,
          connectionType: null,
        }
      });

      await get().clearStoredPrinter();
      console.log('✅ [PRINTER] Printer disconnected');
    },

    // Test printer connection
    testPrinterConnection: async (): Promise<boolean> => {
      console.log('🧪 [PRINTER] Testing printer connection...');
      
      const state = get();
      const printer = state.printerConnection.device;
      
      if (!printer || !state.printerConnection.isConnected) {
        throw new Error('No printer connected');
      }

      try {
        const testData = `\n--- TEST PRINT ---\nTimestamp: ${new Date().toLocaleString()}\nPrinter: ${printer.name}\nConnection: ${printer.type}\n--- END TEST ---\n\n`;
        
        if (printer.type === 'classic') {
          await RNBluetoothClassic.writeToDevice(printer.address, testData);
        } else if (printer.type === 'ble') {
          // For BLE, you'd need to find the correct characteristic for printing
          // This depends on the printer's service/characteristic setup
          console.log('🖨️ [BLE] BLE printing requires specific service/characteristic implementation');
          throw new Error('BLE printing not yet implemented');
        }

        console.log('✅ [PRINTER] Test print successful');
        return true;
      } catch (error) {
        console.error('❌ [PRINTER] Test print failed:', error);
        throw error;
      }
    },

    // Refresh connection states
    refreshConnections: async () => {
      console.log('🔄 [REFRESH] Refreshing connection states...');
      
      const state = get();
      
      try {
        // Check Classic connections
        if (state.classicEnabled) {
          const connectedClassic = await RNBluetoothClassic.getConnectedDevices();
          const connectedAddresses = connectedClassic.map(d => d.address);
          
          set(state => ({
            devices: state.devices.map(device => ({
              ...device,
              connected: device.type === 'classic' 
                ? connectedAddresses.includes(device.address)
                : device.connected
            }))
          }));
        }

        // Check BLE connections
        if (state.bleEnabled && state.bleManager) {
          const connectedBLE = await state.bleManager.connectedDevices([]);
          const connectedBLEIds = connectedBLE.map(d => d.id);
          
          set(state => ({
            devices: state.devices.map(device => ({
              ...device,
              connected: device.type === 'ble' 
                ? connectedBLEIds.includes(device.id)
                : device.connected
            }))
          }));
        }

        // Update connected devices list
        set(state => ({
          connectedDevices: state.devices.filter(d => d.connected)
        }));

        // Check printer connection
        const printer = state.printerConnection.device;
        if (printer) {
          const updatedDevice = state.devices.find(d => d.id === printer.id);
          if (updatedDevice) {
            set({
              printerConnection: {
                ...state.printerConnection,
                device: updatedDevice,
                isConnected: updatedDevice.connected,
              }
            });
          }
        }

        console.log('✅ [REFRESH] Connection states refreshed');
      } catch (error) {
        console.error('❌ [REFRESH] Failed to refresh connections:', error);
      }
    },

    // Load stored printer
    loadStoredPrinter: async () => {
      try {
        const stored = await AsyncStorage.getItem('bluetooth_stored_printer');
        if (stored) {
          const device: BluetoothDevice = JSON.parse(stored);
          console.log('📱 [STORAGE] Loaded stored printer:', device.name);
          
          set({
            printerConnection: {
              device,
              isConnected: false, // Will be updated by refresh
              lastConnected: device.lastConnected ? new Date(device.lastConnected) : undefined,
              connectionType: device.type,
            }
          });
        }
      } catch (error) {
        console.error('❌ [STORAGE] Failed to load stored printer:', error);
      }
    },

    // Save stored printer
    saveStoredPrinter: async (device: BluetoothDevice) => {
      try {
        const deviceToStore = {
          ...device,
          lastConnected: new Date().toISOString(),
        };
        await AsyncStorage.setItem('bluetooth_stored_printer', JSON.stringify(deviceToStore));
        console.log('💾 [STORAGE] Printer saved:', device.name);
      } catch (error) {
        console.error('❌ [STORAGE] Failed to save printer:', error);
      }
    },

    // Clear stored printer
    clearStoredPrinter: async () => {
      try {
        await AsyncStorage.removeItem('bluetooth_stored_printer');
        console.log('🗑️ [STORAGE] Stored printer cleared');
      } catch (error) {
        console.error('❌ [STORAGE] Failed to clear stored printer:', error);
      }
    },
  }))
);

// Device type detection helper
function detectDeviceType(deviceName: string): 'printer' | 'scanner' | 'unknown' {
  const name = deviceName?.toLowerCase() || '';
  
  // Printer patterns
  if (name.includes('print') || name.includes('hp') || name.includes('zebra') || 
      name.includes('epson') || name.includes('brother') || name.includes('canon') ||
      name.includes('receipt') || name.includes('thermal') || name.includes('pos')) {
    return 'printer';
  }
  
  // Scanner patterns
  if (name.includes('scan') || name.includes('honeywell') || name.includes('symbol') || 
      name.includes('datalogic') || name.includes('intermec') || name.includes('qr') ||
      name.includes('barcode')) {
    return 'scanner';
  }
  
  return 'unknown';
}

// Bluetooth store hooks for easier usage
export const useBluetoothInitialization = () => {
  const { initialize, cleanup, isInitialized } = useBluetoothStore();
  
  useEffect(() => {
    initialize();
    return () => {
      cleanup();
    };
  }, [initialize, cleanup]);
  
  return isInitialized;
};

export const usePrinterConnection = () => {
  const { printerConnection, connectPrinter, disconnectPrinter, testPrinterConnection } = useBluetoothStore();
  return {
    printer: printerConnection,
    connect: connectPrinter,
    disconnect: disconnectPrinter,
    test: testPrinterConnection,
  };
};
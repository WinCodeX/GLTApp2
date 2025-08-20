// stores/BluetoothStore.ts - Fixed version with better state management
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
  
  // Internal state
  _connectionCheckInterval: NodeJS.Timeout | null;
  _isRefreshing: boolean;
  
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
  startConnectionMonitoring: () => void;
  stopConnectionMonitoring: () => void;
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
    _connectionCheckInterval: null,
    _isRefreshing: false,

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

        // Load stored printer first
        await get().loadStoredPrinter();

        // Start connection monitoring
        get().startConnectionMonitoring();

        // Set up BLE state monitoring
        bleManager.onStateChange((state) => {
          console.log('🔵 [BLE] State changed to:', state);
          set({ bleEnabled: state === State.PoweredOn });
        }, true);

        // Initial connection refresh
        setTimeout(() => {
          get().refreshConnections();
        }, 1000);

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
      
      // Stop connection monitoring
      get().stopConnectionMonitoring();
      
      // Stop scanning
      if (state.isScanning) {
        get().stopDeviceScan();
      }

      // Don't disconnect all devices on cleanup - this was causing the issue!
      // Only disconnect if explicitly requested
      
      // Destroy BLE manager
      if (state.bleManager) {
        state.bleManager.destroy();
      }

      set({
        isInitialized: false,
        bleManager: null,
        isScanning: false,
        _connectionCheckInterval: null,
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
          // Update device state immediately
          const updatedDevice = { ...device, connected: true };
          
          set(state => ({
            devices: state.devices.map(d => 
              d.id === device.id ? updatedDevice : d
            ),
            connectedDevices: [
              ...state.connectedDevices.filter(d => d.id !== device.id),
              updatedDevice
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

        // Update state immediately
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

    // Connect printer (specialized) - FIXED
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
          const connectedDevice = { ...device, connected: true };
          
          // Update printer connection state immediately and persist
          set({
            printerConnection: {
              device: connectedDevice,
              isConnected: true,
              lastConnected: new Date(),
              connectionType: device.type,
            }
          });

          // Save to storage immediately
          await get().saveStoredPrinter(connectedDevice);
          
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

    // Refresh connection states - IMPROVED
    refreshConnections: async () => {
      const state = get();
      
      // Prevent concurrent refreshes
      if (state._isRefreshing) {
        console.log('🔄 [REFRESH] Already refreshing, skipping...');
        return;
      }
      
      console.log('🔄 [REFRESH] Refreshing connection states...');
      set({ _isRefreshing: true });
      
      try {
        // Check Classic connections
        if (state.classicEnabled) {
          try {
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
          } catch (error) {
            console.warn('⚠️ [REFRESH] Failed to check classic connections:', error);
          }
        }

        // Check BLE connections
        if (state.bleEnabled && state.bleManager) {
          try {
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
          } catch (error) {
            console.warn('⚠️ [REFRESH] Failed to check BLE connections:', error);
          }
        }

        // Update connected devices list
        const currentState = get();
        const connectedDevices = currentState.devices.filter(d => d.connected);
        
        set({ connectedDevices });

        // Check and update printer connection status
        const printer = currentState.printerConnection.device;
        if (printer) {
          const updatedDevice = currentState.devices.find(d => d.id === printer.id);
          if (updatedDevice) {
            const isStillConnected = updatedDevice.connected;
            
            set(state => ({
              printerConnection: {
                ...state.printerConnection,
                device: updatedDevice,
                isConnected: isStillConnected,
              }
            }));
            
            // If printer disconnected unexpectedly, clear stored data
            if (!isStillConnected && currentState.printerConnection.isConnected) {
              console.log('⚠️ [REFRESH] Printer disconnected unexpectedly, clearing storage');
              await get().clearStoredPrinter();
            }
          }
        }

        console.log('✅ [REFRESH] Connection states refreshed');
      } catch (error) {
        console.error('❌ [REFRESH] Failed to refresh connections:', error);
      } finally {
        set({ _isRefreshing: false });
      }
    },

    // Load stored printer - IMPROVED
    loadStoredPrinter: async () => {
      try {
        const stored = await AsyncStorage.getItem('bluetooth_stored_printer');
        if (stored) {
          const device: BluetoothDevice = JSON.parse(stored);
          console.log('📱 [STORAGE] Loaded stored printer:', device.name);
          
          // Set the printer in state but don't assume it's connected
          set({
            printerConnection: {
              device,
              isConnected: false, // Will be updated by refresh
              lastConnected: device.lastConnected ? new Date(device.lastConnected) : undefined,
              connectionType: device.type,
            }
          });
          
          // Try to verify connection after a short delay
          setTimeout(async () => {
            await get().refreshConnections();
            
            // If still connected, update the connection status
            const currentState = get();
            const updatedDevice = currentState.devices.find(d => d.id === device.id);
            if (updatedDevice?.connected) {
              set(state => ({
                printerConnection: {
                  ...state.printerConnection,
                  isConnected: true,
                }
              }));
              console.log('✅ [STORAGE] Stored printer is still connected');
            } else {
              console.log('ℹ️ [STORAGE] Stored printer not currently connected');
            }
          }, 2000);
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

    // NEW: Start connection monitoring
    startConnectionMonitoring: () => {
      const state = get();
      
      if (state._connectionCheckInterval) {
        console.log('ℹ️ [MONITOR] Connection monitoring already active');
        return;
      }
      
      console.log('🔄 [MONITOR] Starting connection monitoring...');
      
      const interval = setInterval(async () => {
        await get().refreshConnections();
      }, 10000); // Check every 10 seconds
      
      set({ _connectionCheckInterval: interval });
    },

    // NEW: Stop connection monitoring
    stopConnectionMonitoring: () => {
      const state = get();
      
      if (state._connectionCheckInterval) {
        console.log('🛑 [MONITOR] Stopping connection monitoring...');
        clearInterval(state._connectionCheckInterval);
        set({ _connectionCheckInterval: null });
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

// Bluetooth store hooks for easier usage - IMPROVED
export const useBluetoothInitialization = () => {
  const { initialize, cleanup, isInitialized } = useBluetoothStore();
  
  useEffect(() => {
    let mounted = true;
    
    const initBluetooth = async () => {
      if (mounted && !isInitialized) {
        try {
          await initialize();
        } catch (error) {
          console.error('Failed to initialize Bluetooth:', error);
        }
      }
    };
    
    initBluetooth();
    
    // Don't cleanup on unmount to preserve connections
    return () => {
      mounted = false;
    };
  }, [initialize, isInitialized]);
  
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
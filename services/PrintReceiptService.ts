// services/PrintReceiptService.ts - FIXED: Added proper permission handling
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

interface PackageData {
  code: string;
  receiver_name: string;
  route_description: string;
  sender_name?: string;
  state_display?: string;
}

interface PrinterConnection {
  name: string;
  address: string;
}

interface PrintStatus {
  isReady: boolean;
  printerName?: string;
  printerAddress?: string;
  error?: string;
  bluetoothEnabled?: boolean;
  permissionsGranted?: boolean;
}

class PrintReceiptService {
  private static instance: PrintReceiptService;

  static getInstance(): PrintReceiptService {
    if (!PrintReceiptService.instance) {
      PrintReceiptService.instance = new PrintReceiptService();
    }
    return PrintReceiptService.instance;
  }

  // NEW: Request all required permissions
  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true; // iOS handles permissions differently
    }

    try {
      const permissions = Platform.Version >= 31 ? [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ] : [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      // Check if all permissions were granted
      const allPermissionsGranted = Object.values(results).every(
        result => result === PermissionsAndroid.RESULTS.GRANTED
      );

      console.log('🔐 [PERMISSIONS] Bluetooth permissions granted:', allPermissionsGranted);
      console.log('🔐 [PERMISSIONS] Results:', results);
      
      return allPermissionsGranted;
    } catch (error) {
      console.error('🔐 [PERMISSIONS] Error requesting permissions:', error);
      return false;
    }
  }

  // ENHANCED: Check permissions first, then status
  async checkPrinterStatus(): Promise<PrintStatus> {
    try {
      console.log('🖨️ [STATUS] Checking printer status with permissions...');
      
      // Step 1: Check permissions first
      const permissionsGranted = await this.requestBluetoothPermissions();
      if (!permissionsGranted) {
        return {
          isReady: false,
          permissionsGranted: false,
          error: 'Bluetooth permissions not granted. Please grant permissions in app settings.'
        };
      }

      // Step 2: Check if printer is configured
      const connectedPrinter = await AsyncStorage.getItem('connected_printer');
      if (!connectedPrinter) {
        return {
          isReady: false,
          permissionsGranted: true,
          error: 'No printer configured. Please connect a printer in Settings.'
        };
      }

      const printer: PrinterConnection = JSON.parse(connectedPrinter);
      console.log('🖨️ [STATUS] Found configured printer:', printer.name);

      // Step 3: Check Bluetooth status
      let bluetoothEnabled = false;
      try {
        bluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();
        console.log('🔵 [STATUS] Bluetooth enabled:', bluetoothEnabled);
      } catch (error) {
        console.error('🔵 [STATUS] Failed to check Bluetooth:', error);
        return {
          isReady: false,
          printerName: printer.name,
          printerAddress: printer.address,
          bluetoothEnabled: false,
          permissionsGranted: true,
          error: 'Failed to access Bluetooth. Check permissions and try again.'
        };
      }

      if (!bluetoothEnabled) {
        return {
          isReady: false,
          printerName: printer.name,
          printerAddress: printer.address,
          bluetoothEnabled: false,
          permissionsGranted: true,
          error: 'Bluetooth is disabled. Please enable Bluetooth and try again.'
        };
      }

      // Step 4: Check device connection with retry
      let isConnected = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!isConnected && attempts < maxAttempts) {
        try {
          console.log(`🔍 [STATUS] Connection check attempt ${attempts + 1}...`);
          isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
          console.log(`🔍 [STATUS] Connection result: ${isConnected}`);
          
          if (!isConnected && attempts < maxAttempts - 1) {
            // Try to reconnect
            console.log('🔄 [STATUS] Attempting reconnection...');
            try {
              await RNBluetoothClassic.connectToDevice(printer.address);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for connection
              isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
            } catch (connectError) {
              console.warn('⚠️ [STATUS] Reconnection failed:', connectError);
            }
          }
          attempts++;
        } catch (checkError) {
          console.warn(`⚠️ [STATUS] Connection check ${attempts + 1} failed:`, checkError);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      console.log('✅ [STATUS] Final printer status:', {
        isReady: isConnected,
        printerName: printer.name,
        bluetoothEnabled,
        permissionsGranted: true
      });

      return {
        isReady: isConnected,
        printerName: printer.name,
        printerAddress: printer.address,
        bluetoothEnabled,
        permissionsGranted: true,
        error: isConnected ? undefined : `Printer "${printer.name}" is not connected. Turn on printer and try again.`
      };
      
    } catch (error: any) {
      console.error('❌ [STATUS] Comprehensive status check failed:', error);
      return {
        isReady: false,
        permissionsGranted: true,
        error: `Status check failed: ${error.message || 'Unknown error'}`
      };
    }
  }

  // ENHANCED: Print with better error handling
  async printPackageReceipt(packageData: PackageData): Promise<boolean> {
    try {
      console.log('🖨️ [PRINT] Starting print process for:', packageData.code);
      
      // Pre-flight check with permissions
      const status = await this.checkPrinterStatus();
      if (!status.isReady) {
        throw new Error(status.error || 'Printer not ready');
      }

      console.log('✅ [PRINT] Printer ready, formatting receipt...');
      const receiptData = this.formatReceipt(packageData);
      
      console.log('📤 [PRINT] Sending to printer...');
      await this.sendToPrinterWithTimeout(status.printerAddress!, receiptData, 20000);
      
      console.log('✅ [PRINT] Print completed successfully');
      return true;
      
    } catch (error: any) {
      console.error('❌ [PRINT] Print failed:', error);
      throw new Error(this.getDetailedErrorMessage(error));
    }
  }

  // ENHANCED: Better error messages
  private getDetailedErrorMessage(error: any): string {
    const message = error.message || error.toString();
    
    if (message.includes('permissions not granted')) {
      return 'Bluetooth permission denied. Go to Settings → App permissions → Enable Bluetooth.';
    }
    if (message.includes('No printer configured')) {
      return 'No printer setup found. Go to Settings → Bluetooth to connect a printer.';
    }
    if (message.includes('Bluetooth is disabled')) {
      return 'Bluetooth is off. Enable Bluetooth in device settings and try again.';
    }
    if (message.includes('not connected')) {
      return 'Printer connection lost. Turn on printer and reconnect in Settings.';
    }
    if (message.includes('timed out')) {
      return 'Print job timed out. Printer may be busy - wait and try again.';
    }
    if (message.includes('Device not found')) {
      return 'Printer not found. Turn printer on and reconnect in Settings.';
    }
    if (message.includes('Failed to access Bluetooth')) {
      return 'Bluetooth access failed. Restart app and grant permissions.';
    }
    
    return `Print failed: ${message}`;
  }

  private async sendToPrinterWithTimeout(address: string, data: string, timeoutMs: number = 20000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Print operation timed out. The printer may be busy or disconnected.'));
      }, timeoutMs);

      RNBluetoothClassic.writeToDevice(address, data)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private formatReceipt(packageData: PackageData): string {
    const timestamp = new Date().toLocaleString();
    
    // ESC/POS commands for basic formatting
    const ESC = '\x1B';
    const GS = '\x1D';
    const LF = '\n';
    
    const RESET = ESC + '@';
    const CENTER = ESC + 'a' + '\x01';
    const LEFT = ESC + 'a' + '\x00';
    const BOLD_ON = ESC + 'E' + '\x01';
    const BOLD_OFF = ESC + 'E' + '\x00';
    const DOUBLE_HEIGHT = GS + '!' + '\x01';
    const NORMAL_SIZE = GS + '!' + '\x00';
    const CUT_PAPER = GS + 'V' + '\x42' + '\x00';
    
    let receipt = RESET;
    
    // Header
    receipt += CENTER + BOLD_ON + DOUBLE_HEIGHT;
    receipt += 'GLT LOGISTICS' + LF;
    receipt += NORMAL_SIZE + BOLD_OFF + LF;
    
    receipt += 'If lost contact us via:' + LF;
    receipt += 'gltlogistics-ke@gmail.com' + LF;
    receipt += 'Or 0712293377' + LF + LF;
    
    receipt += '================================' + LF + LF;
    
    // Package details
    receipt += LEFT + BOLD_ON;
    receipt += 'PACKAGE CODE:' + LF;
    receipt += packageData.code + LF;
    receipt += BOLD_OFF + LF;
    
    receipt += 'TO: ' + packageData.receiver_name + LF + LF;
    receipt += 'DESTINATION:' + LF;
    receipt += packageData.route_description + LF + LF;
    
    if (packageData.sender_name) {
      receipt += 'FROM: ' + packageData.sender_name + LF + LF;
    }
    
    if (packageData.state_display) {
      receipt += 'STATUS: ' + packageData.state_display + LF + LF;
    }
    
    receipt += '--------------------------------' + LF + LF;
    receipt += CENTER + '[QR CODE]' + LF;
    receipt += packageData.code + LF + LF;
    
    receipt += LEFT;
    receipt += 'Printed: ' + timestamp + LF + LF;
    receipt += CENTER;
    receipt += '--------------------------------' + LF;
    receipt += 'Designed by Infinity.Co' + LF + LF + LF;
    
    receipt += CUT_PAPER;
    
    return receipt;
  }

  // ENHANCED: Test print with better error handling
  async testPrint(): Promise<boolean> {
    const testPackage: PackageData = {
      code: 'PKG-TEST-' + Date.now(),
      receiver_name: 'Test Customer',
      route_description: 'Test Location',
      sender_name: 'GLT Logistics',
      state_display: 'Test Print'
    };
    
    return this.printPackageReceipt(testPackage);
  }
}

export default PrintReceiptService;
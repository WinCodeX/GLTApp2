// services/EnhancedPrintService.ts - Fixed to properly integrate with Bluetooth Store
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import Toast from 'react-native-toast-message';
import { BluetoothDevice, useBluetoothStore } from '../stores/BluetoothStore';

export interface PackageData {
  code: string;
  receiver_name: string;
  route_description: string;
  sender_name?: string;
  state_display?: string;
  pickup_location?: string;
  delivery_address?: string;
  weight?: string;
  dimensions?: string;
  special_instructions?: string;
  tracking_url?: string;
}

export interface PrintOptions {
  copies?: number;
  includeLogo?: boolean;
  includeQR?: boolean;
  labelSize?: 'small' | 'medium' | 'large';
  printType?: 'receipt' | 'label' | 'invoice';
}

export interface PrintResult {
  success: boolean;
  message: string;
  printTime?: Date;
  printerUsed?: string;
  errorCode?: string;
}

class EnhancedPrintService {
  private static instance: EnhancedPrintService;

  static getInstance(): EnhancedPrintService {
    if (!EnhancedPrintService.instance) {
      EnhancedPrintService.instance = new EnhancedPrintService();
    }
    return EnhancedPrintService.instance;
  }

  constructor() {
    // Subscribe to store changes for printer connection
    useBluetoothStore.subscribe(
      (state) => state.printerConnection,
      (printerConnection) => {
        console.log('🖨️ [PRINT-SERVICE] Printer connection changed:', {
          isConnected: printerConnection.isConnected,
          deviceName: printerConnection.device?.name,
          deviceType: printerConnection.device?.type
        });
      }
    );
  }

  /**
   * Get the current store state - FIXED to always get fresh state
   */
  private getBluetoothState() {
    return useBluetoothStore.getState();
  }

  /**
   * Check if printing is available - IMPROVED error reporting
   */
  async isPrintingAvailable(): Promise<{ available: boolean; reason?: string }> {
    console.log('🔍 [PRINT-SERVICE] Checking printing availability...');
    
    try {
      const state = this.getBluetoothState();
      
      // Check if Bluetooth is initialized
      if (!state.isInitialized) {
        return { available: false, reason: 'Bluetooth system not initialized' };
      }
      
      // Check permissions
      if (!state.permissionsGranted) {
        return { available: false, reason: 'Bluetooth permissions not granted' };
      }
      
      // Check if any Bluetooth is enabled
      if (!state.classicEnabled && !state.bleEnabled) {
        return { available: false, reason: 'Bluetooth is disabled' };
      }
      
      // Check printer connection
      if (!state.printerConnection.isConnected || !state.printerConnection.device) {
        return { available: false, reason: 'No printer connected' };
      }
      
      // Verify printer is actually still connected
      const printer = state.printerConnection.device;
      let actuallyConnected = false;
      
      if (printer.type === 'classic') {
        try {
          actuallyConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
          console.log('🔍 [PRINT-SERVICE] Classic printer connection verified:', actuallyConnected);
        } catch (error) {
          console.warn('⚠️ [PRINT-SERVICE] Failed to verify classic connection:', error);
          return { available: false, reason: 'Cannot verify printer connection' };
        }
      } else if (printer.type === 'ble') {
        // For BLE, we'd need to check the BLE manager
        const bleManager = state.bleManager;
        if (bleManager) {
          try {
            const connectedDevices = await bleManager.connectedDevices([]);
            actuallyConnected = connectedDevices.some(d => d.id === printer.id);
            console.log('🔍 [PRINT-SERVICE] BLE printer connection verified:', actuallyConnected);
          } catch (error) {
            console.warn('⚠️ [PRINT-SERVICE] Failed to verify BLE connection:', error);
            return { available: false, reason: 'Cannot verify BLE printer connection' };
          }
        } else {
          return { available: false, reason: 'BLE manager not available' };
        }
      }
      
      if (!actuallyConnected) {
        // Update store to reflect disconnection
        console.warn('⚠️ [PRINT-SERVICE] Printer not actually connected, refreshing store...');
        await state.refreshConnections();
        return { available: false, reason: 'Printer disconnected' };
      }
      
      console.log('✅ [PRINT-SERVICE] Printing is available');
      return { available: true };
      
    } catch (error: any) {
      console.error('❌ [PRINT-SERVICE] Error checking availability:', error);
      return { available: false, reason: `System error: ${error.message}` };
    }
  }

  /**
   * Print package receipt/label - IMPROVED with better error handling
   */
  async printPackage(
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [PRINT-SERVICE] Starting print job for:', packageData.code);
    
    try {
      // Check availability first with fresh state
      const availability = await this.isPrintingAvailable();
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const state = this.getBluetoothState();
      const printer = state.printerConnection.device!;
      
      console.log('📄 [PRINT-SERVICE] Formatting print data...');
      const printData = this.formatPrintData(packageData, options);
      
      console.log('📤 [PRINT-SERVICE] Sending to printer...');
      const printTime = new Date();
      
      if (printer.type === 'classic') {
        await this.printViaClassic(printer, printData, options);
      } else if (printer.type === 'ble') {
        await this.printViaBLE(printer, printData, options);
      }
      
      console.log('✅ [PRINT-SERVICE] Print completed successfully');
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Print Successful',
        text2: `${packageData.code} printed to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Successfully printed ${packageData.code}`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [PRINT-SERVICE] Print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      
      return {
        success: false,
        message: errorMessage,
        errorCode: error.code || 'PRINT_ERROR',
      };
    }
  }

  /**
   * Print via Bluetooth Classic - IMPROVED with better timeout handling
   */
  private async printViaClassic(
    printer: BluetoothDevice, 
    printData: string, 
    options: PrintOptions
  ): Promise<void> {
    console.log('🔵 [CLASSIC] Printing via Bluetooth Classic...');
    
    try {
      // Verify connection before printing
      const isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
      if (!isConnected) {
        throw new Error('Printer disconnected before print');
      }

      // Send data with timeout
      await this.sendDataWithTimeout(
        () => RNBluetoothClassic.writeToDevice(printer.address, printData),
        30000 // 30 second timeout
      );
      
      // Send additional copies if requested
      if (options.copies && options.copies > 1) {
        for (let i = 1; i < options.copies; i++) {
          console.log(`🔵 [CLASSIC] Printing copy ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between copies
          
          // Verify connection again before each copy
          const stillConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
          if (!stillConnected) {
            throw new Error(`Printer disconnected before copy ${i + 1}`);
          }
          
          await this.sendDataWithTimeout(
            () => RNBluetoothClassic.writeToDevice(printer.address, printData),
            30000
          );
        }
      }
      
      console.log('✅ [CLASSIC] Classic print completed');
    } catch (error: any) {
      console.error('❌ [CLASSIC] Classic print failed:', error);
      throw new Error(`Classic Bluetooth print failed: ${error.message}`);
    }
  }

  /**
   * Print via BLE (Basic implementation - needs printer-specific service/characteristic)
   */
  private async printViaBLE(
    printer: BluetoothDevice, 
    printData: string, 
    options: PrintOptions
  ): Promise<void> {
    console.log('🔵 [BLE] Printing via BLE...');
    
    const state = this.getBluetoothState();
    const bleManager = state.bleManager;
    
    if (!bleManager) {
      throw new Error('BLE Manager not available');
    }
    
    try {
      // Note: This is a basic implementation
      // Real BLE printing requires knowing the specific service/characteristic UUIDs for your printer
      
      // Common printer service UUIDs (examples)
      const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
      const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';
      
      // For demonstration - you'll need to implement based on your specific printer
      console.log('🔵 [BLE] BLE printing implementation needed for specific printer model');
      console.log('🔵 [BLE] Printer services:', printer.services);
      
      // This would be the general approach:
      // 1. Connect to device (already connected)
      // 2. Discover services and characteristics
      // 3. Write to the appropriate characteristic
      // 4. Handle response/acknowledgment
      
      throw new Error('BLE printing requires printer-specific implementation');
      
    } catch (error: any) {
      console.error('❌ [BLE] BLE print failed:', error);
      throw new Error(`BLE print failed: ${error.message}`);
    }
  }

  /**
   * Format print data based on package and options
   */
  private formatPrintData(packageData: PackageData, options: PrintOptions): string {
    console.log('📄 [FORMAT] Formatting print data, type:', options.printType || 'receipt');
    
    const printType = options.printType || 'receipt';
    
    switch (printType) {
      case 'label':
        return this.formatShippingLabel(packageData, options);
      case 'invoice':
        return this.formatInvoice(packageData, options);
      case 'receipt':
      default:
        return this.formatReceipt(packageData, options);
    }
  }

  /**
   * Format standard receipt
   */
  private formatReceipt(packageData: PackageData, options: PrintOptions): string {
    const timestamp = new Date().toLocaleString();
    const size = options.labelSize || 'medium';
    
    // ESC/POS commands for formatting
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
    const LINE_SPACING_DEFAULT = ESC + '2';
    const LINE_SPACING_TIGHT = ESC + '1';
    
    let receipt = RESET + LINE_SPACING_DEFAULT;
    
    // Header with logo option
    if (options.includeLogo !== false) {
      receipt += CENTER + BOLD_ON + DOUBLE_HEIGHT;
      receipt += 'GLT LOGISTICS' + LF;
      receipt += NORMAL_SIZE + BOLD_OFF;
      receipt += 'Your Trusted Delivery Partner' + LF + LF;
    }
    
    receipt += 'Contact: gltlogistics-ke@gmail.com' + LF;
    receipt += 'Phone: +254 712 293 377' + LF + LF;
    
    receipt += '================================' + LF + LF;
    
    // Package details
    receipt += LEFT + BOLD_ON + DOUBLE_HEIGHT;
    receipt += packageData.code + LF;
    receipt += NORMAL_SIZE + BOLD_OFF + LF;
    
    receipt += 'TO: ' + packageData.receiver_name + LF;
    receipt += 'DESTINATION: ' + packageData.route_description + LF + LF;
    
    if (packageData.delivery_address) {
      receipt += 'ADDRESS:' + LF;
      receipt += packageData.delivery_address + LF + LF;
    }
    
    if (packageData.sender_name) {
      receipt += 'FROM: ' + packageData.sender_name + LF;
    }
    
    if (packageData.pickup_location) {
      receipt += 'PICKUP: ' + packageData.pickup_location + LF;
    }
    
    if (packageData.weight || packageData.dimensions) {
      receipt += LF + 'PACKAGE DETAILS:' + LF;
      if (packageData.weight) receipt += 'Weight: ' + packageData.weight + LF;
      if (packageData.dimensions) receipt += 'Dimensions: ' + packageData.dimensions + LF;
    }
    
    if (packageData.state_display) {
      receipt += LF + 'STATUS: ' + packageData.state_display + LF;
    }
    
    if (packageData.special_instructions) {
      receipt += LF + 'INSTRUCTIONS:' + LF;
      receipt += packageData.special_instructions + LF;
    }
    
    receipt += LF + '--------------------------------' + LF;
    
    // QR Code section
    if (options.includeQR !== false) {
      receipt += CENTER + LF;
      receipt += '[QR CODE PLACEHOLDER]' + LF;
      receipt += packageData.code + LF;
      if (packageData.tracking_url) {
        receipt += 'Track: ' + packageData.tracking_url + LF;
      }
      receipt += LF;
    }
    
    receipt += LEFT;
    receipt += 'Printed: ' + timestamp + LF + LF;
    
    receipt += CENTER;
    receipt += 'Thank you for choosing GLT Logistics!' + LF;
    receipt += 'Safe and secure delivery guaranteed' + LF + LF;
    receipt += '--------------------------------' + LF;
    receipt += 'Powered by Infinity.Co Technology' + LF + LF + LF;
    
    receipt += CUT_PAPER;
    
    return receipt;
  }

  /**
   * Format shipping label
   */
  private formatShippingLabel(packageData: PackageData, options: PrintOptions): string {
    // Shipping label format - more compact and structured
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
    
    let label = RESET;
    
    // Compact header
    label += CENTER + BOLD_ON;
    label += 'GLT LOGISTICS' + LF;
    label += BOLD_OFF + 'SHIPPING LABEL' + LF + LF;
    
    // Package code prominently
    label += DOUBLE_HEIGHT + BOLD_ON;
    label += packageData.code + LF;
    label += NORMAL_SIZE + BOLD_OFF + LF;
    
    // Essential shipping info
    label += LEFT;
    label += 'TO: ' + packageData.receiver_name + LF;
    label += packageData.route_description + LF;
    
    if (packageData.delivery_address) {
      label += packageData.delivery_address + LF;
    }
    
    label += LF + 'FROM: ' + (packageData.sender_name || 'GLT Logistics') + LF + LF;
    
    // QR Code
    if (options.includeQR !== false) {
      label += CENTER + '[QR CODE]' + LF + packageData.code + LF + LF;
    }
    
    label += LEFT + 'Status: ' + (packageData.state_display || 'Processing') + LF;
    label += 'Generated: ' + new Date().toLocaleString() + LF + LF + LF;
    
    return label;
  }

  /**
   * Format invoice
   */
  private formatInvoice(packageData: PackageData, options: PrintOptions): string {
    // Full invoice format with more details
    const timestamp = new Date().toLocaleString();
    
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
    
    let invoice = RESET;
    
    // Invoice header
    invoice += CENTER + BOLD_ON + DOUBLE_HEIGHT;
    invoice += 'GLT LOGISTICS' + LF;
    invoice += NORMAL_SIZE + 'DELIVERY INVOICE' + LF;
    invoice += BOLD_OFF + LF;
    
    invoice += 'Email: gltlogistics-ke@gmail.com' + LF;
    invoice += 'Phone: +254 712 293 377' + LF + LF;
    
    invoice += '================================' + LF + LF;
    
    // Invoice details
    invoice += LEFT;
    invoice += 'Invoice Date: ' + timestamp + LF;
    invoice += 'Package ID: ' + packageData.code + LF + LF;
    
    invoice += BOLD_ON + 'SHIPMENT DETAILS:' + BOLD_OFF + LF;
    invoice += 'From: ' + (packageData.sender_name || 'N/A') + LF;
    invoice += 'To: ' + packageData.receiver_name + LF;
    invoice += 'Destination: ' + packageData.route_description + LF;
    
    if (packageData.delivery_address) {
      invoice += 'Address: ' + packageData.delivery_address + LF;
    }
    
    if (packageData.weight || packageData.dimensions) {
      invoice += LF + BOLD_ON + 'PACKAGE SPECIFICATIONS:' + BOLD_OFF + LF;
      if (packageData.weight) invoice += 'Weight: ' + packageData.weight + LF;
      if (packageData.dimensions) invoice += 'Dimensions: ' + packageData.dimensions + LF;
    }
    
    invoice += LF + BOLD_ON + 'SERVICE DETAILS:' + BOLD_OFF + LF;
    invoice += 'Status: ' + (packageData.state_display || 'In Transit') + LF;
    
    if (packageData.special_instructions) {
      invoice += 'Instructions: ' + packageData.special_instructions + LF;
    }
    
    invoice += LF + '--------------------------------' + LF + LF;
    
    // QR and tracking
    if (options.includeQR !== false) {
      invoice += CENTER;
      invoice += '[QR CODE]' + LF;
      invoice += packageData.code + LF;
      if (packageData.tracking_url) {
        invoice += packageData.tracking_url + LF;
      }
      invoice += LF;
    }
    
    invoice += LEFT;
    invoice += 'Thank you for choosing GLT Logistics' + LF;
    invoice += 'Your package is in safe hands!' + LF + LF + LF;
    
    return invoice;
  }

  /**
   * Test print functionality
   */
  async testPrint(options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [PRINT-SERVICE] Running test print...');
    
    const testPackage: PackageData = {
      code: 'TEST-' + Date.now(),
      receiver_name: 'Test Customer',
      route_description: 'Test Location',
      sender_name: 'GLT Logistics',
      state_display: 'Test Print',
      delivery_address: '123 Test Street, Test City',
      weight: '2.5 kg',
      special_instructions: 'This is a test print to verify printer functionality.',
    };
    
    const testOptions: PrintOptions = {
      ...options,
      printType: 'receipt',
      includeLogo: true,
      includeQR: true,
    };
    
    return this.printPackage(testPackage, testOptions);
  }

  /**
   * Bulk print multiple packages - IMPROVED with better error handling
   */
  async bulkPrint(
    packages: PackageData[], 
    options: PrintOptions = {}
  ): Promise<PrintResult[]> {
    console.log('📦 [PRINT-SERVICE] Starting bulk print for', packages.length, 'packages');
    
    const results: PrintResult[] = [];
    
    // Check availability once at the start
    const availability = await this.isPrintingAvailable();
    if (!availability.available) {
      const error = new Error(availability.reason || 'Printing not available');
      return packages.map(pkg => ({
        success: false,
        message: `Bulk print failed: ${error.message}`,
        errorCode: 'PRINT_UNAVAILABLE',
      }));
    }
    
    // Print each package with delay to prevent overload
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      console.log(`📦 [BULK] Printing ${i + 1}/${packages.length}: ${pkg.code}`);
      
      try {
        // Check availability before each print to ensure printer is still connected
        const stillAvailable = await this.isPrintingAvailable();
        if (!stillAvailable.available) {
          throw new Error(stillAvailable.reason || 'Printer disconnected during bulk print');
        }
        
        const result = await this.printPackage(pkg, options);
        results.push(result);
        
        // Add delay between prints to prevent printer overload
        if (i < packages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`❌ [BULK] Failed to print ${pkg.code}:`, error);
        results.push({
          success: false,
          message: `Failed to print ${pkg.code}: ${error.message}`,
          errorCode: 'BULK_PRINT_ERROR',
        });
        
        // If it's a connection error, stop the bulk print
        if (error.message.includes('disconnected') || error.message.includes('not available')) {
          console.warn('⚠️ [BULK] Connection lost, stopping bulk print');
          // Add failed results for remaining packages
          for (let j = i + 1; j < packages.length; j++) {
            results.push({
              success: false,
              message: `Bulk print stopped due to connection loss`,
              errorCode: 'CONNECTION_LOST',
            });
          }
          break;
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [BULK] Bulk print completed: ${successCount}/${packages.length} successful`);
    
    // Show summary toast
    Toast.show({
      type: successCount === packages.length ? 'success' : successCount > 0 ? 'info' : 'error',
      text1: 'Bulk Print Complete',
      text2: `${successCount}/${packages.length} packages printed successfully`,
      position: 'top',
      visibilityTime: 4000,
    });
    
    return results;
  }

  /**
   * Send data with timeout wrapper - IMPROVED error handling
   */
  private async sendDataWithTimeout<T>(
    operation: () => Promise<T>, 
    timeoutMs: number = 30000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms - printer may be busy or disconnected`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get detailed error message - IMPROVED error descriptions
   */
  private getDetailedErrorMessage(error: any): string {
    const message = error.message || error.toString();
    
    if (message.includes('Bluetooth system not initialized')) {
      return 'Bluetooth not ready. Go to Settings → Initialize Bluetooth.';
    }
    if (message.includes('permissions not granted')) {
      return 'Bluetooth permission denied. Enable in Settings → App permissions.';
    }
    if (message.includes('Bluetooth is disabled')) {
      return 'Turn on Bluetooth in device settings and try again.';
    }
    if (message.includes('No printer connected')) {
      return 'Connect a printer in Settings → Bluetooth first.';
    }
    if (message.includes('Printer disconnected')) {
      return 'Printer connection lost. Turn on printer and reconnect in Settings.';
    }
    if (message.includes('timed out')) {
      return 'Print job timed out. Printer may be busy - wait and retry.';
    }
    if (message.includes('Device not found')) {
      return 'Printer not found. Check if printer is on and paired.';
    }
    if (message.includes('BLE printing requires')) {
      return 'BLE printer support coming soon. Use Bluetooth Classic printer.';
    }
    if (message.includes('Cannot verify')) {
      return 'Cannot verify printer connection. Check printer is on and paired.';
    }
    if (message.includes('Connection lost')) {
      return 'Printer disconnected during operation. Reconnect and try again.';
    }
    
    return `Print error: ${message}`;
  }
}

export default EnhancedPrintService;
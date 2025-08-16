// services/PrintReceiptService.ts - FIXED: Improved error handling and connection verification
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

class PrintReceiptService {
  private static instance: PrintReceiptService;

  static getInstance(): PrintReceiptService {
    if (!PrintReceiptService.instance) {
      PrintReceiptService.instance = new PrintReceiptService();
    }
    return PrintReceiptService.instance;
  }

  // FIXED: Improved connection verification with retry logic
  private async ensurePrinterConnection(): Promise<PrinterConnection> {
    try {
      console.log('🖨️ Verifying printer connection...');
      
      const connectedPrinter = await AsyncStorage.getItem('connected_printer');
      if (!connectedPrinter) {
        throw new Error('No printer configured. Please connect a printer in Settings.');
      }

      const printer: PrinterConnection = JSON.parse(connectedPrinter);
      console.log('🖨️ Found stored printer:', printer.name);

      // Check if Bluetooth is enabled
      const bluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!bluetoothEnabled) {
        throw new Error('Bluetooth is disabled. Please enable Bluetooth.');
      }

      // Check if printer is connected with retry logic
      let isConnected = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!isConnected && attempts < maxAttempts) {
        try {
          isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
          if (!isConnected && attempts < maxAttempts - 1) {
            console.log(`🔄 Printer not connected, attempting to connect (attempt ${attempts + 1})...`);
            
            // Try to reconnect
            try {
              await RNBluetoothClassic.connectToDevice(printer.address);
              isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
            } catch (connectError) {
              console.warn(`⚠️ Connection attempt ${attempts + 1} failed:`, connectError);
            }
          }
          attempts++;
          
          if (!isConnected && attempts < maxAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (checkError) {
          console.warn(`⚠️ Connection check attempt ${attempts + 1} failed:`, checkError);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!isConnected) {
        throw new Error(`Printer "${printer.name}" is not connected. Please check the connection and try again.`);
      }

      console.log('✅ Printer connection verified');
      return printer;
    } catch (error: any) {
      console.error('❌ Printer connection verification failed:', error);
      throw error;
    }
  }

  async printPackageReceipt(packageData: PackageData): Promise<boolean> {
    try {
      console.log('🖨️ Starting print process for package:', packageData.code);
      
      // Ensure printer is connected
      const printer = await this.ensurePrinterConnection();
      
      // Format receipt data
      const receiptData = this.formatReceipt(packageData);
      console.log('📄 Receipt formatted, sending to printer...');
      
      // Send to printer with timeout
      await this.sendToPrinterWithTimeout(printer.address, receiptData, 10000);
      
      console.log('✅ Receipt printed successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Print failed:', error);
      throw new Error(this.getErrorMessage(error));
    }
  }

  // FIXED: Added timeout wrapper for print operations
  private async sendToPrinterWithTimeout(
    address: string, 
    data: string, 
    timeoutMs: number = 10000
  ): Promise<void> {
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

  private getErrorMessage(error: any): string {
    const message = error.message || error.toString();
    
    if (message.includes('No printer configured')) {
      return 'No printer configured. Please connect a printer in Settings.';
    }
    if (message.includes('Bluetooth is disabled')) {
      return 'Bluetooth is disabled. Please enable Bluetooth and try again.';
    }
    if (message.includes('not connected')) {
      return 'Printer is not connected. Please check Bluetooth connection.';
    }
    if (message.includes('timed out')) {
      return 'Print operation timed out. Check if printer is ready and try again.';
    }
    if (message.includes('Device not found')) {
      return 'Printer device not found. Please reconnect the printer.';
    }
    
    return `Print failed: ${message}`;
  }

  private formatReceipt(packageData: PackageData): string {
    const timestamp = new Date().toLocaleString();
    
    // ESC/POS commands for basic formatting
    const ESC = '\x1B';
    const GS = '\x1D';
    const LF = '\n';
    
    // Basic formatting commands
    const RESET = ESC + '@';
    const CENTER = ESC + 'a' + '\x01';
    const LEFT = ESC + 'a' + '\x00';
    const BOLD_ON = ESC + 'E' + '\x01';
    const BOLD_OFF = ESC + 'E' + '\x00';
    const DOUBLE_HEIGHT = GS + '!' + '\x01';
    const NORMAL_SIZE = GS + '!' + '\x00';
    const CUT_PAPER = GS + 'V' + '\x42' + '\x00';
    
    let receipt = RESET;
    
    // Header - GLT Logistics
    receipt += CENTER;
    receipt += BOLD_ON + DOUBLE_HEIGHT;
    receipt += 'GLT LOGISTICS' + LF;
    receipt += NORMAL_SIZE + BOLD_OFF;
    receipt += LF;
    
    // Contact Info
    receipt += 'If lost contact us via:' + LF;
    receipt += 'gltlogistics-ke@gmail.com' + LF;
    receipt += 'Or 0712293377' + LF;
    receipt += LF;
    
    // Separator line
    receipt += '================================' + LF;
    receipt += LF;
    
    // Package Details - Left aligned
    receipt += LEFT;
    
    // Package Code - Bold and larger
    receipt += BOLD_ON;
    receipt += 'PACKAGE CODE:' + LF;
    receipt += packageData.code + LF;
    receipt += BOLD_OFF + LF;
    
    // Receiver Name
    receipt += 'TO: ' + packageData.receiver_name + LF;
    receipt += LF;
    
    // Destination
    receipt += 'DESTINATION:' + LF;
    receipt += packageData.route_description + LF;
    receipt += LF;
    
    // Sender (if available)
    if (packageData.sender_name) {
      receipt += 'FROM: ' + packageData.sender_name + LF;
      receipt += LF;
    }
    
    // Status (if available)
    if (packageData.state_display) {
      receipt += 'STATUS: ' + packageData.state_display + LF;
      receipt += LF;
    }
    
    // Separator
    receipt += '--------------------------------' + LF;
    receipt += LF;
    
    // QR Code placeholder text
    receipt += CENTER;
    receipt += '[QR CODE]' + LF;
    receipt += packageData.code + LF;
    receipt += LF;
    
    // Timestamp
    receipt += LEFT;
    receipt += 'Printed: ' + timestamp + LF;
    receipt += LF;
    
    // Footer
    receipt += CENTER;
    receipt += '--------------------------------' + LF;
    receipt += 'Designed by Infinity.Co' + LF;
    receipt += LF + LF + LF;
    
    // Cut paper
    receipt += CUT_PAPER;
    
    return receipt;
  }

  // Test print functionality with better error handling
  async testPrint(): Promise<boolean> {
    const testPackage: PackageData = {
      code: 'PKG-TEST-' + Date.now(),
      receiver_name: 'Test Customer',
      route_description: 'Nairobi CBD',
      sender_name: 'GLT Logistics',
      state_display: 'Test Print'
    };
    
    return this.printPackageReceipt(testPackage);
  }

  // FIXED: Alternative method for printers that support QR codes
  async printPackageReceiptWithQR(packageData: PackageData): Promise<boolean> {
    try {
      const printer = await this.ensurePrinterConnection();
      
      // Format receipt with QR code
      const receiptData = this.formatReceiptWithQR(packageData);
      await this.sendToPrinterWithTimeout(printer.address, receiptData);
      
      return true;
    } catch (error: any) {
      console.error('Print with QR failed:', error);
      throw new Error(this.getErrorMessage(error));
    }
  }

  private formatReceiptWithQR(packageData: PackageData): string {
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
    
    // QR Code
    receipt += CENTER;
    receipt += this.generateQRCodeCommands(packageData.code);
    receipt += LF + LF;
    
    // Footer
    receipt += LEFT;
    receipt += 'Printed: ' + timestamp + LF + LF;
    receipt += CENTER;
    receipt += '--------------------------------' + LF;
    receipt += 'Designed by Infinity.Co' + LF + LF + LF;
    
    receipt += CUT_PAPER;
    
    return receipt;
  }

  // Generate QR code with ESC/POS commands (for supported printers)
  private generateQRCodeCommands(data: string): string {
    const GS = '\x1D';
    const qrCommands = [
      GS + '(k\x04\x00\x31\x41\x32\x00', // QR Code model
      GS + '(k\x03\x00\x31\x43\x08',     // QR Code size
      GS + '(k\x03\x00\x31\x45\x30',     // QR Code error correction
      GS + `(k${String.fromCharCode(data.length + 3)}\x00\x31\x50\x30${data}`, // QR Code data
      GS + '(k\x03\x00\x31\x51\x30',     // Print QR Code
    ];
    return qrCommands.join('');
  }

  // FIXED: Better printer status check
  async checkPrinterStatus(): Promise<{
    isConnected: boolean;
    printerName?: string;
    printerAddress?: string;
    error?: string;
  }> {
    try {
      const connectedPrinter = await AsyncStorage.getItem('connected_printer');
      if (!connectedPrinter) {
        return {
          isConnected: false,
          error: 'No printer configured'
        };
      }

      const printer: PrinterConnection = JSON.parse(connectedPrinter);
      
      const bluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!bluetoothEnabled) {
        return {
          isConnected: false,
          printerName: printer.name,
          printerAddress: printer.address,
          error: 'Bluetooth is disabled'
        };
      }

      const isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
      
      return {
        isConnected,
        printerName: printer.name,
        printerAddress: printer.address,
        error: isConnected ? undefined : 'Printer not connected'
      };
    } catch (error: any) {
      return {
        isConnected: false,
        error: error.message || 'Failed to check printer status'
      };
    }
  }
}

export default PrintReceiptService;
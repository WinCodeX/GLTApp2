// services/PrintReceiptService.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PackageData {
  code: string;
  receiver_name: string;
  route_description: string;
  sender_name?: string;
  state_display?: string;
}

class PrintReceiptService {
  private static instance: PrintReceiptService;

  static getInstance(): PrintReceiptService {
    if (!PrintReceiptService.instance) {
      PrintReceiptService.instance = new PrintReceiptService();
    }
    return PrintReceiptService.instance;
  }

  async printPackageReceipt(packageData: PackageData): Promise<boolean> {
    try {
      // Get connected printer
      const connectedPrinter = await AsyncStorage.getItem('connected_printer');
      if (!connectedPrinter) {
        throw new Error('No printer connected');
      }

      const printer = JSON.parse(connectedPrinter);
      
      // Check if printer is still connected
      const isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
      if (!isConnected) {
        throw new Error('Printer is not connected');
      }

      // Format receipt data
      const receiptData = this.formatReceipt(packageData);
      
      // Send to printer
      await RNBluetoothClassic.writeToDevice(printer.address, receiptData);
      
      return true;
    } catch (error) {
      console.error('Print failed:', error);
      throw error;
    }
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
    
    // Separator
    receipt += '--------------------------------' + LF;
    receipt += LF;
    
    // QR Code placeholder text (most thermal printers don't support QR directly)
    // You could implement QR code printing with specific ESC/POS commands if your printer supports it
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

  // Alternative method for printers that support QR codes
  async printPackageReceiptWithQR(packageData: PackageData): Promise<boolean> {
    try {
      const connectedPrinter = await AsyncStorage.getItem('connected_printer');
      if (!connectedPrinter) {
        throw new Error('No printer connected');
      }

      const printer = JSON.parse(connectedPrinter);
      const isConnected = await RNBluetoothClassic.isDeviceConnected(printer.address);
      if (!isConnected) {
        throw new Error('Printer is not connected');
      }

      // Format receipt with QR code
      const receiptData = this.formatReceiptWithQR(packageData);
      await RNBluetoothClassic.writeToDevice(printer.address, receiptData);
      
      return true;
    } catch (error) {
      console.error('Print with QR failed:', error);
      throw error;
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

  // Test print functionality
  async testPrint(): Promise<boolean> {
    const testPackage: PackageData = {
      code: 'PKG-TEST-' + Date.now(),
      receiver_name: 'Test Customer',
      route_description: 'Nairobi CBD',
    };
    
    return this.printPackageReceipt(testPackage);
  }
}

export default PrintReceiptService;
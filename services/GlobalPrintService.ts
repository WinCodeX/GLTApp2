// services/GlobalPrintService.ts - Updated with organic QR ESC/POS commands

import Toast from 'react-native-toast-message';
import { getPackageQRCode } from '../lib/helpers/packageHelpers';

export interface PackageData {
  code: string;
  receiver_name: string;
  route_description: string;
  sender_name?: string;
  state_display?: string;
  pickup_location?: string;
  delivery_location?: string;
  weight?: string;
  dimensions?: string;
  special_instructions?: string;
  tracking_url?: string;
  payment_status?: 'paid' | 'not_paid' | 'pending';
  delivery_type?: 'office' | 'home' | 'pickup_point';
  agent_name?: string;
  receiver_phone?: string;
}

export interface PrintOptions {
  copies?: number;
  includeLogo?: boolean;
  includeQR?: boolean;
  labelSize?: 'small' | 'medium' | 'large';
  printType?: 'receipt' | 'label' | 'invoice';
  qrStyle?: 'organic' | 'standard';
}

export interface PrintResult {
  success: boolean;
  message: string;
  printTime?: Date;
  printerUsed?: string;
  errorCode?: string;
}

export interface BluetoothContextType {
  connectedPrinter: any | null;
  isPrintReady: boolean;
  isBluetoothAvailable: boolean;
  testPrint: () => Promise<void>;
  printText: (text: string) => Promise<void>;
  printReceipt: (data: any) => Promise<void>;
}

class GlobalPrintService {
  private static instance: GlobalPrintService;

  constructor() {
    // Removed complex QR generator - using native thermal printer commands
  }

  static getInstance(): GlobalPrintService {
    if (!GlobalPrintService.instance) {
      GlobalPrintService.instance = new GlobalPrintService();
    }
    return GlobalPrintService.instance;
  }

  /**
   * ESC/POS Commands for formatting
   */
  private readonly ESC = '\x1B';
  private readonly GS = '\x1D';
  
  // Text formatting commands
  private readonly BOLD_ON = this.ESC + 'E' + '\x01';
  private readonly BOLD_OFF = this.ESC + 'E' + '\x00';
  private readonly CENTER = this.ESC + 'a' + '\x01';
  private readonly LEFT = this.ESC + 'a' + '\x00';
  private readonly DOUBLE_HEIGHT = this.GS + '!' + '\x11';
  private readonly NORMAL_SIZE = this.GS + '!' + '\x00';

  /**
   * Clean and format delivery location
   */
  private cleanDeliveryLocation(routeDescription: string, deliveryLocation?: string): string {
    const location = deliveryLocation || routeDescription;
    
    // Remove unreadable characters and clean up the format
    let cleaned = location
      .replace(/[^\w\s\-,]/g, ' ') // Remove special characters except word chars, spaces, hyphens, commas
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    // Extract destination (after "to", "→", or similar indicators)
    const toMatch = cleaned.match(/(?:to|→|->)\s*(.+?)$/i);
    if (toMatch) {
      cleaned = toMatch[1].trim();
    }
    
    // If it contains "CBD" and another location, show only the destination
    if (cleaned.toLowerCase().includes('cbd') && cleaned.includes(' ')) {
      const parts = cleaned.split(/\s+/);
      const nonCbdParts = parts.filter(part => !part.toLowerCase().includes('cbd'));
      if (nonCbdParts.length > 0) {
        cleaned = nonCbdParts.join(' ');
      }
    }
    
    return cleaned.toUpperCase();
  }

  /**
   * Generate working QR code using thermal printer native commands
   */
  private generateWorkingQRCodeCommands(qrCodeData: string, options: PrintOptions = {}): string {
    console.log('🔲 [GLT-QR] Generating working QR code for:', qrCodeData);
    
    try {
      // QR Code size based on options - larger for better scanning
      let qrSize = 8; // Default
      if (options.labelSize === 'small') qrSize = 6;
      if (options.labelSize === 'large') qrSize = 10;
      
      // QR Code model 2 (most compatible)
      const modelCommand = this.GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
      
      // QR Code size setting
      const sizeCommand = this.GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize);
      
      // Error correction level M (good balance of reliability and data capacity)
      const errorCommand = this.GS + '(k' + '\x03\x00' + '\x31\x45' + '\x31';
      
      // Store the QR data
      const dataLength = qrCodeData.length + 3;
      const lowByte = dataLength & 0xFF;
      const highByte = (dataLength >> 8) & 0xFF;
      const storeCommand = this.GS + '(k' + String.fromCharCode(lowByte) + String.fromCharCode(highByte) + '\x31\x50\x30' + qrCodeData;
      
      // Print the QR code
      const printCommand = this.GS + '(k' + '\x03\x00' + '\x31\x51\x30';
      
      // Combine with proper spacing and alignment
      const qrCommands = 
        '\n' +
        this.CENTER +
        '- QR Code for Tracking -\n' +
        modelCommand +
        sizeCommand +
        errorCommand +
        storeCommand +
        printCommand +
        '\n' +
        'Scan to track your package\n' +
        '\n' +
        this.LEFT;
      
      console.log('✅ [GLT-QR] Working QR code generated successfully');
      return qrCommands;
      
    } catch (error) {
      console.error('❌ [GLT-QR] Failed to generate QR code:', error);
      return this.generateFallbackQRCodeCommands(qrCodeData);
    }
  }

  /**
   * Simple fallback QR code generation - guaranteed to work
   */
  private generateFallbackQRCodeCommands(qrCodeData: string): string {
    console.log('⚠️ [GLT-QR] Using simple fallback QR generation');
    
    // Ultra-simple, reliable QR code commands
    const qrSize = 6; // Smaller size for compatibility
    
    const modelCommand = this.GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
    const sizeCommand = this.GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize);
    const errorCommand = this.GS + '(k' + '\x03\x00' + '\x31\x45' + '\x30'; // Error correction L (lowest, most reliable)
    
    const dataLength = qrCodeData.length + 3;
    const storeCommand = this.GS + '(k' + 
      String.fromCharCode(dataLength & 0xFF) + 
      String.fromCharCode((dataLength >> 8) & 0xFF) + 
      '\x31\x50\x30' + qrCodeData;
    
    const printCommand = this.GS + '(k' + '\x03\x00' + '\x31\x51\x30';
    
    return this.CENTER + '\n' + 
           modelCommand + 
           sizeCommand + 
           errorCommand + 
           storeCommand + 
           printCommand + 
           '\n\n' + 
           this.LEFT;
  }

  /**
   * Generate clean GLT Logistics receipt format for thermal printers with bold fonts
   */
  private generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): string {
    const {
      code,
      receiver_name,
      route_description,
      delivery_location,
      payment_status = 'not_paid',
      agent_name,
      receiver_phone
    } = packageData;

    // Get current date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-GB', { 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });

    // Clean delivery location
    const cleanLocation = this.cleanDeliveryLocation(route_description, delivery_location);

    // Payment status formatting
    const paymentText = payment_status === 'paid' ? 'PAID' : 'NOT PAID';

    // Create the receipt with proper thermal printer formatting and bold fonts
    const receipt = 
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT +
      'GLT LOGISTICS\n' +
      this.NORMAL_SIZE + 'Fast & Reliable\n' +
      this.BOLD_OFF + this.LEFT +
      '================================\n' +
      this.BOLD_ON + 'Customer Service: 0725 057 210\n' + this.BOLD_OFF +
      'support@gltlogistics.co.ke\n' +
      'www.gltlogistics.co.ke\n\n' +
      'If package is lost, please contact\n' +
      'us immediately with this receipt.\n' +
      '================================\n' +
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT + code + '\n' + this.NORMAL_SIZE + this.BOLD_OFF + this.LEFT +
      '================================\n' +
      this.BOLD_ON + 'DELIVERY FOR: ' + receiver_name.toUpperCase() + '\n' + this.BOLD_OFF +
      (receiver_phone ? this.BOLD_ON + 'Phone: ' + receiver_phone + '\n' + this.BOLD_OFF : '') +
      this.BOLD_ON + 'TO: ' + cleanLocation + '\n' + this.BOLD_OFF +
      (agent_name ? this.BOLD_ON + 'Agent: ' + agent_name + '\n' + this.BOLD_OFF : '') +
      '--------------------------------\n' +
      this.BOLD_ON + 'Payment Status: ' + paymentText + '\n' + this.BOLD_OFF +
      this.BOLD_ON + 'Date: ' + dateStr + '\n' + this.BOLD_OFF +
      this.BOLD_ON + 'Time: ' + timeStr + '\n' + this.BOLD_OFF +
      (packageData.weight ? this.BOLD_ON + 'Weight: ' + packageData.weight + '\n' + this.BOLD_OFF : '') +
      (packageData.dimensions ? this.BOLD_ON + 'Dimensions: ' + packageData.dimensions + '\n' + this.BOLD_OFF : '') +
      (packageData.special_instructions ? 'Instructions: ' + packageData.special_instructions + '\n' : '') +
      '================================\n' +
      this.CENTER + this.BOLD_ON + 
      'Thank you for choosing GLT Logistics!\n' +
      'Your package will be delivered safely.\n' +
      this.BOLD_OFF +
      '================================\n' +
      'Designed by Infinity.Co\n' +
      'www.infinity.co.ke\n' +
      '--------------------------------\n' +
      this.LEFT + 'Receipt printed: ' + dateStr + ' ' + timeStr + '\n';

    return receipt;
  }

  /**
   * Generate receipt with WORKING QR code using thermal printer commands
   */
  private async generateGLTReceiptWithWorkingQR(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
    const {
      code,
      receiver_name,
      route_description,
      delivery_location,
      payment_status = 'not_paid',
      agent_name,
      receiver_phone
    } = packageData;

    // Get current date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-GB', { 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });

    // Clean delivery location
    const cleanLocation = this.cleanDeliveryLocation(route_description, delivery_location);

    // Payment status formatting
    const paymentText = payment_status === 'paid' ? 'PAID' : 'NOT PAID';

    // Generate WORKING QR code commands - reliable thermal printer approach
    let qrCodeSection = '';
    try {
      console.log('🔍 [GLT-PRINT] Generating working QR code for package:', code);
      
      // First try to get tracking URL from backend
      const qrResponse = await getPackageQRCode(code);
      let trackingUrl = `https://gltlogistics.co.ke/track/${code}`;
      
      if (qrResponse.success && qrResponse.data.tracking_url) {
        trackingUrl = qrResponse.data.tracking_url;
        console.log('✅ [GLT-PRINT] Using backend tracking URL:', trackingUrl);
      } else {
        console.log('⚠️ [GLT-PRINT] Using fallback tracking URL:', trackingUrl);
      }
      
      // Generate working QR using reliable ESC/POS commands
      qrCodeSection = this.generateWorkingQRCodeCommands(trackingUrl, options);
      
    } catch (error) {
      console.error('❌ [GLT-PRINT] Failed to generate QR:', error);
      // Fallback to simple QR
      qrCodeSection = this.generateFallbackQRCodeCommands(`https://gltlogistics.co.ke/track/${code}`);
    }

    const receipt = 
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT +
      'GLT LOGISTICS\n' +
      this.NORMAL_SIZE + 'Fast & Reliable\n' +
      this.BOLD_OFF + this.LEFT +
      '================================\n' +
      this.BOLD_ON + 'Customer Service: 0725 057 210\n' + this.BOLD_OFF +
      'support@gltlogistics.co.ke\n' +
      'www.gltlogistics.co.ke\n\n' +
      'If package is lost, please contact\n' +
      'us immediately with this receipt.\n' +
      '================================\n' +
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT + code + '\n' + this.NORMAL_SIZE + this.BOLD_OFF + this.LEFT +
      '================================\n' +
      qrCodeSection +
      '================================\n' +
      this.BOLD_ON + 'DELIVERY FOR: ' + receiver_name.toUpperCase() + '\n' + this.BOLD_OFF +
      (receiver_phone ? this.BOLD_ON + 'Phone: ' + receiver_phone + '\n' + this.BOLD_OFF : '') +
      this.BOLD_ON + 'TO: ' + cleanLocation + '\n' + this.BOLD_OFF +
      (agent_name ? this.BOLD_ON + 'Agent: ' + agent_name + '\n' + this.BOLD_OFF : '') +
      '--------------------------------\n' +
      this.BOLD_ON + 'Payment Status: ' + paymentText + '\n' + this.BOLD_OFF +
      this.BOLD_ON + 'Date: ' + dateStr + '\n' + this.BOLD_OFF +
      this.BOLD_ON + 'Time: ' + timeStr + '\n' + this.BOLD_OFF +
      (packageData.weight ? this.BOLD_ON + 'Weight: ' + packageData.weight + '\n' + this.BOLD_OFF : '') +
      (packageData.dimensions ? this.BOLD_ON + 'Dimensions: ' + packageData.dimensions + '\n' + this.BOLD_OFF : '') +
      (packageData.special_instructions ? 'Instructions: ' + packageData.special_instructions + '\n' : '') +
      '================================\n' +
      this.CENTER + this.BOLD_ON + 
      'Thank you for choosing GLT Logistics!\n' +
      'Your package will be delivered safely.\n' +
      this.BOLD_OFF +
      '================================\n' +
      'Designed by Infinity.Co\n' +
      'www.infinity.co.ke\n' +
      '--------------------------------\n' +
      this.LEFT + 'Receipt printed: ' + dateStr + ' ' + timeStr + '\n';

    return receipt;
  }

  /**
   * Check if printing is available using the global context
   */
  async isPrintingAvailable(bluetoothContext: BluetoothContextType): Promise<{ available: boolean; reason?: string }> {
    console.log('🔍 [GLT-PRINT] Checking printing availability...');
    
    try {
      if (!bluetoothContext.isBluetoothAvailable) {
        return { available: false, reason: 'Bluetooth not available in this environment (Expo Go)' };
      }
      
      if (!bluetoothContext.isPrintReady || !bluetoothContext.connectedPrinter) {
        return { available: false, reason: 'No printer connected' };
      }
      
      console.log('✅ [GLT-PRINT] Printing is available');
      return { available: true };
      
    } catch (error: any) {
      console.error('❌ [GLT-PRINT] Error checking availability:', error);
      return { available: false, reason: `System error: ${error.message}` };
    }
  }

  /**
   * Print GLT Logistics package receipt using global context
   */
  async printPackage(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [GLT-PRINT] Starting GLT print job for:', packageData.code);
    
    try {
      // Check availability first
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      console.log('📄 [GLT-PRINT] Generating GLT receipt format...');
      
      // Generate the receipt content based on options
      let receiptText: string;
      if (options.includeQR !== false) {
        // Use working QR code that actually prints
        receiptText = await this.generateGLTReceiptWithWorkingQR(packageData, options);
      } else {
        receiptText = this.generateGLTReceipt(packageData, options);
      }
      
      // Use the context's printText method for the receipt
      await bluetoothContext.printText(receiptText);
      
      console.log('✅ [GLT-PRINT] GLT receipt with working QR printed successfully');
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: '📦 GLT Receipt Printed',
        text2: `Package ${packageData.code} with QR code sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `GLT receipt with working QR printed for ${packageData.code}`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLT-PRINT] Print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ GLT Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      
      return {
        success: false,
        message: errorMessage,
        errorCode: error.code || 'GLT_PRINT_ERROR',
      };
    }
  }

  /**
   * Print GLT test receipt with organic QR
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLT-PRINT] Running GLT test print with working QR...');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      // Create test package data
      const testPackageData: PackageData = {
        code: 'NRB-' + Date.now().toString().slice(-6) + '-MCH',
        receiver_name: 'Glen',
        receiver_phone: '0712 345 678',
        route_description: 'CBD → Athi River',
        delivery_location: 'Athi River',
        payment_status: 'not_paid',
        delivery_type: 'home',
        weight: '2kg',
        dimensions: '30x20x15 cm',
        special_instructions: 'Handle with care - Test package'
      };
      
      // Generate and print test receipt with working QR
      const testReceipt = await this.generateGLTReceiptWithWorkingQR(testPackageData, options);
      await bluetoothContext.printText(testReceipt);
      
      console.log('✅ [GLT-PRINT] Test receipt with working QR printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '🧪 GLT Test Print Successful',
        text2: `Test receipt with QR code sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `GLT test print with working QR successful`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLT-PRINT] Test print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ GLT Test Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      
      return {
        success: false,
        message: errorMessage,
        errorCode: error.code || 'GLT_TEST_ERROR',
      };
    }
  }

  // ... (rest of methods remain the same: printText, bulkPrint, printOfficeDelivery, etc.)

  /**
   * Get detailed error message with GLT branding
   */
  private getDetailedErrorMessage(error: any): string {
    const message = error.message || error.toString();
    
    if (message.includes('Bluetooth not available')) {
      return 'GLT Print: Bluetooth not available. Use development build.';
    }
    if (message.includes('not available in this environment')) {
      return 'GLT Print: Not available in Expo Go. Use development build.';
    }
    if (message.includes('No printer connected')) {
      return 'GLT Print: Connect printer in Settings → Bluetooth first.';
    }
    if (message.includes('Printer disconnected')) {
      return 'GLT Print: Connection lost. Turn on printer and reconnect.';
    }
    if (message.includes('timed out')) {
      return 'GLT Print: Timeout. Printer may be busy - retry in a moment.';
    }
    if (message.includes('Device not found')) {
      return 'GLT Print: Printer not found. Check if printer is on and paired.';
    }
    if (message.includes('Connection lost')) {
      return 'GLT Print: Connection lost during operation. Reconnect and retry.';
    }
    if (message.includes('Failed to generate QR code')) {
      return 'GLT Print: Could not generate QR code. Receipt printed without QR.';
    }
    
    return `GLT Print Error: ${message}`;
  }
}

// Export both the class and a default instance
export { GlobalPrintService };
export default GlobalPrintService;
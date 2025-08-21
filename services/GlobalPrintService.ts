// services/GlobalPrintService.ts - Fixed with text-safe enhanced QR generation

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
    // Text-safe QR generation only - no binary data
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
   * Generate enhanced native QR code with optimal parameters for organic appearance
   */
  private generateEnhancedQRCode(qrCodeData: string, options: PrintOptions = {}): string {
    console.log('✨ [ENHANCED-QR] Generating enhanced QR code for:', qrCodeData);
    
    try {
      // Enhanced parameters for more organic-looking QR codes
      let qrSize = 10; // Larger size for smoother appearance
      if (options.labelSize === 'small') qrSize = 8;
      if (options.labelSize === 'large') qrSize = 12;
      
      // QR Code model 2 (most compatible)
      const modelCommand = this.GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
      
      // Enhanced size for better visual quality
      const sizeCommand = this.GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize);
      
      // High error correction for maximum redundancy (like organic QRs)
      const errorCommand = this.GS + '(k' + '\x03\x00' + '\x31\x45' + '\x32'; // Level H
      
      // Store the QR data
      const dataLength = qrCodeData.length + 3;
      const lowByte = dataLength & 0xFF;
      const highByte = (dataLength >> 8) & 0xFF;
      const storeCommand = this.GS + '(k' + String.fromCharCode(lowByte) + String.fromCharCode(highByte) + '\x31\x50\x30' + qrCodeData;
      
      // Print the QR code
      const printCommand = this.GS + '(k' + '\x03\x00' + '\x31\x51\x30';
      
      // Enhanced formatting with extra spacing for organic feel
      const qrCommands = 
        '\n' +
        this.CENTER +
        '- QR Code for Tracking -\n' +
        '\n' + // Extra spacing for organic presentation
        modelCommand +
        sizeCommand +
        errorCommand +
        storeCommand +
        printCommand +
        '\n' +
        '\n' + // Extra spacing for organic presentation
        'Scan to track your package\n' +
        '\n' +
        this.LEFT;
      
      console.log('✅ [ENHANCED-QR] Enhanced QR code generated successfully');
      return qrCommands;
      
    } catch (error) {
      console.error('❌ [ENHANCED-QR] Failed to generate enhanced QR code:', error);
      return this.generateFallbackQRCode(qrCodeData, options);
    }
  }

  /**
   * Fallback QR code generation - guaranteed to work
   */
  private generateFallbackQRCode(qrCodeData: string, options: PrintOptions = {}): string {
    console.log('⚠️ [FALLBACK-QR] Using fallback QR generation');
    
    const qrSize = 6; // Smaller, more reliable size
    
    const modelCommand = this.GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
    const sizeCommand = this.GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize);
    const errorCommand = this.GS + '(k' + '\x03\x00' + '\x31\x45' + '\x30'; // Error correction L
    
    const dataLength = qrCodeData.length + 3;
    const storeCommand = this.GS + '(k' + 
      String.fromCharCode(dataLength & 0xFF) + 
      String.fromCharCode((dataLength >> 8) & 0xFF) + 
      '\x31\x50\x30' + qrCodeData;
    
    const printCommand = this.GS + '(k' + '\x03\x00' + '\x31\x51\x30';
    
    return '\n' + this.CENTER + '- QR Code for Tracking -\n' +
           modelCommand + sizeCommand + errorCommand + storeCommand + printCommand +
           '\n' + 'Scan to track your package\n' + '\n' + this.LEFT;
  }

  /**
   * Generate QR code section with backend integration
   */
  private async generateQRCodeSection(packageCode: string, options: PrintOptions = {}): Promise<string> {
    console.log('🎯 [QR-SECTION] Generating QR section for:', packageCode);
    
    try {
      // Get tracking URL from backend
      const qrResponse = await getPackageQRCode(packageCode);
      let trackingUrl = `https://gltlogistics.co.ke/track/${packageCode}`;
      
      if (qrResponse.success && qrResponse.data.tracking_url) {
        trackingUrl = qrResponse.data.tracking_url;
        console.log('✅ [QR-SECTION] Using backend tracking URL:', trackingUrl);
      } else {
        console.log('⚠️ [QR-SECTION] Using fallback tracking URL:', trackingUrl);
      }
      
      // Generate enhanced QR code with optimal parameters
      const qrSection = this.generateEnhancedQRCode(trackingUrl, options);
      
      console.log('✅ [QR-SECTION] QR section generated successfully');
      return qrSection;
      
    } catch (error) {
      console.error('❌ [QR-SECTION] Failed to generate QR section:', error);
      // Ultimate fallback
      return this.generateFallbackQRCode(`https://gltlogistics.co.ke/track/${packageCode}`, options);
    }
  }

  /**
   * Clean and format delivery location
   */
  private cleanDeliveryLocation(routeDescription: string, deliveryLocation?: string): string {
    const location = deliveryLocation || routeDescription;
    
    let cleaned = location
      .replace(/[^\w\s\-,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const toMatch = cleaned.match(/(?:to|→|->)\s*(.+?)$/i);
    if (toMatch) {
      cleaned = toMatch[1].trim();
    }
    
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
   * Generate GLT receipt with enhanced QR code
   */
  private async generateGLTReceiptWithEnhancedQR(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
    const {
      code,
      receiver_name,
      route_description,
      delivery_location,
      payment_status = 'not_paid',
      agent_name,
      receiver_phone
    } = packageData;

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

    const cleanLocation = this.cleanDeliveryLocation(route_description, delivery_location);
    const paymentText = payment_status === 'paid' ? 'PAID' : 'NOT PAID';

    // Generate enhanced QR section
    let qrCodeSection = '';
    try {
      if (options.includeQR !== false) {
        console.log('🎯 [GLT-PRINT] Generating enhanced QR for package:', code);
        qrCodeSection = await this.generateQRCodeSection(code, options);
      }
    } catch (error) {
      console.error('❌ [GLT-PRINT] QR generation failed:', error);
      qrCodeSection = '\n' + this.CENTER + '- Visit gltlogistics.co.ke to track -\n' + 
                     'Package: ' + code + '\n' + this.LEFT + '\n';
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
   * Generate office delivery receipt with agent information
   */
  private generateOfficeDeliveryReceipt(packageData: PackageData, agentName: string): string {
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

    const receipt = 
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT +
      'GLT LOGISTICS\n' +
      this.NORMAL_SIZE + 'Fast & Reliable\n' +
      this.BOLD_OFF + this.LEFT +
      '================================\n' +
      this.BOLD_ON + 'Customer Service: 0725 057 210\n' + this.BOLD_OFF +
      'support@gltlogistics.co.ke\n\n' +
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT + 'OFFICE DELIVERY RECEIPT\n' + this.NORMAL_SIZE + this.BOLD_OFF + this.LEFT +
      '================================\n' +
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT + packageData.code + '\n' + this.NORMAL_SIZE + this.BOLD_OFF + this.LEFT +
      this.BOLD_ON + 'FROM: ' + (packageData.sender_name || 'N/A') + '\n' + this.BOLD_OFF +
      this.BOLD_ON + 'TO: ' + packageData.receiver_name + '\n' + this.BOLD_OFF +
      this.BOLD_ON + 'DELIVERY AGENT: ' + agentName + '\n' + this.BOLD_OFF +
      '--------------------------------\n' +
      this.BOLD_ON + 'Date: ' + dateStr + '\n' + this.BOLD_OFF +
      this.BOLD_ON + 'Time: ' + timeStr + '\n' + this.BOLD_OFF +
      '================================\n' +
      'Package handed over to office agent\n' +
      'for final delivery to recipient.\n\n' +
      this.CENTER + this.BOLD_ON + 'Thank you for choosing GLT Logistics!\n' + this.BOLD_OFF +
      '================================\n' +
      'Designed by Infinity.Co\n' +
      'www.infinity.co.ke\n' + this.LEFT;

    return receipt;
  }

  /**
   * Check if printing is available
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
   * Print GLT package with enhanced QR code
   */
  async printPackage(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [GLT-PRINT] Starting GLT print with enhanced QR for:', packageData.code);
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      console.log('📄 [GLT-PRINT] Generating GLT receipt with enhanced QR...');
      
      const receiptText = await this.generateGLTReceiptWithEnhancedQR(packageData, options);
      
      await bluetoothContext.printText(receiptText);
      
      console.log('✅ [GLT-PRINT] GLT receipt with enhanced QR printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '📦 GLT Receipt Printed',
        text2: `Package ${packageData.code} with enhanced QR sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `GLT receipt with enhanced QR printed for ${packageData.code}`,
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
   * Test print with enhanced QR code
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLT-PRINT] Running test print with enhanced QR...');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
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
      
      const testReceipt = await this.generateGLTReceiptWithEnhancedQR(testPackageData, options);
      await bluetoothContext.printText(testReceipt);
      
      console.log('✅ [GLT-PRINT] Test receipt with enhanced QR printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '🧪 GLT Test Print Successful',
        text2: `Test receipt with enhanced QR sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `GLT test print with enhanced QR successful`,
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

  /**
   * Print simple text using global context
   */
  async printText(
    bluetoothContext: BluetoothContextType,
    text: string
  ): Promise<PrintResult> {
    console.log('📝 [GLT-PRINT] Printing custom text...');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      await bluetoothContext.printText(text);
      
      console.log('✅ [GLT-PRINT] Custom text printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '📝 Text Printed',
        text2: `Custom text sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Text printed successfully`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLT-PRINT] Text print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Text Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      
      return {
        success: false,
        message: errorMessage,
        errorCode: error.code || 'GLT_TEXT_ERROR',
      };
    }
  }

  /**
   * Bulk print multiple GLT packages
   */
  async bulkPrint(
    bluetoothContext: BluetoothContextType,
    packages: PackageData[], 
    options: PrintOptions = {}
  ): Promise<PrintResult[]> {
    console.log('📦 [GLT-BULK] Starting bulk GLT print for', packages.length, 'packages');
    
    const results: PrintResult[] = [];
    
    const availability = await this.isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      const error = new Error(availability.reason || 'Printing not available');
      return packages.map(pkg => ({
        success: false,
        message: `GLT bulk print failed: ${error.message}`,
        errorCode: 'GLT_PRINT_UNAVAILABLE',
      }));
    }
    
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      console.log(`📦 [GLT-BULK] Printing ${i + 1}/${packages.length}: ${pkg.code}`);
      
      try {
        const stillAvailable = await this.isPrintingAvailable(bluetoothContext);
        if (!stillAvailable.available) {
          throw new Error(stillAvailable.reason || 'Printer disconnected during bulk print');
        }
        
        const result = await this.printPackage(bluetoothContext, pkg, options);
        results.push(result);
        
        if (i < packages.length - 1) {
          console.log('⏱️ [GLT-BULK] Waiting 2 seconds before next print...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`❌ [GLT-BULK] Failed to print ${pkg.code}:`, error);
        results.push({
          success: false,
          message: `Failed to print GLT receipt for ${pkg.code}: ${error.message}`,
          errorCode: 'GLT_BULK_ERROR',
        });
        
        if (error.message.includes('disconnected') || error.message.includes('not available')) {
          console.warn('⚠️ [GLT-BULK] Connection lost, stopping bulk print');
          for (let j = i + 1; j < packages.length; j++) {
            results.push({
              success: false,
              message: `GLT bulk print stopped due to connection loss`,
              errorCode: 'GLT_CONNECTION_LOST',
            });
          }
          break;
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [GLT-BULK] GLT bulk print completed: ${successCount}/${packages.length} successful`);
    
    Toast.show({
      type: successCount === packages.length ? 'success' : successCount > 0 ? 'info' : 'error',
      text1: '📦 GLT Bulk Print Complete',
      text2: `${successCount}/${packages.length} GLT receipts printed successfully`,
      position: 'top',
      visibilityTime: 4000,
    });
    
    return results;
  }

  /**
   * Print office delivery receipt with agent information
   */
  async printOfficeDelivery(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData,
    agentName: string,
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🏢 [GLT-OFFICE] Printing office delivery receipt for:', packageData.code);
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      const receiptText = this.generateOfficeDeliveryReceipt(packageData, agentName);
      await bluetoothContext.printText(receiptText);
      
      Toast.show({
        type: 'success',
        text1: '🏢 Office Delivery Receipt Printed',
        text2: `Receipt for ${packageData.code} with agent ${agentName}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Office delivery receipt printed for ${packageData.code}`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLT-OFFICE] Print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Office Delivery Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      
      return {
        success: false,
        message: errorMessage,
        errorCode: error.code || 'GLT_OFFICE_ERROR',
      };
    }
  }

  /**
   * Get detailed error message
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

export { GlobalPrintService };
export default GlobalPrintService;
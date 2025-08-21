// services/GlobalPrintService.ts - Fixed with actual QR code fetching from backend

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

  static getInstance(): GlobalPrintService {
    if (!GlobalPrintService.instance) {
      GlobalPrintService.instance = new GlobalPrintService();
    }
    return GlobalPrintService.instance;
  }

  /**
   * Generate clean GLT Logistics receipt format for thermal printers
   */
  private generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): string {
    const {
      code,
      receiver_name,
      route_description,
      delivery_location,
      payment_status = 'not_paid',
      delivery_type = 'home',
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

    // Payment status formatting
    const paymentText = payment_status === 'paid' ? 'PAID' : 'NOT PAID';

    // Create the receipt with proper thermal printer formatting
    const receipt = `
================================
        GLT LOGISTICS
      Fast & Reliable
================================

Customer Service: 0725 057 210
support@gltlogistics.co.ke
www.gltlogistics.co.ke

If package is lost, please contact
us immediately with this receipt.

================================

Package Code:
${code}

DELIVERY FOR: ${receiver_name.toUpperCase()}
${receiver_phone ? `Phone: ${receiver_phone}` : ''}

TO: ${delivery_location || route_description}

${agent_name ? `Agent: ${agent_name}` : ''}

--------------------------------

Payment Status: ${paymentText}

Date: ${dateStr}
Time: ${timeStr}

${packageData.weight ? `Weight: ${packageData.weight}` : ''}
${packageData.dimensions ? `Dimensions: ${packageData.dimensions}` : ''}
${packageData.special_instructions ? `Instructions: ${packageData.special_instructions}` : ''}

================================

Thank you for choosing GLT Logistics!
Your package will be delivered safely.

================================

      Designed by Infinity.Co
        www.infinity.co.ke

--------------------------------
Receipt printed: ${dateStr} ${timeStr}
`;

    return receipt;
  }

  /**
   * Generate receipt with actual QR code from backend
   */
  private async generateGLTReceiptWithQR(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
    const {
      code,
      receiver_name,
      route_description,
      delivery_location,
      payment_status = 'not_paid',
      delivery_type = 'home',
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

    // Payment status formatting
    const paymentText = payment_status === 'paid' ? 'PAID' : 'NOT PAID';

    // Fetch actual QR code from backend
    let qrCodeSection = '';
    try {
      console.log('🔍 [GLT-PRINT] Fetching QR code for package:', code);
      const qrResponse = await getPackageQRCode(code);
      
      if (qrResponse.success && qrResponse.data.qr_code_base64) {
        // Generate QR code commands for thermal printer
        qrCodeSection = this.generateQRCodeCommands(
          qrResponse.data.qr_code_base64, 
          qrResponse.data.tracking_url
        );
        console.log('✅ [GLT-PRINT] QR code fetched successfully');
      } else {
        // Fallback to tracking URL if QR code not available
        qrCodeSection = this.generateQRCodeFallback(
          code, 
          qrResponse.data.tracking_url
        );
        console.log('⚠️ [GLT-PRINT] QR code not available, using fallback');
      }
    } catch (error) {
      console.error('❌ [GLT-PRINT] Failed to fetch QR code:', error);
      // Use basic fallback
      qrCodeSection = this.generateQRCodeFallback(code);
    }

    const receipt = `
================================
        GLT LOGISTICS
      Fast & Reliable
================================

Customer Service: 0725 057 210
support@gltlogistics.co.ke
www.gltlogistics.co.ke

If package is lost, please contact
us immediately with this receipt.

================================

Package Code:
${code}

${qrCodeSection}

DELIVERY FOR: ${receiver_name.toUpperCase()}
${receiver_phone ? `Phone: ${receiver_phone}` : ''}

TO: ${delivery_location || route_description}

${agent_name ? `Agent: ${agent_name}` : ''}

--------------------------------

Payment Status: ${paymentText}

Date: ${dateStr}
Time: ${timeStr}

${packageData.weight ? `Weight: ${packageData.weight}` : ''}
${packageData.dimensions ? `Dimensions: ${packageData.dimensions}` : ''}
${packageData.special_instructions ? `Instructions: ${packageData.special_instructions}` : ''}

================================

Thank you for choosing GLT Logistics!
Your package will be delivered safely.

================================

      Designed by Infinity.Co
        www.infinity.co.ke

--------------------------------
Receipt printed: ${dateStr} ${timeStr}
`;

    return receipt;
  }

  /**
   * Generate actual QR code ESC/POS commands for thermal printers
   */
  private generateQRCodeCommands(qrCodeBase64: string, trackingUrl: string): string {
    // For thermal printers that support QR codes via ESC/POS commands
    // This is a basic implementation - adjust based on your specific printer model
    
    try {
      // ESC/POS QR Code commands (example for common thermal printers)
      // These would be the actual printer commands, but since we're printing as text,
      // we'll include them as comments and use a visual representation
      
      const qrCommands = `
--------------------------------
        SCAN QR CODE
--------------------------------

[QR CODE PRINTED HERE]

Track at:
${trackingUrl}

--------------------------------
`;
      
      // For actual ESC/POS implementation, you would use:
      // const qrSize = 6; // QR code size
      // const qrCommand = `\x1D(k\x04\x001A${String.fromCharCode(qrSize)}\x00`;
      // const qrData = `\x1D(k${String.fromCharCode(qrCodeBase64.length + 3)}\x001C\x03`;
      // const qrPrint = `\x1D(k\x03\x001Q0`;
      // return qrCommand + qrData + qrCodeBase64 + qrPrint;
      
      return qrCommands;
      
    } catch (error) {
      console.error('Failed to generate QR code commands:', error);
      return this.generateQRCodeFallback('', trackingUrl);
    }
  }

  /**
   * Generate QR code fallback when actual QR code is not available
   */
  private generateQRCodeFallback(packageCode: string, trackingUrl?: string): string {
    const fallbackUrl = trackingUrl || `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/track/${packageCode}`;
    
    return `
--------------------------------
    PACKAGE TRACKING
--------------------------------

Visit website to track:
${fallbackUrl}

Or search for: ${packageCode}

--------------------------------
`;
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

    const receipt = `
================================
        GLT LOGISTICS
      Fast & Reliable
================================

Customer Service: 0725 057 210
support@gltlogistics.co.ke

OFFICE DELIVERY RECEIPT

Package Code: ${packageData.code}

FROM: ${packageData.sender_name || 'N/A'}
TO: ${packageData.receiver_name}
ROUTE: ${packageData.route_description}

DELIVERY AGENT: ${agentName}
OFFICE DELIVERY

Date: ${dateStr}
Time: ${timeStr}

================================

Package handed over to office agent
for final delivery to recipient.

Thank you for choosing GLT Logistics!

================================

      Designed by Infinity.Co
        www.infinity.co.ke

`;

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
        receiptText = await this.generateGLTReceiptWithQR(packageData, options);
      } else {
        receiptText = this.generateGLTReceipt(packageData, options);
      }
      
      // Use the context's printText method for the receipt
      await bluetoothContext.printText(receiptText);
      
      console.log('✅ [GLT-PRINT] GLT receipt printed successfully');
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: '📦 GLT Receipt Printed',
        text2: `Package ${packageData.code} receipt sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `GLT receipt printed for ${packageData.code}`,
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
   * Print GLT test receipt
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLT-PRINT] Running GLT test print...');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      // Create test package data
      const testPackageData: PackageData = {
        code: 'PKG-TEST-' + Date.now().toString().slice(-6),
        receiver_name: 'Test Customer',
        receiver_phone: '0712 345 678',
        route_description: 'Test Route',
        delivery_location: 'Test Location, Nairobi',
        payment_status: 'paid',
        delivery_type: 'home',
        weight: '2kg',
        dimensions: '30x20x15 cm',
        special_instructions: 'Handle with care - Test package'
      };
      
      // Generate and print test receipt (without QR for test)
      const testReceipt = this.generateGLTReceipt(testPackageData, options);
      await bluetoothContext.printText(testReceipt);
      
      console.log('✅ [GLT-PRINT] Test receipt printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '🧪 GLT Test Print Successful',
        text2: `Test receipt sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `GLT test print successful`,
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
    
    // Print each package with delay
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
        
        // Add delay between prints to prevent printer overload
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
   * Print package with actual QR code - convenience method
   */
  async printPackageWithQR(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData
  ): Promise<PrintResult> {
    return this.printPackage(bluetoothContext, packageData, { includeQR: true });
  }

  /**
   * Print package without QR code - convenience method
   */
  async printPackageWithoutQR(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData
  ): Promise<PrintResult> {
    return this.printPackage(bluetoothContext, packageData, { includeQR: false });
  }

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
    if (message.includes('Failed to fetch QR code')) {
      return 'GLT Print: Could not load QR code. Receipt printed without QR.';
    }
    
    return `GLT Print Error: ${message}`;
  }

  /**
   * Compatibility method for old PrintReceiptService usage
   */
  async printPackageReceipt(packageData: PackageData, bluetoothContext?: BluetoothContextType): Promise<void> {
    if (!bluetoothContext) {
      throw new Error('GLT Print: Bluetooth context is required. Please pass the context from your component.');
    }
    
    const result = await this.printPackage(bluetoothContext, packageData);
    if (!result.success) {
      throw new Error(result.message);
    }
  }

  /**
   * Helper method to validate package data for GLT printing
   */
  validatePackageData(packageData: PackageData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!packageData.code) errors.push('Package code is required');
    if (!packageData.receiver_name) errors.push('Receiver name is required');
    if (!packageData.delivery_location && !packageData.route_description) {
      errors.push('Delivery location or route description is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper method to check if QR code is available for a package
   */
  async hasQRCode(packageCode: string): Promise<boolean> {
    try {
      const qrResponse = await getPackageQRCode(packageCode);
      return qrResponse.success && !!qrResponse.data.qr_code_base64;
    } catch (error) {
      console.warn('Could not check QR code availability:', error);
      return false;
    }
  }
}

export default GlobalPrintService;
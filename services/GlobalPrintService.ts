// services/GlobalPrintService.ts - Updated with GLT Logistics receipt format

import Toast from 'react-native-toast-message';

export interface PackageData {
  code: string;
  receiver_name: string;
  route_description: string;
  sender_name?: string;
  state_display?: string;
  pickup_location?: string;
  delivery_location?: string; // Updated from delivery_address
  weight?: string;
  dimensions?: string;
  special_instructions?: string;
  tracking_url?: string;
  payment_status?: 'paid' | 'not_paid' | 'pending'; // Added payment status
  delivery_type?: 'office' | 'home' | 'pickup_point'; // Added delivery type
  agent_name?: string; // For office deliveries
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
   * Generate GLT Logistics receipt format
   */
  private generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): string {
    const {
      code,
      receiver_name,
      route_description,
      delivery_location,
      payment_status = 'not_paid',
      delivery_type = 'home',
      agent_name
    } = packageData;

    // Get current date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });

    // Determine delivery info
    const isOfficeDelivery = delivery_type === 'office';
    const deliveryInfo = isOfficeDelivery && agent_name 
      ? `OFFICE DELIVERY - Agent: ${agent_name}`
      : '';

    // Payment status formatting
    const paymentText = payment_status === 'paid' ? 'PAID' : 'NOT PAID';
    const paymentIcon = payment_status === 'paid' ? '✓' : '✗';

    // Create ASCII art GLT logo
    const gltLogo = `
   ██████╗ ██╗  ████████╗
  ██╔════╝ ██║  ╚══██╔══╝
  ██║  ███╗██║     ██║   
  ██║   ██║██║     ██║   
  ╚██████╔╝███████╗██║   
   ╚═════╝ ╚══════╝╚═╝   
    LOGISTICS
`;

    // QR code placeholder (will be actual QR in real implementation)
    const qrCodeBox = `
  ████████████████
  ██            ██
  ██  ██████  ████
  ██  ██████  ████
  ██  ██████  ████
  ██            ██
  ████████████████
      ${code}
`;

    const receipt = `
${options.includeLogo !== false ? gltLogo : ''}
================================
        GLT LOGISTICS
      Fast & Reliable
================================

${isOfficeDelivery ? `🏢 ${deliveryInfo}` : ''}

📞 Customer Service: 0725 057 210
📧 support@gltlogistics.co.ke
🌐 www.gltlogistics.co.ke

If package is lost, please contact
us immediately with this receipt.

================================

📦 DELIVERY FOR: ${receiver_name.toUpperCase()}
📱 ${packageData.receiver_phone || 'N/A'}

📍 TO: ${delivery_location || route_description}

--------------------------------

${qrCodeBox}    ${paymentIcon} PAYMENT STATUS:
                   ${paymentText}
                   
                   Package Code:
                   ${code}
                   
                   Date: ${dateStr}
                   Time: ${timeStr}

${packageData.weight ? `📏 Weight: ${packageData.weight}` : ''}
${packageData.dimensions ? `📐 Size: ${packageData.dimensions}` : ''}
${packageData.special_instructions ? `📝 Note: ${packageData.special_instructions}` : ''}

================================

Thank you for choosing GLT Logistics!
Your package will be delivered safely.

Track your package at:
www.gltlogistics.co.ke/track

================================

      Designed by Infinity.Co
        www.infinity.co.ke

--------------------------------
Receipt printed: ${dateStr} ${timeStr}
Printer: Thermal Receipt Printer
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
      
      // Generate the receipt content
      const receiptText = this.generateGLTReceipt(packageData, options);
      
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
      
      // Generate and print test receipt
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
          console.log('⏱️ [GLT-BULK] Waiting 3 seconds before next print...');
          await new Promise(resolve => setTimeout(resolve, 3000));
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
    
    const officePackageData: PackageData = {
      ...packageData,
      delivery_type: 'office',
      agent_name: agentName,
    };
    
    return await this.printPackage(bluetoothContext, officePackageData, options);
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
}

export default GlobalPrintService;
// services/GlobalPrintService.ts - Updated to work with global Bluetooth context
import Toast from 'react-native-toast-message';

// Import the global context hook (this will be used from components)
// We can't use the hook directly in a service, so we'll pass the context as a parameter

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

// Define the Bluetooth context interface we expect
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
   * Check if printing is available using the global context
   */
  async isPrintingAvailable(bluetoothContext: BluetoothContextType): Promise<{ available: boolean; reason?: string }> {
    console.log('🔍 [GLOBAL-PRINT] Checking printing availability...');
    
    try {
      // Check if Bluetooth is available
      if (!bluetoothContext.isBluetoothAvailable) {
        return { available: false, reason: 'Bluetooth not available in this environment (Expo Go)' };
      }
      
      // Check if printer is ready
      if (!bluetoothContext.isPrintReady || !bluetoothContext.connectedPrinter) {
        return { available: false, reason: 'No printer connected' };
      }
      
      console.log('✅ [GLOBAL-PRINT] Printing is available');
      return { available: true };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Error checking availability:', error);
      return { available: false, reason: `System error: ${error.message}` };
    }
  }

  /**
   * Print package receipt/label using global context
   */
  async printPackage(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [GLOBAL-PRINT] Starting print job for:', packageData.code);
    
    try {
      // Check availability first
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      
      console.log('📄 [GLOBAL-PRINT] Using global context to print...');
      const printTime = new Date();
      
      // Use the context's printReceipt method
      await bluetoothContext.printReceipt({
        packageCode: packageData.code,
        customerName: packageData.receiver_name,
        route: packageData.route_description,
        senderName: packageData.sender_name,
        status: packageData.state_display,
        deliveryAddress: packageData.delivery_address,
        weight: packageData.weight,
        dimensions: packageData.dimensions,
        specialInstructions: packageData.special_instructions,
        trackingUrl: packageData.tracking_url,
        printType: options.printType || 'receipt',
        includeLogo: options.includeLogo !== false,
        includeQR: options.includeQR !== false,
      });
      
      console.log('✅ [GLOBAL-PRINT] Print completed successfully');
      
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
      console.error('❌ [GLOBAL-PRINT] Print failed:', error);
      
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
   * Test print functionality using global context
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLOBAL-PRINT] Running test print...');
    
    try {
      // Check availability first
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      // Use the context's testPrint method
      await bluetoothContext.testPrint();
      
      console.log('✅ [GLOBAL-PRINT] Test print completed successfully');
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Test Print Successful',
        text2: `Test sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Test print successful`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Test print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Test Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      
      return {
        success: false,
        message: errorMessage,
        errorCode: error.code || 'TEST_PRINT_ERROR',
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
    console.log('📝 [GLOBAL-PRINT] Printing text...');
    
    try {
      // Check availability first
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      // Use the context's printText method
      await bluetoothContext.printText(text);
      
      console.log('✅ [GLOBAL-PRINT] Text print completed successfully');
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Text Printed',
        text2: `Text sent to ${printer.name}`,
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
      console.error('❌ [GLOBAL-PRINT] Text print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Text Print Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      
      return {
        success: false,
        message: errorMessage,
        errorCode: error.code || 'TEXT_PRINT_ERROR',
      };
    }
  }

  /**
   * Bulk print multiple packages using global context
   */
  async bulkPrint(
    bluetoothContext: BluetoothContextType,
    packages: PackageData[], 
    options: PrintOptions = {}
  ): Promise<PrintResult[]> {
    console.log('📦 [GLOBAL-PRINT] Starting bulk print for', packages.length, 'packages');
    
    const results: PrintResult[] = [];
    
    // Check availability once at the start
    const availability = await this.isPrintingAvailable(bluetoothContext);
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
        const stillAvailable = await this.isPrintingAvailable(bluetoothContext);
        if (!stillAvailable.available) {
          throw new Error(stillAvailable.reason || 'Printer disconnected during bulk print');
        }
        
        const result = await this.printPackage(bluetoothContext, pkg, options);
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
   * Get detailed error message
   */
  private getDetailedErrorMessage(error: any): string {
    const message = error.message || error.toString();
    
    if (message.includes('Bluetooth not available')) {
      return 'Bluetooth not available. Use development build for printing.';
    }
    if (message.includes('not available in this environment')) {
      return 'Printing not available in Expo Go. Use development build.';
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
    if (message.includes('Connection lost')) {
      return 'Printer disconnected during operation. Reconnect and try again.';
    }
    
    return `Print error: ${message}`;
  }

  /**
   * Compatibility method for old PrintReceiptService usage
   */
  async printPackageReceipt(packageData: PackageData, bluetoothContext?: BluetoothContextType): Promise<void> {
    if (!bluetoothContext) {
      throw new Error('Bluetooth context is required. Please pass the context from your component.');
    }
    
    const result = await this.printPackage(bluetoothContext, packageData);
    if (!result.success) {
      throw new Error(result.message);
    }
  }
}

export default GlobalPrintService;
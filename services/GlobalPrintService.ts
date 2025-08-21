// services/GlobalPrintService.ts - Two-column layout with QR on right

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
  useBackendThermalQR?: boolean;
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

export interface ThermalQRResponse {
  success: boolean;
  data: {
    qr_data: string;
    tracking_url: string;
    thermal_qr_base64?: string;
    package_code: string;
    qr_type: string;
    thermal_optimized?: boolean;
  };
  error?: string;
}

class GlobalPrintService {
  private static instance: GlobalPrintService;

  constructor() {
    // Two-column layout thermal printer service
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
   * Get thermal QR from backend
   */
  private async getThermalQRFromBackend(packageCode: string): Promise<ThermalQRResponse> {
    console.log('🖨️ [GLOBAL-BACKEND] Requesting thermal QR for:', packageCode);
    
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/packages/${packageCode}/thermal_qr_code`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as ThermalQRResponse;
      
      if (data.success) {
        console.log('✅ [GLOBAL-BACKEND] Thermal QR received from backend');
        return data;
      } else {
        throw new Error(data.error || 'Backend thermal QR generation failed');
      }
      
    } catch (error) {
      console.error('❌ [GLOBAL-BACKEND] Backend request failed:', error);
      
      return {
        success: false,
        data: {
          qr_data: `https://gltlogistics.co.ke/track/${packageCode}`,
          tracking_url: `https://gltlogistics.co.ke/track/${packageCode}`,
          package_code: packageCode,
          qr_type: 'fallback_text'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate thermal printer QR commands
   */
  private generateThermalQRCommands(qrData: string, options: PrintOptions = {}): string {
    console.log('🖨️ [GLOBAL-QR-CMD] Generating thermal QR commands');
    
    try {
      let qrSize = 8; // Normal size for layout
      if (options.labelSize === 'small') qrSize = 6;
      if (options.labelSize === 'large') qrSize = 10;
      
      // ESC/POS QR Code commands for thermal printers
      const modelCommand = this.GS + '(k\x04\x00\x31\x41\x32\x00';
      const sizeCommand = this.GS + '(k\x03\x00\x31\x43' + String.fromCharCode(qrSize);
      const errorCommand = this.GS + '(k\x03\x00\x31\x45\x31';
      
      const dataLength = qrData.length + 3;
      const storeLowByte = dataLength & 0xFF;
      const storeHighByte = (dataLength >> 8) & 0xFF;
      const storeCommand = this.GS + '(k' + 
        String.fromCharCode(storeLowByte) + 
        String.fromCharCode(storeHighByte) + 
        '\x31\x50\x30' + qrData;
      
      const printCommand = this.GS + '(k\x03\x00\x31\x51\x30';
      
      return modelCommand + sizeCommand + errorCommand + storeCommand + printCommand;
      
    } catch (error) {
      console.error('❌ [GLOBAL-QR-CMD] Failed to generate QR commands:', error);
      throw error;
    }
  }

  /**
   * Get QR data from backend
   */
  private async getQRDataForPackage(packageCode: string, options: PrintOptions = {}): Promise<string> {
    console.log('🔍 [GLOBAL-QR] Fetching QR data for package:', packageCode);
    
    try {
      // Try backend thermal QR first
      if (options.useBackendThermalQR !== false) {
        try {
          const thermalQR = await this.getThermalQRFromBackend(packageCode);
          if (thermalQR.success && thermalQR.data.qr_data) {
            return thermalQR.data.qr_data;
          }
        } catch (thermalError) {
          console.warn('⚠️ [GLOBAL-QR] Backend thermal QR failed, using standard method');
        }
      }
      
      // Fallback: Try original backend QR data
      const qrResponse = await getPackageQRCode(packageCode);
      if (qrResponse.success && qrResponse.data.tracking_url) {
        return qrResponse.data.tracking_url;
      } else if (qrResponse.success && qrResponse.data.qr_code_data) {
        return qrResponse.data.qr_code_data;
      }
      
    } catch (backendError) {
      console.warn('⚠️ [GLOBAL-QR] Backend organic QR failed, using fallback URL');
    }

    return `https://gltlogistics.co.ke/track/${packageCode}`;
  }

  /**
   * Clean delivery location
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
    
    return cleaned.toUpperCase();
  }

  /**
   * Generate two-column layout GLT receipt
   */
  private async generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
    const {
      code,
      receiver_name,
      route_description,
      delivery_location
    } = packageData;

    const cleanLocation = this.cleanDeliveryLocation(route_description, delivery_location);

    // Get QR commands for positioning
    let qrCommands = '';
    if (options.includeQR !== false) {
      try {
        const qrData = await this.getQRDataForPackage(code, options);
        qrCommands = this.generateThermalQRCommands(qrData, options);
      } catch (error) {
        console.error('❌ [GLOBAL-PRINT] QR generation failed:', error);
      }
    }

    // TWO-COLUMN LAYOUT RECEIPT
    const receipt = 
      // Header - centered
      '\n' +
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT +
      'GLT LOGISTICS\n' +
      this.NORMAL_SIZE + 'Fast & Reliable\n' +
      this.BOLD_OFF + this.LEFT +
      
      // Two-column section: Left column (CODE, DELIVERY FOR, TO) + Right column (QR)
      '\n' + this.BOLD_ON + 'CODE:' + this.BOLD_OFF + '       ' + this.CENTER + qrCommands + this.LEFT + '\n' +
      code + '\n' +
      '\n' + this.BOLD_ON + 'DELIVERY FOR:\n' + this.BOLD_OFF +
      receiver_name.toUpperCase() + '\n' +
      '\n' + this.BOLD_ON + 'TO:\n' + this.BOLD_OFF +
      cleanLocation + '\n' +
      
      // Full-width sections
      '\n' + this.CENTER + this.BOLD_ON + 
      'Thank you for choosing\n' +
      'GLT Logistics!\n' +
      'Your package will be\n' +
      'delivered safely.\n' +
      this.BOLD_OFF +
      
      '\n' + 'Designed by Infinity.Co\n' +
      'www.infinity.co.ke\n\n' +
      this.LEFT;

    return receipt;
  }

  /**
   * Check if printing is available
   */
  async isPrintingAvailable(bluetoothContext: BluetoothContextType): Promise<{ available: boolean; reason?: string }> {
    if (!bluetoothContext.isBluetoothAvailable) {
      return { available: false, reason: 'Bluetooth not available' };
    }
    
    if (!bluetoothContext.isPrintReady || !bluetoothContext.connectedPrinter) {
      return { available: false, reason: 'No printer connected' };
    }
    
    return { available: true };
  }

  /**
   * Print two-column GLT package receipt
   */
  async printPackage(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [GLOBAL-PRINT] Starting two-column GLT print');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      const receiptText = await this.generateGLTReceipt(packageData, {
        ...options,
        useBackendThermalQR: true
      });
      
      await bluetoothContext.printText(receiptText);
      
      Toast.show({
        type: 'success',
        text1: '📦 Two-Column Receipt Printed',
        text2: `Package ${packageData.code} sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Two-column GLT receipt printed for ${packageData.code}`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Two-column print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Two-Column Print Failed',
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
   * Test print with two-column formatting
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLOBAL-PRINT] Running two-column test print');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      const testPackageData: PackageData = {
        code: 'LAYOUT-GLOBAL-' + Date.now().toString().slice(-6),
        receiver_name: 'Test User',
        receiver_phone: '0712 345 678',
        route_description: 'Two-Column Layout → Global Service Test',
        delivery_location: 'Test Location',
        payment_status: 'not_paid',
        delivery_type: 'home'
      };
      
      const testReceipt = await this.generateGLTReceipt(testPackageData, {
        ...options,
        useBackendThermalQR: true
      });
      await bluetoothContext.printText(testReceipt);
      
      Toast.show({
        type: 'success',
        text1: '🧪 Two-Column Test Print Successful',
        text2: `Test receipt sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Two-column GLT test print successful`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Two-column test print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Two-Column Test Failed',
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
   * Debug backend thermal QR
   */
  async debugBackendThermalQR(packageCode: string): Promise<{ success: boolean; data: any }> {
    try {
      const thermalQR = await this.getThermalQRFromBackend(packageCode);
      
      return {
        success: true,
        data: {
          backendResponse: {
            success: thermalQR.success,
            qrType: thermalQR.data.qr_type,
            hasImage: !!thermalQR.data.thermal_qr_base64,
            qrDataLength: thermalQR.data.qr_data?.length || 0,
            packageCode: thermalQR.data.package_code
          },
          qrDataPreview: thermalQR.data.qr_data?.substring(0, 50) + '...',
          debugTime: new Date().toISOString()
        }
      };
      
    } catch (error) {
      return {
        success: false,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get detailed error message
   */
  private getDetailedErrorMessage(error: any): string {
    const message = error.message || error.toString();
    
    if (message.includes('Bluetooth not available')) {
      return 'Two-Column Print: Bluetooth not available.';
    }
    if (message.includes('No printer connected')) {
      return 'Two-Column Print: Connect printer first.';
    }
    if (message.includes('timed out')) {
      return 'Two-Column Print: Timeout. Retry in a moment.';
    }
    
    return `Two-Column Print Error: ${message}`;
  }
}

export { GlobalPrintService };
export default GlobalPrintService;
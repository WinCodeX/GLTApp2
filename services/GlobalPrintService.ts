// services/GlobalPrintService.ts - Fixed with large bold text and clean layout

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
    // Large bold text thermal printer service
  }

  static getInstance(): GlobalPrintService {
    if (!GlobalPrintService.instance) {
      GlobalPrintService.instance = new GlobalPrintService();
    }
    return GlobalPrintService.instance;
  }

  /**
   * ESC/POS Commands for large, bold formatting
   */
  private readonly ESC = '\x1B';
  private readonly GS = '\x1D';
  
  // Text formatting commands
  private readonly BOLD_ON = this.ESC + 'E' + '\x01';
  private readonly BOLD_OFF = this.ESC + 'E' + '\x00';
  private readonly CENTER = this.ESC + 'a' + '\x01';
  private readonly LEFT = this.ESC + 'a' + '\x00';
  private readonly DOUBLE_HEIGHT = this.GS + '!' + '\x11';
  private readonly DOUBLE_WIDTH = this.GS + '!' + '\x20';
  private readonly QUAD_SIZE = this.GS + '!' + '\x33'; // Double width + double height
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
   * Generate QR code section - CLEAN without any labels
   */
  private async generateQRCodeSection(packageCode: string, options: PrintOptions = {}): Promise<string> {
    console.log('📱 [GLOBAL-QR] Generating clean QR code');
    
    try {
      let qrData = `https://gltlogistics.co.ke/track/${packageCode}`;
      
      // Try backend thermal QR first
      if (options.useBackendThermalQR !== false) {
        try {
          const thermalQR = await this.getThermalQRFromBackend(packageCode);
          if (thermalQR.success && thermalQR.data.qr_data) {
            qrData = thermalQR.data.qr_data;
          }
        } catch (thermalError) {
          console.warn('⚠️ [GLOBAL-QR] Backend thermal QR failed, using standard method');
        }
      }
      
      // Fallback: Try original backend QR data
      if (!qrData || qrData === `https://gltlogistics.co.ke/track/${packageCode}`) {
        try {
          const qrResponse = await getPackageQRCode(packageCode);
          if (qrResponse.success && qrResponse.data.tracking_url) {
            qrData = qrResponse.data.tracking_url;
          } else if (qrResponse.success && qrResponse.data.qr_code_data) {
            qrData = qrResponse.data.qr_code_data;
          }
        } catch (backendError) {
          console.warn('⚠️ [GLOBAL-QR] Backend organic QR failed, using fallback URL');
        }
      }

      const qrCommands = this.generateThermalQRCommands(qrData, options);
      
      // QR code without any labels
      return '\n\n' + this.CENTER + qrCommands + '\n\n' + this.LEFT;
      
    } catch (error) {
      console.error('❌ [GLOBAL-QR] Failed to generate clean QR:', error);
      return '\n\n';
    }
  }

  /**
   * Generate thermal printer QR commands
   */
  private generateThermalQRCommands(qrData: string, options: PrintOptions = {}): string {
    console.log('🖨️ [GLOBAL-QR-CMD] Generating thermal QR commands');
    
    try {
      let qrSize = 10; // Large default size
      if (options.labelSize === 'small') qrSize = 8;
      if (options.labelSize === 'large') qrSize = 12;
      
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
   * Generate GLT receipt with LARGE BOLD TEXT and NO LINES
   */
  private async generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
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

    // Generate clean QR code section
    let qrCodeSection = '';
    try {
      if (options.includeQR !== false) {
        qrCodeSection = await this.generateQRCodeSection(code, {
          ...options,
          useBackendThermalQR: true
        });
      }
    } catch (error) {
      console.error('❌ [GLOBAL-PRINT] Clean QR generation failed:', error);
      qrCodeSection = '\n\n';
    }

    // RECEIPT WITH LARGE BOLD TEXT AND NO SEPARATOR LINES
    const receipt = 
      '\n\n' +
      this.CENTER + this.BOLD_ON + this.QUAD_SIZE +
      'GLT LOGISTICS\n' +
      this.DOUBLE_HEIGHT + 'Fast & Reliable\n' +
      this.NORMAL_SIZE + this.BOLD_OFF + 
      
      '\n' + this.BOLD_ON + this.DOUBLE_WIDTH + 
      'Customer Service:\n' +
      '0725 057 210\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      'support@gltlogistics.co.ke\n' +
      'www.gltlogistics.co.ke\n\n' +
      
      this.BOLD_ON + 'If package is lost, please contact\n' +
      'us immediately with this receipt.\n' +
      this.BOLD_OFF + 
      
      '\n\n' + this.CENTER + this.BOLD_ON + this.QUAD_SIZE + 
      code + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF + this.LEFT +
      
      qrCodeSection +
      
      '\n' + this.BOLD_ON + this.DOUBLE_HEIGHT + 'DELIVERY FOR:\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF + 
      this.BOLD_ON + this.DOUBLE_WIDTH + receiver_name.toUpperCase() + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      
      (receiver_phone ? 
        this.BOLD_ON + 'PHONE: ' + receiver_phone + '\n' + this.BOLD_OFF : '') +
      
      '\n' + this.BOLD_ON + this.DOUBLE_HEIGHT + 'TO:\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      this.BOLD_ON + this.DOUBLE_WIDTH + cleanLocation + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      
      (agent_name ? 
        '\n' + this.BOLD_ON + 'AGENT: ' + agent_name + '\n' + this.BOLD_OFF : '') +
      
      '\n\n' + this.BOLD_ON + this.DOUBLE_HEIGHT + 'PAYMENT STATUS:\n' + 
      this.QUAD_SIZE + paymentText + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      
      '\n' + this.BOLD_ON + 'DATE: ' + dateStr + '\n' + 
      'TIME: ' + timeStr + '\n' + this.BOLD_OFF +
      
      (packageData.weight ? 
        this.BOLD_ON + 'WEIGHT: ' + packageData.weight + '\n' + this.BOLD_OFF : '') +
      (packageData.dimensions ? 
        this.BOLD_ON + 'DIMENSIONS: ' + packageData.dimensions + '\n' + this.BOLD_OFF : '') +
      (packageData.special_instructions ? 
        '\n' + this.BOLD_ON + 'INSTRUCTIONS:\n' + this.BOLD_OFF + 
        packageData.special_instructions + '\n' : '') +
      
      '\n\n' + this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT + 
      'Thank you for choosing\n' +
      'GLT Logistics!\n' +
      this.NORMAL_SIZE +
      'Your package will be\n' +
      'delivered safely.\n' +
      this.BOLD_OFF + 
      
      '\n' + 'Designed by Infinity.Co\n' +
      'www.infinity.co.ke\n\n' +
      
      this.LEFT + 'Receipt printed: ' + dateStr + ' ' + timeStr + '\n\n\n';

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
   * Print GLT package with LARGE BOLD formatting
   */
  async printPackage(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [GLOBAL-PRINT] Starting LARGE BOLD GLT print');
    
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
        text1: '📦 LARGE BOLD Receipt Printed',
        text2: `Package ${packageData.code} sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `LARGE BOLD GLT receipt printed for ${packageData.code}`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] LARGE BOLD print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ LARGE BOLD Print Failed',
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
   * Test print with LARGE BOLD formatting
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLOBAL-PRINT] Running LARGE BOLD test print');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      const testPackageData: PackageData = {
        code: 'LARGE-GLOBAL-' + Date.now().toString().slice(-6),
        receiver_name: 'LARGE BOLD Test User',
        receiver_phone: '0712 345 678',
        route_description: 'LARGE BOLD → Global Service Test',
        delivery_location: 'Test Location',
        payment_status: 'not_paid',
        delivery_type: 'home',
        weight: '2kg',
        dimensions: '30x20x15 cm',
        special_instructions: 'Testing Global Service with LARGE BOLD formatting'
      };
      
      const testReceipt = await this.generateGLTReceipt(testPackageData, {
        ...options,
        useBackendThermalQR: true
      });
      await bluetoothContext.printText(testReceipt);
      
      Toast.show({
        type: 'success',
        text1: '🧪 LARGE BOLD Test Print Successful',
        text2: `Test receipt sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `LARGE BOLD GLT test print successful`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] LARGE BOLD test print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ LARGE BOLD Test Failed',
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
      return 'LARGE BOLD Print: Bluetooth not available.';
    }
    if (message.includes('No printer connected')) {
      return 'LARGE BOLD Print: Connect printer first.';
    }
    if (message.includes('timed out')) {
      return 'LARGE BOLD Print: Timeout. Retry in a moment.';
    }
    
    return `LARGE BOLD Print Error: ${message}`;
  }
}

export { GlobalPrintService };
export default GlobalPrintService;
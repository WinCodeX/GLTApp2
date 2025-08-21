// services/GlobalPrintService.ts - Enhanced with bold, larger text and clean layout

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
    // Enhanced bold text thermal printer service with backend QR support
  }

  static getInstance(): GlobalPrintService {
    if (!GlobalPrintService.instance) {
      GlobalPrintService.instance = new GlobalPrintService();
    }
    return GlobalPrintService.instance;
  }

  /**
   * Enhanced ESC/POS Commands for bold, large formatting
   */
  private readonly ESC = '\x1B';
  private readonly GS = '\x1D';
  
  // Enhanced text formatting commands
  private readonly BOLD_ON = this.ESC + 'E' + '\x01';
  private readonly BOLD_OFF = this.ESC + 'E' + '\x00';
  private readonly CENTER = this.ESC + 'a' + '\x01';
  private readonly LEFT = this.ESC + 'a' + '\x00';
  private readonly DOUBLE_HEIGHT = this.GS + '!' + '\x11';
  private readonly DOUBLE_WIDTH = this.GS + '!' + '\x20';
  private readonly QUAD_SIZE = this.GS + '!' + '\x33'; // Double width + double height
  private readonly NORMAL_SIZE = this.GS + '!' + '\x00';
  private readonly UNDERLINE_ON = this.ESC + '-' + '\x01';
  private readonly UNDERLINE_OFF = this.ESC + '-' + '\x00';

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
   * Generate clean QR code section without labels
   */
  private async generateQRCodeSection(packageCode: string, options: PrintOptions = {}): Promise<string> {
    console.log('📱 [GLOBAL-QR] Generating clean QR code for thermal printer:', packageCode);
    
    try {
      let qrData = `https://gltlogistics.co.ke/track/${packageCode}`;
      let qrCommands = '';
      
      // Try backend thermal QR first
      if (options.useBackendThermalQR !== false) {
        console.log('🖨️ [GLOBAL-QR] Attempting backend thermal QR...');
        
        try {
          const thermalQR = await this.getThermalQRFromBackend(packageCode);
          
          if (thermalQR.success && thermalQR.data.qr_data) {
            console.log('📱 [GLOBAL-QR] Using backend thermal QR data');
            qrData = thermalQR.data.qr_data;
            qrCommands = this.generateThermalQRCommands(qrData, options);
          } else {
            throw new Error('Backend thermal QR not available');
          }
        } catch (thermalError) {
          console.warn('⚠️ [GLOBAL-QR] Backend thermal QR failed, using standard method:', thermalError);
        }
      }
      
      // Fallback: Try original backend QR data
      if (!qrCommands) {
        console.log('🔄 [GLOBAL-QR] Trying original backend QR data...');
        
        try {
          const qrResponse = await getPackageQRCode(packageCode);
          if (qrResponse.success && qrResponse.data.tracking_url) {
            qrData = qrResponse.data.tracking_url;
            console.log('✅ [GLOBAL-QR] Using backend organic QR tracking URL:', qrData);
          } else if (qrResponse.success && qrResponse.data.qr_code_data) {
            qrData = qrResponse.data.qr_code_data;
            console.log('✅ [GLOBAL-QR] Using backend organic QR data:', qrData);
          }
        } catch (backendError) {
          console.warn('⚠️ [GLOBAL-QR] Backend organic QR failed, using fallback URL');
        }

        qrCommands = this.generateThermalQRCommands(qrData, options);
      }
      
      // Clean QR section without labels
      const qrSection = 
        '\n\n' +
        this.CENTER +
        qrCommands +
        '\n\n' +
        this.LEFT;
      
      console.log('✅ [GLOBAL-QR] Clean QR section generated successfully');
      return qrSection;
      
    } catch (error) {
      console.error('❌ [GLOBAL-QR] Failed to generate clean QR:', error);
      return '\n\n';
    }
  }

  /**
   * Generate enhanced thermal printer QR commands
   */
  private generateThermalQRCommands(qrData: string, options: PrintOptions = {}): string {
    console.log('🖨️ [GLOBAL-QR-CMD] Generating enhanced thermal QR commands for:', qrData);
    
    try {
      let qrSize = 10; // Larger default size
      if (options.labelSize === 'small') qrSize = 8;
      if (options.labelSize === 'large') qrSize = 12;
      
      // ESC/POS QR Code commands for thermal printers
      const modelCommand = this.GS + '(k\x04\x00\x31\x41\x32\x00'; // Model 2
      const sizeCommand = this.GS + '(k\x03\x00\x31\x43' + String.fromCharCode(qrSize); // Size
      const errorCommand = this.GS + '(k\x03\x00\x31\x45\x31'; // Error correction level L
      
      // Store QR data
      const dataLength = qrData.length + 3;
      const storeLowByte = dataLength & 0xFF;
      const storeHighByte = (dataLength >> 8) & 0xFF;
      const storeCommand = this.GS + '(k' + 
        String.fromCharCode(storeLowByte) + 
        String.fromCharCode(storeHighByte) + 
        '\x31\x50\x30' + qrData;
      
      // Print QR code
      const printCommand = this.GS + '(k\x03\x00\x31\x51\x30';
      
      // Combine all commands
      const fullQRCommand = modelCommand + sizeCommand + errorCommand + storeCommand + printCommand;
      
      console.log('✅ [GLOBAL-QR-CMD] Enhanced thermal QR commands generated');
      return fullQRCommand;
      
    } catch (error) {
      console.error('❌ [GLOBAL-QR-CMD] Failed to generate QR commands:', error);
      throw error;
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
   * Generate enhanced GLT receipt with bold, large text and clean layout
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
        console.log('📱 [GLOBAL-PRINT] Generating clean QR for package:', code);
        qrCodeSection = await this.generateQRCodeSection(code, {
          ...options,
          useBackendThermalQR: true
        });
      }
    } catch (error) {
      console.error('❌ [GLOBAL-PRINT] Clean QR generation failed:', error);
      qrCodeSection = '\n\n';
    }

    const receipt = 
      '\n' +
      this.CENTER + this.BOLD_ON + this.QUAD_SIZE +
      'GLT LOGISTICS\n' +
      this.DOUBLE_HEIGHT + 'Fast & Reliable\n' +
      this.NORMAL_SIZE + this.BOLD_OFF + '\n' +
      this.BOLD_ON + this.DOUBLE_WIDTH + 'Customer Service:\n' +
      '0725 057 210\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      'support@gltlogistics.co.ke\n' +
      'www.gltlogistics.co.ke\n\n' +
      this.BOLD_ON + 'If package is lost, please contact\n' +
      'us immediately with this receipt.\n' +
      this.BOLD_OFF + '\n' + this.LEFT +
      
      this.CENTER + this.BOLD_ON + this.QUAD_SIZE + 
      code + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF + this.LEFT +
      
      qrCodeSection +
      
      this.BOLD_ON + this.DOUBLE_HEIGHT + 'DELIVERY FOR:\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF + 
      this.BOLD_ON + this.DOUBLE_WIDTH + receiver_name.toUpperCase() + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      
      (receiver_phone ? 
        this.BOLD_ON + 'PHONE: ' + receiver_phone + '\n' + this.BOLD_OFF : '') +
      
      '\n' +
      this.BOLD_ON + this.DOUBLE_HEIGHT + 'TO:\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      this.BOLD_ON + this.DOUBLE_WIDTH + cleanLocation + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      
      (agent_name ? 
        '\n' + this.BOLD_ON + 'AGENT: ' + agent_name + '\n' + this.BOLD_OFF : '') +
      
      '\n' +
      this.BOLD_ON + this.DOUBLE_HEIGHT + 'PAYMENT STATUS:\n' + 
      this.QUAD_SIZE + paymentText + '\n' + 
      this.NORMAL_SIZE + this.BOLD_OFF +
      
      '\n' +
      this.BOLD_ON + 'DATE: ' + dateStr + '\n' + 
      'TIME: ' + timeStr + '\n' + this.BOLD_OFF +
      
      (packageData.weight ? 
        this.BOLD_ON + 'WEIGHT: ' + packageData.weight + '\n' + this.BOLD_OFF : '') +
      (packageData.dimensions ? 
        this.BOLD_ON + 'DIMENSIONS: ' + packageData.dimensions + '\n' + this.BOLD_OFF : '') +
      (packageData.special_instructions ? 
        '\n' + this.BOLD_ON + 'INSTRUCTIONS:\n' + this.BOLD_OFF + 
        packageData.special_instructions + '\n' : '') +
      
      '\n' +
      this.CENTER + this.BOLD_ON + this.DOUBLE_HEIGHT + 
      'Thank you for choosing\n' +
      'GLT Logistics!\n' +
      this.NORMAL_SIZE +
      'Your package will be\n' +
      'delivered safely.\n' +
      this.BOLD_OFF + '\n' +
      
      'Designed by Infinity.Co\n' +
      'www.infinity.co.ke\n\n' +
      
      this.LEFT + 'Receipt printed: ' + dateStr + ' ' + timeStr + '\n\n';

    return receipt;
  }

  /**
   * Check if printing is available
   */
  async isPrintingAvailable(bluetoothContext: BluetoothContextType): Promise<{ available: boolean; reason?: string }> {
    console.log('🔍 [GLOBAL-PRINT] Checking printing availability...');
    
    try {
      if (!bluetoothContext.isBluetoothAvailable) {
        return { available: false, reason: 'Bluetooth not available in this environment (Expo Go)' };
      }
      
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
   * Print GLT package with enhanced bold formatting and clean layout
   */
  async printPackage(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [GLOBAL-PRINT] Starting enhanced bold GLT print for:', packageData.code);
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      console.log('📄 [GLOBAL-PRINT] Generating enhanced bold GLT receipt...');
      
      const receiptText = await this.generateGLTReceipt(packageData, {
        ...options,
        useBackendThermalQR: true
      });
      
      await bluetoothContext.printText(receiptText);
      
      console.log('✅ [GLOBAL-PRINT] Enhanced bold GLT receipt printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '📦 Enhanced Bold Receipt Printed',
        text2: `Package ${packageData.code} with clean layout sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Enhanced bold GLT receipt printed for ${packageData.code}`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Enhanced bold print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Enhanced Bold Print Failed',
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
   * Test print with enhanced bold formatting
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLOBAL-PRINT] Running enhanced bold test print...');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      const testPackageData: PackageData = {
        code: 'BOLD-GLOBAL-' + Date.now().toString().slice(-6),
        receiver_name: 'Enhanced Bold Test User',
        receiver_phone: '0712 345 678',
        route_description: 'Bold Format → Global Service Test',
        delivery_location: 'Test Location',
        payment_status: 'not_paid',
        delivery_type: 'home',
        weight: '2kg',
        dimensions: '30x20x15 cm',
        special_instructions: 'Testing Global Service with enhanced bold formatting'
      };
      
      const testReceipt = await this.generateGLTReceipt(testPackageData, {
        ...options,
        useBackendThermalQR: true
      });
      await bluetoothContext.printText(testReceipt);
      
      console.log('✅ [GLOBAL-PRINT] Enhanced bold test receipt printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '🧪 Enhanced Bold Test Print Successful',
        text2: `Test receipt with clean layout sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Enhanced bold GLT test print successful`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Enhanced bold test print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Enhanced Bold Test Failed',
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
   * Debug backend thermal QR connection
   */
  async debugBackendThermalQR(packageCode: string): Promise<{ success: boolean; data: any }> {
    console.log('🔧 [GLOBAL-DEBUG] Testing backend thermal QR connection for:', packageCode);
    
    try {
      const thermalQR = await this.getThermalQRFromBackend(packageCode);
      
      const debugInfo = {
        success: thermalQR.success,
        qrType: thermalQR.data.qr_type,
        hasImage: !!thermalQR.data.thermal_qr_base64,
        qrDataLength: thermalQR.data.qr_data?.length || 0,
        thermalOptimized: thermalQR.data.thermal_optimized || false,
        error: thermalQR.error,
        packageCode: thermalQR.data.package_code
      };
      
      console.log('📊 [GLOBAL-DEBUG] Backend response:', debugInfo);
      
      return {
        success: true,
        data: {
          backendResponse: debugInfo,
          hasBackendThermalQR: !!thermalQR.data.thermal_qr_base64,
          qrDataPreview: thermalQR.data.qr_data?.substring(0, 50) + '...',
          debugTime: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ [GLOBAL-DEBUG] Backend debug failed:', error);
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
      return 'Enhanced Bold Print: Bluetooth not available. Use development build.';
    }
    if (message.includes('not available in this environment')) {
      return 'Enhanced Bold Print: Not available in Expo Go. Use development build.';
    }
    if (message.includes('No printer connected')) {
      return 'Enhanced Bold Print: Connect printer in Settings → Bluetooth first.';
    }
    if (message.includes('Printer disconnected')) {
      return 'Enhanced Bold Print: Connection lost. Turn on printer and reconnect.';
    }
    if (message.includes('timed out')) {
      return 'Enhanced Bold Print: Timeout. Printer may be busy - retry in a moment.';
    }
    if (message.includes('Device not found')) {
      return 'Enhanced Bold Print: Printer not found. Check if printer is on and paired.';
    }
    if (message.includes('Connection lost')) {
      return 'Enhanced Bold Print: Connection lost during operation. Reconnect and retry.';
    }
    
    return `Enhanced Bold Print Error: ${message}`;
  }
}

export { GlobalPrintService };
export default GlobalPrintService;
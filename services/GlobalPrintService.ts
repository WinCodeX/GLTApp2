// services/GlobalPrintService.ts - Updated to use backend thermal QR generation

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
  useBackendThermalQR?: boolean; // NEW: Use backend thermal QR
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
    // Enhanced text-based thermal printer service with backend QR support
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
   * Get thermal QR from backend (NEW)
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
        console.log('📊 [GLOBAL-BACKEND] QR type:', data.data.qr_type);
        return data;
      } else {
        throw new Error(data.error || 'Backend thermal QR generation failed');
      }
      
    } catch (error) {
      console.error('❌ [GLOBAL-BACKEND] Backend request failed:', error);
      
      // Return fallback response
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
   * Convert thermal QR bitmap (placeholder for future enhancement)
   */
  private convertThermalQRToBitmap(base64Data: string): string {
    console.log('🎨 [GLOBAL-BITMAP] Converting thermal QR to bitmap...');
    
    try {
      // Placeholder for actual bitmap conversion
      // The backend thermal QR is already optimized for thermal printing
      console.log('⚠️ [GLOBAL-BITMAP] Bitmap conversion not implemented yet - using ESC/POS fallback');
      return ''; // Return empty string to trigger ESC/POS fallback
      
    } catch (error) {
      console.error('❌ [GLOBAL-BITMAP] Bitmap conversion failed:', error);
      return '';
    }
  }

  /**
   * Generate QR code section using enhanced thermal printer support (UPDATED)
   */
  private async generateQRCodeSection(packageCode: string, options: PrintOptions = {}): Promise<string> {
    console.log('📱 [GLOBAL-QR] Generating enhanced QR code for thermal printer:', packageCode);
    
    try {
      let qrData = `https://gltlogistics.co.ke/track/${packageCode}`;
      let qrCommands = '';
      
      // NEW: Try backend thermal QR first
      if (options.useBackendThermalQR !== false) {
        console.log('🖨️ [GLOBAL-QR] Attempting backend thermal QR...');
        
        try {
          const thermalQR = await this.getThermalQRFromBackend(packageCode);
          
          if (thermalQR.success && thermalQR.data.thermal_qr_base64) {
            console.log('🎨 [GLOBAL-QR] Got thermal QR image from backend');
            
            // Try to convert backend thermal QR to bitmap
            const bitmapCommands = this.convertThermalQRToBitmap(thermalQR.data.thermal_qr_base64);
            
            if (bitmapCommands) {
              qrCommands = bitmapCommands;
              console.log('✅ [GLOBAL-QR] Using backend thermal QR bitmap');
            } else {
              console.log('🔄 [GLOBAL-QR] Bitmap conversion not ready, using ESC/POS with backend data');
              qrData = thermalQR.data.qr_data;
              qrCommands = this.generateThermalQRCommands(qrData, options);
            }
          } else if (thermalQR.success && thermalQR.data.qr_data) {
            console.log('📱 [GLOBAL-QR] Using backend thermal QR data with ESC/POS');
            qrData = thermalQR.data.qr_data;
            qrCommands = this.generateThermalQRCommands(qrData, options);
          } else {
            throw new Error('Backend thermal QR not available');
          }
        } catch (thermalError) {
          console.warn('⚠️ [GLOBAL-QR] Backend thermal QR failed, using standard method:', thermalError);
          // Fall through to standard method
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

        // Generate thermal printer QR code using ESC/POS commands
        qrCommands = this.generateThermalQRCommands(qrData, options);
      }
      
      const qrSection = 
        '\n' +
        this.CENTER +
        '- QR Code for Tracking -\n' +
        qrCommands +
        '\n' +
        'Scan to track your package\n' +
        '\n' +
        this.LEFT;
      
      console.log('✅ [GLOBAL-QR] Enhanced QR section generated successfully');
      return qrSection;
      
    } catch (error) {
      console.error('❌ [GLOBAL-QR] Failed to generate enhanced QR:', error);
      return this.generateFallbackQRSection(packageCode);
    }
  }

  /**
   * Generate thermal printer QR commands using ESC/POS
   */
  private generateThermalQRCommands(qrData: string, options: PrintOptions = {}): string {
    console.log('🖨️ [GLOBAL-QR-CMD] Generating thermal QR commands for:', qrData);
    
    try {
      // Determine QR size based on label size
      let qrSize = 8; // Default size
      if (options.labelSize === 'small') qrSize = 6;
      if (options.labelSize === 'large') qrSize = 10;
      
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
      
      console.log('✅ [GLOBAL-QR-CMD] Thermal QR commands generated');
      return fullQRCommand;
      
    } catch (error) {
      console.error('❌ [GLOBAL-QR-CMD] Failed to generate QR commands:', error);
      throw error;
    }
  }

  /**
   * Generate fallback QR section if main generation fails
   */
  private generateFallbackQRSection(packageCode: string): string {
    console.log('⚠️ [GLOBAL-QR-FALLBACK] Using fallback QR section');
    
    const fallbackUrl = `https://gltlogistics.co.ke/track/${packageCode}`;
    const qrCommands = this.generateThermalQRCommands(fallbackUrl, { labelSize: 'medium' });
    
    return '\n' + this.CENTER + '- QR Code for Tracking -\n' +
           qrCommands +
           '\n' + 'Scan to track: ' + packageCode + '\n' + '\n' + this.LEFT;
  }

  /**
   * Generate ASCII QR fallback (for extreme cases)
   */
  private generateASCIIQRFallback(packageCode: string): string {
    console.log('🔤 [GLOBAL-ASCII-QR] Generating ASCII QR fallback');
    
    // Create a simple ASCII representation
    const asciiQR = this.generateASCIIQRPattern(packageCode);
    
    return '\n' + this.CENTER + '- QR Code for Tracking -\n' +
           asciiQR +
           '\n' + 'Package: ' + packageCode + '\n' +
           'Track: gltlogistics.co.ke/track/' + packageCode + '\n' + '\n' + this.LEFT;
  }

  /**
   * Generate ASCII QR pattern
   */
  private generateASCIIQRPattern(packageCode: string): string {
    const size = 21; // Standard QR size
    let pattern = '';
    
    // Create finder patterns and data pattern based on package code
    for (let row = 0; row < size; row++) {
      let line = '';
      for (let col = 0; col < size; col++) {
        // Finder patterns (corners)
        if (this.isFinderPattern(row, col, size)) {
          line += '█';
        }
        // Data modules (simplified pattern based on package code)
        else if (this.isDataModule(row, col, packageCode)) {
          line += '█';
        }
        else {
          line += ' ';
        }
      }
      pattern += line + '\n';
    }
    
    return pattern;
  }

  /**
   * Check if position is in finder pattern
   */
  private isFinderPattern(row: number, col: number, size: number): boolean {
    const finderSize = 7;
    
    // Top-left
    if (row < finderSize && col < finderSize) {
      return this.isInSquarePattern(row, col, finderSize);
    }
    // Top-right
    if (row < finderSize && col >= size - finderSize) {
      return this.isInSquarePattern(row, col - (size - finderSize), finderSize);
    }
    // Bottom-left
    if (row >= size - finderSize && col < finderSize) {
      return this.isInSquarePattern(row - (size - finderSize), col, finderSize);
    }
    
    return false;
  }

  /**
   * Check if position is in square pattern
   */
  private isInSquarePattern(row: number, col: number, size: number): boolean {
    // Outer border
    if (row === 0 || row === size - 1 || col === 0 || col === size - 1) return true;
    if (row === 1 || row === size - 2 || col === 1 || col === size - 2) return false;
    if (row === 2 || row === size - 3 || col === 2 || col === size - 3) return true;
    // Inner square
    if (row >= 2 && row <= size - 3 && col >= 2 && col <= size - 3) return true;
    return false;
  }

  /**
   * Check if position should be data module
   */
  private isDataModule(row: number, col: number, packageCode: string): boolean {
    if (this.isFinderPattern(row, col, 21)) return false;
    
    // Simple pattern based on package code hash
    const hash = this.simpleHash(packageCode);
    const pattern = (row * 31 + col * 17 + hash) % 3;
    return pattern === 0;
  }

  /**
   * Simple hash function for pattern generation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
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
   * Generate GLT receipt with enhanced thermal QR (UPDATED)
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

    // Generate enhanced QR code section
    let qrCodeSection = '';
    try {
      if (options.includeQR !== false) {
        console.log('📱 [GLOBAL-PRINT] Generating enhanced QR for package:', code);
        qrCodeSection = await this.generateQRCodeSection(code, {
          ...options,
          useBackendThermalQR: true // Enable backend thermal QR by default
        });
      }
    } catch (error) {
      console.error('❌ [GLOBAL-PRINT] Enhanced QR generation failed, using ASCII fallback:', error);
      qrCodeSection = this.generateASCIIQRFallback(code);
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
   * Print GLT package with enhanced thermal QR (UPDATED)
   */
  async printPackage(
    bluetoothContext: BluetoothContextType,
    packageData: PackageData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    console.log('🖨️ [GLOBAL-PRINT] Starting enhanced GLT print for:', packageData.code);
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      console.log('📄 [GLOBAL-PRINT] Generating enhanced GLT receipt...');
      
      const receiptText = await this.generateGLTReceipt(packageData, {
        ...options,
        useBackendThermalQR: true // Enable backend thermal QR by default
      });
      
      await bluetoothContext.printText(receiptText);
      
      console.log('✅ [GLOBAL-PRINT] Enhanced GLT receipt printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '📦 Enhanced GLT Receipt Printed',
        text2: `Package ${packageData.code} with backend thermal QR sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Enhanced GLT receipt with backend thermal QR printed for ${packageData.code}`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Enhanced print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Enhanced GLT Print Failed',
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
   * Test print with enhanced thermal QR (UPDATED)
   */
  async testPrint(bluetoothContext: BluetoothContextType, options: PrintOptions = {}): Promise<PrintResult> {
    console.log('🧪 [GLOBAL-PRINT] Running enhanced test print...');
    
    try {
      const availability = await this.isPrintingAvailable(bluetoothContext);
      if (!availability.available) {
        throw new Error(availability.reason || 'Printing not available');
      }

      const printer = bluetoothContext.connectedPrinter;
      const printTime = new Date();
      
      const testPackageData: PackageData = {
        code: 'GLOBAL-' + Date.now().toString().slice(-6) + '-MCH',
        receiver_name: 'Enhanced Test User',
        receiver_phone: '0712 345 678',
        route_description: 'Backend Thermal QR → Global Service Test',
        delivery_location: 'Test Location',
        payment_status: 'not_paid',
        delivery_type: 'home',
        weight: '2kg',
        dimensions: '30x20x15 cm',
        special_instructions: 'Testing Global Service with enhanced thermal QR'
      };
      
      const testReceipt = await this.generateGLTReceipt(testPackageData, {
        ...options,
        useBackendThermalQR: true
      });
      await bluetoothContext.printText(testReceipt);
      
      console.log('✅ [GLOBAL-PRINT] Enhanced test receipt printed successfully');
      
      Toast.show({
        type: 'success',
        text1: '🧪 Enhanced GLT Test Print Successful',
        text2: `Test receipt with backend thermal QR sent to ${printer.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
      
      return {
        success: true,
        message: `Enhanced GLT test print with backend thermal QR successful`,
        printTime,
        printerUsed: printer.name,
      };
      
    } catch (error: any) {
      console.error('❌ [GLOBAL-PRINT] Enhanced test print failed:', error);
      
      const errorMessage = this.getDetailedErrorMessage(error);
      
      Toast.show({
        type: 'error',
        text1: '❌ Enhanced GLT Test Failed',
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
   * Debug backend thermal QR connection (NEW)
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
      return 'Enhanced GLT Print: Bluetooth not available. Use development build.';
    }
    if (message.includes('not available in this environment')) {
      return 'Enhanced GLT Print: Not available in Expo Go. Use development build.';
    }
    if (message.includes('No printer connected')) {
      return 'Enhanced GLT Print: Connect printer in Settings → Bluetooth first.';
    }
    if (message.includes('Printer disconnected')) {
      return 'Enhanced GLT Print: Connection lost. Turn on printer and reconnect.';
    }
    if (message.includes('timed out')) {
      return 'Enhanced GLT Print: Timeout. Printer may be busy - retry in a moment.';
    }
    if (message.includes('Device not found')) {
      return 'Enhanced GLT Print: Printer not found. Check if printer is on and paired.';
    }
    if (message.includes('Connection lost')) {
      return 'Enhanced GLT Print: Connection lost during operation. Reconnect and retry.';
    }
    
    return `Enhanced GLT Print Error: ${message}`;
  }
}

export { GlobalPrintService };
export default GlobalPrintService;
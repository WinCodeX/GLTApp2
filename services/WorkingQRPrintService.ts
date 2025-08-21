// services/WorkingQRPrintService.ts - Two-column layout with QR on right

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

/**
 * ESC/POS Commands for formatting
 */
const ESC = '\x1B';
const GS = '\x1D';

// Text formatting commands
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const CENTER = ESC + 'a' + '\x01';
const LEFT = ESC + 'a' + '\x00';
const DOUBLE_HEIGHT = GS + '!' + '\x11';
const NORMAL_SIZE = GS + '!' + '\x00';

/**
 * Get thermal QR from backend
 */
async function getThermalQRFromBackend(packageCode: string): Promise<ThermalQRResponse> {
  console.log('🖨️ [BACKEND-THERMAL] Requesting thermal QR for:', packageCode);
  
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
      console.log('✅ [BACKEND-THERMAL] Thermal QR received from backend');
      return data;
    } else {
      throw new Error(data.error || 'Backend thermal QR generation failed');
    }
    
  } catch (error) {
    console.error('❌ [BACKEND-THERMAL] Backend request failed:', error);
    
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
 * Generate thermal QR commands
 */
function generateThermalQRCommands(qrData: string, options: PrintOptions = {}): string {
  console.log('🖨️ [THERMAL-QR] Generating QR commands');
  
  try {
    let qrSize = 8; // Normal size for layout
    if (options.labelSize === 'small') qrSize = 6;
    if (options.labelSize === 'large') qrSize = 10;
    
    // ESC/POS QR Code commands
    const modelCommand = GS + '(k\x04\x00\x31\x41\x32\x00';
    const sizeCommand = GS + '(k\x03\x00\x31\x43' + String.fromCharCode(qrSize);
    const errorCommand = GS + '(k\x03\x00\x31\x45\x31';
    
    const dataLength = qrData.length + 3;
    const storeLowByte = dataLength & 0xFF;
    const storeHighByte = (dataLength >> 8) & 0xFF;
    const storeCommand = GS + '(k' + 
      String.fromCharCode(storeLowByte) + 
      String.fromCharCode(storeHighByte) + 
      '\x31\x50\x30' + qrData;
    
    const printCommand = GS + '(k\x03\x00\x31\x51\x30';
    
    return modelCommand + sizeCommand + errorCommand + storeCommand + printCommand;
    
  } catch (error) {
    console.error('❌ [THERMAL-QR] Failed to generate QR commands:', error);
    throw new Error(`QR command generation failed: ${error}`);
  }
}

/**
 * Get QR data from backend
 */
async function getQRDataForPackage(packageCode: string, options: PrintOptions = {}): Promise<string> {
  console.log('🔍 [QR-DATA] Fetching QR data for package:', packageCode);
  
  try {
    if (options.useBackendThermalQR !== false) {
      const thermalQR = await getThermalQRFromBackend(packageCode);
      
      if (thermalQR.success && thermalQR.data.qr_data) {
        console.log('✅ [QR-DATA] Using backend thermal QR data');
        return thermalQR.data.qr_data;
      }
    }
    
    const qrResponse = await getPackageQRCode(packageCode);
    
    if (qrResponse.success) {
      if (qrResponse.data.tracking_url) {
        return qrResponse.data.tracking_url;
      }
      if (qrResponse.data.qr_code_data) {
        return qrResponse.data.qr_code_data;
      }
      if (qrResponse.data.url) {
        return qrResponse.data.url;
      }
    }
    
  } catch (error) {
    console.warn('⚠️ [QR-DATA] Backend requests failed:', error);
  }
  
  return `https://gltlogistics.co.ke/track/${packageCode}`;
}

/**
 * Clean delivery location
 */
function cleanDeliveryLocation(routeDescription: string, deliveryLocation?: string): string {
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
async function generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
  console.log('📄 [RECEIPT] Generating two-column GLT receipt');
  
  const {
    code,
    receiver_name,
    route_description,
    delivery_location
  } = packageData;

  const cleanLocation = cleanDeliveryLocation(route_description, delivery_location);

  // Get QR commands for positioning
  let qrCommands = '';
  if (options.includeQR !== false) {
    try {
      const qrData = await getQRDataForPackage(code, options);
      qrCommands = generateThermalQRCommands(qrData, options);
    } catch (error) {
      console.error('❌ [RECEIPT] QR generation failed:', error);
    }
  }

  // TWO-COLUMN LAYOUT RECEIPT
  const receipt = 
    // Header - centered
    '\n' +
    CENTER + BOLD_ON + DOUBLE_HEIGHT +
    'GLT LOGISTICS\n' +
    NORMAL_SIZE + 'Fast & Reliable\n' +
    BOLD_OFF + LEFT +
    
    // Two-column section: Left column (CODE, DELIVERY FOR, TO) + Right column (QR)
    '\n' + BOLD_ON + 'CODE:' + BOLD_OFF + '       ' + CENTER + qrCommands + LEFT + '\n' +
    code + '\n' +
    '\n' + BOLD_ON + 'DELIVERY FOR:\n' + BOLD_OFF +
    receiver_name.toUpperCase() + '\n' +
    '\n' + BOLD_ON + 'TO:\n' + BOLD_OFF +
    cleanLocation + '\n' +
    
    // Full-width sections
    '\n' + CENTER + BOLD_ON + 
    'Thank you for choosing\n' +
    'GLT Logistics!\n' +
    'Your package will be\n' +
    'delivered safely.\n' +
    BOLD_OFF +
    
    '\n' + 'Designed by Infinity.Co\n' +
    'www.infinity.co.ke\n\n' +
    LEFT;

  console.log('✅ [RECEIPT] Two-column GLT receipt generated');
  return receipt;
}

/**
 * Check if printing is available
 */
async function isPrintingAvailable(bluetoothContext: BluetoothContextType): Promise<{ available: boolean; reason?: string }> {
  if (!bluetoothContext.isBluetoothAvailable) {
    return { available: false, reason: 'Bluetooth not available' };
  }
  
  if (!bluetoothContext.isPrintReady || !bluetoothContext.connectedPrinter) {
    return { available: false, reason: 'No printer connected' };
  }
  
  return { available: true };
}

/**
 * MAIN EXPORT: Print two-column GLT package receipt
 */
export async function printPackageWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  packageData: PackageData,
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🖨️ [PRINT-MAIN] Starting two-column GLT print');
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    const receiptText = await generateGLTReceipt(packageData, {
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
    console.error('❌ [PRINT-MAIN] Two-column print failed:', error);
    
    const errorMessage = getDetailedErrorMessage(error);
    
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
      errorCode: error.code || 'PRINT_ERROR',
    };
  }
}

/**
 * Test print with two-column formatting
 */
export async function testPrintWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  options: PrintOptions = {}
): Promise<PrintResult> {
  const testPackageData: PackageData = {
    code: 'LAYOUT-' + Date.now().toString().slice(-6),
    receiver_name: 'Test User',
    receiver_phone: '0712 345 678',
    route_description: 'Two-Column Layout → Test Destination',
    delivery_location: 'Test Location',
    payment_status: 'not_paid',
    delivery_type: 'home'
  };
  
  return printPackageWithWorkingQR(bluetoothContext, testPackageData, options);
}

/**
 * Test QR generation only
 */
export async function testQRGeneration(
  bluetoothContext: BluetoothContextType,
  packageCode: string = 'QR-TEST-' + Date.now().toString().slice(-6),
  options: PrintOptions = {}
): Promise<PrintResult> {
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const qrData = await getQRDataForPackage(packageCode, options);
    const qrCommands = generateThermalQRCommands(qrData, options);
    
    const qrTestText = 
      '\n' + CENTER +
      BOLD_ON + 'QR CODE TEST\n' + BOLD_OFF +
      'Package: ' + packageCode + '\n' +
      qrCommands + '\n' +
      'Test completed: ' + new Date().toLocaleTimeString() + '\n\n' +
      LEFT;
    
    await bluetoothContext.printText(qrTestText);
    
    return {
      success: true,
      message: `QR test printed for ${packageCode}`,
      printTime: new Date(),
      printerUsed: bluetoothContext.connectedPrinter.name,
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      errorCode: 'QR_TEST_ERROR',
    };
  }
}

/**
 * Debug backend thermal QR
 */
export async function debugBackendThermalQR(packageCode: string): Promise<{ success: boolean; data: any }> {
  try {
    const thermalQR = await getThermalQRFromBackend(packageCode);
    
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
function getDetailedErrorMessage(error: any): string {
  const message = error.message || error.toString();
  
  if (message.includes('Bluetooth not available')) {
    return 'Bluetooth not available. Use development build.';
  }
  if (message.includes('No printer connected')) {
    return 'Connect printer first.';
  }
  if (message.includes('timed out')) {
    return 'Timeout. Retry in a moment.';
  }
  
  return `Print Error: ${message}`;
}

/**
 * Debug print QR commands
 */
export async function debugPrintQRCommands(
  bluetoothContext: BluetoothContextType,
  qrData: string = 'https://gltlogistics.co.ke/track/TEST-123'
): Promise<PrintResult> {
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const qrCommands = generateThermalQRCommands(qrData, { labelSize: 'medium' });
    
    const debugText = 
      '\n' + CENTER +
      BOLD_ON + 'QR DEBUG TEST\n' + BOLD_OFF +
      'Data: ' + qrData.substring(0, 30) + '...\n' +
      qrCommands +
      '\nDebug time: ' + new Date().toLocaleTimeString() + '\n\n' +
      LEFT;
    
    await bluetoothContext.printText(debugText);
    
    return {
      success: true,
      message: 'Debug QR commands sent to printer',
      printTime: new Date(),
      printerUsed: bluetoothContext.connectedPrinter.name,
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      errorCode: 'DEBUG_ERROR',
    };
  }
}
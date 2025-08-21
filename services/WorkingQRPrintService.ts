// services/WorkingQRPrintService.ts - Enhanced with bold, larger text and clean layout

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
 * Enhanced ESC/POS Commands for bold, large formatting
 */
const ESC = '\x1B';
const GS = '\x1D';

// Enhanced text formatting commands
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const CENTER = ESC + 'a' + '\x01';
const LEFT = ESC + 'a' + '\x00';
const DOUBLE_HEIGHT = GS + '!' + '\x11';
const DOUBLE_WIDTH = GS + '!' + '\x20';
const QUAD_SIZE = GS + '!' + '\x33'; // Double width + double height
const NORMAL_SIZE = GS + '!' + '\x00';
const UNDERLINE_ON = ESC + '-' + '\x01';
const UNDERLINE_OFF = ESC + '-' + '\x00';

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
 * Generate enhanced thermal QR commands
 */
function generateThermalQRCommands(qrData: string, options: PrintOptions = {}): string {
  console.log('🖨️ [THERMAL-QR] Generating enhanced QR commands for:', qrData.substring(0, 50) + '...');
  
  try {
    let qrSize = 10; // Larger default size
    if (options.labelSize === 'small') qrSize = 8;
    if (options.labelSize === 'large') qrSize = 12;
    
    // ESC/POS QR Code commands sequence
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
    
    const fullCommand = modelCommand + sizeCommand + errorCommand + storeCommand + printCommand;
    
    console.log('✅ [THERMAL-QR] Enhanced QR commands generated successfully');
    return fullCommand;
    
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
        console.log('✅ [QR-DATA] Using backend organic QR tracking URL');
        return qrResponse.data.tracking_url;
      }
      
      if (qrResponse.data.qr_code_data) {
        console.log('✅ [QR-DATA] Using backend organic QR data');
        return qrResponse.data.qr_code_data;
      }
      
      if (qrResponse.data.url) {
        console.log('✅ [QR-DATA] Using backend organic URL');
        return qrResponse.data.url;
      }
    }
    
    console.warn('⚠️ [QR-DATA] Backend responses incomplete, using fallback');
    
  } catch (error) {
    console.warn('⚠️ [QR-DATA] Backend requests failed:', error);
  }
  
  const fallbackUrl = `https://gltlogistics.co.ke/track/${packageCode}`;
  console.log('🔄 [QR-DATA] Using fallback URL:', fallbackUrl);
  return fallbackUrl;
}

/**
 * Generate clean QR section without labels
 */
async function generateQRSection(packageCode: string, options: PrintOptions = {}): Promise<string> {
  console.log('📱 [QR-SECTION] Generating clean QR section for:', packageCode);
  
  try {
    let qrCommands = '';
    
    if (options.useBackendThermalQR !== false) {
      console.log('🖨️ [QR-SECTION] Attempting backend thermal QR...');
      
      try {
        const thermalQR = await getThermalQRFromBackend(packageCode);
        
        if (thermalQR.success && thermalQR.data.qr_data) {
          console.log('📱 [QR-SECTION] Using backend thermal QR data');
          qrCommands = generateThermalQRCommands(thermalQR.data.qr_data, options);
        } else {
          throw new Error('Backend thermal QR not available');
        }
      } catch (thermalError) {
        console.warn('⚠️ [QR-SECTION] Backend thermal QR failed, using standard method:', thermalError);
      }
    }
    
    if (!qrCommands) {
      console.log('📱 [QR-SECTION] Using standard QR generation');
      const qrData = await getQRDataForPackage(packageCode, options);
      qrCommands = generateThermalQRCommands(qrData, options);
    }
    
    // Clean QR section without labels
    const qrSection = 
      '\n\n' +
      CENTER +
      qrCommands +
      '\n\n' +
      LEFT;
    
    console.log('✅ [QR-SECTION] Clean QR section generated successfully');
    return qrSection;
    
  } catch (error) {
    console.error('❌ [QR-SECTION] QR section generation failed:', error);
    return '\n\n';
  }
}

/**
 * Clean and format delivery location
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
 * Generate enhanced GLT receipt with bold, large text
 */
async function generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
  console.log('📄 [RECEIPT] Generating enhanced bold GLT receipt for:', packageData.code);
  
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

  const cleanLocation = cleanDeliveryLocation(route_description, delivery_location);
  const paymentText = payment_status === 'paid' ? 'PAID' : 'NOT PAID';

  // Generate clean QR section
  let qrSection = '';
  if (options.includeQR !== false) {
    try {
      console.log('📱 [RECEIPT] Adding clean QR section...');
      qrSection = await generateQRSection(code, {
        ...options,
        useBackendThermalQR: true
      });
    } catch (error) {
      console.error('❌ [RECEIPT] QR section failed:', error);
      qrSection = '\n\n';
    }
  }

  const receipt = 
    '\n' +
    CENTER + BOLD_ON + QUAD_SIZE +
    'GLT LOGISTICS\n' +
    DOUBLE_HEIGHT + 'Fast & Reliable\n' +
    NORMAL_SIZE + BOLD_OFF + '\n' +
    BOLD_ON + DOUBLE_WIDTH + 'Customer Service:\n' +
    '0725 057 210\n' + 
    NORMAL_SIZE + BOLD_OFF +
    'support@gltlogistics.co.ke\n' +
    'www.gltlogistics.co.ke\n\n' +
    BOLD_ON + 'If package is lost, please contact\n' +
    'us immediately with this receipt.\n' +
    BOLD_OFF + '\n' + LEFT +
    
    CENTER + BOLD_ON + QUAD_SIZE + 
    code + '\n' + 
    NORMAL_SIZE + BOLD_OFF + LEFT +
    
    qrSection +
    
    BOLD_ON + DOUBLE_HEIGHT + 'DELIVERY FOR:\n' + 
    NORMAL_SIZE + BOLD_OFF + 
    BOLD_ON + DOUBLE_WIDTH + receiver_name.toUpperCase() + '\n' + 
    NORMAL_SIZE + BOLD_OFF +
    
    (receiver_phone ? 
      BOLD_ON + 'PHONE: ' + receiver_phone + '\n' + BOLD_OFF : '') +
    
    '\n' +
    BOLD_ON + DOUBLE_HEIGHT + 'TO:\n' + 
    NORMAL_SIZE + BOLD_OFF +
    BOLD_ON + DOUBLE_WIDTH + cleanLocation + '\n' + 
    NORMAL_SIZE + BOLD_OFF +
    
    (agent_name ? 
      '\n' + BOLD_ON + 'AGENT: ' + agent_name + '\n' + BOLD_OFF : '') +
    
    '\n' +
    BOLD_ON + DOUBLE_HEIGHT + 'PAYMENT STATUS:\n' + 
    QUAD_SIZE + paymentText + '\n' + 
    NORMAL_SIZE + BOLD_OFF +
    
    '\n' +
    BOLD_ON + 'DATE: ' + dateStr + '\n' + 
    'TIME: ' + timeStr + '\n' + BOLD_OFF +
    
    (packageData.weight ? 
      BOLD_ON + 'WEIGHT: ' + packageData.weight + '\n' + BOLD_OFF : '') +
    (packageData.dimensions ? 
      BOLD_ON + 'DIMENSIONS: ' + packageData.dimensions + '\n' + BOLD_OFF : '') +
    (packageData.special_instructions ? 
      '\n' + BOLD_ON + 'INSTRUCTIONS:\n' + BOLD_OFF + 
      packageData.special_instructions + '\n' : '') +
    
    '\n' +
    CENTER + BOLD_ON + DOUBLE_HEIGHT + 
    'Thank you for choosing\n' +
    'GLT Logistics!\n' +
    NORMAL_SIZE +
    'Your package will be\n' +
    'delivered safely.\n' +
    BOLD_OFF + '\n' +
    
    'Designed by Infinity.Co\n' +
    'www.infinity.co.ke\n\n' +
    
    LEFT + 'Receipt printed: ' + dateStr + ' ' + timeStr + '\n\n';

  console.log('✅ [RECEIPT] Enhanced bold GLT receipt generated successfully');
  return receipt;
}

/**
 * Check if printing is available
 */
async function isPrintingAvailable(bluetoothContext: BluetoothContextType): Promise<{ available: boolean; reason?: string }> {
  console.log('🔍 [PRINT-CHECK] Checking printing availability...');
  
  try {
    if (!bluetoothContext.isBluetoothAvailable) {
      return { available: false, reason: 'Bluetooth not available in this environment (Expo Go)' };
    }
    
    if (!bluetoothContext.isPrintReady || !bluetoothContext.connectedPrinter) {
      return { available: false, reason: 'No printer connected' };
    }
    
    console.log('✅ [PRINT-CHECK] Printing is available');
    return { available: true };
    
  } catch (error: any) {
    console.error('❌ [PRINT-CHECK] Error checking availability:', error);
    return { available: false, reason: `System error: ${error.message}` };
  }
}

/**
 * MAIN EXPORT: Print GLT package with enhanced bold formatting
 */
export async function printPackageWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  packageData: PackageData,
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🖨️ [PRINT-MAIN] Starting enhanced bold GLT print for:', packageData.code);
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    console.log('📄 [PRINT-MAIN] Generating enhanced bold receipt...');
    const receiptText = await generateGLTReceipt(packageData, {
      ...options,
      useBackendThermalQR: true
    });
    
    console.log('🖨️ [PRINT-MAIN] Sending to printer...');
    await bluetoothContext.printText(receiptText);
    
    console.log('✅ [PRINT-MAIN] Enhanced bold print completed successfully');
    
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
    console.error('❌ [PRINT-MAIN] Enhanced bold print failed:', error);
    
    const errorMessage = getDetailedErrorMessage(error);
    
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
      errorCode: error.code || 'PRINT_ERROR',
    };
  }
}

/**
 * Test print with enhanced bold formatting
 */
export async function testPrintWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🧪 [TEST-PRINT] Running enhanced bold test print...');
  
  const testPackageData: PackageData = {
    code: 'BOLD-' + Date.now().toString().slice(-6) + '-TEST',
    receiver_name: 'Enhanced Bold Test User',
    receiver_phone: '0712 345 678',
    route_description: 'Bold Format → Test Destination',
    delivery_location: 'Test Location',
    payment_status: 'not_paid',
    delivery_type: 'home',
    weight: '1kg',
    dimensions: '20x15x10 cm',
    special_instructions: 'Testing enhanced bold formatting',
    agent_name: 'Bold Test Agent'
  };
  
  return printPackageWithWorkingQR(bluetoothContext, testPackageData, {
    ...options,
    useBackendThermalQR: true
  });
}

/**
 * Test QR generation only
 */
export async function testQRGeneration(
  bluetoothContext: BluetoothContextType,
  packageCode: string = 'BOLD-QR-' + Date.now().toString().slice(-6),
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🔲 [QR-TEST] Testing enhanced QR generation for:', packageCode);
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    const qrSection = await generateQRSection(packageCode, {
      ...options,
      useBackendThermalQR: true
    });
    
    const qrTestText = 
      '\n\n' +
      CENTER +
      BOLD_ON + DOUBLE_HEIGHT + 'QR CODE TEST\n' + 
      NORMAL_SIZE + BOLD_OFF +
      'Package: ' + packageCode + '\n' +
      qrSection +
      'Test completed: ' + new Date().toLocaleTimeString() + '\n' +
      '\n\n' +
      LEFT;
    
    await bluetoothContext.printText(qrTestText);
    
    console.log('✅ [QR-TEST] Enhanced QR test printed successfully');
    
    Toast.show({
      type: 'success',
      text1: '🔲 Enhanced QR Test Printed',
      text2: `Clean QR test sent to ${printer.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
    
    return {
      success: true,
      message: `Enhanced QR test printed successfully for ${packageCode}`,
      printTime,
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [QR-TEST] Enhanced QR test failed:', error);
    
    const errorMessage = getDetailedErrorMessage(error);
    
    Toast.show({
      type: 'error',
      text1: '❌ Enhanced QR Test Failed',
      text2: errorMessage,
      position: 'top',
      visibilityTime: 5000,
    });
    
    return {
      success: false,
      message: errorMessage,
      errorCode: error.code || 'QR_TEST_ERROR',
    };
  }
}

/**
 * Debug backend thermal QR connection
 */
export async function debugBackendThermalQR(packageCode: string): Promise<{ success: boolean; data: any }> {
  console.log('🔧 [DEBUG-BACKEND] Testing backend thermal QR connection for:', packageCode);
  
  try {
    const thermalQR = await getThermalQRFromBackend(packageCode);
    
    const debugInfo = {
      success: thermalQR.success,
      qrType: thermalQR.data.qr_type,
      hasImage: !!thermalQR.data.thermal_qr_base64,
      qrDataLength: thermalQR.data.qr_data?.length || 0,
      thermalOptimized: thermalQR.data.thermal_optimized || false,
      error: thermalQR.error,
      packageCode: thermalQR.data.package_code
    };
    
    console.log('📊 [DEBUG-BACKEND] Backend response:', debugInfo);
    
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
    console.error('❌ [DEBUG-BACKEND] Backend debug failed:', error);
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
  if (message.includes('not available in this environment')) {
    return 'Not available in Expo Go. Use development build.';
  }
  if (message.includes('No printer connected')) {
    return 'Connect printer in Settings → Bluetooth first.';
  }
  if (message.includes('Printer disconnected')) {
    return 'Connection lost. Turn on printer and reconnect.';
  }
  if (message.includes('timed out')) {
    return 'Timeout. Printer may be busy - retry in a moment.';
  }
  if (message.includes('Device not found')) {
    return 'Printer not found. Check if printer is on and paired.';
  }
  if (message.includes('Connection lost')) {
    return 'Connection lost during operation. Reconnect and retry.';
  }
  if (message.includes('QR command generation failed')) {
    return 'QR generation failed. Using text fallback.';
  }
  
  return `Print Error: ${message}`;
}

/**
 * Debug function to print raw QR commands for testing
 */
export async function debugPrintQRCommands(
  bluetoothContext: BluetoothContextType,
  qrData: string = 'https://gltlogistics.co.ke/track/TEST-123'
): Promise<PrintResult> {
  console.log('🔧 [DEBUG-QR] Debugging raw QR commands...');
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    
    const qrCommands = generateThermalQRCommands(qrData, { labelSize: 'medium' });
    
    const debugText = 
      '\n' +
      CENTER +
      BOLD_ON + DOUBLE_HEIGHT + 'QR DEBUG TEST\n' + 
      NORMAL_SIZE + BOLD_OFF +
      'Data: ' + qrData.substring(0, 30) + '...\n' +
      qrCommands +
      '\n' +
      'Debug time: ' + new Date().toLocaleTimeString() + '\n' +
      '\n' +
      LEFT;
    
    await bluetoothContext.printText(debugText);
    
    console.log('✅ [DEBUG-QR] Enhanced debug QR printed');
    
    return {
      success: true,
      message: 'Enhanced debug QR commands sent to printer',
      printTime: new Date(),
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [DEBUG-QR] Enhanced debug failed:', error);
    return {
      success: false,
      message: error.message,
      errorCode: 'DEBUG_ERROR',
    };
  }
}
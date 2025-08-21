// services/WorkingQRPrintService.ts - Simplified for text-based thermal printers

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
 * Generate proper ESC/POS QR commands for thermal printers
 */
function generateThermalQRCommands(qrData: string, options: PrintOptions = {}): string {
  console.log('🖨️ [THERMAL-QR] Generating ESC/POS QR commands for:', qrData.substring(0, 50) + '...');
  
  try {
    // Determine QR size based on options
    let qrSize = 8; // Default module size
    if (options.labelSize === 'small') qrSize = 6;
    if (options.labelSize === 'large') qrSize = 10;
    
    // ESC/POS QR Code commands sequence
    console.log('📐 [THERMAL-QR] Using QR module size:', qrSize);
    
    // Step 1: Set QR Code model (Model 2 is standard)
    const modelCommand = GS + '(k\x04\x00\x31\x41\x32\x00';
    
    // Step 2: Set module size
    const sizeCommand = GS + '(k\x03\x00\x31\x43' + String.fromCharCode(qrSize);
    
    // Step 3: Set error correction level (L = 7%, M = 15%, Q = 25%, H = 30%)
    const errorCommand = GS + '(k\x03\x00\x31\x45\x31'; // Level L for better readability
    
    // Step 4: Store QR data
    const dataLength = qrData.length + 3;
    const storeLowByte = dataLength & 0xFF;
    const storeHighByte = (dataLength >> 8) & 0xFF;
    const storeCommand = GS + '(k' + 
      String.fromCharCode(storeLowByte) + 
      String.fromCharCode(storeHighByte) + 
      '\x31\x50\x30' + qrData;
    
    // Step 5: Print QR code
    const printCommand = GS + '(k\x03\x00\x31\x51\x30';
    
    // Combine all commands
    const fullCommand = modelCommand + sizeCommand + errorCommand + storeCommand + printCommand;
    
    console.log('✅ [THERMAL-QR] ESC/POS QR commands generated successfully');
    console.log('📊 [THERMAL-QR] Command length:', fullCommand.length, 'bytes');
    
    return fullCommand;
    
  } catch (error) {
    console.error('❌ [THERMAL-QR] Failed to generate QR commands:', error);
    throw new Error(`QR command generation failed: ${error}`);
  }
}

/**
 * Get QR data from backend or use fallback
 */
async function getQRDataForPackage(packageCode: string): Promise<string> {
  console.log('🔍 [QR-DATA] Fetching QR data for package:', packageCode);
  
  try {
    // Try to get QR data from backend
    const qrResponse = await getPackageQRCode(packageCode);
    
    if (qrResponse.success) {
      // Check for tracking URL first
      if (qrResponse.data.tracking_url) {
        console.log('✅ [QR-DATA] Using backend tracking URL');
        return qrResponse.data.tracking_url;
      }
      
      // Check for QR code data
      if (qrResponse.data.qr_code_data) {
        console.log('✅ [QR-DATA] Using backend QR data');
        return qrResponse.data.qr_code_data;
      }
      
      // Check for any URL in the response
      if (qrResponse.data.url) {
        console.log('✅ [QR-DATA] Using backend URL');
        return qrResponse.data.url;
      }
    }
    
    console.warn('⚠️ [QR-DATA] Backend response incomplete, using fallback');
    
  } catch (error) {
    console.warn('⚠️ [QR-DATA] Backend request failed:', error);
  }
  
  // Fallback to standard tracking URL
  const fallbackUrl = `https://gltlogistics.co.ke/track/${packageCode}`;
  console.log('🔄 [QR-DATA] Using fallback URL:', fallbackUrl);
  return fallbackUrl;
}

/**
 * Generate QR code section for thermal printer
 */
async function generateQRSection(packageCode: string, options: PrintOptions = {}): Promise<string> {
  console.log('📱 [QR-SECTION] Generating QR section for:', packageCode);
  
  try {
    // Get QR data (from backend or fallback)
    const qrData = await getQRDataForPackage(packageCode);
    
    // Generate thermal printer QR commands
    const qrCommands = generateThermalQRCommands(qrData, options);
    
    // Create complete QR section
    const qrSection = 
      '\n' +
      CENTER +
      '- QR Code for Tracking -\n' +
      qrCommands +
      '\n' +
      'Scan to track your package\n' +
      '\n' +
      LEFT;
    
    console.log('✅ [QR-SECTION] QR section generated successfully');
    return qrSection;
    
  } catch (error) {
    console.error('❌ [QR-SECTION] QR section generation failed:', error);
    // Return text-only fallback
    return generateTextQRFallback(packageCode);
  }
}

/**
 * Generate text-only QR fallback
 */
function generateTextQRFallback(packageCode: string): string {
  console.log('🔤 [TEXT-FALLBACK] Generating text-only QR fallback');
  
  return '\n' + CENTER + 
         '- Package Tracking -\n' +
         'Package: ' + packageCode + '\n' +
         'Track at: gltlogistics.co.ke\n' +
         'Or call: 0725 057 210\n' +
         '\n' + LEFT;
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
 * Generate complete GLT receipt with working QR
 */
async function generateGLTReceipt(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
  console.log('📄 [RECEIPT] Generating GLT receipt for:', packageData.code);
  
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

  // Generate QR section
  let qrSection = '';
  if (options.includeQR !== false) {
    try {
      console.log('📱 [RECEIPT] Adding QR section...');
      qrSection = await generateQRSection(code, options);
    } catch (error) {
      console.error('❌ [RECEIPT] QR section failed:', error);
      qrSection = generateTextQRFallback(code);
    }
  }

  const receipt = 
    CENTER + BOLD_ON + DOUBLE_HEIGHT +
    'GLT LOGISTICS\n' +
    NORMAL_SIZE + 'Fast & Reliable\n' +
    BOLD_OFF + LEFT +
    '================================\n' +
    BOLD_ON + 'Customer Service: 0725 057 210\n' + BOLD_OFF +
    'support@gltlogistics.co.ke\n' +
    'www.gltlogistics.co.ke\n\n' +
    'If package is lost, please contact\n' +
    'us immediately with this receipt.\n' +
    '================================\n' +
    CENTER + BOLD_ON + DOUBLE_HEIGHT + code + '\n' + NORMAL_SIZE + BOLD_OFF + LEFT +
    '================================\n' +
    qrSection +
    '================================\n' +
    BOLD_ON + 'DELIVERY FOR: ' + receiver_name.toUpperCase() + '\n' + BOLD_OFF +
    (receiver_phone ? BOLD_ON + 'Phone: ' + receiver_phone + '\n' + BOLD_OFF : '') +
    BOLD_ON + 'TO: ' + cleanLocation + '\n' + BOLD_OFF +
    (agent_name ? BOLD_ON + 'Agent: ' + agent_name + '\n' + BOLD_OFF : '') +
    '--------------------------------\n' +
    BOLD_ON + 'Payment Status: ' + paymentText + '\n' + BOLD_OFF +
    BOLD_ON + 'Date: ' + dateStr + '\n' + BOLD_OFF +
    BOLD_ON + 'Time: ' + timeStr + '\n' + BOLD_OFF +
    (packageData.weight ? BOLD_ON + 'Weight: ' + packageData.weight + '\n' + BOLD_OFF : '') +
    (packageData.dimensions ? BOLD_ON + 'Dimensions: ' + packageData.dimensions + '\n' + BOLD_OFF : '') +
    (packageData.special_instructions ? 'Instructions: ' + packageData.special_instructions + '\n' : '') +
    '================================\n' +
    CENTER + BOLD_ON + 
    'Thank you for choosing GLT Logistics!\n' +
    'Your package will be delivered safely.\n' +
    BOLD_OFF +
    '================================\n' +
    'Designed by Infinity.Co\n' +
    'www.infinity.co.ke\n' +
    '--------------------------------\n' +
    LEFT + 'Receipt printed: ' + dateStr + ' ' + timeStr + '\n';

  console.log('✅ [RECEIPT] GLT receipt generated successfully');
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
 * MAIN EXPORT: Print GLT package with working QR code
 */
export async function printPackageWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  packageData: PackageData,
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🖨️ [PRINT-MAIN] Starting GLT print with working QR for:', packageData.code);
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    console.log('📄 [PRINT-MAIN] Generating receipt...');
    const receiptText = await generateGLTReceipt(packageData, options);
    
    console.log('🖨️ [PRINT-MAIN] Sending to printer...');
    await bluetoothContext.printText(receiptText);
    
    console.log('✅ [PRINT-MAIN] Print completed successfully');
    
    Toast.show({
      type: 'success',
      text1: '📦 GLT Receipt Printed',
      text2: `Package ${packageData.code} with QR code sent to ${printer.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
    
    return {
      success: true,
      message: `GLT receipt with working QR printed for ${packageData.code}`,
      printTime,
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [PRINT-MAIN] Print failed:', error);
    
    const errorMessage = getDetailedErrorMessage(error);
    
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
      errorCode: error.code || 'PRINT_ERROR',
    };
  }
}

/**
 * Test print with working QR
 */
export async function testPrintWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🧪 [TEST-PRINT] Running test print with working QR...');
  
  const testPackageData: PackageData = {
    code: 'TEST-' + Date.now().toString().slice(-6) + '-QR',
    receiver_name: 'Test Receiver',
    receiver_phone: '0712 345 678',
    route_description: 'Test Route → Test Destination',
    delivery_location: 'Test Location',
    payment_status: 'not_paid',
    delivery_type: 'home',
    weight: '1kg',
    dimensions: '20x15x10 cm',
    special_instructions: 'Test QR code functionality',
    agent_name: 'Test Agent'
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
  console.log('🔲 [QR-TEST] Testing QR generation for:', packageCode);
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    // Generate QR section only
    const qrSection = await generateQRSection(packageCode, options);
    
    const qrTestText = 
      '\n\n' +
      CENTER +
      BOLD_ON + 'QR CODE TEST\n' + BOLD_OFF +
      'Package: ' + packageCode + '\n' +
      qrSection +
      'Test completed: ' + new Date().toLocaleTimeString() + '\n' +
      '\n\n' +
      LEFT;
    
    await bluetoothContext.printText(qrTestText);
    
    console.log('✅ [QR-TEST] QR test printed successfully');
    
    Toast.show({
      type: 'success',
      text1: '🔲 QR Test Printed',
      text2: `QR code test sent to ${printer.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
    
    return {
      success: true,
      message: `QR test printed successfully for ${packageCode}`,
      printTime,
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [QR-TEST] QR test failed:', error);
    
    const errorMessage = getDetailedErrorMessage(error);
    
    Toast.show({
      type: 'error',
      text1: '❌ QR Test Failed',
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
    
    // Generate QR commands
    const qrCommands = generateThermalQRCommands(qrData, { labelSize: 'medium' });
    
    const debugText = 
      '\n' +
      CENTER +
      BOLD_ON + 'QR DEBUG TEST\n' + BOLD_OFF +
      'Data: ' + qrData.substring(0, 30) + '...\n' +
      '--- QR SHOULD APPEAR BELOW ---\n' +
      qrCommands +
      '\n--- QR SHOULD APPEAR ABOVE ---\n' +
      'Debug time: ' + new Date().toLocaleTimeString() + '\n' +
      '\n' +
      LEFT;
    
    await bluetoothContext.printText(debugText);
    
    console.log('✅ [DEBUG-QR] Debug QR printed');
    
    return {
      success: true,
      message: 'Debug QR commands sent to printer',
      printTime: new Date(),
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [DEBUG-QR] Debug failed:', error);
    return {
      success: false,
      message: error.message,
      errorCode: 'DEBUG_ERROR',
    };
  }
}
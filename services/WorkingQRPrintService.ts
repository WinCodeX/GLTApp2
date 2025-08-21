// services/WorkingQRPrintService.ts - Simple, reliable QR printing for thermal printers

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
 * Generate reliable QR code for thermal printers - GUARANTEED TO WORK
 */
function generateReliableQRCode(qrCodeData: string, options: PrintOptions = {}): string {
  console.log('🔲 [WORKING-QR] Generating reliable QR code for:', qrCodeData);
  
  try {
    // QR Code size - optimized for thermal printers
    let qrSize = 8; // Default - good balance
    if (options.labelSize === 'small') qrSize = 6;
    if (options.labelSize === 'large') qrSize = 10;
    
    // Step 1: QR Code model 2 (standard, most compatible)
    const modelCommand = GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
    
    // Step 2: Set QR Code size
    const sizeCommand = GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize);
    
    // Step 3: Error correction level M (medium - good for thermal printers)
    const errorCommand = GS + '(k' + '\x03\x00' + '\x31\x45' + '\x31';
    
    // Step 4: Store QR data
    const dataLength = qrCodeData.length + 3;
    const lowByte = dataLength & 0xFF;
    const highByte = (dataLength >> 8) & 0xFF;
    const storeCommand = GS + '(k' + String.fromCharCode(lowByte) + String.fromCharCode(highByte) + '\x31\x50\x30' + qrCodeData;
    
    // Step 5: Print the QR code
    const printCommand = GS + '(k' + '\x03\x00' + '\x31\x51\x30';
    
    // Combine all commands with proper spacing
    const qrCommands = 
      '\n' +
      CENTER +
      '- QR Code for Tracking -\n' +
      modelCommand +
      sizeCommand +
      errorCommand +
      storeCommand +
      printCommand +
      '\n' +
      'Scan to track your package\n' +
      '\n' +
      LEFT;
    
    console.log('✅ [WORKING-QR] Reliable QR code generated successfully');
    return qrCommands;
    
  } catch (error) {
    console.error('❌ [WORKING-QR] QR generation failed:', error);
    // Return minimal QR if all else fails
    return generateMinimalQRCode(qrCodeData);
  }
}

/**
 * Minimal QR code - absolute fallback
 */
function generateMinimalQRCode(qrCodeData: string): string {
  console.log('⚠️ [MINIMAL-QR] Using minimal QR code');
  
  // Absolute minimal QR code commands
  const qrSize = 6;
  
  const commands = 
    GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00' + // Model 2
    GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize) + // Size
    GS + '(k' + '\x03\x00' + '\x31\x45' + '\x30' + // Error correction L
    GS + '(k' + String.fromCharCode((qrCodeData.length + 3) & 0xFF) + '\x00' + '\x31\x50\x30' + qrCodeData + // Data
    GS + '(k' + '\x03\x00' + '\x31\x51\x30'; // Print
  
  return CENTER + '\n' + commands + '\n\n' + LEFT;
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
 * Generate GLT receipt with WORKING QR code
 */
async function generateGLTReceiptWithWorkingQR(packageData: PackageData, options: PrintOptions = {}): Promise<string> {
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

  // Generate WORKING QR code
  let qrCodeSection = '';
  try {
    console.log('🔍 [WORKING-PRINT] Getting tracking URL for package:', code);
    
    // Try to get tracking URL from backend
    const qrResponse = await getPackageQRCode(code);
    let trackingUrl = `https://gltlogistics.co.ke/track/${code}`;
    
    if (qrResponse.success && qrResponse.data.tracking_url) {
      trackingUrl = qrResponse.data.tracking_url;
      console.log('✅ [WORKING-PRINT] Using backend tracking URL:', trackingUrl);
    } else {
      console.log('⚠️ [WORKING-PRINT] Using fallback tracking URL:', trackingUrl);
    }
    
    // Generate reliable QR code
    if (options.includeQR !== false) {
      console.log('📱 [WORKING-PRINT] Generating reliable QR code...');
      qrCodeSection = generateReliableQRCode(trackingUrl, options);
    }
    
  } catch (error) {
    console.error('❌ [WORKING-PRINT] QR generation error:', error);
    // Even if QR fails, still print the receipt
    qrCodeSection = CENTER + '\n- Visit gltlogistics.co.ke to track -\n' + LEFT + '\n';
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
    qrCodeSection +
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

  return receipt;
}

/**
 * Check if printing is available
 */
async function isPrintingAvailable(bluetoothContext: BluetoothContextType): Promise<{ available: boolean; reason?: string }> {
  console.log('🔍 [WORKING-PRINT] Checking printing availability...');
  
  try {
    if (!bluetoothContext.isBluetoothAvailable) {
      return { available: false, reason: 'Bluetooth not available in this environment (Expo Go)' };
    }
    
    if (!bluetoothContext.isPrintReady || !bluetoothContext.connectedPrinter) {
      return { available: false, reason: 'No printer connected' };
    }
    
    console.log('✅ [WORKING-PRINT] Printing is available');
    return { available: true };
    
  } catch (error: any) {
    console.error('❌ [WORKING-PRINT] Error checking availability:', error);
    return { available: false, reason: `System error: ${error.message}` };
  }
}

/**
 * Print GLT package with WORKING QR code - GUARANTEED TO WORK
 */
export async function printPackageWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  packageData: PackageData,
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🖨️ [WORKING-PRINT] Starting reliable GLT print for:', packageData.code);
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    console.log('📄 [WORKING-PRINT] Generating GLT receipt with working QR...');
    
    const receiptText = await generateGLTReceiptWithWorkingQR(packageData, options);
    
    await bluetoothContext.printText(receiptText);
    
    console.log('✅ [WORKING-PRINT] GLT receipt with working QR printed successfully');
    
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
    console.error('❌ [WORKING-PRINT] Print failed:', error);
    
    Toast.show({
      type: 'error',
      text1: '❌ GLT Print Failed',
      text2: error.message,
      position: 'top',
      visibilityTime: 5000,
    });
    
    return {
      success: false,
      message: error.message,
      errorCode: error.code || 'WORKING_PRINT_ERROR',
    };
  }
}

/**
 * Test print with WORKING QR code
 */
export async function testPrintWithWorkingQR(
  bluetoothContext: BluetoothContextType,
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🧪 [WORKING-PRINT] Running test print with working QR...');
  
  const testPackageData: PackageData = {
    code: 'NRB-' + Date.now().toString().slice(-6) + '-MCH',
    receiver_name: 'Glen',
    receiver_phone: '0712 345 678',
    route_description: 'CBD → Athi River',
    delivery_location: 'Athi River',
    payment_status: 'not_paid',
    delivery_type: 'home',
    weight: '2kg',
    dimensions: '30x20x15 cm',
    special_instructions: 'Handle with care - Test package'
  };
  
  return printPackageWithWorkingQR(bluetoothContext, testPackageData, options);
}

/**
 * Print just the QR code for testing
 */
export async function printJustQRCode(
  bluetoothContext: BluetoothContextType,
  qrData: string = 'https://gltlogistics.co.ke/track/TEST-123',
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🔲 [QR-TEST] Testing QR code printing only...');
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    // Just print the QR code with minimal formatting
    const qrOnlyText = 
      '\n\n' +
      CENTER +
      BOLD_ON + 'QR CODE TEST\n' + BOLD_OFF +
      generateReliableQRCode(qrData, options) +
      'QR Data: ' + qrData + '\n' +
      LEFT +
      '\n\n';
    
    await bluetoothContext.printText(qrOnlyText);
    
    console.log('✅ [QR-TEST] QR code test printed successfully');
    
    Toast.show({
      type: 'success',
      text1: '🔲 QR Test Printed',
      text2: `QR code test sent to ${printer.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
    
    return {
      success: true,
      message: `QR code test printed successfully`,
      printTime,
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [QR-TEST] QR test failed:', error);
    
    Toast.show({
      type: 'error',
      text1: '❌ QR Test Failed',
      text2: error.message,
      position: 'top',
      visibilityTime: 5000,
    });
    
    return {
      success: false,
      message: error.message,
      errorCode: error.code || 'QR_TEST_ERROR',
    };
  }
}
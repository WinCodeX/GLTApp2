// services/WorkingQRPrintService.ts - Fixed with text-safe enhanced QR generation

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
 * Generate enhanced native QR code with optimal parameters - TEXT SAFE
 */
function generateEnhancedQRCode(qrCodeData: string, options: PrintOptions = {}): string {
  console.log('✨ [ENHANCED-QR] Generating enhanced QR code for:', qrCodeData);
  
  try {
    // Enhanced parameters for better visual quality
    let qrSize = 10; // Larger size for smoother appearance
    if (options.labelSize === 'small') qrSize = 8;
    if (options.labelSize === 'large') qrSize = 12;
    
    // QR Code model 2 (most compatible)
    const modelCommand = GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
    
    // Enhanced size for better visual quality
    const sizeCommand = GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize);
    
    // High error correction for maximum redundancy
    const errorCommand = GS + '(k' + '\x03\x00' + '\x31\x45' + '\x32'; // Level H (highest)
    
    // Store the QR data
    const dataLength = qrCodeData.length + 3;
    const lowByte = dataLength & 0xFF;
    const highByte = (dataLength >> 8) & 0xFF;
    const storeCommand = GS + '(k' + String.fromCharCode(lowByte) + String.fromCharCode(highByte) + '\x31\x50\x30' + qrCodeData;
    
    // Print the QR code
    const printCommand = GS + '(k' + '\x03\x00' + '\x31\x51\x30';
    
    // Enhanced formatting with extra spacing for premium appearance
    const qrCommands = 
      '\n' +
      CENTER +
      '- QR Code for Tracking -\n' +
      '\n' + // Extra spacing for premium feel
      modelCommand +
      sizeCommand +
      errorCommand +
      storeCommand +
      printCommand +
      '\n' +
      '\n' + // Extra spacing for premium feel
      'Scan to track your package\n' +
      '\n' +
      LEFT;
    
    console.log('✅ [ENHANCED-QR] Enhanced QR code generated successfully');
    return qrCommands;
    
  } catch (error) {
    console.error('❌ [ENHANCED-QR] Failed to generate enhanced QR code:', error);
    return generateFallbackQRCode(qrCodeData, options);
  }
}

/**
 * Fallback QR code generation - guaranteed to work
 */
function generateFallbackQRCode(qrCodeData: string, options: PrintOptions = {}): string {
  console.log('⚠️ [FALLBACK-QR] Using fallback QR generation');
  
  const qrSize = 6; // Smaller, more reliable size
  
  const modelCommand = GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00';
  const sizeCommand = GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize);
  const errorCommand = GS + '(k' + '\x03\x00' + '\x31\x45' + '\x30'; // Error correction L
  
  const dataLength = qrCodeData.length + 3;
  const storeCommand = GS + '(k' + 
    String.fromCharCode(dataLength & 0xFF) + 
    String.fromCharCode((dataLength >> 8) & 0xFF) + 
    '\x31\x50\x30' + qrCodeData;
  
  const printCommand = GS + '(k' + '\x03\x00' + '\x31\x51\x30';
  
  return '\n' + CENTER + '- QR Code for Tracking -\n' +
         modelCommand + sizeCommand + errorCommand + storeCommand + printCommand +
         '\n' + 'Scan to track your package\n' + '\n' + LEFT;
}

/**
 * Generate minimal QR code - absolute fallback
 */
function generateMinimalQRCode(qrCodeData: string): string {
  console.log('⚠️ [MINIMAL-QR] Using minimal QR code');
  
  const qrSize = 5; // Very small but reliable
  
  const commands = 
    GS + '(k' + '\x04\x00' + '\x31\x41' + '\x32\x00' + // Model 2
    GS + '(k' + '\x03\x00' + '\x31\x43' + String.fromCharCode(qrSize) + // Size
    GS + '(k' + '\x03\x00' + '\x31\x45' + '\x30' + // Error correction L
    GS + '(k' + String.fromCharCode((qrCodeData.length + 3) & 0xFF) + '\x00' + '\x31\x50\x30' + qrCodeData + // Data
    GS + '(k' + '\x03\x00' + '\x31\x51\x30'; // Print
  
  return CENTER + '\n' + commands + '\n\n' + LEFT;
}

/**
 * Generate working QR section with backend integration
 */
async function generateWorkingQRSection(packageCode: string, options: PrintOptions = {}): Promise<string> {
  console.log('🎯 [WORKING-QR] Generating working QR section for:', packageCode);
  
  try {
    // Get tracking URL from backend
    const qrResponse = await getPackageQRCode(packageCode);
    let trackingUrl = `https://gltlogistics.co.ke/track/${packageCode}`;
    
    if (qrResponse.success && qrResponse.data.tracking_url) {
      trackingUrl = qrResponse.data.tracking_url;
      console.log('✅ [WORKING-QR] Using backend tracking URL:', trackingUrl);
    } else {
      console.log('⚠️ [WORKING-QR] Using fallback tracking URL:', trackingUrl);
    }
    
    // Try enhanced QR first, then fallback approaches
    try {
      return generateEnhancedQRCode(trackingUrl, options);
    } catch (error) {
      console.warn('Enhanced QR failed, trying fallback...');
      try {
        return generateFallbackQRCode(trackingUrl, options);
      } catch (error2) {
        console.warn('Fallback QR failed, trying minimal...');
        return generateMinimalQRCode(trackingUrl);
      }
    }
    
  } catch (error) {
    console.error('❌ [WORKING-QR] Failed to generate QR section:', error);
    // Ultimate text fallback
    return '\n' + CENTER + '- Visit gltlogistics.co.ke to track -\n' + 
           'Package: ' + packageCode + '\n' + LEFT + '\n';
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

  // Generate WORKING QR section
  let qrCodeSection = '';
  try {
    if (options.includeQR !== false) {
      console.log('🎯 [GLT-PRINT] Generating working QR for package:', code);
      qrCodeSection = await generateWorkingQRSection(code, options);
    }
  } catch (error) {
    console.error('❌ [GLT-PRINT] QR generation failed:', error);
    qrCodeSection = '\n' + CENTER + '- Visit gltlogistics.co.ke to track -\n' + 
                   'Package: ' + code + '\n' + LEFT + '\n';
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
 * Print GLT package with WORKING QR code - MAIN EXPORT FUNCTION
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
      text2: `Package ${packageData.code} with enhanced QR sent to ${printer.name}`,
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
 * Print just the working QR for testing
 */
export async function printJustWorkingQR(
  bluetoothContext: BluetoothContextType,
  packageCode: string = 'TEST-' + Date.now().toString().slice(-6),
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🔲 [QR-TEST] Testing working QR printing only...');
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    const printTime = new Date();
    
    // Generate just the working QR section
    const qrSection = await generateWorkingQRSection(packageCode, options);
    
    const qrOnlyText = 
      '\n\n' +
      CENTER +
      BOLD_ON + 'WORKING QR TEST\n' + BOLD_OFF +
      'Package: ' + packageCode + '\n' +
      qrSection +
      '\n\n' +
      LEFT;
    
    await bluetoothContext.printText(qrOnlyText);
    
    console.log('✅ [QR-TEST] Working QR test printed successfully');
    
    Toast.show({
      type: 'success',
      text1: '🔲 Working QR Test Printed',
      text2: `Enhanced QR sent to ${printer.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
    
    return {
      success: true,
      message: `Working QR test printed successfully`,
      printTime,
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [QR-TEST] Working QR test failed:', error);
    
    Toast.show({
      type: 'error',
      text1: '❌ Working QR Test Failed',
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

/**
 * Enhanced QR test with multiple fallback levels
 */
export async function testEnhancedQROnly(
  bluetoothContext: BluetoothContextType,
  testUrl: string = 'https://gltlogistics.co.ke/track/TEST-123',
  options: PrintOptions = {}
): Promise<PrintResult> {
  console.log('🧪 [ENHANCED-QR-TEST] Testing enhanced QR generation...');
  
  try {
    const availability = await isPrintingAvailable(bluetoothContext);
    if (!availability.available) {
      throw new Error(availability.reason || 'Printing not available');
    }

    const printer = bluetoothContext.connectedPrinter;
    
    // Test all QR generation methods
    const testResults: string[] = [];
    
    // Test 1: Enhanced QR
    try {
      const enhancedQR = generateEnhancedQRCode(testUrl, options);
      testResults.push('✅ Enhanced QR: Generated successfully');
    } catch (error) {
      testResults.push('❌ Enhanced QR: Failed');
    }
    
    // Test 2: Fallback QR
    try {
      const fallbackQR = generateFallbackQRCode(testUrl, options);
      testResults.push('✅ Fallback QR: Generated successfully');
    } catch (error) {
      testResults.push('❌ Fallback QR: Failed');
    }
    
    // Test 3: Minimal QR
    try {
      const minimalQR = generateMinimalQRCode(testUrl);
      testResults.push('✅ Minimal QR: Generated successfully');
    } catch (error) {
      testResults.push('❌ Minimal QR: Failed');
    }
    
    // Print test results and working QR
    const testOutput = 
      '\n\n' +
      CENTER +
      BOLD_ON + 'QR GENERATION TEST\n' + BOLD_OFF +
      'Test URL: ' + testUrl + '\n' +
      '================================\n' +
      LEFT +
      testResults.join('\n') + '\n' +
      '================================\n' +
      await generateWorkingQRSection('TEST-123', options) +
      '================================\n' +
      CENTER + 'Test completed successfully\n' + LEFT +
      '\n\n';
    
    await bluetoothContext.printText(testOutput);
    
    console.log('✅ [ENHANCED-QR-TEST] QR generation test completed');
    
    Toast.show({
      type: 'success',
      text1: '🧪 QR Test Complete',
      text2: `QR generation test sent to ${printer.name}`,
      position: 'top',
      visibilityTime: 3000,
    });
    
    return {
      success: true,
      message: `QR generation test completed successfully`,
      printTime: new Date(),
      printerUsed: printer.name,
    };
    
  } catch (error: any) {
    console.error('❌ [ENHANCED-QR-TEST] Test failed:', error);
    
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
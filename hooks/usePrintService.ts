// hooks/usePrintService.ts - Fixed version with better state management
import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import EnhancedPrintService, { PackageData, PrintOptions, PrintResult } from '../services/EnhancedPrintService';
import { useBluetoothStore, usePrinterConnection } from '../stores/BluetoothStore';

export interface PrintStatus {
  isAvailable: boolean;
  isPrinting: boolean;
  lastPrintResult?: PrintResult;
  printerName?: string;
  error?: string;
}

/**
 * Main hook for print operations - FIXED with better state management
 */
export const usePrintService = () => {
  const [printStatus, setPrintStatus] = useState<PrintStatus>({
    isAvailable: false,
    isPrinting: false,
  });
  
  const printService = EnhancedPrintService.getInstance();
  const { printer } = usePrinterConnection();
  const { refreshConnections, isInitialized } = useBluetoothStore();
  
  // Use ref to track mounting state
  const isMountedRef = useRef(true);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check print availability on mount and when critical state changes
  useEffect(() => {
    if (isMountedRef.current) {
      checkPrintAvailability();
    }
  }, [printer.isConnected, printer.device?.id, isInitialized]);

  // IMPROVED: Better availability checking with error handling
  const checkPrintAvailability = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const availability = await printService.isPrintingAvailable();
      
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isAvailable: availability.available,
          printerName: printer.device?.name,
          error: availability.reason,
        }));
      }
    } catch (error: any) {
      console.error('Failed to check print availability:', error);
      
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isAvailable: false,
          error: error.message,
        }));
      }
    }
  }, [printService, printer.device]);

  const printPackage = useCallback(async (
    packageData: PackageData,
    options: PrintOptions = {}
  ): Promise<PrintResult> => {
    if (!isMountedRef.current) {
      throw new Error('Component unmounted');
    }
    
    setPrintStatus(prev => ({ ...prev, isPrinting: true }));
    
    try {
      const result = await printService.printPackage(packageData, options);
      
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isPrinting: false,
          lastPrintResult: result,
        }));
      }
      
      return result;
    } catch (error: any) {
      const errorResult: PrintResult = {
        success: false,
        message: error.message,
        errorCode: 'PRINT_HOOK_ERROR',
      };
      
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isPrinting: false,
          lastPrintResult: errorResult,
        }));
      }
      
      throw error;
    }
  }, [printService]);

  const testPrint = useCallback(async (options: PrintOptions = {}): Promise<PrintResult> => {
    if (!isMountedRef.current) {
      throw new Error('Component unmounted');
    }
    
    setPrintStatus(prev => ({ ...prev, isPrinting: true }));
    
    try {
      const result = await printService.testPrint(options);
      
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isPrinting: false,
          lastPrintResult: result,
        }));
      }
      
      return result;
    } catch (error: any) {
      const errorResult: PrintResult = {
        success: false,
        message: error.message,
        errorCode: 'TEST_PRINT_ERROR',
      };
      
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isPrinting: false,
          lastPrintResult: errorResult,
        }));
      }
      
      throw error;
    }
  }, [printService]);

  const bulkPrint = useCallback(async (
    packages: PackageData[],
    options: PrintOptions = {}
  ): Promise<PrintResult[]> => {
    if (!isMountedRef.current) {
      throw new Error('Component unmounted');
    }
    
    setPrintStatus(prev => ({ ...prev, isPrinting: true }));
    
    try {
      const results = await printService.bulkPrint(packages, options);
      
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isPrinting: false,
          lastPrintResult: results[results.length - 1], // Last result
        }));
      }
      
      return results;
    } catch (error: any) {
      if (isMountedRef.current) {
        setPrintStatus(prev => ({
          ...prev,
          isPrinting: false,
        }));
      }
      
      throw error;
    }
  }, [printService]);

  // IMPROVED: Better refresh with connection verification
  const refreshPrinterStatus = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      await refreshConnections();
      await checkPrintAvailability();
    } catch (error) {
      console.error('Failed to refresh printer status:', error);
    }
  }, [refreshConnections, checkPrintAvailability]);

  return {
    printStatus,
    printPackage,
    testPrint,
    bulkPrint,
    refreshPrinterStatus,
    checkAvailability: checkPrintAvailability,
  };
};

/**
 * Hook for quick print actions with user prompts - ENHANCED
 */
export const useQuickPrint = () => {
  const { printPackage, testPrint, printStatus } = usePrintService();

  const quickPrintWithConfirmation = useCallback(async (
    packageData: PackageData,
    options: PrintOptions = {}
  ): Promise<void> => {
    if (!printStatus.isAvailable) {
      Alert.alert(
        'Printer Not Available',
        printStatus.error || 'Please connect a printer first',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Settings', onPress: () => {
            // You can add navigation to settings here if needed
            Toast.show({
              type: 'info',
              text1: 'Go to Settings',
              text2: 'Connect a printer in Settings → Bluetooth',
              position: 'top',
              visibilityTime: 4000,
            });
          }}
        ]
      );
      return;
    }

    Alert.alert(
      'Print Package',
      `Print ${options.printType || 'receipt'} for package ${packageData.code}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Print',
          onPress: async () => {
            try {
              await printPackage(packageData, options);
              Toast.show({
                type: 'success',
                text1: 'Print Successful',
                text2: `Package ${packageData.code} printed`,
                position: 'top',
                visibilityTime: 3000,
              });
            } catch (error: any) {
              console.error('Quick print failed:', error);
              Alert.alert('Print Failed', error.message);
            }
          }
        }
      ]
    );
  }, [printPackage, printStatus]);

  const quickTestPrint = useCallback(async (): Promise<void> => {
    if (!printStatus.isAvailable) {
      Alert.alert(
        'Printer Not Available',
        printStatus.error || 'Please connect a printer first'
      );
      return;
    }

    Alert.alert(
      'Test Print',
      `Send test print to ${printStatus.printerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Test Print',
          onPress: async () => {
            try {
              await testPrint();
              Toast.show({
                type: 'success',
                text1: 'Test Print Successful',
                text2: `Test sent to ${printStatus.printerName}`,
                position: 'top',
                visibilityTime: 3000,
              });
            } catch (error: any) {
              console.error('Test print failed:', error);
              Alert.alert('Test Print Failed', error.message);
            }
          }
        }
      ]
    );
  }, [testPrint, printStatus]);

  return {
    quickPrintWithConfirmation,
    quickTestPrint,
    isAvailable: printStatus.isAvailable,
    isPrinting: printStatus.isPrinting,
    printerName: printStatus.printerName,
  };
};

/**
 * Hook for bulk print operations with progress tracking - ENHANCED
 */
export const useBulkPrint = () => {
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    isRunning: boolean;
    currentPackage?: string;
  }>({
    total: 0,
    completed: 0,
    failed: 0,
    isRunning: false,
  });

  const { bulkPrint, printStatus } = usePrintService();

  const startBulkPrint = useCallback(async (
    packages: PackageData[],
    options: PrintOptions = {}
  ): Promise<void> => {
    if (!printStatus.isAvailable) {
      Alert.alert('Printer Not Available', printStatus.error || 'Please connect a printer first');
      return;
    }

    if (packages.length === 0) {
      Alert.alert('No Packages', 'No packages selected for printing');
      return;
    }

    Alert.alert(
      'Bulk Print',
      `Print ${options.printType || 'receipts'} for ${packages.length} packages?\n\nThis may take several minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Printing',
          onPress: async () => {
            setBulkProgress({
              total: packages.length,
              completed: 0,
              failed: 0,
              isRunning: true,
            });

            try {
              const results = await bulkPrint(packages, options);
              
              const completed = results.filter(r => r.success).length;
              const failed = results.length - completed;

              setBulkProgress({
                total: packages.length,
                completed,
                failed,
                isRunning: false,
              });

              // Show completion alert
              if (failed === 0) {
                Alert.alert(
                  'Bulk Print Complete',
                  `Successfully printed all ${completed} packages!`
                );
              } else if (completed === 0) {
                Alert.alert(
                  'Bulk Print Failed',
                  `Failed to print all ${packages.length} packages. Check printer connection.`
                );
              } else {
                Alert.alert(
                  'Bulk Print Partial Success',
                  `Printed ${completed}/${packages.length} packages successfully.\n${failed} packages failed.`
                );
              }

            } catch (error: any) {
              setBulkProgress(prev => ({ ...prev, isRunning: false }));
              Alert.alert('Bulk Print Failed', error.message);
            }
          }
        }
      ]
    );
  }, [bulkPrint, printStatus]);

  const resetBulkProgress = useCallback(() => {
    setBulkProgress({
      total: 0,
      completed: 0,
      failed: 0,
      isRunning: false,
    });
  }, []);

  return {
    bulkProgress,
    startBulkPrint,
    resetBulkProgress,
    isAvailable: printStatus.isAvailable,
  };
};

// Utility functions for easy integration

/**
 * Create package data from scan result - ENHANCED with better data mapping
 */
export const createPackageDataFromScan = (scanResult: any): PackageData => {
  return {
    code: scanResult.package_code || scanResult.code || scanResult.barcode || 'UNKNOWN',
    receiver_name: scanResult.receiver_name || scanResult.recipient || scanResult.customer_name || 'Unknown Receiver',
    route_description: scanResult.route_description || scanResult.destination || scanResult.route || 'Unknown Destination',
    sender_name: scanResult.sender_name || scanResult.from || 'GLT Logistics',
    state_display: scanResult.state_display || scanResult.status || scanResult.state || 'Processing',
    pickup_location: scanResult.pickup_location || scanResult.origin,
    delivery_address: scanResult.delivery_address || scanResult.address || scanResult.destination_address,
    weight: scanResult.weight || scanResult.package_weight,
    dimensions: scanResult.dimensions || scanResult.size,
    special_instructions: scanResult.special_instructions || scanResult.notes || scanResult.instructions,
    tracking_url: scanResult.tracking_url || scanResult.track_url,
  };
};

/**
 * Print options presets - ENHANCED with more options
 */
export const PrintPresets = {
  receipt: {
    printType: 'receipt' as const,
    includeLogo: true,
    includeQR: true,
    labelSize: 'medium' as const,
    copies: 1,
  },
  label: {
    printType: 'label' as const,
    includeLogo: false,
    includeQR: true,
    labelSize: 'small' as const,
    copies: 1,
  },
  invoice: {
    printType: 'invoice' as const,
    includeLogo: true,
    includeQR: true,
    labelSize: 'large' as const,
    copies: 1,
  },
  bulkReceipts: {
    printType: 'receipt' as const,
    includeLogo: false, // Faster printing
    includeQR: true,
    labelSize: 'medium' as const,
    copies: 1,
  },
  duplicateReceipt: {
    printType: 'receipt' as const,
    includeLogo: true,
    includeQR: true,
    labelSize: 'medium' as const,
    copies: 2,
  },
  shippingLabel: {
    printType: 'label' as const,
    includeLogo: true,
    includeQR: true,
    labelSize: 'large' as const,
    copies: 1,
  },
};

/**
 * Context types and hooks (without JSX components)
 */
import { createContext, useContext } from 'react';

interface PrintContextType {
  printFromAnywhere: (packageData: PackageData, options?: PrintOptions) => Promise<void>;
  testPrintFromAnywhere: () => Promise<void>;
  isPrintingAvailable: boolean;
  printerName?: string;
}

export const PrintContext = createContext<PrintContextType | undefined>(undefined);

/**
 * Hook to create print context value - ENHANCED
 */
export const usePrintContextValue = (): PrintContextType => {
  const { printPackage, testPrint, printStatus } = usePrintService();

  const printFromAnywhere = useCallback(async (
    packageData: PackageData,
    options: PrintOptions = {}
  ): Promise<void> => {
    try {
      if (!printStatus.isAvailable) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Available',
          text2: printStatus.error || 'Please connect a printer first',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

      await printPackage(packageData, options);
      Toast.show({
        type: 'success',
        text1: 'Print Successful',
        text2: `Package ${packageData.code} printed`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      console.error('Print from anywhere failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Print Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }, [printPackage, printStatus]);

  const testPrintFromAnywhere = useCallback(async (): Promise<void> => {
    try {
      if (!printStatus.isAvailable) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Available',
          text2: printStatus.error || 'Please connect a printer first',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

      await testPrint();
      Toast.show({
        type: 'success',
        text1: 'Test Print Successful',
        text2: `Test sent to ${printStatus.printerName}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      console.error('Test print from anywhere failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Test Print Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }, [testPrint, printStatus]);

  return {
    printFromAnywhere,
    testPrintFromAnywhere,
    isPrintingAvailable: printStatus.isAvailable,
    printerName: printStatus.printerName,
  };
};

export const usePrintContext = (): PrintContextType => {
  const context = useContext(PrintContext);
  if (!context) {
    throw new Error('usePrintContext must be used within a PrintProvider');
  }
  return context;
};

/**
 * ENHANCED: Print utility functions
 */

/**
 * Get printer status description for UI display
 */
export const getPrinterStatusDescription = (printStatus: PrintStatus): string => {
  if (printStatus.isPrinting) {
    return 'Printing...';
  }
  
  if (!printStatus.isAvailable) {
    return printStatus.error || 'Printer not available';
  }
  
  return `Ready: ${printStatus.printerName}`;
};

/**
 * Check if a print operation should be allowed
 */
export const canPrint = (printStatus: PrintStatus): boolean => {
  return printStatus.isAvailable && !printStatus.isPrinting;
};

/**
 * Get appropriate error message for printing issues
 */
export const getPrintErrorMessage = (error: any): string => {
  const message = error?.message || error?.toString() || 'Unknown error';
  
  if (message.includes('not initialized')) {
    return 'Bluetooth not ready. Please initialize in Settings.';
  }
  if (message.includes('not connected')) {
    return 'No printer connected. Please connect in Settings.';
  }
  if (message.includes('permissions')) {
    return 'Bluetooth permissions required. Check app settings.';
  }
  if (message.includes('timeout')) {
    return 'Print timeout. Printer may be busy or disconnected.';
  }
  
  return message;
};
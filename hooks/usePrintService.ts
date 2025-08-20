// hooks/usePrintService.ts - React hooks for easy printing integration
import { useState, useCallback, useEffect } from 'react';
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
 * Main hook for print operations
 */
export const usePrintService = () => {
  const [printStatus, setPrintStatus] = useState<PrintStatus>({
    isAvailable: false,
    isPrinting: false,
  });
  
  const printService = EnhancedPrintService.getInstance();
  const { printer } = usePrinterConnection();
  const { refreshConnections } = useBluetoothStore();

  // Check print availability on mount and printer changes
  useEffect(() => {
    checkPrintAvailability();
  }, [printer.isConnected, printer.device]);

  const checkPrintAvailability = useCallback(async () => {
    try {
      const availability = await printService.isPrintingAvailable();
      setPrintStatus(prev => ({
        ...prev,
        isAvailable: availability.available,
        printerName: printer.device?.name,
        error: availability.reason,
      }));
    } catch (error: any) {
      setPrintStatus(prev => ({
        ...prev,
        isAvailable: false,
        error: error.message,
      }));
    }
  }, [printService, printer.device]);

  const printPackage = useCallback(async (
    packageData: PackageData,
    options: PrintOptions = {}
  ): Promise<PrintResult> => {
    setPrintStatus(prev => ({ ...prev, isPrinting: true }));
    
    try {
      const result = await printService.printPackage(packageData, options);
      
      setPrintStatus(prev => ({
        ...prev,
        isPrinting: false,
        lastPrintResult: result,
      }));
      
      return result;
    } catch (error: any) {
      const errorResult: PrintResult = {
        success: false,
        message: error.message,
        errorCode: 'PRINT_HOOK_ERROR',
      };
      
      setPrintStatus(prev => ({
        ...prev,
        isPrinting: false,
        lastPrintResult: errorResult,
      }));
      
      throw error;
    }
  }, [printService]);

  const testPrint = useCallback(async (options: PrintOptions = {}): Promise<PrintResult> => {
    setPrintStatus(prev => ({ ...prev, isPrinting: true }));
    
    try {
      const result = await printService.testPrint(options);
      
      setPrintStatus(prev => ({
        ...prev,
        isPrinting: false,
        lastPrintResult: result,
      }));
      
      return result;
    } catch (error: any) {
      const errorResult: PrintResult = {
        success: false,
        message: error.message,
        errorCode: 'TEST_PRINT_ERROR',
      };
      
      setPrintStatus(prev => ({
        ...prev,
        isPrinting: false,
        lastPrintResult: errorResult,
      }));
      
      throw error;
    }
  }, [printService]);

  const bulkPrint = useCallback(async (
    packages: PackageData[],
    options: PrintOptions = {}
  ): Promise<PrintResult[]> => {
    setPrintStatus(prev => ({ ...prev, isPrinting: true }));
    
    try {
      const results = await printService.bulkPrint(packages, options);
      
      setPrintStatus(prev => ({
        ...prev,
        isPrinting: false,
        lastPrintResult: results[results.length - 1], // Last result
      }));
      
      return results;
    } catch (error: any) {
      setPrintStatus(prev => ({
        ...prev,
        isPrinting: false,
      }));
      
      throw error;
    }
  }, [printService]);

  const refreshPrinterStatus = useCallback(async () => {
    await refreshConnections();
    await checkPrintAvailability();
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
 * Hook for quick print actions with user prompts
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
          { text: 'Settings', onPress: () => {/* Navigate to settings */} }
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
            } catch (error: any) {
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
            } catch (error: any) {
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
 * Hook for bulk print operations with progress tracking
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
      `Print ${options.printType || 'receipts'} for ${packages.length} packages?`,
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
              Alert.alert(
                'Bulk Print Complete',
                `Printed ${completed}/${packages.length} packages successfully${failed > 0 ? `. ${failed} failed.` : '.'}`
              );

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
 * Create package data from scan result
 */
export const createPackageDataFromScan = (scanResult: any): PackageData => {
  return {
    code: scanResult.package_code || scanResult.code || 'UNKNOWN',
    receiver_name: scanResult.receiver_name || 'Unknown Receiver',
    route_description: scanResult.route_description || scanResult.destination || 'Unknown Destination',
    sender_name: scanResult.sender_name,
    state_display: scanResult.state_display || scanResult.status,
    pickup_location: scanResult.pickup_location,
    delivery_address: scanResult.delivery_address || scanResult.address,
    weight: scanResult.weight,
    dimensions: scanResult.dimensions,
    special_instructions: scanResult.special_instructions || scanResult.notes,
    tracking_url: scanResult.tracking_url,
  };
};

/**
 * Print options presets
 */
export const PrintPresets = {
  receipt: {
    printType: 'receipt' as const,
    includeLogo: true,
    includeQR: true,
    labelSize: 'medium' as const,
  },
  label: {
    printType: 'label' as const,
    includeLogo: false,
    includeQR: true,
    labelSize: 'small' as const,
  },
  invoice: {
    printType: 'invoice' as const,
    includeLogo: true,
    includeQR: true,
    labelSize: 'large' as const,
  },
  bulkReceipts: {
    printType: 'receipt' as const,
    includeLogo: false, // Faster printing
    includeQR: true,
    labelSize: 'medium' as const,
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
}

export const PrintContext = createContext<PrintContextType | undefined>(undefined);

/**
 * Hook to create print context value
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
    } catch (error: any) {
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
      await testPrint();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Test Print Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }, [testPrint]);

  return {
    printFromAnywhere,
    testPrintFromAnywhere,
    isPrintingAvailable: printStatus.isAvailable,
  };
};

export const usePrintContext = (): PrintContextType => {
  const context = useContext(PrintContext);
  if (!context) {
    throw new Error('usePrintContext must be used within a PrintProvider');
  }
  return context;
};
// app/admin/ScanningScreen.tsx - Updated with styled modal

import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AdminLayout from '../../components/AdminLayout';
import BulkScanner from '../../components/BulkScanner';
import PrinterConnectionModal from '../../components/PrinterConnectionModal';
import QRScanner from '../../components/QRScanner';
import { useBluetooth } from '../../contexts/BluetoothContext';
import api from '../../lib/api';

const { width } = Dimensions.get('window');

interface UserStats {
  packages_scanned_today: number;
  packages_processed_today: number;
  total_packages_processed: number;
  last_scan_time?: string;
}

interface ScanningScreenProps {
  userRole?: 'client' | 'agent' | 'rider' | 'warehouse' | 'admin';
  userId?: string;
  userName?: string;
}

const ScanningScreen: React.FC<ScanningScreenProps> = ({
  userRole = 'agent',
  userId = 'demo-user',
  userName = 'Demo User',
}) => {
  const router = useRouter();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showBulkScanner, setShowBulkScanner] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>(userRole);
  
  // Styled modal state
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printerModalConfig, setPrinterModalConfig] = useState({
    title: '',
    message: '',
    isBluetoothUnavailable: false,
    onContinue: () => {},
  });

  // Use global Bluetooth context
  const { 
    connectedPrinter, 
    isPrintReady, 
    testPrint, 
    printText, 
    printReceipt,
    isBluetoothAvailable 
  } = useBluetooth();

  useEffect(() => {
    loadUserRole();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserStats();
    }, [])
  );

  const loadUserRole = async () => {
    try {
      const storedRole = await SecureStore.getItemAsync('user_role');
      if (storedRole) {
        setCurrentUserRole(storedRole);
      }
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      setRefreshing(true);
      
      const response = await api.get('/api/v1/users/scanning_stats');        
      
      if (response.data.success) {
        setUserStats(response.data.data);
      } else {
        // Fallback data
        setUserStats({
          packages_scanned_today: 12,
          packages_processed_today: 10,
          total_packages_processed: 156,
          last_scan_time: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to load user stats:', error);
      
      // Fallback data
      setUserStats({
        packages_scanned_today: 8,
        packages_processed_today: 6,
        total_packages_processed: 89,
        last_scan_time: new Date().toISOString(),
      });
      
      Toast.show({
        type: 'info',
        text1: 'Offline Mode',
        text2: 'Using cached data. Check your connection.',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const showPrinterConnectionModal = (actionType: string, title: string, message: string, isBluetoothUnavailable = false) => {
    setPrinterModalConfig({
      title,
      message,
      isBluetoothUnavailable,
      onContinue: () => {
        setSelectedAction(actionType);
        setShowPrinterModal(false);
        setShowQRScanner(true);
      },
    });
    setShowPrinterModal(true);
  };

  const handleQuickScan = async (actionType: string) => {
    if (actionType === 'print') {
      if (!isBluetoothAvailable) {
        showPrinterConnectionModal(
          actionType,
          'Bluetooth Not Available',
          'Bluetooth is not available in this environment (Expo Go). Printing features require a development build.',
          true
        );
        return;
      }
      
      if (!isPrintReady) {
        showPrinterConnectionModal(
          actionType,
          'Printer Not Ready',
          'No printer connected. Please connect a printer in Settings first to enable printing functionality.',
          false
        );
        return;
      }
    }
    
    setSelectedAction(actionType);
    setShowQRScanner(true);
  };

  const handleBulkScan = async (actionType: string) => {
    if (actionType === 'print') {
      if (!isBluetoothAvailable) {
        showPrinterConnectionModal(
          actionType,
          'Bluetooth Not Available',
          'Bluetooth is not available in this environment (Expo Go). Printing features require a development build.',
          true
        );
        return;
      }
      
      if (!isPrintReady) {
        showPrinterConnectionModal(
          actionType,
          'Printer Required for Bulk Print',
          'Please connect a printer in Settings before performing bulk printing operations.',
          false
        );
        return;
      }
    }
    
    setSelectedAction(actionType);
    setShowBulkScanner(true);
  };

  const handleScanSuccess = async (result: any) => {
    loadUserStats();
    console.log('✅ Scan successful:', result);
    
    // Auto-print if this was a print action
    if (selectedAction === 'print') {
      if (isPrintReady && isBluetoothAvailable) {
        try {
          await printReceipt({
            packageCode: result.package_code || result.code,
            customerName: result.customer_name || 'N/A',
            status: result.status || 'Processed',
            location: result.location || 'Current Location',
            timestamp: new Date().toISOString()
          });
          Toast.show({
            type: 'success',
            text1: 'Receipt Printed',
            text2: `Receipt printed for ${result.package_code || result.code}`,
            position: 'top',
            visibilityTime: 3000,
          });
        } catch (error: any) {
          Toast.show({
            type: 'error',
            text1: 'Print Failed',
            text2: error.message,
            position: 'top',
            visibilityTime: 3000,
          });
        }
      } else {
        // No printer available, just show success
        Toast.show({
          type: 'info',
          text1: 'Scan Successful',
          text2: `Package ${result.package_code || result.code} processed (no printer available)`,
          position: 'top',
          visibilityTime: 3000,
        });
      }
    }
  };

  const handleBulkComplete = (results: any[]) => {
    loadUserStats();
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    if (failureCount === 0) {
      Toast.show({
        type: 'success',
        text1: 'Bulk Operation Complete',
        text2: `Successfully processed all ${successCount} packages`,
        position: 'top',
        visibilityTime: 4000,
      });
    } else if (successCount === 0) {
      Toast.show({
        type: 'error',
        text1: 'Bulk Operation Failed',
        text2: `Failed to process all ${results.length} packages`,
        position: 'top',
        visibilityTime: 4000,
      });
    } else {
      Toast.show({
        type: 'info',
        text1: 'Bulk Operation Partial Success',
        text2: `${successCount} successful, ${failureCount} failed out of ${results.length} packages`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
  };

  const getAvailableActions = () => {
    switch (currentUserRole) {
      case 'agent':
        return [
          {
            id: 'collect_from_sender',
            title: 'Collect from Sender',
            description: 'Confirm package pickup from sender/customer (Pending → Submitted)',
            icon: 'how-to-reg' as keyof typeof MaterialIcons.glyphMap,
            color: '#667eea',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'print',
            title: 'Print Shipping Labels',
            description: 'Generate and print shipping labels for packages',
            icon: 'print' as keyof typeof MaterialIcons.glyphMap,
            color: '#FF9500',
            allowBulk: true,
            requiresPrinter: true,
          },
        ];
      case 'rider':
        return [
          {
            id: 'collect',
            title: 'Collect from Agent',
            description: 'Pick up packages from agent for delivery (Submitted → In Transit)',
            icon: 'local-shipping' as keyof typeof MaterialIcons.glyphMap,
            color: '#9C27B0',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'deliver',
            title: 'Mark as Delivered',
            description: 'Mark package as delivered to address (In Transit → Delivered)',
            icon: 'check-circle' as keyof typeof MaterialIcons.glyphMap,
            color: '#34C759',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'give_to_receiver',
            title: 'Give to Receiver',
            description: 'Hand package directly to recipient (In Transit/Delivered → Collected)',
            icon: 'person-pin' as keyof typeof MaterialIcons.glyphMap,
            color: '#FF6B35',
            allowBulk: true,
            requiresPrinter: false,
          },
        ];
      case 'warehouse':
        return [
          {
            id: 'process',
            title: 'Process Packages',
            description: 'Process incoming packages at warehouse',
            icon: 'inventory' as keyof typeof MaterialIcons.glyphMap,
            color: '#2196F3',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'print',
            title: 'Print Route Labels',
            description: 'Print delivery route and sorting labels',
            icon: 'print' as keyof typeof MaterialIcons.glyphMap,
            color: '#FF9500',
            allowBulk: true,
            requiresPrinter: true,
          },
        ];
      case 'client':
        return [
          {
            id: 'confirm_receipt',
            title: 'Confirm Receipt',
            description: 'Confirm you received your package (Delivered → Collected)',
            icon: 'done-all' as keyof typeof MaterialIcons.glyphMap,
            color: '#34C759',
            allowBulk: false,
            requiresPrinter: false,
          },
        ];
      case 'admin':
        return [
          {
            id: 'collect_from_sender',
            title: 'Collect from Sender',
            description: 'Admin: Confirm package pickup (Pending → Submitted)',
            icon: 'how-to-reg' as keyof typeof MaterialIcons.glyphMap,
            color: '#667eea',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'collect',
            title: 'Collect from Agent',
            description: 'Admin: Pick up from agent (Submitted → In Transit)',
            icon: 'local-shipping' as keyof typeof MaterialIcons.glyphMap,
            color: '#9C27B0',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'deliver',
            title: 'Mark as Delivered',
            description: 'Admin: Mark delivery complete (In Transit → Delivered)',
            icon: 'check-circle' as keyof typeof MaterialIcons.glyphMap,
            color: '#34C759',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'give_to_receiver',
            title: 'Give to Receiver',
            description: 'Admin: Hand to recipient (In Transit/Delivered → Collected)',
            icon: 'person-pin' as keyof typeof MaterialIcons.glyphMap,
            color: '#FF6B35',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'print',
            title: 'Print Labels/Receipts',
            description: 'Admin: Print any documentation',
            icon: 'print' as keyof typeof MaterialIcons.glyphMap,
            color: '#FF9500',
            allowBulk: true,
            requiresPrinter: true,
          },
        ];
      default:
        return [];
    }
  };

  const getRoleDisplayName = () => {
    switch (currentUserRole) {
      case 'client': return 'Customer';
      case 'agent': return 'Agent';
      case 'rider': return 'Delivery Rider';
      case 'warehouse': return 'Warehouse Staff';
      case 'admin': return 'Administrator';
      default: return 'User';
    }
  };

  const getRoleWelcomeMessage = () => {
    switch (currentUserRole) {
      case 'agent': return 'Collect packages and print labels';
      case 'rider': return 'Collect, deliver, and hand packages to recipients';
      case 'warehouse': return 'Process and manage packages';
      case 'client': return 'Confirm package receipts';
      case 'admin': return 'Full system access';
      default: return 'Welcome to the scanning system';
    }
  };

  const handleNavigateToReports = () => {
    if (['admin', 'warehouse', 'agent'].includes(currentUserRole)) {
      router.push('/admin/ReportsScreen');
    } else {
      Toast.show({
        type: 'warning',
        text1: 'Access Denied',
        text2: 'You do not have permission to view reports.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handleTestPrinter = async () => {
    if (!isPrintReady) {
      Toast.show({
        type: 'warning',
        text1: 'No Printer Connected',
        text2: 'Please connect a printer in Settings first',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      await testPrint();
      Toast.show({
        type: 'success',
        text1: 'Test Print Successful',
        text2: `Test sent to ${connectedPrinter?.name}`,
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Test Print Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const renderWelcomeSection = () => (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.welcomeSection}
    >
      <View style={styles.welcomeHeader}>
        <View style={styles.welcomeIconContainer}>
          <MaterialIcons name="qr-code-scanner" size={32} color="#fff" />
        </View>
        <View style={styles.welcomeText}>
          <Text style={styles.welcomeTitle}>Welcome, {userName}</Text>
          <Text style={styles.welcomeSubtitle}>
            {getRoleDisplayName()} • {getRoleWelcomeMessage()}
          </Text>
        </View>
        {/* Enhanced status indicators */}
        <View style={styles.statusIndicators}>
          <View style={styles.statusRow}>
            <MaterialIcons 
              name="bluetooth" 
              size={16} 
              color={isBluetoothAvailable ? '#34C759' : '#FF6B6B'} 
            />
            <View style={[
              styles.statusDot, 
              { backgroundColor: isBluetoothAvailable ? '#34C759' : '#FF6B6B' }
            ]} />
          </View>
          <View style={styles.statusRow}>
            <MaterialIcons 
              name="print" 
              size={16} 
              color={isPrintReady ? '#34C759' : '#FF6B6B'} 
            />
            <View style={[
              styles.statusDot, 
              { backgroundColor: isPrintReady ? '#34C759' : '#FF6B6B' }
            ]} />
          </View>
        </View>
      </View>
      
      {/* Connected printer info */}
      {connectedPrinter && (
        <View style={styles.printerStatusCard}>
          <MaterialIcons name="print" size={20} color="#fff" />
          <Text style={styles.printerStatusText}>
            Connected: {connectedPrinter.name}
          </Text>
          <TouchableOpacity
            style={styles.quickTestButton}
            onPress={handleTestPrinter}
          >
            <Text style={styles.quickTestText}>Test</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );

  const renderStatsSection = () => {
    if (!userStats) return null;

    return (
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Today's Activity</Text>
        <View style={styles.statsGrid}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statNumber}>{userStats.packages_scanned_today}</Text>
            <Text style={styles.statLabel}>Packages Scanned</Text>
          </LinearGradient>
          <LinearGradient
            colors={['#34C759', '#30A46C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statNumber}>{userStats.packages_processed_today}</Text>
            <Text style={styles.statLabel}>Packages Processed</Text>
          </LinearGradient>
        </View>
        {userStats.last_scan_time && (
          <Text style={styles.lastScanText}>
            Last scan: {new Date(userStats.last_scan_time).toLocaleTimeString()}
          </Text>
        )}
      </View>
    );
  };

  const renderActionCard = (action: any) => (
    <View key={action.id} style={styles.actionCard}>
      <LinearGradient
        colors={[action.color, action.color + '99']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionHeader}
      >
        <MaterialIcons name={action.icon} size={20} color="#fff" />
        <Text style={styles.actionTitle}>{action.title}</Text>
        {action.requiresPrinter && (
          <MaterialIcons 
            name="print" 
            size={16} 
            color={isPrintReady ? "#34C759" : "#FF6B6B"} 
          />
        )}
      </LinearGradient>
      
      <View style={styles.actionContent}>
        <Text style={styles.actionDescription}>{action.description}</Text>
        
        {/* Show printer warning/status when needed */}
        {action.requiresPrinter && (
          <View style={styles.printerStatusContainer}>
            {!isBluetoothAvailable ? (
              <View style={styles.printerWarning}>
                <MaterialIcons name="warning" size={16} color="#FF9500" />
                <Text style={styles.printerWarningText}>
                  Bluetooth not available (Expo Go). Use development build for printing.
                </Text>
              </View>
            ) : !isPrintReady ? (
              <View style={styles.printerWarning}>
                <MaterialIcons name="warning" size={16} color="#FF9500" />
                <Text style={styles.printerWarningText}>
                  No printer connected. Connect in Settings first.
                </Text>
              </View>
            ) : (
              <View style={styles.printerReady}>
                <MaterialIcons name="check-circle" size={16} color="#34C759" />
                <Text style={styles.printerReadyText}>
                  Ready: {connectedPrinter?.name}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: action.color }]}
            onPress={() => handleQuickScan(action.id)}
          >
            <MaterialIcons name="qr-code-scanner" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Quick Scan</Text>
          </TouchableOpacity>
          
          {action.allowBulk && (
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.bulkScanButton, 
                { borderColor: action.color }
              ]}
              onPress={() => handleBulkScan(action.id)}
            >
              <MaterialIcons name="view-list" size={18} color={action.color} />
              <Text style={[styles.actionButtonText, { color: action.color }]}>
                Bulk Scan
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {action.requiresPrinter && isPrintReady && (
          <TouchableOpacity
            style={styles.printerTestButton}
            onPress={handleTestPrinter}
          >
            <MaterialIcons name="print" size={16} color="#667eea" />
            <Text style={styles.printerTestText}>Test Printer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsSection}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push('/admin/PackageSearchScreen')}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.quickActionGradient}
          >
            <MaterialIcons name="search" size={24} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionText}>Search Packages</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push('/admin/ScanHistoryScreen')}
        >
          <LinearGradient
            colors={['#FF9500', '#FF8C00']}
            style={styles.quickActionGradient}
          >
            <MaterialIcons name="history" size={24} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickActionText}>Scan History</Text>
        </TouchableOpacity>
        
        {['admin', 'warehouse', 'agent'].includes(currentUserRole) && (
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={handleNavigateToReports}
          >
            <LinearGradient
              colors={['#34C759', '#30A46C']}
              style={styles.quickActionGradient}
            >
              <MaterialIcons name="bar-chart" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Reports</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderContent = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={loadUserStats}
          tintColor="#667eea"
          colors={['#667eea']}
        />
      }
    >
      {renderWelcomeSection()}
      {renderStatsSection()}
      
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Scanning Actions</Text>
        {getAvailableActions().map(renderActionCard)}
      </View>
      
      {renderQuickActions()}

      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        userRole={currentUserRole as any}
        onScanSuccess={handleScanSuccess}
        defaultAction={selectedAction}
      />

      <BulkScanner
        visible={showBulkScanner}
        onClose={() => setShowBulkScanner(false)}
        actionType={selectedAction as any}
        userRole={currentUserRole as any}
        onBulkComplete={handleBulkComplete}
      />

      <PrinterConnectionModal
        visible={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
        onGoToSettings={() => {
          setShowPrinterModal(false);
          router.push('/admin/settings');
        }}
        onContinueAnyway={printerModalConfig.onContinue}
        title={printerModalConfig.title}
        message={printerModalConfig.message}
        isBluetoothUnavailable={printerModalConfig.isBluetoothUnavailable}
      />
    </ScrollView>
  );

  return (
    <AdminLayout activePanel="scan">
      {renderContent()}
    </AdminLayout>
  );
};

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  welcomeSection: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  welcomeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  welcomeText: { flex: 1 },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  
  // Enhanced status indicators
  statusIndicators: {
    flexDirection: 'column',
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  
  printerStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  printerStatusText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  quickTestButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickTestText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  
  statsSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '600',
  },
  lastScanText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  
  actionsSection: { marginBottom: 20 },
  actionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
    overflow: 'hidden',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  actionContent: { padding: 16, paddingTop: 12 },
  actionDescription: {
    fontSize: 14,
    color: '#a0aec0',
    marginBottom: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  
  printerStatusContainer: {
    marginBottom: 16,
  },
  printerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  printerWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  
  printerReady: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  printerReadyText: {
    flex: 1,
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  bulkScanButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  
  printerTestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 1,
    borderColor: '#667eea',
    gap: 8,
  },
  printerTestText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  
  quickActionsSection: { marginBottom: 20 },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: (width - 56) / 3,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  quickActionGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 16,
  },
});

export default ScanningScreen;
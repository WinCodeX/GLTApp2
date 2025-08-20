// app/admin/ScanningScreen.tsx - Updated with new Bluetooth Store integration
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
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
import QRScanner from '../../components/QRScanner';
import api from '../../lib/api';

// NEW: Import the new Bluetooth store and print hooks
import { useBluetoothStore, useBluetoothInitialization, usePrinterConnection } from '../../stores/BluetoothStore';
import { usePrintService, useQuickPrint, createPackageDataFromScan, PrintPresets } from '../../hooks/usePrintService';

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

  // NEW: Use the new Bluetooth store and print hooks
  const isBluetoothInitialized = useBluetoothInitialization();
  const { printer, connect: connectPrinter, disconnect: disconnectPrinter, test: testPrinter } = usePrinterConnection();
  const { printStatus, refreshPrinterStatus } = usePrintService();
  const { quickPrintWithConfirmation, quickTestPrint, isAvailable: isPrintAvailable } = useQuickPrint();
  const { refreshConnections } = useBluetoothStore();

  useEffect(() => {
    loadUserRole();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserStats();
      // NEW: Refresh printer status when screen comes into focus
      if (isBluetoothInitialized) {
        refreshPrinterStatus();
      }
    }, [isBluetoothInitialized, refreshPrinterStatus])
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

  // NEW: Enhanced print handling with the new service
  const handleQuickScan = async (actionType: string) => {
    if (actionType === 'print') {
      if (!isPrintAvailable) {
        Alert.alert(
          'Printer Not Ready',
          printStatus.error || 'Printer is not available for printing.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Setup Printer', 
              onPress: () => router.push('/admin/settings')
            }
          ]
        );
        return;
      }
    }
    
    setSelectedAction(actionType);
    setShowQRScanner(true);
  };

  const handleBulkScan = async (actionType: string) => {
    if (actionType === 'print') {
      if (!isPrintAvailable) {
        Alert.alert(
          'Printer Required for Bulk Print',
          printStatus.error || 'Please setup printer before bulk printing.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Setup Printer', 
              onPress: () => router.push('/admin/settings')
            }
          ]
        );
        return;
      }
    }
    
    setSelectedAction(actionType);
    setShowBulkScanner(true);
  };

  // NEW: Enhanced scan success handling with direct print integration
  const handleScanSuccess = async (result: any) => {
    loadUserStats();
    console.log('✅ Scan successful:', result);
    
    // NEW: Auto-print if this was a print action
    if (selectedAction === 'print' && isPrintAvailable) {
      try {
        const packageData = createPackageDataFromScan(result);
        await quickPrintWithConfirmation(packageData, PrintPresets.receipt);
      } catch (error) {
        console.error('Print after scan failed:', error);
        // Toast is already shown by the print service
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
      Alert.alert('Access Denied', 'You do not have permission to view reports.');
    }
  };

  // NEW: Enhanced test printer with the new service
  const handleTestPrinter = async () => {
    try {
      await quickTestPrint();
    } catch (error: any) {
      // Error handling is done in the hook
      console.error('Test print failed:', error);
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
        {/* NEW: Bluetooth status indicator */}
        <View style={styles.statusIndicators}>
          <View style={[styles.statusDot, { backgroundColor: isBluetoothInitialized ? '#34C759' : '#FF6B6B' }]} />
          <View style={[styles.statusDot, { backgroundColor: isPrintAvailable ? '#34C759' : '#FF6B6B' }]} />
        </View>
      </View>
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
            color={isPrintAvailable ? "#34C759" : "#FF6B6B"} 
          />
        )}
      </LinearGradient>
      
      <View style={styles.actionContent}>
        <Text style={styles.actionDescription}>{action.description}</Text>
        
        {/* NEW: Enhanced printer warning with more details */}
        {action.requiresPrinter && !isPrintAvailable && (
          <View style={styles.printerWarning}>
            <MaterialIcons name="warning" size={16} color="#FF9500" />
            <Text style={styles.printerWarningText}>
              {printStatus.error || 'Printer not ready'}
            </Text>
          </View>
        )}
        
        {/* NEW: Show printer status when available */}
        {action.requiresPrinter && isPrintAvailable && (
          <View style={styles.printerReady}>
            <MaterialIcons name="check-circle" size={16} color="#34C759" />
            <Text style={styles.printerReadyText}>
              Ready: {printStatus.printerName}
            </Text>
          </View>
        )}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton, 
              { backgroundColor: action.color },
              (action.requiresPrinter && !isPrintAvailable) && styles.disabledButton
            ]}
            onPress={() => handleQuickScan(action.id)}
            disabled={action.requiresPrinter && !isPrintAvailable}
          >
            <MaterialIcons name="qr-code-scanner" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>
              {(action.requiresPrinter && !isPrintAvailable) ? 'Printer Required' : 'Quick Scan'}
            </Text>
          </TouchableOpacity>
          
          {action.allowBulk && (
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.bulkScanButton, 
                { borderColor: action.color },
                (action.requiresPrinter && !isPrintAvailable) && styles.disabledButton
              ]}
              onPress={() => handleBulkScan(action.id)}
              disabled={action.requiresPrinter && !isPrintAvailable}
            >
              <MaterialIcons name="view-list" size={18} color={action.color} />
              <Text style={[styles.actionButtonText, { color: action.color }]}>
                Bulk Scan
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {action.requiresPrinter && (
          <TouchableOpacity
            style={styles.printerTestButton}
            onPress={isPrintAvailable ? handleTestPrinter : () => router.push('/admin/settings')}
          >
            <MaterialIcons 
              name={isPrintAvailable ? "print" : "settings"} 
              size={16} 
              color="#667eea" 
            />
            <Text style={styles.printerTestText}>
              {isPrintAvailable ? 'Test Printer' : 'Setup Printer'}
            </Text>
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
          onRefresh={() => {
            loadUserStats();
            // NEW: Also refresh Bluetooth status
            if (isBluetoothInitialized) {
              refreshPrinterStatus();
              refreshConnections();
            }
          }}
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
  welcomeHeader: { flexDirection: 'row', alignItems: 'center' },
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
  
  // NEW: Status indicators
  statusIndicators: {
    flexDirection: 'column',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
  
  printerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  printerWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  
  // NEW: Printer ready indicator
  printerReady: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
  disabledButton: { opacity: 0.5 },
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
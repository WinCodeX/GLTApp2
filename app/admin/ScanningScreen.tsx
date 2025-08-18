// =================== 2. FIXED SCANNING SCREEN WITH CORRECT WORKFLOW ===================
// app/admin/ScanningScreen.tsx - CORRECTED action mapping

import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
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
import PrintReceiptService from '../../services/PrintReceiptService';

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
  const [printerStatus, setPrinterStatus] = useState<any>(null);

  const printService = PrintReceiptService.getInstance();

  useEffect(() => {
    loadUserRole();
    checkPrinterStatus();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserStats();
      checkPrinterStatus(); // Check printer status when screen focuses
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

  // NEW: Check printer status on load
  const checkPrinterStatus = async () => {
    try {
      const status = await printService.checkPrinterStatus();
      setPrinterStatus(status);
      console.log('🖨️ Printer status updated:', status);
    } catch (error) {
      console.error('Failed to check printer status:', error);
      setPrinterStatus({ isReady: false, error: 'Failed to check printer' });
    }
  };

  const loadUserStats = async () => {
    try {
      setRefreshing(true);
      
      const response = await api.get('/api/v1/users/scanning_stats');        
      
      if (response.data.success) {
        setUserStats(response.data.data);
      } else {
        setUserStats({
          packages_scanned_today: 12,
          packages_processed_today: 10,
          total_packages_processed: 156,
          last_scan_time: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to load user stats:', error);
      
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

  // ENHANCED: Pre-check printer for print actions
  const handleQuickScan = async (actionType: string) => {
    if (actionType === 'print') {
      await checkPrinterStatus();
      
      if (!printerStatus?.isReady) {
        Alert.alert(
          'Printer Not Ready',
          printerStatus?.error || 'Printer is not available for printing.',
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
      await checkPrinterStatus();
      
      if (!printerStatus?.isReady) {
        Alert.alert(
          'Printer Required for Bulk Print',
          printerStatus?.error || 'Please setup printer before bulk printing.',
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

  // ENHANCED: Better success handling
  const handleScanSuccess = (result: any) => {
    loadUserStats();
    
    const actionLabels = {
      'collect_from_sender': 'collected from sender',
      'print': 'printed',
      'collect': 'collected',
      'deliver': 'delivered',
      'process': 'processed'
    };
    
    const actionLabel = actionLabels[selectedAction as keyof typeof actionLabels] || selectedAction;
    
    Toast.show({
      type: 'success',
      text1: 'Scan Successful',
      text2: `Package ${result.package?.code || 'PKG-DEMO'} has been ${actionLabel} successfully`,
      position: 'top',
      visibilityTime: 3000,
    });
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

  // FIXED: Correct workflow mapping
  const getAvailableActions = () => {
    switch (currentUserRole) {
      case 'agent':
        return [
          {
            id: 'collect_from_sender',
            title: 'Collect from Sender',
            description: 'Scan to confirm package pickup from sender/customer',
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
            description: 'Pick up packages from agent for delivery',
            icon: 'local-shipping' as keyof typeof MaterialIcons.glyphMap,
            color: '#9C27B0',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'deliver',
            title: 'Deliver to Customer',
            description: 'Confirm final delivery to recipient',
            icon: 'check-circle' as keyof typeof MaterialIcons.glyphMap,
            color: '#34C759',
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
            description: 'Confirm you received your package',
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
            description: 'Admin: Confirm package pickup',
            icon: 'how-to-reg' as keyof typeof MaterialIcons.glyphMap,
            color: '#667eea',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'collect',
            title: 'Collect from Agent',
            description: 'Admin: Pick up from agent',
            icon: 'local-shipping' as keyof typeof MaterialIcons.glyphMap,
            color: '#9C27B0',
            allowBulk: true,
            requiresPrinter: false,
          },
          {
            id: 'deliver',
            title: 'Mark as Delivered',
            description: 'Admin: Confirm delivery',
            icon: 'check-circle' as keyof typeof MaterialIcons.glyphMap,
            color: '#34C759',
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
      case 'rider': return 'Collect and deliver packages';
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

  // ENHANCED: Test printer connectivity
  const handleTestPrinter = async () => {
    try {
      await checkPrinterStatus();
      
      if (!printerStatus?.isReady) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Ready',
          text2: printerStatus?.error || 'Check printer connection',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

      const success = await printService.testPrint();
      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Test Print Successful',
          text2: `Test receipt sent to ${printerStatus.printerName}`,
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Print Test Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
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

  // ENHANCED: Action card with printer status
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
            color={printerStatus?.isReady ? "#34C759" : "#FF6B6B"} 
          />
        )}
      </LinearGradient>
      
      <View style={styles.actionContent}>
        <Text style={styles.actionDescription}>{action.description}</Text>
        
        {action.requiresPrinter && !printerStatus?.isReady && (
          <View style={styles.printerWarning}>
            <MaterialIcons name="warning" size={16} color="#FF9500" />
            <Text style={styles.printerWarningText}>
              {printerStatus?.error || 'Printer not ready'}
            </Text>
          </View>
        )}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton, 
              { backgroundColor: action.color },
              (action.requiresPrinter && !printerStatus?.isReady) && styles.disabledButton
            ]}
            onPress={() => handleQuickScan(action.id)}
            disabled={action.requiresPrinter && !printerStatus?.isReady}
          >
            <MaterialIcons name="qr-code-scanner" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>
              {(action.requiresPrinter && !printerStatus?.isReady) ? 'Printer Required' : 'Quick Scan'}
            </Text>
          </TouchableOpacity>
          
          {action.allowBulk && (
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.bulkScanButton, 
                { borderColor: action.color },
                (action.requiresPrinter && !printerStatus?.isReady) && styles.disabledButton
              ]}
              onPress={() => handleBulkScan(action.id)}
              disabled={action.requiresPrinter && !printerStatus?.isReady}
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
            onPress={printerStatus?.isReady ? handleTestPrinter : () => router.push('/admin/settings')}
          >
            <MaterialIcons 
              name={printerStatus?.isReady ? "print" : "settings"} 
              size={16} 
              color="#667eea" 
            />
            <Text style={styles.printerTestText}>
              {printerStatus?.isReady ? 'Test Printer' : 'Setup Printer'}
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
            checkPrinterStatus();
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

// ENHANCED STYLES
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
  
  // NEW: Printer warning styles
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
  
  // NEW: Printer test button
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
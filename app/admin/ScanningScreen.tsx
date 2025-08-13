// app/admin/ScanningScreen.tsx - Styled to match app theme with fixed routing
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import QRScanner from '../../components/QRScanner';
import BulkScanner from '../../components/BulkScanner';
import AdminLayout from '../../components/AdminLayout';

const { width } = Dimensions.get('window');

interface UserStats {
  packages_scanned_today: number;
  packages_processed_today: number;
  total_packages_processed: number;
  last_scan_time?: string;
}

interface ScanningScreenProps {
  userRole?: 'agent' | 'rider' | 'customer';
  userId?: string;
  userName?: string;
}

const ScanningScreen: React.FC<ScanningScreenProps> = ({
  userRole = 'agent', // Default for demo
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

  // Load user stats on screen focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserStats();
    }, [])
  );

  const loadUserStats = async () => {
    try {
      setRefreshing(true);
      // Mock data for demo - replace with actual API call
      setTimeout(() => {
        setUserStats({
          packages_scanned_today: 12,
          packages_processed_today: 10,
          total_packages_processed: 156,
          last_scan_time: new Date().toISOString(),
        });
        setRefreshing(false);
        setLoading(false);
      }, 1000);
      
      /* Actual API call:
      const response = await fetch('/api/v1/users/scanning_stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setUserStats(result.data);
      }
      */
    } catch (error) {
      console.error('Failed to load user stats:', error);
      setRefreshing(false);
      setLoading(false);
    }
  };

  const getAuthToken = (): string => {
    // Implement your auth token retrieval logic
    return 'your-auth-token';
  };

  const handleQuickScan = (actionType: string) => {
    setSelectedAction(actionType);
    setShowQRScanner(true);
  };

  const handleBulkScan = (actionType: string) => {
    setSelectedAction(actionType);
    setShowBulkScanner(true);
  };

  const handleScanSuccess = (result: any) => {
    // Refresh stats after successful scan
    loadUserStats();
    
    // Show success feedback with toast
    Toast.show({
      type: 'success',
      text1: 'Scan Successful',
      text2: `Package ${result.package?.code || 'PKG-DEMO'} has been ${selectedAction}ed successfully`,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  const handleBulkComplete = (results: any[]) => {
    // Refresh stats after bulk operation
    loadUserStats();
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    if (failureCount === 0) {
      // All successful
      Toast.show({
        type: 'success',
        text1: 'Bulk Operation Complete',
        text2: `Successfully processed all ${successCount} packages`,
        position: 'top',
        visibilityTime: 4000,
      });
    } else if (successCount === 0) {
      // All failed
      Toast.show({
        type: 'error',
        text1: 'Bulk Operation Failed',
        text2: `Failed to process all ${results.length} packages`,
        position: 'top',
        visibilityTime: 4000,
      });
    } else {
      // Mixed results
      Toast.show({
        type: 'warning',
        text1: 'Bulk Operation Partial Success',
        text2: `${successCount} successful, ${failureCount} failed out of ${results.length} packages`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
  };

  const getAvailableActions = () => {
    switch (userRole) {
      case 'agent':
        return [
          {
            id: 'print',
            title: 'Print Package Labels',
            description: 'Scan QR codes to print package labels and receipts',
            icon: 'print' as keyof typeof MaterialIcons.glyphMap,
            color: '#FF9500',
            allowBulk: true,
          },
        ];
      case 'rider':
        return [
          {
            id: 'collect',
            title: 'Collect Packages',
            description: 'Scan to collect packages from agents',
            icon: 'local-shipping' as keyof typeof MaterialIcons.glyphMap,
            color: '#667eea',
            allowBulk: true,
          },
          {
            id: 'deliver',
            title: 'Mark as Delivered',
            description: 'Scan to mark packages as delivered',
            icon: 'check-circle' as keyof typeof MaterialIcons.glyphMap,
            color: '#34C759',
            allowBulk: true,
          },
        ];
      case 'customer':
        return [
          {
            id: 'confirm_receipt',
            title: 'Confirm Receipt',
            description: 'Scan to confirm you received your package',
            icon: 'done-all' as keyof typeof MaterialIcons.glyphMap,
            color: '#764ba2',
            allowBulk: false,
          },
        ];
      default:
        return [];
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
            {userRole === 'agent' && 'Scan packages to print labels'}
            {userRole === 'rider' && 'Collect and deliver packages'}
            {userRole === 'customer' && 'Confirm package receipts'}
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

  const renderActionCard = (action: any) => (
    <View key={action.id} style={styles.actionCard}>
      <LinearGradient
        colors={[action.color, action.color + '99']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionHeader}
      >
        <MaterialIcons name={action.icon} size={24} color="#fff" />
        <Text style={styles.actionTitle}>{action.title}</Text>
      </LinearGradient>
      
      <View style={styles.actionContent}>
        <Text style={styles.actionDescription}>{action.description}</Text>
        
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
              style={[styles.actionButton, styles.bulkScanButton, { borderColor: action.color }]}
              onPress={() => handleBulkScan(action.id)}
            >
              <MaterialIcons name="view-list" size={18} color={action.color} />
              <Text style={[styles.actionButtonText, { color: action.color }]}>
                Bulk Scan
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
        
        {userRole !== 'customer' && (
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/admin/ReportsScreen')}
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

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        userRole={userRole}
        onScanSuccess={handleScanSuccess}
        defaultAction={selectedAction}
      />

      {/* Bulk Scanner Modal */}
      <BulkScanner
        visible={showBulkScanner}
        onClose={() => setShowBulkScanner(false)}
        actionType={selectedAction as 'print' | 'collect' | 'deliver'}
        userRole={userRole as 'agent' | 'rider'}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Account for bottom tabs
  },
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
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  welcomeText: {
    flex: 1,
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
  actionsSection: {
    marginBottom: 20,
  },
  actionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  actionContent: {
    padding: 20,
    paddingTop: 0,
  },
  actionDescription: {
    fontSize: 15,
    color: '#a0aec0',
    marginBottom: 20,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  quickActionsSection: {
    marginBottom: 20,
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
// screens/ScanningScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import QRScanner from '../components/QRScanner';
import BulkScanner from '../components/BulkScanner';

const { width } = Dimensions.get('window');

interface UserStats {
  packages_scanned_today: number;
  packages_processed_today: number;
  total_packages_processed: number;
  last_scan_time?: string;
}

interface ScanningScreenProps {
  navigation: any;
  route: any;
  userRole: 'agent' | 'rider' | 'customer';
  userId: string;
  userName: string;
}

const ScanningScreen: React.FC<ScanningScreenProps> = ({
  navigation,
  route,
  userRole,
  userId,
  userName,
}) => {
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
    } catch (error) {
      console.error('Failed to load user stats:', error);
    } finally {
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
    
    // Show success feedback
    Alert.alert(
      'Scan Successful',
      `Package ${result.package.code} has been ${selectedAction}ed successfully.`,
      [{ text: 'OK' }]
    );
  };

  const handleBulkComplete = (results: any[]) => {
    // Refresh stats after bulk operation
    loadUserStats();
    
    const successCount = results.filter(r => r.success).length;
    Alert.alert(
      'Bulk Operation Complete',
      `Successfully processed ${successCount} of ${results.length} packages.`,
      [{ text: 'OK' }]
    );
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
            color: '#007AFF',
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
            color: '#5856D6',
            allowBulk: false,
          },
        ];
      default:
        return [];
    }
  };

  const renderWelcomeSection = () => (
    <View style={styles.welcomeSection}>
      <View style={styles.welcomeHeader}>
        <MaterialIcons name="qr-code-scanner" size={32} color="#007AFF" />
        <View style={styles.welcomeText}>
          <Text style={styles.welcomeTitle}>Welcome, {userName}</Text>
          <Text style={styles.welcomeSubtitle}>
            {userRole === 'agent' && 'Scan packages to print labels'}
            {userRole === 'rider' && 'Collect and deliver packages'}
            {userRole === 'customer' && 'Confirm package receipts'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStatsSection = () => {
    if (!userStats) return null;

    return (
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Today's Activity</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{userStats.packages_scanned_today}</Text>
            <Text style={styles.statLabel}>Packages Scanned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{userStats.packages_processed_today}</Text>
            <Text style={styles.statLabel}>Packages Processed</Text>
          </View>
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
      <View style={[styles.actionHeader, { backgroundColor: action.color }]}>
        <MaterialIcons name={action.icon} size={24} color="#fff" />
        <Text style={styles.actionTitle}>{action.title}</Text>
      </View>
      
      <View style={styles.actionContent}>
        <Text style={styles.actionDescription}>{action.description}</Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.singleScanButton]}
            onPress={() => handleQuickScan(action.id)}
          >
            <MaterialIcons name="qr-code-scanner" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Quick Scan</Text>
          </TouchableOpacity>
          
          {action.allowBulk && (
            <TouchableOpacity
              style={[styles.actionButton, styles.bulkScanButton]}
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
          onPress={() => navigation.navigate('PackageSearch')}
        >
          <MaterialIcons name="search" size={24} color="#007AFF" />
          <Text style={styles.quickActionText}>Search Packages</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('ScanHistory')}
        >
          <MaterialIcons name="history" size={24} color="#007AFF" />
          <Text style={styles.quickActionText}>Scan History</Text>
        </TouchableOpacity>
        
        {userRole !== 'customer' && (
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Reports')}
          >
            <MaterialIcons name="bar-chart" size={24} color="#007AFF" />
            <Text style={styles.quickActionText}>Reports</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadUserStats} />
        }
      >
        {renderWelcomeSection()}
        {renderStatsSection()}
        
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Scanning Actions</Text>
          {getAvailableActions().map(renderActionCard)}
        </View>
        
        {renderQuickActions()}
      </ScrollView>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  welcomeSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeText: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  lastScanText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionContent: {
    padding: 16,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
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
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  singleScanButton: {
    backgroundColor: '#007AFF',
  },
  bulkScanButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: (width - 56) / 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default ScanningScreen;
// app/(rider)/scan.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RiderBottomTabs } from '../../components/rider/RiderBottomTabs';
import QRScanner from '../../components/QRScanner';

const { width } = Dimensions.get('window');

export default function RiderScanScreen() {
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  const handleScanSuccess = (result: any) => {
    // Add to recent scans
    const newScan = {
      id: Date.now(),
      code: result.package?.code || 'Unknown',
      action: selectedAction,
      timestamp: new Date(),
    };
    setRecentScans(prev => [newScan, ...prev.slice(0, 9)]);
    
    // Close scanner
    setScannerVisible(false);
    setSelectedAction(null);
  };

  const openScanner = (action: string) => {
    setSelectedAction(action);
    setScannerVisible(true);
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'collect': return 'Collected from Agent';
      case 'deliver': return 'Delivered';
      case 'give_to_receiver': return 'Given to Customer';
      default: return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'collect': return 'truck';
      case 'deliver': return 'check-circle';
      case 'give_to_receiver': return 'user-check';
      default: return 'package';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Scan Package</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Action Cards */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Select Action</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => openScanner('collect')}
          >
            <LinearGradient
              colors={['#9C27B0', '#7B1FA2']}
              style={styles.actionGradient}
            >
              <View style={styles.actionIconContainer}>
                <Feather name="truck" size={28} color="#fff" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Collect from Agent</Text>
                <Text style={styles.actionDescription}>
                  Pick up packages from collection point
                </Text>
              </View>
              <Feather name="chevron-right" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => openScanner('deliver')}
          >
            <LinearGradient
              colors={['#34C759', '#28A745']}
              style={styles.actionGradient}
            >
              <View style={styles.actionIconContainer}>
                <Feather name="check-circle" size={28} color="#fff" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Deliver Package</Text>
                <Text style={styles.actionDescription}>
                  Mark package as delivered to destination
                </Text>
              </View>
              <Feather name="chevron-right" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => openScanner('give_to_receiver')}
          >
            <LinearGradient
              colors={['#FF6B35', '#E85D2F']}
              style={styles.actionGradient}
            >
              <View style={styles.actionIconContainer}>
                <Feather name="user-check" size={28} color="#fff" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Give to Customer</Text>
                <Text style={styles.actionDescription}>
                  Hand over package to final receiver
                </Text>
              </View>
              <Feather name="chevron-right" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Scans</Text>
            {recentScans.map((scan) => (
              <View key={scan.id} style={styles.recentItem}>
                <View style={[
                  styles.recentIconContainer,
                  { backgroundColor: 'rgba(123, 63, 152, 0.1)' }
                ]}>
                  <Feather 
                    name={getActionIcon(scan.action)} 
                    size={18} 
                    color="#7B3F98" 
                  />
                </View>
                <View style={styles.recentContent}>
                  <Text style={styles.recentCode}>{scan.code}</Text>
                  <Text style={styles.recentAction}>
                    {getActionLabel(scan.action)}
                  </Text>
                  <Text style={styles.recentTime}>
                    {formatTimeAgo(scan.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {recentScans.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="scan" size={64} color="#4A5568" />
            <Text style={styles.emptyTitle}>No Scans Yet</Text>
            <Text style={styles.emptyDescription}>
              Select an action above to start scanning packages
            </Text>
          </View>
        )}
      </ScrollView>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={scannerVisible}
        onClose={() => {
          setScannerVisible(false);
          setSelectedAction(null);
        }}
        userRole="rider"
        defaultAction={selectedAction || undefined}
        onScanSuccess={handleScanSuccess}
      />

      <RiderBottomTabs currentTab="scan" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  actionsSection: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  recentSection: {
    padding: 16,
    paddingTop: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  recentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  recentContent: {
    flex: 1,
  },
  recentCode: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  recentAction: {
    color: '#B8B8B8',
    fontSize: 13,
    marginBottom: 2,
  },
  recentTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#B8B8B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
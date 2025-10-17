// app/(rider)/scan.tsx - Updated with RiderQRScanner and batch delivery

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { RiderBottomTabs } from '../../components/rider/RiderBottomTabs';
import RiderQRScanner from '../../components/RiderQRScanner';
import Toast from 'react-native-toast-message';
import api from '../../lib/api';

const { width } = Dimensions.get('window');

interface ScannedPackage {
  id: string;
  code: string;
  route_description: string;
  sender_name: string;
  receiver_name: string;
  scanned_at: Date;
}

export default function RiderScanScreen() {
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'collect' | 'deliver' | 'give_to_receiver'>('collect');
  const [recentScans, setRecentScans] = useState<any[]>([]);
  
  // Batch delivery state
  const [deliveryBatch, setDeliveryBatch] = useState<ScannedPackage[]>([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [processingDelivery, setProcessingDelivery] = useState(false);

  const handleScanSuccess = (result: any) => {
    const newScan = {
      id: Date.now().toString(),
      code: result.code,
      route_description: result.route_description,
      sender_name: result.sender_name,
      receiver_name: result.receiver_name,
      action: selectedAction,
      timestamp: new Date(),
      scanned_at: new Date(),
    };

    // Add to recent scans
    setRecentScans(prev => [newScan, ...prev.slice(0, 9)]);
    
    // If scanning for delivery, add to batch
    if (selectedAction === 'deliver') {
      setDeliveryBatch(prev => [...prev, newScan]);
      Toast.show({
        type: 'success',
        text1: 'Added to Delivery Batch',
        text2: `${result.code} - ${deliveryBatch.length + 1} packages ready`,
        position: 'top',
        visibilityTime: 2000,
      });
    }
  };

  const openScanner = (action: 'collect' | 'deliver' | 'give_to_receiver') => {
    setSelectedAction(action);
    setScannerVisible(true);
  };

  const removeFromBatch = (packageId: string) => {
    setDeliveryBatch(prev => prev.filter(pkg => pkg.id !== packageId));
    Toast.show({
      type: 'info',
      text1: 'Removed from Batch',
      text2: 'Package removed from delivery batch',
      position: 'top',
      visibilityTime: 2000,
    });
  };

  const handleDeliverAll = async () => {
    if (deliveryBatch.length === 0) {
      Toast.show({
        type: 'warning',
        text1: 'No Packages',
        text2: 'Scan packages first before delivering',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    setShowDeliveryModal(true);
  };

  const confirmDeliverAll = async () => {
    setProcessingDelivery(true);

    try {
      const packageCodes = deliveryBatch.map(pkg => pkg.code);

      const response = await api.post('/api/v1/scanning/bulk_scan', {
        package_codes: packageCodes,
        action_type: 'deliver',
        metadata: {
          bulk_operation: true,
          location: null,
          device_info: {
            platform: 'react-native',
            timestamp: new Date().toISOString()
          }
        }
      });

      if (response.data.success) {
        const successful = response.data.data.summary.successful;
        const total = response.data.data.summary.total;

        Toast.show({
          type: 'success',
          text1: 'Delivery Complete',
          text2: `Successfully delivered ${successful} of ${total} packages`,
          position: 'top',
          visibilityTime: 4000,
        });

        // Clear batch
        setDeliveryBatch([]);
        setShowDeliveryModal(false);
      } else {
        throw new Error(response.data.message || 'Delivery failed');
      }

    } catch (error: any) {
      console.error('Bulk delivery failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Delivery Failed',
        text2: error.response?.data?.message || 'Failed to deliver packages',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setProcessingDelivery(false);
    }
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
      case 'collect': return 'Collected';
      case 'deliver': return 'For Delivery';
      case 'give_to_receiver': return 'Handed Over';
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
        {deliveryBatch.length > 0 && (
          <View style={styles.batchIndicator}>
            <MaterialIcons name="inventory" size={16} color="#fff" />
            <Text style={styles.batchCount}>{deliveryBatch.length}</Text>
          </View>
        )}
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
                  Auto-collects on scan
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
                <Text style={styles.actionTitle}>Scan for Delivery</Text>
                <Text style={styles.actionDescription}>
                  Batch multiple packages
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
                  Hand over to final receiver
                </Text>
              </View>
              <Feather name="chevron-right" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Delivery Batch Section */}
        {deliveryBatch.length > 0 && (
          <View style={styles.batchSection}>
            <View style={styles.batchHeader}>
              <Text style={styles.sectionTitle}>Delivery Batch ({deliveryBatch.length})</Text>
              <TouchableOpacity 
                style={styles.clearBatchButton}
                onPress={() => setDeliveryBatch([])}
              >
                <Text style={styles.clearBatchText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            
            {deliveryBatch.map((pkg) => (
              <View key={pkg.id} style={styles.batchItem}>
                <View style={styles.batchItemIcon}>
                  <MaterialIcons name="inventory" size={20} color="#34C759" />
                </View>
                <View style={styles.batchItemContent}>
                  <Text style={styles.batchItemCode}>{pkg.code}</Text>
                  <Text style={styles.batchItemRoute}>{pkg.route_description}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => removeFromBatch(pkg.id)}
                  style={styles.removeButton}
                >
                  <MaterialIcons name="close" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity 
              style={styles.deliverAllButton}
              onPress={handleDeliverAll}
            >
              <LinearGradient
                colors={['#34C759', '#28A745']}
                style={styles.deliverAllGradient}
              >
                <MaterialIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.deliverAllText}>
                  Deliver All ({deliveryBatch.length})
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Scans</Text>
            {recentScans.map((scan) => (
              <View key={scan.id} style={styles.recentItem}>
                <View style={[
                  styles.recentIconContainer,
                  { backgroundColor: getActionColor(scan.action) }
                ]}>
                  <Feather 
                    name={getActionIcon(scan.action)} 
                    size={18} 
                    color="#fff" 
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

        {recentScans.length === 0 && deliveryBatch.length === 0 && (
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
      <RiderQRScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        actionType={selectedAction}
        onScanSuccess={handleScanSuccess}
      />

      {/* Delivery Confirmation Modal */}
      <Modal
        visible={showDeliveryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeliveryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deliveryModal}>
            <LinearGradient
              colors={['#34C759', '#28A745']}
              style={styles.deliveryModalHeader}
            >
              <MaterialIcons name="check-circle" size={32} color="#fff" />
              <Text style={styles.deliveryModalTitle}>Confirm Delivery</Text>
            </LinearGradient>
            
            <View style={styles.deliveryModalContent}>
              <Text style={styles.deliveryModalMessage}>
                Are you sure you want to mark {deliveryBatch.length} package{deliveryBatch.length !== 1 ? 's' : ''} as delivered?
              </Text>
              
              <ScrollView style={styles.deliveryModalList} showsVerticalScrollIndicator={false}>
                {deliveryBatch.map((pkg) => (
                  <View key={pkg.id} style={styles.deliveryModalItem}>
                    <MaterialIcons name="check" size={16} color="#34C759" />
                    <Text style={styles.deliveryModalItemText}>{pkg.code}</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.deliveryModalButtons}>
                <TouchableOpacity
                  style={[styles.deliveryModalButton, styles.deliveryModalButtonPrimary]}
                  onPress={confirmDeliverAll}
                  disabled={processingDelivery}
                >
                  <LinearGradient
                    colors={['#34C759', '#28A745']}
                    style={styles.deliveryModalButtonGradient}
                  >
                    {processingDelivery ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="check" size={18} color="#fff" />
                        <Text style={styles.deliveryModalButtonText}>Confirm Delivery</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.deliveryModalButton}
                  onPress={() => setShowDeliveryModal(false)}
                  disabled={processingDelivery}
                >
                  <View style={[styles.deliveryModalButtonGradient, styles.cancelButton]}>
                    <MaterialIcons name="close" size={18} color="#a0aec0" />
                    <Text style={[styles.deliveryModalButtonText, { color: '#a0aec0' }]}>Cancel</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Toast />
      <RiderBottomTabs currentTab="scan" />
    </SafeAreaView>
  );
}

function getActionColor(action: string): string {
  switch (action) {
    case 'collect': return 'rgba(156, 39, 176, 0.1)';
    case 'deliver': return 'rgba(52, 199, 89, 0.1)';
    case 'give_to_receiver': return 'rgba(255, 107, 53, 0.1)';
    default: return 'rgba(123, 63, 152, 0.1)';
  }
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  batchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  batchCount: {
    color: '#fff',
    fontSize: 14,
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
  batchSection: {
    padding: 16,
    paddingTop: 8,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearBatchButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2d3748',
  },
  clearBatchText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  batchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  batchItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  batchItemContent: {
    flex: 1,
  },
  batchItemCode: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  batchItemRoute: {
    color: '#B8B8B8',
    fontSize: 13,
  },
  removeButton: {
    padding: 4,
  },
  deliverAllButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  deliverAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  deliverAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deliveryModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d3748',
    overflow: 'hidden',
    maxHeight: '80%',
  },
  deliveryModalHeader: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  deliveryModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  deliveryModalContent: {
    padding: 24,
  },
  deliveryModalMessage: {
    fontSize: 16,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  deliveryModalList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  deliveryModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d3748',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  deliveryModalItemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  deliveryModalButtons: {
    gap: 12,
  },
  deliveryModalButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  deliveryModalButtonPrimary: {},
  deliveryModalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#2d3748',
  },
  deliveryModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
// app/(agent)/scan.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { AgentQRScanner } from '../../components/agent/AgentQRScanner';
import { useAlertModal } from '../../components/agent/AlertModal';

export default function ScanPackageScreen() {
  const router = useRouter();
  const { alertConfig, showAlert, hideAlert, AlertModalComponent } = useAlertModal();
  
  const [packageCode, setPackageCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedPackage, setScannedPackage] = useState<any>(null);
  const [eventType, setEventType] = useState<string>('scan');
  const [showQRScanner, setShowQRScanner] = useState(false);

  const eventTypes = [
    { value: 'scan', label: 'General Scan', icon: 'maximize' },
    { value: 'printed_by_agent', label: 'Print Label', icon: 'printer' },
    { value: 'collected_by_rider', label: 'Collected', icon: 'truck' },
    { value: 'processed_by_warehouse', label: 'Processed', icon: 'package' },
  ];

  const handleScan = async (code?: string) => {
    const codeToScan = code || packageCode;
    
    if (!codeToScan.trim()) {
      showAlert({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter a package code',
        buttons: [{ text: 'OK', onPress: hideAlert }]
      });
      return;
    }

    setScanning(true);
    try {
      const response = await api.post('/api/v1/staff/scan_events', {
        package_code: codeToScan.trim(),
        event_type: eventType,
        location: 'Agent Office',
      });

      if (response.data.success) {
        setScannedPackage(response.data.data.package);
        showAlert({
          type: 'success',
          title: 'Scan Successful',
          message: response.data.message,
          buttons: [{ text: 'OK', onPress: hideAlert }]
        });
        setPackageCode('');
      } else {
        showAlert({
          type: 'error',
          title: 'Scan Failed',
          message: response.data.message,
          buttons: [{ text: 'OK', onPress: hideAlert }]
        });
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      showAlert({
        type: 'error',
        title: 'Scan Failed',
        message: error.response?.data?.message || 'Failed to scan package',
        buttons: [{ text: 'OK', onPress: hideAlert }]
      });
    } finally {
      setScanning(false);
    }
  };

  const handleQRScan = (code: string) => {
    console.log('📷 QR Code scanned:', code);
    setPackageCode(code);
    setShowQRScanner(false);
    // Automatically trigger scan with the scanned code
    setTimeout(() => {
      handleScan(code);
    }, 300);
  };

  const handleClearCode = () => {
    setPackageCode('');
    setScannedPackage(null);
  };

  const handleViewTracking = () => {
    if (scannedPackage) {
      router.push({
        pathname: '/(agent)/track',
        params: { 
          code: scannedPackage.code,
          packageId: scannedPackage.id.toString() 
        }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Package</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.scanSection}>
          <View style={styles.scanIconContainer}>
            <Feather name="maximize" size={48} color="#7B3F98" />
          </View>
          <Text style={styles.scanTitle}>Scan Package Code</Text>
          <Text style={styles.scanSubtitle}>Enter or scan the package tracking code</Text>

          <View style={styles.inputContainer}>
            <Feather name="hash" size={20} color="#8E8E93" />
            <TextInput
              style={styles.input}
              placeholder="Enter package code"
              placeholderTextColor="#8E8E93"
              value={packageCode}
              onChangeText={setPackageCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {packageCode.length > 0 && (
              <TouchableOpacity onPress={handleClearCode}>
                <Feather name="x-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {/* QR Scanner Button */}
          <TouchableOpacity
            style={styles.qrScanButton}
            onPress={() => setShowQRScanner(true)}
          >
            <Feather name="camera" size={20} color="#7B3F98" />
            <Text style={styles.qrScanButtonText}>Scan QR Code</Text>
          </TouchableOpacity>

          <View style={styles.eventTypeSection}>
            <Text style={styles.eventTypeLabel}>Scan Type</Text>
            <View style={styles.eventTypeGrid}>
              {eventTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.eventTypeCard,
                    eventType === type.value && styles.eventTypeCardActive,
                  ]}
                  onPress={() => setEventType(type.value)}
                >
                  <Feather
                    name={type.icon as any}
                    size={20}
                    color={eventType === type.value ? '#fff' : '#7B3F98'}
                  />
                  <Text
                    style={[
                      styles.eventTypeText,
                      eventType === type.value && styles.eventTypeTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
            onPress={() => handleScan()}
            disabled={scanning}
          >
            {scanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check-circle" size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Scan Package</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {scannedPackage && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Feather name="check-circle" size={24} color="#34C759" />
              <Text style={styles.resultTitle}>Scan Successful</Text>
            </View>

            <View style={styles.packageCard}>
              <View style={styles.packageHeader}>
                <Text style={styles.packageCode}>{scannedPackage.code}</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#34C759' }]}>
                  <Text style={styles.statusText}>{scannedPackage.state_display}</Text>
                </View>
              </View>

              <View style={styles.packageDetail}>
                <Feather name="user" size={16} color="#8E8E93" />
                <Text style={styles.packageDetailLabel}>Receiver:</Text>
                <Text style={styles.packageDetailValue}>
                  {scannedPackage.receiver.name}
                </Text>
              </View>

              <View style={styles.packageDetail}>
                <Feather name="map-pin" size={16} color="#8E8E93" />
                <Text style={styles.packageDetailLabel}>Route:</Text>
                <Text style={styles.packageDetailValue}>
                  {scannedPackage.route.description}
                </Text>
              </View>

              <View style={styles.packageDetail}>
                <Feather name="package" size={16} color="#8E8E93" />
                <Text style={styles.packageDetailLabel}>Type:</Text>
                <Text style={styles.packageDetailValue}>
                  {scannedPackage.delivery_type_display}
                </Text>
              </View>

              <TouchableOpacity style={styles.trackingButton} onPress={handleViewTracking}>
                <Feather name="eye" size={16} color="#fff" />
                <Text style={styles.trackingButtonText}>View Full Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* QR Scanner Modal */}
      <AgentQRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
        title="Scan Package QR Code"
      />

      {/* Alert Modal */}
      {AlertModalComponent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  scanSection: {
    padding: 24,
    alignItems: 'center',
  },
  scanIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  scanSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  qrScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    gap: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(123, 63, 152, 0.3)',
  },
  qrScanButtonText: {
    color: '#7B3F98',
    fontSize: 16,
    fontWeight: '600',
  },
  eventTypeSection: {
    width: '100%',
    marginBottom: 24,
  },
  eventTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  eventTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventTypeCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  eventTypeCardActive: {
    backgroundColor: '#7B3F98',
    borderColor: '#9F5FB8',
  },
  eventTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  eventTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7B3F98',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    gap: 8,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSection: {
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  packageCard: {
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  packageDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  packageDetailLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  packageDetailValue: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7B3F98',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  trackingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
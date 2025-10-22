// components/agent/AgentQRScanner.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useAlertModal } from './AlertModal';

const { width } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.7;

interface AgentQRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export const AgentQRScanner: React.FC<AgentQRScannerProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Scan Package QR Code'
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // CRITICAL: Reset all states when modal visibility changes
  useEffect(() => {
    if (visible) {
      console.log('📷 AgentQRScanner opened - Resetting all states');
      setScanned(false);
      setIsProcessing(false);
      requestCameraPermission();
    } else {
      // Clean up when closing
      console.log('📷 AgentQRScanner closed - Cleaning up');
      setScanned(false);
      setIsProcessing(false);
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    try {
      console.log('🔐 Requesting camera permission...');
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status:', status);
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to scan QR codes.',
          [
            { text: 'Cancel', style: 'cancel', onPress: onClose },
            { 
              text: 'Open Settings', 
              onPress: () => {
                onClose();
                // Optionally open settings
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error requesting camera permission:', error);
      setHasPermission(false);
      Alert.alert(
        'Camera Error',
        'Failed to request camera permission. Please try again.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    // Prevent multiple scans
    if (scanned || isProcessing) {
      console.log('⚠️ Already processing scan, ignoring...');
      return;
    }

    console.log('📷 QR Code scanned:', { type, data });
    
    // Immediately set flags to prevent double scanning
    setScanned(true);
    setIsProcessing(true);

    // Extract package code from QR data
    let packageCode = data.trim();
    
    // If it's a URL, extract the code
    if (data.includes('track/') || data.includes('package/') || data.includes('p/')) {
      const patterns = [
        /track\/([A-Z0-9-]+)/i,
        /package\/([A-Z0-9-]+)/i,
        /p\/([A-Z0-9-]+)/i,
        /code=([A-Z0-9-]+)/i
      ];
      
      for (const pattern of patterns) {
        const matches = data.match(pattern);
        if (matches && matches[1]) {
          packageCode = matches[1];
          break;
        }
      }
    }

    console.log('📦 Extracted package code:', packageCode);
    
    // Call the onScan callback
    onScan(packageCode);
    
    // Close the scanner after a brief delay
    setTimeout(() => {
      handleClose();
    }, 500);
  };

  const handleClose = () => {
    console.log('🔚 Closing AgentQRScanner');
    setScanned(false);
    setIsProcessing(false);
    setHasPermission(null);
    onClose();
  };

  const handleRetry = async () => {
    console.log('🔄 Retrying camera permission...');
    setScanned(false);
    setIsProcessing(false);
    await requestCameraPermission();
  };

  // Don't render anything if not visible
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Scanner Area */}
        <View style={styles.scannerContainer}>
          {hasPermission === null ? (
            <View style={styles.centerContent}>
              <Feather name="camera" size={64} color="#7B3F98" />
              <Text style={styles.messageText}>Requesting camera permission...</Text>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.centerContent}>
              <Feather name="camera-off" size={64} color="#FF3B30" />
              <Text style={styles.errorTitle}>Camera Access Denied</Text>
              <Text style={styles.errorMessage}>
                Please enable camera access in your device settings to scan QR codes.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Feather name="refresh-cw" size={20} color="#fff" />
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'code93'],
              }}
            >
              <View style={styles.overlay}>
                {/* Top overlay */}
                <View style={styles.overlaySection}>
                  <Text style={styles.instructionText}>
                    {scanned ? 'Processing...' : 'Position QR code within the frame'}
                  </Text>
                </View>
                
                {/* Scanner frame */}
                <View style={styles.scannerFrameContainer}>
                  <View style={styles.overlaySide} />
                  <View style={styles.scannerFrame}>
                    {/* Corner markers */}
                    <View style={[styles.corner, styles.cornerTopLeft]} />
                    <View style={[styles.corner, styles.cornerTopRight]} />
                    <View style={[styles.corner, styles.cornerBottomLeft]} />
                    <View style={[styles.corner, styles.cornerBottomRight]} />
                    
                    {/* Scanning line animation */}
                    {!scanned && (
                      <View style={styles.scanLineContainer}>
                        <View style={styles.scanLine} />
                      </View>
                    )}
                    
                    {/* Scanned success overlay */}
                    {scanned && (
                      <View style={styles.scannedOverlay}>
                        <Feather name="check-circle" size={64} color="#34C759" />
                        <Text style={styles.scannedText}>Scanned!</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.overlaySide} />
                </View>
                
                {/* Bottom overlay */}
                <View style={styles.overlaySection}>
                  <Text style={styles.hintText}>
                    {scanned ? 'Please wait...' : 'Hold steady for automatic scanning'}
                  </Text>
                </View>
              </View>
            </CameraView>
          )}
        </View>

        {/* Instructions */}
        {hasPermission && (
          <View style={styles.instructions}>
            <View style={styles.instructionItem}>
              <Feather name="maximize" size={20} color="#7B3F98" />
              <Text style={styles.instructionItemText}>
                Align QR code within the frame
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Feather name="sun" size={20} color="#7B3F98" />
              <Text style={styles.instructionItemText}>
                Ensure good lighting for best results
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Feather name="zap" size={20} color="#7B3F98" />
              <Text style={styles.instructionItemText}>
                Scanner will detect QR code automatically
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#111B21',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 63, 152, 0.2)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scannerContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  overlaySection: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scannerFrameContainer: {
    flexDirection: 'row',
    height: SCANNER_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  scannerFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#7B3F98',
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#7B3F98',
    shadowColor: '#7B3F98',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  scannedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedText: {
    color: '#34C759',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  hintText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  instructions: {
    backgroundColor: '#111B21',
    padding: 24,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(123, 63, 152, 0.2)',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionItemText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#111B21',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#7B3F98',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
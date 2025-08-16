// components/PrinterTestComponent.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import PrintReceiptService from '../services/PrintReceiptService';

interface PrinterTestProps {
  visible?: boolean;
}

const PrinterTestComponent: React.FC<PrinterTestProps> = ({ visible = true }) => {
  const [testing, setTesting] = useState(false);
  const printService = PrintReceiptService.getInstance();

  const testPrint = async () => {
    setTesting(true);
    
    try {
      const success = await printService.testPrint();
      
      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Test Print Successful',
          text2: 'Check your printer for the test receipt',
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error: any) {
      console.error('Test print failed:', error);
      
      let errorMessage = 'Test print failed';
      if (error.message.includes('No printer connected')) {
        errorMessage = 'No printer connected. Go to Settings > Bluetooth to connect a printer.';
      } else if (error.message.includes('not connected')) {
        errorMessage = 'Printer disconnected. Check Bluetooth connection.';
      }
      
      Alert.alert('Test Print Failed', errorMessage);
    } finally {
      setTesting(false);
    }
  };

  const testRealPackagePrint = async () => {
    setTesting(true);
    
    try {
      const demoPackage = {
        code: 'PKG-DEMO-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        receiver_name: 'John Doe',
        route_description: 'Nairobi CBD - Moi Avenue',
        sender_name: 'GLT Logistics Hub',
      };
      
      const success = await printService.printPackageReceipt(demoPackage);
      
      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Demo Receipt Printed',
          text2: `Demo receipt for ${demoPackage.code} printed successfully`,
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error: any) {
      console.error('Demo print failed:', error);
      
      Alert.alert('Demo Print Failed', error.message || 'Failed to print demo receipt');
    } finally {
      setTesting(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.content}
      >
        <View style={styles.header}>
          <MaterialIcons name="print" size={32} color="#667eea" />
          <Text style={styles.title}>Printer Test</Text>
          <Text style={styles.subtitle}>Test your Bluetooth printer connection</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={testPrint}
            disabled={testing}
          >
            <LinearGradient
              colors={['#FF9500', '#FF8C00']}
              style={styles.buttonGradient}
            >
              <MaterialIcons name="test-tube" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {testing ? 'Testing...' : 'Test Basic Print'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={testRealPackagePrint}
            disabled={testing}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.buttonGradient}
            >
              <MaterialIcons name="receipt" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {testing ? 'Printing...' : 'Test Package Receipt'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Expected Receipt Format:</Text>
          <View style={styles.receiptPreview}>
            <Text style={styles.previewText}>GLT LOGISTICS</Text>
            <Text style={styles.previewSubtext}>If lost contact us via:</Text>
            <Text style={styles.previewSubtext}>gltlogistics-ke@gmail.com</Text>
            <Text style={styles.previewSubtext}>Or 0712293377</Text>
            <Text style={styles.previewDivider}>========================</Text>
            <Text style={styles.previewText}>PACKAGE CODE:</Text>
            <Text style={styles.previewCode}>PKG-DEMO-20240814</Text>
            <Text style={styles.previewText}>TO: John Doe</Text>
            <Text style={styles.previewText}>DESTINATION:</Text>
            <Text style={styles.previewText}>Nairobi CBD - Moi Avenue</Text>
            <Text style={styles.previewDivider}>------------------------</Text>
            <Text style={styles.previewText}>[QR CODE]</Text>
            <Text style={styles.previewText}>PKG-DEMO-20240814</Text>
            <Text style={styles.previewDivider}>------------------------</Text>
            <Text style={styles.previewSubtext}>Designed by Infinity.Co</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
    overflow: 'hidden',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  testButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoContainer: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  receiptPreview: {
    backgroundColor: '#0d1117',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  previewText: {
    fontSize: 12,
    color: '#a0aec0',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  previewSubtext: {
    fontSize: 10,
    color: '#718096',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  previewCode: {
    fontSize: 12,
    color: '#667eea',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    lineHeight: 16,
  },
  previewDivider: {
    fontSize: 10,
    color: '#4a5568',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});

export default PrinterTestComponent;
// app/(rider)/scan.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RiderBottomTabs } from '../../components/rider/RiderBottomTabs';

const { width } = Dimensions.get('window');

export default function RiderScanScreen() {
  const [flashOn, setFlashOn] = useState(false);

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
        <TouchableOpacity 
          style={styles.flashButton}
          onPress={() => setFlashOn(!flashOn)}
        >
          <Feather 
            name={flashOn ? 'zap' : 'zap-off'} 
            size={22} 
            color="#fff" 
          />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.content}>
        {/* Scanner Area */}
        <View style={styles.scannerContainer}>
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            <View style={styles.scanLine} />
          </View>
          
          <Text style={styles.scanText}>
            Position QR code or barcode within the frame
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <Feather name="image" size={24} color="#7B3F98" />
            <Text style={styles.actionButtonText}>Upload QR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Feather name="edit" size={24} color="#7B3F98" />
            <Text style={styles.actionButtonText}>Enter Code</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Scans */}
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent Scans</Text>
          {[1, 2, 3].map((item) => (
            <TouchableOpacity key={item} style={styles.recentItem}>
              <View style={styles.recentIcon}>
                <Feather name="package" size={18} color="#7B3F98" />
              </View>
              <View style={styles.recentContent}>
                <Text style={styles.recentCode}>GLT-{12345 - item}</Text>
                <Text style={styles.recentTime}>{item} hour{item > 1 ? 's' : ''} ago</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#8E8E93" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  flashButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  scannerContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scannerFrame: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#7B3F98',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#7B3F98',
    opacity: 0.7,
  },
  scanText: {
    color: '#B8B8B8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1F2C34',
    padding: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  recentSection: {
    paddingHorizontal: 16,
  },
  recentTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentContent: {
    flex: 1,
  },
  recentCode: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  recentTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
});
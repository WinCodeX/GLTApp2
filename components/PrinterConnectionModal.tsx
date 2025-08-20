// components/PrinterConnectionModal.tsx - New styled modal component

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface PrinterConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  onGoToSettings: () => void;
  onContinueAnyway: () => void;
  title: string;
  message: string;
  isBluetoothUnavailable?: boolean;
}

const PrinterConnectionModal: React.FC<PrinterConnectionModalProps> = ({
  visible,
  onClose,
  onGoToSettings,
  onContinueAnyway,
  title,
  message,
  isBluetoothUnavailable = false,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#FF9500', '#FF8C00']}
            style={styles.modalHeader}
          >
            <MaterialIcons 
              name={isBluetoothUnavailable ? "bluetooth-disabled" : "print-disabled"} 
              size={32} 
              color="#fff" 
            />
            <Text style={styles.modalTitle}>{title}</Text>
          </LinearGradient>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>{message}</Text>
            
            <View style={styles.modalButtons}>
              {!isBluetoothUnavailable && (
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={onGoToSettings}
                >
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.modalButtonGradient}
                  >
                    <MaterialIcons name="settings" size={18} color="#fff" />
                    <Text style={styles.modalButtonText}>Go to Settings</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={onContinueAnyway}
              >
                <View style={[styles.modalButtonGradient, styles.outlineButton]}>
                  <MaterialIcons name="warning" size={18} color="#FF9500" />
                  <Text style={[styles.modalButtonText, { color: '#FF9500' }]}>
                    Continue Anyway
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={onClose}
              >
                <View style={[styles.modalButtonGradient, styles.cancelButton]}>
                  <Text style={[styles.modalButtonText, { color: '#a0aec0' }]}>
                    Cancel
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d3748',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  modalContent: {
    padding: 24,
  },
  modalMessage: {
    fontSize: 16,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  modalButtons: {
    gap: 12,
  },
  modalButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  cancelButton: {
    backgroundColor: '#2d3748',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default PrinterConnectionModal;
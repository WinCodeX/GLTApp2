// components/AccountSelectionModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';

interface AccountSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup: () => void;
}

export default function AccountSelectionModal({ 
  visible, 
  onClose, 
  onLogin, 
  onSignup 
}: AccountSelectionModalProps) {
  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent 
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add account</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={onLogin}>
              <Text style={styles.primaryButtonText}>Log into existing account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={onSignup}>
              <Text style={styles.secondaryButtonText}>Create new account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    padding: 20,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#1877f2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
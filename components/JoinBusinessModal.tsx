// components/JoinBusinessModal.tsx - Optimized size and performance
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { joinBusiness } from '../lib/helpers/business';

interface JoinBusinessModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: () => void;
}

export default function JoinBusinessModal({ visible, onClose, onJoin }: JoinBusinessModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = useCallback(async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    try {
      await joinBusiness(inviteCode.trim());

      Toast.show({
        type: 'success',
        text1: 'Joined Business',
        text2: 'You have successfully joined the business',
      });

      setInviteCode('');
      onJoin();
    } catch (error: any) {
      console.error('Join business error:', error);
      Alert.alert(
        'Join Failed',
        error.message || 'Failed to join business. Please check the invite code and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [inviteCode, onJoin]);

  const handleClose = useCallback(() => {
    if (!loading) {
      setInviteCode('');
      onClose();
    }
  }, [loading, onClose]);

  const handlePaste = useCallback(async () => {
    try {
      const { Clipboard } = await import('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      if (text) {
        setInviteCode(text.trim());
        Toast.show({
          type: 'info',
          text1: 'Pasted',
          text2: 'Invite code pasted from clipboard',
        });
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  }, []);

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade"
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.headerIcon}>
                  <Feather name="users" size={24} color="#7c3aed" />
                </View>
                <Text style={styles.modalTitle}>Join Existing Business</Text>
                <Text style={styles.modalSubtitle}>
                  Enter the invite code to join your team
                </Text>
              </View>

              {/* Form */}
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Invite Code *</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={inviteCode}
                      onChangeText={setInviteCode}
                      placeholder="Enter invite code"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      autoCapitalize="characters"
                      maxLength={20}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.pasteButton}
                      onPress={handlePaste}
                      disabled={loading}
                    >
                      <Feather name="clipboard" size={16} color="#7c3aed" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.helpText}>
                    Ask your team member to share the invite code
                  </Text>
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                  <Text style={styles.instructionsTitle}>How to join:</Text>
                  <View style={styles.instructionItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepText}>1</Text>
                    </View>
                    <Text style={styles.instructionText}>
                      Get invite code from business owner
                    </Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepText}>2</Text>
                    </View>
                    <Text style={styles.instructionText}>
                      Enter code and tap "Join Business"
                    </Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepText}>3</Text>
                    </View>
                    <Text style={styles.instructionText}>
                      Start sending packages with your team
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={[styles.secondaryButton, loading && styles.disabledButton]}
                  onPress={handleClose}
                  disabled={loading}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!inviteCode.trim() || loading) && styles.disabledButton
                  ]}
                  onPress={handleJoin}
                  disabled={!inviteCode.trim() || loading}
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.primaryButtonText}>Joining...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryButtonText}>Join Business</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    width: '90%',
    maxWidth: 450,
    maxHeight: '70%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  formContainer: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 45,
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pasteButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  instructionsContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingBottom: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
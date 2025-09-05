// components/JoinBusinessModal.tsx - Enhanced join business modal
import React, { useState } from 'react';
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

  const handleJoin = async () => {
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
  };

  const handleClose = () => {
    if (!loading) {
      setInviteCode('');
      onClose();
    }
  };

  const handlePaste = async () => {
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
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
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
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.headerIcon}>
                  <Feather name="users" size={28} color="#7c3aed" />
                </View>
                <Text style={styles.modalTitle}>Join Existing Business</Text>
                <Text style={styles.modalSubtitle}>
                  Enter the invite code shared by your team member to join their business
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
                    Ask your team member to share the invite code with you
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
                      Ask the business owner for an invite code
                    </Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepText}>2</Text>
                    </View>
                    <Text style={styles.instructionText}>
                      Enter the code above and tap "Join Business"
                    </Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepText}>3</Text>
                    </View>
                    <Text style={styles.instructionText}>
                      Start collaborating with your team
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    width: '100%',
    maxWidth: 450,
    maxHeight: '85%',
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pasteButton: {
    position: 'absolute',
    right: 12,
    top: 14,
    padding: 4,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  instructionsContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    paddingTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
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
  disabledButton: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
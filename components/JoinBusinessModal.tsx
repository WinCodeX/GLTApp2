// components/JoinBusinessModal.tsx - Fixed size and visibility
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
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerIcon}>
                <Feather name="users" size={28} color="#7c3aed" />
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
                    <Feather name="clipboard" size={18} color="#7c3aed" />
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
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#16213e', // Direct background, no transparency
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#16213e',
    padding: 32,
    paddingTop: 60, // Account for status bar
    paddingBottom: 40,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 40, // Increased spacing
  },
  headerIcon: {
    width: 70, // Increased size
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24, // Increased spacing
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 26, // Increased font size
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12, // Increased spacing
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16, // Increased font size
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    marginBottom: 32, // Increased spacing
  },
  inputGroup: {
    marginBottom: 32, // Increased spacing
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16, // Increased font size
    fontWeight: '600',
    marginBottom: 12, // Increased spacing
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 18, // Increased padding
    paddingVertical: 16, // Increased padding
    paddingRight: 50,
    color: '#fff',
    fontSize: 16, // Increased font size
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pasteButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    padding: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 6,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13, // Increased font size
    marginTop: 8, // Increased spacing
    lineHeight: 18,
  },
  instructionsContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    padding: 20, // Increased padding
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 16, // Increased font size
    fontWeight: '600',
    marginBottom: 16, // Increased spacing
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14, // Increased spacing
  },
  stepNumber: {
    width: 24, // Increased size
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12, // Increased spacing
    marginTop: 1,
  },
  stepText: {
    color: '#fff',
    fontSize: 12, // Increased font size
    fontWeight: '700',
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14, // Increased font size
    lineHeight: 20,
    flex: 1,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 'auto', // Push buttons to bottom
    paddingTop: 24, // Add some spacing from content
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 18, // Increased padding
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
    fontSize: 16, // Increased font size
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 18, // Increased padding
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16, // Increased font size
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
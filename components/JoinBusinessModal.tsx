import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import colors from '../theme/colors';
import { joinBusiness } from '../lib/helpers/business'; // ✅ Import helper

type Props = {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
};

export default function JoinBusinessModal({ visible, onClose, onJoin }: Props) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6 || submitting) return;

    setSubmitting(true);
    try {
      await joinBusiness(trimmed); // ✅ Call backend
      Toast.show({ type: 'successToast', text1: 'Successfully joined business!' });
      onJoin(trimmed);             // ✅ Trigger parent refresh
      setCode('');
      onClose();
    } catch {
      // Toast handled inside the helper already
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <TouchableOpacity onPress={onClose} style={styles.dragHandleContainer}>
            <MaterialCommunityIcons name="chevron-down" size={30} color="#bbb" />
          </TouchableOpacity>

          <Text style={styles.title}>Join Business</Text>

          <TextInput
            placeholder="Enter 6-digit code"
            placeholderTextColor="#888"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
            editable={!submitting}
          />

          <Button
            mode="contained"
            onPress={handleJoin}
            style={styles.button}
            loading={submitting}
            disabled={submitting}
          >
            Join
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  sheet: {
    backgroundColor: colors.background,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2a2a3d',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  button: {
    backgroundColor: colors.primary,
    marginTop: 12,
  },
});
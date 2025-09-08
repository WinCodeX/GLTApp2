// components/AvatarPreviewModal.tsx - Compact modal matching outline
import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Portal, Modal } from 'react-native-paper';

interface Props {
  visible: boolean;
  uri: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function AvatarPreviewModal({
  visible,
  uri,
  onCancel,
  onConfirm,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const handleConfirm = async () => {
    setUploading(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (!uploading) {
      onCancel();
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleCancel}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.container}>
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#bd93f9" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <>
              <Image 
                source={{ uri }} 
                style={styles.avatarPreview}
                resizeMode="cover"
              />
              <Text style={styles.text}>Use this as your avatar?</Text>
            </>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  container: {
    backgroundColor: '#282a36',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: 240,
    maxWidth: '80%',
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  uploadingText: {
    color: '#f8f8f2',
    fontSize: 14,
    marginTop: 8,
  },
  text: {
    color: '#ccc',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#bd93f9',
  },
  confirmButton: {
    borderWidth: 2,
    borderColor: '#50fa7b',
    backgroundColor: 'transparent',
  },
  cancelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmText: {
    color: '#50fa7b',
    fontSize: 14,
    fontWeight: '600',
  },
});
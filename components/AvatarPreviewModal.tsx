// components/AvatarPreviewModal.tsx - Fast and compact
import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

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
      <Dialog visible={visible} onDismiss={handleCancel} style={styles.dialog}>
        <Dialog.Content style={styles.content}>
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#bd93f9" />
              <Text style={styles.uploadingText}>Uploading avatar...</Text>
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
        </Dialog.Content>
        
        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={handleCancel}
            style={styles.cancelButton}
            labelStyle={styles.cancelLabel}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            mode="outlined"
            onPress={handleConfirm}
            style={styles.confirmButton}
            labelStyle={styles.confirmLabel}
            disabled={uploading}
          >
            Confirm
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: '#282a36',
    borderRadius: 12,
    maxWidth: 300,
    alignSelf: 'center',
  },
  content: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  uploadingText: {
    color: '#f8f8f2',
    fontSize: 16,
    marginTop: 12,
  },
  text: {
    color: '#ccc',
    textAlign: 'center',
    fontSize: 16,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#bd93f9',
    borderRadius: 8,
    flex: 1,
  },
  cancelLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    borderColor: '#50fa7b',
    borderWidth: 2,
    borderRadius: 8,
    flex: 1,
  },
  confirmLabel: {
    color: '#50fa7b',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
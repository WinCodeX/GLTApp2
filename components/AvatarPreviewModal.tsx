import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
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
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Preview Avatar</Dialog.Title>
        <Dialog.Content>
          <Image source={{ uri }} style={styles.avatarPreview} />
          <Text style={styles.text}>Do you want to use this photo as your avatar?</Text>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={onCancel}
            style={styles.cancelButton}
            labelStyle={styles.cancelLabel}
          >
            Cancel
          </Button>
          <Button
            mode="outlined"
            onPress={onConfirm}
            style={styles.confirmButton}
            labelStyle={styles.confirmLabel}
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
  },
  title: {
    color: '#f8f8f2',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 16,
  },
  text: {
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  cancelButton: {
    backgroundColor: '#bd93f9',
    borderRadius: 6,
    marginRight: 8,
  },
  cancelLabel: {
    color: '#fff',
  },
  confirmButton: {
    borderColor: '#50fa7b',
    borderWidth: 1,
    borderRadius: 6,
  },
  confirmLabel: {
    color: '#50fa7b',
    fontWeight: 'bold',
  },
});
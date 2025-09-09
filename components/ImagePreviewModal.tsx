// components/ImagePreviewModal.tsx - Generic modal for both avatar and business logo uploads
import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Portal, Modal } from 'react-native-paper';

interface Props {
  visible: boolean;
  uri: string;
  uploadType: 'avatar' | 'business-logo';
  businessName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ImagePreviewModal({
  visible,
  uri,
  uploadType,
  businessName,
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

  // Dynamic text based on upload type
  const getPromptText = () => {
    if (uploadType === 'business-logo') {
      return businessName 
        ? `Use this as ${businessName}'s logo?` 
        : 'Use this as your business logo?';
    }
    return 'Use this as your avatar?';
  };

  const getUploadingText = () => {
    if (uploadType === 'business-logo') {
      return 'Uploading logo...';
    }
    return 'Uploading avatar...';
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
              <Text style={styles.uploadingText}>{getUploadingText()}</Text>
            </View>
          ) : (
            <>
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri }} 
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                {uploadType === 'business-logo' && (
                  <View style={styles.logoIndicator}>
                    <Text style={styles.logoIndicatorText}>LOGO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.promptText}>{getPromptText()}</Text>
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
              <Text style={styles.confirmText}>
                {uploading ? 'Uploading...' : 'Confirm'}
              </Text>
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
    width: 280,
    maxWidth: '85%',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#282a36',
  },
  logoIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  uploadingText: {
    color: '#f8f8f2',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  promptText: {
    color: '#f8f8f2',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6272a4',
  },
  confirmButton: {
    backgroundColor: '#50fa7b',
  },
  cancelText: {
    color: '#f8f8f2',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmText: {
    color: '#282a36',
    fontSize: 14,
    fontWeight: '700',
  },
});
// components/AvatarPreviewModal.tsx - Optimized for instant loading
import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import * as ImageManipulator from 'expo-image-manipulator';

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
  const [optimizedUri, setOptimizedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Optimize image when modal becomes visible
  useEffect(() => {
    if (visible && uri) {
      optimizeImage();
    } else {
      // Reset state when modal closes
      setOptimizedUri(null);
      setLoading(true);
      setError(false);
    }
  }, [visible, uri]);

  const optimizeImage = async () => {
    try {
      setLoading(true);
      setError(false);
      
      console.log('🖼️ Optimizing avatar preview image...');
      
      // Resize and compress the image for instant preview
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          // Resize to preview size (240x240 for crisp display at 120px)
          { resize: { width: 240, height: 240 } }
        ],
        {
          compress: 0.8, // Good quality but smaller file size
          format: ImageManipulator.SaveFormat.JPEG, // Smaller than PNG
          base64: false, // We don't need base64 for preview
        }
      );

      console.log('✅ Image optimized for preview');
      setOptimizedUri(result.uri);
      
    } catch (error) {
      console.error('❌ Error optimizing image:', error);
      setError(true);
      // Fallback to original URI if optimization fails
      setOptimizedUri(uri);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    // Use original URI for upload, not the optimized preview
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleCancel} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Preview Avatar</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <View style={styles.imageContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#bd93f9" />
                <Text style={styles.loadingText}>Preparing preview...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Preview unavailable</Text>
              </View>
            ) : (
              <Image 
                source={{ uri: optimizedUri || uri }} 
                style={styles.avatarPreview}
                // These props help with performance
                resizeMode="cover"
                fadeDuration={0} // Instant fade-in
              />
            )}
          </View>
          
          <Text style={styles.text}>
            Do you want to use this photo as your avatar?
          </Text>
        </Dialog.Content>
        
        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={handleCancel}
            style={styles.cancelButton}
            labelStyle={styles.cancelLabel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            mode="outlined"
            onPress={handleConfirm}
            style={[styles.confirmButton, loading && styles.disabledButton]}
            labelStyle={styles.confirmLabel}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Confirm'}
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
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    color: '#f8f8f2',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 18,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  imageContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPreview: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  loadingText: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  errorText: {
    color: '#ff5555',
    fontSize: 14,
    textAlign: 'center',
  },
  text: {
    color: '#ccc',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 20,
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
  disabledButton: {
    opacity: 0.6,
  },
});
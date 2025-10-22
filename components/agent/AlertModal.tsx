// components/agent/AlertModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertModalProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose?: () => void;
  loading?: boolean;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  type = 'info',
  title,
  message,
  buttons = [],
  onClose,
  loading = false,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'check-circle', color: '#34C759' };
      case 'error':
        return { name: 'x-circle', color: '#FF3B30' };
      case 'warning':
        return { name: 'alert-triangle', color: '#FF9500' };
      case 'confirm':
        return { name: 'help-circle', color: '#007AFF' };
      default:
        return { name: 'info', color: '#007AFF' };
    }
  };

  const icon = getIcon();

  // Default button if none provided
  const displayButtons = buttons.length > 0 
    ? buttons 
    : [{ text: 'OK', onPress: onClose, style: 'default' as const }];

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (button.style === 'cancel' && onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
              <Feather name={icon.name as any} size={48} color={icon.color} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            {message && <Text style={styles.message}>{message}</Text>}

            {/* Loading Indicator */}
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#7B3F98" />
              </View>
            )}

            {/* Buttons */}
            {!loading && (
              <View style={styles.buttonsContainer}>
                {displayButtons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      button.style === 'cancel' && styles.buttonCancel,
                      button.style === 'destructive' && styles.buttonDestructive,
                      displayButtons.length === 1 && styles.buttonSingle,
                    ]}
                    onPress={() => handleButtonPress(button)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        button.style === 'cancel' && styles.buttonTextCancel,
                        button.style === 'destructive' && styles.buttonTextDestructive,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Hook for easier usage
export const useAlertModal = () => {
  const [alertConfig, setAlertConfig] = React.useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    loading?: boolean;
  }>({
    visible: false,
    title: '',
  });

  const showAlert = (config: Omit<typeof alertConfig, 'visible'>) => {
    setAlertConfig({ ...config, visible: true });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  return {
    alertConfig,
    showAlert,
    hideAlert,
    AlertModalComponent: (
      <AlertModal
        {...alertConfig}
        onClose={hideAlert}
      />
    ),
  };
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#1F2C34',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 16,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#7B3F98',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSingle: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  buttonDestructive: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonTextCancel: {
    color: '#8E8E93',
  },
  buttonTextDestructive: {
    color: '#fff',
  },
});
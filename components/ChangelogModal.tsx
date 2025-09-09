// components/ChangelogModal.tsx

import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const CHANGELOG_VERSION = '1.3.6';
export const CHANGELOG_KEY = `changelog_seen_${CHANGELOG_VERSION}`;
const autoDismissDelay = 7000;

const CHANGELOG_CONTENT = [
  'Added notifications and cart icons',
'Fixed business creation nameless',
'Fixed glitch in header',
'Avatar upload glitch fixed',
'Cost Calculator now working',
'Added find us to the drawer menu',
'Fixed fab colors now solid',
'Other bug fixes',
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ChangelogModal({ visible, onClose }: Props) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, autoDismissDelay);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centered}>
        <View style={styles.modal}>
          <Text style={styles.title}>{`What's New (v${CHANGELOG_VERSION})`}</Text>
          <Text style={styles.text}>{`• ${CHANGELOG_CONTENT.join('\n• ')}`}</Text>

          <TouchableOpacity onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // No dimmed background
  },
  modal: {
    width: '85%',
    backgroundColor: '#282a36',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 5 },
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#bd93f9',
    marginBottom: 10,
  },
  text: {
    color: '#f8f8f2',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    alignSelf: 'flex-end',
    backgroundColor: '#6272a4',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
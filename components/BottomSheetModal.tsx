import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import colors from '../theme/colors';
import { getStockHistory } from '../lib/helpers/stockHistory';

export default function BottomSheetModal({
  visible,
  onClose,
  product,
  type,
  quantity,
  setQuantity,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  product: any;
  type: 'add' | 'view';
  quantity: string;
  setQuantity: (value: string) => void;
  onSubmit: () => void;
}) {
  const [stockHistory, setStockHistory] = useState<any>(null);

  useEffect(() => {
    if (visible && type === 'view' && product) {
      (async () => {
        try {
          const data = await getStockHistory(product.id);
          setStockHistory(data);
        } catch (err) {
          console.error('❌ Failed to fetch stock history:', err);
        }
      })();
    }
  }, [visible, type, product]);

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyRow}>
      <Text style={styles.historyText}>{item.event}</Text>
      <Text style={styles.historyTextSmall}>By: {item.actor}</Text>
      <Text style={styles.historyTextSmall}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <TouchableOpacity onPress={onClose} style={styles.dragHandleContainer}>
            <MaterialCommunityIcons name="chevron-down" size={30} color="#bbb" />
          </TouchableOpacity>

          <Text style={styles.title}>
            {type === 'add' ? 'Add Stock' : 'Stock History'}
          </Text>

          <Text style={styles.label}>
            Product: {product?.attributes?.name || 'Unknown'}
          </Text>

          {type === 'add' ? (
            <>
              <TextInput
                placeholder="Enter quantity"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
                style={styles.input}
                placeholderTextColor="#888"
              />
              <Button mode="contained" onPress={onSubmit} style={styles.button}>
                Submit
              </Button>
            </>
          ) : (
            <>
              <FlatList
                data={stockHistory?.history || []}
                keyExtractor={(_, index) => index.toString()}
                renderItem={renderHistoryItem}
                ListEmptyComponent={
                  <Text style={styles.historyText}>No history yet.</Text>
                }
              />

              {product?.attributes?.qr_code_url ? (
                <View style={styles.qrSection}>
                  <Text style={styles.qrLabel}>QR Code</Text>
                  <Image
                    key={product.id}
                    source={{ uri: product.attributes.qr_code_url }}
                    style={styles.qrImage}
                    onError={() => console.warn('⚠️ Failed to load QR code')}
                  />
                </View>
              ) : (
                <Text style={styles.qrLabel}>QR Code not available.</Text>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: colors.background,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
  label: {
    color: '#ddd',
    marginBottom: 10,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#2a2a3d',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  button: {
    backgroundColor: colors.primary,
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  historyText: {
    color: '#ccc',
    fontWeight: '500',
  },
  historyTextSmall: {
    color: '#888',
    fontSize: 12,
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  qrLabel: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  qrImage: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    borderRadius: 12,
    backgroundColor: '#fff', // Bright background for contrast
  },
});
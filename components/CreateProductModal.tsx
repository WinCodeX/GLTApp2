import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import colors from '../theme/colors';

export default function CreateProductModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (product: {
    name: string;
    sku: string;
    price: number;
    quantity: number;
    image?: string;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert('Permission required', 'Please enable photo access.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const handleCreate = () => {
    if (!name || !sku || !price || !quantity) return;

    onSubmit({
      name,
      sku,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      image: image || undefined,
    });

    setName('');
    setSku('');
    setPrice('');
    setQuantity('');
    setImage(null);
    onClose();
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

          <Text style={styles.title}>Create New Product</Text>

          <TextInput
            placeholder="Product Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#888"
          />

          <TextInput
            placeholder="SKU"
            value={sku}
            onChangeText={setSku}
            style={styles.input}
            placeholderTextColor="#888"
          />

          <TextInput
            placeholder="Price"
            value={price}
            keyboardType="numeric"
            onChangeText={setPrice}
            style={styles.input}
            placeholderTextColor="#888"
          />

          <TextInput
            placeholder="Initial Quantity"
            value={quantity}
            keyboardType="numeric"
            onChangeText={setQuantity}
            style={styles.input}
            placeholderTextColor="#888"
          />

          <TouchableOpacity onPress={handlePickImage} style={styles.imagePicker}>
            <Text style={styles.imagePickerText}>
              {image ? 'Change Product Image' : 'Pick Product Image'}
            </Text>
          </TouchableOpacity>

          {image && (
            <Image source={{ uri: image }} style={styles.previewImage} />
          )}

          <Button mode="contained" onPress={handleCreate} style={styles.button}>
            Create
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
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  imagePicker: {
    marginBottom: 10,
    backgroundColor: '#44475a',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  imagePickerText: {
    color: '#f8f8f2',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 12,
  },
});
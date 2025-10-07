// components/AddCardModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface SavedCard {
  id: string;
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cvv: string;
  cardType: 'visa' | 'mastercard' | 'amex';
}

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  onAddCard: (card: SavedCard) => void;
}

const AddCardModal: React.FC<AddCardModalProps> = ({ visible, onClose, onAddCard }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);

  const detectCardType = (number: string): 'visa' | 'mastercard' | 'amex' => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    return 'visa';
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ');
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const validateCard = (): boolean => {
    const cleanedNumber = cardNumber.replace(/\s/g, '');
    
    if (cleanedNumber.length < 13 || cleanedNumber.length > 19) {
      Alert.alert('Invalid Card', 'Please enter a valid card number');
      return false;
    }
    
    if (!cardHolder.trim()) {
      Alert.alert('Invalid Card', 'Please enter the cardholder name');
      return false;
    }
    
    const expiryParts = expiryDate.split('/');
    if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
      Alert.alert('Invalid Expiry', 'Please enter expiry date as MM/YY');
      return false;
    }
    
    const month = parseInt(expiryParts[0]);
    if (month < 1 || month > 12) {
      Alert.alert('Invalid Expiry', 'Month must be between 01 and 12');
      return false;
    }
    
    if (cvv.length < 3 || cvv.length > 4) {
      Alert.alert('Invalid CVV', 'Please enter a valid CVV');
      return false;
    }
    
    return true;
  };

  const handleAddCard = () => {
    if (!validateCard()) return;
    
    setLoading(true);
    
    const cleanedNumber = cardNumber.replace(/\s/g, '');
    const cardType = detectCardType(cleanedNumber);
    
    const newCard: SavedCard = {
      id: Date.now().toString(),
      cardNumber: cleanedNumber,
      cardHolder: cardHolder.trim(),
      expiryDate,
      cvv,
      cardType,
    };
    
    setTimeout(() => {
      onAddCard(newCard);
      resetForm();
      setLoading(false);
    }, 1000);
  };

  const resetForm = () => {
    setCardNumber('');
    setCardHolder('');
    setExpiryDate('');
    setCvv('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#1a1b3d', '#2d1b4e', '#4c1d95']}
              style={styles.modal}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.dragIndicator} />
                <View style={styles.headerContent}>
                  <View style={styles.headerIcon}>
                    <Ionicons name="card" size={24} color="#8b5cf6" />
                  </View>
                  <Text style={styles.title}>Add Payment Card</Text>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={handleClose}
                  >
                    <Ionicons name="close" size={24} color="#c4b5fd" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView 
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Card Preview */}
                <View style={styles.cardPreview}>
                  <LinearGradient
                    colors={['#8b5cf6', '#6d28d9', '#5b21b6']}
                    style={styles.cardPreviewGradient}
                  >
                    <View style={styles.cardPreviewTop}>
                      <Ionicons name="wifi" size={24} color="rgba(255,255,255,0.8)" />
                      <Ionicons name="card" size={32} color="rgba(255,255,255,0.6)" />
                    </View>
                    
                    <Text style={styles.cardPreviewNumber}>
                      {cardNumber || '•••• •••• •••• ••••'}
                    </Text>
                    
                    <View style={styles.cardPreviewBottom}>
                      <View style={styles.cardPreviewInfo}>
                        <Text style={styles.cardPreviewLabel}>CARD HOLDER</Text>
                        <Text style={styles.cardPreviewValue}>
                          {cardHolder || 'YOUR NAME'}
                        </Text>
                      </View>
                      <View style={styles.cardPreviewInfo}>
                        <Text style={styles.cardPreviewLabel}>EXPIRES</Text>
                        <Text style={styles.cardPreviewValue}>
                          {expiryDate || 'MM/YY'}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Form Fields */}
                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Card Number</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="card-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="1234 5678 9012 3456"
                        placeholderTextColor="#666"
                        value={cardNumber}
                        onChangeText={(text) => {
                          const formatted = formatCardNumber(text);
                          if (formatted.replace(/\s/g, '').length <= 19) {
                            setCardNumber(formatted);
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={23} // 16 digits + 3 spaces
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Cardholder Name</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="person-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="John Doe"
                        placeholderTextColor="#666"
                        value={cardHolder}
                        onChangeText={setCardHolder}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>Expiry Date</Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="calendar-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="MM/YY"
                          placeholderTextColor="#666"
                          value={expiryDate}
                          onChangeText={(text) => {
                            const formatted = formatExpiryDate(text);
                            if (formatted.replace(/\D/g, '').length <= 4) {
                              setExpiryDate(formatted);
                            }
                          }}
                          keyboardType="numeric"
                          maxLength={5}
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>CVV</Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="123"
                          placeholderTextColor="#666"
                          value={cvv}
                          onChangeText={setCvv}
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                  <Ionicons name="shield-checkmark" size={20} color="#10b981" />
                  <Text style={styles.infoText}>
                    Your card information is encrypted and stored securely
                  </Text>
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.addButton, loading && styles.addButtonDisabled]}
                  onPress={handleAddCard}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#8b5cf6', '#6d28d9']}
                    style={styles.addButtonGradient}
                  >
                    {loading ? (
                      <Text style={styles.addButtonText}>Adding Card...</Text>
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={20} color="#fff" />
                        <Text style={styles.addButtonText}>Add Card</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  
  // Header
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 123, 250, 0.2)',
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#a78bfa',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    position: 'absolute',
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  
  // Content
  content: {
    maxHeight: '70%',
  },
  
  // Card Preview
  cardPreview: {
    padding: 16,
  },
  cardPreviewGradient: {
    borderRadius: 20,
    padding: 20,
    height: 200,
    justifyContent: 'space-between',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardPreviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardPreviewNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 2,
  },
  cardPreviewBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardPreviewInfo: {
    gap: 4,
  },
  cardPreviewLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardPreviewValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Form
  form: {
    padding: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 16,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  infoText: {
    flex: 1,
    color: '#10b981',
    fontSize: 13,
    lineHeight: 18,
  },
  
  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168, 123, 250, 0.2)',
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddCardModal;
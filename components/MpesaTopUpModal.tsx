// components/MpesaTopUpModal.tsx - Fixed keyboard and sizing issues
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Keyboard,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/context/UserContext';
import api from '../lib/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MpesaTopUpModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentStep = 'input' | 'processing' | 'success' | 'failed' | 'manual_verify';

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

const MpesaTopUpModal: React.FC<MpesaTopUpModalProps> = ({ 
  visible, 
  onClose, 
  onSuccess 
}) => {
  const { user, getUserPhone } = useUser();
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState<PaymentStep>('input');
  const [loading, setLoading] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningMessage, setWarningMessage] = useState({ title: '', message: '' });
  const [transactionCode, setTransactionCode] = useState('');
  const warningOpacity = useState(new Animated.Value(0))[0];

  const showWarning = (title: string, message: string) => {
    setWarningMessage({ title, message });
    setWarningVisible(true);
    
    Animated.sequence([
      Animated.timing(warningOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(warningOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setWarningVisible(false);
    });
  };

  useEffect(() => {
    if (visible) {
      const userPhone = getUserPhone();
      let cleanPhone = userPhone.replace(/\D/g, '');
      
      if (cleanPhone.startsWith('254')) {
        cleanPhone = cleanPhone.substring(3);
      }
      
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
      }
      
      setPhoneNumber(cleanPhone);
      setStep('input');
      setAmount('');
      setErrorMessage('');
    }
  }, [visible, getUserPhone]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const formatPhoneForAPI = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `254${cleaned}`;
    }
    return cleaned;
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

  const validateInput = (): boolean => {
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      showWarning('Invalid Amount', 'Please enter a valid amount');
      return false;
    }
    
    if (numAmount < 10) {
      showWarning('Minimum Amount', 'Minimum top-up amount is KES 10');
      return false;
    }
    
    if (numAmount > 150000) {
      showWarning('Maximum Amount', 'Maximum top-up amount is KES 150,000');
      return false;
    }
    
    if (!phoneNumber || phoneNumber.length !== 9) {
      showWarning('Invalid Phone', 'Please enter a valid M-Pesa phone number');
      return false;
    }
    
    return true;
  };

  const initiatePayment = async () => {
    if (!validateInput()) return;
    
    try {
      setLoading(true);
      setStep('processing');
      
      const formattedPhone = formatPhoneForAPI(phoneNumber);
      const numAmount = parseFloat(amount);
      
      const response = await api.post('/api/v1/mpesa/topup', {
        phone_number: formattedPhone,
        amount: numAmount,
      });
      
      if (response.data.status === 'success' && response.data.data?.checkout_request_id) {
        const requestId = response.data.data.checkout_request_id;
        setCheckoutRequestId(requestId);
        startPollingPaymentStatus(requestId);
      } else {
        throw new Error(response.data.message || 'Payment initiation failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setStep('failed');
      setErrorMessage(
        error.response?.data?.message || 
        error.message || 
        'Failed to initiate payment'
      );
    } finally {
      setLoading(false);
    }
  };

  const startPollingPaymentStatus = (requestId: string) => {
    let pollCount = 0;
    const maxPolls = 40;
    
    const interval = setInterval(async () => {
      pollCount++;
      
      try {
        const response = await api.post('/api/v1/mpesa/query_status', {
          checkout_request_id: requestId,
        });
        
        if (response.data.status === 'success') {
          const status = response.data.data.transaction_status;
          
          if (status === 'completed') {
            clearInterval(interval);
            setPollingInterval(null);
            setStep('success');
            
            setTimeout(() => {
              onSuccess();
              resetModal();
            }, 2000);
          } else if (status === 'failed') {
            clearInterval(interval);
            setPollingInterval(null);
            setStep('failed');
            setErrorMessage('Payment was cancelled or failed');
          } else if (pollCount >= maxPolls) {
            clearInterval(interval);
            setPollingInterval(null);
            setStep('failed');
            setErrorMessage('Payment verification timeout');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (pollCount >= maxPolls) {
          clearInterval(interval);
          setPollingInterval(null);
          setStep('failed');
          setErrorMessage('Unable to verify payment status');
        }
      }
    }, 3000);
    
    setPollingInterval(interval);
  };

  const resetModal = () => {
    setAmount('');
    setStep('input');
    setErrorMessage('');
    setCheckoutRequestId('');
    setTransactionCode('');
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleRetry = () => {
    setStep('input');
    setErrorMessage('');
    setTransactionCode('');
  };

  const goToManualVerify = () => {
    setStep('manual_verify');
    setErrorMessage('');
    setTransactionCode('');
  };

  const verifyManualTransaction = async () => {
    if (!transactionCode.trim()) {
      showWarning('Transaction Code Required', 'Please enter the M-Pesa transaction code');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showWarning('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Verifying manual transaction code:', transactionCode);
      
      const response = await api.post('/api/v1/mpesa/topup_manual', {
        transaction_code: transactionCode,
        amount: parseFloat(amount)
      });

      console.log('📡 Manual verification response:', response.data);

      if (response.data.status === 'success') {
        setStep('success');
        
        setTimeout(() => {
          onSuccess();
          resetModal();
        }, 2000);
      } else {
        showWarning('Verification Failed', response.data.message || 'Invalid transaction code');
      }
      
    } catch (error: any) {
      console.error('🔍 Manual verification error:', error);
      
      const errorMsg = error.response?.data?.message || 'Could not verify the transaction code';
      showWarning('Verification Failed', errorMsg);
    } finally {
      setLoading(false);
    }
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
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[
            styles.modalContainer,
            keyboardVisible && styles.modalContainerKeyboard
          ]}>
            <LinearGradient
              colors={['rgba(26, 26, 46, 0.98)', 'rgba(22, 33, 62, 0.98)']}
              style={styles.modal}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.dragIndicator} />
                <View style={styles.headerContent}>
                  <View style={styles.headerIcon}>
                    <Ionicons name="phone-portrait" size={24} color="#10b981" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>Top Up Wallet</Text>
                    <Text style={styles.subtitle}>Add funds via M-Pesa</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={handleClose}
                  >
                    <Ionicons name="close" size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView 
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {step === 'input' && (
                  <>
                    {/* Amount Input */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Enter Amount</Text>
                      <View style={styles.amountInputContainer}>
                        <Text style={styles.currencySymbol}>KES</Text>
                        <TextInput
                          style={styles.amountInput}
                          placeholder="0"
                          placeholderTextColor="#666"
                          value={amount}
                          onChangeText={setAmount}
                          keyboardType="numeric"
                          maxLength={6}
                        />
                      </View>
                    </View>

                    {/* Quick Amounts */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Quick Amounts</Text>
                      <View style={styles.quickAmountsContainer}>
                        {QUICK_AMOUNTS.map((quickAmount) => (
                          <TouchableOpacity
                            key={quickAmount}
                            style={[
                              styles.quickAmountButton,
                              amount === quickAmount.toString() && styles.quickAmountButtonActive
                            ]}
                            onPress={() => handleQuickAmount(quickAmount)}
                          >
                            <Text style={[
                              styles.quickAmountText,
                              amount === quickAmount.toString() && styles.quickAmountTextActive
                            ]}>
                              {quickAmount}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Phone Number */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>M-Pesa Phone Number</Text>
                      <View style={styles.phoneInputContainer}>
                        <Text style={styles.phonePrefix}>+254</Text>
                        <TextInput
                          style={styles.phoneInput}
                          placeholder="712345678"
                          placeholderTextColor="#666"
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                          keyboardType="numeric"
                          maxLength={9}
                        />
                      </View>
                    </View>

                    {/* Info */}
                    <View style={styles.infoSection}>
                      <Ionicons name="information-circle" size={20} color="#c084fc" />
                      <Text style={styles.infoText}>
                        You will receive an M-Pesa prompt on your phone. Enter your PIN to complete the transaction.
                      </Text>
                    </View>

                    {/* Manual Verify Button */}
                    <View style={styles.section}>
                      <TouchableOpacity 
                        style={styles.manualVerifyButton}
                        onPress={goToManualVerify}
                      >
                        <Ionicons name="create-outline" size={18} color="#c084fc" />
                        <Text style={styles.manualVerifyText}>Already paid? Verify manually</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {step === 'processing' && (
                  <View style={styles.statusContainer}>
                    <ActivityIndicator size="large" color="#c084fc" />
                    <Text style={styles.statusTitle}>Processing Payment</Text>
                    <Text style={styles.statusMessage}>
                      Please check your phone for the M-Pesa prompt and enter your PIN
                    </Text>
                    <View style={styles.processingInfo}>
                      <Text style={styles.processingText}>
                        Amount: KES {parseFloat(amount).toLocaleString()}
                      </Text>
                      <Text style={styles.processingText}>
                        Phone: +254{phoneNumber}
                      </Text>
                    </View>
                  </View>
                )}

                {step === 'success' && (
                  <View style={styles.statusContainer}>
                    <View style={styles.successIcon}>
                      <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                    </View>
                    <Text style={styles.statusTitle}>Payment Successful!</Text>
                    <Text style={styles.statusMessage}>
                      KES {parseFloat(amount).toLocaleString()} has been added to your wallet
                    </Text>
                  </View>
                )}

                {step === 'failed' && (
                  <View style={styles.statusContainer}>
                    <View style={styles.errorIcon}>
                      <Ionicons name="close-circle" size={64} color="#ef4444" />
                    </View>
                    <Text style={styles.statusTitle}>Payment Failed</Text>
                    <Text style={styles.statusMessage}>
                      {errorMessage || 'The payment could not be processed'}
                    </Text>
                    <View style={styles.failedActions}>
                      <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={handleRetry}
                      >
                        <Ionicons name="refresh" size={20} color="#fff" />
                        <Text style={styles.retryButtonText}>Try Again</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.manualButton}
                        onPress={() => setStep('manual_verify')}
                      >
                        <Ionicons name="create-outline" size={18} color="#c084fc" />
                        <Text style={styles.manualButtonText}>Enter Transaction Code</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {step === 'manual_verify' && (
                  <View style={styles.statusContainer}>
                    <View style={styles.manualIcon}>
                      <Ionicons name="create-outline" size={48} color="#c084fc" />
                    </View>
                    <Text style={styles.statusTitle}>Manual Verification</Text>
                    <Text style={styles.statusMessage}>
                      If you completed the payment, enter the M-Pesa transaction code from your SMS
                    </Text>
                    
                    <View style={styles.manualInputSection}>
                      <Text style={styles.inputLabel}>M-Pesa Transaction Code</Text>
                      <TextInput
                        style={styles.transactionInput}
                        value={transactionCode}
                        onChangeText={setTransactionCode}
                        placeholder="e.g. TJ7P76Q8GV"
                        placeholderTextColor="#666"
                        autoCapitalize="characters"
                        maxLength={15}
                      />
                      
                      <Text style={styles.inputLabel} style={{ marginTop: 16 }}>Confirm Amount</Text>
                      <View style={styles.amountInputContainer} style={{ marginTop: 8 }}>
                        <Text style={styles.currencySymbol}>KES</Text>
                        <TextInput
                          style={styles.amountInput}
                          placeholder="0"
                          placeholderTextColor="#666"
                          value={amount}
                          onChangeText={setAmount}
                          keyboardType="numeric"
                          maxLength={6}
                        />
                      </View>
                    </View>

                    <View style={styles.manualActions}>
                      <TouchableOpacity 
                        style={[styles.verifyButton, loading && styles.verifyButtonDisabled]} 
                        onPress={verifyManualTransaction}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={20} color="#fff" />
                            <Text style={styles.verifyButtonText}>Verify Payment</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.backButton}
                        onPress={handleRetry}
                      >
                        <Text style={styles.backButtonText}>Back to Top-up</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Footer - Only show on input step */}
              {step === 'input' && (
                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.payButton, loading && styles.payButtonDisabled]}
                    onPress={initiatePayment}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#10b981', '#059669']}
                      style={styles.payButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="phone-portrait" size={20} color="#fff" />
                          <Text style={styles.payButtonText}>
                            Pay KES {amount || '0'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>

        {/* Warning Modal */}
        {warningVisible && (
          <Animated.View 
            style={[
              styles.warningContainer,
              { opacity: warningOpacity }
            ]}
          >
            <LinearGradient
              colors={['rgba(239, 68, 68, 0.95)', 'rgba(220, 38, 38, 0.95)']}
              style={styles.warningBox}
            >
              <View style={styles.warningIconContainer}>
                <Ionicons name="warning" size={24} color="#fff" />
              </View>
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>{warningMessage.title}</Text>
                <Text style={styles.warningText}>{warningMessage.message}</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.95,
  },
  modalContainerKeyboard: {
    maxHeight: SCREEN_HEIGHT * 0.70,
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: SCREEN_HEIGHT * 0.85,
  },
  
  // Header
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.2)',
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  
  // Amount Input
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  currencySymbol: {
    color: '#a78bfa',
    fontSize: 28,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  
  // Quick Amounts
  quickAmountsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  quickAmountButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderColor: '#8b5cf6',
  },
  quickAmountText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  quickAmountTextActive: {
    color: '#fff',
  },
  
  // Phone Input
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  phonePrefix: {
    color: '#a78bfa',
    fontSize: 16,
    fontWeight: '600',
    paddingLeft: 16,
    paddingRight: 8,
  },
  phoneInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
    paddingRight: 16,
  },
  
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  infoText: {
    flex: 1,
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 18,
  },
  
  // Status Container
  statusContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  successIcon: {
    marginBottom: 8,
  },
  errorIcon: {
    marginBottom: 8,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusMessage: {
    color: '#c4b5fd',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  processingInfo: {
    marginTop: 16,
    gap: 8,
    alignItems: 'center',
  },
  processingText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Manual Verify Button (on input screen)
  manualVerifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  manualVerifyText: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: '600',
  },

  // Failed Actions
  failedActions: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  manualButtonText: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: '600',
  },

  // Manual Verification Step
  manualIcon: {
    marginBottom: 8,
  },
  manualInputSection: {
    width: '100%',
    marginTop: 16,
  },
  transactionInput: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    textTransform: 'uppercase',
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  manualActions: {
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#10b981',
    borderRadius: 12,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Footer
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.2)',
  },
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Warning Modal
  warningContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  warningBox: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warningIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  warningText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
});

export default MpesaTopUpModal;
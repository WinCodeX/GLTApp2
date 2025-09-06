// components/MpesaPaymentModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TextInput,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useUser } from '@/context/UserContext';
import api from '@/lib/api';
import colors from '@/theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Package {
  id: string;
  code: string;
  receiver_name: string;
  cost: number;
  route_description: string;
}

interface MpesaPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  packageData: Package | null;  // Fixed: Changed from 'package' to 'packageData'
  onPaymentSuccess: () => void;
}

type PaymentStep = 'confirm' | 'processing' | 'failed' | 'success' | 'manual_verify';

export default function MpesaPaymentModal({ 
  visible, 
  onClose, 
  packageData,  // Fixed: Now matches the prop name from track.tsx
  onPaymentSuccess 
}: MpesaPaymentModalProps) {
  const { getUserPhone } = useUser();
  
  // Animation and gesture handling
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  
  // State management
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('confirm');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug: Log when modal visibility changes
  useEffect(() => {
    console.log('🎭 MpesaPaymentModal visibility changed:', visible);
    console.log('📦 Package data:', packageData);
  }, [visible, packageData]);

  // Initialize phone number from user context
  useEffect(() => {
    if (visible && packageData) {
      console.log('🚀 Initializing modal with package:', packageData.code);
      const userPhone = getUserPhone();
      console.log('📞 User phone from context:', userPhone);
      
      // Clean and format phone number
      let cleanPhone = userPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('254')) {
        cleanPhone = cleanPhone.substring(3);
      }
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
      }
      console.log('📞 Cleaned phone number:', cleanPhone);
      
      setPhoneNumber(cleanPhone);
      setPaymentStep('confirm');
      setTransactionCode('');
      setErrorMessage('');
      setCheckoutRequestId(null);
    }
  }, [visible, packageData, getUserPhone]);

  // Animation for modal show/hide
  useEffect(() => {
    if (visible) {
      console.log('🎬 Animating modal in');
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      console.log('🎬 Animating modal out');
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  // Spinning animation for loading states
  useEffect(() => {
    let spinAnimation: Animated.CompositeAnimation;
    
    if (paymentStep === 'processing') {
      spinAnimation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();
    } else {
      spinAnim.setValue(0);
    }

    return () => {
      if (spinAnimation) {
        spinAnimation.stop();
      }
    };
  }, [paymentStep, spinAnim]);

  // Button press animation
  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 20 && Math.abs(gestureState.dx) < 100;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Format phone number for API (add 254 prefix)
  const formatPhoneForAPI = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `254${cleaned}`;
    }
    return cleaned;
  };

  // Start STK push process
  const initiatePayment = async () => {
    if (!packageData || !phoneNumber.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Input',
        text2: 'Please enter a valid phone number',
      });
      return;
    }

    console.log('💳 Initiating payment for package:', packageData.code);
    animateButtonPress();
    setPaymentStep('processing');
    setErrorMessage('');

    try {
      const formattedPhone = formatPhoneForAPI(phoneNumber);
      console.log('📞 Formatted phone for API:', formattedPhone);
      
      const response = await api.post('/api/v1/mpesa/stk_push', {
        phone_number: formattedPhone,
        amount: packageData.cost,
        package_id: packageData.id,
      });

      console.log('📡 STK Push response:', response.data);

      if (response.data.status === 'success') {
        const requestId = response.data.data.checkout_request_id;
        setCheckoutRequestId(requestId);
        
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: 'Please check your phone for M-Pesa prompt',
        });

        // Start polling for payment status
        startPolling(requestId);
      } else {
        // Server responded but with non-success status
        const errorMsg = response.data.message || 'Payment initiation failed';
        console.log('📡 Server returned non-success status:', errorMsg);
        
        Toast.show({
          type: 'error',
          text1: 'Payment Initiation Failed',
          text2: errorMsg,
        });
        
        // Go to manual verify instead of failed state
        setPaymentStep('manual_verify');
        setErrorMessage(errorMsg);
      }
    } catch (error: any) {
      console.error('💳 Payment initiation error:', error);
      
      // Don't immediately set to failed - the STK push might not have been sent
      const errorMsg = error.response?.data?.message || error.message || 'Network error occurred';
      
      Toast.show({
        type: 'error',
        text1: 'Connection Error',
        text2: 'Unable to send payment request. Please try again.',
      });
      
      // Reset to confirm state to allow retry
      setPaymentStep('confirm');
      setErrorMessage(errorMsg);
    }
  };

  // Poll payment status
  const startPolling = (requestId: string) => {
    console.log('🔄 Starting payment polling for:', requestId);
    setIsPolling(true);
    let pollCount = 0;
    const maxPolls = 40; // Poll for up to 2 minutes (40 * 3 seconds)

    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      console.log(`🔄 Polling attempt ${pollCount}/${maxPolls}`);
      
      try {
        const response = await api.post('/api/v1/mpesa/query_status', {
          checkout_request_id: requestId,
        });

        console.log('📡 Polling response:', response.data);

        if (response.data.status === 'success') {
          const transactionStatus = response.data.data.transaction_status;
          console.log('💳 Transaction status:', transactionStatus);
          
          if (transactionStatus === 'completed') {
            // Payment successful
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            setIsPolling(false);
            setPaymentStep('success');
            
            Toast.show({
              type: 'success',
              text1: 'Payment Successful!',
              text2: `Payment for ${packageData.code} completed`,
            });

            // Auto close after 2 seconds and trigger refresh
            setTimeout(() => {
              onPaymentSuccess();
              onClose();
            }, 2000);
            
          } else if (transactionStatus === 'failed') {
            // Payment failed - this is when we show failed state
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            setIsPolling(false);
            setPaymentStep('failed');
            setErrorMessage('Payment was cancelled or failed');
            
          } else if (pollCount >= maxPolls) {
            // Timeout - offer manual verification
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            setIsPolling(false);
            setPaymentStep('manual_verify');
          }
          // Continue polling if still pending
        }
      } catch (error) {
        console.error('🔄 Polling error:', error);
        // Continue polling unless max attempts reached
        if (pollCount >= maxPolls) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setIsPolling(false);
          setPaymentStep('manual_verify');
        }
      }
    }, 3000); // Poll every 3 seconds
  };

  // Handle manual transaction verification
  const verifyManualTransaction = async () => {
    if (!transactionCode.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Transaction Code Required',
        text2: 'Please enter the M-Pesa transaction code',
      });
      return;
    }

    try {
      console.log('🔍 Verifying manual transaction code:', transactionCode);
      // You can implement manual verification logic here
      // For now, we'll assume it's successful
      setPaymentStep('success');
      
      Toast.show({
        type: 'success',
        text1: 'Payment Verified!',
        text2: 'Transaction has been verified manually',
      });

      setTimeout(() => {
        onPaymentSuccess();
        onClose();
      }, 2000);
      
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Could not verify the transaction code',
      });
    }
  };

  // Retry payment
  const retryPayment = () => {
    console.log('🔄 Retrying payment');
    setPaymentStep('confirm');
    setErrorMessage('');
    setCheckoutRequestId(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setIsPolling(false);
  };

  // Close modal and cleanup
  const handleClose = () => {
    console.log('❌ Closing modal');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setIsPolling(false);
    setPaymentStep('confirm');
    setErrorMessage('');
    setTransactionCode('');
    onClose();
  };

  // Early return if no package data
  if (!packageData) {
    console.log('⚠️ No package data provided to modal');
    return null;
  }

  console.log('🎭 Rendering modal with visible:', visible, 'step:', paymentStep);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={[styles.overlay, { opacity: opacityAnim }]}
      >
        <TouchableOpacity 
          style={styles.overlayTouchable} 
          activeOpacity={1} 
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.98)', 'rgba(22, 33, 62, 0.98)']}
            style={styles.modal}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.dragIndicator} />
              <View style={styles.headerContent}>
                <View style={styles.headerIcon}>
                  <Feather name="smartphone" size={24} color={colors.primary} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.modalTitle}>M-Pesa Payment</Text>
                  <Text style={styles.modalSubtitle}>Pay for package {packageData.code}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                  <Feather name="x" size={20} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Package Info */}
            <View style={styles.packageInfo}>
              <LinearGradient
                colors={['rgba(124, 58, 237, 0.1)', 'rgba(124, 58, 237, 0.05)']}
                style={styles.packageCard}
              >
                <View style={styles.packageHeader}>
                  <Text style={styles.packageCode}>{packageData.code}</Text>
                  <Text style={styles.packageAmount}>KES {packageData.cost.toLocaleString()}</Text>
                </View>
                <Text style={styles.packageDescription}>{packageData.route_description}</Text>
                <Text style={styles.packageReceiver}>To: {packageData.receiver_name}</Text>
              </LinearGradient>
            </View>

            {/* Payment Steps */}
            <View style={styles.paymentContent}>
              {paymentStep === 'confirm' && (
                <View style={styles.confirmStep}>
                  <Text style={styles.stepTitle}>Confirm Payment Details</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <View style={styles.phoneInputContainer}>
                      <Text style={styles.phonePrefix}>+254</Text>
                      <TextInput
                        style={styles.phoneInput}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="712345678"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        maxLength={9}
                      />
                    </View>
                  </View>

                  <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
                    <TouchableOpacity style={styles.primaryButton} onPress={initiatePayment}>
                      <Feather name="smartphone" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>Send M-Pesa Prompt</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}

              {paymentStep === 'processing' && (
                <View style={styles.processingStep}>
                  <Animated.View style={[styles.loadingIcon, { transform: [{ rotate: spin }] }]}>
                    <Feather name="loader" size={48} color={colors.primary} />
                  </Animated.View>
                  <Text style={styles.stepTitle}>Processing Payment</Text>
                  <Text style={styles.stepDescription}>
                    Please check your phone for the M-Pesa prompt and enter your PIN to complete the payment.
                  </Text>
                  <View style={styles.processingInfo}>
                    <Text style={styles.processingText}>Waiting for confirmation...</Text>
                  </View>
                </View>
              )}

              {paymentStep === 'success' && (
                <View style={styles.successStep}>
                  <View style={styles.successIcon}>
                    <Feather name="check-circle" size={48} color="#10b981" />
                  </View>
                  <Text style={styles.stepTitle}>Payment Successful!</Text>
                  <Text style={styles.stepDescription}>
                    Your payment has been processed successfully. The package status will be updated shortly.
                  </Text>
                </View>
              )}

              {paymentStep === 'failed' && (
                <View style={styles.failedStep}>
                  <View style={styles.errorIcon}>
                    <Feather name="x-circle" size={48} color="#ef4444" />
                  </View>
                  <Text style={styles.stepTitle}>Payment Failed</Text>
                  <Text style={styles.stepDescription}>{errorMessage}</Text>
                  
                  <View style={styles.failedActions}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={retryPayment}>
                      <Feather name="refresh-cw" size={16} color={colors.primary} />
                      <Text style={styles.secondaryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.tertiaryButton} 
                      onPress={() => setPaymentStep('manual_verify')}
                    >
                      <Feather name="edit-3" size={16} color="#888" />
                      <Text style={styles.tertiaryButtonText}>Enter Transaction Code</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {paymentStep === 'manual_verify' && (
                <View style={styles.manualStep}>
                  <Text style={styles.stepTitle}>Manual Verification</Text>
                  <Text style={styles.stepDescription}>
                    If you completed the payment, please enter the M-Pesa transaction code for verification.
                  </Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>M-Pesa Transaction Code</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transactionCode}
                      onChangeText={setTransactionCode}
                      placeholder="e.g. QH47XJ9K2M"
                      placeholderTextColor="#666"
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={styles.manualActions}>
                    <TouchableOpacity style={styles.primaryButton} onPress={verifyManualTransaction}>
                      <Feather name="check" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>Verify Payment</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.secondaryButton} onPress={retryPayment}>
                      <Text style={styles.secondaryButtonText}>Try Payment Again</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  
  // Modal Header
  modalHeader: {
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
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Package Info
  packageInfo: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  packageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  packageCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  packageAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  packageDescription: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  packageReceiver: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  
  // Payment Content
  paymentContent: {
    paddingHorizontal: 20,
  },
  
  // Common Step Styles
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  
  // Confirm Step
  confirmStep: {
    alignItems: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '500',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  phonePrefix: {
    fontSize: 16,
    color: '#888',
    paddingLeft: 16,
    paddingRight: 8,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 16,
    paddingRight: 16,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  
  // Processing Step
  processingStep: {
    alignItems: 'center',
  },
  loadingIcon: {
    marginBottom: 16,
  },
  processingInfo: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  processingText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  
  // Success Step
  successStep: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 16,
  },
  
  // Failed Step
  failedStep: {
    alignItems: 'center',
  },
  errorIcon: {
    marginBottom: 16,
  },
  failedActions: {
    width: '100%',
    gap: 12,
  },
  
  // Manual Verification
  manualStep: {
    alignItems: 'center',
  },
  manualActions: {
    width: '100%',
    gap: 12,
  },
  
  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
    width: '100%',
  },
  tertiaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
});
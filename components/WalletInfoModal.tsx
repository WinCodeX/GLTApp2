// components/WalletInfoModal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface WalletInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

const WalletInfoModal: React.FC<WalletInfoModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1a1b3d', '#2d1b4e', '#4c1d95']}
            style={styles.modal}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <Ionicons name="wallet" size={28} color="#c084fc" />
                </View>
                <Text style={styles.headerTitle}>GLT Wallet</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="#c4b5fd" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>What is GLT Wallet?</Text>
              
              <Text style={styles.description}>
                GLT Wallet is a convenient feature that allows you to top up and pay for packages 
                easily, streamlining your delivery experience.
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#10b98120' }]}>
                    <Ionicons name="flash" size={24} color="#10b981" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Quick Payments</Text>
                    <Text style={styles.featureText}>
                      Pay for your packages instantly without entering card details every time
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#8b5cf620' }]}>
                    <Ionicons name="shield-checkmark" size={24} color="#8b5cf6" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Secure Transactions</Text>
                    <Text style={styles.featureText}>
                      Your funds are protected with bank-level security and encryption
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#f59e0b20' }]}>
                    <Ionicons name="cash" size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Receive Payments</Text>
                    <Text style={styles.featureText}>
                      Receive payments from receivers who opt for the Pay on Delivery option, 
                      primarily for Home Delivery
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#ec489920' }]}>
                    <Ionicons name="gift" size={24} color="#ec4899" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Flexible Payment Options</Text>
                    <Text style={styles.featureText}>
                      Place an amount on packages for payment on collection, extending beyond 
                      standard Home Delivery
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#c084fc" />
                <Text style={styles.infoText}>
                  Top up your wallet using M-Pesa, Airtel Money, or your debit/credit card
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.gotItButton}
                onPress={onClose}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#6d28d9']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Got it</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modal: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 123, 250, 0.2)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    color: '#e5e7eb',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: '#c4b5fd',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  featuresList: {
    gap: 20,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureText: {
    color: '#c4b5fd',
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
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
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168, 123, 250, 0.2)',
  },
  gotItButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default WalletInfoModal;
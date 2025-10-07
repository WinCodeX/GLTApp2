// components/WalletInfoModal.tsx - Fixed rendering issues
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WalletInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

const WalletInfoModal: React.FC<WalletInfoModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.dragIndicator} />
              <View style={styles.headerContent}>
                <View style={styles.headerIcon}>
                  <Ionicons name="wallet" size={24} color="#c084fc" />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>GLT Wallet</Text>
                  <Text style={styles.headerSubtitle}>About your digital wallet</Text>
                </View>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.content} 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.title}>What is GLT Wallet?</Text>
              
              <Text style={styles.description}>
                GLT Wallet is a convenient feature that allows you to top up and pay for packages 
                easily, streamlining your delivery experience.
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, styles.greenIcon]}>
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
                  <View style={[styles.featureIcon, styles.purpleIcon]}>
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
                  <View style={[styles.featureIcon, styles.orangeIcon]}>
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
                  <View style={[styles.featureIcon, styles.pinkIcon]}>
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
                <Text style={styles.buttonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.90,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: SCREEN_HEIGHT * 0.75,
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
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
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
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    color: '#fff',
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
  
  // Features List
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
  greenIcon: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  purpleIcon: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  orangeIcon: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  pinkIcon: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureText: {
    color: '#c4b5fd',
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Info Box
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
  
  // Footer
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.2)',
  },
  gotItButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
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
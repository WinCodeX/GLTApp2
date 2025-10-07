// app/(drawer)/wallet.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GLTHeader from '../../components/GLTHeader';
import { NavigationHelper } from '../../lib/helpers/navigation';
import { useUser } from '@/context/UserContext';
import api from '../../lib/api';
import AddCardModal from '../../components/AddCardModal';
import MpesaTopUpModal from '../../components/MpesaTopUpModal';

interface SavedCard {
  id: string;
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cardType: 'visa' | 'mastercard' | 'amex';
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface WalletData {
  balance: number;
  currency: string;
  transactions: Transaction[];
}

const WalletScreen = () => {
  const { user } = useUser();
  const isClient = user?.role === 'client';
  
  const [walletData, setWalletData] = useState<WalletData>({
    balance: 0,
    currency: 'KES',
    transactions: []
  });
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  useEffect(() => {
    loadWalletData();
    loadSavedCards();
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/wallet');
      if (response.data.success) {
        setWalletData({
          balance: response.data.data.balance || 0,
          currency: 'KES',
          transactions: response.data.data.transactions || []
        });
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCards = async () => {
    try {
      const cards = await AsyncStorage.getItem('saved_cards');
      if (cards) {
        setSavedCards(JSON.parse(cards));
      }
    } catch (error) {
      console.error('Error loading saved cards:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    await loadSavedCards();
    setRefreshing(false);
  };

  const handleAddCard = async (card: SavedCard) => {
    try {
      const updatedCards = [...savedCards, card];
      await AsyncStorage.setItem('saved_cards', JSON.stringify(updatedCards));
      setSavedCards(updatedCards);
      setShowAddCardModal(false);
    } catch (error) {
      console.error('Error saving card:', error);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    try {
      const updatedCards = savedCards.filter(card => card.id !== cardId);
      await AsyncStorage.setItem('saved_cards', JSON.stringify(updatedCards));
      setSavedCards(updatedCards);
    } catch (error) {
      console.error('Error removing card:', error);
    }
  };

  const handleTopUpSuccess = () => {
    setShowTopUpModal(false);
    loadWalletData();
  };

  const renderPaymentMethod = (method: 'mpesa' | 'airtel' | SavedCard) => {
    if (typeof method === 'string') {
      const icon = method === 'mpesa' ? 'phone-portrait' : 'phone-portrait';
      const label = method === 'mpesa' ? 'M-Pesa' : 'Airtel Money';
      const color = method === 'mpesa' ? '#10b981' : '#ef4444';
      
      return (
        <TouchableOpacity style={styles.paymentMethodItem}>
          <View style={[styles.methodIcon, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodName}>{label}</Text>
            <Text style={styles.methodSubtext}>Mobile Money</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a78bfa" />
        </TouchableOpacity>
      );
    } else {
      const card = method as SavedCard;
      const cardIcon = card.cardType === 'visa' ? 'card' : 
                      card.cardType === 'mastercard' ? 'card' : 'card';
      
      return (
        <TouchableOpacity 
          style={styles.paymentMethodItem}
          onLongPress={() => handleRemoveCard(card.id)}
        >
          <View style={[styles.methodIcon, { backgroundColor: '#8b5cf620' }]}>
            <Ionicons name={cardIcon} size={24} color="#8b5cf6" />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodName}>
              {card.cardType.toUpperCase()} •••• {card.cardNumber.slice(-4)}
            </Text>
            <Text style={styles.methodSubtext}>{card.cardHolder}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a78bfa" />
        </TouchableOpacity>
      );
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    const statusColor = item.status === 'completed' ? '#10b981' : 
                       item.status === 'pending' ? '#f59e0b' : '#ef4444';
    
    return (
      <View style={styles.transactionItem}>
        <View style={[
          styles.transactionIcon,
          { backgroundColor: isCredit ? '#10b98120' : '#ef444420' }
        ]}>
          <Ionicons 
            name={isCredit ? 'arrow-down' : 'arrow-up'} 
            size={20} 
            color={isCredit ? '#10b981' : '#ef4444'} 
          />
        </View>
        
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>{item.description}</Text>
          <Text style={styles.transactionDate}>{item.date}</Text>
        </View>
        
        <View style={styles.transactionRight}>
          <Text style={[
            styles.transactionAmount,
            { color: isCredit ? '#10b981' : '#ef4444' }
          ]}>
            {isCredit ? '+' : '-'}{walletData.currency} {item.amount.toLocaleString()}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <GLTHeader 
          title="Wallet" 
          showBackButton={true}
          onBackPress={() => NavigationHelper.goBack()}
        />
        <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c084fc" />
            <Text style={styles.loadingText}>Loading wallet...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GLTHeader 
        title="Wallet" 
        showBackButton={true}
        onBackPress={() => NavigationHelper.goBack()}
      />
      
      <LinearGradient colors={['#1a1b3d', '#2d1b4e', '#4c1d95']} style={styles.gradient}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#c084fc"
              colors={['#c084fc']}
            />
          }
        >
          {/* Balance Card */}
          <LinearGradient
            colors={['#8b5cf6', '#6d28d9', '#5b21b6']}
            style={styles.balanceCard}
          >
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>
                {isClient ? 'Wallet Balance' : 'Total Earnings'}
              </Text>
              {isClient && (
                <TouchableOpacity 
                  style={styles.topUpButton}
                  onPress={() => setShowTopUpModal(true)}
                >
                  <Ionicons name="add-circle" size={24} color="#fff" />
                  <Text style={styles.topUpButtonText}>Top Up</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.balanceAmount}>
              {walletData.currency} {walletData.balance.toLocaleString()}
            </Text>
            
            <View style={styles.balanceFooter}>
              <View style={styles.balanceInfo}>
                <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.balanceInfoText}>
                  {isClient ? 'Available for package payments' : 'Withdraw to M-Pesa'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Payment Methods Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payment Methods</Text>
            </View>

            <View style={styles.paymentMethodsContainer}>
              {renderPaymentMethod('mpesa')}
              {renderPaymentMethod('airtel')}
              
              {savedCards.map(card => (
                <View key={card.id}>
                  {renderPaymentMethod(card)}
                </View>
              ))}
              
              <TouchableOpacity 
                style={styles.addPaymentMethod}
                onPress={() => setShowAddCardModal(true)}
              >
                <View style={styles.addMethodIcon}>
                  <Ionicons name="add" size={24} color="#8b5cf6" />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.addMethodText}>Add debit/credit card</Text>
                  <Text style={styles.methodSubtext}>Visa, Mastercard, Amex</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#a78bfa" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Transactions Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>

            {walletData.transactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="receipt-outline" size={48} color="#a78bfa" />
                </View>
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptySubtitle}>
                  {isClient 
                    ? 'Top up your wallet to start using GLT services' 
                    : 'Complete deliveries to start earning'}
                </Text>
              </View>
            ) : (
              <View style={styles.transactionsList}>
                {walletData.transactions.map((transaction) => (
                  <View key={transaction.id}>
                    {renderTransaction({ item: transaction })}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Modals */}
      <AddCardModal
        visible={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        onAddCard={handleAddCard}
      />

      {isClient && (
        <MpesaTopUpModal
          visible={showTopUpModal}
          onClose={() => setShowTopUpModal(false)}
          onSuccess={handleTopUpSuccess}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b3d',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#c4b5fd',
    fontSize: 16,
  },
  
  // Balance Card
  balanceCard: {
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  topUpButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  balanceFooter: {
    marginTop: 8,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceInfoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  
  // Section
  section: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '600',
  },
  seeAllText: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Payment Methods
  paymentMethodsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  methodSubtext: {
    color: '#c4b5fd',
    fontSize: 13,
  },
  addPaymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.3)',
    borderStyle: 'dashed',
  },
  addMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addMethodText: {
    color: '#c084fc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  
  // Transactions
  transactionsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 123, 250, 0.2)',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  transactionDate: {
    color: '#c4b5fd',
    fontSize: 12,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  
  // Empty State
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default WalletScreen;
// app/(rider)/wallet.tsx - COMPLETE Wallet Implementation
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RiderBottomTabs } from '../../components/rider/RiderBottomTabs';
import { useUser } from '@/context/UserContext';
import api from '@/lib/api';
import ActionCableService from '@/lib/services/ActionCableService';
import Toast from 'react-native-toast-message';
import colors from '@/theme/colors';

interface WalletData {
  balance: number;
  pending_balance: number;
  available_balance: number;
  wallet_type: string;
  is_active: boolean;
  total_credited: number;
  total_debited: number;
  pending_withdrawals: number;
  can_withdraw: boolean;
  is_rider_wallet: boolean;
  transaction_count: number;
}

interface Transaction {
  id: number;
  transaction_type: string;
  amount: number;
  display_amount: string;
  description: string;
  status: string;
  created_at: string;
  is_credit: boolean;
  is_debit: boolean;
  transaction_icon: string;
  balance_before: number;
  balance_after: number;
}

interface Withdrawal {
  id: number;
  amount: number;
  display_amount: string;
  status: string;
  phone_number: string;
  formatted_phone_number: string;
  reference_number: string;
  created_at: string;
  processed_at?: string;
  completed_at?: string;
  failed_at?: string;
  failure_reason?: string;
  can_be_cancelled: boolean;
  can_be_retried: boolean;
}

export default function RiderWalletScreen() {
  const { user, getUserPhone } = useUser();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Withdrawal modal state
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Fetch wallet data
  const fetchWalletData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const response = await api.get('/api/v1/wallet');
      
      if (response.data.success) {
        setWallet(response.data.data);
        console.log('💰 Wallet data loaded:', response.data.data);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch wallet:', error);
      Toast.show({
        type: 'error',
        text1: 'Error Loading Wallet',
        text2: error.response?.data?.message || 'Could not load wallet data',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/wallet/transactions', {
        params: { per_page: 20 }
      });
      
      if (response.data.success) {
        setTransactions(response.data.data);
        console.log(`💳 Loaded ${response.data.data.length} transactions`);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch transactions:', error);
    }
  }, []);

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/wallet/withdrawals', {
        params: { per_page: 10 }
      });
      
      if (response.data.success) {
        setWithdrawals(response.data.data);
        console.log(`🏦 Loaded ${response.data.data.length} withdrawals`);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch withdrawals:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchWalletData();
    fetchTransactions();
    fetchWithdrawals();
  }, [fetchWalletData, fetchTransactions, fetchWithdrawals]);

  // Setup ActionCable subscriptions for real-time updates
  useEffect(() => {
    const actionCable = ActionCableService.getInstance();
    
    // Subscribe to wallet balance updates
    const balanceUnsubscribe = actionCable.subscribe('balance_update', (data) => {
      console.log('💰 Real-time balance update:', data);
      setWallet(prev => prev ? {
        ...prev,
        balance: data.balance || prev.balance,
        pending_balance: data.pending_balance || prev.pending_balance,
        available_balance: data.available_balance || prev.available_balance,
      } : null);
    });

    // Subscribe to new transactions
    const transactionUnsubscribe = actionCable.subscribe('new_transaction', (data) => {
      console.log('💳 Real-time transaction:', data);
      
      if (data.transaction) {
        setTransactions(prev => [data.transaction, ...prev].slice(0, 20));
      }
      
      // Update wallet balance
      if (data.balance !== undefined) {
        setWallet(prev => prev ? { ...prev, balance: data.balance } : null);
      }
      
      // Show notification
      Toast.show({
        type: data.transaction?.is_credit ? 'success' : 'info',
        text1: data.transaction?.is_credit ? 'Money Received' : 'Transaction',
        text2: `${data.transaction?.display_amount} - ${data.transaction?.description}`,
      });
    });

    // Subscribe to withdrawal updates
    const withdrawalCompletedUnsubscribe = actionCable.subscribe('withdrawal_completed', (data) => {
      console.log('✅ Withdrawal completed:', data);
      
      fetchWithdrawals();
      fetchWalletData(false);
      
      Toast.show({
        type: 'success',
        text1: 'Withdrawal Completed',
        text2: `${data.withdrawal?.display_amount} sent to ${data.withdrawal?.formatted_phone_number}`,
      });
    });

    const withdrawalFailedUnsubscribe = actionCable.subscribe('withdrawal_failed', (data) => {
      console.log('❌ Withdrawal failed:', data);
      
      fetchWithdrawals();
      fetchWalletData(false);
      
      Toast.show({
        type: 'error',
        text1: 'Withdrawal Failed',
        text2: data.withdrawal?.reason || 'The withdrawal could not be processed',
      });
    });

    const withdrawalCancelledUnsubscribe = actionCable.subscribe('withdrawal_cancelled', (data) => {
      console.log('ℹ️ Withdrawal cancelled:', data);
      
      fetchWithdrawals();
      fetchWalletData(false);
      
      Toast.show({
        type: 'info',
        text1: 'Withdrawal Cancelled',
        text2: `${data.withdrawal?.display_amount} refunded to wallet`,
      });
    });

    // Subscribe to wallet status changes
    const statusUnsubscribe = actionCable.subscribe('status_update', (data) => {
      console.log('🔄 Wallet status update:', data);
      setWallet(prev => prev ? { ...prev, is_active: data.is_active } : null);
      
      if (!data.is_active) {
        Toast.show({
          type: 'error',
          text1: 'Wallet Suspended',
          text2: 'Your wallet has been suspended. Contact support for assistance.',
        });
      }
    });

    // Cleanup subscriptions
    return () => {
      balanceUnsubscribe();
      transactionUnsubscribe();
      withdrawalCompletedUnsubscribe();
      withdrawalFailedUnsubscribe();
      withdrawalCancelledUnsubscribe();
      statusUnsubscribe();
    };
  }, [fetchWalletData, fetchWithdrawals]);

  // Initialize withdraw phone
  useEffect(() => {
    if (withdrawModalVisible && !withdrawPhone) {
      const userPhone = getUserPhone();
      let cleanPhone = userPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('254')) {
        cleanPhone = cleanPhone.substring(3);
      }
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
      }
      setWithdrawPhone(cleanPhone);
    }
  }, [withdrawModalVisible, getUserPhone, withdrawPhone]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchWalletData(false),
      fetchTransactions(),
      fetchWithdrawals()
    ]).finally(() => setRefreshing(false));
  }, [fetchWalletData, fetchTransactions, fetchWithdrawals]);

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Please enter a valid withdrawal amount',
      });
      return;
    }

    if (!withdrawPhone || withdrawPhone.length !== 9) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone Number',
        text2: 'Please enter a valid phone number',
      });
      return;
    }

    const amount = parseFloat(withdrawAmount);

    if (amount < 100) {
      Toast.show({
        type: 'error',
        text1: 'Minimum Amount',
        text2: 'Minimum withdrawal amount is KSH 100',
      });
      return;
    }

    if (wallet && amount > wallet.available_balance) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: `Available balance: KSH ${wallet.available_balance.toLocaleString()}`,
      });
      return;
    }

    try {
      setWithdrawing(true);

      const response = await api.post('/api/v1/wallet/withdraw', {
        amount: amount,
        phone_number: `254${withdrawPhone}`,
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Withdrawal Submitted',
          text2: 'Your withdrawal request has been submitted',
        });

        setWithdrawModalVisible(false);
        setWithdrawAmount('');
        
        // Refresh data
        fetchWalletData(false);
        fetchWithdrawals();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Withdrawal Failed',
          text2: response.data.message || 'Could not process withdrawal',
        });
      }
    } catch (error: any) {
      console.error('❌ Withdrawal error:', error);
      Toast.show({
        type: 'error',
        text1: 'Withdrawal Failed',
        text2: error.response?.data?.message || 'An error occurred',
      });
    } finally {
      setWithdrawing(false);
    }
  };

  // Handle cancel withdrawal
  const handleCancelWithdrawal = async (withdrawalId: number) => {
    Alert.alert(
      'Cancel Withdrawal',
      'Are you sure you want to cancel this withdrawal? The amount will be refunded to your wallet.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              
              const response = await api.post(`/api/v1/wallet/withdrawals/${withdrawalId}/cancel`);
              
              if (response.data.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Withdrawal Cancelled',
                  text2: 'The withdrawal has been cancelled',
                });
                
                fetchWalletData(false);
                fetchWithdrawals();
              }
            } catch (error: any) {
              console.error('❌ Cancel withdrawal error:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Could not cancel withdrawal',
              });
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (days === 1) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'pending':
      case 'processing':
        return '#f59e0b';
      case 'failed':
      case 'cancelled':
        return '#ef4444';
      default:
        return '#8E8E93';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Wallet</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
        <RiderBottomTabs currentTab="wallet" />
      </SafeAreaView>
    );
  }

  if (!wallet) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Wallet</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load wallet</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchWalletData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
        <RiderBottomTabs currentTab="wallet" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.headerRight}>
          {!wallet.is_active && (
            <View style={styles.suspendedBadge}>
              <Feather name="alert-circle" size={12} color="#ef4444" />
              <Text style={styles.suspendedText}>Suspended</Text>
            </View>
          )}
          <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
            <Feather name="refresh-cw" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Balance Card */}
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            KSH {wallet.available_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          
          {wallet.pending_balance > 0 && (
            <View style={styles.pendingInfo}>
              <Feather name="clock" size={14} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.pendingText}>
                KSH {wallet.pending_balance.toLocaleString()} pending
              </Text>
            </View>
          )}

          <View style={styles.balanceActions}>
            <TouchableOpacity
              style={[styles.balanceButton, !wallet.is_active && styles.balanceButtonDisabled]}
              onPress={() => setWithdrawModalVisible(true)}
              disabled={!wallet.is_active || !wallet.can_withdraw}
            >
              <Feather name="arrow-up" size={18} color="#fff" />
              <Text style={styles.balanceButtonText}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.balanceButton} onPress={() => fetchTransactions()}>
              <Feather name="list" size={18} color="#fff" />
              <Text style={styles.balanceButtonText}>History</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Earned</Text>
            <Text style={styles.statValue}>KSH {wallet.total_credited.toLocaleString()}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Withdrawn</Text>
            <Text style={styles.statValue}>KSH {wallet.total_debited.toLocaleString()}</Text>
          </View>
        </View>

        {/* Pending Withdrawals */}
        {withdrawals.filter(w => w.status === 'pending' || w.status === 'processing').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Withdrawals</Text>
            {withdrawals
              .filter(w => w.status === 'pending' || w.status === 'processing')
              .map((withdrawal) => (
                <View key={withdrawal.id} style={styles.withdrawalItem}>
                  <View style={styles.withdrawalLeft}>
                    <Feather name="arrow-up" size={20} color="#f59e0b" />
                    <View style={styles.withdrawalContent}>
                      <Text style={styles.withdrawalAmount}>{withdrawal.display_amount}</Text>
                      <Text style={styles.withdrawalPhone}>{withdrawal.formatted_phone_number}</Text>
                      <Text style={styles.withdrawalDate}>{formatTimestamp(withdrawal.created_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.withdrawalRight}>
                    <View style={[styles.withdrawalStatus, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                      <Text style={[styles.withdrawalStatusText, { color: '#f59e0b' }]}>
                        {withdrawal.status}
                      </Text>
                    </View>
                    {withdrawal.can_be_cancelled && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelWithdrawal(withdrawal.id)}
                        disabled={actionLoading}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color="#666" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.map((transaction) => (
              <TouchableOpacity key={transaction.id} style={styles.transactionItem}>
                <View style={[
                  styles.transactionIcon,
                  {
                    backgroundColor: transaction.is_credit
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                  },
                ]}>
                  <Text style={styles.transactionEmoji}>{transaction.transaction_icon}</Text>
                </View>
                <View style={styles.transactionContent}>
                  <Text style={styles.transactionTitle}>{transaction.description}</Text>
                  <Text style={styles.transactionDate}>{formatTimestamp(transaction.created_at)}</Text>
                  <Text style={styles.transactionType}>{transaction.transaction_type.replace(/_/g, ' ')}</Text>
                </View>
                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      {
                        color: transaction.is_credit ? '#10b981' : '#ef4444',
                      },
                    ]}
                  >
                    {transaction.display_amount}
                  </Text>
                  <View style={[
                    styles.transactionStatus,
                    { backgroundColor: `${getStatusColor(transaction.status)}20` }
                  ]}>
                    <Text style={[styles.transactionStatusText, { color: getStatusColor(transaction.status) }]}>
                      {transaction.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Withdrawal Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Money</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Amount (KSH)</Text>
              <TextInput
                style={styles.input}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Enter amount"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>M-Pesa Phone Number</Text>
              <View style={styles.phoneInputContainer}>
                <Text style={styles.phonePrefix}>+254</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={withdrawPhone}
                  onChangeText={setWithdrawPhone}
                  placeholder="712345678"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  maxLength={9}
                />
              </View>

              <View style={styles.withdrawInfo}>
                <Feather name="info" size={16} color="#f59e0b" />
                <Text style={styles.withdrawInfoText}>
                  Minimum withdrawal: KSH 100{'\n'}
                  Available: KSH {wallet.available_balance.toLocaleString()}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.withdrawButton, withdrawing && styles.withdrawButtonDisabled]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="arrow-up" size={20} color="#fff" />
                    <Text style={styles.withdrawButtonText}>Withdraw</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <RiderBottomTabs currentTab="wallet" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
  },
  suspendedText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  pendingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  balanceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  balanceButtonDisabled: {
    opacity: 0.5,
  },
  balanceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  withdrawalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  withdrawalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  withdrawalContent: {
    flex: 1,
  },
  withdrawalAmount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  withdrawalPhone: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 2,
  },
  withdrawalDate: {
    color: '#666',
    fontSize: 11,
  },
  withdrawalRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  withdrawalStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  withdrawalStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionEmoji: {
    fontSize: 20,
  },
  transactionContent: {
    flex: 1,
  },
  transactionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  transactionDate: {
    color: '#8E8E93',
    fontSize: 11,
    marginBottom: 2,
  },
  transactionType: {
    color: '#666',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F2C34',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111B21',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111B21',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  phonePrefix: {
    color: '#8E8E93',
    fontSize: 16,
    paddingLeft: 16,
    paddingRight: 8,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  withdrawInfo: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  withdrawInfoText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 12,
    lineHeight: 18,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  withdrawButtonDisabled: {
    opacity: 0.6,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
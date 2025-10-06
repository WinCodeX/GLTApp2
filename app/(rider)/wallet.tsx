// app/(rider)/wallet.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RiderBottomTabs } from '../../components/rider/RiderBottomTabs';

export default function RiderWalletScreen() {
  const transactions = [
    {
      id: 1,
      type: 'credit',
      title: 'Payment Received',
      amount: '+₦5,000',
      date: 'Today, 10:30 AM',
    },
    {
      id: 2,
      type: 'debit',
      title: 'Service Fee',
      amount: '-₦200',
      date: 'Yesterday, 3:45 PM',
    },
    {
      id: 3,
      type: 'credit',
      title: 'Refund',
      amount: '+₦1,500',
      date: 'Yesterday, 11:20 AM',
    },
  ];

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
        <TouchableOpacity style={styles.headerButton}>
          <Feather name="more-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Balance Card */}
        <LinearGradient
          colors={['#7B3F98', '#5A2D82', '#4A1E6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₦25,300.00</Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.balanceButton}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.balanceButtonText}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.balanceButton}>
              <Feather name="arrow-up" size={18} color="#fff" />
              <Text style={styles.balanceButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={styles.quickActionIcon}>
              <Feather name="send" size={20} color="#7B3F98" />
            </View>
            <Text style={styles.quickActionText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={styles.quickActionIcon}>
              <Feather name="download" size={20} color="#7B3F98" />
            </View>
            <Text style={styles.quickActionText}>Request</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={styles.quickActionIcon}>
              <Feather name="credit-card" size={20} color="#7B3F98" />
            </View>
            <Text style={styles.quickActionText}>Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionItem}>
            <View style={styles.quickActionIcon}>
              <Feather name="clock" size={20} color="#7B3F98" />
            </View>
            <Text style={styles.quickActionText}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.map((transaction) => (
            <TouchableOpacity key={transaction.id} style={styles.transactionItem}>
              <View style={[
                styles.transactionIcon,
                {
                  backgroundColor:
                    transaction.type === 'credit'
                      ? 'rgba(76, 175, 80, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                },
              ]}>
                <Feather
                  name={transaction.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                  size={20}
                  color={transaction.type === 'credit' ? '#4CAF50' : '#ef4444'}
                />
              </View>
              <View style={styles.transactionContent}>
                <Text style={styles.transactionTitle}>{transaction.title}</Text>
                <Text style={styles.transactionDate}>{transaction.date}</Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  {
                    color: transaction.type === 'credit' ? '#4CAF50' : '#ef4444',
                  },
                ]}
              >
                {transaction.amount}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

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
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
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
    marginBottom: 24,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
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
  balanceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
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
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
});
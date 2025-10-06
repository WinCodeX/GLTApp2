// app/(rider)/index.tsx
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
import { useUser } from '../../context/UserContext';

export default function RiderHomeScreen() {
  const { user } = useUser();

  const quickActions = [
    { id: 1, title: 'Send Package', icon: 'send', color: '#7B3F98' },
    { id: 2, title: 'Track Order', icon: 'map-pin', color: '#2196F3' },
    { id: 3, title: 'Cost Calculator', icon: 'calculator', color: '#4CAF50' },
    { id: 4, title: 'History', icon: 'clock', color: '#FF9800' },
  ];

  const recentOrders = [
    { id: 1, status: 'In Transit', location: 'Lekki Phase 1', tracking: 'GLT-12345' },
    { id: 2, status: 'Delivered', location: 'Victoria Island', tracking: 'GLT-12344' },
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
        <View>
          <Text style={styles.headerGreeting}>Hello,</Text>
          <Text style={styles.headerName}>
            {user?.display_name || user?.first_name || 'Rider'}
          </Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Feather name="bell" size={24} color="#fff" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>2</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity key={action.id} style={styles.actionCard}>
                <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                  <Feather name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={styles.actionText}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {recentOrders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderCard}>
              <View style={styles.orderIcon}>
                <Feather name="package" size={20} color="#7B3F98" />
              </View>
              <View style={styles.orderContent}>
                <Text style={styles.orderTracking}>{order.tracking}</Text>
                <Text style={styles.orderLocation}>{order.location}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: order.status === 'Delivered' ? '#4CAF50' : '#FF9800' }
              ]}>
                <Text style={styles.statusText}>{order.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Promotions Banner */}
        <View style={styles.promotionCard}>
          <LinearGradient
            colors={['#7B3F98', '#5A2D82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promotionGradient}
          >
            <Feather name="gift" size={32} color="#fff" />
            <View style={styles.promotionContent}>
              <Text style={styles.promotionTitle}>Special Offer!</Text>
              <Text style={styles.promotionText}>Get 20% off on your next delivery</Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      <RiderBottomTabs currentTab="home" />
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
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  headerGreeting: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  headerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  orderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123, 63, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderContent: {
    flex: 1,
  },
  orderTracking: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderLocation: {
    color: '#8E8E93',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  promotionCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  promotionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  promotionContent: {
    flex: 1,
  },
  promotionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  promotionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
});
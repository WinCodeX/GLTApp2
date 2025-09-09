import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import colors from '../theme/colors';
import api from '../lib/api';

interface GLTHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  title?: string;
}

export default function GLTHeader({ 
  showBackButton = false, 
  onBackPress,
  title = "GLT Logistics" 
}: GLTHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [notificationCount, setNotificationCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  const handleOpenDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const handleNotifications = () => {
    router.push('/(drawer)/notifications');
  };

  const handleCart = () => {
    router.push('/(drawer)/cart');
  };

  // Fetch notification count
  const fetchNotificationCount = async () => {
    try {
      const response = await api.get('/api/v1/notifications/unread_count');
      if (response.data.success) {
        setNotificationCount(response.data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  // FIXED: Fetch ALL cart count (pending_unpaid packages) - no 20 package limit
  const fetchCartCount = async () => {
    try {
      console.log('🛒 Fetching ALL pending_unpaid packages for cart count...');
      
      // FIXED: Add parameters to fetch ALL packages without pagination limits
      const response = await api.get('/api/v1/packages', {
        params: {
          state: 'pending_unpaid',
          per_page: 1000, // Request a very high number to get all packages
          page: 1
        },
        timeout: 15000 // Increase timeout for potentially large response
      });
      
      if (response.data.success) {
        let totalCount = response.data.data?.length || 0;
        
        // FIXED: Check if there are more pages and fetch them too
        const pagination = response.data.pagination;
        if (pagination && pagination.total_pages > 1) {
          console.log(`🛒 Multiple pages detected for cart count: ${pagination.total_pages} pages total`);
          
          // Fetch remaining pages
          const additionalPages = [];
          for (let page = 2; page <= pagination.total_pages; page++) {
            additionalPages.push(
              api.get('/api/v1/packages', {
                params: {
                  state: 'pending_unpaid',
                  per_page: 1000,
                  page: page
                },
                timeout: 15000
              })
            );
          }

          const additionalResponses = await Promise.all(additionalPages);
          const additionalCount = additionalResponses.reduce((acc, res) => {
            return acc + (res.data.success ? (res.data.data?.length || 0) : 0);
          }, 0);

          totalCount += additionalCount;
          console.log(`🛒 Total cart count with all pages: ${totalCount}`);
        }
        
        setCartCount(totalCount);
      }
    } catch (error) {
      console.error('Failed to fetch cart count:', error);
      // Keep previous count on error
    }
  };

  useEffect(() => {
    fetchNotificationCount();
    fetchCartCount();
    
    // Refresh counts every 30 seconds
    const interval = setInterval(() => {
      fetchNotificationCount();
      fetchCartCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const renderBadge = (count: number, color: string) => {
    if (count === 0) return null;
    
    return (
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>
          {count > 99 ? '99+' : count.toString()}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Left section: Back/Menu + Title */}
      <View style={styles.leftContainer}>
        {showBackButton ? (
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleOpenDrawer} style={styles.menuIcon}>
            <Feather name="menu" size={26} color="white" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* Right section: Notifications + Cart */}
      <View style={styles.rightContainer}>
        {/* Notifications */}
        <TouchableOpacity onPress={handleNotifications} style={styles.iconButton}>
          <View style={styles.iconContainer}>
            <Feather name="bell" size={22} color="white" />
            {renderBadge(notificationCount, '#8b5cf6')}
          </View>
        </TouchableOpacity>

        {/* Cart */}
        <TouchableOpacity onPress={handleCart} style={styles.iconButton}>
          <View style={styles.iconContainer}>
            <Feather name="shopping-cart" size={22} color="white" />
            {renderBadge(cartCount, '#ef4444')}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.header,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    marginRight: 12,
    padding: 4,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(124, 58, 237, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'System',
    flex: 1,
  },
  iconButton: {
    padding: 4,
  },
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.header,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
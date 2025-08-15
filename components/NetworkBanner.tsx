// components/NetworkBanner.tsx - Enhanced version with reconnection notification
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnected' | null;

export default function NetworkBanner() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [slideAnim] = useState(new Animated.Value(-100)); // Start off-screen
  const insets = useSafeAreaInsets();
  const previousConnectionRef = useRef<boolean | null>(null);
  const reconnectedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('📡 Network state changed:', state.isConnected);
      
      const isCurrentlyConnected = state.isConnected;
      const wasConnected = previousConnectionRef.current;

      if (isCurrentlyConnected === false) {
        // Lost connection
        setConnectionStatus('disconnected');
        // Clear any existing reconnection timeout
        if (reconnectedTimeoutRef.current) {
          clearTimeout(reconnectedTimeoutRef.current);
          reconnectedTimeoutRef.current = null;
        }
      } else if (isCurrentlyConnected === true && wasConnected === false) {
        // Reconnected
        setConnectionStatus('reconnected');
        
        // Hide reconnection banner after 3 seconds
        reconnectedTimeoutRef.current = setTimeout(() => {
          setConnectionStatus('connected');
        }, 3000);
      } else if (isCurrentlyConnected === true && wasConnected !== false) {
        // Initially connected or stayed connected
        setConnectionStatus('connected');
      }

      previousConnectionRef.current = isCurrentlyConnected;
    });

    // Initial network state check
    NetInfo.fetch().then(state => {
      console.log('📡 Initial network state:', state.isConnected);
      previousConnectionRef.current = state.isConnected;
      setConnectionStatus(state.isConnected ? 'connected' : 'disconnected');
    });

    return () => {
      unsubscribe();
      if (reconnectedTimeoutRef.current) {
        clearTimeout(reconnectedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'reconnected') {
      // Show banner - slide down
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Hide banner - slide up
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [connectionStatus, slideAnim]);

  // Don't render anything if we haven't determined connection status yet
  if (connectionStatus === null || connectionStatus === 'connected') return null;

  const isReconnected = connectionStatus === 'reconnected';

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          top: insets.top, // Position below status bar/notch
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <LinearGradient
        colors={
          isReconnected 
            ? ['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.15)'] // Success gradient
            : ['rgba(239, 68, 68, 0.15)', 'rgba(220, 38, 38, 0.15)'] // Error gradient
        }
        style={[
          styles.banner,
          isReconnected ? styles.reconnectedBanner : styles.disconnectedBanner
        ]}
      >
        <View style={[
          styles.iconContainer,
          isReconnected ? styles.reconnectedIconContainer : styles.disconnectedIconContainer
        ]}>
          <MaterialCommunityIcons
            name={isReconnected ? "wifi-check" : "wifi-off"}
            size={20}
            color={isReconnected ? "#10b981" : "#ef4444"}
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[
            styles.bannerText,
            isReconnected ? styles.reconnectedText : styles.disconnectedText
          ]}>
            {isReconnected ? "Back Online" : "No Internet Connection"}
          </Text>
          <Text style={[
            styles.bannerSubText,
            isReconnected ? styles.reconnectedSubText : styles.disconnectedSubText
          ]}>
            {isReconnected 
              ? "Connection restored successfully" 
              : "Some features may not be available"
            }
          </Text>
        </View>

        <View style={[
          styles.statusIndicator,
          { backgroundColor: isReconnected ? "#10b981" : "#ef4444" }
        ]} />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000, // High z-index to appear above other content
    elevation: 10, // Android elevation
    // Allow touches to pass through the container
    pointerEvents: 'box-none',
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    // Allow the banner itself to receive touches (for future functionality)
    pointerEvents: 'auto',
  },

  disconnectedBanner: {
    backgroundColor: 'rgba(46, 26, 26, 0.98)', // Error background
    borderBottomColor: 'rgba(239, 68, 68, 0.6)',
  },

  reconnectedBanner: {
    backgroundColor: 'rgba(26, 46, 37, 0.98)', // Success background
    borderBottomColor: 'rgba(16, 185, 129, 0.6)',
  },

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  disconnectedIconContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },

  reconnectedIconContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },

  textContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },

  bannerText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 0.3,
  },

  bannerSubText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
    lineHeight: 16,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // Disconnected styles
  disconnectedText: {
    color: '#f87171', // Error text color
    textShadowColor: 'rgba(248, 113, 113, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  disconnectedSubText: {
    color: 'rgba(248, 113, 113, 0.85)',
  },

  // Reconnected styles
  reconnectedText: {
    color: '#22c55e', // Success text color
    textShadowColor: 'rgba(34, 197, 94, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  reconnectedSubText: {
    color: 'rgba(34, 197, 94, 0.85)',
  },

  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
});
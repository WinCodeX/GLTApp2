import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

const COLORS = {
  offline: '#ff5a5f',
  server_error: '#ff8c42',
  online: '#50fa7b',
  text: '#fff',
};

type StatusType = 'online' | 'offline' | 'server_error' | null;

const NetworkBanner = ({ status }: { status: StatusType }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!status) return;

    // Animate in
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-hide if status is online
    if (status === 'online') {
      const timeout = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [status]);

  if (!status) return null;

  const backgroundColor =
    status === 'offline'
      ? COLORS.offline
      : status === 'server_error'
      ? COLORS.server_error
      : COLORS.online;

  const message =
    status === 'offline'
      ? 'You are offline'
      : status === 'server_error'
      ? 'Server is unreachable'
      : "You're back online";

  return (
    <Animated.View
      pointerEvents="none" // ✅ Prevents blocking touch events
      style={[
        styles.banner,
        {
          backgroundColor,
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    zIndex: 999,
    height: 30,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  text: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default NetworkBanner;
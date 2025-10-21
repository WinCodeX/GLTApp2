// components/agent/AgentFloatingActionButton.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FAB_SIZE = 56;
const MENU_ITEM_SIZE = 50;
const MENU_RADIUS = 100;

interface AgentFloatingActionButtonProps {
  onNewPress: () => void;
  onScanPress: () => void;
  onQuickCallPress: () => void;
}

export const AgentFloatingActionButton: React.FC<AgentFloatingActionButtonProps> = ({
  onNewPress,
  onScanPress,
  onQuickCallPress,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const toValue = isExpanded ? 0 : 1;
    
    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.spring(scaleAnim, {
        toValue,
        useNativeDriver: true,
        friction: 6,
      }),
      Animated.timing(opacityAnim, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setIsExpanded(!isExpanded);
  };

  const handleMenuItemPress = (action: () => void) => {
    toggleMenu();
    setTimeout(() => action(), 300);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Calculate menu item positions (half circle above FAB)
  const menuItems = [
    {
      icon: 'add',
      label: 'New',
      color: ['#667eea', '#764ba2'],
      onPress: () => handleMenuItemPress(onNewPress),
      angle: -60, // Left position
    },
    {
      icon: 'qr-code-scanner',
      label: 'Scan',
      color: ['#FF9500', '#FF8C00'],
      onPress: () => handleMenuItemPress(onScanPress),
      angle: -90, // Center position
    },
    {
      icon: 'phone',
      label: 'Quick Call',
      color: ['#34C759', '#30A46C'],
      onPress: () => handleMenuItemPress(onQuickCallPress),
      angle: -120, // Right position
    },
  ];

  const getMenuItemPosition = (angle: number) => {
    const radian = (angle * Math.PI) / 180;
    return {
      x: MENU_RADIUS * Math.cos(radian),
      y: MENU_RADIUS * Math.sin(radian),
    };
  };

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <Animated.View 
          style={[
            styles.backdrop,
            {
              opacity: opacityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.7],
              }),
            },
          ]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={toggleMenu}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* Menu Items */}
      <View style={styles.menuContainer} pointerEvents="box-none">
        {menuItems.map((item, index) => {
          const position = getMenuItemPosition(item.angle);
          const translateX = scaleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, position.x],
          });
          const translateY = scaleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, position.y],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.menuItem,
                {
                  opacity: opacityAnim,
                  transform: [
                    { translateX },
                    { translateY },
                    { scale: scaleAnim },
                  ],
                },
              ]}
              pointerEvents={isExpanded ? 'auto' : 'none'}
            >
              <TouchableOpacity
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={item.color}
                  style={styles.menuItemGradient}
                >
                  <MaterialIcons
                    name={item.icon as any}
                    size={24}
                    color="#fff"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Main FAB */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity
          onPress={toggleMenu}
          activeOpacity={0.8}
          style={styles.fabTouchable}
        >
          <LinearGradient
            colors={['#7B3F98', '#9B5FB8']}
            style={styles.fab}
          >
            <Animated.View
              style={{
                transform: [{ rotate: rotation }],
              }}
            >
              <MaterialIcons
                name="add"
                size={28}
                color="#fff"
              />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 998,
  },
  menuContainer: {
    position: 'absolute',
    bottom: 110,
    left: SCREEN_WIDTH / 2 - MENU_ITEM_SIZE / 2,
    zIndex: 999,
  },
  menuItem: {
    position: 'absolute',
    width: MENU_ITEM_SIZE,
    height: MENU_ITEM_SIZE,
    left: -MENU_ITEM_SIZE / 2,
    top: -MENU_ITEM_SIZE / 2,
  },
  menuItemGradient: {
    width: MENU_ITEM_SIZE,
    height: MENU_ITEM_SIZE,
    borderRadius: MENU_ITEM_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    left: SCREEN_WIDTH / 2 - FAB_SIZE / 2,
    zIndex: 1000,
  },
  fabTouchable: {
    width: FAB_SIZE,
    height: FAB_SIZE,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7B3F98',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
});